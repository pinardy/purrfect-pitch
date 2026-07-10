// Generates the PWA PNG icons (metronome glyph on a dark background)
// without any image-library dependency: pixels are rasterized in JS and
// wrapped in a minimal PNG encoder built on node:zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- Minimal PNG encoder (8-bit RGBA, no filtering) ----

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size); // +1 filter byte per row
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Icon artwork (cartoon cat face), in unit coordinates (0..1) ----

const BG = [255, 241, 220]; // cream #fff1dc
const FUR = [246, 165, 92]; // orange #f6a55c
const INNER_EAR = [252, 165, 192]; // pink #fca5c0
const DARK = [64, 42, 30]; // #402a1e
const NOSE = [244, 114, 166]; // #f472a6
const MUZZLE = [255, 243, 228]; // #fff3e4

function sign(px, py, ax, ay, bx, by) {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by);
}

function inTriangle(px, py, a, b, c) {
  const d1 = sign(px, py, a[0], a[1], b[0], b[1]);
  const d2 = sign(px, py, b[0], b[1], c[0], c[1]);
  const d3 = sign(px, py, c[0], c[1], a[0], a[1]);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function inEllipse(u, v, cx, cy, rx, ry) {
  const dx = (u - cx) / rx;
  const dy = (v - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function colorAt(u, v) {
  let color = BG;
  // ears
  if (
    inTriangle(u, v, [0.24, 0.46], [0.16, 0.12], [0.48, 0.3]) ||
    inTriangle(u, v, [0.76, 0.46], [0.84, 0.12], [0.52, 0.3])
  ) {
    color = FUR;
  }
  if (
    inTriangle(u, v, [0.28, 0.38], [0.23, 0.19], [0.42, 0.3]) ||
    inTriangle(u, v, [0.72, 0.38], [0.77, 0.19], [0.58, 0.3])
  ) {
    color = INNER_EAR;
  }
  // head
  if (inEllipse(u, v, 0.5, 0.58, 0.34, 0.32)) color = FUR;
  // muzzle
  if (inEllipse(u, v, 0.5, 0.7, 0.17, 0.12)) color = MUZZLE;
  // eyes
  if (inEllipse(u, v, 0.38, 0.54, 0.038, 0.038) || inEllipse(u, v, 0.62, 0.54, 0.038, 0.038)) {
    color = DARK;
  }
  // smile: lower arc of a ring centered on the muzzle
  const smileDist = Math.hypot(u - 0.5, v - 0.68);
  if (smileDist >= 0.05 && smileDist <= 0.068 && v >= 0.71) color = DARK;
  // nose
  if (inTriangle(u, v, [0.462, 0.655], [0.538, 0.655], [0.5, 0.705])) color = NOSE;
  return color;
}

// scale < 1 shrinks the artwork toward the center (background fills the rest),
// keeping it inside the maskable safe zone (a circle of radius 40%).
function render(size, scale = 1) {
  const pixels = Buffer.alloc(size * size * 4);
  const sub = [0.25, 0.75]; // 2x2 supersampling for smooth edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const sy of sub) {
        for (const sx of sub) {
          const c = colorAt(
            0.5 + ((x + sx) / size - 0.5) / scale,
            0.5 + ((y + sy) / size - 0.5) / scale
          );
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const i = (y * size + x) * 4;
      pixels[i] = r / 4;
      pixels[i + 1] = g / 4;
      pixels[i + 2] = b / 4;
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

mkdirSync(join(root, 'public'), { recursive: true });
for (const [file, size, scale] of [
  ['pwa-192.png', 192, 1],
  ['pwa-512.png', 512, 1],
  ['pwa-maskable-512.png', 512, 0.72],
  ['apple-touch-icon.png', 180, 1],
]) {
  const path = join(root, 'public', file);
  writeFileSync(path, encodePng(size, render(size, scale)));
  console.log('wrote', path);
}
