import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { AlertTriangle } from 'lucide-react';
import type { Itinerary } from '@/types/itinerary';
import { kpmgRollout } from '@/data/sampleItineraries';
import { useResolvedLegs } from '@/hooks/useResolvedLegs';
import { DEFAULT_BASEMAP, type BasemapId } from '@/services/basemaps';
import { exportPdf, exportPng } from '@/services/export';
import { Header } from '@/components/Header';
import { DataEditor } from '@/components/DataEditor';
import { MapView, type FocusRequest } from '@/components/map/MapView';
import { MapLegend } from '@/components/map/MapLegend';
import { LegDetailCard } from '@/components/map/LegDetailCard';
import { ItineraryPanel } from '@/components/panel/ItineraryPanel';

const STORAGE_KEY = 'itinerary-map:itinerary';

function loadInitialItinerary(): Itinerary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Itinerary;
  } catch {
    /* ignore */
  }
  return kpmgRollout;
}

export default function App() {
  const [itinerary, setItinerary] = useState<Itinerary>(loadInitialItinerary);
  const [basemap, setBasemap] = useState<BasemapId>(DEFAULT_BASEMAP);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [hoveredStopId, setHoveredStopId] = useState<string | null>(null);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [fitToken, setFitToken] = useState(0);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const mapRef = useRef<{ map: maplibregl.Map; container: HTMLDivElement } | null>(null);
  const { legs, routingPending, routingFailed, retryFailed } = useResolvedLegs(itinerary);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(itinerary));
    } catch {
      /* ignore */
    }
  }, [itinerary]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const applyItinerary = useCallback((next: Itinerary) => {
    setItinerary(next);
    setSelectedStopId(null);
    setSelectedLegId(null);
    setHoveredStopId(null);
  }, []);

  /** Select from the map: highlight + sync the panel (no camera move). */
  const selectStopFromMap = useCallback((id: string | null) => {
    setSelectedStopId((cur) => (cur === id ? null : id));
    setSelectedLegId(null);
  }, []);

  /** Select from the panel: highlight + smoothly center the map on it. */
  const selectStopFromPanel = useCallback((id: string) => {
    setSelectedStopId(id);
    setSelectedLegId(null);
    setFocusRequest({ stopId: id, token: Date.now() });
  }, []);

  const selectLeg = useCallback((id: string | null) => {
    setSelectedLegId((cur) => (cur === id ? null : id));
    setSelectedStopId(null);
  }, []);

  const selectedLeg = useMemo(() => legs.find((l) => l.id === selectedLegId) ?? null, [legs, selectedLegId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editorOpen) {
        setSelectedStopId(null);
        setSelectedLegId(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editorOpen]);

  const runExport = async (kind: 'png' | 'pdf') => {
    if (!mapRef.current) return;
    setExporting(true);
    try {
      if (kind === 'png') await exportPng(mapRef.current.container, mapRef.current.map, itinerary);
      else await exportPdf(mapRef.current.container, mapRef.current.map, itinerary, legs);
    } catch (e) {
      setToast(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="app">
      <div className="app__header">
        <Header
          itinerary={itinerary}
          basemap={basemap}
          exporting={exporting}
          onBasemapChange={setBasemap}
          onFit={() => setFitToken((t) => t + 1)}
          onExportPng={() => runExport('png')}
          onExportPdf={() => runExport('pdf')}
          onEdit={() => setEditorOpen(true)}
        />
      </div>

      <div className="app__map">
        <MapView
          itinerary={itinerary}
          legs={legs}
          basemap={basemap}
          selectedStopId={selectedStopId}
          hoveredStopId={hoveredStopId}
          selectedLegId={selectedLegId}
          fitToken={fitToken}
          focusRequest={focusRequest}
          onSelectStop={selectStopFromMap}
          onHoverStop={setHoveredStopId}
          onSelectLeg={selectLeg}
          onMapReady={(map, container) => {
            mapRef.current = { map, container };
          }}
        >
          <div className="map-chrome map-chrome--top-left">
            {routingPending > 0 && (
              <div className="status-pill" role="status">
                <span className="spinner" /> Routing {routingPending} {routingPending === 1 ? 'drive' : 'drives'}…
              </div>
            )}
            {routingPending === 0 && routingFailed > 0 && (
              <div className="status-pill status-pill--warn" role="status">
                <AlertTriangle size={13} />
                {routingFailed} {routingFailed === 1 ? 'route' : 'routes'} unavailable
                <button type="button" className="status-pill__link" onClick={retryFailed}>
                  Retry
                </button>
              </div>
            )}
            {toast && (
              <div className="status-pill status-pill--warn" role="alert">
                <AlertTriangle size={13} /> {toast}
              </div>
            )}
          </div>
          <div className="map-chrome map-chrome--bottom-left">
            <MapLegend legs={legs} />
          </div>
          {selectedLeg && (
            <div className="map-chrome map-chrome--bottom-center" data-export-exclude>
              <LegDetailCard leg={selectedLeg} onClose={() => setSelectedLegId(null)} />
            </div>
          )}
        </MapView>
      </div>

      <div className="app__sidebar">
        <ItineraryPanel
          itinerary={itinerary}
          legs={legs}
          selectedStopId={selectedStopId}
          hoveredStopId={hoveredStopId}
          selectedLegId={selectedLegId}
          onSelectStop={selectStopFromPanel}
          onHoverStop={setHoveredStopId}
          onSelectLeg={selectLeg}
        />
      </div>

      {editorOpen && (
        <DataEditor itinerary={itinerary} onApply={applyItinerary} onClose={() => setEditorOpen(false)} />
      )}
    </div>
  );
}
