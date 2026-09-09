import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Itinerary, LngLat, ResolvedLeg } from '@/types/itinerary';
import { boundsOf, padBounds, samplePolyline } from '@/lib/geo';
import { orderedStops } from '@/lib/itinerary';
import { getBasemap, type BasemapId } from '@/services/basemaps';
import { MapOverlay } from './MapOverlay';
import { ensureLegLayers, INTERACTIVE_LAYERS, legsToGeoJSON } from './mapLayers';

export interface FocusRequest {
  stopId: string;
  token: number;
}

interface Props {
  itinerary: Itinerary;
  legs: ResolvedLeg[];
  basemap: BasemapId;
  selectedStopId: string | null;
  hoveredStopId: string | null;
  selectedLegId: string | null;
  /** Increment to request "fit itinerary". */
  fitToken: number;
  focusRequest: FocusRequest | null;
  onSelectStop: (id: string | null) => void;
  onHoverStop: (id: string | null) => void;
  onSelectLeg: (id: string | null) => void;
  onMapReady: (map: maplibregl.Map, container: HTMLDivElement) => void;
  children?: React.ReactNode;
}

/** Bounds covering every stop and every drawn route. */
function itineraryBounds(itinerary: Itinerary, legs: ResolvedLeg[]) {
  const pts: LngLat[] = itinerary.stops.map((s) => [s.longitude, s.latitude]);
  for (const l of legs) pts.push(...samplePolyline(l.geometry, 40));
  const b = boundsOf(pts);
  return b ? padBounds(b) : undefined;
}

/** Padding that leaves room for labels, scaled to the viewport. */
function fitPadding(container: HTMLElement) {
  const w = container.clientWidth;
  const h = container.clientHeight;
  const small = w < 600;
  return {
    top: Math.min(110, Math.max(60, h * 0.14)),
    bottom: Math.min(120, Math.max(60, h * 0.16)),
    left: small ? 50 : Math.min(190, Math.max(80, w * 0.15)),
    right: small ? 50 : Math.min(200, Math.max(90, w * 0.16)),
  };
}

export function MapView({
  itinerary,
  legs,
  basemap,
  selectedStopId,
  hoveredStopId,
  selectedLegId,
  fitToken,
  focusRequest,
  onSelectStop,
  onHoverStop,
  onSelectLeg,
  onMapReady,
  children,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  const geojson = useMemo(() => legsToGeoJSON(legs, selectedLegId), [legs, selectedLegId]);
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  const handlersRef = useRef({ onSelectStop, onSelectLeg });
  handlersRef.current = { onSelectStop, onSelectLeg };

  // Create the map once.
  useEffect(() => {
    const host = canvasHostRef.current;
    const container = containerRef.current;
    if (!host || !container) return;

    const m = new maplibregl.Map({
      container: host,
      style: getBasemap(basemap).style,
      center: [-98, 39],
      zoom: 3,
      attributionControl: false,
      // Required so the WebGL canvas can be read back for export.
      canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
      fadeDuration: 150,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right');

    m.on('style.load', () => {
      ensureLegLayers(m, geojsonRef.current);
      setStyleReady(true);
    });

    // Route interactions
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const hit = m
        .queryRenderedFeatures(e.point, { layers: INTERACTIVE_LAYERS.filter((id) => !!m.getLayer(id)) })
        .find((f) => f.properties?.id);
      if (hit) handlersRef.current.onSelectLeg(String(hit.properties!.id));
      else {
        handlersRef.current.onSelectLeg(null);
        handlersRef.current.onSelectStop(null);
      }
    };
    m.on('click', onClick);
    const onMove = (e: maplibregl.MapMouseEvent) => {
      const layers = INTERACTIVE_LAYERS.filter((id) => !!m.getLayer(id));
      if (!layers.length) return;
      const hit = m.queryRenderedFeatures(e.point, { layers });
      m.getCanvas().style.cursor = hit.length ? 'pointer' : '';
    };
    m.on('mousemove', onMove);

    setMap(m);
    onMapReady(m, container);

    const ro = new ResizeObserver(() => m.resize());
    ro.observe(container);

    return () => {
      ro.disconnect();
      m.remove();
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap switch: setStyle drops our layers; style.load re-adds them.
  useEffect(() => {
    if (!map) return;
    const style = getBasemap(basemap).style;
    setStyleReady(false);
    map.setStyle(style, { diff: false });
  }, [map, basemap]);

  // Push leg data whenever it changes.
  useEffect(() => {
    if (!map || !styleReady) return;
    ensureLegLayers(map, geojson);
  }, [map, styleReady, geojson]);

  // Fit to the whole itinerary when the itinerary changes or on request.
  const lastFitRef = useRef<{ itineraryId: string; token: number } | null>(null);
  useEffect(() => {
    if (!map || !containerRef.current) return;
    const b = itineraryBounds(itinerary, legs);
    if (!b) return;
    const prev = lastFitRef.current;
    const isNewItinerary = prev?.itineraryId !== itinerary.id;
    const isRequest = prev?.token !== fitToken;
    if (!isNewItinerary && !isRequest) return;
    lastFitRef.current = { itineraryId: itinerary.id, token: fitToken };
    map.fitBounds(
      [
        [b.west, b.south],
        [b.east, b.north],
      ],
      {
        padding: fitPadding(containerRef.current),
        maxZoom: 14,
        duration: prev ? 900 : 0,
        essential: true,
      },
    );
  }, [map, itinerary, legs, fitToken]);

  // Focus a stop from the itinerary panel.
  useEffect(() => {
    if (!map || !focusRequest) return;
    const stop = itinerary.stops.find((s) => s.id === focusRequest.stopId);
    if (!stop) return;
    map.flyTo({
      center: [stop.longitude, stop.latitude],
      zoom: Math.max(map.getZoom(), 11.5),
      duration: 900,
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focusRequest]);

  const stops = useMemo(() => orderedStops(itinerary), [itinerary]);

  return (
    <div className="map-frame" ref={containerRef}>
      <div className="map-frame__canvas" ref={canvasHostRef} />
      {map && (
        <MapOverlay
          map={map}
          frame={containerRef.current}
          stops={stops}
          legs={legs}
          selectedStopId={selectedStopId}
          hoveredStopId={hoveredStopId}
          selectedLegId={selectedLegId}
          onSelectStop={onSelectStop}
          onHoverStop={onHoverStop}
          onSelectLeg={onSelectLeg}
        />
      )}
      {children}
    </div>
  );
}
