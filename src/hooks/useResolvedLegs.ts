import { useEffect, useMemo, useState } from 'react';
import type { Itinerary, LngLat, ResolvedLeg } from '@/types/itinerary';
import { resolveLegChain } from '@/lib/itinerary';
import { greatCircleArc, haversineMeters, metersToMiles } from '@/lib/geo';
import { parseTimeToMinutes } from '@/lib/time';
import { fetchDrivingRoute, getCachedRoute, type RouteResult } from '@/services/routing';

type RouteState =
  | { status: 'loading' }
  | { status: 'ok'; result: RouteResult }
  | { status: 'error'; message: string };

function stopLngLat(s: { longitude: number; latitude: number }): LngLat {
  return [s.longitude, s.latitude];
}

function flightDuration(leg: { durationMinutes?: number; departureTime?: string; arrivalTime?: string }) {
  if (leg.durationMinutes !== undefined) return leg.durationMinutes;
  const dep = parseTimeToMinutes(leg.departureTime);
  const arr = parseTimeToMinutes(leg.arrivalTime);
  if (dep === undefined || arr === undefined) return undefined;
  let d = arr - dep;
  if (d < 0) d += 1440;
  return d;
}

/**
 * Turns the itinerary's leg chain into drawable legs. Driving legs are routed
 * through the routing service (cached, coalesced, cancellable); until a route
 * arrives — or if it fails — a straight geographic connection is used and
 * clearly flagged as such.
 */
export function useResolvedLegs(itinerary: Itinerary): {
  legs: ResolvedLeg[];
  routingPending: number;
  routingFailed: number;
  retryFailed: () => void;
} {
  const chain = useMemo(() => resolveLegChain(itinerary), [itinerary]);
  const [routes, setRoutes] = useState<Map<string, RouteState>>(new Map());
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const initial = new Map<string, RouteState>();
    const toFetch: Array<{ id: string; from: LngLat; to: LngLat }> = [];

    for (const { leg, from, to } of chain) {
      if (leg.mode !== 'drive') continue;
      const id = leg.id!;
      const a = stopLngLat(from);
      const b = stopLngLat(to);
      const cached = getCachedRoute(a, b);
      if (cached) initial.set(id, { status: 'ok', result: cached });
      else {
        initial.set(id, { status: 'loading' });
        toFetch.push({ id, from: a, to: b });
      }
    }
    setRoutes(initial);

    // Fetch sequentially in small batches to be a good citizen to the public API.
    (async () => {
      const BATCH = 3;
      for (let i = 0; i < toFetch.length; i += BATCH) {
        if (controller.signal.aborted) return;
        await Promise.all(
          toFetch.slice(i, i + BATCH).map(async ({ id, from, to }) => {
            try {
              const result = await fetchDrivingRoute(from, to);
              if (controller.signal.aborted) return;
              setRoutes((prev) => new Map(prev).set(id, { status: 'ok', result }));
            } catch (e) {
              if (controller.signal.aborted) return;
              setRoutes((prev) =>
                new Map(prev).set(id, { status: 'error', message: (e as Error).message }),
              );
            }
          }),
        );
      }
    })();

    return () => controller.abort();
  }, [chain, retryToken]);

  const legs = useMemo<ResolvedLeg[]>(() => {
    return chain.map(({ leg, from, to }, index) => {
      const id = leg.id!;
      const a = stopLngLat(from);
      const b = stopLngLat(to);
      const straightMiles = metersToMiles(haversineMeters(a, b));

      if (leg.mode === 'flight') {
        return {
          id,
          index,
          mode: 'flight',
          from,
          to,
          leg,
          geometry: greatCircleArc(a, b, 96),
          source: 'great-circle',
          loading: false,
          durationMinutes: flightDuration(leg),
          distanceMiles: leg.distanceMiles ?? straightMiles,
        };
      }

      const state = routes.get(id);
      if (state?.status === 'ok') {
        const routedMiles = metersToMiles(state.result.distanceMeters);
        const routedMinutes = state.result.durationSeconds / 60;
        return {
          id,
          index,
          mode: 'drive',
          from,
          to,
          leg,
          geometry: state.result.geometry,
          source: 'routed',
          loading: false,
          durationMinutes: leg.durationMinutes ?? routedMinutes,
          distanceMiles: leg.distanceMiles ?? routedMiles,
          routedDurationMinutes: routedMinutes,
          routedDistanceMiles: routedMiles,
        };
      }

      return {
        id,
        index,
        mode: 'drive',
        from,
        to,
        leg,
        geometry: [a, b],
        source: 'fallback',
        loading: state?.status === 'loading' || state === undefined,
        durationMinutes: leg.durationMinutes,
        distanceMiles: leg.distanceMiles,
        error: state?.status === 'error' ? state.message : undefined,
      };
    });
  }, [chain, routes]);

  let routingPending = 0;
  let routingFailed = 0;
  for (const s of routes.values()) {
    if (s.status === 'loading') routingPending++;
    if (s.status === 'error') routingFailed++;
  }

  return {
    legs,
    routingPending,
    routingFailed,
    retryFailed: () => setRetryToken((t) => t + 1),
  };
}
