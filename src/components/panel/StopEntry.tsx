import { memo } from 'react';
import type { Stop } from '@/types/itinerary';
import { stopSchedule, STOP_TYPE_LABELS } from '@/lib/itinerary';
import { formatDuration, formatMinutesAsTime } from '@/lib/time';
import { StopTypeIcon } from '@/components/ui/icons';

interface Props {
  stop: Stop;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export const StopEntry = memo(function StopEntry({ stop, selected, hovered, onSelect, onHover }: Props) {
  const s = stopSchedule(stop);
  const arrive = s.arrivalMinutes !== undefined ? formatMinutesAsTime(s.arrivalMinutes) : undefined;
  const depart = s.departureMinutes !== undefined ? formatMinutesAsTime(s.departureMinutes) : undefined;

  let timeLine = '';
  if (arrive && depart) timeLine = `${arrive} – ${depart}`;
  else if (arrive) timeLine = `Arrive ${arrive}`;
  else if (depart) timeLine = `Depart ${depart}`;

  return (
    <button
      type="button"
      id={`stop-entry-${stop.id}`}
      className={['stop-entry', selected && 'stop-entry--selected', hovered && 'stop-entry--hover']
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect(stop.id)}
      onMouseEnter={() => onHover(stop.id)}
      onMouseLeave={() => onHover(null)}
      aria-pressed={selected}
    >
      <div className="stop-entry__num">{stop.order}</div>
      <div className="stop-entry__body">
        <div className="stop-entry__name">
          <span>{stop.name}</span>
          {stop.type && (
            <span className={`stop-entry__type stop-entry__type--${stop.type}`}>
              <StopTypeIcon type={stop.type} size={10} strokeWidth={2.5} />
              {STOP_TYPE_LABELS[stop.type]}
            </span>
          )}
        </div>
        {timeLine && <div className="stop-entry__time">{timeLine}</div>}
        {s.durationMinutes !== undefined && s.durationMinutes > 0 && (
          <div className="stop-entry__meta">
            <span>On site: {formatDuration(s.durationMinutes)}</span>
          </div>
        )}
        {stop.address && <div className="stop-entry__addr">{stop.address}</div>}
        {stop.notes && selected && <div className="stop-entry__notes">{stop.notes}</div>}
      </div>
    </button>
  );
});
