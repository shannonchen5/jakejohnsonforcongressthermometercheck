import { forwardRef, type CSSProperties } from 'react';
import { getRegionLabel } from '../data/regionCounties';
import type { ThermometerRow } from '../types';
import { formatMoney, formatPercent } from '../utils/money';
import { Thermometer } from './Thermometer';
import './ThermometerPanel.css';

type ThermometerPanelProps = {
  regionName: string;
  row: ThermometerRow | null;
  onClose: () => void;
  style?: CSSProperties;
};

export const ThermometerPanel = forwardRef<HTMLElement, ThermometerPanelProps>(
  function ThermometerPanel({ regionName, row, onClose, style }, ref) {
    const pending = !row;
    const label = getRegionLabel(regionName);

    return (
      <aside
        ref={ref}
        className="thermo-panel"
        style={style}
        aria-label={`${label} fundraising progress`}
      >
        <button
          type="button"
          className="thermo-panel__close"
          onClick={onClose}
          aria-label="Close panel"
        >
          ×
        </button>
        <h2 className="thermo-panel__title">{label}</h2>

        {pending ? (
          <p className="thermo-panel__pending">Data pending</p>
        ) : (
          <div className="thermo-panel__body">
            <Thermometer
              percentOfGoal={row.percentOfGoal}
              regionId={regionName}
              size="md"
            />
            <dl className="thermo-panel__stats">
              <div>
                <dt>Raised</dt>
                <dd>{formatMoney(row.raised)}</dd>
              </div>
              <div>
                <dt>Goal</dt>
                <dd>{formatMoney(row.goal)}</dd>
              </div>
              <div>
                <dt>% of Goal</dt>
                <dd>{formatPercent(row.percentOfGoal)}</dd>
              </div>
            </dl>
            <p className="thermo-panel__updated">
              Last updated: {row.lastUpdated || '—'}
            </p>
          </div>
        )}
      </aside>
    );
  }
);
