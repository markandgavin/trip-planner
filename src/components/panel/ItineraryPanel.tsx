import { Fragment, useEffect, useMemo } from 'react';
import type { Itinerary, ResolvedLeg } from '@/types/itinerary';
import { groupByDay, summarize } from '@/lib/itinerary';
import { formatDateLong, formatDuration } from '@/lib/time';
import { StopEntry } from './StopEntry';
import { LegConnector } from './LegConnector';

interface Props {
  itinerary: Itinerary;
  legs: ResolvedLeg[];
  selectedStopId: string | null;
  hoveredStopId: string | null;
  selectedLegId: string | null;
  onSelectStop: (id: string) => void;
  onHoverStop: (id: string | null) => void;
  onSelectLeg: (id: string) => void;
}

export function ItineraryPanel({
  itinerary,
  legs,
  selectedStopId,
  hoveredStopId,
  selectedLegId,
  onSelectStop,
  onHoverStop,
  onSelectLeg,
}: Props) {
  const days = useMemo(() => groupByDay(itinerary), [itinerary]);
  const summary = useMemo(() => summarize(itinerary), [itinerary]);
  const legByFrom = useMemo(() => new Map(legs.map((l) => [l.from.id, l])), [legs]);

  const totalDrive = legs
    .filter((l) => l.mode === 'drive')
    .reduce((acc, l) => acc + (l.durationMinutes ?? 0), 0);
  const totalFlight = legs
    .filter((l) => l.mode === 'flight')
    .reduce((acc, l) => acc + (l.durationMinutes ?? 0), 0);

  // Keep the selected entry in view.
  useEffect(() => {
    if (!selectedStopId) return;
    const el = document.getElementById(`stop-entry-${selectedStopId}`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedStopId]);

  return (
    <aside className="panel" aria-label="Itinerary">
      <div className="panel__head">
        <h2>Itinerary</h2>
        <div className="panel__summary">
          {summary.stopCount} stops · {summary.dayCount} {summary.dayCount === 1 ? 'day' : 'days'}
          {totalDrive > 0 && ` · ${formatDuration(totalDrive, { short: true })} driving`}
          {totalFlight > 0 && ` · ${formatDuration(totalFlight, { short: true })} flying`}
        </div>
      </div>
      <div className="panel__scroll">
        {days.map((day, di) => (
          <Fragment key={day.date}>
            {di > 0 && <div className="day-gap" />}
            <section className="day" aria-label={`Day ${day.dayIndex + 1}`}>
              <div className="day__header">
                <span className="day__index">Day {day.dayIndex + 1}</span>
                <span className="day__date">{formatDateLong(day.date)}</span>
                <span className="day__count">
                  Stops {day.stops[0].order}
                  {day.stops.length > 1 ? `–${day.stops[day.stops.length - 1].order}` : ''}
                </span>
              </div>
              {day.stops.map((stop) => {
                const leg = legByFrom.get(stop.id);
                return (
                  <Fragment key={stop.id}>
                    <StopEntry
                      stop={stop}
                      selected={stop.id === selectedStopId}
                      hovered={stop.id === hoveredStopId}
                      onSelect={onSelectStop}
                      onHover={onHoverStop}
                    />
                    {leg && (
                      <LegConnector leg={leg} selected={leg.id === selectedLegId} onSelect={onSelectLeg} />
                    )}
                  </Fragment>
                );
              })}
            </section>
          </Fragment>
        ))}
      </div>
    </aside>
  );
}
