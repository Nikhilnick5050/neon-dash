// All textures are drawn with code on a canvas. No image files.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Road: dark asphalt with glowing lane dividers and edges. One tile = 10 m. */
export function roadTexture() {
  const [c, g] = canvas(256, 512);
  g.fillStyle = '#07060f';
  g.fillRect(0, 0, 256, 512);
  // Subtle noise for a wet-asphalt feel.
  for (let i = 0; i < 2500; i++) {
    const v = 10 + Math.random() * 18;
    g.fillStyle = `rgb(${v},${v - 4},${v + 10})`;
    g.fillRect(Math.random() * 256, Math.random() * 512, 2, 2);
  }
  const px = (x) => ((x + 4.2) / 8.4) * 256; // road is 8.4 m wide
  // Edges.
  g.fillStyle = '#ff3fb4';
  g.fillRect(px(-3.95), 0, 6, 512);
  g.fillRect(px(3.95) - 6, 0, 6, 512);
  // Dashed lane dividers.
  g.fillStyle = '#2ef2ff';
  for (const x of [-1.2, 1.2]) {
    g.fillRect(px(x) - 2, 0, 4, 300);
  }
  // Faint cross lines every tile.
  g.fillStyle = 'rgba(120,80,255,0.25)';
  g.fillRect(0, 500, 256, 3);
  return toTexture(c, { repeat: true });
}

/** Ground beside the road: a neon grid. */
export function gridTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#04030a';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(150, 60, 255, 0.85)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 128, 128);
  return toTexture(c, { repeat: true });
}

/** Building windows: rows of lit and dark windows. */
export function windowTexture() {
  const [c, g] = canvas(256, 512);
  g.fillStyle = '#0a0816';
  g.fillRect(0, 0, 256, 512);
  const cols = 8, rows = 24;
  const w = 256 / cols, h = 512 / rows;
  const palette = ['#ffd27a', '#7af0ff', '#ff8ad8', '#c7b8ff', '#ffffff'];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const r = Math.random();
      if (r < 0.55) {
        g.fillStyle = '#120f22';
      } else {
        g.fillStyle = palette[Math.floor(Math.random() * palette.length)];
        g.globalAlpha = 0.35 + Math.random() * 0.65;
      }
      g.fillRect(x * w + 5, y * h + 5, w - 10, h - 8);
      g.globalAlpha = 1;
    }
  }
  return toTexture(c, { repeat: false });
}

/** Diagonal hazard stripes in a neon colour. */
export function stripeTexture(color) {
  const [c, g] = canvas(128, 64);
  g.fillStyle = '#0b0714';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = color;
  for (let x = -64; x < 192; x += 32) {
    g.beginPath();
    g.moveTo(x, 64);
    g.lineTo(x + 16, 64);
    g.lineTo(x + 48, 0);
    g.lineTo(x + 32, 0);
    g.closePath();
    g.fill();
  }
  return toTexture(c, { repeat: true });
}

/** Soft round dot for particles and glows. */
export function dotTexture() {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return toTexture(c, { srgb: false });
}

/** Dark blob shadow under the robot. */
export function shadowTexture() {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.75)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return toTexture(c, { srgb: false });
}

/** Text label (for the 2x power-up). */
export function labelTexture(text, color) {
  const [c, g] = canvas(128, 128);
  g.font = '900 72px Segoe UI, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = '#ffffff';
  g.fillText(text, 64, 68);
  return toTexture(c);
}
