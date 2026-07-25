import { getRegionLabel, REGION_ORDER } from '../data/regionCounties';
import { getRegionBaseColor, getRegionFullColor } from '../utils/regionColors';
import './Legend.css';

export function Legend() {
  return (
    <div className="legend" aria-label="Map legend">
      <h2 className="legend__title">Legend</h2>
      <p className="legend__hint">Lighter = less raised. Darker = closer to goal.</p>
      <ul className="legend__list">
        {REGION_ORDER.map((id) => (
          <li key={id} className="legend__item">
            <span className="legend__swatch-pair" aria-hidden="true">
              <span className="legend__swatch" style={{ backgroundColor: getRegionBaseColor(id) }} />
              <span className="legend__swatch" style={{ backgroundColor: getRegionFullColor(id) }} />
            </span>
            <span>{getRegionLabel(id)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
