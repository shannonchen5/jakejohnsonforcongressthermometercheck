import type { RegionId } from '../data/regionCounties';
import { REGION_ORDER } from '../data/regionCounties';
import { clampFillPercent } from './progressBand';

type Hsl = { h: number; s: number; l: number };

/**
 * Distinct pastel hues per region. Map fill starts light and darkens toward
 * the saturated/deep end of the same hue as % of goal rises.
 */
const REGION_HUES: Record<RegionId, Hsl> = {
  '2026-region1field': { h: 200, s: 55, l: 78 }, // soft blue
  '2026-region2field': { h: 340, s: 50, l: 80 }, // soft rose
  '2026-region3field': { h: 145, s: 42, l: 78 }, // soft mint
  '2026-region4field': { h: 45, s: 65, l: 80 }, // soft gold
  '2026-region5field': { h: 280, s: 40, l: 80 }, // soft lavender
  '2026-region6field': { h: 18, s: 55, l: 80 }, // soft peach
};

const PENDING_LIGHTNESS = 86;
const MAX_PROGRESS_LIGHTNESS = 38;
const PENDING_SATURATION_FACTOR = 0.55;

function hslToCss({ h, s, l }: Hsl): string {
  return `hsl(${h} ${s}% ${l}%)`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Same hue for every county in a region. Light pastel at 0% / pending;
 * darker as percentOfGoal approaches 100%.
 */
export function getRegionProgressColor(
  regionId: string,
  percentOfGoal: number | null | undefined
): string {
  const base = REGION_HUES[regionId as RegionId];
  if (!base) return 'hsl(210 20% 82%)';

  const fill = clampFillPercent(percentOfGoal);
  const t = fill / 100;
  const pending = percentOfGoal == null || !Number.isFinite(percentOfGoal);

  if (pending) {
    return hslToCss({
      h: base.h,
      s: base.s * PENDING_SATURATION_FACTOR,
      l: PENDING_LIGHTNESS,
    });
  }

  return hslToCss({
    h: base.h,
    s: lerp(base.s * 0.7, Math.min(75, base.s + 18), t),
    l: lerp(base.l, MAX_PROGRESS_LIGHTNESS, t),
  });
}

/** Pastel (0%) swatch for legend / overview accents. */
export function getRegionBaseColor(regionId: string): string {
  return getRegionProgressColor(regionId, 0);
}

/** Darker (100%) swatch for legend contrast. */
export function getRegionFullColor(regionId: string): string {
  return getRegionProgressColor(regionId, 100);
}

export function getRegionLegendItems() {
  return REGION_ORDER.map((id) => ({
    id,
    pastel: getRegionBaseColor(id),
    full: getRegionFullColor(id),
  }));
}
