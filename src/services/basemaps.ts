import type { StyleSpecification } from 'maplibre-gl';

/**
 * Basemap catalogue. Every provider here is usable without an API key under its
 * published terms as long as attribution is preserved (it is, via the map's
 * attribution control, which is also included in exports).
 */

export type BasemapId = 'streets' | 'light' | 'satellite';

export interface Basemap {
  id: BasemapId;
  name: string;
  description: string;
  style: string | StyleSpecification;
  /** Whether map labels are light-on-dark (affects overlay contrast choices). */
  dark: boolean;
}

const ESRI_ATTRIBUTION =
  'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community';
const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function rasterStyle(
  sources: Array<{ id: string; tiles: string[]; attribution: string; maxzoom?: number }>,
): StyleSpecification {
  const style: StyleSpecification = { version: 8, sources: {}, layers: [] };
  for (const s of sources) {
    style.sources[s.id] = {
      type: 'raster',
      tiles: s.tiles,
      tileSize: 256,
      attribution: s.attribution,
      maxzoom: s.maxzoom ?? 19,
    };
    style.layers.push({ id: `${s.id}-layer`, type: 'raster', source: s.id });
  }
  return style;
}

export const BASEMAPS: Basemap[] = [
  {
    id: 'streets',
    name: 'Streets',
    description: 'OpenFreeMap · OpenStreetMap vector tiles',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    dark: false,
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Muted basemap that lets the route stand out',
    style: 'https://tiles.openfreemap.org/styles/positron',
    dark: false,
  },
  {
    id: 'satellite',
    name: 'Satellite',
    description: 'Esri World Imagery with roads and place labels',
    style: rasterStyle([
      {
        id: 'esri-imagery',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        attribution: ESRI_ATTRIBUTION,
      },
      {
        id: 'esri-transportation',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'],
        attribution: OSM_ATTRIBUTION,
      },
      {
        id: 'esri-places',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
        attribution: '',
      },
    ]),
    dark: true,
  },
];

export const DEFAULT_BASEMAP: BasemapId = 'streets';

export function getBasemap(id: BasemapId): Basemap {
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];
}
