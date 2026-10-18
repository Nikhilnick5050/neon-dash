// Generates an SVG version of the Neon Dash icon (dark purple background, cyan neon lane, pink ring).
// Saves to build/icon.svg.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Clean vector version (same look as build/icon.ico): gradients instead of thousands of opaque rects,
// which used to cover each other so only the last layer showed.
function generateSvg(size = 512) {
  const c = size / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgb(28,10,64)"/>
      <stop offset="100%" stop-color="rgb(8,4,24)"/>
    </radialGradient>
    <linearGradient id="lane" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgb(0,200,255)" stop-opacity="0"/>
      <stop offset="50%" stop-color="rgb(0,200,255)" stop-opacity="1"/>
      <stop offset="100%" stop-color="rgb(0,200,255)" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${size * 0.012}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="disc"><circle cx="${c}" cy="${c}" r="${c}"/></clipPath>
  </defs>
  <g clip-path="url(#disc)">
    <circle cx="${c}" cy="${c}" r="${c}" fill="url(#bg)"/>
    <rect x="${c - size * 0.14}" y="0" width="${size * 0.28}" height="${size}" fill="url(#lane)"/>
  </g>
  <circle cx="${c}" cy="${c}" r="${c * 0.82}" fill="none" stroke="rgb(255,40,200)" stroke-width="${c * 0.09}" filter="url(#glow)"/>
</svg>`;
}

function drawSvgOld(size) {
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

function generateSvgOld(size = 512) {
  const shapes = drawSvgOld(size);
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