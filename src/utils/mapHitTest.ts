function getEventClientPoint(event: Event): { x: number; y: number } | null {
  if (event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  }

  if (event instanceof TouchEvent && event.touches.length > 0) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  return null;
}

export function isPointerOverMinnesota(
  event: Event,
  svg: SVGSVGElement,
  outlinePath: SVGPathElement
): boolean {
  const point = getEventClientPoint(event);
  if (!point) return false;

  const svgRect = svg.getBoundingClientRect();
  if (
    point.x < svgRect.left ||
    point.x > svgRect.right ||
    point.y < svgRect.top ||
    point.y > svgRect.bottom
  ) {
    return false;
  }

  if (event.target instanceof Element && event.target.closest('.mn-map__county')) {
    return true;
  }

  const screenCTM = outlinePath.getScreenCTM();
  if (!screenCTM) return false;

  const svgPoint = svg.createSVGPoint();
  svgPoint.x = point.x;
  svgPoint.y = point.y;
  const local = svgPoint.matrixTransform(screenCTM.inverse());

  return outlinePath.isPointInFill(local);
}
