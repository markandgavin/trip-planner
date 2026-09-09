import { describe, expect, it } from 'vitest';
import { parseItineraryJSON, validateItinerary } from './validation';
import { sampleItineraries } from '@/data/sampleItineraries';

describe('validateItinerary', () => {
  it('accepts all sample itineraries', () => {
    for (const s of sampleItineraries) expect(validateItinerary(s).ok).toBe(true);
  });
  it('reports duplicate ids and orders', () => {
    const r = validateItinerary({
      id: 'x', title: 'x',
      stops: [
        { id: 'a', order: 1, name: 'A', latitude: 0, longitude: 0, date: '2026-01-01' },
        { id: 'a', order: 1, name: 'B', latitude: 0, longitude: 0, date: '2026-01-01' },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/Duplicate stop id/);
  });
  it('reports legs referencing unknown stops and bad coordinates', () => {
    const r = validateItinerary({
      id: 'x', title: 'x',
      stops: [{ id: 'a', order: 1, name: 'A', latitude: 95, longitude: 0, date: '2026-01-01' }],
      legs: [{ fromStopId: 'a', toStopId: 'zzz', mode: 'flight' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.includes('latitude'))).toBe(true);
      expect(r.errors.some((e) => e.includes('Unknown stop "zzz"'))).toBe(true);
    }
  });
  it('rejects malformed times and dates', () => {
    const r = validateItinerary({
      id: 'x', title: 'x',
      stops: [{ id: 'a', order: 1, name: 'A', latitude: 0, longitude: 0, date: '09/14/2026', arrivalTime: '25:00' }],
    });
    expect(r.ok).toBe(false);
  });
  it('handles invalid JSON text', () => {
    const r = parseItineraryJSON('{ nope');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/Invalid JSON/);
  });
});
