import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DISTRICT_COUNTIES,
  MINNESOTA_OUTLINE,
} from '../data/mapGeometry';
import {
  getCountiesForRegion,
  getRegionForCounty,
  getRegionLabel,
} from '../data/regionCounties';
import { useMapZoom } from '../hooks/useMapZoom';
import type { ThermometerLookup } from '../types';
import { COLORS } from '../utils/colors';
import { isPointerOverMinnesota } from '../utils/mapHitTest';
import { MAP_VIEWBOX, MN_FLAT_TOP_Y, PANEL_BAY, viewBoxToMapLocal, viewBoxToPixel } from '../utils/mapViewBox';
import { getRegionProgressColor } from '../utils/regionColors';
import { Legend } from './Legend';
import { ThermometerPanel } from './ThermometerPanel';
import './MinnesotaMap.css';

type Point = { x: number; y: number };

type ConeShape = {
  sourceTop: Point;
  sourceBottom: Point;
  targetTop: Point;
  targetBottom: Point;
};

type MinnesotaMapProps = {
  data: ThermometerLookup;
  selectedRegion: string | null;
  onSelectRegion: (regionName: string) => void;
  clearRegion: () => void;
  /** Increment to force the map back to the default zoom (e.g. overview click). */
  zoomFitToken?: number;
};

function getCountyBounds(countyName: string) {
  return DISTRICT_COUNTIES.find((entry) => entry.name === countyName) ?? null;
}

function getCountyLabel(name: string) {
  return name.replace(/ County$/, '');
}

/** Same compact size for every county — small enough to fit the narrowest boxes. */
const COUNTY_LABEL_SIZE = 5.25;

const COUNTY_LABEL_ANCHORS: Partial<
  Record<string, { xRatio: number; yRatio: number }>
> = {
  // Keep Nicollet's label in its upper band (shape wraps around Blue Earth).
  'Nicollet County': { xRatio: 0.62, yRatio: 0.22 },
  // Nudge a few tight neighbors so labels don't collide across borders.
  'Waseca County': { xRatio: 0.5, yRatio: 0.42 },
  'Steele County': { xRatio: 0.5, yRatio: 0.58 },
  'Rice County': { xRatio: 0.5, yRatio: 0.55 },
  'Brown County': { xRatio: 0.42, yRatio: 0.55 },
};

function getCountyLabelPosition(county: (typeof DISTRICT_COUNTIES)[number]) {
  const anchor = COUNTY_LABEL_ANCHORS[county.name];
  const xRatio = anchor?.xRatio ?? 0.5;
  const yRatio = anchor?.yRatio ?? 0.5;

  return {
    x: county.x + county.width * xRatio,
    y: county.y + county.height * yRatio,
  };
}

/** Stack two-word names; keep short single names on one line. */
function getCountyLabelLines(label: string): string[] {
  const words = label.split(' ');
  if (words.length <= 1) return [label];
  return [words[0], words.slice(1).join(' ')];
}

function getRegionBounds(regionName: string) {
  const counties = getCountiesForRegion(regionName)
    .map((name) => getCountyBounds(name))
    .filter((c): c is NonNullable<typeof c> => c != null);

  if (counties.length === 0) return null;

  const minX = Math.min(...counties.map((c) => c.x));
  const minY = Math.min(...counties.map((c) => c.y));
  const maxX = Math.max(...counties.map((c) => c.x + c.width));
  const maxY = Math.max(...counties.map((c) => c.y + c.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function lineTextLength(line: string, maxWidth: number): number | undefined {
  const naturalWidth = line.length * COUNTY_LABEL_SIZE * 0.58;
  return naturalWidth > maxWidth ? maxWidth : undefined;
}

function CountyLabelText({
  county,
}: {
  county: (typeof DISTRICT_COUNTIES)[number];
}) {
  const label = getCountyLabel(county.name);
  const { x, y } = getCountyLabelPosition(county);
  const lines = getCountyLabelLines(label);
  const lineHeight = COUNTY_LABEL_SIZE * 1.1;
  // Cap drawable width so labels stay inside the county, not stretched edge-to-edge.
  const maxWidth = Math.max(12, county.width - 6);
  const startDy = -((lines.length - 1) * lineHeight) / 2;

  return (
    <text
      x={x}
      y={y}
      className="mn-map__county-label"
      fontSize={COUNTY_LABEL_SIZE}
      textAnchor="middle"
      dominantBaseline="middle"
      pointerEvents="none"
      aria-hidden="true"
    >
      {lines.map((line, index) => {
        const textLength = lineTextLength(line, maxWidth);
        return (
          <tspan
            key={`${county.name}-${line}`}
            x={x}
            dy={index === 0 ? startDy : lineHeight}
            {...(textLength != null
              ? { lengthAdjust: 'spacingAndGlyphs' as const, textLength }
              : {})}
          >
            {line}
          </tspan>
        );
      })}
    </text>
  );
}

export function MinnesotaMap({
  data,
  selectedRegion,
  onSelectRegion,
  clearRegion,
  zoomFitToken = 0,
}: MinnesotaMapProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<SVGSVGElement>(null);
  const zoomGroupRef = useRef<SVGGElement>(null);
  const outlinePathRef = useRef<SVGPathElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [cone, setCone] = useState<ConeShape | null>(null);
  const [panelPosition, setPanelPosition] = useState<{ left: number; top: number } | null>(null);
  const [zoomVersion, setZoomVersion] = useState(0);
  const [hoveredCounty, setHoveredCounty] = useState<string | null>(null);

  const handleZoom = useCallback(() => {
    setZoomVersion((version) => version + 1);
  }, []);

  const isPointerOverMap = useCallback((event: Event) => {
    const svg = mapRef.current;
    const outlinePath = outlinePathRef.current;
    if (!svg || !outlinePath) return false;
    return isPointerOverMinnesota(event, svg, outlinePath);
  }, []);

  const { reset: resetZoom } = useMapZoom({
    svgRef: mapRef,
    zoomGroupRef,
    onZoom: handleZoom,
    isPointerOverMap,
  });

  useEffect(() => {
    if (zoomFitToken > 0) {
      resetZoom();
    }
  }, [zoomFitToken, resetZoom]);

  const hoveredRegion = hoveredCounty ? getRegionForCounty(hoveredCounty) : null;
  const activeRegion = hoveredRegion ?? selectedRegion;

  const labeledCounties = useMemo(() => {
    if (!selectedRegion) return [];
    return getCountiesForRegion(selectedRegion)
      .map((name) => getCountyBounds(name))
      .filter((county): county is NonNullable<typeof county> => county != null);
  }, [selectedRegion]);

  const countyColors = useMemo(() => {
    return Object.fromEntries(
      DISTRICT_COUNTIES.map((county) => {
        const region = getRegionForCounty(county.name);
        if (!region) return [county.name, COLORS.upcoming];
        const row = data[region];
        return [county.name, getRegionProgressColor(region, row?.percentOfGoal ?? null)];
      })
    ) as Record<string, string>;
  }, [data]);

  const handleCountyClick = useCallback(
    (countyName: string) => {
      const region = getRegionForCounty(countyName);
      if (!region) return;
      onSelectRegion(region);
    },
    [onSelectRegion]
  );

  useEffect(() => {
    if (!selectedRegion) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.mn-map__county')) return;
      if (target.closest('.thermo-panel')) return;
      if (target.closest('.map-stage__reset-zoom')) return;
      if (target.closest('.region-overview__card')) return;

      clearRegion();
    }

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [selectedRegion, clearRegion]);

  useLayoutEffect(() => {
    function updateLegendOffset() {
      const svg = mapRef.current;
      const zoomGroup = zoomGroupRef.current;
      if (!svg || !mapWrapRef.current) return;

      const flatTop = viewBoxToMapLocal(0, MN_FLAT_TOP_Y, svg, zoomGroup);
      mapWrapRef.current.style.setProperty('--legend-top-offset', `${flatTop.y}px`);
    }

    updateLegendOffset();
    window.addEventListener('resize', updateLegendOffset);
    return () => window.removeEventListener('resize', updateLegendOffset);
  }, [zoomVersion]);

  useLayoutEffect(() => {
    function updatePanelPosition() {
      const svg = mapRef.current;
      const zoomGroup = zoomGroupRef.current;
      const stage = stageRef.current;
      if (!selectedRegion || !svg || !stage) {
        setPanelPosition(null);
        return;
      }

      const bounds = getRegionBounds(selectedRegion);
      if (!bounds) {
        // Region has no counties assigned yet — park the panel in the east bay
        const stageRect = stage.getBoundingClientRect();
        const panelAnchor = viewBoxToPixel(PANEL_BAY.x, PANEL_BAY.yMin, svg, zoomGroup, stageRect);
        setPanelPosition({ left: panelAnchor.x, top: panelAnchor.y });
        return;
      }

      const countyAnchorY = bounds.y - 12;
      const panelAnchorY = Math.min(
        PANEL_BAY.yMax,
        Math.max(PANEL_BAY.yMin, countyAnchorY)
      );
      const countyRightX = bounds.x + bounds.width;
      const panelX = Math.max(PANEL_BAY.x, countyRightX + PANEL_BAY.xMargin);
      const stageRect = stage.getBoundingClientRect();
      const panelAnchor = viewBoxToPixel(panelX, panelAnchorY, svg, zoomGroup, stageRect);

      // Panel uses translateY(-100%), so keep its full box inside the stage.
      const panelWidth = panelRef.current?.offsetWidth || 220;
      const panelHeight = panelRef.current?.offsetHeight || 200;
      const left = Math.min(
        Math.max(8, panelAnchor.x),
        Math.max(8, stage.clientWidth - panelWidth - 8)
      );
      const top = Math.min(
        Math.max(panelHeight + 8, panelAnchor.y),
        Math.max(panelHeight + 8, stage.clientHeight - 8)
      );

      setPanelPosition({ left, top });
    }

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    return () => window.removeEventListener('resize', updatePanelPosition);
  }, [selectedRegion, zoomVersion]);

  useLayoutEffect(() => {
    function updateCone() {
      const svg = mapRef.current;
      const zoomGroup = zoomGroupRef.current;
      if (!selectedRegion || !stageRef.current || !svg || !panelRef.current || !panelPosition) {
        setCone(null);
        return;
      }

      const bounds = getRegionBounds(selectedRegion);
      if (!bounds) {
        setCone(null);
        return;
      }

      const stageRect = stageRef.current.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();

      const rightX = bounds.x + bounds.width;
      const sourceTop = viewBoxToPixel(rightX, bounds.y, svg, zoomGroup, stageRect);
      const sourceBottom = viewBoxToPixel(rightX, bounds.y + bounds.height, svg, zoomGroup, stageRect);

      const targetTop: Point = {
        x: panelRect.left - stageRect.left,
        y: panelRect.top - stageRect.top,
      };
      const targetBottom: Point = {
        x: panelRect.left - stageRect.left,
        y: panelRect.bottom - stageRect.top,
      };

      setCone({ sourceTop, sourceBottom, targetTop, targetBottom });
    }

    updateCone();
    window.addEventListener('resize', updateCone);
    return () => window.removeEventListener('resize', updateCone);
  }, [selectedRegion, panelPosition, zoomVersion]);

  const conePoints = cone
    ? `${cone.sourceTop.x},${cone.sourceTop.y} ${cone.sourceBottom.x},${cone.sourceBottom.y} ${cone.targetBottom.x},${cone.targetBottom.y} ${cone.targetTop.x},${cone.targetTop.y}`
    : '';

  const viewBoxString = `${MAP_VIEWBOX.x} ${MAP_VIEWBOX.y} ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`;

  return (
    <div className="map-stage" ref={stageRef}>
      <div className="map-stage__map-wrap" ref={mapWrapRef}>
        <div className="map-stage__legend">
          <Legend />
        </div>

        <div className="map-stage__map" ref={mapAreaRef}>
          <div className="map-stage__map-controls">
            <button
              type="button"
              className="map-stage__reset-zoom"
              onClick={resetZoom}
              aria-label="Reset map zoom"
            >
              Reset zoom
            </button>
          </div>

          <svg
            ref={mapRef}
            className="mn-map"
            viewBox={viewBoxString}
            role="img"
            aria-label="Minnesota Congressional District 1 fundraising thermometer map"
          >
            <g ref={zoomGroupRef}>
              <path
                ref={outlinePathRef}
                d={MINNESOTA_OUTLINE.path}
                fill={COLORS.outsideDistrict}
                stroke={COLORS.countyStroke}
                strokeWidth={1}
                pointerEvents="none"
              />
              {DISTRICT_COUNTIES.map((county) => {
                const region = getRegionForCounty(county.name);
                const isInteractive = region != null;
                const isSelected = region != null && selectedRegion === region;
                const isHovered = region != null && activeRegion === region;
                const isHighlighted = isSelected || isHovered;

                return (
                  <path
                    key={county.name}
                    d={county.path}
                    fill={isHighlighted ? COLORS.countyStroke : countyColors[county.name]}
                    stroke={COLORS.countyStroke}
                    strokeWidth={1}
                    className={isInteractive ? 'mn-map__county' : 'mn-map__county mn-map__county--muted'}
                    onClick={() => {
                      if (isInteractive) handleCountyClick(county.name);
                    }}
                    onMouseEnter={() => {
                      if (isInteractive) setHoveredCounty(county.name);
                    }}
                    onMouseLeave={() => setHoveredCounty(null)}
                    onFocus={() => {
                      if (isInteractive) setHoveredCounty(county.name);
                    }}
                    onBlur={() => setHoveredCounty(null)}
                    onKeyDown={(event) => {
                      if (!isInteractive) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleCountyClick(county.name);
                      }
                    }}
                    tabIndex={isInteractive ? 0 : undefined}
                    role={isInteractive ? 'button' : undefined}
                    aria-label={
                      isInteractive
                        ? `${county.name}, ${getRegionLabel(region)}`
                        : `${county.name}, unassigned region`
                    }
                    aria-pressed={isInteractive ? isSelected : undefined}
                  />
                );
              })}
              <path
                d={MINNESOTA_OUTLINE.path}
                fill="none"
                stroke={COLORS.countyStroke}
                strokeWidth={1}
                pointerEvents="none"
              />
              <g className="mn-map__county-labels" pointerEvents="none">
                {labeledCounties.map((county) => (
                  <CountyLabelText key={county.name} county={county} />
                ))}
              </g>
            </g>
          </svg>
        </div>
      </div>

      {selectedRegion && (
        <ThermometerPanel
          ref={panelRef}
          regionName={selectedRegion}
          row={data[selectedRegion] ?? null}
          onClose={clearRegion}
          style={
            panelPosition
              ? {
                  left: `${panelPosition.left}px`,
                  top: `${panelPosition.top}px`,
                  visibility: 'visible',
                }
              : { visibility: 'hidden' }
          }
        />
      )}

      {selectedRegion && cone && (
        <svg className="map-stage__cone" aria-hidden="true">
          <defs>
            <linearGradient
              id="countyConeGradient"
              gradientUnits="userSpaceOnUse"
              x1={cone.sourceTop.x}
              y1={0}
              x2={cone.targetTop.x}
              y2={0}
            >
              <stop offset="0%" stopColor="rgba(28, 47, 87, 0.24)" />
              <stop offset="100%" stopColor="rgba(112, 196, 229, 0.12)" />
            </linearGradient>
          </defs>
          <polygon className="map-stage__cone-fill" points={conePoints} />
          <line
            className="map-stage__cone-edge"
            x1={cone.sourceTop.x}
            y1={cone.sourceTop.y}
            x2={cone.targetTop.x}
            y2={cone.targetTop.y}
          />
          <line
            className="map-stage__cone-edge"
            x1={cone.sourceBottom.x}
            y1={cone.sourceBottom.y}
            x2={cone.targetBottom.x}
            y2={cone.targetBottom.y}
          />
        </svg>
      )}
    </div>
  );
}
