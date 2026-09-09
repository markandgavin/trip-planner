import type { Itinerary } from '@/types/itinerary';

/**
 * KPMG site rollout — Seattle → San Francisco → Tempe → Los Angeles → Denver.
 * Sites visited on consecutive days (pre-config, then launch) appear as
 * separate numbered stops so the map reads in visit order.
 * Coordinates are geocoded from the street addresses.
 */
export const kpmgRollout: Itinerary = {
  id: 'kpmg-site-rollout-2026',
  title: 'KPMG Site Rollout · West',
  subtitle: 'Seattle · San Francisco · Tempe · Los Angeles · Denver',
  stops: [
    // ---------------- Seattle · Day 1 (Sep 21) ----------------
    { id: 'kent-1', order: 1, name: 'Kent — Site 76', type: 'job', address: '20111 66th Ave S, Kent, WA 98032', latitude: 47.4221692, longitude: -122.2542124, date: '2026-09-21', arrivalTime: '07:00', departureTime: '09:00', notes: 'Pre-config' },
    { id: 'renton-1', order: 2, name: 'Renton — Site 79', type: 'job', address: '2201 Lind Ave SW, Renton, WA 98057', latitude: 47.4598986, longitude: -122.2246576, date: '2026-09-21', arrivalTime: '09:30', departureTime: '11:30', notes: 'Pre-config' },
    { id: 'kpmg-sea', order: 3, name: 'KPMG Seattle', type: 'office', address: '401 Union St, Seattle, WA 98101', latitude: 47.6092128, longitude: -122.335094, date: '2026-09-21', arrivalTime: '12:00', departureTime: '14:00', notes: 'Install' },
    // ---------------- Seattle · Day 2 (Sep 22) ----------------
    { id: 'kent-2', order: 4, name: 'Kent — Site 76', type: 'job', address: '20111 66th Ave S, Kent, WA 98032', latitude: 47.4221692, longitude: -122.2542124, date: '2026-09-22', arrivalTime: '07:00', departureTime: '09:00', notes: 'Launch' },
    { id: 'renton-2', order: 5, name: 'Renton — Site 79', type: 'job', address: '2201 Lind Ave SW, Renton, WA 98057', latitude: 47.4598986, longitude: -122.2246576, date: '2026-09-22', arrivalTime: '09:30', departureTime: '11:30', notes: 'Launch' },
    { id: 'sea', order: 6, name: 'Sea-Tac Airport (SEA)', type: 'airport', address: '17801 International Blvd, SeaTac, WA 98158', latitude: 47.4475673, longitude: -122.3080159, date: '2026-09-22', departureTime: '12:05' },
    { id: 'sfo-arr', order: 7, name: 'SFO Airport', type: 'airport', address: 'San Francisco, CA 94128', latitude: 37.622452, longitude: -122.3839894, date: '2026-09-22', arrivalTime: '14:27' },
    // ---------------- San Francisco / Tempe (Sep 23) ----------------
    { id: 'kpmg-sf', order: 8, name: 'KPMG San Francisco', type: 'office', address: '55 2nd St, San Francisco, CA 94105', latitude: 37.7888148, longitude: -122.400334, date: '2026-09-23', arrivalTime: '07:00', departureTime: '09:00', notes: 'Install' },
    { id: 'sfo-dep', order: 9, name: 'SFO Airport', type: 'airport', address: 'San Francisco, CA 94128', latitude: 37.622452, longitude: -122.3839894, date: '2026-09-23', departureTime: '10:40' },
    { id: 'phx-arr', order: 10, name: 'PHX Airport', type: 'airport', address: '3400 Sky Harbor Blvd, Phoenix, AZ 85034', latitude: 33.4328486, longitude: -112.0067915, date: '2026-09-23', arrivalTime: '12:50' },
    { id: 'kpmg-tempe', order: 11, name: 'KPMG Tempe', type: 'office', address: '60 E Rio Salado Pkwy, Tempe, AZ 85281', latitude: 33.4312197, longitude: -111.9394709, date: '2026-09-23', arrivalTime: '13:00', departureTime: '15:00', notes: 'Install (approx. 1–3pm)' },
    { id: 'phx-dep', order: 12, name: 'PHX Airport', type: 'airport', address: '3400 Sky Harbor Blvd, Phoenix, AZ 85034', latitude: 33.4328486, longitude: -112.0067915, date: '2026-09-23', departureTime: '16:00' },
    { id: 'lax-arr', order: 13, name: 'LAX', type: 'airport', address: '1 World Way, Los Angeles, CA 90045', latitude: 33.9421675, longitude: -118.4213591, date: '2026-09-23', arrivalTime: '17:32' },
    // ---------------- Los Angeles · Day 1 (Sep 24) ----------------
    { id: 'altadena-1', order: 14, name: 'Altadena — Site 78', type: 'job', address: '2408 Lincoln Ave, Altadena, CA 91001', latitude: 34.1872466, longitude: -118.159344, date: '2026-09-24', arrivalTime: '07:00', departureTime: '09:00', notes: 'Pre-config' },
    { id: 'kpmg-la', order: 15, name: 'KPMG LA', type: 'office', address: '633 W 5th St, Los Angeles, CA 90071', latitude: 34.0510651, longitude: -118.254467, date: '2026-09-24', arrivalTime: '10:00', departureTime: '12:00', notes: 'Install' },
    { id: 'elsegundo-1', order: 16, name: 'El Segundo — Site 59', type: 'job', address: '300 Continental Blvd, El Segundo, CA 90245', latitude: 33.9200483, longitude: -118.3900074, date: '2026-09-24', arrivalTime: '13:00', departureTime: '15:00', notes: 'Pre-config' },
    // ---------------- Los Angeles · Day 2 (Sep 25) ----------------
    { id: 'altadena-2', order: 17, name: 'Altadena — Site 78', type: 'job', address: '2408 Lincoln Ave, Altadena, CA 91001', latitude: 34.1872466, longitude: -118.159344, date: '2026-09-25', arrivalTime: '07:00', departureTime: '09:00', notes: 'Launch' },
    { id: 'elsegundo-2', order: 18, name: 'El Segundo — Site 59', type: 'job', address: '300 Continental Blvd, El Segundo, CA 90245', latitude: 33.9200483, longitude: -118.3900074, date: '2026-09-25', arrivalTime: '10:00', departureTime: '12:00', notes: 'Launch' },
    { id: 'lax-dep', order: 19, name: 'LAX', type: 'airport', address: '1 World Way, Los Angeles, CA 90045', latitude: 33.9421675, longitude: -118.4213591, date: '2026-09-25', arrivalTime: '12:15', notes: 'Flight to Denver — any time before Oct 6' },
    // ---------------- Denver (Oct 6) ----------------
    { id: 'den', order: 20, name: 'Denver Airport (DEN)', type: 'airport', address: '8500 Peña Blvd, Denver, CO 80249', latitude: 39.8606676, longitude: -104.6853673, date: '2026-10-06' },
    { id: 'highlands-ranch', order: 21, name: 'Highlands Ranch — Site 63', type: 'job', address: '8744 Kendrick Castillo Way, Highlands Ranch, CO 80129', latitude: 39.564788, longitude: -105.0101606, date: '2026-10-06' },
  ],
  legs: [
    { fromStopId: 'sea', toStopId: 'sfo-arr', mode: 'flight', flightNumber: 'AS 655', departureAirport: 'SEA', arrivalAirport: 'SFO', departureTime: '12:05', arrivalTime: '14:27', durationMinutes: 142 },
    { fromStopId: 'sfo-dep', toStopId: 'phx-arr', mode: 'flight', flightNumber: 'WN 972', departureAirport: 'SFO', arrivalAirport: 'PHX', departureTime: '10:40', arrivalTime: '12:50', durationMinutes: 130 },
    { fromStopId: 'phx-dep', toStopId: 'lax-arr', mode: 'flight', flightNumber: 'DL 3894', departureAirport: 'PHX', arrivalAirport: 'LAX', departureTime: '16:00', arrivalTime: '17:32', durationMinutes: 92 },
    { fromStopId: 'lax-dep', toStopId: 'den', mode: 'flight', departureAirport: 'LAX', arrivalAirport: 'DEN', notes: 'Flight not yet booked — any time before Oct 6' },
  ],
};
