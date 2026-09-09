import { ArrowRight, X } from 'lucide-react';
import type { ResolvedLeg } from '@/types/itinerary';
import { formatDuration, formatMiles, formatTime } from '@/lib/time';
import { ModeIcon } from '@/components/ui/icons';

export function LegDetailCard({ leg, onClose }: { leg: ResolvedLeg; onClose: () => void }) {
  const isFlight = leg.mode === 'flight';
  const fallback = leg.source === 'fallback';
  const modeLabel = isFlight ? 'Flight' : fallback ? 'Drive · route unavailable' : 'Drive';

  const cells: Array<{ k: string; v: string }> = [];
  if (isFlight) {
    if (leg.leg.flightNumber) cells.push({ k: 'Flight', v: leg.leg.flightNumber });
    if (leg.leg.departureTime)
      cells.push({ k: `Departs${leg.leg.departureAirport ? ` ${leg.leg.departureAirport}` : ''}`, v: formatTime(leg.leg.departureTime) });
    if (leg.leg.arrivalTime)
      cells.push({ k: `Arrives${leg.leg.arrivalAirport ? ` ${leg.leg.arrivalAirport}` : ''}`, v: formatTime(leg.leg.arrivalTime) });
    if (leg.durationMinutes !== undefined) cells.push({ k: 'Duration', v: formatDuration(leg.durationMinutes) });
    if (leg.distanceMiles !== undefined) cells.push({ k: 'Distance', v: formatMiles(leg.distanceMiles) });
  } else {
    if (leg.durationMinutes !== undefined) cells.push({ k: 'Duration', v: formatDuration(leg.durationMinutes) });
    if (leg.distanceMiles !== undefined) cells.push({ k: 'Distance', v: formatMiles(leg.distanceMiles) });
    if (
      leg.routedDurationMinutes !== undefined &&
      leg.leg.durationMinutes !== undefined &&
      Math.abs(leg.routedDurationMinutes - leg.leg.durationMinutes) > 2
    ) {
      cells.push({ k: 'Routed estimate', v: formatDuration(leg.routedDurationMinutes) });
    }
  }

  return (
    <div className="leg-card" role="dialog" aria-label="Travel leg details">
      <button type="button" className="leg-card__close" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
      <div className={`leg-card__mode ${isFlight ? 'leg-card__mode--flight' : fallback ? 'leg-card__mode--fallback' : ''}`}>
        <ModeIcon mode={leg.mode} size={13} strokeWidth={2.5} />
        {modeLabel}
      </div>
      <div className="leg-card__route">
        <span>
          {leg.from.order}. {leg.from.name}
        </span>
        <ArrowRight size={16} />
        <span>
          {leg.to.order}. {leg.to.name}
        </span>
      </div>
      {cells.length > 0 && (
        <div className="leg-card__grid">
          {cells.map((c) => (
            <div key={c.k}>
              <div className="leg-card__k">{c.k}</div>
              <div className="leg-card__v">{c.v}</div>
            </div>
          ))}
        </div>
      )}
      {fallback && (
        <div className="leg-card__note">
          {leg.loading
            ? 'Fetching the road route…'
            : `The road route could not be retrieved${leg.error ? ` (${leg.error})` : ''}. A straight geographic line is shown instead.`}
        </div>
      )}
      {leg.leg.notes && <div className="leg-card__note">{leg.leg.notes}</div>}
    </div>
  );
}
