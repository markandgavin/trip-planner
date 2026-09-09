import { describe, expect, it } from 'vitest';
import { formatDateLong, formatDateRange, formatDateShort, formatDuration, formatMiles, formatMinutesAsTime, formatTime, parseTimeToMinutes } from './time';

describe('time parsing', () => {
  it('parses 24h and 12h forms', () => {
    expect(parseTimeToMinutes('08:15')).toBe(495);
    expect(parseTimeToMinutes('8:15 AM')).toBe(495);
    expect(parseTimeToMinutes('8:15pm')).toBe(20 * 60 + 15);
    expect(parseTimeToMinutes('12:00 AM')).toBe(0);
    expect(parseTimeToMinutes('12:30 PM')).toBe(750);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
    expect(parseTimeToMinutes('9 AM')).toBe(540);
  });
  it('rejects invalid input', () => {
    expect(parseTimeToMinutes('25:00')).toBeUndefined();
    expect(parseTimeToMinutes('13:00 PM')).toBeUndefined();
    expect(parseTimeToMinutes('8:60')).toBeUndefined();
    expect(parseTimeToMinutes('noon')).toBeUndefined();
    expect(parseTimeToMinutes(undefined)).toBeUndefined();
  });
});

describe('formatting', () => {
  it('formats minutes as 12h time', () => {
    expect(formatMinutesAsTime(0)).toBe('12:00 AM');
    expect(formatMinutesAsTime(495)).toBe('8:15 AM');
    expect(formatMinutesAsTime(750)).toBe('12:30 PM');
    expect(formatMinutesAsTime(1440 + 30)).toBe('12:30 AM +1');
    expect(formatTime('13:05')).toBe('1:05 PM');
  });
  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(150)).toBe('2h 30m');
    expect(formatDuration(150, { short: true })).toBe('2h30');
    expect(formatDuration(undefined)).toBe('');
  });
  it('formats miles', () => {
    expect(formatMiles(2.44)).toBe('2.4 mi');
    expect(formatMiles(1234.4)).toBe('1,234 mi');
  });
  it('formats dates without timezone drift', () => {
    expect(formatDateShort('2026-09-14')).toBe('Sep 14');
    expect(formatDateLong('2026-09-14')).toBe('Monday · September 14');
    expect(formatDateRange('2026-09-14', '2026-09-16')).toBe('Sep 14 – 16, 2026');
    expect(formatDateRange('2026-09-30', '2026-10-02')).toBe('Sep 30 – Oct 2, 2026');
    expect(formatDateRange('2026-09-14', '2026-09-14')).toBe('Sep 14, 2026');
  });
});
