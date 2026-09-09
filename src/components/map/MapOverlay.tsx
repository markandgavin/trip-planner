import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import type { ResolvedLeg, Stop } from '@/types/itinerary';
import { pointAlong, samplePolyline } from '@/lib/geo';
import {
  declutterMarkers,
  placeLabels,
  type LabelVariant,
  type PlacementResult,
  type Rect,
  type Size,
} from '@/lib/labelPlacement';
import { StopMarker } from './StopMarker';
import { StopLabel } from './StopLabel';
import { LegLabel } from './LegLabel';

const MARKER_RADIUS = 16;
const MARKER_RADIUS_SELECTED = 19;

interface Props {
  map: maplibregl.Map;
  /** The map frame element; fixed chrome inside it is treated as label obstacles. */
  frame: HTMLElement | null;
  stops: Stop[];
  legs: ResolvedLeg[];
  selectedStopId: string | null;
  hoveredStopId: string | null;
  selectedLegId: string | null;
  onSelectStop: (id: string) => void;
  onHoverStop: (id: string | null) => void;
  onSelectLeg: (id: string) => void;
}

type SizeMap = Map<string, Size>;

const stopKey = (id: string, variant: LabelVariant, expanded: boolean) =>
  `stop:${id}:${variant}${expanded ? ':x' : ''}`;
const legKey = (id: string, variant: LabelVariant) => `leg:${id}:${variant}`;

/**
 * Renders every label variant once into an invisible host, measures them, and
 * reports the sizes. Re-runs whenever the itinerary or leg data changes.
 */
function LabelMeasurer({
  stops,
  legs,
  onMeasured,
}: {
  stops: Stop[];
  legs: ResolvedLeg[];
  onMeasured: (sizes: SizeMap) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const version = useMemo(
    () => JSON.stringify([stops, legs.map((l) => [l.id, l.source, l.loading, l.durationMinutes, l.distanceMiles, l.leg])]),
    [stops, legs],
  );

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const sizes: SizeMap = new Map();
      host.querySelectorAll<HTMLElement>('[data-measure-key]').forEach((el) => {
        const r = el.getBoundingClientRect();
        sizes.set(el.dataset.measureKey!, { w: Math.ceil(r.width), h: Math.ceil(r.height) });
      });
      onMeasured(sizes);
    };
    measure();
    // Web fonts may finish loading after first paint; re-measure then.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    let cancelled = false;
    fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  return (
    <div className="measure-host" ref={hostRef} aria-hidden>
      {stops.map((s) => (
        <div key={s.id} style={{ display: 'contents' }}>
          <div data-measure-key={stopKey(s.id, 'full', false)} style={{ display: 'inline-block' }}>
            <StopLabel stop={s} variant="full" />
          </div>
          <div data-measure-key={stopKey(s.id, 'full', true)} style={{ display: 'inline-block' }}>
            <StopLabel stop={s} variant="full" expanded />
          </div>
          <div data-measure-key={stopKey(s.id, 'compact', false)} style={{ display: 'inline-block' }}>
            <StopLabel stop={s} variant="compact" />
          </div>
        </div>
      ))}
      {legs.map((l) => (
        <div key={l.id} style={{ display: 'contents' }}>
          <div data-measure-key={legKey(l.id, 'full')} style={{ display: 'inline-block' }}>
            <LegLabel leg={l} variant="full" />
          </div>
          <div data-measure-key={legKey(l.id, 'compact')} style={{ display: 'inline-block' }}>
            <LegLabel leg={l} variant="compact" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Re-render on every map movement (rAF-throttled). */
function useMapTick(map: maplibregl.Map): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let frame = 0;
    const bump = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setTick((t) => t + 1);
      });
    };
    map.on('move', bump);
    map.on('resize', bump);
    map.on('load', bump);
    bump();
    return () => {
      map.off('move', bump);
      map.off('resize', bump);
      map.off('load', bump);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [map]);
  return tick;
}

const FALLBACK_SIZE: Size = { w: 140, h: 44 };

/** Closest point on a rect's edge to a point (for leader lines). */
function edgePointToward(rect: Rect, px: number, py: number): { x: number; y: number } {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = px - cx;
  const dy = py - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = rect.w / 2 / Math.abs(dx || 1e-6);
  const sy = rect.h / 2 / Math.abs(dy || 1e-6);
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

/** Screen rects (relative to the frame) of fixed UI that labels must not cover. */
function chromeObstacles(frame: HTMLElement | null): Rect[] {
  if (!frame) return [];
  const base = frame.getBoundingClientRect();
  const rects: Rect[] = [];
  frame
    .querySelectorAll<HTMLElement>('.map-chrome > *, .maplibregl-ctrl-top-right .maplibregl-ctrl, .maplibregl-ctrl-bottom-right .maplibregl-ctrl')
    .forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      rects.push({ x: r.left - base.left - 4, y: r.top - base.top - 4, w: r.width + 8, h: r.height + 8 });
    });
  return rects;
}

export function MapOverlay({
  map,
  frame,
  stops,
  legs,
  selectedStopId,
  hoveredStopId,
  selectedLegId,
  onSelectStop,
  onHoverStop,
  onSelectLeg,
}: Props) {
  const tick = useMapTick(map);
  const [sizes, setSizes] = useState<SizeMap>(new Map());
  const previousRef = useRef<PlacementResult | undefined>(undefined);

  const layout = useMemo(() => {
    void tick; // re-run whenever the map moves
    const canvas = map.getCanvas();
    const viewport: Size = { w: canvas.clientWidth, h: canvas.clientHeight };

    const projected = stops.map((s) => {
      const p = map.project([s.longitude, s.latitude]);
      return { id: s.id, x: p.x, y: p.y, radius: s.id === selectedStopId ? MARKER_RADIUS_SELECTED : MARKER_RADIUS };
    });
    const decluttered = declutterMarkers(projected);
    const markerPoints = stops.map((s, i) => {
      const d = decluttered[i];
      const pinned = s.id === selectedStopId || s.id === hoveredStopId;
      return {
        stop: s,
        // Display position (possibly nudged) and true position.
        x: d.dx,
        y: d.dy,
        trueX: d.x,
        trueY: d.y,
        displaced: d.displaced,
        radius: projected[i].radius,
        pinned,
      };
    });

    const legAnchors = legs.map((l) => {
      const mid = pointAlong(l.geometry, 0.5).point;
      const before = pointAlong(l.geometry, 0.47).point;
      const after = pointAlong(l.geometry, 0.53).point;
      const p = map.project(mid);
      const a = map.project(before);
      const b = map.project(after);
      return { leg: l, x: p.x, y: p.y, bearing: Math.atan2(b.y - a.y, b.x - a.x) };
    });

    const routePoints: Array<{ x: number; y: number }> = [];
    for (const l of legs) {
      for (const c of samplePolyline(l.geometry, 60)) {
        const p = map.project(c);
        if (p.x >= -50 && p.y >= -50 && p.x <= viewport.w + 50 && p.y <= viewport.h + 50) {
          routePoints.push({ x: p.x, y: p.y });
        }
      }
    }

    const placement = placeLabels({
      viewport,
      markers: markerPoints.map((m) => ({ id: m.stop.id, x: m.x, y: m.y, radius: m.radius })),
      stopLabels: markerPoints.map((m) => ({
        id: m.stop.id,
        markerId: m.stop.id,
        priority: m.stop.order,
        pinned: m.pinned,
        sizes: {
          full: sizes.get(stopKey(m.stop.id, 'full', m.pinned)) ?? FALLBACK_SIZE,
          compact: sizes.get(stopKey(m.stop.id, 'compact', false)) ?? { w: 100, h: 24 },
        },
      })),
      legLabels: legAnchors.map((a) => ({
        id: a.leg.id,
        x: a.x,
        y: a.y,
        bearing: a.bearing,
        priority: a.leg.index,
        pinned: a.leg.id === selectedLegId,
        placeFirst: a.leg.mode === 'flight',
        sizes: {
          full: sizes.get(legKey(a.leg.id, 'full')) ?? { w: 110, h: 26 },
          compact: sizes.get(legKey(a.leg.id, 'compact')) ?? { w: 70, h: 26 },
        },
      })),
      routePoints,
      obstacles: chromeObstacles(frame),
      compactOnly: viewport.w * viewport.h < 520_000,
      previous: previousRef.current,
    });
    previousRef.current = placement;

    return { viewport, markerPoints, legAnchors, placement };
  }, [map, frame, tick, stops, legs, sizes, selectedStopId, hoveredStopId, selectedLegId]);

  const { markerPoints, legAnchors, placement } = layout;

  return (
    <div className="map-overlay">
      <LabelMeasurer stops={stops} legs={legs} onMeasured={setSizes} />

      {/* Leader lines: displaced markers → true location, markers → labels */}
      <svg className="map-overlay__svg" aria-hidden>
        {markerPoints.map((m) =>
          m.displaced ? (
            <g key={`d-${m.stop.id}`}>
              <line
                x1={m.trueX}
                y1={m.trueY}
                x2={m.x}
                y2={m.y}
                stroke="rgba(11,18,32,0.7)"
                strokeWidth={1.5}
              />
              <circle cx={m.trueX} cy={m.trueY} r={3.5} fill="#0b1220" stroke="#fff" strokeWidth={1.5} />
            </g>
          ) : null,
        )}
        {markerPoints.map((m) => {
          const placed = placement.stopLabels.get(m.stop.id);
          if (!placed || placed.hidden) return null;
          const edge = edgePointToward(placed.rect, m.x, m.y);
          return (
            <line
              key={m.stop.id}
              x1={m.x}
              y1={m.y}
              x2={edge.x}
              y2={edge.y}
              stroke={m.pinned ? '#2563eb' : 'rgba(11,18,32,0.55)'}
              strokeWidth={m.pinned ? 2 : 1.5}
            />
          );
        })}
      </svg>

      {legAnchors.map((a) => {
        const placed = placement.legLabels.get(a.leg.id);
        if (!placed || placed.hidden) return null;
        return (
          <LegLabel
            key={a.leg.id}
            leg={a.leg}
            variant={placed.variant}
            selected={a.leg.id === selectedLegId}
            x={placed.rect.x}
            y={placed.rect.y}
            onSelect={onSelectLeg}
          />
        );
      })}

      {markerPoints.map((m) => {
        const placed = placement.stopLabels.get(m.stop.id);
        if (!placed || placed.hidden) return null;
        return (
          <StopLabel
            key={m.stop.id}
            stop={m.stop}
            variant={placed.variant}
            expanded={m.pinned && placed.variant === 'full'}
            pinned={m.pinned}
            x={placed.rect.x}
            y={placed.rect.y}
            onSelect={onSelectStop}
            onHover={onHoverStop}
          />
        );
      })}

      {markerPoints.map((m) => (
        <StopMarker
          key={m.stop.id}
          stop={m.stop}
          x={m.x}
          y={m.y}
          selected={m.stop.id === selectedStopId}
          hovered={m.stop.id === hoveredStopId}
          dimmed={false}
          onSelect={onSelectStop}
          onHover={onHoverStop}
        />
      ))}
    </div>
  );
}
