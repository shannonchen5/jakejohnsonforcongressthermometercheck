import { zoom, zoomIdentity, zoomTransform, type ZoomTransform } from 'd3-zoom';
import { select } from 'd3-selection';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  constrainMapZoom,
  getSvgViewportExtent,
  MAP_TRANSLATE_EXTENT,
} from '../utils/mapZoomConstrain';

const MIN_ZOOM = 1;
const MAX_ZOOM = 10;

type UseMapZoomOptions = {
  svgRef: RefObject<SVGSVGElement | null>;
  zoomGroupRef: RefObject<SVGGElement | null>;
  onZoom: () => void;
  isPointerOverMap?: (event: Event) => boolean;
};

function defaultZoomFilter(event: Event) {
  const mouseEvent = event as MouseEvent;
  return (!mouseEvent.ctrlKey || event.type === 'wheel') && !mouseEvent.button;
}

export function useMapZoom({ svgRef, zoomGroupRef, onZoom, isPointerOverMap }: UseMapZoomOptions) {
  const zoomBehaviorRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const zoomGroup = zoomGroupRef.current;
    if (!svg || !zoomGroup) return;

    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .translateExtent(MAP_TRANSLATE_EXTENT)
      .constrain(constrainMapZoom)
      .filter((event) => {
        if (!defaultZoomFilter(event)) return false;
        if (!isPointerOverMap) return true;
        return isPointerOverMap(event);
      })
      .clickDistance(4)
      .on('start', (event) => {
        const source = event.sourceEvent;
        if (
          source &&
          (source.type === 'mousedown' ||
            source.type === 'touchstart' ||
            source.type === 'pointerdown')
        ) {
          svg.classList.add('mn-map--panning');
        }
      })
      .on('zoom', (event) => {
        select(zoomGroup).attr('transform', event.transform.toString());
        svg.classList.toggle('mn-map--zoomed', event.transform.k > 1);
        onZoom();
      })
      .on('end', () => {
        svg.classList.remove('mn-map--panning');
      });

    const selection = select(svg).call(behavior);
    zoomBehaviorRef.current = behavior;

    function reConstrainAfterResize() {
      const svgEl = svgRef.current;
      if (!svgEl) return;

      const current = zoomTransform(svgEl);
      const viewport = getSvgViewportExtent(svgEl);
      const constrained = constrainMapZoom(current, viewport);
      if (constrained.k !== current.k || constrained.x !== current.x || constrained.y !== current.y) {
        selection.call(behavior.transform, constrained);
      }
    }

    const resizeObserver = new ResizeObserver(reConstrainAfterResize);
    resizeObserver.observe(svg);

    return () => {
      resizeObserver.disconnect();
      selection.on('.zoom', null);
    };
  }, [svgRef, zoomGroupRef, onZoom, isPointerOverMap]);

  const reset = useCallback(() => {
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    if (!svg || !behavior) return;

    select(svg).call(behavior.transform, zoomIdentity);
    svg.classList.remove('mn-map--zoomed', 'mn-map--panning');
  }, [svgRef]);

  return { reset, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM };
}

export type { ZoomTransform };
