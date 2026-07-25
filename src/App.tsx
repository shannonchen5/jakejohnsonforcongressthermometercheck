import { useRef, useState } from 'react';
import jjfcLogo from './assets/jjfc-logo.png';
import { MinnesotaMap } from './components/MinnesotaMap';
import { RegionOverview } from './components/RegionOverview';
import { useThermometerData } from './hooks/useThermometerData';
import './styles/brand.css';

/** Slow ease-out scroll so the move to the map is obvious. */
function smoothScrollToMap(element: HTMLElement, durationMs = 900) {
  const targetY = Math.max(
    0,
    window.scrollY + element.getBoundingClientRect().top - 16
  );
  const startY = window.scrollY;
  const distance = targetY - startY;
  if (Math.abs(distance) < 2) return;

  const startTime = performance.now();
  const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

  const step = (now: number) => {
    const t = Math.min(1, (now - startTime) / durationMs);
    window.scrollTo(0, startY + distance * easeOutCubic(t));
    if (t < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

function App() {
  const { data, loading, error, lastFetchedAt } = useThermometerData();
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const mapSectionRef = useRef<HTMLElement>(null);

  const handleSelectRegion = (regionName: string) => {
    setSelectedRegion((current) => (current === regionName ? null : regionName));
  };

  const handleOverviewSelect = (regionName: string) => {
    const willOpen = selectedRegion !== regionName;
    setSelectedRegion(willOpen ? regionName : null);
    if (willOpen && mapSectionRef.current) {
      // Let the panel open, then ease down to the map
      window.setTimeout(() => {
        if (mapSectionRef.current) smoothScrollToMap(mapSectionRef.current);
      }, 80);
    }
  };

  const clearRegion = () => {
    setSelectedRegion(null);
  };

  return (
    <div className="app">
      <header className="app__header">
        <a
          className="app__brand"
          href="https://www.jakejohnsonforcongress.com/"
          target="_blank"
          rel="noreferrer"
        >
          <img
            className="app__brand-logo"
            src={jjfcLogo}
            alt="Jake Johnson for Congress"
          />
        </a>
        <div className="app__header-text">
          <h1 className="app__title">Thermometer Check</h1>
          <p className="app__subtitle">District 1 fundraising by region</p>
        </div>
      </header>

      {loading && !lastFetchedAt && (
        <p className="app__status">Loading thermometer data…</p>
      )}
      {error && (
        <div className="app__status app__status--error" role="alert">
          <strong>Could not load Google Sheet.</strong> {error}
          <span className="app__status-hint">
            Check that the sheet is publicly readable and that{' '}
            <code>VITE_GOOGLE_SHEET_ID</code> is set in <code>.env</code>.
          </span>
        </div>
      )}
      {!error && lastFetchedAt && (
        <p className="app__status">
          Sheet refreshed {lastFetchedAt.toLocaleTimeString()}
        </p>
      )}

      {/* Hide the map only when the first fetch fails with no cached data */}
      {(!error || lastFetchedAt) && (
        <main className="app__main">
          <RegionOverview
            data={data}
            selectedRegion={selectedRegion}
            onSelectRegion={handleOverviewSelect}
          />
          <section
            ref={mapSectionRef}
            id="region-map"
            className="app__map-section"
            aria-label="District map"
          >
            <MinnesotaMap
              data={data}
              selectedRegion={selectedRegion}
              onSelectRegion={handleSelectRegion}
              clearRegion={clearRegion}
            />
          </section>
        </main>
      )}

      <footer className="app__footer">
        <a href="https://www.jakejohnsonforcongress.com/" target="_blank" rel="noreferrer">
          jakejohnsonforcongress.com
        </a>
      </footer>
    </div>
  );
}

export default App;
