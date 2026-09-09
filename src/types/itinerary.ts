/**
 * Core itinerary data model.
 *
 * The itinerary is the single source of truth. Everything on screen (map framing,
 * markers, routes, labels, the sidebar) is derived from it, so changing the data
 * re-generates the entire visualization.
 */

export type StopType =
  | 'job'
  | 'hotel'
  | 'airport'
  | 'office'
  | 'warehouse'
  | 'restaurant'
  | 'personal'
  | 'other';

export type TravelMode = 'drive' | 'flight';

export interface Stop {
  /** Stable identifier used to link legs and UI selection. */
  id: string;
  /** Visit order (1-based). This is the number shown on the map. */
  order: number;
  name: string;
  /** Exact WGS84 coordinates — the source of truth for marker placement. */
  latitude: number;
  longitude: number;
  /** ISO calendar date, e.g. "2026-09-14". */
  date: string;
  /** Local time of arrival, "HH:mm" (24h) or "h:mm AM". */
  arrivalTime?: string;
  /** Local time of departure. If omitted but durationMinutes is given, it is derived. */
  departureTime?: string;
  /** Time on site in minutes. If omitted but both times are given, it is derived. */
  durationMinutes?: number;
  type?: StopType;
  address?: string;
  notes?: string;
}

export interface TravelLeg {
  /** Optional stable id; generated from the stop ids when omitted. */
  id?: string;
  fromStopId: string;
  toStopId: string;
  mode: TravelMode;
  /** Planned travel time. For drives, the routing engine estimate is used when absent. */
  durationMinutes?: number;
  /** Planned distance. For drives, the routed distance is used when absent. */
  distanceMiles?: number;
  /** Flight details (mode === "flight"). */
  flightNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  notes?: string;
}

export interface Itinerary {
  id: string;
  title: string;
  /** Optional free-form description shown in the header. */
  subtitle?: string;
  stops: Stop[];
  /**
   * Explicit travel legs. Any consecutive pair of stops without an explicit leg gets
   * an implicit "drive" leg, so most itineraries only need to list flights here.
   */
  legs?: TravelLeg[];
}

/* ------------------------------------------------------------------------ */
/* Derived / resolved shapes used by the renderer                            */
/* ------------------------------------------------------------------------ */

export type LngLat = [number, number];

export type RouteSource =
  /** Real road geometry from the routing engine. */
  | 'routed'
  /** Routing failed or is unavailable; straight geographic connection. */
  | 'fallback'
  /** Flight: great-circle arc. */
  | 'great-circle';

export interface ResolvedLeg {
  id: string;
  index: number;
  mode: TravelMode;
  from: Stop;
  to: Stop;
  leg: TravelLeg;
  /** Geometry actually drawn on the map. */
  geometry: LngLat[];
  source: RouteSource;
  /** True while a road route is still being fetched. */
  loading: boolean;
  /** Best available duration/distance (planned value wins over routed estimate). */
  durationMinutes?: number;
  distanceMiles?: number;
  /** Routing-engine estimate, kept separately so the UI can show both. */
  routedDurationMinutes?: number;
  routedDistanceMiles?: number;
  error?: string;
}

export interface DayGroup {
  date: string;
  dayIndex: number;
  stops: Stop[];
}
