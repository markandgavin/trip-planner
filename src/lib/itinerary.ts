import type { DayGroup, Itinerary, Stop, TravelLeg, TravelMode } from '@/types/itinerary';
import { parseTimeToMinutes } from './time';

/** Stops sorted by visit order (the number shown on the map). */
export function orderedStops(itinerary: Itinerary): Stop[] {
  return [...itinerary.stops].sort((a, b) => a.order - b.order);
}

export function legId(fromStopId: string, toStopId: string): string {
  return `${fromStopId}__${toStopId}`;
}

/**
 * Build the full chain of legs between consecutive stops. Explicit legs from the
 * itinerary are used when present (matched by from/to ids); every other consecutive
 * pair gets an implicit "drive" leg.
 */
export function resolveLegChain(itinerary: Itinerary): Array<{ leg: TravelLeg; from: Stop; to: Stop }> {
  const stops = orderedStops(itinerary);
  const explicit = new Map<string, TravelLeg>();
  for (const leg of itinerary.legs ?? []) explicit.set(legId(leg.fromStopId, leg.toStopId), leg);

  const chain: Array<{ leg: TravelLeg; from: Stop; to: Stop }> = [];
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1];
    const to = stops[i];
    const id = legId(from.id, to.id);
    const leg = explicit.get(id) ?? { id, fromStopId: from.id, toStopId: to.id, mode: 'drive' as TravelMode };
    chain.push({ leg: { ...leg, id: leg.id ?? id }, from, to });
  }
  return chain;
}

/** Group ordered stops by calendar date, preserving visit order. */
export function groupByDay(itinerary: Itinerary): DayGroup[] {
  const groups = new Map<string, Stop[]>();
  for (const stop of orderedStops(itinerary)) {
    const list = groups.get(stop.date) ?? [];
    list.push(stop);
    groups.set(stop.date, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stops], dayIndex) => ({ date, dayIndex, stops }));
}

export interface StopSchedule {
  arrivalMinutes?: number;
  departureMinutes?: number;
  durationMinutes?: number;
}

/**
 * Derive the complete schedule for a stop from whichever fields were provided:
 * arrival + duration → departure; arrival + departure → duration.
 */
export function stopSchedule(stop: Stop): StopSchedule {
  const arrival = parseTimeToMinutes(stop.arrivalTime);
  let departure = parseTimeToMinutes(stop.departureTime);
  let duration = stop.durationMinutes;

  if (arrival !== undefined && departure !== undefined && duration === undefined) {
    duration = departure - arrival;
    if (duration < 0) duration += 1440; // crosses midnight
  } else if (arrival !== undefined && duration !== undefined && departure === undefined) {
    departure = arrival + duration;
  } else if (departure !== undefined && duration !== undefined && arrival === undefined) {
    // arrival can be derived from departure − duration
    return { arrivalMinutes: departure - duration, departureMinutes: departure, durationMinutes: duration };
  }
  return { arrivalMinutes: arrival, departureMinutes: departure, durationMinutes: duration };
}

export interface ItinerarySummary {
  stopCount: number;
  dayCount: number;
  driveCount: number;
  flightCount: number;
  firstDate?: string;
  lastDate?: string;
}

export function summarize(itinerary: Itinerary): ItinerarySummary {
  const days = groupByDay(itinerary);
  const chain = resolveLegChain(itinerary);
  return {
    stopCount: itinerary.stops.length,
    dayCount: days.length,
    driveCount: chain.filter((c) => c.leg.mode === 'drive').length,
    flightCount: chain.filter((c) => c.leg.mode === 'flight').length,
    firstDate: days[0]?.date,
    lastDate: days[days.length - 1]?.date,
  };
}

export const STOP_TYPE_LABELS: Record<NonNullable<Stop['type']>, string> = {
  job: 'Job site',
  hotel: 'Hotel',
  airport: 'Airport',
  office: 'Office',
  warehouse: 'Warehouse',
  restaurant: 'Restaurant',
  personal: 'Personal',
  other: 'Stop',
};
