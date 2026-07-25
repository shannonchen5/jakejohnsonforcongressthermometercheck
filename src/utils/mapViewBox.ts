import { MAP_FRAME } from '../data/mapGeometry';

/** Full Minnesota map frame — shows the entire state outline. */
export const MAP_VIEWBOX = {
  x: 0,
  y: 0,
  width: MAP_FRAME.width,
  height: MAP_FRAME.height,
} as const;

/** Y coordinate of Minnesota's flat top border in viewBox space. */
export const MN_FLAT_TOP_Y = 65.81287384033203;

/** Eastern bay on the map border where county detail panels appear. */
export const PANEL_BAY = {
  x: 428,
  xMargin: 12,
  yMin: 490,
  yMax: 535,
} as const;

function viewBoxPointToSvgPixels(
  vbX: number,
  vbY: number,
  svg: SVGSVGElement,
  zoomGroup: SVGGElement | null
) {
  const point = svg.createSVGPoint();
  point.x = vbX;
  point.y = vbY;

  const matrix = zoomGroup?.getCTM() ?? svg.getCTM();
  if (!matrix) {
    return { x: 0, y: 0 };
  }

  return point.matrixTransform(matrix);
}

export function viewBoxToPixel(
  vbX: number,
  vbY: number,
  svg: SVGSVGElement,
  zoomGroup: SVGGElement | null,
  stageRect: DOMRect
) {
  const svgRect = svg.getBoundingClientRect();
  const local = viewBoxPointToSvgPixels(vbX, vbY, svg, zoomGroup);

  return {
    x: svgRect.left - stageRect.left + local.x,
    y: svgRect.top - stageRect.top + local.y,
  };
}

export function viewBoxToMapLocal(
  vbX: number,
  vbY: number,
  svg: SVGSVGElement,
  zoomGroup: SVGGElement | null
) {
  return viewBoxPointToSvgPixels(vbX, vbY, svg, zoomGroup);
}
