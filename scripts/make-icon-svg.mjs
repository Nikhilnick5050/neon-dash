// Generates an SVG version of the Neon Dash icon (dark purple background, cyan neon lane, pink ring).
// Saves to build/icon.svg.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function drawSvg(size) {
  const c = size / 2;
  const r = size / 2;
  const d = (x, y) => Math.sqrt((x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2) / r;

  let shapes = '';

  // Dark rounded background with soft purple vignette
  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      const dist = d(x, y);
      let r = 8 + 20 * (1 - dist);
      let g = 4 + 6 * (1 - dist);
      let b = 24 + 40 * (1 - dist);
      shapes += `<rect x="${x}" y="${y}" width="4" height="4" fill="rgb(${Math.min(255, r | 0)}, ${Math.min(255, g | 0)}, ${Math.min(255, b | 0)})" />`;
    }
  }

  // Neon "lane" stripe: cyan vertical glow in the middle
  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      const dx = (x + 0.5 - c) / c;
      const dy = (y + 0.5 - c) / c;
      const d = Math.sqrt(dx * dx + dy * dy);
      const lane = Math.exp(-Math.pow(dx / 0.12, 2));
      const r = 0;
      const g = Math.min(255, 200 * lane);
      const b = Math.min(255, 255 * lane);
      shapes += `<rect x="${x}" y="${y}" width="4" height="4" fill="rgb(${r}, ${g}, ${b})" />`;
    }
  }

  // Pink ring around the outside
  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      const dx = (x + 0.5 - c) / c;
      const dy = (y + 0.5 - c) / c;
      const d = Math.sqrt(dx * dx + dy * dy);
      const ring = Math.exp(-Math.pow((d - 0.82) / 0.05, 2));
      const r = Math.min(255, 255 * ring);
      const g = Math.min(255, 40 * ring);
      const b = Math.min(255, 200 * ring);
      shapes += `<rect x="${x}" y="${y}" width="4" height="4" fill="rgb(${r}, ${g}, ${b})" />`;
    }
  }

  return shapes;
}

function generateSvg(size = 512) {
  const shapes = drawSvg(size);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#080406" />
  ${shapes}
</svg>`;
  return svg;
}

fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'icon.svg'), generateSvg(512));
console.log('Wrote build/icon.svg');