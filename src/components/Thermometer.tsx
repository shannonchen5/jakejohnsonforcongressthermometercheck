import { clampFillPercent } from '../utils/progressBand';
import { formatPercent } from '../utils/money';
import { getRegionProgressColor } from '../utils/regionColors';
import './Thermometer.css';

type ThermometerProps = {
  percentOfGoal: number | null;
  regionId?: string | null;
  fillColor?: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  pending?: boolean;
};

export function Thermometer({
  percentOfGoal,
  regionId = null,
  fillColor,
  size = 'md',
  showLabel = true,
  pending = false,
}: ThermometerProps) {
  const fill = pending ? 0 : clampFillPercent(percentOfGoal);
  const color =
    fillColor ??
    (regionId
      ? getRegionProgressColor(regionId, pending ? null : percentOfGoal)
      : getRegionProgressColor('2026-region1field', pending ? null : percentOfGoal));

  return (
    <div
      className={`thermo thermo--${size}${pending ? ' thermo--pending' : ''}`}
      role="img"
      aria-label={
        pending
          ? 'Data pending'
          : `${formatPercent(percentOfGoal)} of goal`
      }
    >
      <div className="thermo__track">
        <div
          className="thermo__fill"
          style={{ height: `${fill}%`, backgroundColor: color }}
        />
        <div className="thermo__bulb" style={{ backgroundColor: color }} />
      </div>
      {showLabel && (
        <span className="thermo__label">
          {pending ? 'Pending' : formatPercent(percentOfGoal)}
        </span>
      )}
    </div>
  );
}
