# Trip Planner — Route & Itinerary Map Generator

Turns a structured list of stops (coordinates, dates, times, travel mode) into a
professional, interactive itinerary map with a synchronized day-by-day panel,
real road routing, flight arcs, collision-free labels, and PNG/PDF export.

Change the itinerary data and everything — map framing, markers, routes, flight
arcs, labels, the panel — regenerates automatically.

## Use it

The app is deployed with GitHub Pages from `.github/workflows/deploy.yml`
(builds, typechecks, tests, then publishes `dist/`). Trips are stored in the
browser (localStorage); use **Download trip JSON** / **Import trip JSON…** in the
trip menu to move them between devices or share them.

- **Trip menu** (click the title): switch trips, new, duplicate, import/export JSON, delete.
- **Plan trip**: form editor for stops in visit order — name, type, address with
  **Find** (geocodes via OpenStreetMap Nominatim) or **Pick on map**, coordinates,
  date, arrive/depart/time on site, notes; reorder or delete stops; mark any leg
  as a flight and enter flight number, airports and times. A JSON tab exposes the
  raw itinerary for power users.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
npm test           # unit tests (vitest)
```

Optional environment variables:

```bash
VITE_OSRM_URL=https://your-osrm.example.com      # OSRM-compatible routing server
VITE_GEOCODER_URL=https://your-nominatim.example  # Nominatim-compatible geocoder
VITE_BASE=/trip-planner/                          # base path for the production build (set by the Pages workflow)
```

## How it works

| Concern | Choice |
| --- | --- |
| Map rendering | [MapLibre GL JS](https://maplibre.org/) — WebGL vector/raster maps, `preserveDrawingBuffer` so the canvas can be exported |
| Basemaps | OpenFreeMap *Liberty* (streets) and *Positron* (light) vector tiles; Esri World Imagery + reference layers (satellite). No API keys; attribution is kept on screen and in exports |
| Road routing | [OSRM](http://project-osrm.org/) public API (swap via `VITE_OSRM_URL`). Real road geometry, distance and duration. Cached in memory + localStorage, requests coalesced, retried with backoff; falls back to a clearly-marked dashed straight line if routing fails |
| Flights | Great-circle arcs, dashed rose styling with direction arrows, labeled with flight number and times |
| Labels | Screen-space collision solver (`src/lib/labelPlacement.ts`): 8 candidate positions per stop label, full → compact → hidden tiers, pinned labels for selected/hovered stops, flight labels prioritised, hysteresis to avoid flicker while panning, fixed UI (legend, controls) treated as obstacles |
| Overlapping stops | When zoomed out, coincident markers are nudged apart with a bounded repulsion pass and get a leader line back to their exact coordinates |
| Export | `html-to-image` serialises the map container (WebGL canvas + DOM overlay) to a 2× PNG; jsPDF wraps it with a title page and a full itinerary listing |
| Data model | `src/types/itinerary.ts` — `Itinerary { stops[], legs[] }`. Consecutive stops are driven unless a `flight` leg is declared. Validated with zod (`src/lib/validation.ts`) |

### Data shape

```ts
type Stop = {
  id: string; order: number; name: string;
  latitude: number; longitude: number;
  date: string;                    // "YYYY-MM-DD"
  arrivalTime?: string;            // "HH:mm" or "h:mm AM"
  departureTime?: string;
  durationMinutes?: number;        // derived from the times when omitted
  type?: 'job' | 'hotel' | 'airport' | 'office' | 'warehouse' | 'restaurant' | 'personal' | 'other';
  address?: string; notes?: string;
};

type TravelLeg = {
  fromStopId: string; toStopId: string;
  mode: 'drive' | 'flight';
  durationMinutes?: number; distanceMiles?: number;   // planned values win over routed estimates
  flightNumber?: string; departureTime?: string; arrivalTime?: string;
  departureAirport?: string; arrivalAirport?: string; notes?: string;
};
```

Open **Plan trip → JSON** to paste an itinerary directly; four example
itineraries (a KPMG site rollout, a West Coast service run, a cross-country tour,
and a single-city day) are included.

## Interactions

- Hover a stop → its label expands with address and type.
- Click a stop (map or panel) → highlighted in both; from the panel the map also centers on it.
- Click a route or a leg in the panel → detail card with origin, destination, distance, duration, mode and flight details.
- **Fit itinerary** re-frames the whole trip. Basemap switcher and **Export** (PNG / PDF) live in the header.
- Desktop: map + sidebar. Mobile: map on top, itinerary scrolls beneath, compact labels.

## Scripts

- `scripts/screenshot.mjs` — headless Chromium screenshots (desktop, mobile, export) against the dev server.
- `scripts/render-map.mjs` — renders the default itinerary, saves the app's PNG export and the routed leg data.
- `scripts/build-brief.mjs` — builds a self-contained, shareable HTML brief from that export.

## Project layout

```
src/
  types/itinerary.ts        data model
  data/                      sample itineraries
  lib/                       geo, time, itinerary derivation, validation, label placement (+ tests)
  services/                  routing (OSRM + cache), basemaps, export
  hooks/useResolvedLegs.ts   turns legs into drawable geometry
  components/map/            MapView (MapLibre), overlay (markers/labels), layers, legend, leg card
  components/panel/          itinerary sidebar
  store/trips.ts             trip library (localStorage)
  components/TripEditor.tsx  form + JSON trip editor with geocoding and map picking
  components/                header (trip switcher, basemap, export), App
```
