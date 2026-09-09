import { describe, expect, it } from 'vitest';
import { boundsOf, greatCircleArc, haversineMeters, metersToMiles, padBounds, pointAlong, polylineLengthMeters, samplePolyline, unwrapLongitudes } from './geo';

const SEA: [number, number] = [-122.3321, 47.6062];
const LAX: [number, number] = [-118.4085, 33.9416];

describe('geo', () => {
  it('haversine distance Seattle → LAX ≈ 966 mi', () => {
    expect(metersToMiles(haversineMeters(SEA, LAX))).toBeCloseTo(966, 0);
  });

  it('great-circle arc starts and ends at the inputs and is monotonic-ish', () => {
    const arc = greatCircleArc(SEA, LAX, 32);
    expect(arc).toHaveLength(33);
    expect(arc[0][0]).toBeCloseTo(SEA[0], 6);
    expect(arc[0][1]).toBeCloseTo(SEA[1], 6);
    expect(arc[32][0]).toBeCloseTo(LAX[0], 6);
    expect(arc[32][1]).toBeCloseTo(LAX[1], 6);
    // arc length is at least the straight (haversine) distance
    expect(polylineLengthMeters(arc)).toBeGreaterThanOrEqual(haversineMeters(SEA, LAX) * 0.999);
  });

  it('degenerate arc (same point) returns endpoints', () => {
    expect(greatCircleArc(SEA, SEA)).toEqual([SEA, SEA]);
  });

  it('unwraps longitudes across the antimeridian', () => {
    const line = unwrapLongitudes([[170, 0], [-170, 0]]);
    expect(line[1][0]).toBe(190);
  });

  it('great-circle arc across the Pacific stays continuous', () => {
    const arc = greatCircleArc([139.7, 35.7], [-122.3, 47.6], 64); // Tokyo → Seattle
    for (let i = 1; i < arc.length; i++) expect(Math.abs(arc[i][0] - arc[i - 1][0])).toBeLessThan(10);
  });

  it('bounds and padding', () => {
    expect(boundsOf([])).toBeUndefined();
    const b = boundsOf([SEA, LAX])!;
    expect(b).toEqual({ west: LAX[0] > SEA[0] ? SEA[0] : LAX[0], south: LAX[1], east: LAX[0], north: SEA[1] });
    const p = padBounds({ west: 0, south: 0, east: 0, north: 0 }, 0.1);
    expect(p.east - p.west).toBeCloseTo(0.1);
    expect(p.north - p.south).toBeCloseTo(0.1);
  });

  it('pointAlong returns the midpoint of a two-point line', () => {
    const { point } = pointAlong([[0, 0], [2, 0]], 0.5);
    expect(point[0]).toBeCloseTo(1, 6);
    expect(point[1]).toBeCloseTo(0, 6);
  });

  it('samplePolyline keeps endpoints and caps length', () => {
    const line = Array.from({ length: 100 }, (_, i) => [i, i] as [number, number]);
    const s = samplePolyline(line, 10);
    expect(s).toHaveLength(10);
    expect(s[0]).toEqual([0, 0]);
    expect(s[9]).toEqual([99, 99]);
  });
});
