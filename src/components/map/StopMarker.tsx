import { memo } from 'react';
import type { Stop } from '@/types/itinerary';
import { StopTypeIcon } from '@/components/ui/icons';

interface Props {
  stop: Stop;
  x: number;
  y: number;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export const StopMarker = memo(function StopMarker({
  stop,
  x,
  y,
  selected,
  hovered,
  dimmed,
  onSelect,
  onHover,
}: Props) {
  const showType = stop.type && stop.type !== 'other' && stop.type !== 'job';
  return (
    <button
      type="button"
      className={[
        'marker',
        selected && 'marker--selected',
        hovered && 'marker--hover',
        dimmed && 'marker--dim',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(stop.id);
      }}
      onMouseEnter={() => onHover(stop.id)}
      onMouseLeave={() => onHover(null)}
      aria-label={`Stop ${stop.order}: ${stop.name}`}
      aria-pressed={selected}
    >
      <span>{stop.order}</span>
      {showType && (
        <span className={`marker__type marker__type--${stop.type}`} aria-hidden>
          <StopTypeIcon type={stop.type} size={9} strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
});
