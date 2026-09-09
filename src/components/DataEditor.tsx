import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { Itinerary } from '@/types/itinerary';
import { parseItineraryJSON } from '@/lib/validation';
import { sampleItineraries } from '@/data/sampleItineraries';

interface Props {
  itinerary: Itinerary;
  onApply: (itinerary: Itinerary) => void;
  onClose: () => void;
}

export function DataEditor({ itinerary, onApply, onClose }: Props) {
  const initial = useMemo(() => JSON.stringify(itinerary, null, 2), [itinerary]);
  const [text, setText] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const apply = () => {
    const result = parseItineraryJSON(text);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    onApply(result.itinerary);
    onClose();
  };

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <div className="drawer__head">
          <div style={{ flex: 1 }}>
            <h2 id="editor-title">Itinerary data</h2>
            <p>
              Edit the JSON and apply. Stops need <code>id</code>, <code>order</code>, <code>name</code>,{' '}
              <code>latitude</code>, <code>longitude</code>, <code>date</code>. Consecutive stops are driven unless a
              flight leg is listed in <code>legs</code>.
            </p>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Close editor">
            <X size={16} />
          </button>
        </div>
        <div className="drawer__body">
          <div className="drawer__presets">
            <span>Load example:</span>
            {sampleItineraries.map((s) => (
              <button
                key={s.id}
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  setText(JSON.stringify(s, null, 2));
                  setErrors([]);
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
          <textarea
            className="drawer__textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            aria-label="Itinerary JSON"
          />
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
          <span className="drawer__hint">Changes re-frame the map, re-route drives and rebuild the itinerary.</span>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={apply}>
            Apply itinerary
          </button>
        </div>
      </div>
    </div>
  );
}
