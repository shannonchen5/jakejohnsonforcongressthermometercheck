import sharp from 'sharp';

// Match van outline + reference rolling style: concentric tire/rim with arc marks
// on the light face so rotation is visible.
const OUTLINE = '#5d4952';
const WHITE = '#ffffff';
const size = 256;
const cx = 128;
const cy = 128;
const tireOuter = 118;
const tireInner = 98;
const faceR = 96;
const hubRing = 48;
const hubR = 20;
const arcR = 72;

const arcs = [-40, 80, 200]
  .map((deg) => {
    const start = (deg * Math.PI) / 180;
    const end = ((deg + 52) * Math.PI) / 180;
    const x1 = cx + Math.cos(start) * arcR;
    const y1 = cy + Math.sin(start) * arcR;
    const x2 = cx + Math.cos(end) * arcR;
    const y2 = cy + Math.sin(end) * arcR;
    return `<path d="M ${x1} ${y1} A ${arcR} ${arcR} 0 0 1 ${x2} ${y2}" fill="none" stroke="${OUTLINE}" stroke-width="12" stroke-linecap="round"/>`;
  })
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${cx}" cy="${cy}" r="${tireOuter}" fill="${OUTLINE}"/>
  <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="${WHITE}"/>
  <circle cx="${cx}" cy="${cy}" r="${tireInner}" fill="none" stroke="${OUTLINE}" stroke-width="3"/>
  ${arcs}
  <circle cx="${cx}" cy="${cy}" r="${hubRing}" fill="none" stroke="${OUTLINE}" stroke-width="8"/>
  <circle cx="${cx}" cy="${cy}" r="${hubR}" fill="${OUTLINE}"/>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('src/assets/wheel.png');
console.log('wrote wheel.png');
