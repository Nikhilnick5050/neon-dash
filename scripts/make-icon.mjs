// Draws the Neon Dash icon from code (no image files) and writes build/icon.ico.
// Each size is a PNG built with zlib, then wrapped in an ICO container.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [16, 32, 48, 256];

function drawPixels(size) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - c) / c;
      const dy = (y + 0.5 - c) / c;
      const d = Math.sqrt(dx * dx + dy * dy);
      // Dark rounded background with a soft purple vignette.
      let r = 8 + 20 * (1 - d), g = 4 + 6 * (1 - d), b = 24 + 40 * (1 - d);
      // Neon "lane" stripe: cyan vertical glow in the middle.
      const lane = Math.exp(-Math.pow(dx / 0.12, 2));
      r += 0; g += 200 * lane; b += 255 * lane;
      // Pink ring around the outside.
      const ring = Math.exp(-Math.pow((d - 0.82) / 0.05, 2));
      r += 255 * ring; g += 40 * ring; b += 200 * ring;
      const i = (y * size + x) * 4;
      px[i] = Math.min(255, r | 0);
      px[i + 1] = Math.min(255, g | 0);
      px[i + 2] = Math.min(255, b | 0);
      px[i + 3] = d > 1 ? 0 : 255;
    }
  }
  return px;
}

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function makePng(size) {
  const px = drawPixels(size);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeIco(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((img, i) => {
    const e = 6 + i * 16;
    header[e] = img.size >= 256 ? 0 : img.size;
    header[e + 1] = img.size >= 256 ? 0 : img.size;
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(img.png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += img.png.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.png)]);
}

const images = SIZES.map((size) => ({ size, png: makePng(size) }));
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'icon.ico'), makeIco(images));
console.log('Wrote build/icon.ico');
