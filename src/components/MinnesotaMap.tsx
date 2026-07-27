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
import { getCountyCentroid } from '../utils/countyCentroid';
import { isPointerOverMinnesota } from '../utils/mapHitTest';
import { MAP_VIEWBOX, MN_FLAT_TOP_Y, viewBoxToMapLocal, viewBoxToPixel } from '../utils/mapViewBox';
import { getRegionProgressColor } from '../utils/regionColors';
import { Legend } from './Legend';
import { ThermometerPanel } from './ThermometerPanel';
import './MinnesotaMap.css';

type Point = { x: number; y: number };

/** Thin projector from a single focus point to a short segment on the panel. */
type ProjectorShape = {
  source: Point;
  targetTop: Point;
  targetBottom: Point;
};

type MinnesotaMapProps = {
  data: ThermometerLookup;
  selectedRegion: string | null;
  onSelectRegion: (regionName: string) => void;
  clearRegion: () => void;
};

function getCountyBounds(countyName: string) {
  return DISTRICT_COUNTIES.find((entry) => entry.name === countyName) ?? null;
}

function getCountyLabel(name: string) {
  return name.replace(/ County$/, '');
}

/** Same compact size for every county — small enough to fit the narrowest boxes. */
const COUNTY_LABEL_SIZE = 5.25;

/** Stack two-word names; keep short single names on one line. */
function getCountyLabelLines(label: string): string[] {
  const words = label.split(' ');
  if (words.length <= 1) return [label];
  return [words[0], words.slice(1).join(' ')];
}

/** Single focus point inside the region (average of county centroids). */
function getRegionFocusPoint(regionName: string): Point | null {
  const centroids = getCountiesForRegion(regionName)
    .map((name) => getCountyBounds(name))
    .filter((c): c is NonNullable<typeof c> => c != null)
    .map((county) => getCountyCentroid(county));

  if (centroids.length === 0) return null;

  return {
    x: centroids.reduce((sum, p) => sum + p.x, 0) / centroids.length,
    y: centroids.reduce((sum, p) => sum + p.y, 0) / centroids.length,
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
  const { x, y } = getCountyCentroid(county);
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
}: MinnesotaMapProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<SVGSVGElement>(null);
  const zoomGroupRef = useRef<SVGGElement>(null);
  const outlinePathRef = useRef<SVGPathElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [projector, setProjector] = useState<ProjectorShape | null>(null);
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

  const focusPoint = useMemo(
    () => (selectedRegion ? getRegionFocusPoint(selectedRegion) : null),
    [selectedRegion]
  );

  // Keep the full map in view so the projector can reach the region point.
  useEffect(() => {
    if (selectedRegion) resetZoom();
  }, [selectedRegion, resetZoom]);

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
      const mapArea = mapAreaRef.current;
      if (!selectedRegion || !focusPoint || !svg || !stage || !mapArea) {
        setPanelPosition(null);
        return;
      }

      const stageRect = stage.getBoundingClientRect();
      const mapRect = mapArea.getBoundingClientRect();
      const source = viewBoxToPixel(focusPoint.x, focusPoint.y, svg, zoomGroup, stageRect);

      // Park the popup in a side bay to the right of the map (not over counties).
      const panelWidth = panelRef.current?.offsetWidth || 220;
      const panelHeight = panelRef.current?.offsetHeight || 200;
      const sideGap = 16;
      const left = mapRect.right - stageRect.left + sideGap;

      // translateY(-100%) means `top` is the panel's bottom edge.
      const preferredTop = source.y + panelHeight / 2;
      const minTop = panelHeight + 8;
      const maxTop = Math.max(minTop, stage.clientHeight - 8);
      const top = Math.min(Math.max(preferredTop, minTop), maxTop);

      // Ensure the stage is wide enough that the side bay isn't clipped by the page.
      stage.style.setProperty('--panel-bay-width', `${panelWidth + sideGap}px`);

      setPanelPosition({ left, top });
    }

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    return () => window.removeEventListener('resize', updatePanelPosition);
  }, [selectedRegion, focusPoint, zoomVersion]);

  useLayoutEffect(() => {
    function updateProjector() {
      const svg = mapRef.current;
      const zoomGroup = zoomGroupRef.current;
      if (!selectedRegion || !focusPoint || !stageRef.current || !svg || !panelRef.current || !panelPosition) {
        setProjector(null);
        return;
      }

      const stageRect = stageRef.current.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();
      const source = viewBoxToPixel(focusPoint.x, focusPoint.y, svg, zoomGroup, stageRect);

      const panelLeft = panelRect.left - stageRect.left;
      const panelMidY =
        (panelRect.top + panelRect.bottom) / 2 - stageRect.top;
      const half = Math.min(22, panelRect.height * 0.22);

      setProjector({
        source,
        targetTop: { x: panelLeft, y: panelMidY - half },
        targetBottom: { x: panelLeft, y: panelMidY + half },
      });
    }

    updateProjector();
    window.addEventListener('resize', updateProjector);
    return () => window.removeEventListener('resize', updateProjector);
  }, [selectedRegion, focusPoint, panelPosition, zoomVersion]);

  const projectorPoints = projector
    ? `${projector.source.x},${projector.source.y} ${projector.targetBottom.x},${projector.targetBottom.y} ${projector.targetTop.x},${projector.targetTop.y}`
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
              {focusPoint && (
                <g className="mn-map__focus-point" pointerEvents="none" aria-hidden="true">
                  <circle
                    className="mn-map__focus-point-ring"
                    cx={focusPoint.x}
                    cy={focusPoint.y}
                    r={5.5}
                  />
                  <circle
                    className="mn-map__focus-point-dot"
                    cx={focusPoint.x}
                    cy={focusPoint.y}
                    r={2.4}
                  />
                </g>
              )}
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

      {selectedRegion && projector && (
        <svg className="map-stage__cone" aria-hidden="true">
          <defs>
            <linearGradient
              id="countyConeGradient"
              gradientUnits="userSpaceOnUse"
              x1={projector.source.x}
              y1={projector.source.y}
              x2={projector.targetTop.x}
              y2={(projector.targetTop.y + projector.targetBottom.y) / 2}
            >
              <stop offset="0%" stopColor="rgba(28, 47, 87, 0.28)" />
              <stop offset="100%" stopColor="rgba(112, 196, 229, 0.14)" />
            </linearGradient>
          </defs>
          <polygon className="map-stage__cone-fill" points={projectorPoints} />
          <line
            className="map-stage__cone-edge"
            x1={projector.source.x}
            y1={projector.source.y}
            x2={projector.targetTop.x}
            y2={projector.targetTop.y}
          />
          <line
            className="map-stage__cone-edge"
            x1={projector.source.x}
            y1={projector.source.y}
            x2={projector.targetBottom.x}
            y2={projector.targetBottom.y}
          />
        </svg>
      )}
    </div>
  );
}
