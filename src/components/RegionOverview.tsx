import { getRegionLabel, getRegionSubtitle, REGION_ORDER } from '../data/regionCounties';
import type { ThermometerLookup } from '../types';
import { formatMoney, formatPercent } from '../utils/money';
import { Thermometer } from './Thermometer';
import './RegionOverview.css';

type RegionOverviewProps = {
  data: ThermometerLookup;
  selectedRegion: string | null;
  onSelectRegion: (regionName: string) => void;
};

export function RegionOverview({
  data,
  selectedRegion,
  onSelectRegion,
}: RegionOverviewProps) {
  return (
    <section className="region-overview" aria-label="All regions at a glance">
      <header className="region-overview__header">
        <h2 className="region-overview__title">All regions</h2>
        <p className="region-overview__subtitle">
          Compare progress side-by-side. Click a region or its counties on the map.
        </p>
      </header>

      <ul className="region-overview__grid">
        {REGION_ORDER.map((regionId) => {
          const row = data[regionId] ?? null;
          const pending = !row;
          const isSelected = selectedRegion === regionId;
          const subtitle = getRegionSubtitle(regionId);

          return (
            <li key={regionId}>
              <button
                type="button"
                className={`region-overview__card${isSelected ? ' region-overview__card--selected' : ''}`}
                onClick={() => onSelectRegion(regionId)}
                aria-pressed={isSelected}
              >
                <span className="region-overview__heading">
                  <span className="region-overview__name">{getRegionLabel(regionId)}</span>
                  {subtitle && (
                    <span className="region-overview__place">{subtitle}</span>
                  )}
                </span>
                <Thermometer
                  percentOfGoal={row?.percentOfGoal ?? null}
                  regionId={regionId}
                  size="sm"
                  pending={pending}
                />
                {pending ? (
                  <span className="region-overview__pending">Data pending</span>
                ) : (
                  <span className="region-overview__meta">
                    {formatMoney(row.raised)} / {formatMoney(row.goal)}
                    <span className="region-overview__pct">
                      {formatPercent(row.percentOfGoal)}
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
