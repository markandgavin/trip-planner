import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Crosshair,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Itinerary, LngLat, Stop, StopType, TravelLeg } from '@/types/itinerary';
import { legId, orderedStops, STOP_TYPE_LABELS } from '@/lib/itinerary';
import { parseItineraryJSON, validateItinerary } from '@/lib/validation';
import { geocode, type GeocodeResult } from '@/services/geocode';
import { sampleItineraries } from '@/data/sampleItineraries';
import { newId } from '@/store/trips';

/* ------------------------------------------------------------------------ */
/* Draft model: strings everywhere so the form can hold partial input        */
/* ------------------------------------------------------------------------ */

interface DraftStop {
  id: string;
  name: string;
  type: StopType;
  address: string;
  latitude: string;
  longitude: string;
  date: string;
  arrivalTime: string;
  departureTime: string;
  durationMinutes: string;
  notes: string;
}

interface DraftLeg {
  mode: 'drive' | 'flight';
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: string;
}

interface Draft {
  title: string;
  subtitle: string;
  stops: DraftStop[];
  /** keyed by legId(from, to) */
  legs: Record<string, DraftLeg>;
}

const emptyLeg = (): DraftLeg => ({
  mode: 'drive',
  flightNumber: '',
  departureAirport: '',
  arrivalAirport: '',
  departureTime: '',
  arrivalTime: '',
  durationMinutes: '',
});

function toDraft(it: Itinerary): Draft {
  const stops = orderedStops(it).map<DraftStop>((s) => ({
    id: s.id,
    name: s.name,
    type: s.type ?? 'other',
    address: s.address ?? '',
    latitude: String(s.latitude),
    longitude: String(s.longitude),
    date: s.date,
    arrivalTime: s.arrivalTime ?? '',
    departureTime: s.departureTime ?? '',
    durationMinutes: s.durationMinutes !== undefined ? String(s.durationMinutes) : '',
    notes: s.notes ?? '',
  }));
  const legs: Record<string, DraftLeg> = {};
  for (const l of it.legs ?? []) {
    legs[legId(l.fromStopId, l.toStopId)] = {
      mode: l.mode,
      flightNumber: l.flightNumber ?? '',
      departureAirport: l.departureAirport ?? '',
      arrivalAirport: l.arrivalAirport ?? '',
      departureTime: l.departureTime ?? '',
      arrivalTime: l.arrivalTime ?? '',
      durationMinutes: l.durationMinutes !== undefined ? String(l.durationMinutes) : '',
    };
  }
  return { title: it.title, subtitle: it.subtitle ?? '', stops, legs };
}

const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
const str = (s: string) => (s.trim() === '' ? undefined : s.trim());

function fromDraft(d: Draft, id: string): unknown {
  const stops = d.stops.map<Stop>((s, i) => ({
    id: s.id,
    order: i + 1,
    name: s.name.trim(),
    type: s.type,
    address: str(s.address),
    latitude: num(s.latitude) as number,
    longitude: num(s.longitude) as number,
    date: s.date.trim(),
    arrivalTime: str(s.arrivalTime),
    departureTime: str(s.departureTime),
    durationMinutes: num(s.durationMinutes),
    notes: str(s.notes),
  }));
  const legs: TravelLeg[] = [];
  for (let i = 1; i < stops.length; i++) {
    const key = legId(stops[i - 1].id, stops[i].id);
    const l = d.legs[key];
    if (!l || l.mode === 'drive') continue;
    legs.push({
      fromStopId: stops[i - 1].id,
      toStopId: stops[i].id,
      mode: 'flight',
      flightNumber: str(l.flightNumber),
      departureAirport: str(l.departureAirport),
      arrivalAirport: str(l.arrivalAirport),
      departureTime: str(l.departureTime),
      arrivalTime: str(l.arrivalTime),
      durationMinutes: num(l.durationMinutes),
    });
  }
  // Strip undefined so the JSON view stays clean.
  return JSON.parse(JSON.stringify({ id, title: d.title.trim(), subtitle: str(d.subtitle), stops, legs }));
}

/* ------------------------------------------------------------------------ */

export interface PickRequest {
  stopId: string;
  label: string;
}

interface Props {
  itinerary: Itinerary;
  /** Coordinates picked on the map for the stop we asked about. */
  picked: { stopId: string; lngLat: LngLat; token: number } | null;
  picking: PickRequest | null;
  onRequestPick: (req: PickRequest | null) => void;
  onSave: (itinerary: Itinerary) => void;
  onClose: () => void;
}

export function TripEditor({ itinerary, picked, picking, onRequestPick, onSave, onClose }: Props) {
  const [tab, setTab] = useState<'stops' | 'json'>('stops');
  const [draft, setDraft] = useState<Draft>(() => toDraft(itinerary));
  const [json, setJson] = useState(() => JSON.stringify(itinerary, null, 2));
  const [errors, setErrors] = useState<string[]>([]);
  const [openStop, setOpenStop] = useState<string | null>(draft.stops[0]?.id ?? null);

  // Apply a map pick to the draft.
  const lastPick = useRef<number>(0);
  useEffect(() => {
    if (!picked || picked.token === lastPick.current) return;
    lastPick.current = picked.token;
    setDraft((d) => ({
      ...d,
      stops: d.stops.map((s) =>
        s.id === picked.stopId
          ? { ...s, latitude: picked.lngLat[1].toFixed(6), longitude: picked.lngLat[0].toFixed(6) }
          : s,
      ),
    }));
    setOpenStop(picked.stopId);
  }, [picked]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (picking) onRequestPick(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onRequestPick, picking]);

  const updateStop = (id: string, patch: Partial<DraftStop>) =>
    setDraft((d) => ({ ...d, stops: d.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const moveStop = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const stops = [...d.stops];
      const j = index + dir;
      if (j < 0 || j >= stops.length) return d;
      [stops[index], stops[j]] = [stops[j], stops[index]];
      return { ...d, stops };
    });

  const removeStop = (id: string) =>
    setDraft((d) => ({ ...d, stops: d.stops.filter((s) => s.id !== id) }));

  const addStop = () =>
    setDraft((d) => {
      const last = d.stops[d.stops.length - 1];
      const stop: DraftStop = {
        id: newId('stop'),
        name: `Stop ${d.stops.length + 1}`,
        type: 'job',
        address: '',
        latitude: last ? last.latitude : '47.6062',
        longitude: last ? last.longitude : '-122.3321',
        date: last ? last.date : new Date().toISOString().slice(0, 10),
        arrivalTime: '',
        departureTime: '',
        durationMinutes: '60',
        notes: '',
      };
      setOpenStop(stop.id);
      return { ...d, stops: [...d.stops, stop] };
    });

  const updateLeg = (key: string, patch: Partial<DraftLeg>) =>
    setDraft((d) => ({ ...d, legs: { ...d.legs, [key]: { ...(d.legs[key] ?? emptyLeg()), ...patch } } }));

  const save = () => {
    const result =
      tab === 'json' ? parseItineraryJSON(json) : validateItinerary(fromDraft(draft, itinerary.id));
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    onSave(result.itinerary);
    onClose();
  };

  const switchTab = (next: 'stops' | 'json') => {
    if (next === tab) return;
    setErrors([]);
    if (next === 'json') {
      setJson(JSON.stringify(fromDraft(draft, itinerary.id), null, 2));
    } else {
      const r = parseItineraryJSON(json);
      if (r.ok) setDraft(toDraft(r.itinerary));
      else {
        setErrors(r.errors);
        return;
      }
    }
    setTab(next);
  };

  const loadExample = (it: Itinerary) => {
    const copy = { ...structuredClone(it), id: itinerary.id };
    setDraft(toDraft(copy));
    setJson(JSON.stringify(copy, null, 2));
    setErrors([]);
  };

  // While picking a location, collapse to a thin bar so the map is usable.
  if (picking) {
    return (
      <div className="pick-bar" role="status">
        <Crosshair size={16} />
        <span>
          Click the map to place <strong>{picking.label}</strong>
        </span>
        <button type="button" className="btn btn--sm" onClick={() => onRequestPick(null)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer drawer--wide" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <div className="drawer__head">
          <div style={{ flex: 1 }}>
            <h2 id="editor-title">Plan trip</h2>
            <p>Add stops in visit order. Consecutive stops are driven unless you mark the leg as a flight.</p>
          </div>
          <div className="segmented" role="tablist" aria-label="Editor mode">
            <button type="button" role="tab" aria-selected={tab === 'stops'} className={`segmented__btn ${tab === 'stops' ? 'segmented__btn--active' : ''}`} onClick={() => switchTab('stops')}>
              Stops
            </button>
            <button type="button" role="tab" aria-selected={tab === 'json'} className={`segmented__btn ${tab === 'json' ? 'segmented__btn--active' : ''}`} onClick={() => switchTab('json')}>
              JSON
            </button>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Close editor">
            <X size={16} />
          </button>
        </div>

        <div className="drawer__body">
          {tab === 'stops' ? (
            <div className="form">
              <div className="form__row form__row--2">
                <label className="field">
                  <span className="field__label">Trip name</span>
                  <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </label>
                <label className="field">
                  <span className="field__label">Subtitle</span>
                  <input className="input" value={draft.subtitle} placeholder="Optional" onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} />
                </label>
              </div>

              <div className="stop-list">
                {draft.stops.map((s, i) => {
                  const prev = draft.stops[i - 1];
                  const key = prev ? legId(prev.id, s.id) : null;
                  const leg = key ? draft.legs[key] ?? emptyLeg() : null;
                  return (
                    <div key={s.id}>
                      {key && leg && (
                        <LegRow legKey={key} leg={leg} onChange={updateLeg} />
                      )}
                      <StopCard
                        stop={s}
                        index={i}
                        count={draft.stops.length}
                        open={openStop === s.id}
                        onToggle={() => setOpenStop(openStop === s.id ? null : s.id)}
                        onChange={(patch) => updateStop(s.id, patch)}
                        onMove={(dir) => moveStop(i, dir)}
                        onRemove={() => removeStop(s.id)}
                        onPick={() => onRequestPick({ stopId: s.id, label: s.name || `Stop ${i + 1}` })}
                      />
                    </div>
                  );
                })}
              </div>

              <button type="button" className="btn add-stop" onClick={addStop}>
                <Plus size={15} /> Add stop
              </button>

              <div className="drawer__presets">
                <span>Start from an example:</span>
                {sampleItineraries.map((ex) => (
                  <button key={ex.id} type="button" className="btn btn--sm" onClick={() => loadExample(ex)}>
                    {ex.title}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <textarea className="drawer__textarea" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} aria-label="Itinerary JSON" />
          )}

          {errors.length > 0 && (
            <div className="drawer__errors" role="alert">
              <ul>
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="drawer__foot">
          <span className="drawer__hint">Saving re-frames the map, re-routes drives and rebuilds the itinerary.</span>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={save}>
            Save trip
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function LegRow({ legKey, leg, onChange }: { legKey: string; leg: DraftLeg; onChange: (key: string, patch: Partial<DraftLeg>) => void }) {
  const flight = leg.mode === 'flight';
  return (
    <div className={`leg-edit ${flight ? 'leg-edit--flight' : ''}`}>
      <div className="leg-edit__mode">
        <span className="field__label">Travel</span>
        <div className="segmented">
          <button type="button" className={`segmented__btn ${!flight ? 'segmented__btn--active' : ''}`} onClick={() => onChange(legKey, { mode: 'drive' })}>
            Drive
          </button>
          <button type="button" className={`segmented__btn ${flight ? 'segmented__btn--active' : ''}`} onClick={() => onChange(legKey, { mode: 'flight' })}>
            Flight
          </button>
        </div>
        {!flight && <span className="leg-edit__hint">Road route, time and distance are calculated automatically.</span>}
      </div>
      {flight && (
        <div className="form__row form__row--flight">
          <label className="field">
            <span className="field__label">Flight no.</span>
            <input className="input" value={leg.flightNumber} placeholder="AS 655" onChange={(e) => onChange(legKey, { flightNumber: e.target.value })} />
          </label>
          <label className="field">
            <span className="field__label">From</span>
            <input className="input input--code" value={leg.departureAirport} placeholder="SEA" onChange={(e) => onChange(legKey, { departureAirport: e.target.value.toUpperCase() })} />
          </label>
          <label className="field">
            <span className="field__label">Departs</span>
            <input className="input" value={leg.departureTime} placeholder="12:05" onChange={(e) => onChange(legKey, { departureTime: e.target.value })} />
          </label>
          <label className="field">
            <span className="field__label">To</span>
            <input className="input input--code" value={leg.arrivalAirport} placeholder="SFO" onChange={(e) => onChange(legKey, { arrivalAirport: e.target.value.toUpperCase() })} />
          </label>
          <label className="field">
            <span className="field__label">Arrives</span>
            <input className="input" value={leg.arrivalTime} placeholder="14:27" onChange={(e) => onChange(legKey, { arrivalTime: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}

function StopCard({
  stop,
  index,
  count,
  open,
  onToggle,
  onChange,
  onMove,
  onRemove,
  onPick,
}: {
  stop: DraftStop;
  index: number;
  count: number;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<DraftStop>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onPick: () => void;
}) {
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const find = async () => {
    const q = stop.address.trim() || stop.name.trim();
    if (!q) return;
    setSearching(true);
    setGeoError(null);
    try {
      const r = await geocode(q);
      setResults(r);
      if (r.length === 0) setGeoError('No matches. Try adding a city or postcode.');
    } catch (e) {
      setGeoError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const coordsOk = useMemo(() => {
    const la = Number(stop.latitude);
    const lo = Number(stop.longitude);
    return stop.latitude.trim() !== '' && stop.longitude.trim() !== '' && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
  }, [stop.latitude, stop.longitude]);

  return (
    <div className={`stop-card ${open ? 'stop-card--open' : ''}`}>
      <div className="stop-card__head">
        <span className="stop-entry__num">{index + 1}</span>
        <input
          className="input input--title"
          value={stop.name}
          placeholder="Stop name"
          onChange={(e) => onChange({ name: e.target.value })}
          onFocus={() => !open && onToggle()}
        />
        <select className="input input--select" value={stop.type} onChange={(e) => onChange({ type: e.target.value as StopType })} aria-label="Stop type">
          {(Object.keys(STOP_TYPE_LABELS) as StopType[]).map((t) => (
            <option key={t} value={t}>
              {STOP_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <div className="stop-card__tools">
          <button type="button" className="btn btn--icon btn--sm" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up">
            <ArrowUp size={14} />
          </button>
          <button type="button" className="btn btn--icon btn--sm" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Move down">
            <ArrowDown size={14} />
          </button>
          <button type="button" className="btn btn--icon btn--sm" onClick={onRemove} disabled={count <= 1} aria-label="Delete stop">
            <Trash2 size={14} />
          </button>
          <button type="button" className="btn btn--sm" onClick={onToggle} aria-expanded={open}>
            {open ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {open && (
        <div className="stop-card__body">
          <div className="field">
            <span className="field__label">Address</span>
            <div className="field__inline">
              <input className="input" value={stop.address} placeholder="Street, city, state" onChange={(e) => onChange({ address: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && find()} />
              <button type="button" className="btn" onClick={find} disabled={searching} title="Look up coordinates for this address">
                {searching ? <span className="spinner" /> : <Search size={14} />} Find
              </button>
              <button type="button" className="btn" onClick={onPick} title="Click a point on the map">
                <Crosshair size={14} /> Pick on map
              </button>
            </div>
            {results && results.length > 0 && (
              <ul className="geo-results">
                {results.map((r) => (
                  <li key={`${r.latitude},${r.longitude}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ latitude: r.latitude.toFixed(6), longitude: r.longitude.toFixed(6) });
                        setResults(null);
                      }}
                    >
                      <MapPin size={12} /> {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {geoError && <div className="field__error">{geoError}</div>}
          </div>

          <div className="form__row form__row--coords">
            <label className="field">
              <span className="field__label">Latitude</span>
              <input className={`input input--code ${coordsOk ? '' : 'input--invalid'}`} value={stop.latitude} inputMode="decimal" onChange={(e) => onChange({ latitude: e.target.value })} />
            </label>
            <label className="field">
              <span className="field__label">Longitude</span>
              <input className={`input input--code ${coordsOk ? '' : 'input--invalid'}`} value={stop.longitude} inputMode="decimal" onChange={(e) => onChange({ longitude: e.target.value })} />
            </label>
            <label className="field">
              <span className="field__label">Date</span>
              <input className="input" type="date" value={stop.date} onChange={(e) => onChange({ date: e.target.value })} />
            </label>
          </div>

          <div className="form__row form__row--times">
            <label className="field">
              <span className="field__label">Arrive</span>
              <input className="input" value={stop.arrivalTime} placeholder="09:00" onChange={(e) => onChange({ arrivalTime: e.target.value })} />
            </label>
            <label className="field">
              <span className="field__label">Depart</span>
              <input className="input" value={stop.departureTime} placeholder="11:00" onChange={(e) => onChange({ departureTime: e.target.value })} />
            </label>
            <label className="field">
              <span className="field__label">Time on site (min)</span>
              <input className="input" value={stop.durationMinutes} inputMode="numeric" placeholder="120" onChange={(e) => onChange({ durationMinutes: e.target.value })} />
            </label>
          </div>

          <label className="field">
            <span className="field__label">Notes</span>
            <input className="input" value={stop.notes} placeholder="What happens here" onChange={(e) => onChange({ notes: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}
