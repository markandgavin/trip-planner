import maplibregl from 'maplibre-gl';
import type { ResolvedLeg } from '@/types/itinerary';

export const LEGS_SOURCE = 'itinerary-legs';
export const INTERACTIVE_LAYERS = ['legs-drive', 'legs-fallback', 'legs-flight'];

const DRIVE = '#2563eb';
const FLIGHT = '#e11d48';
const FALLBACK = '#64748b';

/** Draw a small arrow-head glyph into an ImageData for use as a symbol icon. */
function arrowImage(color: string, size = 22): { data: ImageData; pixelRatio: number } {
  const ratio = 2;
  const c = document.createElement('canvas');
  c.width = size * ratio;
  c.height = size * ratio;
  const ctx = c.getContext('2d')!;
  ctx.scale(ratio, ratio);
  ctx.translate(size / 2, size / 2);
  ctx.beginPath();
  // Arrow pointing along +x (maplibre rotates it along the line direction)
  ctx.moveTo(-5, -6);
  ctx.lineTo(6, 0);
  ctx.lineTo(-5, 6);
  ctx.lineTo(-2, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1.75;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fill();
  return { data: ctx.getImageData(0, 0, c.width, c.height), pixelRatio: ratio };
}

export function legsToGeoJSON(legs: ResolvedLeg[], selectedLegId: string | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: legs.map((l) => ({
      type: 'Feature',
      id: l.index,
      properties: {
        id: l.id,
        mode: l.mode,
        source: l.source,
        selected: l.id === selectedLegId,
        order: l.index,
      },
      geometry: { type: 'LineString', coordinates: l.geometry },
    })),
  };
}

/**
 * Idempotently (re)create the route source and layers on a map. Safe to call
 * after every style change.
 */
export function ensureLegLayers(map: maplibregl.Map, data: GeoJSON.FeatureCollection): void {
  if (!map.hasImage('arrow-drive')) {
    const a = arrowImage(DRIVE);
    map.addImage('arrow-drive', a.data, { pixelRatio: a.pixelRatio });
  }
  if (!map.hasImage('arrow-flight')) {
    const a = arrowImage(FLIGHT);
    map.addImage('arrow-flight', a.data, { pixelRatio: a.pixelRatio });
  }
  if (!map.hasImage('arrow-fallback')) {
    const a = arrowImage(FALLBACK);
    map.addImage('arrow-fallback', a.data, { pixelRatio: a.pixelRatio });
  }

  if (!map.getSource(LEGS_SOURCE)) {
    map.addSource(LEGS_SOURCE, { type: 'geojson', data, lineMetrics: false });
  } else {
    (map.getSource(LEGS_SOURCE) as maplibregl.GeoJSONSource).setData(data);
  }

  const selectedWidth = (base: number, sel: number): maplibregl.ExpressionSpecification => [
    'case',
    ['boolean', ['get', 'selected'], false],
    sel,
    base,
  ];

  // Insert beneath the basemap's symbol layers so city names stay readable,
  // but above roads / fills.
  const firstSymbol = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id;

  const add = (layer: maplibregl.LayerSpecification) => {
    if (map.getLayer(layer.id)) return;
    map.addLayer(layer, firstSymbol);
  };

  add({
    id: 'legs-drive-casing',
    type: 'line',
    source: LEGS_SOURCE,
    filter: ['all', ['==', ['get', 'mode'], 'drive'], ['==', ['get', 'source'], 'routed']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#ffffff',
      'line-width': selectedWidth(8, 10),
      'line-opacity': 0.9,
    },
  });
  add({
    id: 'legs-drive',
    type: 'line',
    source: LEGS_SOURCE,
    filter: ['all', ['==', ['get', 'mode'], 'drive'], ['==', ['get', 'source'], 'routed']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['case', ['boolean', ['get', 'selected'], false], '#1d4ed8', DRIVE],
      'line-width': selectedWidth(4.5, 6),
    },
  });
  add({
    id: 'legs-fallback-casing',
    type: 'line',
    source: LEGS_SOURCE,
    filter: ['==', ['get', 'source'], 'fallback'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': selectedWidth(6, 8), 'line-opacity': 0.85 },
  });
  add({
    id: 'legs-fallback',
    type: 'line',
    source: LEGS_SOURCE,
    filter: ['==', ['get', 'source'], 'fallback'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': FALLBACK,
      'line-width': selectedWidth(3, 4.5),
      'line-dasharray': [1.5, 2],
    },
  });
  add({
    id: 'legs-flight-casing',
    type: 'line',
    source: LEGS_SOURCE,
    filter: ['==', ['get', 'mode'], 'flight'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': selectedWidth(7, 9), 'line-opacity': 0.8 },
  });
  add({
    id: 'legs-flight',
    type: 'line',
    source: LEGS_SOURCE,
    filter: ['==', ['get', 'mode'], 'flight'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['case', ['boolean', ['get', 'selected'], false], '#be123c', FLIGHT],
      'line-width': selectedWidth(3.5, 5),
      'line-dasharray': [0.2, 2.2],
    },
  });

  // Direction arrows (placed above symbols so they always show)
  const arrowLayer = (
    id: string,
    icon: string,
    filter: maplibregl.FilterSpecification,
    spacing: number,
  ): maplibregl.LayerSpecification => ({
    id,
    type: 'symbol',
    source: LEGS_SOURCE,
    filter,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': spacing,
      'icon-image': icon,
      'icon-size': 0.9,
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-padding': 0,
    },
  });
  if (!map.getLayer('legs-drive-arrows')) {
    map.addLayer(
      arrowLayer(
        'legs-drive-arrows',
        'arrow-drive',
        ['all', ['==', ['get', 'mode'], 'drive'], ['==', ['get', 'source'], 'routed']],
        110,
      ),
    );
  }
  if (!map.getLayer('legs-fallback-arrows')) {
    map.addLayer(arrowLayer('legs-fallback-arrows', 'arrow-fallback', ['==', ['get', 'source'], 'fallback'], 140));
  }
  if (!map.getLayer('legs-flight-arrows')) {
    map.addLayer(arrowLayer('legs-flight-arrows', 'arrow-flight', ['==', ['get', 'mode'], 'flight'], 160));
  }
}
