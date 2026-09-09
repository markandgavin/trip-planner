/**
 * Screen-space label placement with collision avoidance.
 *
 * Pure function: given marker positions, label sizes and the viewport, it decides
 * where each stop label and travel-leg label goes (and whether it is shown in
 * full, in a compact variant, or hidden). The map overlay calls this on every
 * frame the map moves, so it is intentionally simple and cheap (greedy, O(n²)
 * over a small n).
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

export type LabelVariant = 'full' | 'compact';

export type AnchorPosition =
  | 'right'
  | 'left'
  | 'top'
  | 'bottom'
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left';

export interface MarkerInput {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface StopLabelInput {
  id: string;
  markerId: string;
  sizes: Record<LabelVariant, Size>;
  /** Lower comes first (placed with more freedom). */
  priority: number;
  /** Must be shown (selected / hovered) even if it overlaps. */
  pinned?: boolean;
}

export interface LegLabelInput {
  id: string;
  /** Anchor point on the route (screen px). */
  x: number;
  y: number;
  /** Direction of travel at the anchor, radians in screen space (x right, y down). */
  bearing: number;
  sizes: Record<LabelVariant, Size>;
  priority: number;
  pinned?: boolean;
  /** Place before (unpinned) stop labels — used for flights, whose details matter most. */
  placeFirst?: boolean;
}

export interface PlacementInput {
  viewport: Size;
  markers: MarkerInput[];
  stopLabels: StopLabelInput[];
  legLabels: LegLabelInput[];
  /** Sampled route vertices (screen px) — soft obstacles, labels avoid covering routes. */
  routePoints: Array<{ x: number; y: number }>;
  /** Fixed UI elements over the map (legend, controls) that labels must avoid. */
  obstacles?: Rect[];
  /** Small viewports: only try the compact variant for unpinned labels. */
  compactOnly?: boolean;
  /** Previous placement, for hysteresis (avoids flicker while panning). */
  previous?: PlacementResult;
}

export interface PlacedLabel {
  rect: Rect;
  variant: LabelVariant;
  position: AnchorPosition;
  hidden: boolean;
}

export interface PlacementResult {
  stopLabels: Map<string, PlacedLabel>;
  legLabels: Map<string, PlacedLabel>;
}

const STOP_POSITIONS: AnchorPosition[] = [
  'right',
  'left',
  'top-right',
  'bottom-right',
  'top-left',
  'bottom-left',
  'top',
  'bottom',
];

const GAP = 10;
const MARKER_PAD = 4;
const HARD_OVERLAP_WEIGHT = 50;
const ROUTE_POINT_WEIGHT = 6;
const POSITION_PREFERENCE_WEIGHT = 1.5;
const HYSTERESIS_BONUS = 12;
const VIEWPORT_MARGIN = 6;

export function rectsOverlapArea(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

function markerRect(m: MarkerInput): Rect {
  const r = m.radius + MARKER_PAD;
  return { x: m.x - r, y: m.y - r, w: r * 2, h: r * 2 };
}

/** Rect for a label of `size` placed at `position` relative to a marker. */
export function rectForPosition(
  cx: number,
  cy: number,
  radius: number,
  size: Size,
  position: AnchorPosition,
): Rect {
  const d = radius + GAP;
  const diag = radius + GAP * 0.6;
  switch (position) {
    case 'right':
      return { x: cx + d, y: cy - size.h / 2, w: size.w, h: size.h };
    case 'left':
      return { x: cx - d - size.w, y: cy - size.h / 2, w: size.w, h: size.h };
    case 'top':
      return { x: cx - size.w / 2, y: cy - d - size.h, w: size.w, h: size.h };
    case 'bottom':
      return { x: cx - size.w / 2, y: cy + d, w: size.w, h: size.h };
    case 'top-right':
      return { x: cx + diag, y: cy - diag - size.h, w: size.w, h: size.h };
    case 'top-left':
      return { x: cx - diag - size.w, y: cy - diag - size.h, w: size.w, h: size.h };
    case 'bottom-right':
      return { x: cx + diag, y: cy + diag, w: size.w, h: size.h };
    case 'bottom-left':
      return { x: cx - diag - size.w, y: cy + diag, w: size.w, h: size.h };
  }
}

function outOfViewportArea(r: Rect, vp: Size): number {
  const inner: Rect = {
    x: VIEWPORT_MARGIN,
    y: VIEWPORT_MARGIN,
    w: vp.w - VIEWPORT_MARGIN * 2,
    h: vp.h - VIEWPORT_MARGIN * 2,
  };
  return r.w * r.h - rectsOverlapArea(r, inner);
}

function pointInRect(p: { x: number; y: number }, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

interface Scored {
  rect: Rect;
  position: AnchorPosition;
  hardCost: number;
  totalCost: number;
}

function scoreCandidate(
  rect: Rect,
  position: AnchorPosition,
  positionIndex: number,
  obstacles: Rect[],
  routePoints: PlacementInput['routePoints'],
  viewport: Size,
  previousPosition: AnchorPosition | undefined,
): Scored {
  const area = Math.max(1, rect.w * rect.h);
  let hard = 0;
  for (const o of obstacles) hard += rectsOverlapArea(rect, o) / area;
  hard += outOfViewportArea(rect, viewport) / area;

  let soft = 0;
  for (const p of routePoints) if (pointInRect(p, rect)) soft += 1;

  const total =
    hard * HARD_OVERLAP_WEIGHT * 10 +
    Math.min(soft, 8) * ROUTE_POINT_WEIGHT +
    positionIndex * POSITION_PREFERENCE_WEIGHT -
    (previousPosition === position ? HYSTERESIS_BONUS : 0);
  return { rect, position, hardCost: hard, totalCost: total };
}

function isVisibleAtAll(rect: Rect, vp: Size): boolean {
  return rectsOverlapArea(rect, { x: 0, y: 0, w: vp.w, h: vp.h }) > 0;
}

export function placeLabels(input: PlacementInput): PlacementResult {
  const { viewport, markers, routePoints } = input;
  const markerById = new Map(markers.map((m) => [m.id, m]));
  const obstacles: Rect[] = [...(input.obstacles ?? []), ...markers.map(markerRect)];

  const stopResult = new Map<string, PlacedLabel>();
  const legResult = new Map<string, PlacedLabel>();

  const placeStop = (label: StopLabelInput) => {
    const m = markerById.get(label.markerId);
    if (!m) return;
    const prev = input.previous?.stopLabels.get(label.id);

    // Skip markers that are far off-screen — nothing to place.
    const anyRect = rectForPosition(m.x, m.y, m.radius, label.sizes.full, 'right');
    if (!isVisibleAtAll({ ...anyRect, x: anyRect.x - anyRect.w * 2, w: anyRect.w * 4 }, viewport)) {
      stopResult.set(label.id, { rect: anyRect, variant: 'full', position: 'right', hidden: true });
      return;
    }

    let chosen: (Scored & { variant: LabelVariant }) | undefined;
    const variants: LabelVariant[] = input.compactOnly && !label.pinned ? ['compact'] : ['full', 'compact'];
    for (const variant of variants) {
      const size = label.sizes[variant];
      let best: Scored | undefined;
      STOP_POSITIONS.forEach((position, i) => {
        const rect = rectForPosition(m.x, m.y, m.radius, size, position);
        const s = scoreCandidate(rect, position, i, obstacles, routePoints, viewport,
          prev && !prev.hidden && prev.variant === variant ? prev.position : undefined);
        if (!best || s.totalCost < best.totalCost) best = s;
      });
      if (!best) continue;
      // Accept when there's (almost) no hard overlap.
      if (best.hardCost < 0.02) {
        chosen = { ...best, variant };
        break;
      }
      if (!chosen || best.hardCost < chosen.hardCost) chosen = { ...best, variant };
    }

    if (!chosen) return;
    const hidden = chosen.hardCost >= 0.02 && !label.pinned;
    if (!hidden) obstacles.push(chosen.rect);
    stopResult.set(label.id, {
      rect: chosen.rect,
      variant: chosen.variant,
      position: chosen.position,
      hidden,
    });
  };

  // Leg labels: candidates offset perpendicular to the travel direction on both
  // sides, then along the route, so the label sits beside the line.
  const placeLeg = (label: LegLabelInput) => {
    const prev = input.previous?.legLabels.get(label.id);
    const anyRect: Rect = { x: label.x - 100, y: label.y - 40, w: 200, h: 80 };
    if (!isVisibleAtAll(anyRect, viewport)) {
      legResult.set(label.id, { rect: anyRect, variant: 'full', position: 'top', hidden: true });
      return;
    }

    const nx = -Math.sin(label.bearing);
    const ny = Math.cos(label.bearing);
    let chosen: (Scored & { variant: LabelVariant }) | undefined;
    const variants: LabelVariant[] = input.compactOnly && !label.pinned ? ['compact'] : ['full', 'compact'];
    for (const variant of variants) {
      const size = label.sizes[variant];
      const offsets: Array<{ dx: number; dy: number; pos: AnchorPosition }> = [
        { dx: nx * 14, dy: ny * 14, pos: 'top' },
        { dx: -nx * 14, dy: -ny * 14, pos: 'bottom' },
        { dx: nx * 26, dy: ny * 26, pos: 'top-right' },
        { dx: -nx * 26, dy: -ny * 26, pos: 'bottom-left' },
        { dx: 0, dy: 0, pos: 'right' },
      ];
      let best: Scored | undefined;
      offsets.forEach((o, i) => {
        // Center the label on the offset point, then push it outward so its
        // nearest edge (not its center) is at the offset distance.
        const cx = label.x + o.dx + Math.sign(o.dx) * (size.w / 2) * Math.abs(nx) * 0.9;
        const cy = label.y + o.dy + Math.sign(o.dy) * (size.h / 2) * Math.abs(ny) * 0.9;
        const rect: Rect = { x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h };
        const s = scoreCandidate(rect, o.pos, i, obstacles, routePoints, viewport,
          prev && !prev.hidden && prev.variant === variant ? prev.position : undefined);
        if (!best || s.totalCost < best.totalCost) best = s;
      });
      if (!best) continue;
      if (best.hardCost < 0.02) {
        chosen = { ...best, variant };
        break;
      }
      if (!chosen || best.hardCost < chosen.hardCost) chosen = { ...best, variant };
    }
    if (!chosen) return;
    const hidden = chosen.hardCost >= 0.02 && !label.pinned;
    if (!hidden) obstacles.push(chosen.rect);
    legResult.set(label.id, {
      rect: chosen.rect,
      variant: chosen.variant,
      position: chosen.position,
      hidden,
    });
  };

  const byPinnedThenPriority = <T extends { pinned?: boolean; priority: number }>(a: T, b: T) =>
    Number(!!b.pinned) - Number(!!a.pinned) || a.priority - b.priority;

  // Order of placement = order of importance:
  //   1. pinned stop labels (selected / hovered)
  //   2. flight labels (placeFirst) and any pinned leg label
  //   3. remaining stop labels by visit order
  //   4. remaining leg labels (drive times)
  const stopLabels = [...input.stopLabels].sort(byPinnedThenPriority);
  const legLabels = [...input.legLabels].sort(byPinnedThenPriority);

  stopLabels.filter((l) => l.pinned).forEach(placeStop);
  legLabels.filter((l) => l.pinned || l.placeFirst).forEach(placeLeg);
  stopLabels.filter((l) => !l.pinned).forEach(placeStop);
  legLabels.filter((l) => !(l.pinned || l.placeFirst)).forEach(placeLeg);

  return { stopLabels: stopResult, legLabels: legResult };
}

/* ------------------------------------------------------------------------ */
/* Marker decluttering                                                       */
/* ------------------------------------------------------------------------ */

export interface DeclutteredMarker {
  id: string;
  /** True projected position. */
  x: number;
  y: number;
  /** Display position after decluttering (equal to x/y when not displaced). */
  dx: number;
  dy: number;
  displaced: boolean;
}

/**
 * When the map is zoomed out, stops that are geographically close land on the
 * same pixels and their numbers become unreadable. This nudges overlapping
 * markers apart with a few iterations of pairwise repulsion, bounded so a marker
 * never strays far from its true location. Displaced markers get a leader line
 * back to their exact coordinates so positioning stays honest.
 */
export function declutterMarkers(
  markers: MarkerInput[],
  opts: { minDistance?: number; maxDisplacement?: number; iterations?: number } = {},
): DeclutteredMarker[] {
  const minDistance = opts.minDistance ?? 34;
  const maxDisplacement = opts.maxDisplacement ?? 46;
  const iterations = opts.iterations ?? 24;

  const pts = markers.map((m) => ({ id: m.id, x: m.x, y: m.y, dx: m.x, dy: m.y }));
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i];
        const b = pts[j];
        let vx = b.dx - a.dx;
        let vy = b.dy - a.dy;
        let dist = Math.hypot(vx, vy);
        if (dist >= minDistance) continue;
        if (dist < 0.01) {
          // Coincident: separate along a deterministic direction (later stop goes down-right).
          vx = 0.7;
          vy = 0.7;
          dist = 1;
        }
        const push = (minDistance - dist) / 2 + 0.5;
        const ux = vx / dist;
        const uy = vy / dist;
        a.dx -= ux * push;
        a.dy -= uy * push;
        b.dx += ux * push;
        b.dy += uy * push;
        moved = true;
      }
    }
    // Clamp displacement to keep markers near their true location.
    for (const p of pts) {
      const ox = p.dx - p.x;
      const oy = p.dy - p.y;
      const d = Math.hypot(ox, oy);
      if (d > maxDisplacement) {
        p.dx = p.x + (ox / d) * maxDisplacement;
        p.dy = p.y + (oy / d) * maxDisplacement;
      }
    }
    if (!moved) break;
  }
  return pts.map((p) => ({
    ...p,
    displaced: Math.hypot(p.dx - p.x, p.dy - p.y) > 2,
  }));
}
