import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  Car,
  ChevronDown,
  Copy,
  Download,
  FileImage,
  FileJson,
  FileText,
  Layers,
  MapPin,
  Maximize2,
  Pencil,
  Plane,
  Plus,
  Route,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Itinerary } from '@/types/itinerary';
import { summarize } from '@/lib/itinerary';
import { formatDateRange } from '@/lib/time';
import { BASEMAPS, type BasemapId } from '@/services/basemaps';

interface Props {
  itinerary: Itinerary;
  trips: Itinerary[];
  basemap: BasemapId;
  exporting: boolean;
  onSelectTrip: (id: string) => void;
  onNewTrip: () => void;
  onDuplicateTrip: () => void;
  onDeleteTrip: () => void;
  onImportTrip: (file: File) => void;
  onExportTripJson: () => void;
  onBasemapChange: (id: BasemapId) => void;
  onFit: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onEdit: () => void;
}

function useClickOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}

export function Header({
  itinerary,
  trips,
  basemap,
  exporting,
  onSelectTrip,
  onNewTrip,
  onDuplicateTrip,
  onDeleteTrip,
  onImportTrip,
  onExportTripJson,
  onBasemapChange,
  onFit,
  onExportPng,
  onExportPdf,
  onEdit,
}: Props) {
  const s = summarize(itinerary);
  const [exportOpen, setExportOpen] = useState(false);
  const [basemapOpen, setBasemapOpen] = useState(false);
  const [tripsOpen, setTripsOpen] = useState(false);
  const exportRef = useClickOutside(exportOpen, () => setExportOpen(false));
  const basemapRef = useClickOutside(basemapOpen, () => setBasemapOpen(false));
  const tripsRef = useClickOutside(tripsOpen, () => setTripsOpen(false));
  const fileRef = useRef<HTMLInputElement>(null);
  const current = BASEMAPS.find((b) => b.id === basemap) ?? BASEMAPS[0];

  return (
    <header className="header">
      <div className="header__brand menu" ref={tripsRef}>
        <div className="header__logo" aria-hidden>
          <Route size={18} strokeWidth={2.5} />
        </div>
        <button
          type="button"
          className="trip-switch"
          onClick={() => setTripsOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={tripsOpen}
          title="Switch or manage trips"
        >
          <div className="header__titles">
            <div className="header__title">
              {itinerary.title} <ChevronDown size={14} className="trip-switch__chev" />
            </div>
            <div className="header__subtitle">
              {itinerary.subtitle ? `${itinerary.subtitle} · ` : ''}
              {s.firstDate && s.lastDate ? formatDateRange(s.firstDate, s.lastDate) : ''}
            </div>
          </div>
        </button>
        {tripsOpen && (
          <div className="menu__list menu__list--left menu__list--trips" role="menu">
            <div className="menu__section">Your trips</div>
            {trips.map((t) => (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={t.id === itinerary.id}
                className={`menu__item ${t.id === itinerary.id ? 'menu__item--active' : ''}`}
                onClick={() => {
                  onSelectTrip(t.id);
                  setTripsOpen(false);
                }}
              >
                <div>
                  <strong>{t.title}</strong>
                  <small>
                    {t.stops.length} {t.stops.length === 1 ? 'stop' : 'stops'}
                    {t.stops.length ? ` · ${formatDateRange([...t.stops].sort((a, b) => a.date.localeCompare(b.date))[0].date, [...t.stops].sort((a, b) => b.date.localeCompare(a.date))[0].date)}` : ''}
                  </small>
                </div>
              </button>
            ))}
            <div className="menu__divider" />
            <button type="button" role="menuitem" className="menu__item" onClick={() => { setTripsOpen(false); onNewTrip(); }}>
              <Plus size={15} /> New trip
            </button>
            <button type="button" role="menuitem" className="menu__item" onClick={() => { setTripsOpen(false); onDuplicateTrip(); }}>
              <Copy size={15} /> Duplicate this trip
            </button>
            <button type="button" role="menuitem" className="menu__item" onClick={() => { setTripsOpen(false); fileRef.current?.click(); }}>
              <Upload size={15} /> Import trip JSON…
            </button>
            <button type="button" role="menuitem" className="menu__item" onClick={() => { setTripsOpen(false); onExportTripJson(); }}>
              <FileJson size={15} /> Download trip JSON
            </button>
            <div className="menu__divider" />
            <button type="button" role="menuitem" className="menu__item menu__item--danger" onClick={() => { setTripsOpen(false); onDeleteTrip(); }}>
              <Trash2 size={15} /> Delete this trip
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportTrip(f);
                e.target.value = '';
              }}
            />
          </div>
        )}
      </div>

      <div className="header__stats" aria-label="Trip summary">
        <span className="stat">
          <MapPin size={13} /> {s.stopCount} stops
        </span>
        <span className="stat">
          <CalendarDays size={13} /> {s.dayCount} {s.dayCount === 1 ? 'day' : 'days'}
        </span>
        {s.driveCount > 0 && (
          <span className="stat">
            <Car size={13} /> {s.driveCount} {s.driveCount === 1 ? 'drive' : 'drives'}
          </span>
        )}
        {s.flightCount > 0 && (
          <span className="stat">
            <Plane size={13} /> {s.flightCount} {s.flightCount === 1 ? 'flight' : 'flights'}
          </span>
        )}
      </div>

      <div className="header__spacer" />

      <div className="header__actions">
        <button type="button" className="btn" onClick={onFit} title="Fit the whole itinerary in view">
          <Maximize2 size={15} />
          <span className="btn__label btn__label--hide-mobile">Fit itinerary</span>
        </button>

        <div className="menu" ref={basemapRef}>
          <button
            type="button"
            className="btn"
            onClick={() => setBasemapOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={basemapOpen}
            title="Change basemap"
          >
            <Layers size={15} />
            <span className="btn__label btn__label--hide-mobile">{current.name}</span>
          </button>
          {basemapOpen && (
            <div className="menu__list" role="menu">
              {BASEMAPS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={b.id === basemap}
                  className={`menu__item ${b.id === basemap ? 'menu__item--active' : ''}`}
                  onClick={() => {
                    onBasemapChange(b.id);
                    setBasemapOpen(false);
                  }}
                >
                  <div>
                    <strong>{b.name}</strong>
                    <small>{b.description}</small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="menu" ref={exportRef}>
          <button
            type="button"
            className="btn"
            onClick={() => setExportOpen((o) => !o)}
            disabled={exporting}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            title="Export the map"
          >
            {exporting ? <span className="spinner" /> : <Download size={15} />}
            <span className="btn__label btn__label--hide-mobile">{exporting ? 'Exporting…' : 'Export'}</span>
          </button>
          {exportOpen && (
            <div className="menu__list" role="menu">
              <button
                type="button"
                role="menuitem"
                className="menu__item"
                onClick={() => {
                  setExportOpen(false);
                  onExportPng();
                }}
              >
                <FileImage size={16} />
                <div>
                  <strong>Map image (PNG)</strong>
                  <small>High-resolution map with routes and labels</small>
                </div>
              </button>
              <button
                type="button"
                role="menuitem"
                className="menu__item"
                onClick={() => {
                  setExportOpen(false);
                  onExportPdf();
                }}
              >
                <FileText size={16} />
                <div>
                  <strong>PDF</strong>
                  <small>Map page plus a full itinerary listing</small>
                </div>
              </button>
            </div>
          )}
        </div>

        <button type="button" className="btn btn--primary" onClick={onEdit} title="Add or edit stops">
          <Pencil size={15} />
          <span className="btn__label btn__label--hide-mobile">Plan trip</span>
        </button>
      </div>
    </header>
  );
}
