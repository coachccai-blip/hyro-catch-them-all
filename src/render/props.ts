/**
 * Bibliotheque de decors dessines en code.
 *
 * Chaque `kind` de prop a une fonction de dessin. Le point (0,0) local est
 * la BASE du prop (ses "pieds"), ce qui permet un tri par profondeur simple.
 * Toutes les fonctions peuvent etre remplacees par un PNG (voir overrides.ts).
 */

import { TAU, hash2 } from '../core/math';
import type { Prop } from '../levels/generator';
import type { WorldPalette } from './palette';
import { overrides } from './overrides';
import {
  blob, ellipse, fillStroke, glow, groundShadow, poly, rgba, roundRect, shade, star, flicker,
  type Ctx,
} from './draw';

export interface PropDrawCtx {
  pal: WorldPalette;
  t: number;
  /** Opacite reduite quand Hyro passe derriere un prop de premier plan. */
  fade: number;
}

type DrawFn = (ctx: Ctx, p: Prop, c: PropDrawCtx) => void;

const R = (p: Prop, i: number) => hash2(p.seed, i, 7);

// ---------------------------------------------------------------------------
// JARDIN
// ---------------------------------------------------------------------------

const drawGrassTuft: DrawFn = (ctx, p, c) => {
  const s = p.s * 26;
  const sway = Math.sin(c.t * 1.7 + p.seed * 0.37) * 0.16 + Math.sin(c.t * 3.1 + p.seed) * 0.05;
  const base = c.pal.ground;
  const blades = 5;
  ctx.lineCap = 'round';
  for (let i = 0; i < blades; i++) {
    const off = (i / (blades - 1) - 0.5) * s * 0.75;
    const h = s * (0.8 + R(p, i) * 0.7);
    const lean = sway * (1 + i * 0.14) + (R(p, i + 20) - 0.5) * 0.4;
    ctx.beginPath();
    ctx.moveTo(p.x + off, p.y);
    ctx.quadraticCurveTo(p.x + off + lean * h * 0.4, p.y - h * 0.6, p.x + off + lean * h, p.y - h);
    ctx.strokeStyle = i % 2 === 0 ? shade(base, 0.12) : shade(base, -0.16);
    ctx.lineWidth = 4.5 - i * 0.35;
    ctx.stroke();
  }
  // Nervure claire sur la lame centrale
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.quadraticCurveTo(p.x + sway * s * 0.4, p.y - s * 0.7, p.x + sway * s, p.y - s * 1.15);
  ctx.strokeStyle = rgba(shade(base, 0.4), 0.5);
  ctx.lineWidth = 1.6;
  ctx.stroke();
};

const drawDaisy: DrawFn = (ctx, p, c) => {
  const s = p.s * 9;
  const n = 3 + Math.floor(R(p, 1) * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + p.seed;
    const x = p.x + Math.cos(a) * s * 1.5;
    const y = p.y + Math.sin(a) * s * 0.9;
    const col = i % 3 === 0 ? c.pal.accent3 : i % 3 === 1 ? '#fff6e5' : c.pal.accent2;
    for (let k = 0; k < 5; k++) {
      const pa = (k / 5) * TAU + a;
      ellipse(ctx, x + Math.cos(pa) * s * 0.42, y + Math.sin(pa) * s * 0.42, s * 0.34, s * 0.24, pa);
      ctx.fillStyle = col;
      ctx.fill();
    }
    ellipse(ctx, x, y, s * 0.28, s * 0.24, 0);
    ctx.fillStyle = '#ffd166';
    ctx.fill();
  }
};

const drawStone: DrawFn = (ctx, p, c) => {
  const s = p.s * 15;
  groundShadow(ctx, p.x, p.y + 2, s * 1.1, s * 0.45, 0.2);
  blob(ctx, p.x, p.y - s * 0.25, s, s * 0.7, p.seed, 0.2, 8);
  fillStroke(ctx, '#9a9a92', c.pal.ink, 2);
  blob(ctx, p.x - s * 0.2, p.y - s * 0.45, s * 0.45, s * 0.3, p.seed + 3, 0.25, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.fill();
};

const drawBush: DrawFn = (ctx, p, c) => {
  const s = p.s * 30;
  const sway = Math.sin(c.t * 1.2 + p.seed * 0.7) * 2.4;
  groundShadow(ctx, p.x, p.y, s * 1.15, s * 0.45, 0.34);
  // Vert nettement plus sombre et sature que la pelouse : le buisson doit
  // se detacher au premier coup d'oeil (c'est un obstacle et une cachette).
  const g = shade(c.pal.near, -0.16);
  for (let i = 0; i < 5; i++) {
    const ox = (R(p, i) - 0.5) * s * 1.15 + sway * (i * 0.2);
    const oy = -s * (0.32 + R(p, i + 5) * 0.6);
    blob(ctx, p.x + ox, p.y + oy, s * (0.56 + R(p, i + 9) * 0.24), s * (0.5 + R(p, i + 12) * 0.22), p.seed + i, 0.22, 9);
    fillStroke(ctx, i < 2 ? shade(g, -0.18) : g, c.pal.ink, 3);
  }
  // Reflets sur le dessus (lumiere venant du haut)
  for (let i = 0; i < 4; i++) {
    blob(ctx, p.x + (R(p, i + 30) - 0.5) * s * 0.95, p.y - s * (0.65 + R(p, i + 33) * 0.42), s * 0.26, s * 0.17, p.seed + i * 3, 0.3, 8);
    ctx.fillStyle = rgba(shade(g, 0.4), 0.5);
    ctx.fill();
  }
  for (let i = 0; i < 2; i++) {
    if (R(p, i + 40) > 0.55) {
      ctx.beginPath();
      ctx.arc(p.x + (R(p, i + 42) - 0.5) * s, p.y - s * (0.4 + R(p, i + 44) * 0.6), s * 0.09, 0, TAU);
      ctx.fillStyle = i ? c.pal.accent3 : c.pal.accent2;
      ctx.fill();
    }
  }
};

const drawPot: DrawFn = (ctx, p, c) => {
  const s = p.s * 24;
  groundShadow(ctx, p.x, p.y, s * 1.05, s * 0.35, 0.28);
  poly(ctx, [p.x - s * 0.62, p.y - s * 1.15, p.x + s * 0.62, p.y - s * 1.15, p.x + s * 0.45, p.y, p.x - s * 0.45, p.y]);
  fillStroke(ctx, '#c8703f', c.pal.ink, 2.6);
  roundRect(ctx, p.x - s * 0.72, p.y - s * 1.38, s * 1.44, s * 0.3, s * 0.1);
  fillStroke(ctx, '#d97f4a', c.pal.ink, 2.6);
  // Terre + plante
  ellipse(ctx, p.x, p.y - s * 1.26, s * 0.6, s * 0.15, 0);
  ctx.fillStyle = '#5a3a24';
  ctx.fill();
  const sway = Math.sin(c.t * 1.5 + p.seed) * 0.12;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.42 + sway;
    const len = s * (0.7 + R(p, i) * 0.6);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 1.3);
    ctx.quadraticCurveTo(p.x + Math.cos(a) * len * 0.5, p.y - s * 1.3 + Math.sin(a) * len * 0.5,
      p.x + Math.cos(a) * len, p.y - s * 1.3 + Math.sin(a) * len);
    ctx.strokeStyle = shade(c.pal.ground, -0.05);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(p.x + s * 0.15, p.y - s * 2.05, s * 0.2, 0, TAU);
  ctx.fillStyle = c.pal.accent3;
  ctx.fill();
  // Reflet lateral
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.5, p.y - s * 1.05);
  ctx.lineTo(p.x - s * 0.36, p.y - s * 0.15);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 3;
  ctx.stroke();
};

const drawMushroom: DrawFn = (ctx, p, c) => {
  const s = p.s * 13;
  groundShadow(ctx, p.x, p.y, s * 0.9, s * 0.3, 0.22);
  roundRect(ctx, p.x - s * 0.2, p.y - s * 0.9, s * 0.4, s * 0.9, s * 0.16);
  fillStroke(ctx, '#f3e5cd', c.pal.ink, 2);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - s * 0.9, s * 0.72, s * 0.55, 0, Math.PI, 0);
  ctx.closePath();
  fillStroke(ctx, '#e0553f', c.pal.ink, 2.2);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(p.x + (R(p, i) - 0.5) * s, p.y - s * (1.0 + R(p, i + 4) * 0.25), s * 0.13, 0, TAU);
    ctx.fillStyle = '#fff3e0';
    ctx.fill();
  }
};

const drawGnome: DrawFn = (ctx, p, c) => {
  const s = p.s * 22;
  groundShadow(ctx, p.x, p.y, s * 0.8, s * 0.3, 0.3);
  roundRect(ctx, p.x - s * 0.42, p.y - s * 1.05, s * 0.84, s * 1.05, s * 0.24);
  fillStroke(ctx, '#3f7fd6', c.pal.ink, 2.4);
  ctx.beginPath();
  ctx.arc(p.x, p.y - s * 1.15, s * 0.38, 0, TAU);
  fillStroke(ctx, '#f7d3ab', c.pal.ink, 2.2);
  poly(ctx, [p.x - s * 0.46, p.y - s * 1.3, p.x + s * 0.46, p.y - s * 1.3, p.x, p.y - s * 2.2]);
  fillStroke(ctx, '#d1352c', c.pal.ink, 2.4);
  // Barbe
  poly(ctx, [p.x - s * 0.34, p.y - s * 1.12, p.x + s * 0.34, p.y - s * 1.12, p.x, p.y - s * 0.42]);
  fillStroke(ctx, '#f4f1e6', c.pal.ink, 2);
  ctx.beginPath();
  ctx.arc(p.x - s * 0.13, p.y - s * 1.24, s * 0.06, 0, TAU);
  ctx.arc(p.x + s * 0.13, p.y - s * 1.24, s * 0.06, 0, TAU);
  ctx.fillStyle = c.pal.ink;
  ctx.fill();
};

const drawFence: DrawFn = (ctx, p, c) => {
  const s = p.s * 26;
  groundShadow(ctx, p.x, p.y, s * 1.4, s * 0.22, 0.2);
  for (let i = -1; i <= 1; i++) {
    roundRect(ctx, p.x + i * s * 0.8 - s * 0.11, p.y - s * 1.1, s * 0.22, s * 1.1, 3);
    fillStroke(ctx, '#a9784a', c.pal.ink, 2.2);
  }
  for (const yy of [0.75, 0.35]) {
    roundRect(ctx, p.x - s * 1.05, p.y - s * yy - s * 0.08, s * 2.1, s * 0.16, 3);
    fillStroke(ctx, '#bd8955', c.pal.ink, 2.2);
  }
};

const drawWateringCan: DrawFn = (ctx, p, c) => {
  const s = p.s * 20;
  groundShadow(ctx, p.x, p.y, s * 0.9, s * 0.3, 0.26);
  roundRect(ctx, p.x - s * 0.5, p.y - s * 0.85, s, s * 0.85, s * 0.16);
  fillStroke(ctx, '#5fb7a6', c.pal.ink, 2.4);
  poly(ctx, [p.x + s * 0.45, p.y - s * 0.6, p.x + s * 1.15, p.y - s * 1.0, p.x + s * 1.2, p.y - s * 0.82, p.x + s * 0.48, p.y - s * 0.4]);
  fillStroke(ctx, '#4da192', c.pal.ink, 2.2);
  ctx.beginPath();
  ctx.arc(p.x - s * 0.05, p.y - s * 1.05, s * 0.32, Math.PI * 1.05, Math.PI * 1.95);
  ctx.strokeStyle = c.pal.ink;
  ctx.lineWidth = 4;
  ctx.stroke();
};

const drawWheelbarrow: DrawFn = (ctx, p, c) => {
  const s = p.s * 26;
  groundShadow(ctx, p.x, p.y, s * 1.3, s * 0.32, 0.28);
  poly(ctx, [p.x - s * 0.9, p.y - s * 0.95, p.x + s * 0.85, p.y - s * 0.95, p.x + s * 0.55, p.y - s * 0.3, p.x - s * 0.6, p.y - s * 0.3]);
  fillStroke(ctx, '#b8503c', c.pal.ink, 2.6);
  ctx.beginPath();
  ctx.arc(p.x - s * 0.55, p.y - s * 0.15, s * 0.3, 0, TAU);
  fillStroke(ctx, '#3a3a44', c.pal.ink, 2.4);
  ctx.beginPath();
  ctx.arc(p.x - s * 0.55, p.y - s * 0.15, s * 0.1, 0, TAU);
  ctx.fillStyle = '#8d8d95';
  ctx.fill();
  // Terre debordante
  blob(ctx, p.x, p.y - s * 1.02, s * 0.72, s * 0.2, p.seed, 0.3, 9);
  ctx.fillStyle = '#5a3a24';
  ctx.fill();
};

const drawLogs: DrawFn = (ctx, p, c) => {
  const s = p.s * 22;
  groundShadow(ctx, p.x, p.y, s * 1.2, s * 0.3, 0.26);
  const place = [[-0.5, 0], [0.5, 0], [0, -0.62]];
  for (const [ox, oy] of place) {
    ctx.beginPath();
    ctx.arc(p.x + ox * s, p.y - s * 0.35 + oy * s, s * 0.36, 0, TAU);
    fillStroke(ctx, '#8a5f3c', c.pal.ink, 2.4);
    ctx.beginPath();
    ctx.arc(p.x + ox * s, p.y - s * 0.35 + oy * s, s * 0.22, 0, TAU);
    ctx.strokeStyle = '#b4835a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
};

const drawHose: DrawFn = (ctx, p, c) => {
  const s = p.s * 34;
  ctx.beginPath();
  ctx.moveTo(p.x - s, p.y);
  ctx.bezierCurveTo(p.x - s * 0.3, p.y - s * 0.5, p.x + s * 0.3, p.y + s * 0.5, p.x + s, p.y - s * 0.1);
  ctx.strokeStyle = '#3f8f52';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();
};

const drawBirdbath: DrawFn = (ctx, p, c) => {
  const s = p.s * 24;
  groundShadow(ctx, p.x, p.y, s * 0.9, s * 0.32, 0.3);
  poly(ctx, [p.x - s * 0.22, p.y, p.x + s * 0.22, p.y, p.x + s * 0.14, p.y - s * 1.0, p.x - s * 0.14, p.y - s * 1.0]);
  fillStroke(ctx, '#b9b3a6', c.pal.ink, 2.4);
  ellipse(ctx, p.x, p.y - s * 1.05, s * 0.7, s * 0.26, 0);
  fillStroke(ctx, '#cfcabc', c.pal.ink, 2.4);
  ellipse(ctx, p.x, p.y - s * 1.06, s * 0.52, s * 0.17, 0);
  ctx.fillStyle = rgba(c.pal.water, 0.85);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(p.x - s * 0.16, p.y - s * 1.1, s * 0.16, s * 0.05, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
};

const drawTree: DrawFn = (ctx, p, c) => {
  const s = p.s * 42;
  const sway = Math.sin(c.t * 0.8 + p.seed * 0.4) * 4;
  ctx.globalAlpha = c.fade;
  groundShadow(ctx, p.x, p.y, s * 1.5, s * 0.5, 0.3);
  poly(ctx, [p.x - s * 0.22, p.y, p.x + s * 0.22, p.y, p.x + s * 0.14, p.y - s * 1.1, p.x - s * 0.16, p.y - s * 1.1]);
  fillStroke(ctx, '#7a5233', c.pal.ink, 3);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    blob(ctx, p.x + Math.cos(a) * s * 0.55 + sway, p.y - s * 1.5 + Math.sin(a) * s * 0.35,
      s * 0.72, s * 0.56, p.seed + i, 0.18, 10);
    fillStroke(ctx, i % 2 ? shade(c.pal.near, 0.06) : c.pal.near, c.pal.ink, 3);
  }
  blob(ctx, p.x + sway * 0.6, p.y - s * 1.62, s * 0.6, s * 0.42, p.seed + 9, 0.2, 10);
  ctx.fillStyle = rgba(shade(c.pal.near, 0.3), 0.5);
  ctx.fill();
  ctx.globalAlpha = 1;
};

// ---------------------------------------------------------------------------
// MARCHE DE NUIT
// ---------------------------------------------------------------------------

const drawCrate: DrawFn = (ctx, p, c) => {
  const s = p.s * 26;
  groundShadow(ctx, p.x, p.y, s * 0.95, s * 0.3, 0.32);
  roundRect(ctx, p.x - s * 0.6, p.y - s * 1.15, s * 1.2, s * 1.15, 4);
  fillStroke(ctx, '#a9773f', c.pal.ink, 2.6);
  ctx.strokeStyle = shade('#a9773f', -0.25);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.55, p.y - s * 1.1);
  ctx.lineTo(p.x + s * 0.55, p.y - s * 0.05);
  ctx.moveTo(p.x + s * 0.55, p.y - s * 1.1);
  ctx.lineTo(p.x - s * 0.55, p.y - s * 0.05);
  ctx.stroke();
  roundRect(ctx, p.x - s * 0.62, p.y - s * 1.22, s * 1.24, s * 0.18, 3);
  fillStroke(ctx, '#c08b4c', c.pal.ink, 2.2);
};

const drawBarrel: DrawFn = (ctx, p, c) => {
  const s = p.s * 24;
  groundShadow(ctx, p.x, p.y, s * 0.85, s * 0.28, 0.3);
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.5, p.y - s * 0.05);
  ctx.quadraticCurveTo(p.x - s * 0.66, p.y - s * 0.6, p.x - s * 0.5, p.y - s * 1.15);
  ctx.lineTo(p.x + s * 0.5, p.y - s * 1.15);
  ctx.quadraticCurveTo(p.x + s * 0.66, p.y - s * 0.6, p.x + s * 0.5, p.y - s * 0.05);
  ctx.closePath();
  fillStroke(ctx, '#8f5f38', c.pal.ink, 2.6);
  for (const yy of [0.3, 0.9]) {
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.62, p.y - s * yy);
    ctx.lineTo(p.x + s * 0.62, p.y - s * yy);
    ctx.strokeStyle = '#5c5c66';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ellipse(ctx, p.x, p.y - s * 1.15, s * 0.5, s * 0.16, 0);
  fillStroke(ctx, '#a8743f', c.pal.ink, 2.2);
};

const drawStall: DrawFn = (ctx, p, c) => {
  const s = p.s * 40;
  groundShadow(ctx, p.x, p.y, s * 1.5, s * 0.35, 0.36);
  // Comptoir
  roundRect(ctx, p.x - s * 1.2, p.y - s * 0.95, s * 2.4, s * 0.95, 5);
  fillStroke(ctx, '#7d5237', c.pal.ink, 3);
  // Marchandises
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(p.x - s * 0.95 + i * s * 0.48, p.y - s * 1.05, s * 0.16, 0, TAU);
    ctx.fillStyle = [c.pal.accent, c.pal.accent2, c.pal.accent3, '#ff7f6e', '#8ce06b'][i % 5];
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = c.pal.ink;
    ctx.stroke();
  }
  // Poteaux + auvent raye
  for (const sx of [-1, 1]) {
    roundRect(ctx, p.x + sx * s * 1.16 - 3, p.y - s * 2.3, 6, s * 1.4, 2);
    fillStroke(ctx, '#5f4030', c.pal.ink, 2);
  }
  const stripes = 7;
  for (let i = 0; i < stripes; i++) {
    const x0 = p.x - s * 1.3 + (i / stripes) * s * 2.6;
    const w = (s * 2.6) / stripes;
    poly(ctx, [x0, p.y - s * 2.3, x0 + w, p.y - s * 2.3, x0 + w, p.y - s * 2.0 + Math.sin((i / stripes) * Math.PI) * 8, x0, p.y - s * 2.0 + Math.sin((i / stripes) * Math.PI) * 8]);
    ctx.fillStyle = i % 2 ? '#f0f0e6' : c.pal.accent2;
    ctx.fill();
  }
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = c.pal.ink;
  ctx.beginPath();
  ctx.moveTo(p.x - s * 1.3, p.y - s * 2.3);
  ctx.lineTo(p.x + s * 1.3, p.y - s * 2.3);
  ctx.stroke();
};

const drawLantern: DrawFn = (ctx, p, c) => {
  const s = p.s * 22;
  const fl = flicker(c.t, p.seed, 3.4);
  const sway = Math.sin(c.t * 1.1 + p.seed * 0.5) * 0.09;
  const cx = p.x + Math.sin(sway) * s * 1.4;
  const topY = p.y - s * 3.6;
  ctx.beginPath();
  ctx.moveTo(p.x, topY - s * 0.6);
  ctx.lineTo(cx, topY);
  ctx.strokeStyle = 'rgba(20,14,26,0.75)';
  ctx.lineWidth = 2;
  ctx.stroke();
  glow(ctx, cx, topY + s * 0.55, s * 4.2 * (0.85 + fl * 0.3), c.pal.accent, 0.34 * fl);
  ellipse(ctx, cx, topY + s * 0.55, s * 0.62, s * 0.8, 0);
  fillStroke(ctx, shade(c.pal.accent, 0.18 + fl * 0.2), '#7a3d16', 2.4);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * s * 0.36, topY - s * 0.1);
    ctx.lineTo(cx + i * s * 0.36, topY + s * 1.2);
    ctx.strokeStyle = 'rgba(120,60,20,0.35)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  roundRect(ctx, cx - s * 0.22, topY - s * 0.32, s * 0.44, s * 0.2, 2);
  fillStroke(ctx, '#8a4a1e', '#3a1c08', 1.8);
  ctx.beginPath();
  ctx.moveTo(cx, topY + s * 1.36);
  ctx.lineTo(cx - s * 0.1, topY + s * 1.8);
  ctx.lineTo(cx + s * 0.1, topY + s * 1.8);
  ctx.strokeStyle = '#e0a24a';
  ctx.lineWidth = 2;
  ctx.stroke();
};

const drawBasket: DrawFn = (ctx, p, c) => {
  const s = p.s * 20;
  groundShadow(ctx, p.x, p.y, s * 0.85, s * 0.28, 0.28);
  poly(ctx, [p.x - s * 0.55, p.y - s * 0.85, p.x + s * 0.55, p.y - s * 0.85, p.x + s * 0.42, p.y, p.x - s * 0.42, p.y]);
  fillStroke(ctx, '#c39a5c', c.pal.ink, 2.4);
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.52 + i * 0.02 * s, p.y - s * 0.85 + (i / 4) * s * 0.85);
    ctx.lineTo(p.x + s * 0.52 - i * 0.02 * s, p.y - s * 0.85 + (i / 4) * s * 0.85);
    ctx.strokeStyle = 'rgba(90,60,25,0.4)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(p.x - s * 0.3 + i * s * 0.2, p.y - s * 0.95 - R(p, i) * s * 0.12, s * 0.16, 0, TAU);
    ctx.fillStyle = ['#e8543f', '#f0a93c', '#8ec94f', '#d05fa8'][i % 4];
    ctx.fill();
    ctx.strokeStyle = c.pal.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
};

const drawSack: DrawFn = (ctx, p, c) => {
  const s = p.s * 22;
  groundShadow(ctx, p.x, p.y, s * 0.8, s * 0.26, 0.28);
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.45, p.y);
  ctx.quadraticCurveTo(p.x - s * 0.62, p.y - s * 0.9, p.x - s * 0.22, p.y - s * 1.05);
  ctx.lineTo(p.x + s * 0.22, p.y - s * 1.05);
  ctx.quadraticCurveTo(p.x + s * 0.62, p.y - s * 0.9, p.x + s * 0.45, p.y);
  ctx.closePath();
  fillStroke(ctx, '#cbb489', c.pal.ink, 2.4);
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.24, p.y - s * 1.04);
  ctx.lineTo(p.x + s * 0.24, p.y - s * 1.04);
  ctx.strokeStyle = '#8a7550';
  ctx.lineWidth = 3;
  ctx.stroke();
};

const drawSign: DrawFn = (ctx, p, c) => {
  const s = p.s * 22;
  groundShadow(ctx, p.x, p.y, s * 0.4, s * 0.2, 0.26);
  roundRect(ctx, p.x - 3, p.y - s * 1.5, 6, s * 1.5, 2);
  fillStroke(ctx, '#6b4a30', c.pal.ink, 2);
  roundRect(ctx, p.x - s * 0.7, p.y - s * 2.1, s * 1.4, s * 0.62, 4);
  fillStroke(ctx, '#e6d3a8', c.pal.ink, 2.4);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.52, p.y - s * 1.95 + i * s * 0.15);
    ctx.lineTo(p.x + s * (0.2 + R(p, i) * 0.32), p.y - s * 1.95 + i * s * 0.15);
    ctx.strokeStyle = 'rgba(60,40,25,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
};

const drawUmbrella: DrawFn = (ctx, p, c) => {
  const s = p.s * 32;
  ctx.globalAlpha = c.fade;
  groundShadow(ctx, p.x, p.y, s * 0.9, s * 0.3, 0.3);
  roundRect(ctx, p.x - 3, p.y - s * 2.2, 6, s * 2.2, 2);
  fillStroke(ctx, '#5a4234', c.pal.ink, 2);
  const sway = Math.sin(c.t * 1.3 + p.seed) * 3;
  ctx.beginPath();
  ctx.moveTo(p.x - s * 1.1 + sway, p.y - s * 2.1);
  ctx.quadraticCurveTo(p.x + sway, p.y - s * 2.9, p.x + s * 1.1 + sway, p.y - s * 2.1);
  ctx.closePath();
  fillStroke(ctx, c.pal.accent, c.pal.ink, 2.6);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x + sway, p.y - s * 2.82);
    ctx.lineTo(p.x + sway + i * s * 0.52, p.y - s * 2.1);
    ctx.strokeStyle = 'rgba(30,20,25,0.35)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

const drawSteamVent: DrawFn = (ctx, p, c) => {
  const s = p.s * 20;
  ellipse(ctx, p.x, p.y, s * 0.8, s * 0.4, 0);
  fillStroke(ctx, '#4a4a52', c.pal.ink, 2);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.6, p.y - s * 0.16 + i * s * 0.16);
    ctx.lineTo(p.x + s * 0.6, p.y - s * 0.16 + i * s * 0.16);
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const ph = (c.t * 0.45 + i * 0.25 + p.seed * 0.01) % 1;
    const a = (1 - ph) * 0.3;
    if (a <= 0) continue;
    ctx.beginPath();
    ctx.arc(p.x + Math.sin(ph * 4 + i) * s * 0.5, p.y - ph * s * 3.4, s * (0.3 + ph * 0.9), 0, TAU);
    ctx.fillStyle = `rgba(235,240,255,${a * 0.55})`;
    ctx.fill();
  }
};

const drawPuddle: DrawFn = (ctx, p, c) => {
  const s = p.s * 26;
  blob(ctx, p.x, p.y, s, s * 0.55, p.seed, 0.24, 10);
  ctx.fillStyle = rgba(c.pal.water, 0.42);
  ctx.fill();
  ctx.strokeStyle = rgba(c.pal.waterFoam, 0.28);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Reflet mouvant
  ctx.save();
  ctx.clip();
  const off = Math.sin(c.t * 0.7 + p.seed) * s * 0.2;
  ctx.beginPath();
  ctx.ellipse(p.x + off, p.y - s * 0.12, s * 0.5, s * 0.1, 0, 0, TAU);
  ctx.fillStyle = rgba(c.pal.accent, 0.3);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(p.x - off * 0.6, p.y + s * 0.16, s * 0.34, s * 0.06, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fill();
  ctx.restore();
};

const drawCart: DrawFn = (ctx, p, c) => {
  const s = p.s * 30;
  groundShadow(ctx, p.x, p.y, s * 1.3, s * 0.32, 0.32);
  roundRect(ctx, p.x - s * 1.0, p.y - s * 1.1, s * 2.0, s * 0.7, 5);
  fillStroke(ctx, '#8a5a3c', c.pal.ink, 2.8);
  for (const sx of [-0.6, 0.6]) {
    ctx.beginPath();
    ctx.arc(p.x + sx * s, p.y - s * 0.28, s * 0.34, 0, TAU);
    fillStroke(ctx, '#4a3a30', c.pal.ink, 2.6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + p.seed;
      ctx.beginPath();
      ctx.moveTo(p.x + sx * s, p.y - s * 0.28);
      ctx.lineTo(p.x + sx * s + Math.cos(a) * s * 0.3, p.y - s * 0.28 + Math.sin(a) * s * 0.3);
      ctx.strokeStyle = '#7a6a5a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
};

const drawGarland: DrawFn = (ctx, p, c) => {
  const s = p.s * 70;
  const y0 = p.y - s * 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x - s, y0);
  ctx.quadraticCurveTo(p.x, y0 + s * 0.4, p.x + s, y0);
  ctx.strokeStyle = 'rgba(20,14,26,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const bulbs = 7;
  for (let i = 0; i <= bulbs; i++) {
    const u = i / bulbs;
    const bx = p.x - s + u * s * 2;
    const by = y0 + Math.sin(u * Math.PI) * s * 0.32;
    const fl = flicker(c.t, p.seed + i * 13, 2.2);
    const col = [c.pal.accent, c.pal.accent2, c.pal.accent3][i % 3];
    glow(ctx, bx, by + 6, 26 * fl, col, 0.35 * fl);
    ctx.beginPath();
    ctx.arc(bx, by + 6, 4.5, 0, TAU);
    ctx.fillStyle = shade(col, fl * 0.4);
    ctx.fill();
  }
};

const drawMelon: DrawFn = (ctx, p, c) => {
  const s = p.s * 14;
  groundShadow(ctx, p.x, p.y, s * 0.8, s * 0.26, 0.22);
  ctx.beginPath();
  ctx.arc(p.x, p.y - s * 0.55, s * 0.55, 0, TAU);
  fillStroke(ctx, '#6fae4a', c.pal.ink, 2.2);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x + i * s * 0.22, p.y - s * 1.05);
    ctx.quadraticCurveTo(p.x + i * s * 0.4, p.y - s * 0.55, p.x + i * s * 0.22, p.y - s * 0.05);
    ctx.strokeStyle = 'rgba(30,60,20,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
};

// ---------------------------------------------------------------------------
// EGOUTS / METRO
// ---------------------------------------------------------------------------

const drawPipe: DrawFn = (ctx, p, c) => {
  const s = p.s * 28;
  groundShadow(ctx, p.x, p.y, s * 1.1, s * 0.28, 0.34);
  roundRect(ctx, p.x - s * 1.0, p.y - s * 0.95, s * 2.0, s * 0.8, s * 0.4);
  fillStroke(ctx, '#5a6560', c.pal.ink, 2.6);
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.9, p.y - s * 0.78);
  ctx.lineTo(p.x + s * 0.9, p.y - s * 0.78);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 3;
  ctx.stroke();
  for (const sx of [-0.55, 0.55]) {
    roundRect(ctx, p.x + sx * s - s * 0.08, p.y - s * 1.02, s * 0.16, s * 0.94, 2);
    fillStroke(ctx, '#6d7a74', c.pal.ink, 2);
  }
  // Rouille
  for (let i = 0; i < 3; i++) {
    blob(ctx, p.x + (R(p, i) - 0.5) * s * 1.5, p.y - s * (0.3 + R(p, i + 4) * 0.5), s * 0.16, s * 0.1, p.seed + i, 0.35, 7);
    ctx.fillStyle = 'rgba(150,80,40,0.4)';
    ctx.fill();
  }
};

const drawValve: DrawFn = (ctx, p, c) => {
  const s = p.s * 20;
  groundShadow(ctx, p.x, p.y, s * 0.7, s * 0.24, 0.3);
  roundRect(ctx, p.x - s * 0.16, p.y - s * 0.8, s * 0.32, s * 0.8, 3);
  fillStroke(ctx, '#5a6560', c.pal.ink, 2.2);
  ctx.save();
  ctx.translate(p.x, p.y - s * 0.95);
  ctx.rotate(Math.sin(c.t * 0.4 + p.seed) * 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.5, 0, TAU);
  ctx.strokeStyle = '#a34a2a';
  ctx.lineWidth = 5;
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5);
    ctx.strokeStyle = '#a34a2a';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.restore();
};

const drawSleeper: DrawFn = (ctx, p, c) => {
  const s = p.s * 30;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot * 0.15);
  roundRect(ctx, -s * 0.9, -s * 0.16, s * 1.8, s * 0.32, 3);
  fillStroke(ctx, '#463b33', 'rgba(0,0,0,0.5)', 1.8);
  ctx.restore();
};

const drawGrate: DrawFn = (ctx, p, c) => {
  const s = p.s * 24;
  roundRect(ctx, p.x - s * 0.7, p.y - s * 0.5, s * 1.4, s, 3);
  fillStroke(ctx, '#2c332f', 'rgba(0,0,0,0.5)', 2);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.6, p.y - s * 0.38 + i * s * 0.2);
    ctx.lineTo(p.x + s * 0.6, p.y - s * 0.38 + i * s * 0.2);
    ctx.strokeStyle = '#586058';
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }
};

const drawMoss: DrawFn = (ctx, p, c) => {
  const s = p.s * 20;
  for (let i = 0; i < 4; i++) {
    blob(ctx, p.x + (R(p, i) - 0.5) * s, p.y + (R(p, i + 4) - 0.5) * s * 0.5, s * 0.4, s * 0.24, p.seed + i, 0.35, 8);
    ctx.fillStyle = rgba(i % 2 ? '#4f8f4a' : '#6aa84f', 0.5);
    ctx.fill();
  }
};

const drawNeonTube: DrawFn = (ctx, p, c) => {
  const s = p.s * 26;
  const fl = flicker(c.t, p.seed, 6.5);
  const y = p.y - s * 2.6;
  glow(ctx, p.x, y, s * 3.6 * fl, c.pal.accent, 0.3 * fl);
  roundRect(ctx, p.x - s * 0.9, y - s * 0.1, s * 1.8, s * 0.2, s * 0.1);
  ctx.fillStyle = shade(c.pal.accent, 0.35 * fl);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,30,25,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const sx of [-1, 1]) {
    roundRect(ctx, p.x + sx * s * 0.9 - 3, y - s * 0.2, 6, s * 0.4, 2);
    fillStroke(ctx, '#3a4440', 'rgba(0,0,0,0.6)', 1.6);
  }
};

const drawBarrelRust: DrawFn = (ctx, p, c) => {
  const s = p.s * 24;
  groundShadow(ctx, p.x, p.y, s * 0.85, s * 0.28, 0.34);
  roundRect(ctx, p.x - s * 0.5, p.y - s * 1.15, s, s * 1.15, s * 0.14);
  fillStroke(ctx, '#5e6b52', c.pal.ink, 2.6);
  for (const yy of [0.35, 0.9]) {
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.52, p.y - s * yy);
    ctx.lineTo(p.x + s * 0.52, p.y - s * yy);
    ctx.strokeStyle = '#3d463a';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    blob(ctx, p.x + (R(p, i) - 0.5) * s * 0.8, p.y - s * (0.2 + R(p, i + 5) * 0.9), s * 0.14, s * 0.1, p.seed + i, 0.4, 7);
    ctx.fillStyle = 'rgba(160,80,35,0.5)';
    ctx.fill();
  }
};

const drawWagon: DrawFn = (ctx, p, c) => {
  const s = p.s * 54;
  groundShadow(ctx, p.x, p.y, s * 1.5, s * 0.3, 0.4);
  roundRect(ctx, p.x - s * 1.3, p.y - s * 1.6, s * 2.6, s * 1.6, 8);
  fillStroke(ctx, '#6b7a72', c.pal.ink, 3);
  // Bande de couleur
  roundRect(ctx, p.x - s * 1.3, p.y - s * 1.15, s * 2.6, s * 0.18, 2);
  ctx.fillStyle = rgba(c.pal.accent2, 0.8);
  ctx.fill();
  // Fenetres cassees
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, p.x - s * 1.0 + i * s * 0.75, p.y - s * 1.45, s * 0.55, s * 0.42, 3);
    fillStroke(ctx, '#22302c', 'rgba(0,0,0,0.6)', 2);
    if (i === 1) {
      poly(ctx, [p.x - s * 1.0 + i * s * 0.75, p.y - s * 1.45, p.x - s * 0.75 + i * s * 0.75, p.y - s * 1.2, p.x - s * 0.45 + i * s * 0.75, p.y - s * 1.45]);
      ctx.fillStyle = 'rgba(140,160,150,0.35)';
      ctx.fill();
    }
  }
  // Tags de souris
  ctx.save();
  ctx.translate(p.x + s * 0.5, p.y - s * 0.55);
  ctx.rotate(-0.08);
  ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
  ctx.fillStyle = rgba(c.pal.accent, 0.75);
  ctx.fillText('NERAT', -30, 0);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(p.x - s * 0.7, p.y - s * 0.5, s * 0.16, 0, TAU);
  ctx.strokeStyle = rgba(c.pal.accent3, 0.7);
  ctx.lineWidth = 3;
  ctx.stroke();
};

const drawTrashPile: DrawFn = (ctx, p, c) => {
  const s = p.s * 24;
  groundShadow(ctx, p.x, p.y, s, s * 0.3, 0.3);
  for (let i = 0; i < 4; i++) {
    blob(ctx, p.x + (R(p, i) - 0.5) * s * 0.9, p.y - s * (0.2 + R(p, i + 6) * 0.6), s * 0.36, s * 0.3, p.seed + i, 0.3, 8);
    fillStroke(ctx, ['#5a5348', '#6b6350', '#484a44', '#7a6a52'][i], c.pal.ink, 2.2);
  }
};

const drawCable: DrawFn = (ctx, p, c) => {
  const s = p.s * 60;
  const y0 = p.y - s * 1.4;
  const sag = Math.sin(c.t * 0.6 + p.seed) * 4;
  for (let k = 0; k < 2; k++) {
    ctx.beginPath();
    ctx.moveTo(p.x - s, y0 + k * 7);
    ctx.quadraticCurveTo(p.x, y0 + s * 0.4 + sag + k * 7, p.x + s, y0 + k * 7);
    ctx.strokeStyle = k ? 'rgba(20,26,22,0.7)' : 'rgba(40,50,44,0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
};

const drawDrip: DrawFn = (ctx, p, c) => {
  const s = p.s * 16;
  const ph = (c.t * 0.55 + p.seed * 0.01) % 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y - s * 3.2, s * 0.12, 0, TAU);
  ctx.fillStyle = rgba(c.pal.waterFoam, 0.4);
  ctx.fill();
  const y = p.y - s * 3.2 + ph * s * 3.2;
  ctx.beginPath();
  ctx.ellipse(p.x, y, s * 0.09, s * 0.16, 0, 0, TAU);
  ctx.fillStyle = rgba(c.pal.waterFoam, 0.6);
  ctx.fill();
  if (ph > 0.92) {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s * (ph - 0.92) * 12, s * (ph - 0.92) * 4, 0, 0, TAU);
    ctx.strokeStyle = rgba(c.pal.waterFoam, 0.4);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
};

const drawBrokenTile: DrawFn = (ctx, p, c) => {
  const s = p.s * 18;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  for (let i = 0; i < 3; i++) {
    poly(ctx, [
      (R(p, i) - 0.5) * s, (R(p, i + 3) - 0.5) * s,
      (R(p, i + 6) - 0.5) * s + s * 0.4, (R(p, i + 9) - 0.5) * s,
      (R(p, i + 12) - 0.5) * s, (R(p, i + 15) - 0.5) * s + s * 0.4,
    ]);
    ctx.fillStyle = 'rgba(180,185,175,0.22)';
    ctx.fill();
  }
  ctx.restore();
};

// ---------------------------------------------------------------------------
// TOITS
// ---------------------------------------------------------------------------

const drawChimney: DrawFn = (ctx, p, c) => {
  const s = p.s * 26;
  groundShadow(ctx, p.x, p.y, s * 0.9, s * 0.3, 0.4);
  roundRect(ctx, p.x - s * 0.5, p.y - s * 1.7, s, s * 1.7, 3);
  fillStroke(ctx, '#8a5548', c.pal.ink, 2.8);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.48, p.y - s * 0.2 - i * s * 0.3);
    ctx.lineTo(p.x + s * 0.48, p.y - s * 0.2 - i * s * 0.3);
    ctx.strokeStyle = 'rgba(40,25,25,0.4)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  roundRect(ctx, p.x - s * 0.6, p.y - s * 1.86, s * 1.2, s * 0.2, 3);
  fillStroke(ctx, '#a0655a', c.pal.ink, 2.4);
  for (let i = 0; i < 5; i++) {
    const ph = (c.t * 0.28 + i * 0.2 + p.seed * 0.01) % 1;
    ctx.beginPath();
    ctx.arc(p.x + Math.sin(ph * 5 + i) * s * 0.6 + ph * s * 0.5, p.y - s * 2 - ph * s * 3.4, s * (0.22 + ph * 0.75), 0, TAU);
    ctx.fillStyle = `rgba(200,200,210,${(1 - ph) * 0.22})`;
    ctx.fill();
  }
};

const drawAntenna: DrawFn = (ctx, p, c) => {
  const s = p.s * 30;
  const sway = Math.sin(c.t * 2.2 + p.seed) * 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + sway, p.y - s * 2.6);
  ctx.strokeStyle = '#2b3247';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  for (let i = 1; i <= 3; i++) {
    const y = p.y - s * (0.9 + i * 0.5);
    const w = s * (0.5 - i * 0.1);
    ctx.beginPath();
    ctx.moveTo(p.x - w + sway * (i / 3), y);
    ctx.lineTo(p.x + w + sway * (i / 3), y);
    ctx.strokeStyle = '#39415c';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  const blink = Math.sin(c.t * 3) > 0.6;
  if (blink) glow(ctx, p.x + sway, p.y - s * 2.6, 18, '#ff4d5e', 0.7);
  ctx.beginPath();
  ctx.arc(p.x + sway, p.y - s * 2.6, 3, 0, TAU);
  ctx.fillStyle = blink ? '#ff6a76' : '#5a2a30';
  ctx.fill();
};

const drawAcUnit: DrawFn = (ctx, p, c) => {
  const s = p.s * 24;
  groundShadow(ctx, p.x, p.y, s * 0.95, s * 0.3, 0.36);
  roundRect(ctx, p.x - s * 0.65, p.y - s * 0.95, s * 1.3, s * 0.95, 4);
  fillStroke(ctx, '#8d97ac', c.pal.ink, 2.6);
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y - s * 0.5, s * 0.34, 0, TAU);
  ctx.clip();
  ctx.fillStyle = '#3c4358';
  ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
  ctx.save();
  ctx.translate(p.x, p.y - s * 0.5);
  ctx.rotate(c.t * 4 + p.seed);
  for (let i = 0; i < 3; i++) {
    ctx.rotate(TAU / 3);
    ctx.beginPath();
    ctx.ellipse(s * 0.16, 0, s * 0.18, s * 0.07, 0, 0, TAU);
    ctx.fillStyle = '#b8c2d4';
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(p.x, p.y - s * 0.5, s * 0.34, 0, TAU);
  ctx.strokeStyle = c.pal.ink;
  ctx.lineWidth = 2.4;
  ctx.stroke();
};

const drawLaundry: DrawFn = (ctx, p, c) => {
  const s = p.s * 60;
  const y0 = p.y - s * 1.6;
  ctx.beginPath();
  ctx.moveTo(p.x - s, y0);
  ctx.quadraticCurveTo(p.x, y0 + s * 0.22, p.x + s, y0);
  ctx.strokeStyle = 'rgba(20,26,43,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const cols = ['#ff8fae', '#8fd6ff', '#ffe08a', '#c9a5ff', '#a8f0c0'];
  for (let i = 0; i < 5; i++) {
    const u = (i + 0.5) / 5;
    const bx = p.x - s + u * s * 2;
    const by = y0 + Math.sin(u * Math.PI) * s * 0.2;
    const flap = Math.sin(c.t * 2 + i + p.seed) * 0.16;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(flap);
    poly(ctx, [-s * 0.16, 0, s * 0.16, 0, s * 0.2, s * 0.5, -s * 0.2, s * 0.5]);
    fillStroke(ctx, cols[i % cols.length], 'rgba(20,26,43,0.7)', 2);
    ctx.restore();
  }
};

const drawWaterTank: DrawFn = (ctx, p, c) => {
  const s = p.s * 32;
  groundShadow(ctx, p.x, p.y, s * 1.1, s * 0.3, 0.4);
  for (const sx of [-0.6, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(p.x + sx * s * 0.7, p.y);
    ctx.lineTo(p.x + sx * s * 0.5, p.y - s * 0.9);
    ctx.strokeStyle = '#4a5268';
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  roundRect(ctx, p.x - s * 0.65, p.y - s * 2.1, s * 1.3, s * 1.25, s * 0.16);
  fillStroke(ctx, '#7a6252', c.pal.ink, 3);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.63, p.y - s * 1.05 - i * s * 0.3);
    ctx.lineTo(p.x + s * 0.63, p.y - s * 1.05 - i * s * 0.3);
    ctx.strokeStyle = 'rgba(30,25,20,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  poly(ctx, [p.x - s * 0.7, p.y - s * 2.1, p.x + s * 0.7, p.y - s * 2.1, p.x, p.y - s * 2.6]);
  fillStroke(ctx, '#5f4c42', c.pal.ink, 2.6);
};

const drawNeonSign: DrawFn = (ctx, p, c) => {
  const s = p.s * 26;
  const fl = flicker(c.t, p.seed, 5);
  const col = [c.pal.accent, c.pal.accent2, c.pal.accent3][p.seed % 3];
  groundShadow(ctx, p.x, p.y, s * 0.5, s * 0.2, 0.3);
  roundRect(ctx, p.x - 4, p.y - s * 1.4, 8, s * 1.4, 2);
  fillStroke(ctx, '#2b3247', c.pal.ink, 2);
  glow(ctx, p.x, p.y - s * 2.0, s * 3.2 * fl, col, 0.35 * fl);
  roundRect(ctx, p.x - s * 0.85, p.y - s * 2.6, s * 1.7, s * 1.15, 6);
  fillStroke(ctx, '#1c2136', c.pal.ink, 2.6);
  ctx.save();
  ctx.globalAlpha = fl;
  ctx.strokeStyle = shade(col, 0.3);
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  const kind = p.seed % 3;
  ctx.beginPath();
  if (kind === 0) {
    ctx.arc(p.x, p.y - s * 2.02, s * 0.34, 0.3, Math.PI * 1.7);
  } else if (kind === 1) {
    ctx.moveTo(p.x - s * 0.4, p.y - s * 1.7);
    ctx.lineTo(p.x - s * 0.4, p.y - s * 2.35);
    ctx.lineTo(p.x + s * 0.35, p.y - s * 1.7);
    ctx.lineTo(p.x + s * 0.35, p.y - s * 2.35);
  } else {
    ctx.moveTo(p.x - s * 0.42, p.y - s * 2.3);
    ctx.lineTo(p.x + s * 0.42, p.y - s * 2.3);
    ctx.moveTo(p.x, p.y - s * 2.3);
    ctx.lineTo(p.x, p.y - s * 1.72);
  }
  ctx.stroke();
  ctx.restore();
};

const drawDish: DrawFn = (ctx, p, c) => {
  const s = p.s * 22;
  groundShadow(ctx, p.x, p.y, s * 0.7, s * 0.24, 0.3);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + s * 0.2, p.y - s * 0.8);
  ctx.strokeStyle = '#4a5268';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.save();
  ctx.translate(p.x + s * 0.2, p.y - s * 0.95);
  ctx.rotate(-0.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.6, s * 0.44, 0, 0, TAU);
  fillStroke(ctx, '#cfd6e4', c.pal.ink, 2.4);
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.34, s * 0.24, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(60,70,95,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
};

const drawSkylight: DrawFn = (ctx, p, c) => {
  const s = p.s * 26;
  const fl = 0.6 + 0.4 * flicker(c.t, p.seed, 1.2);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot * 0.1);
  roundRect(ctx, -s * 0.8, -s * 0.55, s * 1.6, s * 1.1, 4);
  fillStroke(ctx, '#3a425c', c.pal.ink, 2.6);
  roundRect(ctx, -s * 0.66, -s * 0.44, s * 1.32, s * 0.88, 3);
  ctx.fillStyle = rgba('#ffd84d', 0.35 * fl);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.66, 0);
  ctx.lineTo(s * 0.66, 0);
  ctx.moveTo(0, -s * 0.44);
  ctx.lineTo(0, s * 0.44);
  ctx.strokeStyle = '#2b3247';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.restore();
  glow(ctx, p.x, p.y, s * 2, '#ffd84d', 0.16 * fl);
};

const drawVentRoof: DrawFn = (ctx, p, c) => {
  const s = p.s * 20;
  groundShadow(ctx, p.x, p.y, s * 0.8, s * 0.26, 0.34);
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.4, p.y);
  ctx.lineTo(p.x - s * 0.3, p.y - s * 0.7);
  ctx.lineTo(p.x + s * 0.3, p.y - s * 0.7);
  ctx.lineTo(p.x + s * 0.4, p.y);
  ctx.closePath();
  fillStroke(ctx, '#7d879c', c.pal.ink, 2.4);
  ellipse(ctx, p.x, p.y - s * 0.78, s * 0.52, s * 0.2, 0);
  fillStroke(ctx, '#9aa4b8', c.pal.ink, 2.2);
};

const drawCrateRoof: DrawFn = (ctx, p, c) => {
  const s = p.s * 22;
  groundShadow(ctx, p.x, p.y, s * 0.9, s * 0.28, 0.34);
  roundRect(ctx, p.x - s * 0.55, p.y - s, s * 1.1, s, 3);
  fillStroke(ctx, '#6e5a48', c.pal.ink, 2.4);
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.5, p.y - s * 0.5);
  ctx.lineTo(p.x + s * 0.5, p.y - s * 0.5);
  ctx.strokeStyle = 'rgba(30,25,20,0.4)';
  ctx.lineWidth = 2.4;
  ctx.stroke();
};

const drawPipeRoof: DrawFn = (ctx, p, c) => {
  const s = p.s * 30;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  roundRect(ctx, -s, -s * 0.11, s * 2, s * 0.22, s * 0.11);
  fillStroke(ctx, '#59617a', 'rgba(0,0,0,0.35)', 1.8);
  ctx.restore();
};

const drawTarPatch: DrawFn = (ctx, p, c) => {
  const s = p.s * 26;
  blob(ctx, p.x, p.y, s, s * 0.6, p.seed, 0.3, 11);
  ctx.fillStyle = 'rgba(20,24,38,0.35)';
  ctx.fill();
};

// ---------------------------------------------------------------------------
// FORTERESSE
// ---------------------------------------------------------------------------

const drawCheeseWheel: DrawFn = (ctx, p, c) => {
  const s = p.s * 30;
  groundShadow(ctx, p.x, p.y, s * 1.0, s * 0.3, 0.4);
  roundRect(ctx, p.x - s * 0.72, p.y - s * 0.85, s * 1.44, s * 0.85, s * 0.14);
  fillStroke(ctx, '#e8b53c', c.pal.ink, 3);
  ellipse(ctx, p.x, p.y - s * 0.85, s * 0.72, s * 0.26, 0);
  fillStroke(ctx, '#f5cf62', c.pal.ink, 2.6);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(p.x + (R(p, i) - 0.5) * s * 1.0, p.y - s * (0.15 + R(p, i + 5) * 0.55), s * (0.06 + R(p, i + 9) * 0.09), 0, TAU);
    ctx.fillStyle = 'rgba(150,95,20,0.55)';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(p.x - s * 0.2, p.y - s * 0.88, s * 0.22, s * 0.08, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
};

const drawGear: DrawFn = (ctx, p, c) => {
  const s = p.s * 30;
  groundShadow(ctx, p.x, p.y, s * 0.9, s * 0.3, 0.4);
  ctx.save();
  ctx.translate(p.x, p.y - s * 0.6);
  ctx.rotate(c.t * 0.6 * (p.seed % 2 ? 1 : -1));
  const teeth = 10;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * TAU;
    const r = i % 2 === 0 ? s * 0.72 : s * 0.56;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  fillStroke(ctx, '#7d6a58', c.pal.ink, 2.8);
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.22, 0, TAU);
  fillStroke(ctx, '#4a4038', c.pal.ink, 2.4);
  ctx.restore();
};

const drawPipeSteam: DrawFn = (ctx, p, c) => {
  const s = p.s * 26;
  groundShadow(ctx, p.x, p.y, s * 0.8, s * 0.26, 0.36);
  roundRect(ctx, p.x - s * 0.34, p.y - s * 1.5, s * 0.68, s * 1.5, s * 0.16);
  fillStroke(ctx, '#6b5d52', c.pal.ink, 2.6);
  roundRect(ctx, p.x - s * 0.46, p.y - s * 1.66, s * 0.92, s * 0.24, 3);
  fillStroke(ctx, '#877568', c.pal.ink, 2.4);
  for (let i = 0; i < 4; i++) {
    const ph = (c.t * 0.5 + i * 0.25 + p.seed * 0.01) % 1;
    ctx.beginPath();
    ctx.arc(p.x + s * 0.6 + ph * s * 1.4, p.y - s * 1.5 + Math.sin(ph * 4 + i) * s * 0.2, s * (0.2 + ph * 0.6), 0, TAU);
    ctx.fillStyle = `rgba(240,235,225,${(1 - ph) * 0.24})`;
    ctx.fill();
  }
};

const drawPillar: DrawFn = (ctx, p, c) => {
  const s = p.s * 32;
  groundShadow(ctx, p.x, p.y, s * 1.0, s * 0.3, 0.44);
  roundRect(ctx, p.x - s * 0.62, p.y - s * 0.24, s * 1.24, s * 0.24, 3);
  fillStroke(ctx, '#5b4c4a', c.pal.ink, 2.6);
  roundRect(ctx, p.x - s * 0.46, p.y - s * 2.4, s * 0.92, s * 2.2, 4);
  fillStroke(ctx, '#4d4142', c.pal.ink, 3);
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.44, p.y - s * 0.4 - i * s * 0.34);
    ctx.lineTo(p.x + s * 0.44, p.y - s * 0.4 - i * s * 0.34);
    ctx.strokeStyle = 'rgba(20,15,16,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.4, p.y - s * 0.3);
  ctx.lineTo(p.x - s * 0.4, p.y - s * 2.3);
  ctx.strokeStyle = 'rgba(255,220,180,0.14)';
  ctx.lineWidth = 5;
  ctx.stroke();
};

const drawBanner: DrawFn = (ctx, p, c) => {
  const s = p.s * 30;
  const sway = Math.sin(c.t * 1.1 + p.seed) * 0.05;
  ctx.save();
  ctx.translate(p.x, p.y - s * 3.2);
  ctx.rotate(sway);
  poly(ctx, [-s * 0.5, 0, s * 0.5, 0, s * 0.5, s * 2.1, 0, s * 1.75, -s * 0.5, s * 2.1]);
  fillStroke(ctx, '#7a1f22', c.pal.ink, 2.8);
  // Embleme du rat : silhouette simple
  ctx.beginPath();
  ctx.arc(0, s * 0.85, s * 0.24, 0, TAU);
  ctx.fillStyle = '#e8d9b4';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-s * 0.2, s * 0.62, s * 0.11, 0, TAU);
  ctx.arc(s * 0.2, s * 0.62, s * 0.11, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s * 0.22, s * 1.0);
  ctx.quadraticCurveTo(s * 0.5, s * 1.25, s * 0.32, s * 1.5);
  ctx.strokeStyle = '#e8d9b4';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
};

const drawVat: DrawFn = (ctx, p, c) => {
  const s = p.s * 34;
  groundShadow(ctx, p.x, p.y, s * 1.05, s * 0.3, 0.42);
  roundRect(ctx, p.x - s * 0.72, p.y - s * 1.3, s * 1.44, s * 1.3, s * 0.12);
  fillStroke(ctx, '#5c4f48', c.pal.ink, 3);
  ellipse(ctx, p.x, p.y - s * 1.3, s * 0.72, s * 0.24, 0);
  fillStroke(ctx, shade(c.pal.water, 0.05), c.pal.ink, 2.6);
  glow(ctx, p.x, p.y - s * 1.3, s * 1.6, c.pal.accent2, 0.3);
  for (let i = 0; i < 4; i++) {
    const ph = (c.t * 0.7 + i * 0.27 + p.seed * 0.01) % 1;
    ctx.beginPath();
    ctx.arc(p.x + (R(p, i) - 0.5) * s * 0.9, p.y - s * 1.3 - ph * s * 0.5, s * 0.08 * (1 - ph), 0, TAU);
    ctx.fillStyle = rgba('#ffe08a', 0.6 * (1 - ph));
    ctx.fill();
  }
};

const drawChain: DrawFn = (ctx, p, c) => {
  const s = p.s * 20;
  const sway = Math.sin(c.t * 0.9 + p.seed) * 0.05;
  ctx.save();
  ctx.translate(p.x, p.y - s * 4);
  ctx.rotate(sway);
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(0, i * s * 0.42, s * 0.13, s * 0.24, 0, 0, TAU);
    ctx.strokeStyle = i % 2 ? '#6b5f58' : '#8a7d72';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
};

const drawCrateCheese: DrawFn = (ctx, p, c) => {
  const s = p.s * 22;
  groundShadow(ctx, p.x, p.y, s * 0.9, s * 0.28, 0.36);
  roundRect(ctx, p.x - s * 0.55, p.y - s, s * 1.1, s, 3);
  fillStroke(ctx, '#7a5c3e', c.pal.ink, 2.6);
  for (let i = 0; i < 2; i++) {
    poly(ctx, [
      p.x - s * 0.3 + i * s * 0.45, p.y - s * 1.0,
      p.x - s * 0.05 + i * s * 0.45, p.y - s * 1.42,
      p.x + s * 0.2 + i * s * 0.45, p.y - s * 1.0,
    ]);
    fillStroke(ctx, '#f0c34a', c.pal.ink, 2.2);
  }
};

const drawLampIndus: DrawFn = (ctx, p, c) => {
  const s = p.s * 24;
  const fl = flicker(c.t, p.seed, 2.6);
  const y = p.y - s * 3.4;
  ctx.beginPath();
  ctx.moveTo(p.x, y - s * 0.8);
  ctx.lineTo(p.x, y);
  ctx.strokeStyle = 'rgba(20,15,16,0.8)';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  poly(ctx, [p.x - s * 0.55, y + s * 0.42, p.x + s * 0.55, y + s * 0.42, p.x + s * 0.2, y, p.x - s * 0.2, y]);
  fillStroke(ctx, '#4b4038', c.pal.ink, 2.4);
  glow(ctx, p.x, y + s * 0.55, s * 4 * fl, c.pal.accent, 0.34 * fl);
  ctx.beginPath();
  ctx.arc(p.x, y + s * 0.5, s * 0.2, 0, TAU);
  ctx.fillStyle = shade(c.pal.accent, 0.5 * fl);
  ctx.fill();
};

const drawRivetPlate: DrawFn = (ctx, p, c) => {
  const s = p.s * 26;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.round(p.rot / (Math.PI / 2)) * (Math.PI / 2));
  roundRect(ctx, -s * 0.8, -s * 0.5, s * 1.6, s, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const rx = (i % 2 ? 1 : -1) * s * 0.64;
    const ry = (i < 2 ? -1 : 1) * s * 0.34;
    ctx.beginPath();
    ctx.arc(rx, ry, 2.4, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
  }
  ctx.restore();
};

const drawBoltPile: DrawFn = (ctx, p, c) => {
  const s = p.s * 14;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(p.x + (R(p, i) - 0.5) * s * 2, p.y + (R(p, i + 5) - 0.5) * s, s * 0.16, 0, TAU);
    ctx.fillStyle = 'rgba(120,110,100,0.6)';
    ctx.fill();
  }
};

const drawFurnace: DrawFn = (ctx, p, c) => {
  const s = p.s * 34;
  const fl = flicker(c.t, p.seed, 4);
  groundShadow(ctx, p.x, p.y, s * 1.1, s * 0.3, 0.45);
  roundRect(ctx, p.x - s * 0.8, p.y - s * 1.8, s * 1.6, s * 1.8, 5);
  fillStroke(ctx, '#443733', c.pal.ink, 3);
  ctx.beginPath();
  ctx.arc(p.x, p.y - s * 0.75, s * 0.42, 0, TAU);
  ctx.fillStyle = shade('#ff6a2b', fl * 0.4);
  ctx.fill();
  glow(ctx, p.x, p.y - s * 0.75, s * 2.4 * fl, '#ff6a2b', 0.4 * fl);
  ctx.beginPath();
  ctx.arc(p.x, p.y - s * 0.75, s * 0.42, 0, TAU);
  ctx.strokeStyle = c.pal.ink;
  ctx.lineWidth = 3;
  ctx.stroke();
};

// ---------------------------------------------------------------------------
// COMMUN
// ---------------------------------------------------------------------------

/** Trou de souris : galerie que seules les souris empruntent. */
const drawMouseHole: DrawFn = (ctx, p, c) => {
  const s = p.s * 20;
  // Halo sombre pour que le trou se detache du sol
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, s * 1.15, s * 0.8, 0, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fill();
  // Arche
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.72, p.y + s * 0.34);
  ctx.quadraticCurveTo(p.x - s * 0.72, p.y - s * 0.85, p.x, p.y - s * 0.85);
  ctx.quadraticCurveTo(p.x + s * 0.72, p.y - s * 0.85, p.x + s * 0.72, p.y + s * 0.34);
  ctx.closePath();
  ctx.fillStyle = '#120d16';
  ctx.fill();
  ctx.strokeStyle = c.pal.ink;
  ctx.lineWidth = 3;
  ctx.stroke();
  // Terre remuee au seuil + petites empreintes
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + s * 0.38, s * 0.8, s * 0.2, 0, 0, TAU);
  ctx.fillStyle = 'rgba(120,90,60,0.55)';
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(p.x - s * 0.4 + i * s * 0.4, p.y + s * 0.6, 2.4, 3.2, 0, 0, TAU);
    ctx.fillStyle = 'rgba(60,45,30,0.5)';
    ctx.fill();
  }
};

const drawCheesePile: DrawFn = (ctx, p, c) => {
  const s = p.s * 18;
  groundShadow(ctx, p.x, p.y, s * 1.1, s * 0.32, 0.26);
  const n = 3 + Math.floor(R(p, 0) * 3);
  for (let i = 0; i < n; i++) {
    const ox = (R(p, i) - 0.5) * s * 1.4;
    const oy = -R(p, i + 5) * s * 0.7;
    poly(ctx, [p.x + ox - s * 0.4, p.y + oy, p.x + ox + s * 0.4, p.y + oy, p.x + ox, p.y + oy - s * 0.62]);
    fillStroke(ctx, i % 2 ? '#f0c34a' : '#ffd76a', c.pal.ink, 2.2);
    ctx.beginPath();
    ctx.arc(p.x + ox, p.y + oy - s * 0.2, s * 0.08, 0, TAU);
    ctx.fillStyle = 'rgba(150,95,20,0.5)';
    ctx.fill();
  }
};

const DRAWERS: Record<string, DrawFn> = {
  grassTuft: drawGrassTuft, daisy: drawDaisy, stone: drawStone, bush: drawBush, pot: drawPot,
  mushroom: drawMushroom, gnome: drawGnome, fence: drawFence, wateringCan: drawWateringCan,
  wheelbarrow: drawWheelbarrow, logs: drawLogs, hose: drawHose, birdbath: drawBirdbath, tree: drawTree,
  crate: drawCrate, barrel: drawBarrel, stall: drawStall, lantern: drawLantern, basket: drawBasket,
  sack: drawSack, sign: drawSign, umbrella: drawUmbrella, steamVent: drawSteamVent, puddle: drawPuddle,
  cart: drawCart, garland: drawGarland, melon: drawMelon,
  pipe: drawPipe, valve: drawValve, sleeper: drawSleeper, grate: drawGrate, moss: drawMoss,
  neonTube: drawNeonTube, barrelRust: drawBarrelRust, wagon: drawWagon, trashPile: drawTrashPile,
  cable: drawCable, drip: drawDrip, brokenTile: drawBrokenTile,
  chimney: drawChimney, antenna: drawAntenna, acUnit: drawAcUnit, laundry: drawLaundry,
  waterTank: drawWaterTank, neonSign: drawNeonSign, dish: drawDish, skylight: drawSkylight,
  ventRoof: drawVentRoof, crateRoof: drawCrateRoof, pipeRoof: drawPipeRoof, tarPatch: drawTarPatch,
  cheeseWheel: drawCheeseWheel, gear: drawGear, pipeSteam: drawPipeSteam, pillar: drawPillar,
  banner: drawBanner, vat: drawVat, chain: drawChain, crateCheese: drawCrateCheese,
  lampIndus: drawLampIndus, rivetPlate: drawRivetPlate, boltPile: drawBoltPile, furnace: drawFurnace,
  cheesePile: drawCheesePile, mouseHole: drawMouseHole,
};

export function drawProp(ctx: Ctx, p: Prop, c: PropDrawCtx) {
  // Un PNG d'override remplace le rendu procedural s'il existe.
  if (overrides.has(`prop/${p.kind}`)) {
    overrides.draw(`prop/${p.kind}`, ctx, p.x, p.y, 64 * p.s, p.rot);
    return;
  }
  const fn = DRAWERS[p.kind];
  if (fn) fn(ctx, p, c);
}

// --- Decals (cuits dans le sol) ---------------------------------------------

export function drawDecal(ctx: Ctx, kind: string, x: number, y: number, rot: number, s: number, seed: number, pal: WorldPalette) {
  switch (kind) {
    case 'pawPrint': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = pal.shadow;
      ellipse(ctx, 0, 0, 4 * s, 5 * s, 0);
      ctx.fill();
      for (let i = -1; i <= 1; i++) {
        ellipse(ctx, i * 4.2 * s, -6 * s, 1.7 * s, 2.2 * s, 0);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      break;
    }
    case 'graffiti': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = 0.55;
      const col = [pal.accent, pal.accent2, pal.accent3][seed % 3];
      ctx.strokeStyle = col;
      ctx.lineWidth = 3 * s;
      ctx.lineCap = 'round';
      const k = seed % 4;
      ctx.beginPath();
      if (k === 0) {
        // Tete de souris stylisee
        ctx.arc(0, 0, 9 * s, 0, TAU);
        ctx.moveTo(-9 * s, -6 * s);
        ctx.arc(-8 * s, -8 * s, 4 * s, 0, TAU);
        ctx.moveTo(9 * s, -6 * s);
        ctx.arc(8 * s, -8 * s, 4 * s, 0, TAU);
      } else if (k === 1) {
        ctx.moveTo(-14 * s, 4 * s);
        ctx.lineTo(-4 * s, -8 * s);
        ctx.lineTo(4 * s, 4 * s);
        ctx.lineTo(14 * s, -8 * s);
      } else if (k === 2) {
        ctx.moveTo(-12 * s, -6 * s);
        ctx.lineTo(12 * s, -6 * s);
        ctx.moveTo(-12 * s, 2 * s);
        ctx.lineTo(6 * s, 2 * s);
        ctx.moveTo(-12 * s, 8 * s);
        ctx.lineTo(10 * s, 8 * s);
      } else {
        star(ctx, 0, 0, 11 * s, 0.4, 5, seed);
      }
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
      break;
    }
    default:
      break;
  }
}
