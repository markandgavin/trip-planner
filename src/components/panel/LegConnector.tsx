import { memo } from 'react';
import type { ResolvedLeg } from '@/types/itinerary';
import { formatDuration, formatMiles, formatTime } from '@/lib/time';
import { ModeIcon } from '@/components/ui/icons';

interface Props {
  leg: ResolvedLeg;
  selected: boolean;
  onSelect: (id: string) => void;
}

export const LegConnector = memo(function LegConnector({ leg, selected, onSelect }: Props) {
  const isFlight = leg.mode === 'flight';
  const fallback = leg.source === 'fallback';
  const duration = formatDuration(leg.durationMinutes);

  let text: React.ReactNode;
  if (isFlight) {
    const dep = formatTime(leg.leg.departureTime);
    const arr = formatTime(leg.leg.arrivalTime);
    const from = leg.leg.departureAirport ?? '';
    const to = leg.leg.arrivalAirport ?? '';
    text = (
      <span className="leg-connector__stack">
        <span>
          Flight{leg.leg.flightNumber ? ` ${leg.leg.flightNumber}` : ' · TBD'}
          {duration && <span className="leg-connector__sub"> · {duration}</span>}
        </span>
        {(dep || arr) && (
          <span className="leg-connector__sub">
            {from} {dep} → {to} {arr}
          </span>
        )}
      </span>
    );
  } else if (leg.loading) {
    text = <span>Drive · routing…</span>;
  } else {
    const miles = formatMiles(leg.distanceMiles);
    text = (
      <>
        <span>Drive{duration ? ` · ${duration}` : ''}</span>
        {miles && <span className="leg-connector__sub">· {miles}</span>}
        {fallback && <span className="leg-connector__sub">· approx.</span>}
      </>
    );
  }

  return (
    <button
      type="button"
      className={[
        'leg-connector',
        isFlight && 'leg-connector--flight',
        fallback && 'leg-connector--fallback',
        selected && 'leg-connector--selected',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect(leg.id)}
      aria-label={`Travel leg from ${leg.from.name} to ${leg.to.name}`}
    >
      <div className="leg-connector__rail" />
      <div>
        <span className="leg-connector__body">
          <ModeIcon mode={leg.mode} size={13} strokeWidth={2.5} />
          {text}
        </span>
      </div>
    </button>
  );
});
