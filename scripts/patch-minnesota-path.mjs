/**
 * Patches Minnesota outline in figma-geometry.json with vectorPaths export from Figma.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const chunkDir = join(__dirname, 'minnesota-chunks');
const chunkFiles = readdirSync(chunkDir)
  .filter((f) => /^\d+\.txt$/.test(f))
  .sort((a, b) => Number(a) - Number(b));

const path = chunkFiles
  .map((f) => readFileSync(join(chunkDir, f), 'utf8'))
  .join('');

if (path.length !== 28622) {
  throw new Error(`Expected Minnesota path length 28622, got ${path.length}`);
}

const figmaPath = join(__dirname, 'figma-geometry.json');
const figma = JSON.parse(readFileSync(figmaPath, 'utf8'));
figma.Minnesota.path = path;
writeFileSync(figmaPath, JSON.stringify(figma, null, 2) + '\n');
console.log(`Patched Minnesota vector path (${path.length} chars)`);
