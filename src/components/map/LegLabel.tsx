import { forwardRef } from 'react';
import { ArrowRight } from 'lucide-react';
import type { ResolvedLeg } from '@/types/itinerary';
import type { LabelVariant } from '@/lib/labelPlacement';
import { formatDuration, formatMiles, formatTime } from '@/lib/time';
import { ModeIcon } from '@/components/ui/icons';

interface Props {
  leg: ResolvedLeg;
  variant: LabelVariant;
  selected?: boolean;
  x?: number;
  y?: number;
  onSelect?: (id: string) => void;
}

export const LegLabel = forwardRef<HTMLDivElement, Props>(function LegLabel(
  { leg, variant, selected, x = 0, y = 0, onSelect },
  ref,
) {
  const isFlight = leg.mode === 'flight';
  const duration = formatDuration(leg.durationMinutes, { short: true });

  let content;
  if (isFlight) {
    const { flightNumber, departureAirport, arrivalAirport, departureTime, arrivalTime } = leg.leg;
    const dep = formatTime(departureTime);
    const arr = formatTime(arrivalTime);
    content = (
      <>
        <span className="leg-label__line">
          <ModeIcon mode="flight" size={12} strokeWidth={2.5} />
          <span>{flightNumber ?? 'Flight'}</span>
          {duration ? (
            <span className="leg-label__muted">· {duration}</span>
          ) : (
            !flightNumber && <span className="leg-label__muted">· TBD</span>
          )}
        </span>
        {variant === 'full' && (dep || arr) && (
          <span className="leg-label__sub">
            {departureAirport ?? ''} {dep}
            {(dep || arr) && (
              <ArrowRight size={10} strokeWidth={2.5} style={{ margin: '0 3px', verticalAlign: '-1px' }} />
            )}
            {arrivalAirport ?? ''} {arr}
          </span>
        )}
      </>
    );
  } else {
    const miles = formatMiles(leg.distanceMiles);
    const fallback = leg.source === 'fallback';
    content = (
      <>
        <ModeIcon mode="drive" size={12} strokeWidth={2.5} />
        {leg.loading ? (
          <span className="leg-label__muted">Routing…</span>
        ) : (
          <>
            <span>{duration || (fallback ? 'Drive' : '')}</span>
            {variant === 'full' && miles && (
              <span className="leg-label__muted">· {miles}</span>
            )}
            {fallback && variant === 'full' && <span className="leg-label__muted">· approx.</span>}
          </>
        )}
      </>
    );
  }

  return (
    <div
      ref={ref}
      className={[
        'leg-label',
        isFlight && 'leg-label--flight',
        leg.source === 'fallback' && 'leg-label--fallback',
        selected && 'leg-label--selected',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(leg.id);
      }}
      role={onSelect ? 'button' : undefined}
      title={isFlight ? 'Flight' : leg.source === 'fallback' ? 'Road route unavailable — straight-line shown' : 'Drive'}
    >
      {content}
    </div>
  );
});
