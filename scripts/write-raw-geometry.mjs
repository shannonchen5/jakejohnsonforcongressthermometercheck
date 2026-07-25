import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Source of truth: Figma frame "MN Map" (4:16) in srlZ9QY9LdO4yQ2Hdn2SxF
const figmaSource = join(__dirname, 'figma-geometry.json');
const output = join(__dirname, 'raw-geometry.json');

if (!existsSync(figmaSource)) {
  throw new Error('Missing scripts/figma-geometry.json — re-export from Figma frame 4:16');
}

copyFileSync(figmaSource, output);
console.log('Wrote raw-geometry.json from figma-geometry.json');
