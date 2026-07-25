/**
 * Emits map geometry from Figma exports (frame "MN Map" 4:16):
 * 1. Converts layer-local paths to absolute SVG coordinates (x/y offset only)
 * 2. Preserves Figma path data exactly — no snapping, scaling, or integer rounding
 * 3. Reports adjacency from raw Figma bounding boxes
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(__dirname, 'raw-geometry.json'), 'utf8'));

const FRAME = { width: 612, height: 645 };
const TOLERANCE = 4;

/** MN CD-1 county adjacency (geographic ground truth) */
export const ADJACENCY = {
  'Rock County': ['Nobles County'],
  'Nobles County': ['Rock County', 'Jackson County'],
  'Jackson County': ['Nobles County', 'Martin County', 'Watonwan County'],
  'Martin County': ['Jackson County', 'Faribault County', 'Watonwan County'],
  'Faribault County': ['Martin County', 'Freeborn County', 'Blue Earth County', 'Watonwan County'],
  'Freeborn County': ['Faribault County', 'Mower County', 'Waseca County'],
  'Mower County': ['Freeborn County', 'Fillmore County', 'Dodge County'],
  'Fillmore County': ['Mower County', 'Houston County', 'Olmsted County'],
  'Houston County': ['Fillmore County', 'Winona County'],
  'Watonwan County': ['Jackson County', 'Martin County', 'Brown County', 'Blue Earth County'],
  'Blue Earth County': ['Watonwan County', 'Faribault County', 'Waseca County', 'Brown County', 'Nicollet County'],
  'Waseca County': ['Blue Earth County', 'Freeborn County', 'Steele County', 'Rice County', 'Nicollet County'],
  'Steele County': ['Waseca County', 'Rice County', 'Dodge County', 'Olmsted County'],
  'Dodge County': ['Steele County', 'Mower County', 'Olmsted County', 'Goodhue County'],
  'Olmsted County': ['Steele County', 'Dodge County', 'Fillmore County', 'Winona County', 'Wabasha County'],
  'Winona County': ['Houston County', 'Fillmore County', 'Olmsted County', 'Wabasha County'],
  'Brown County': ['Watonwan County', 'Blue Earth County', 'Nicollet County'],
  'Nicollet County': ['Brown County', 'Blue Earth County', 'Waseca County', 'Rice County'],
  'Rice County': ['Waseca County', 'Steele County', 'Goodhue County', 'Nicollet County'],
  'Goodhue County': ['Rice County', 'Dodge County', 'Wabasha County'],
  'Wabasha County': ['Goodhue County', 'Olmsted County', 'Winona County'],
};

const DISTRICT_COUNTIES = Object.keys(ADJACENCY);

function parsePathNumbers(path) {
  const tokens = path.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const segments = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (/^[a-zA-Z]$/.test(cmd)) {
      const nums = [];
      while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
        nums.push(parseFloat(tokens[i++]));
      }
      segments.push({ cmd, nums });
    }
  }
  return segments;
}

function pathToString(segments) {
  return segments
    .map(({ cmd, nums }) => {
      const formatted = nums.map((n) => {
        const r = Math.round(n * 1000) / 1000;
        return Number.isInteger(r) ? String(r) : String(r);
      });
      return formatted.length ? `${cmd} ${formatted.join(' ')}` : cmd;
    })
    .join(' ');
}

function transformPath(path, scaleX, scaleY, snapLeft, snapTop, edgeSnaps) {
  const segments = parsePathNumbers(path);
  for (const seg of segments) {
    const cmd = seg.cmd.toUpperCase();
    for (let j = 0; j < seg.nums.length; j++) {
      const isX = j % 2 === 0;
      if (cmd === 'H') {
        seg.nums[j] *= scaleX;
        for (const snap of edgeSnaps) {
          if (snap.axis === 'x' && Math.abs(seg.nums[j] - snap.oldCoord) < TOLERANCE) {
            seg.nums[j] = snap.newCoord;
          }
        }
      } else if (cmd === 'V') {
        seg.nums[j] *= scaleY;
        for (const snap of edgeSnaps) {
          if (snap.axis === 'y' && Math.abs(seg.nums[j] - snap.oldCoord) < TOLERANCE) {
            seg.nums[j] = snap.newCoord;
          }
        }
      } else if (isX) {
        let val = seg.nums[j] * scaleX;
        for (const snap of edgeSnaps) {
          if (snap.axis === 'x' && Math.abs(seg.nums[j] - snap.oldCoord) < TOLERANCE) {
            val = snap.newCoord;
          }
        }
        seg.nums[j] = val;
      } else {
        let val = seg.nums[j] * scaleY;
        for (const snap of edgeSnaps) {
          if (snap.axis === 'y' && Math.abs(seg.nums[j] - snap.oldCoord) < TOLERANCE) {
            val = snap.newCoord;
          }
        }
        seg.nums[j] = val;
      }
    }
  }
  return pathToString(segments);
}

function bbox(county) {
  return {
    left: county.x,
    top: county.y,
    right: county.x + county.width,
    bottom: county.y + county.height,
  };
}

function detectAdjacency(counties) {
  const names = Object.keys(counties);
  const adj = Object.fromEntries(names.map((n) => [n, new Set()]));
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = bbox(counties[names[i]]);
      const b = bbox(counties[names[j]]);
      const verticalShared =
        Math.abs(a.right - b.left) <= TOLERANCE || Math.abs(b.right - a.left) <= TOLERANCE;
      const horizontalShared =
        Math.abs(a.bottom - b.top) <= TOLERANCE || Math.abs(b.bottom - a.top) <= TOLERANCE;
      const verticalOverlap = a.top < b.bottom - TOLERANCE && b.top < a.bottom - TOLERANCE;
      const horizontalOverlap = a.left < b.right - TOLERANCE && b.left < a.right - TOLERANCE;
      if ((verticalShared && verticalOverlap) || (horizontalShared && horizontalOverlap)) {
        adj[names[i]].add(names[j]);
        adj[names[j]].add(names[i]);
      }
    }
  }
  return Object.fromEntries(
    Object.entries(adj).map(([k, v]) => [k, [...v].sort()])
  );
}

function snapCounties(counties) {
  const result = structuredClone(counties);
  const names = Object.keys(result);
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 50) {
    changed = false;
    iterations++;
    for (const name of names) {
      const a = result[name];
      const aBox = bbox(a);
      for (const neighbor of ADJACENCY[name] ?? []) {
        if (!result[neighbor]) continue;
        const b = result[neighbor];
        const bBox = bbox(b);

        // Snap vertical shared edge
        if (
          Math.abs(aBox.right - bBox.left) <= TOLERANCE &&
          aBox.top < bBox.bottom - 1 &&
          bBox.top < aBox.bottom - 1
        ) {
          const boundary = Math.round((aBox.right + bBox.left) / 2);
          if (boundary !== aBox.right || bBox.left !== boundary) {
            const oldAWidth = a.width;
            const oldBWidth = b.width;
            a.width = boundary - a.x;
            b.x = boundary;
            b.width = bBox.right - boundary;
            a.path = transformPath(a.path, a.width / oldAWidth, 1, 0, 0, [
              { axis: 'x', oldCoord: oldAWidth, newCoord: a.width },
            ]);
            b.path = transformPath(b.path, b.width / oldBWidth, 1, 0, 0, [
              { axis: 'x', oldCoord: 0, newCoord: 0 },
            ]);
            changed = true;
          }
        }

        if (
          Math.abs(bBox.right - aBox.left) <= TOLERANCE &&
          aBox.top < bBox.bottom - 1 &&
          bBox.top < aBox.bottom - 1
        ) {
          const boundary = Math.round((bBox.right + aBox.left) / 2);
          if (boundary !== aBox.left || bBox.right !== boundary) {
            const oldAWidth = a.width;
            const oldBWidth = b.width;
            a.x = boundary;
            a.width = aBox.right - boundary;
            b.width = boundary - b.x;
            a.path = transformPath(a.path, a.width / oldAWidth, 1, 0, 0, [
              { axis: 'x', oldCoord: 0, newCoord: 0 },
            ]);
            b.path = transformPath(b.path, b.width / oldBWidth, 1, 0, 0, [
              { axis: 'x', oldCoord: oldBWidth, newCoord: b.width },
            ]);
            changed = true;
          }
        }

        // Snap horizontal shared edge
        if (
          Math.abs(aBox.bottom - bBox.top) <= TOLERANCE &&
          aBox.left < bBox.right - 1 &&
          bBox.left < aBox.right - 1
        ) {
          const boundary = Math.round((aBox.bottom + bBox.top) / 2);
          if (boundary !== aBox.bottom || bBox.top !== boundary) {
            const oldAHeight = a.height;
            const oldBHeight = b.height;
            a.height = boundary - a.y;
            b.y = boundary;
            b.height = bBox.bottom - boundary;
            a.path = transformPath(a.path, 1, a.height / oldAHeight, 0, 0, [
              { axis: 'y', oldCoord: oldAHeight, newCoord: a.height },
            ]);
            b.path = transformPath(b.path, 1, b.height / oldBHeight, 0, 0, [
              { axis: 'y', oldCoord: 0, newCoord: 0 },
            ]);
            changed = true;
          }
        }

        if (
          Math.abs(bBox.bottom - aBox.top) <= TOLERANCE &&
          aBox.left < bBox.right - 1 &&
          bBox.left < aBox.right - 1
        ) {
          const boundary = Math.round((bBox.bottom + aBox.top) / 2);
          if (boundary !== aBox.top || bBox.bottom !== boundary) {
            const oldAHeight = a.height;
            const oldBHeight = b.height;
            a.y = boundary;
            a.height = aBox.bottom - boundary;
            b.height = boundary - b.y;
            a.path = transformPath(a.path, 1, a.height / oldAHeight, 0, 0, [
              { axis: 'y', oldCoord: 0, newCoord: 0 },
            ]);
            b.path = transformPath(b.path, 1, b.height / oldBHeight, 0, 0, [
              { axis: 'y', oldCoord: oldBHeight, newCoord: b.height },
            ]);
            changed = true;
          }
        }
      }
    }
  }
  return result;
}

function formatCoord(n) {
  // Preserve Figma sub-pixel coordinates — no integer rounding
  return String(n);
}

function pathToAbsolute(path, tx, ty) {
  const tokens = path.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  const parts = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (!/^[a-zA-Z]$/.test(cmd)) continue;
    const upper = cmd.toUpperCase();
    if (upper === 'M') {
      cx = parseFloat(tokens[i++]);
      cy = parseFloat(tokens[i++]);
      startX = cx;
      startY = cy;
      parts.push(`M ${formatCoord(cx + tx)} ${formatCoord(cy + ty)}`);
    } else if (upper === 'L') {
      cx = parseFloat(tokens[i++]);
      cy = parseFloat(tokens[i++]);
      parts.push(`L ${formatCoord(cx + tx)} ${formatCoord(cy + ty)}`);
    } else if (upper === 'H') {
      cx = parseFloat(tokens[i++]);
      parts.push(`L ${formatCoord(cx + tx)} ${formatCoord(cy + ty)}`);
    } else if (upper === 'V') {
      cy = parseFloat(tokens[i++]);
      parts.push(`L ${formatCoord(cx + tx)} ${formatCoord(cy + ty)}`);
    } else if (upper === 'Z') {
      cx = startX;
      cy = startY;
      parts.push('Z');
    }
  }
  return parts.join(' ');
}

function toAbsolutePath(county) {
  return pathToAbsolute(county.path, county.x, county.y);
}


function parseAbsolutePathPoints(path) {
  const tokens = path.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const points = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M' || cmd === 'L') {
      points.push([parseFloat(tokens[i++]), parseFloat(tokens[i++])]);
    }
  }
  return points;
}

function pointsToPath(points) {
  if (!points.length) return '';
  const fmt = (n) => String(Math.round(n));
  const parts = [`M ${fmt(points[0][0])} ${fmt(points[0][1])}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${fmt(points[i][0])} ${fmt(points[i][1])}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

function bboxFromPoints(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function dedupePoints(points) {
  if (!points.length) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    const [px, py] = out[out.length - 1];
    if (x !== px || y !== py) out.push([x, y]);
  }
  if (out.length > 1) {
    const [fx, fy] = out[0];
    const [lx, ly] = out[out.length - 1];
    if (fx === lx && fy === ly) out.pop();
  }
  return out;
}

function quantizePoints(points) {
  return points.map(([x, y]) => [Math.round(x), Math.round(y)]);
}

function axisSegments(points, axis) {
  const other = axis === 0 ? 1 : 0;
  const segments = [];
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    if (p1[axis] === p2[axis] && p1[other] !== p2[other]) {
      segments.push({
        axis,
        fixed: p1[axis],
        start: Math.min(p1[other], p2[other]),
        end: Math.max(p1[other], p2[other]),
      });
    }
  }
  return segments;
}

function updateAxisCoord(points, axis, fromValues, toValue, rangeStart, rangeEnd) {
  const other = axis === 0 ? 1 : 0;
  for (let i = 0; i < points.length; i++) {
    const inRange = points[i][other] >= rangeStart && points[i][other] <= rangeEnd;
    if (!inRange) continue;
    for (const from of fromValues) {
      if (points[i][axis] === from) {
        points[i][axis] = toValue;
      }
    }
  }
}

function snapSharedAxisSegments(pointsA, pointsB, fixedAxisIndex, tolerance) {
  const segsA = axisSegments(pointsA, fixedAxisIndex);
  const segsB = axisSegments(pointsB, fixedAxisIndex);
  for (const a of segsA) {
    for (const b of segsB) {
      const delta = Math.abs(a.fixed - b.fixed);
      if (delta === 0 || delta > tolerance) continue;
      const overlapStart = Math.max(a.start, b.start);
      const overlapEnd = Math.min(a.end, b.end);
      if (overlapEnd - overlapStart < 2) continue;
      const merged = Math.round((a.fixed + b.fixed) / 2);
      updateAxisCoord(pointsA, fixedAxisIndex, [a.fixed], merged, overlapStart, overlapEnd);
      updateAxisCoord(pointsB, fixedAxisIndex, [b.fixed], merged, overlapStart, overlapEnd);
    }
  }
}

/** Integer snap + shared edge alignment only — preserves original stair-step paths. */
function gentlePixelSnap(countyPaths, adjacency) {
  for (const name of Object.keys(countyPaths)) {
    countyPaths[name] = dedupePoints(quantizePoints(countyPaths[name]));
  }

  for (let iteration = 0; iteration < 12; iteration++) {
    const before = JSON.stringify(countyPaths);

    for (const [name, neighbors] of Object.entries(adjacency)) {
      for (const neighbor of neighbors) {
        if (!countyPaths[neighbor]) continue;
        snapSharedAxisSegments(countyPaths[name], countyPaths[neighbor], 0, 2);
        snapSharedAxisSegments(countyPaths[name], countyPaths[neighbor], 1, 2);
      }
    }

    for (const name of Object.keys(countyPaths)) {
      countyPaths[name] = dedupePoints(quantizePoints(countyPaths[name]));
    }

    if (JSON.stringify(countyPaths) === before) break;
  }
}

function pointOnSegment(px, py, x1, y1, x2, y2, tol = 1) {
  if (x1 === x2 && Math.abs(px - x1) <= tol) {
    return py >= Math.min(y1, y2) - tol && py <= Math.max(y1, y2) + tol;
  }
  if (y1 === y2 && Math.abs(py - y1) <= tol) {
    return px >= Math.min(x1, x2) - tol && px <= Math.max(x1, x2) + tol;
  }
  return false;
}

function isSharedWithNeighbor(name, x, y, countyPaths, adjacency, tol = 2) {
  for (const neighbor of adjacency[name] ?? []) {
    const npts = countyPaths[neighbor];
    if (!npts) continue;
    for (let i = 0; i < npts.length; i++) {
      const [nx, ny] = npts[i];
      if (Math.abs(nx - x) <= tol && Math.abs(ny - y) <= tol) return true;
      const [nx2, ny2] = npts[(i + 1) % npts.length];
      if (pointOnSegment(x, y, nx, ny, nx2, ny2, tol)) return true;
    }
  }
  return false;
}

function eastXAt(outlinePoints, y) {
  let maxX = -Infinity;
  for (let i = 0; i < outlinePoints.length; i++) {
    const [x1, y1] = outlinePoints[i];
    const [x2, y2] = outlinePoints[(i + 1) % outlinePoints.length];
    if (y1 === y2 && y === y1) maxX = Math.max(maxX, x1, x2);
    else if (x1 === x2 && y >= Math.min(y1, y2) && y <= Math.max(y1, y2)) maxX = Math.max(maxX, x1);
  }
  return maxX;
}

function southYAt(outlinePoints, x) {
  let maxY = -Infinity;
  for (let i = 0; i < outlinePoints.length; i++) {
    const [x1, y1] = outlinePoints[i];
    const [x2, y2] = outlinePoints[(i + 1) % outlinePoints.length];
    if (x1 === x2 && x === x1) maxY = Math.max(maxY, y1, y2);
    else if (y1 === y2 && x >= Math.min(x1, x2) && x <= Math.max(x1, x2)) maxY = Math.max(maxY, y1);
  }
  return maxY;
}

function isOnOutlinePolyline(x, y, outlinePoints, tol = 0) {
  for (let i = 0; i < outlinePoints.length; i++) {
    const [ox, oy] = outlinePoints[i];
    if (Math.abs(ox - x) <= tol && Math.abs(oy - y) <= tol) return true;
  }
  for (let i = 0; i < outlinePoints.length; i++) {
    const [x1, y1] = outlinePoints[i];
    const [x2, y2] = outlinePoints[(i + 1) % outlinePoints.length];
    if (pointOnSegment(x, y, x1, y1, x2, y2, tol)) return true;
  }
  return false;
}

function dist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function extractEastBoundaryChain(outlinePoints) {
  let startIdx = -1;
  for (let j = 0; j < outlinePoints.length; j++) {
    const [x, y] = outlinePoints[j];
    if (x === 409 && y === 545) {
      startIdx = j;
      break;
    }
  }
  if (startIdx === -1) {
    for (let j = 0; j < outlinePoints.length; j++) {
      const [x, y] = outlinePoints[j];
      const [nx] = outlinePoints[(j + 1) % outlinePoints.length];
      if (x >= 404 && x <= 410 && y >= 536 && y <= 545 && nx >= x) {
        startIdx = j;
        break;
      }
    }
  }
  if (startIdx === -1) return [];

  const chain = [[...outlinePoints[startIdx]]];
  let idx = startIdx;
  for (let steps = 0; steps < outlinePoints.length + 5; steps++) {
    idx = (idx + 1) % outlinePoints.length;
    const pt = outlinePoints[idx];
    chain.push([...pt]);
    if (pt[0] >= 454 && pt[1] >= 617) break;
  }
  return dedupePoints(chain);
}

function extractSouthBoundaryChain(outlinePoints) {
  let startIdx = outlinePoints.findIndex(([x, y]) => x === 454 && y === 618);
  if (startIdx === -1) {
    startIdx = outlinePoints.findIndex(([_, y]) => y >= 617);
  }
  if (startIdx === -1) return [];

  const chain = [[...outlinePoints[startIdx]]];
  let idx = startIdx;
  for (let steps = 0; steps < outlinePoints.length; steps++) {
    idx = (idx + 1) % outlinePoints.length;
    chain.push([...outlinePoints[idx]]);
    const [x, y] = outlinePoints[idx];
    if (y >= 617 && x <= 92) break;
  }
  return dedupePoints(chain);
}

function sliceChainByY(chain, yMin, yMax) {
  let startIdx = chain.findIndex(([_, y]) => y >= yMin);
  const endIdx = chain.findLastIndex(([_, y]) => y <= yMax);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return chain.filter(([_, y]) => y >= yMin && y <= yMax).map((p) => [...p]);
  }
  if (startIdx > 0) startIdx -= 1;
  return dedupePoints(chain.slice(startIdx, endIdx + 1).map((p) => [...p]));
}

function sliceChainByX(chain, xMin, xMax) {
  return dedupePoints(chain.filter(([x]) => x >= xMin && x <= xMax));
}

function orientChain(chain, prev, next) {
  if (chain.length < 2 || !prev || !next) return chain;
  const forwardCost = dist(prev, chain[0]) + dist(chain[chain.length - 1], next);
  const reverseCost = dist(prev, chain[chain.length - 1]) + dist(chain[0], next);
  return reverseCost < forwardCost ? [...chain].reverse() : chain;
}

function countyMaxXAtY(points, y) {
  let maxX = -Infinity;
  for (const [x, py] of points) {
    if (py === y) maxX = Math.max(maxX, x);
  }
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    if (y1 === y2 && y1 === y) maxX = Math.max(maxX, x1, x2);
    if (x1 === x2 && y >= Math.min(y1, y2) && y <= Math.max(y1, y2)) maxX = Math.max(maxX, x1);
  }
  return maxX;
}

function countyMaxYAtX(points, x) {
  let maxY = -Infinity;
  for (const [px, y] of points) {
    if (px === x) maxY = Math.max(maxY, y);
  }
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    if (x1 === x2 && x1 === x) maxY = Math.max(maxY, y1, y2);
    if (y1 === y2 && x >= Math.min(x1, x2) && x <= Math.max(x1, x2)) maxY = Math.max(maxY, y1);
  }
  return maxY;
}

function isEdgeSharedWithNeighbor(name, x1, y1, x2, y2, countyPaths, adjacency, tol = 1) {
  for (const neighbor of adjacency[name] ?? []) {
    const npts = countyPaths[neighbor];
    if (!npts) continue;
    for (let i = 0; i < npts.length; i++) {
      const [nx1, ny1] = npts[i];
      const [nx2, ny2] = npts[(i + 1) % npts.length];
      const sameSeg =
        Math.abs(x1 - nx1) <= tol &&
        Math.abs(y1 - ny1) <= tol &&
        Math.abs(x2 - nx2) <= tol &&
        Math.abs(y2 - ny2) <= tol;
      const revSeg =
        Math.abs(x1 - nx2) <= tol &&
        Math.abs(y1 - ny2) <= tol &&
        Math.abs(x2 - nx1) <= tol &&
        Math.abs(y2 - ny1) <= tol;
      if (sameSeg || revSeg) return true;
    }
  }
  return false;
}

function classifyExteriorEdge(name, x1, y1, x2, y2, points, outlinePoints, adjacency, countyPaths) {
  if (isEdgeSharedWithNeighbor(name, x1, y1, x2, y2, countyPaths, adjacency, 1)) return null;
  if (isOnOutlinePolyline(x1, y1, outlinePoints, 0) && isOnOutlinePolyline(x2, y2, outlinePoints, 0)) {
    return 'outline';
  }

  const midY = Math.round((y1 + y2) / 2);
  const midX = Math.round((x1 + x2) / 2);
  const ex = eastXAt(outlinePoints, midY);
  const sy = southYAt(outlinePoints, midX);
  const edgeMaxX = Math.max(x1, x2);
  const edgeMaxY = Math.max(y1, y2);
  const countyEast = countyMaxXAtY(points, midY);
  const countySouth = countyMaxYAtX(points, midX);

  if (Number.isFinite(ex) && edgeMaxX >= countyEast - 1 && edgeMaxX >= ex - 50) return 'east';
  if (Number.isFinite(sy) && edgeMaxY >= countySouth - 1 && edgeMaxY >= sy - 5) return 'south';
  return null;
}

function isInEastBand(name, x, y, points, outlinePoints, adjacency, countyPaths) {
  if (isOnOutlinePolyline(x, y, outlinePoints, 0)) return true;
  const ex = eastXAt(outlinePoints, y);
  if (!Number.isFinite(ex) || x < ex - 8) return false;
  if (isSharedWithNeighbor(name, x, y, countyPaths, adjacency, 1)) return x >= ex - 2;
  return true;
}

function isInSouthBand(name, x, y, outlinePoints, adjacency, countyPaths) {
  if (isOnOutlinePolyline(x, y, outlinePoints, 0)) return true;
  const sy = southYAt(outlinePoints, x);
  if (!Number.isFinite(sy) || y < sy - 3) return false;
  if (isSharedWithNeighbor(name, x, y, countyPaths, adjacency, 1)) return y >= sy - 2;
  return true;
}

function snapOutlineCorners(countyPaths, eastChain) {
  const corner = eastChain.find(([x, y]) => x === 449 && y === 586) ?? [449, 586];
  for (const name of ['Winona County', 'Houston County']) {
    const pts = countyPaths[name];
    if (!pts) continue;
    countyPaths[name] = dedupePoints(
      pts.map(([x, y]) => {
        if ((x === 445 || x === 446) && y === 585) return [...corner];
        if (x === 420 && y === 617) return [420, 618];
        return [x, y];
      })
    );
  }

  if (countyPaths['Winona County']) {
    let pts = countyPaths['Winona County'];
    const idx = pts.findIndex(([x, y]) => x === 396 && y === 585);
    if (idx !== -1 && !pts.some(([x, y]) => x === 406 && y === 585)) {
      pts = dedupePoints([
        ...pts.slice(0, idx + 1),
        [406, 585],
        [420, 585],
        ...pts.slice(idx + 1),
      ]);
    }
    countyPaths['Winona County'] = pts;
  }
}

function rebuildWithOutlineChain(name, points, outlinePoints, adjacency, countyPaths, side, chain) {
  if (points.length < 3 || chain.length < 2) return points;

  const inBand =
    side === 'east'
      ? (x, y) => isInEastBand(name, x, y, points, outlinePoints, adjacency, countyPaths)
      : (x, y) => isInSouthBand(name, x, y, outlinePoints, adjacency, countyPaths);

  let spanMin = Infinity;
  let spanMax = -Infinity;
  let touchesBand = false;
  for (const [x, y] of points) {
    if (!inBand(x, y)) continue;
    touchesBand = true;
    if (side === 'east') {
      spanMin = Math.min(spanMin, y);
      spanMax = Math.max(spanMax, y);
    } else {
      spanMin = Math.min(spanMin, x);
      spanMax = Math.max(spanMax, x);
    }
  }
  if (!touchesBand) return points;

  const pad = side === 'east' ? 5 : 1;
  const chainSlice =
    side === 'east'
      ? sliceChainByY(chain, spanMin - pad, spanMax)
      : sliceChainByX(chain, spanMin, spanMax + pad);
  if (chainSlice.length < 2) return points;

  const result = [];
  let skipping = false;
  let inserted = false;

  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    if (inBand(x, y)) {
      if (!skipping) skipping = true;
      continue;
    }

    if (skipping && !inserted) {
      const oriented = orientChain(
        chainSlice.map((p) => [...p]),
        result[result.length - 1],
        [x, y]
      );
      for (const pt of oriented) {
        const last = result[result.length - 1];
        if (!last || last[0] !== pt[0] || last[1] !== pt[1]) result.push([...pt]);
      }
      inserted = true;
      skipping = false;
    }

    result.push([x, y]);
  }

  if (skipping && !inserted && result.length) {
    const oriented = orientChain(
      chainSlice.map((p) => [...p]),
      result[result.length - 1],
      result[0]
    );
    for (const pt of oriented) {
      const last = result[result.length - 1];
      if (!last || last[0] !== pt[0] || last[1] !== pt[1]) result.push([...pt]);
    }
  }

  return dedupePoints(result);
}

function removeCollinearInterior(points, outlinePoints) {
  if (points.length < 4) return points;
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const collinearH = prev[1] === curr[1] && curr[1] === next[1];
    const collinearV = prev[0] === curr[0] && curr[0] === next[0];
    if ((collinearH || collinearV) && !isOnOutlinePolyline(curr[0], curr[1], outlinePoints, 0)) {
      continue;
    }
    result.push([...curr]);
  }
  return dedupePoints(result);
}

function alignCountyPolygonToOutline(name, points, outlinePoints, adjacency, countyPaths, eastChain, southChain) {
  let next = rebuildWithOutlineChain(name, points, outlinePoints, adjacency, countyPaths, 'east', eastChain);
  next = rebuildWithOutlineChain(name, next, outlinePoints, adjacency, countyPaths, 'south', southChain);
  next = removeCollinearInterior(next, outlinePoints);
  return next;
}

/** Replace exterior county edges with exact Minnesota outline geometry. */
function alignCountyBoundariesToOutline(countyPaths, outlinePoints, adjacency) {
  const eastChain = extractEastBoundaryChain(outlinePoints);
  const southChain = extractSouthBoundaryChain(outlinePoints);

  for (const name of Object.keys(countyPaths)) {
    countyPaths[name] = alignCountyPolygonToOutline(
      name,
      countyPaths[name],
      outlinePoints,
      adjacency,
      countyPaths,
      eastChain,
      southChain
    );
  }

  snapOutlineCorners(countyPaths, eastChain);

  if (countyPaths['Houston County']) {
    countyPaths['Houston County'] = rebuildWithOutlineChain(
      'Houston County',
      countyPaths['Houston County'],
      outlinePoints,
      adjacency,
      countyPaths,
      'south',
      southChain
    );
  }
}

function geometryFromPoints(name, points) {
  const box = bboxFromPoints(points);
  return {
    name,
    path: pointsToPath(points),
    x: box.minX,
    y: box.minY,
    width: box.width,
    height: box.height,
  };
}

function figmaToGeometry(name, entry) {
  const absolutePath = toAbsolutePath(entry);
  const points = parseAbsolutePathPoints(absolutePath);
  const box = bboxFromPoints(points);
  return {
    name,
    path: absolutePath,
    x: box.minX,
    y: box.minY,
    width: box.width,
    height: box.height,
  };
}

const minnesota = raw['Minnesota'];
const districtRaw = Object.fromEntries(
  DISTRICT_COUNTIES.map((name) => [name, raw[name]]).filter(([, v]) => v)
);

const detected = detectAdjacency(districtRaw);

const counties = Object.fromEntries(
  DISTRICT_COUNTIES.map((name) => [name, figmaToGeometry(name, districtRaw[name])])
);

const minnesotaAbsolute = figmaToGeometry('Minnesota', minnesota);

const output = `// Auto-generated by scripts/normalize-geometry.mjs — do not edit manually
export const MAP_FRAME = ${JSON.stringify(FRAME)} as const;

export const ADJACENCY: Record<string, string[]> = ${JSON.stringify(ADJACENCY, null, 2)};

export const DETECTED_ADJACENCY: Record<string, string[]> = ${JSON.stringify(detected, null, 2)};

export type CountyGeometry = {
  name: string;
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const MINNESOTA_OUTLINE: CountyGeometry = ${JSON.stringify(minnesotaAbsolute, null, 2)};

export const DISTRICT_COUNTIES: CountyGeometry[] = ${JSON.stringify(Object.values(counties), null, 2)};

export const DISTRICT_COUNTY_NAMES = ${JSON.stringify(DISTRICT_COUNTIES)} as const;
`;

writeFileSync(join(__dirname, '../src/data/mapGeometry.ts'), output);
console.log('Generated src/data/mapGeometry.ts');
console.log('District counties:', DISTRICT_COUNTIES.length);
