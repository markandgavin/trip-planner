import { describe, expect, it } from 'vitest';
import { declutterMarkers, placeLabels, rectForPosition, rectsOverlapArea, type Rect } from './labelPlacement';

const size = { full: { w: 120, h: 40 }, compact: { w: 80, h: 22 } };
const viewport = { w: 800, h: 600 };

function overlaps(a: Rect, b: Rect) {
  return rectsOverlapArea(a, b) > 0;
}

describe('placeLabels', () => {
  it('places a lone label to the right of its marker, fully in view', () => {
    const r = placeLabels({
      viewport,
      markers: [{ id: 'a', x: 400, y: 300, radius: 16 }],
      stopLabels: [{ id: 'a', markerId: 'a', sizes: size, priority: 1 }],
      legLabels: [],
      routePoints: [],
    });
    const p = r.stopLabels.get('a')!;
    expect(p.hidden).toBe(false);
    expect(p.variant).toBe('full');
    expect(p.position).toBe('right');
    expect(p.rect.x).toBeGreaterThan(416);
  });

  it('never lets visible labels overlap each other or markers', () => {
    const markers = Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, x: 300 + (i % 4) * 60, y: 250 + Math.floor(i / 4) * 60, radius: 16 }));
    const r = placeLabels({
      viewport,
      markers,
      stopLabels: markers.map((m, i) => ({ id: m.id, markerId: m.id, sizes: size, priority: i })),
      legLabels: [],
      routePoints: [],
    });
    const visible = [...r.stopLabels.values()].filter((p) => !p.hidden).map((p) => p.rect);
    expect(visible.length).toBeGreaterThan(0);
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) expect(overlaps(visible[i], visible[j])).toBe(false);
      for (const m of markers) {
        const mr = { x: m.x - m.radius, y: m.y - m.radius, w: m.radius * 2, h: m.radius * 2 };
        expect(overlaps(visible[i], mr)).toBe(false);
      }
    }
  });

  it('keeps labels inside the viewport by flipping sides near an edge', () => {
    const r = placeLabels({
      viewport,
      markers: [{ id: 'a', x: 790, y: 300, radius: 16 }],
      stopLabels: [{ id: 'a', markerId: 'a', sizes: size, priority: 1 }],
      legLabels: [],
      routePoints: [],
    });
    const p = r.stopLabels.get('a')!;
    expect(p.hidden).toBe(false);
    expect(p.rect.x + p.rect.w).toBeLessThanOrEqual(800);
  });

  it('always shows pinned labels, even when crowded', () => {
    const markers = [
      { id: 'a', x: 150, y: 50, radius: 16 },
      { id: 'b', x: 154, y: 52, radius: 16 },
    ];
    const r = placeLabels({
      viewport: { w: 300, h: 100 },
      markers,
      stopLabels: [
        { id: 'a', markerId: 'a', sizes: size, priority: 1 },
        { id: 'b', markerId: 'b', sizes: size, priority: 2, pinned: true },
      ],
      legLabels: [],
      routePoints: [],
    });
    expect(r.stopLabels.get('b')!.hidden).toBe(false);
  });

  it('avoids fixed obstacles such as the legend', () => {
    const legend: Rect = { x: 416, y: 200, w: 200, h: 200 }; // right of marker
    const r = placeLabels({
      viewport,
      markers: [{ id: 'a', x: 400, y: 300, radius: 16 }],
      stopLabels: [{ id: 'a', markerId: 'a', sizes: size, priority: 1 }],
      legLabels: [],
      routePoints: [],
      obstacles: [legend],
    });
    const p = r.stopLabels.get('a')!;
    expect(p.hidden).toBe(false);
    expect(overlaps(p.rect, legend)).toBe(false);
  });

  it('places flight leg labels before unpinned stop labels', () => {
    // A stop label and a flight label compete for the same space; flight wins.
    const r = placeLabels({
      viewport: { w: 240, h: 80 },
      markers: [{ id: 'a', x: 40, y: 40, radius: 16 }],
      stopLabels: [{ id: 'a', markerId: 'a', sizes: size, priority: 1 }],
      legLabels: [{ id: 'f', x: 120, y: 40, bearing: 0, sizes: size, priority: 0, placeFirst: true }],
      routePoints: [],
    });
    expect(r.legLabels.get('f')!.hidden).toBe(false);
  });

  it('is stable: reuses the previous position when still valid', () => {
    const input = {
      viewport,
      markers: [{ id: 'a', x: 400, y: 300, radius: 16 }],
      stopLabels: [{ id: 'a', markerId: 'a', sizes: size, priority: 1 }],
      legLabels: [],
      routePoints: [],
    };
    const first = placeLabels(input);
    const second = placeLabels({ ...input, previous: first });
    expect(second.stopLabels.get('a')!.position).toBe(first.stopLabels.get('a')!.position);
  });
});

describe('rectForPosition', () => {
  it('centers vertically for left/right and horizontally for top/bottom', () => {
    const r = rectForPosition(100, 100, 16, { w: 50, h: 20 }, 'right');
    expect(r.y + r.h / 2).toBe(100);
    const t = rectForPosition(100, 100, 16, { w: 50, h: 20 }, 'top');
    expect(t.x + t.w / 2).toBe(100);
    expect(t.y + t.h).toBeLessThan(100 - 16);
  });
});

describe('declutterMarkers', () => {
  it('leaves well-separated markers alone', () => {
    const out = declutterMarkers([
      { id: 'a', x: 100, y: 100, radius: 16 },
      { id: 'b', x: 300, y: 100, radius: 16 },
    ]);
    expect(out.every((m) => !m.displaced)).toBe(true);
  });
  it('separates coincident markers within the displacement bound', () => {
    const out = declutterMarkers([
      { id: 'a', x: 100, y: 100, radius: 16 },
      { id: 'b', x: 100, y: 100, radius: 16 },
      { id: 'c', x: 102, y: 101, radius: 16 },
    ]);
    for (let i = 0; i < out.length; i++) {
      expect(Math.hypot(out[i].dx - out[i].x, out[i].dy - out[i].y)).toBeLessThanOrEqual(46.01);
      for (let j = i + 1; j < out.length; j++) {
        expect(Math.hypot(out[i].dx - out[j].dx, out[i].dy - out[j].dy)).toBeGreaterThan(28);
      }
    }
    expect(out.some((m) => m.displaced)).toBe(true);
  });
});
