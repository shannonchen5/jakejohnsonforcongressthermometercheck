import type { CountyGeometry } from '../data/mapGeometry';

type Point = { x: number; y: number };

function parsePathPoints(path: string): Point[] {
  const points: Point[] = [];
  const tokens = path.match(/[MLZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!tokens) return points;

  let i = 0;
  let command = '';
  let cursor: Point = { x: 0, y: 0 };

  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[MLZ]$/i.test(token)) {
      command = token.toUpperCase();
      i += 1;
      continue;
    }

    const x = Number(tokens[i]);
    const y = Number(tokens[i + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) break;

    if (command === 'M' || command === 'L') {
      cursor = { x, y };
      points.push(cursor);
    }

    i += 2;
  }

  return points;
}

/** Polygon centroid from path vertices (shoelace formula). */
export function getCountyCentroid(county: CountyGeometry): Point {
  const points = parsePathPoints(county.path);
  if (points.length < 3) {
    return {
      x: county.x + county.width / 2,
      y: county.y + county.height / 2,
    };
  }

  let area2 = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    area2 += cross;
    cx += (current.x + next.x) * cross;
    cy += (current.y + next.y) * cross;
  }

  if (Math.abs(area2) < 1e-6) {
    return {
      x: county.x + county.width / 2,
      y: county.y + county.height / 2,
    };
  }

  const factor = 1 / (3 * area2);
  return { x: cx * factor, y: cy * factor };
}

export function buildCountyCentroidMap(counties: CountyGeometry[]): Record<string, Point> {
  return Object.fromEntries(counties.map((county) => [county.name, getCountyCentroid(county)]));
}
