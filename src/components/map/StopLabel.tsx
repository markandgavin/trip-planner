import { forwardRef } from 'react';
import type { Stop } from '@/types/itinerary';
import type { LabelVariant } from '@/lib/labelPlacement';
import { stopSchedule, STOP_TYPE_LABELS } from '@/lib/itinerary';
import { formatDateShort, formatDuration, formatMinutesAsTime } from '@/lib/time';
import { StopTypeIcon } from '@/components/ui/icons';

interface Props {
  stop: Stop;
  variant: LabelVariant;
  /** Expanded (hovered/selected) labels also show the address. */
  expanded?: boolean;
  pinned?: boolean;
  dimmed?: boolean;
  x?: number;
  y?: number;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
}

export const StopLabel = forwardRef<HTMLDivElement, Props>(function StopLabel(
  { stop, variant, expanded, pinned, dimmed, x = 0, y = 0, onSelect, onHover },
  ref,
) {
  const s = stopSchedule(stop);
  const hasTimes = s.arrivalMinutes !== undefined || s.departureMinutes !== undefined;
  return (
    <div
      ref={ref}
      className={[
        'stop-label',
        variant === 'compact' && 'stop-label--compact',
        pinned && 'stop-label--pinned',
        dimmed && 'stop-label--dim',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(stop.id);
      }}
      onMouseEnter={() => onHover?.(stop.id)}
      onMouseLeave={() => onHover?.(null)}
      role={onSelect ? 'button' : undefined}
    >
      <div className="stop-label__title">
        <StopTypeIcon type={stop.type} size={12} strokeWidth={2.25} />
        <span>{stop.name}</span>
      </div>
      {variant === 'full' && (
        <>
          <div className="stop-label__date">{formatDateShort(stop.date)}</div>
          {(hasTimes || s.durationMinutes !== undefined) && (
            <div className="stop-label__meta">
              {s.arrivalMinutes !== undefined && (
                <span>Arrive {formatMinutesAsTime(s.arrivalMinutes)}</span>
              )}
              {s.arrivalMinutes === undefined && s.departureMinutes !== undefined && (
                <span>Depart {formatMinutesAsTime(s.departureMinutes)}</span>
              )}
              {s.durationMinutes !== undefined && s.durationMinutes > 0 && (
                <>
                  <span className="dot">·</span>
                  <span>On site {formatDuration(s.durationMinutes, { short: true })}</span>
                </>
              )}
            </div>
          )}
          {expanded && (stop.address || stop.type) && (
            <div className="stop-label__addr">
              {stop.type ? STOP_TYPE_LABELS[stop.type] : ''}
              {stop.type && stop.address ? ' · ' : ''}
              {stop.address ?? ''}
            </div>
          )}
        </>
      )}
    </div>
  );
});
