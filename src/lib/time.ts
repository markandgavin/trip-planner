/**
 * Small, dependency-free time helpers. All itinerary times are local wall-clock
 * strings; we never convert across zones (each stop's times are shown as entered).
 */

/** Parse "HH:mm", "H:mm", "h:mm AM", "h:mmpm", "8 AM" → minutes since midnight. */
export function parseTimeToMinutes(input: string | undefined): number | undefined {
  if (!input) return undefined;
  const s = input.trim().toLowerCase();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ampm = m[3];
  if (min > 59) return undefined;
  if (ampm) {
    if (h < 1 || h > 12) return undefined;
    if (ampm === 'am') h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  } else if (h > 23) {
    return undefined;
  }
  return h * 60 + min;
}

/** Minutes since midnight → "8:15 AM". Values ≥ 24h wrap (next-day) with a "+1" suffix. */
export function formatMinutesAsTime(minutes: number | undefined): string {
  if (minutes === undefined || !Number.isFinite(minutes)) return '';
  const dayOffset = Math.floor(minutes / 1440);
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  return `${h12}:${String(mm).padStart(2, '0')} ${suffix}${dayOffset > 0 ? ' +1' : ''}`;
}

/** Normalize any accepted time string to "h:mm AM" display form. */
export function formatTime(input: string | undefined): string {
  return formatMinutesAsTime(parseTimeToMinutes(input));
}

/** 150 → "2h 30m", 45 → "45 min", 120 → "2h". */
export function formatDuration(minutes: number | undefined, opts?: { short?: boolean }): string {
  if (minutes === undefined || !Number.isFinite(minutes)) return '';
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (m === 0) return `${h}h`;
  return opts?.short ? `${h}h${m}` : `${h}h ${m}m`;
}

export function formatMiles(miles: number | undefined): string {
  if (miles === undefined || !Number.isFinite(miles)) return '';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles).toLocaleString()} mi`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parse "YYYY-MM-DD" into a local Date (no timezone shifting). */
export function parseISODate(date: string): Date | undefined {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** "2026-09-14" → "Sep 14" */
export function formatDateShort(date: string): string {
  const d = parseISODate(date);
  if (!d) return date;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "2026-09-14" → "Monday · September 14" */
export function formatDateLong(date: string): string {
  const d = parseISODate(date);
  if (!d) return date;
  return `${WEEKDAYS[d.getDay()]} · ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
}

/** "2026-09-14" → "Mon, Sep 14" */
export function formatDateMedium(date: string): string {
  const d = parseISODate(date);
  if (!d) return date;
  return `${WEEKDAYS[d.getDay()].slice(0, 3)}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Inclusive date range label: "Sep 14 – 16, 2026" or "Sep 30 – Oct 2, 2026". */
export function formatDateRange(start: string, end: string): string {
  const a = parseISODate(start);
  const b = parseISODate(end);
  if (!a || !b) return `${start} – ${end}`;
  const year = b.getFullYear();
  if (start === end) return `${MONTHS[a.getMonth()]} ${a.getDate()}, ${year}`;
  if (a.getMonth() === b.getMonth()) {
    return `${MONTHS[a.getMonth()]} ${a.getDate()} – ${b.getDate()}, ${year}`;
  }
  return `${MONTHS[a.getMonth()]} ${a.getDate()} – ${MONTHS[b.getMonth()]} ${b.getDate()}, ${year}`;
}
