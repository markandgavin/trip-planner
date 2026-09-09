import type { LngLat } from '@/types/itinerary';

export const EARTH_RADIUS_M = 6371008.8;
export const METERS_PER_MILE = 1609.344;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in meters. */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function metersToMiles(m: number): number {
  return m / METERS_PER_MILE;
}

/** Length of a polyline in meters. */
export function polylineLengthMeters(line: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += haversineMeters(line[i - 1], line[i]);
  return total;
}

/**
 * Great-circle arc between two points, sampled into `steps` segments.
 * Longitudes are unwrapped so arcs crossing the antimeridian render continuously.
 */
export function greatCircleArc(a: LngLat, b: LngLat, steps = 64): LngLat[] {
  const lat1 = toRad(a[1]);
  const lon1 = toRad(a[0]);
  const lat2 = toRad(b[1]);
  const lon2 = toRad(b[0]);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );
  if (d === 0 || !Number.isFinite(d)) return [a, b];

  const pts: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);
    pts.push([toDeg(lon), toDeg(lat)]);
  }
  return unwrapLongitudes(pts);
}

/** Make consecutive longitudes continuous (no ±360° jumps). */
export function unwrapLongitudes(line: LngLat[]): LngLat[] {
  if (line.length === 0) return line;
  const out: LngLat[] = [line[0]];
  for (let i = 1; i < line.length; i++) {
    let lon = line[i][0];
    const prev = out[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, line[i][1]]);
  }
  return out;
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Bounding box of a set of coordinates (or undefined if empty). */
export function boundsOf(points: LngLat[]): Bounds | undefined {
  if (points.length === 0) return undefined;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of points) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  if (!Number.isFinite(west)) return undefined;
  return { west, south, east, north };
}

/** Expand degenerate bounds (single point / single line) so fitBounds has area. */
export function padBounds(b: Bounds, minSpanDeg = 0.02): Bounds {
  let { west, south, east, north } = b;
  if (east - west < minSpanDeg) {
    const c = (east + west) / 2;
    west = c - minSpanDeg / 2;
    east = c + minSpanDeg / 2;
  }
  if (north - south < minSpanDeg) {
    const c = (north + south) / 2;
    south = Math.max(-85, c - minSpanDeg / 2);
    north = Math.min(85, c + minSpanDeg / 2);
  }
  return { west, south, east, north };
}

/** Point at a fractional distance along a polyline, plus the local bearing (radians). */
export function pointAlong(
  line: LngLat[],
  fraction: number,
): { point: LngLat; bearing: number } {
  if (line.length === 0) return { point: [0, 0], bearing: 0 };
  if (line.length === 1) return { point: line[0], bearing: 0 };
  const total = polylineLengthMeters(line);
  let target = Math.max(0, Math.min(1, fraction)) * total;
  for (let i = 1; i < line.length; i++) {
    const seg = haversineMeters(line[i - 1], line[i]);
    if (target <= seg || i === line.length - 1) {
      const t = seg === 0 ? 0 : target / seg;
      const p: LngLat = [
        line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t,
        line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t,
      ];
      const bearing = Math.atan2(
        line[i][1] - line[i - 1][1],
        (line[i][0] - line[i - 1][0]) * Math.cos(toRad(p[1])),
      );
      return { point: p, bearing };
    }
    target -= seg;
  }
  return { point: line[line.length - 1], bearing: 0 };
}

/** Reduce a dense polyline to at most `max` points (uniform sampling, endpoints kept). */
export function samplePolyline(line: LngLat[], max: number): LngLat[] {
  if (line.length <= max) return line;
  const out: LngLat[] = [];
  const step = (line.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(line[Math.round(i * step)]);
  return out;
}
