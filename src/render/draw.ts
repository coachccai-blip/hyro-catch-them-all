/**
 * Primitives de dessin partagees par tout le rendu procedural.
 * Style vise : cartoon anime — contours marques, aplats, ombres douces.
 */

import { TAU, hash2, clamp01 } from '../core/math';

export type Ctx = CanvasRenderingContext2D;

// --- Couleurs ---------------------------------------------------------------

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Melange lineaire entre deux couleurs hex. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Eclaircit (amount > 0) ou assombrit (amount < 0) une couleur. */
export function shade(hex: string, amount: number): string {
  return amount >= 0 ? mix(hex, '#ffffff', amount) : mix(hex, '#000000', -amount);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// --- Formes -----------------------------------------------------------------

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU);
}

/** Forme organique irreguliere (cailloux, buissons, flaques...). */
export function blob(ctx: Ctx, x: number, y: number, rx: number, ry: number, seed: number, wobble = 0.18, points = 9) {
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * TAU;
    const n = 1 + (hash2(i, seed, seed) - 0.5) * 2 * wobble;
    const px = x + Math.cos(a) * rx * n;
    const py = y + Math.sin(a) * ry * n;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Remplit + contour cartoon en une passe. */
export function fillStroke(ctx: Ctx, fill: string | CanvasGradient, stroke?: string, lw = 2.5) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/**
 * Les ombres et les halos sont dessines des centaines de fois par frame.
 * On pre-cuit une texture par couleur puis on la blitte : cela evite de
 * recreer un degrade radial a chaque appel (gain de perf tres net).
 */
const SPRITE_SIZE = 96;
let shadowSprite: HTMLCanvasElement | null = null;
const glowSprites = new Map<string, HTMLCanvasElement>();

function getShadowSprite(): HTMLCanvasElement {
  if (shadowSprite) return shadowSprite;
  const { canvas, ctx } = offscreen(SPRITE_SIZE, SPRITE_SIZE);
  const r = SPRITE_SIZE / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  shadowSprite = canvas;
  return canvas;
}

function getGlowSprite(color: string): HTMLCanvasElement {
  let s = glowSprites.get(color);
  if (s) return s;
  const { canvas, ctx } = offscreen(SPRITE_SIZE, SPRITE_SIZE);
  const r = SPRITE_SIZE / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, rgba(color, 1));
  g.addColorStop(0.45, rgba(color, 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  glowSprites.set(color, canvas);
  if (glowSprites.size > 40) glowSprites.clear();
  return canvas;
}

/** Ombre portee douce au sol (ellipse degradee). */
export function groundShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.28) {
  if (rx <= 0 || ry <= 0) return;
  const sp = getShadowSprite();
  ctx.save();
  ctx.globalAlpha = ctx.globalAlpha * alpha;
  ctx.drawImage(sp, x - rx, y - ry, rx * 2, ry * 2);
  ctx.restore();
}

/** Halo lumineux (lanternes, neons, fondue). */
export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 0.5) {
  if (r <= 0 || alpha <= 0.004) return;
  const sp = getGlowSprite(color);
  ctx.save();
  ctx.globalAlpha = ctx.globalAlpha * Math.min(1, alpha);
  ctx.drawImage(sp, x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

export function star(ctx: Ctx, x: number, y: number, r: number, inner = 0.45, points = 5, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i / (points * 2)) * TAU - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * inner;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function heart(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.32);
  ctx.bezierCurveTo(x - s * 0.15, y + s * 0.05, x - s, y - s * 0.1, x - s * 0.52, y - s * 0.5);
  ctx.bezierCurveTo(x - s * 0.2, y - s * 0.78, x, y - s * 0.45, x, y - s * 0.28);
  ctx.bezierCurveTo(x, y - s * 0.45, x + s * 0.2, y - s * 0.78, x + s * 0.52, y - s * 0.5);
  ctx.bezierCurveTo(x + s, y - s * 0.1, x + s * 0.15, y + s * 0.05, x, y + s * 0.32);
  ctx.closePath();
}

/** Trace une polyligne fermee a partir d'un tableau plat [x0,y0,x1,y1,...]. */
export function poly(ctx: Ctx, pts: number[], close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
}

/** Courbe lisse passant par une suite de points (Catmull-Rom simplifiee). */
export function smoothPath(ctx: Ctx, pts: number[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length - 2; i += 2) {
    const cx = (pts[i] + pts[i + 2]) / 2;
    const cy = (pts[i + 1] + pts[i + 3]) / 2;
    ctx.quadraticCurveTo(pts[i], pts[i + 1], cx, cy);
  }
  ctx.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
}

// --- Texte ------------------------------------------------------------------

export const FONT_STACK = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export function setFont(ctx: Ctx, size: number, weight: 'normal' | 'bold' | '900' = 'bold') {
  ctx.font = `${weight} ${size}px ${FONT_STACK}`;
}

/** Texte avec contour, toujours lisible quel que soit le fond. */
export function outlinedText(
  ctx: Ctx, text: string, x: number, y: number, size: number,
  fill = '#ffffff', stroke = '#1a1226', lw = 5, align: CanvasTextAlign = 'center',
  weight: 'normal' | 'bold' | '900' = 'bold',
) {
  setFont(ctx, size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Decoupe un texte en lignes pour une largeur donnee. */
export function wrapText(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// --- Panneaux UI ------------------------------------------------------------

export function panel(
  ctx: Ctx, x: number, y: number, w: number, h: number,
  opts: { fill?: string; stroke?: string; radius?: number; alpha?: number; glowColor?: string } = {},
) {
  const { fill = '#141a2e', stroke = '#f7e7bd', radius = 18, alpha = 0.92, glowColor } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  roundRect(ctx, x, y, w, h, radius);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, shade(fill, 0.1));
  g.addColorStop(1, shade(fill, -0.14));
  ctx.fillStyle = g;
  ctx.fill();
  // Halo de selection : un double contour plutot qu'un shadowBlur, bien plus
  // rapide (le flou d'ombre est l'une des operations les plus couteuses du
  // canvas 2D, surtout sur mobile).
  if (glowColor) {
    ctx.lineWidth = 8;
    ctx.strokeStyle = rgba(typeof glowColor === 'string' && glowColor.startsWith('#') ? glowColor : stroke, 0.22);
    ctx.stroke();
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  // Lisere interieur pour l'effet "carton epais"
  roundRect(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(4, radius - 6));
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(stroke, 0.22);
  ctx.stroke();
  ctx.restore();
}

/** Bandeau titre en biais facon cartoon. */
export function ribbon(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, stroke = '#2a1c34') {
  ctx.save();
  poly(ctx, [x, y, x + w, y - h * 0.12, x + w, y + h * 0.88, x, y + h]);
  fillStroke(ctx, color, stroke, 3);
  ctx.restore();
}

// --- Divers -----------------------------------------------------------------

/** Cache de motifs/gradients pour eviter de recreer a chaque frame. */
const gradCache = new Map<string, CanvasGradient>();
export function cachedLinear(
  ctx: Ctx, key: string, x0: number, y0: number, x1: number, y1: number, stops: [number, string][],
): CanvasGradient {
  const k = `${key}|${x0}|${y0}|${x1}|${y1}`;
  let g = gradCache.get(k);
  if (!g) {
    g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [p, c] of stops) g.addColorStop(p, c);
    gradCache.set(k, g);
    if (gradCache.size > 220) gradCache.clear();
  }
  return g;
}

/** Cree un canvas hors ecran (pre-rendu de decors, atlas). */
export function offscreen(w: number, h: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(w));
  canvas.height = Math.max(1, Math.floor(h));
  const ctx = canvas.getContext('2d', { alpha: true })!;
  return { canvas, ctx };
}

/** Applique un tremblement d'ecran (decalage pseudo-aleatoire amorti). */
export function shakeOffset(power: number, time: number): { x: number; y: number } {
  if (power <= 0) return { x: 0, y: 0 };
  return {
    x: Math.sin(time * 61.3) * power + Math.sin(time * 27.1) * power * 0.4,
    y: Math.cos(time * 53.7) * power + Math.cos(time * 31.9) * power * 0.4,
  };
}

/** Cercle pointille anime (reticule, zones). */
export function dashedCircle(ctx: Ctx, x: number, y: number, r: number, dash: number, offset: number, color: string, lw = 2) {
  ctx.save();
  ctx.setLineDash([dash, dash * 0.75]);
  ctx.lineDashOffset = -offset;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

export function pulse(t: number, speed = 1): number {
  return 0.5 + 0.5 * Math.sin(t * speed * TAU);
}

export function flicker(t: number, seed: number, speed = 8): number {
  const a = Math.sin(t * speed + seed) * 0.5 + 0.5;
  const b = Math.sin(t * speed * 2.7 + seed * 3.1) * 0.5 + 0.5;
  return clamp01(0.55 + a * 0.3 + b * 0.25);
}
