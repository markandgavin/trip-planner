/**
 * Address → coordinates via OpenStreetMap Nominatim. Intended for occasional,
 * user-initiated lookups while planning (Nominatim's usage policy asks for
 * light, attributed use). Swap the base URL for your own geocoder in production.
 */
export interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
}

const BASE =
  (import.meta.env?.VITE_GEOCODER_URL as string | undefined)?.replace(/\/$/, '') ??
  'https://nominatim.openstreetmap.org';

export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `${BASE}/search?format=jsonv2&limit=5&addressdetails=0&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);
  const body = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return body.map((r) => ({ label: r.display_name, latitude: Number(r.lat), longitude: Number(r.lon) }));
}
