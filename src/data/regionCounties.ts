/**
 * Region → county groupings for the thermometer map.
 *
 * Edit this file only — map logic reads from here.
 * - Keys must match "Form Name" values in the Google Sheet exactly.
 * - County names must match mapGeometry exactly (include " County").
 */

export type RegionId =
  | '2026-region1field'
  | '2026-region2field'
  | '2026-region3field'
  | '2026-region4field'
  | '2026-region5field'
  | '2026-region6field';

export const REGION_COUNTIES: Record<RegionId, readonly string[]> = {
  '2026-region1field': [
    'Rock County',
    'Nobles County',
    'Jackson County',
    'Watonwan County',
  ],
  '2026-region2field': ['Brown County', 'Nicollet County', 'Blue Earth County'],
  '2026-region3field': [
    'Martin County',
    'Faribault County',
    'Freeborn County',
    'Mower County',
    'Waseca County',
    'Steele County',
  ],
  '2026-region4field': ['Rice County', 'Wabasha County', 'Goodhue County'],
  '2026-region5field': ['Winona County', 'Fillmore County', 'Houston County'],
  '2026-region6field': ['Dodge County', 'Olmsted County'],
};

/** Short labels for UI (overview, panel, legend). */
export const REGION_LABELS: Record<RegionId, string> = {
  '2026-region1field': 'Region 1',
  '2026-region2field': 'Region 2',
  '2026-region3field': 'Region 3',
  '2026-region4field': 'Region 4',
  '2026-region5field': 'Region 5',
  '2026-region6field': 'Region 6',
};

/** Geographic name shown as a subheader under "Region N". */
export const REGION_SUBTITLES: Record<RegionId, string> = {
  '2026-region1field': 'Western',
  '2026-region2field': 'Northwest',
  '2026-region3field': 'South Central',
  '2026-region4field': 'Northeast',
  '2026-region5field': 'Southeast',
  '2026-region6field': 'Olmsted Dodge',
};

/** Ordered region ids for overview display. */
export const REGION_ORDER: readonly RegionId[] = [
  '2026-region1field',
  '2026-region2field',
  '2026-region3field',
  '2026-region4field',
  '2026-region5field',
  '2026-region6field',
];

/** County name → region form name (first match wins if listed twice). */
export const COUNTY_TO_REGION: Record<string, RegionId> = Object.fromEntries(
  Object.entries(REGION_COUNTIES).flatMap(([region, counties]) =>
    counties.map((county) => [county, region as RegionId] as const)
  )
) as Record<string, RegionId>;

export function getRegionForCounty(countyName: string): RegionId | null {
  return COUNTY_TO_REGION[countyName] ?? null;
}

export function getCountiesForRegion(regionName: string): readonly string[] {
  return REGION_COUNTIES[regionName as RegionId] ?? [];
}

export function getRegionLabel(regionName: string): string {
  return REGION_LABELS[regionName as RegionId] ?? regionName;
}

export function getRegionSubtitle(regionName: string): string {
  return REGION_SUBTITLES[regionName as RegionId] ?? '';
}
