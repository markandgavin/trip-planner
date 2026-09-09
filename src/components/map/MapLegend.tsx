import type { ResolvedLeg } from '@/types/itinerary';

export function MapLegend({ legs }: { legs: ResolvedLeg[] }) {
  const hasDrive = legs.some((l) => l.mode === 'drive' && l.source === 'routed');
  const hasFlight = legs.some((l) => l.mode === 'flight');
  const hasFallback = legs.some((l) => l.source === 'fallback');
  return (
    <div className="legend" aria-label="Map legend">
      <div className="legend__row">
        <span className="legend__marker">1</span>
        <span>Stop · visit order</span>
      </div>
      {hasDrive && (
        <div className="legend__row">
          <span className="legend__swatch" />
          <span>Driving route</span>
        </div>
      )}
      {hasFlight && (
        <div className="legend__row">
          <span className="legend__swatch legend__swatch--flight" />
          <span>Flight</span>
        </div>
      )}
      {hasFallback && (
        <div className="legend__row">
          <span className="legend__swatch legend__swatch--fallback" />
          <span>Straight-line (route unavailable)</span>
        </div>
      )}
    </div>
  );
}
