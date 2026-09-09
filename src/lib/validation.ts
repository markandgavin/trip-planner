import { z } from 'zod';
import type { Itinerary } from '@/types/itinerary';
import { parseTimeToMinutes, parseISODate } from './time';

const timeString = z
  .string()
  .refine((s) => parseTimeToMinutes(s) !== undefined, 'Use "HH:mm" or "h:mm AM"');

const stopSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  date: z.string().refine((s) => parseISODate(s) !== undefined, 'Use "YYYY-MM-DD"'),
  arrivalTime: timeString.optional(),
  departureTime: timeString.optional(),
  durationMinutes: z.number().nonnegative().optional(),
  type: z
    .enum(['job', 'hotel', 'airport', 'office', 'warehouse', 'restaurant', 'personal', 'other'])
    .optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

const legSchema = z.object({
  id: z.string().optional(),
  fromStopId: z.string().min(1),
  toStopId: z.string().min(1),
  mode: z.enum(['drive', 'flight']),
  durationMinutes: z.number().nonnegative().optional(),
  distanceMiles: z.number().nonnegative().optional(),
  flightNumber: z.string().optional(),
  departureTime: timeString.optional(),
  arrivalTime: timeString.optional(),
  departureAirport: z.string().optional(),
  arrivalAirport: z.string().optional(),
  notes: z.string().optional(),
});

export const itinerarySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    stops: z.array(stopSchema).min(1),
    legs: z.array(legSchema).optional(),
  })
  .superRefine((it, ctx) => {
    const ids = new Set<string>();
    const orders = new Set<number>();
    it.stops.forEach((s, i) => {
      if (ids.has(s.id)) ctx.addIssue({ code: 'custom', path: ['stops', i, 'id'], message: `Duplicate stop id "${s.id}"` });
      if (orders.has(s.order)) ctx.addIssue({ code: 'custom', path: ['stops', i, 'order'], message: `Duplicate order ${s.order}` });
      ids.add(s.id);
      orders.add(s.order);
    });
    (it.legs ?? []).forEach((l, i) => {
      if (!ids.has(l.fromStopId)) ctx.addIssue({ code: 'custom', path: ['legs', i, 'fromStopId'], message: `Unknown stop "${l.fromStopId}"` });
      if (!ids.has(l.toStopId)) ctx.addIssue({ code: 'custom', path: ['legs', i, 'toStopId'], message: `Unknown stop "${l.toStopId}"` });
    });
  });

export type ValidationResult =
  | { ok: true; itinerary: Itinerary }
  | { ok: false; errors: string[] };

export function validateItinerary(input: unknown): ValidationResult {
  const result = itinerarySchema.safeParse(input);
  if (result.success) return { ok: true, itinerary: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}

export function parseItineraryJSON(text: string): ValidationResult {
  try {
    return validateItinerary(JSON.parse(text));
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${(e as Error).message}`] };
  }
}
