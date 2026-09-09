import { describe, expect, it } from 'vitest';
import type { Itinerary } from '@/types/itinerary';
import { groupByDay, resolveLegChain, stopSchedule, summarize } from './itinerary';
import { westCoastTrip } from '@/data/sampleItineraries';

const small: Itinerary = {
  id: 't',
  title: 'T',
  stops: [
    { id: 'c', order: 3, name: 'C', latitude: 0, longitude: 2, date: '2026-01-02' },
    { id: 'a', order: 1, name: 'A', latitude: 0, longitude: 0, date: '2026-01-01' },
    { id: 'b', order: 2, name: 'B', latitude: 0, longitude: 1, date: '2026-01-01' },
  ],
  legs: [{ fromStopId: 'b', toStopId: 'c', mode: 'flight', flightNumber: 'XX 1' }],
};

describe('resolveLegChain', () => {
  it('follows visit order and fills implicit drive legs', () => {
    const chain = resolveLegChain(small);
    expect(chain.map((c) => `${c.from.id}>${c.to.id}:${c.leg.mode}`)).toEqual(['a>b:drive', 'b>c:flight']);
    expect(chain[1].leg.flightNumber).toBe('XX 1');
    expect(chain[0].leg.id).toBe('a__b');
  });
  it('sample data has the expected flights', () => {
    const chain = resolveLegChain(westCoastTrip);
    expect(chain).toHaveLength(westCoastTrip.stops.length - 1);
    expect(chain.filter((c) => c.leg.mode === 'flight')).toHaveLength(2);
  });
});

describe('groupByDay', () => {
  it('groups by date in chronological order, stops in visit order', () => {
    const days = groupByDay(small);
    expect(days.map((d) => d.date)).toEqual(['2026-01-01', '2026-01-02']);
    expect(days[0].stops.map((s) => s.id)).toEqual(['a', 'b']);
    expect(days[1].dayIndex).toBe(1);
  });
});

describe('stopSchedule', () => {
  it('derives departure from arrival + duration', () => {
    const s = stopSchedule({ id: 'x', order: 1, name: 'x', latitude: 0, longitude: 0, date: '2026-01-01', arrivalTime: '08:00', durationMinutes: 90 });
    expect(s.departureMinutes).toBe(570);
  });
  it('derives duration from arrival + departure', () => {
    const s = stopSchedule({ id: 'x', order: 1, name: 'x', latitude: 0, longitude: 0, date: '2026-01-01', arrivalTime: '23:00', departureTime: '01:00' });
    expect(s.durationMinutes).toBe(120);
  });
  it('derives arrival from departure − duration', () => {
    const s = stopSchedule({ id: 'x', order: 1, name: 'x', latitude: 0, longitude: 0, date: '2026-01-01', departureTime: '10:00', durationMinutes: 60 });
    expect(s.arrivalMinutes).toBe(540);
  });
});

describe('summarize', () => {
  it('counts stops, days and modes', () => {
    const s = summarize(westCoastTrip);
    expect(s.stopCount).toBe(13);
    expect(s.dayCount).toBe(3);
    expect(s.flightCount).toBe(2);
    expect(s.driveCount).toBe(10);
    expect(s.firstDate).toBe('2026-09-14');
  });
});
