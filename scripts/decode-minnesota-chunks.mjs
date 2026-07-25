import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const b64Dir = join(__dirname, 'minnesota-b64');

for (let i = 0; i < 4; i++) {
  const b64 = readFileSync(join(b64Dir, `${i}.b64`), 'utf8').trim();
  const text = Buffer.from(b64, 'base64').toString('utf8');
  writeFileSync(join(__dirname, 'minnesota-chunks', `${i}.txt`), text);
  console.log(`chunk ${i}: ${text.length} chars`);
}
