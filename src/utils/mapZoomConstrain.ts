import type { ZoomTransform } from 'd3-zoom';
import { MAP_VIEWBOX } from './mapViewBox';

/** Pannable map content bounds in viewBox coordinates (no extra padding). */
export const MAP_TRANSLATE_EXTENT: [[number, number], [number, number]] = [
  [MAP_VIEWBOX.x, MAP_VIEWBOX.y],
  [MAP_VIEWBOX.x + MAP_VIEWBOX.width, MAP_VIEWBOX.y + MAP_VIEWBOX.height],
];

type ViewportExtent = [[number, number], [number, number]];

/**
 * Keeps the SVG viewport overlapping the map bounds at all zoom levels.
 * Matches d3-zoom's default constrain: the visible window may not pan past
 * the translate extent, so some map content always remains on screen.
 */
export function constrainMapZoom(
  transform: ZoomTransform,
  viewport: ViewportExtent,
  translateExtent: ViewportExtent = MAP_TRANSLATE_EXTENT
): ZoomTransform {
  const dx0 = transform.invertX(viewport[0][0]) - translateExtent[0][0];
  const dx1 = transform.invertX(viewport[1][0]) - translateExtent[1][0];
  const dy0 = transform.invertY(viewport[0][1]) - translateExtent[0][1];
  const dy1 = transform.invertY(viewport[1][1]) - translateExtent[1][1];

  return transform.translate(
    dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1),
    dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1)
  );
}

export function getSvgViewportExtent(svg: SVGSVGElement): ViewportExtent {
  return [
    [0, 0],
    [svg.clientWidth, svg.clientHeight],
  ];
}
