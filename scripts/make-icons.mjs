/**
 * Génère les icônes de l'application (PNG) sans aucune dépendance externe :
 * on dessine Hyro dans un tampon RGBA, puis on encode le PNG à la main
 * (zlib fait partie de Node). Cohérent avec la promesse du projet : aucun
 * asset importé, tout est produit par le code.
 *
 * Usage : npm run icons
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// --- Mini moteur de rastérisation ------------------------------------------

function makeBuffer(size) {
  return { size, data: new Uint8ClampedArray(size * size * 4) };
}

function px(buf, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= buf.size || y >= buf.size || a <= 0) return;
  const i = (y * buf.size + x) * 4;
  const d = buf.data;
  const ia = 1 - a;
  d[i] = r * a + d[i] * ia;
  d[i + 1] = g * a + d[i + 1] * ia;
  d[i + 2] = b * a + d[i + 2] * ia;
  d[i + 3] = Math.max(d[i + 3], a * 255);
}

/** Remplit une forme définie par une fonction de distance signée (antialiasé). */
function fillSdf(buf, sdf, color, alpha = 1) {
  const [r, g, b] = color;
  for (let y = 0; y < buf.size; y++) {
    for (let x = 0; x < buf.size; x++) {
      const d = sdf(x + 0.5, y + 0.5);
      if (d > 1) continue;
      const cov = d < 0 ? 1 : 1 - d; // bord adouci sur 1 px
      px(buf, x, y, r, g, b, cov * alpha);
    }
  }
}

const circle = (cx, cy, rad) => (x, y) => Math.hypot(x - cx, y - cy) - rad;
const ellipseSdf = (cx, cy, rx, ry) => (x, y) => {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return (Math.hypot(dx, dy) - 1) * Math.min(rx, ry);
};
const roundBox = (cx, cy, w, h, rad) => (x, y) => {
  const qx = Math.abs(x - cx) - (w / 2 - rad);
  const qy = Math.abs(y - cy) - (h / 2 - rad);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
};
const triangle = (ax, ay, bx, by, cx2, cy2) => (x, y) => {
  const sign = (px1, py1, px2, py2, px3, py3) =>
    (px1 - px3) * (py2 - py3) - (px2 - px3) * (py1 - py3);
  const d1 = sign(x, y, ax, ay, bx, by);
  const d2 = sign(x, y, bx, by, cx2, cy2);
  const d3 = sign(x, y, cx2, cy2, ax, ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return neg && pos ? 2 : -1;
};

/** Dessine l'icône : tête d'Hyro sur fond dégradé chaud. */
function drawIcon(S) {
  const buf = makeBuffer(S);
  const u = S / 512; // tout est exprimé pour 512 px

  // Fond : dégradé vertical bleu ciel -> or, coins arrondis
  const bg = roundBox(S / 2, S / 2, S, S, 96 * u);
  for (let y = 0; y < S; y++) {
    const t = y / S;
    const r = 0x4a + (0xff - 0x4a) * t;
    const g = 0x8f + (0xd1 - 0x8f) * t;
    const b = 0xd6 + (0x66 - 0xd6) * t;
    for (let x = 0; x < S; x++) {
      const d = bg(x + 0.5, y + 0.5);
      if (d > 1) continue;
      px(buf, x, y, r, g, b, d < 0 ? 1 : 1 - d);
    }
  }

  const INK = [0x2a, 0x1e, 0x18];
  const cx = S / 2;
  const cy = S * 0.54;
  const headR = 150 * u;

  // Oreilles (contour puis intérieur)
  for (const side of [-1, 1]) {
    const ex = cx + side * headR * 0.72;
    const ey = cy - headR * 0.78;
    fillSdf(buf, triangle(ex - 62 * u, ey + 62 * u, ex + 62 * u, ey + 62 * u, ex + side * 18 * u, ey - 78 * u), INK);
    fillSdf(buf, triangle(ex - 46 * u, ey + 56 * u, ex + 46 * u, ey + 56 * u, ex + side * 14 * u, ey - 56 * u), [0xf5, 0xa8, 0x3f]);
    fillSdf(buf, triangle(ex - 22 * u, ey + 44 * u, ex + 22 * u, ey + 44 * u, ex + side * 8 * u, ey - 18 * u), [0xff, 0xb9, 0xc4]);
  }

  // Tête
  fillSdf(buf, circle(cx, cy, headR + 10 * u), INK);
  fillSdf(buf, circle(cx, cy, headR), [0xf7, 0xb4, 0x51]);

  // Écharpe rouge
  fillSdf(buf, ellipseSdf(cx, cy + headR * 0.92, headR * 0.86, headR * 0.3), INK);
  fillSdf(buf, ellipseSdf(cx, cy + headR * 0.9, headR * 0.78, headR * 0.24), [0xd8, 0x41, 0x2f]);

  // Yeux
  for (const side of [-1, 1]) {
    const ex = cx + side * headR * 0.36;
    fillSdf(buf, ellipseSdf(ex, cy - headR * 0.04, 34 * u, 42 * u), [0xff, 0xff, 0xff]);
    fillSdf(buf, ellipseSdf(ex, cy - headR * 0.04, 30 * u, 38 * u), [0x2c, 0x6f, 0x4f], 0.0);
    fillSdf(buf, ellipseSdf(ex, cy - headR * 0.02, 17 * u, 27 * u), [0x2c, 0x6f, 0x4f]);
    fillSdf(buf, circle(ex - 6 * u, cy - headR * 0.12, 8 * u), [0xff, 0xff, 0xff]);
  }

  // Museau + nez
  fillSdf(buf, ellipseSdf(cx, cy + headR * 0.42, 54 * u, 34 * u), [0xff, 0xe6, 0xbf]);
  fillSdf(buf, triangle(cx - 15 * u, cy + headR * 0.3, cx + 15 * u, cy + headR * 0.3, cx, cy + headR * 0.42), [0xe0, 0x70, 0x8a]);

  // Moustaches
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const y0 = cy + headR * 0.36 + i * 22 * u;
      for (let k = 0; k < 90; k++) {
        const x = cx + side * (headR * 0.42 + k * u * 1.1);
        const y = y0 + k * u * 0.35;
        px(buf, Math.round(x), Math.round(y), 60, 40, 25, 0.75);
        px(buf, Math.round(x), Math.round(y) + 1, 60, 40, 25, 0.45);
      }
    }
  }
  return buf;
}

/** Réduction par moyenne de blocs (les icônes restent nettes). */
function downscale(buf, target) {
  const out = makeBuffer(target);
  const f = buf.size / target;
  for (let y = 0; y < target; y++) {
    for (let x = 0; x < target; x++) {
      let r = 0; let g = 0; let b = 0; let a = 0; let n = 0;
      for (let sy = Math.floor(y * f); sy < (y + 1) * f; sy++) {
        for (let sx = Math.floor(x * f); sx < (x + 1) * f; sx++) {
          const i = (sy * buf.size + sx) * 4;
          r += buf.data[i]; g += buf.data[i + 1]; b += buf.data[i + 2]; a += buf.data[i + 3];
          n++;
        }
      }
      const o = (y * target + x) * 4;
      out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = a / n;
    }
  }
  return out;
}

// --- Encodage PNG -----------------------------------------------------------

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(buf) {
  const { size, data } = buf;
  // Filtre 0 (aucun) sur chaque ligne
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size * 4; x++) {
      raw[y * (size * 4 + 1) + 1 + x] = data[y * size * 4 + x];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // 8 bits par canal
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const master = drawIcon(512);
for (const size of [512, 192, 180]) {
  const b = size === 512 ? master : downscale(master, size);
  const file = join(OUT, `icon-${size}.png`);
  writeFileSync(file, encodePng(b));
  console.log(`${file} (${size}×${size})`);
}
