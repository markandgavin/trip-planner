import type { LngLat } from '@/types/itinerary';

/**
 * Road routing via an OSRM-compatible HTTP API.
 *
 * Default is the public OSRM demo server, which is fine for evaluation and light
 * use. For production traffic point VITE_OSRM_URL at your own OSRM instance or a
 * hosted provider that speaks the same API (e.g. Mapbox Directions with an
 * adapter, or a self-hosted OSRM/Valhalla behind a compatible proxy).
 *
 * Results are cached in memory and in localStorage so a route between two exact
 * coordinates is never fetched twice, and identical in-flight requests are
 * coalesced.
 */

export interface RouteResult {
  geometry: LngLat[];
  distanceMeters: number;
  durationSeconds: number;
}

export class RoutingError extends Error {
  constructor(message: string, public readonly retryable: boolean) {
    super(message);
    this.name = 'RoutingError';
  }
}

const OSRM_BASE =
  (import.meta.env?.VITE_OSRM_URL as string | undefined)?.replace(/\/$/, '') ??
  'https://router.project-osrm.org';

const CACHE_VERSION = 'v1';
const STORAGE_PREFIX = `route-cache:${CACHE_VERSION}:`;
const MAX_STORED_ROUTES = 250;
const REQUEST_TIMEOUT_MS = 12_000;

const memoryCache = new Map<string, RouteResult>();
const inflight = new Map<string, Promise<RouteResult>>();

function round(n: number): string {
  return n.toFixed(5);
}

export function routeCacheKey(from: LngLat, to: LngLat): string {
  return `${round(from[0])},${round(from[1])}->${round(to[0])},${round(to[1])}`;
}

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function readStored(key: string): RouteResult | undefined {
  if (!storageAvailable()) return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as RouteResult & { t?: number };
    if (!Array.isArray(parsed.geometry)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function writeStored(key: string, value: RouteResult): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ ...value, t: Date.now() }));
    pruneStored();
  } catch {
    // Quota exceeded or storage disabled — memory cache still works.
  }
}

/** Keep localStorage bounded: drop the oldest entries beyond MAX_STORED_ROUTES. */
function pruneStored(): void {
  const entries: Array<{ key: string; t: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(STORAGE_PREFIX)) continue;
    try {
      const t = (JSON.parse(localStorage.getItem(k) ?? '{}') as { t?: number }).t ?? 0;
      entries.push({ key: k, t });
    } catch {
      entries.push({ key: k, t: 0 });
    }
  }
  if (entries.length <= MAX_STORED_ROUTES) return;
  entries.sort((a, b) => a.t - b.t);
  for (const e of entries.slice(0, entries.length - MAX_STORED_ROUTES)) localStorage.removeItem(e.key);
}

export function getCachedRoute(from: LngLat, to: LngLat): RouteResult | undefined {
  const key = routeCacheKey(from, to);
  const mem = memoryCache.get(key);
  if (mem) return mem;
  const stored = readStored(key);
  if (stored) memoryCache.set(key, stored);
  return stored;
}

interface OsrmResponse {
  code: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { type: 'LineString'; coordinates: LngLat[] };
  }>;
}

async function requestOsrm(from: LngLat, to: LngLat): Promise<RouteResult> {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 429 || res.status >= 500) {
      throw new RoutingError(`Routing service responded ${res.status}`, true);
    }
    if (!res.ok) throw new RoutingError(`Routing service responded ${res.status}`, false);
    const body = (await res.json()) as OsrmResponse;
    if (body.code !== 'Ok' || !body.routes?.length) {
      throw new RoutingError(body.message ?? `No route (${body.code})`, false);
    }
    const r = body.routes[0];
    return {
      geometry: r.geometry.coordinates,
      distanceMeters: r.distance,
      durationSeconds: r.duration,
    };
  } catch (e) {
    if (e instanceof RoutingError) throw e;
    if ((e as Error).name === 'AbortError') {
      throw new RoutingError('Routing request timed out', true);
    }
    throw new RoutingError((e as Error).message || 'Network error', true);
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAX_ATTEMPTS = 3;

/**
 * Fetch (or return cached) driving route. Retries with backoff on retryable
 * errors. The underlying request is shared between concurrent callers, so a
 * caller that stops caring simply ignores the result rather than aborting it.
 */
export function fetchDrivingRoute(from: LngLat, to: LngLat): Promise<RouteResult> {
  const key = routeCacheKey(from, to);
  const cached = getCachedRoute(from, to);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(key);
  if (existing) return existing;

  const task = (async () => {
    let lastError: RoutingError | undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const result = await requestOsrm(from, to);
        memoryCache.set(key, result);
        writeStored(key, result);
        return result;
      } catch (e) {
        lastError = e as RoutingError;
        if (!lastError.retryable) break;
        await sleep(700 * 2 ** attempt);
      }
    }
    throw lastError ?? new RoutingError('Unknown routing error', false);
  })().finally(() => inflight.delete(key));

  inflight.set(key, task);
  return task;
}

/** Test hook: clear all cached routes. */
export function clearRouteCache(): void {
  memoryCache.clear();
  if (!storageAvailable()) return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
