import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function formatCoord(n) {
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
      parts.push('Z');
    }
  }
  return parts.join(' ');
}

const raw = JSON.parse(readFileSync(join(__dirname, 'figma-geometry.json'), 'utf8'));
const mapTs = readFileSync(join(__dirname, '../src/data/mapGeometry.ts'), 'utf8');
const countyMatch = [...mapTs.matchAll(/"name": "([^"]+)",\s*\n\s*"path": "([^"]+)"/g)];
const generated = Object.fromEntries(countyMatch.map((m) => [m[1], m[2]]));

const names = Object.keys(raw);
let mismatches = 0;
for (const name of names) {
  const expected = pathToAbsolute(raw[name].path, raw[name].x, raw[name].y);
  const actual = generated[name];
  if (expected !== actual) {
    mismatches++;
    console.log(`MISMATCH: ${name}`);
  }
}
console.log(`Checked ${names.length} layers, mismatches: ${mismatches}`);
