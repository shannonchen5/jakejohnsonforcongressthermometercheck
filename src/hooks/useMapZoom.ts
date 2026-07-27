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
  /** Persist zoom across effect re-binds so region changes never wipe it. */
  const transformRef = useRef<ZoomTransform>(zoomIdentity);

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
        transformRef.current = event.transform;
        select(zoomGroup).attr('transform', event.transform.toString());
        svg.classList.toggle('mn-map--zoomed', event.transform.k > 1);
        onZoom();
      })
      .on('end', () => {
        svg.classList.remove('mn-map--panning');
      });

    const selection = select(svg).call(behavior);
    zoomBehaviorRef.current = behavior;

    // Re-apply the last known transform after (re)binding zoom behavior.
    selection.call(behavior.transform, transformRef.current);
    select(zoomGroup).attr('transform', transformRef.current.toString());
    svg.classList.toggle('mn-map--zoomed', transformRef.current.k > 1);

    function reConstrainAfterResize() {
      const svgEl = svgRef.current;
      if (!svgEl) return;

      const current = zoomTransform(svgEl);
      const viewport = getSvgViewportExtent(svgEl);
      const constrained = constrainMapZoom(current, viewport);
      if (constrained.k !== current.k || constrained.x !== current.x || constrained.y !== current.y) {
        transformRef.current = constrained;
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
    const zoomGroup = zoomGroupRef.current;
    const behavior = zoomBehaviorRef.current;
    if (!svg || !behavior) return;

    transformRef.current = zoomIdentity;
    select(svg).call(behavior.transform, zoomIdentity);
    if (zoomGroup) select(zoomGroup).attr('transform', zoomIdentity.toString());
    svg.classList.remove('mn-map--zoomed', 'mn-map--panning');
  }, [svgRef, zoomGroupRef]);

  return { reset, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM };
}

export type { ZoomTransform };
