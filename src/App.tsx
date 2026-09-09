import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { AlertTriangle } from 'lucide-react';
import type { Itinerary, LngLat } from '@/types/itinerary';
import { useResolvedLegs } from '@/hooks/useResolvedLegs';
import { useTrips } from '@/store/trips';
import { parseItineraryJSON } from '@/lib/validation';
import { safeFilename } from '@/services/export';
import { DEFAULT_BASEMAP, type BasemapId } from '@/services/basemaps';
import { exportPdf, exportPng } from '@/services/export';
import { Header } from '@/components/Header';
import { TripEditor, type PickRequest } from '@/components/TripEditor';
import { MapView, type FocusRequest } from '@/components/map/MapView';
import { MapLegend } from '@/components/map/MapLegend';
import { LegDetailCard } from '@/components/map/LegDetailCard';
import { ItineraryPanel } from '@/components/panel/ItineraryPanel';

export default function App() {
  const trips = useTrips();
  const itinerary = trips.current;
  const [basemap, setBasemap] = useState<BasemapId>(DEFAULT_BASEMAP);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [hoveredStopId, setHoveredStopId] = useState<string | null>(null);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [picking, setPicking] = useState<PickRequest | null>(null);
  const [picked, setPicked] = useState<{ stopId: string; lngLat: LngLat; token: number } | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const mapRef = useRef<{ map: maplibregl.Map; container: HTMLDivElement } | null>(null);
  const { legs, routingPending, routingFailed, retryFailed } = useResolvedLegs(itinerary);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const resetSelection = useCallback(() => {
    setSelectedStopId(null);
    setSelectedLegId(null);
    setHoveredStopId(null);
  }, []);

  const applyItinerary = useCallback(
    (next: Itinerary) => {
      trips.upsert(next);
      resetSelection();
    },
    [trips, resetSelection],
  );

  const selectTrip = useCallback(
    (id: string) => {
      trips.setCurrent(id);
      resetSelection();
    },
    [trips, resetSelection],
  );

  const newTrip = useCallback(() => {
    trips.create();
    resetSelection();
    setEditorOpen(true);
  }, [trips, resetSelection]);

  const deleteTrip = useCallback(() => {
    if (!window.confirm(`Delete "${itinerary.title}"? This cannot be undone.`)) return;
    trips.remove(itinerary.id);
    resetSelection();
  }, [trips, itinerary, resetSelection]);

  const importTrip = useCallback(
    async (file: File) => {
      const r = parseItineraryJSON(await file.text());
      if (!r.ok) {
        setToast(`Import failed: ${r.errors[0]}`);
        return;
      }
      const exists = trips.trips.some((t) => t.id === r.itinerary.id);
      applyItinerary(exists ? { ...r.itinerary, id: `${r.itinerary.id}-${Date.now().toString(36)}` } : r.itinerary);
    },
    [trips, applyItinerary],
  );

  const exportTripJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(itinerary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFilename(itinerary.title)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [itinerary]);

  const onPick = useCallback(
    (lngLat: LngLat) => {
      if (!picking) return;
      setPicked({ stopId: picking.stopId, lngLat, token: Date.now() });
      setPicking(null);
    },
    [picking],
  );

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
          trips={trips.trips}
          basemap={basemap}
          exporting={exporting}
          onSelectTrip={selectTrip}
          onNewTrip={newTrip}
          onDuplicateTrip={() => {
            trips.duplicate(itinerary.id);
            resetSelection();
          }}
          onDeleteTrip={deleteTrip}
          onImportTrip={importTrip}
          onExportTripJson={exportTripJson}
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
          picking={picking !== null}
          onPick={onPick}
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
        <TripEditor
          key={itinerary.id}
          itinerary={itinerary}
          picked={picked}
          picking={picking}
          onRequestPick={setPicking}
          onSave={applyItinerary}
          onClose={() => {
            setEditorOpen(false);
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}
