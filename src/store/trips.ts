import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Itinerary } from '@/types/itinerary';
import { sampleItineraries } from '@/data/sampleItineraries';
import { validateItinerary } from '@/lib/validation';

/**
 * Trip library persisted in localStorage. Every trip is a full Itinerary; the
 * store only knows about the list and which one is open.
 */

const KEY = 'itinerary-map:trips:v1';
const LEGACY_KEY = 'itinerary-map:itinerary';

interface Persisted {
  trips: Itinerary[];
  currentId: string;
}

export function newId(prefix = 'trip'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted;
      const trips = parsed.trips.filter((t) => validateItinerary(t).ok);
      if (trips.length) {
        const currentId = trips.some((t) => t.id === parsed.currentId) ? parsed.currentId : trips[0].id;
        return { trips, currentId };
      }
    }
    // Migrate the pre-library single itinerary, if any.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const r = validateItinerary(JSON.parse(legacy));
      if (r.ok) {
        const trips = [r.itinerary, ...sampleItineraries.filter((s) => s.id !== r.itinerary.id)];
        return { trips, currentId: r.itinerary.id };
      }
    }
  } catch {
    /* fall through to defaults */
  }
  return { trips: sampleItineraries, currentId: sampleItineraries[0].id };
}

function save(state: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable */
  }
}

export function blankTrip(): Itinerary {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return {
    id: newId(),
    title: 'New trip',
    stops: [
      {
        id: newId('stop'),
        order: 1,
        name: 'First stop',
        type: 'job',
        latitude: 47.6062,
        longitude: -122.3321,
        date,
        arrivalTime: '09:00',
        durationMinutes: 60,
      },
    ],
    legs: [],
  };
}

export function useTrips() {
  const [state, setState] = useState<Persisted>(load);

  useEffect(() => save(state), [state]);

  const current = useMemo(
    () => state.trips.find((t) => t.id === state.currentId) ?? state.trips[0],
    [state],
  );

  const setCurrent = useCallback((id: string) => setState((s) => ({ ...s, currentId: id })), []);

  const upsert = useCallback((trip: Itinerary) => {
    setState((s) => {
      const exists = s.trips.some((t) => t.id === trip.id);
      const trips = exists ? s.trips.map((t) => (t.id === trip.id ? trip : t)) : [trip, ...s.trips];
      return { trips, currentId: trip.id };
    });
  }, []);

  const create = useCallback(() => {
    const trip = blankTrip();
    setState((s) => ({ trips: [trip, ...s.trips], currentId: trip.id }));
    return trip;
  }, []);

  const duplicate = useCallback((id: string) => {
    setState((s) => {
      const src = s.trips.find((t) => t.id === id);
      if (!src) return s;
      const copy: Itinerary = { ...structuredClone(src), id: newId(), title: `${src.title} (copy)` };
      return { trips: [copy, ...s.trips], currentId: copy.id };
    });
  }, []);

  const remove = useCallback((id: string) => {
    setState((s) => {
      const trips = s.trips.filter((t) => t.id !== id);
      if (trips.length === 0) {
        const t = blankTrip();
        return { trips: [t], currentId: t.id };
      }
      return { trips, currentId: s.currentId === id ? trips[0].id : s.currentId };
    });
  }, []);

  return { trips: state.trips, current, setCurrent, upsert, create, duplicate, remove };
}
