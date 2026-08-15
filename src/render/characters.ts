/**
 * Rendu des personnages, entierement vectoriel.
 * Style cartoon anime : contours epais, aplats, yeux expressifs,
 * silhouettes lisibles en vue de dessus 3/4.
 */

import { TAU, clamp01, wrapAngle } from '../core/math';
import { BANDANA_COLORS, BANDANA_SYMBOLS } from './palette';
import { overrides } from './overrides';
import {
  ellipse, fillStroke, groundShadow, poly, rgba, roundRect, shade, star, glow,
  type Ctx,
} from './draw';

const INK = '#2a1e18';

export interface HyroView {
  x: number;
  y: number;
  /** Direction du regard (radians). */
  dir: number;
  /** 0 = immobile, 1 = pleine course. */
  move: number;
  /** Temps d'animation cumule. */
  anim: number;
  state: 'idle' | 'run' | 'net' | 'sword' | 'hurt' | 'win' | 'dash' | 'glide';
  /** Avancement de l'action en cours (0..1). */
  action: number;
  /** Clignotement d'invulnerabilite (0 = visible). */
  blink: number;
  scale: number;
}

/** Chat heroique : Hyro. */
export function drawHyro(ctx: Ctx, v: HyroView) {
  if (v.blink > 0.5) return;
  if (overrides.draw('hyro/body', ctx, v.x, v.y, 96 * v.scale, 0, Math.cos(v.dir) < 0)) return;

  const s = 22 * v.scale;
  const fx = Math.cos(v.dir);
  const fy = Math.sin(v.dir);
  const back = fy < -0.35; // dos tourne
  const bob = v.state === 'run' ? Math.sin(v.anim * 14) * 2.2 * v.move : Math.sin(v.anim * 2.2) * 0.9;
  const lean = v.state === 'dash' ? 0.22 : 0;

  ctx.save();
  groundShadow(ctx, v.x, v.y + 3, s * 1.15, s * 0.42, 0.32);

  if (v.state === 'glide') {
    // Cape planeur deployee
    ctx.save();
    ctx.translate(v.x, v.y - s * 1.0 + bob);
    ctx.rotate(fx * 0.1);
    poly(ctx, [-s * 2.1, -s * 0.2, 0, -s * 0.9, s * 2.1, -s * 0.2, s * 1.2, s * 0.5, -s * 1.2, s * 0.5]);
    fillStroke(ctx, '#4a6fd6', INK, 3);
    ctx.beginPath();
    ctx.moveTo(-s * 1.6, -s * 0.1);
    ctx.lineTo(0, s * 0.4);
    ctx.lineTo(s * 1.6, -s * 0.1);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  // --- Queue -----------------------------------------------------------------
  const tailPhase = v.anim * (v.state === 'run' ? 9 : 2.4);
  const tx = v.x - fx * s * 0.85;
  const ty = v.y - s * 0.55 - fy * s * 0.5;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  const swing = Math.sin(tailPhase) * s * 0.75;
  ctx.bezierCurveTo(
    tx - fx * s * 0.8 + swing * 0.4, ty - s * 0.5,
    tx - fx * s * 1.5 + swing, ty - s * 1.2,
    tx - fx * s * 1.4 + swing * 1.4, ty - s * 1.9,
  );
  ctx.strokeStyle = INK;
  ctx.lineWidth = s * 0.42;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#f2a33c';
  ctx.lineWidth = s * 0.28;
  ctx.stroke();
  // Anneaux de la queue
  ctx.strokeStyle = '#d9822b';
  ctx.lineWidth = s * 0.12;
  ctx.beginPath();
  ctx.moveTo(tx - fx * s * 1.3 + swing * 0.9, ty - s * 1.35);
  ctx.lineTo(tx - fx * s * 1.45 + swing * 1.05, ty - s * 1.5);
  ctx.stroke();

  // --- Pattes ---------------------------------------------------------------
  const legPhase = Math.sin(v.anim * 14) * v.move;
  for (const side of [-1, 1] as const) {
    const lx = v.x + side * s * 0.42 - fy * side * s * 0.1;
    const ly = v.y - s * 0.06 + legPhase * side * s * 0.24;
    ellipse(ctx, lx, ly, s * 0.26, s * 0.18, 0);
    fillStroke(ctx, '#f7c579', INK, 2.2);
  }

  // --- Corps ---------------------------------------------------------------
  ctx.save();
  ctx.translate(v.x, v.y - s * 0.62 + bob);
  ctx.rotate(lean * fx);
  ellipse(ctx, 0, 0, s * 0.78, s * 0.66, 0);
  fillStroke(ctx, '#f5a83f', INK, 3);
  // Ventre plus clair
  ellipse(ctx, 0, s * 0.18, s * 0.52, s * 0.36, 0);
  ctx.fillStyle = '#ffe0b0';
  ctx.fill();
  // Rayures
  ctx.strokeStyle = 'rgba(190,110,30,0.65)';
  ctx.lineWidth = s * 0.13;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s * 0.3, -s * 0.5);
    ctx.lineTo(i * s * 0.3 + s * 0.06, -s * 0.2);
    ctx.stroke();
  }
  // Echarpe rouge de heros
  ctx.beginPath();
  ctx.ellipse(0, s * 0.42, s * 0.6, s * 0.2, 0, 0, TAU);
  ctx.fillStyle = '#d8412f';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  const scarf = Math.sin(v.anim * 6) * s * 0.2;
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.45);
  ctx.quadraticCurveTo(-s * 1.0 - fx * s * 0.4, s * 0.6 + scarf, -s * 1.2 - fx * s * 0.5, s * 0.2 + scarf);
  ctx.lineTo(-s * 0.9 - fx * s * 0.4, s * 0.72 + scarf);
  ctx.closePath();
  fillStroke(ctx, '#c23a2a', INK, 2);
  ctx.restore();

  // --- Tete ----------------------------------------------------------------
  const hx = v.x + fx * s * 0.34;
  const hy = v.y - s * 1.42 + bob + fy * s * 0.18;
  const headR = s * 0.72;

  // Oreilles
  for (const side of [-1, 1] as const) {
    const ex = hx + side * headR * 0.66 + fx * headR * 0.1;
    const ey = hy - headR * 0.62;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(side * 0.32 + fx * 0.18);
    poly(ctx, [-headR * 0.3, headR * 0.28, 0, -headR * 0.62, headR * 0.3, headR * 0.28]);
    fillStroke(ctx, '#f5a83f', INK, 2.6);
    poly(ctx, [-headR * 0.16, headR * 0.16, 0, -headR * 0.34, headR * 0.16, headR * 0.16]);
    ctx.fillStyle = '#ffb9c4';
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(hx, hy, headR, 0, TAU);
  fillStroke(ctx, '#f7b451', INK, 3);

  if (!back) {
    const eyeY = hy + headR * 0.02 + fy * headR * 0.18;
    const eyeDX = headR * 0.34;
    const squint = v.state === 'hurt' ? 0.35 : v.state === 'win' ? 0.2 : 1;
    for (const side of [-1, 1] as const) {
      const ex = hx + side * eyeDX + fx * headR * 0.16;
      ellipse(ctx, ex, eyeY, headR * 0.2, headR * 0.26 * squint, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      if (v.state === 'win') {
        // Yeux plisses de victoire
        ctx.beginPath();
        ctx.moveTo(ex - headR * 0.18, eyeY);
        ctx.quadraticCurveTo(ex, eyeY - headR * 0.2, ex + headR * 0.18, eyeY);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      } else {
        ellipse(ctx, ex + fx * headR * 0.06, eyeY + fy * headR * 0.04, headR * 0.1, headR * 0.15, 0);
        ctx.fillStyle = '#2c6f4f';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + fx * headR * 0.06 - headR * 0.04, eyeY - headR * 0.06, headR * 0.045, 0, TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }
    // Museau
    ellipse(ctx, hx + fx * headR * 0.14, hy + headR * 0.42, headR * 0.3, headR * 0.2, 0);
    ctx.fillStyle = '#ffe6bf';
    ctx.fill();
    poly(ctx, [hx + fx * headR * 0.14 - 3.5, hy + headR * 0.3, hx + fx * headR * 0.14 + 3.5, hy + headR * 0.3, hx + fx * headR * 0.14, hy + headR * 0.38]);
    ctx.fillStyle = '#e0708a';
    ctx.fill();
    // Bouche
    ctx.beginPath();
    ctx.moveTo(hx + fx * headR * 0.14, hy + headR * 0.4);
    ctx.quadraticCurveTo(hx + fx * headR * 0.14 - 5, hy + headR * 0.52, hx + fx * headR * 0.14 - 9, hy + headR * 0.42);
    ctx.moveTo(hx + fx * headR * 0.14, hy + headR * 0.4);
    ctx.quadraticCurveTo(hx + fx * headR * 0.14 + 5, hy + headR * 0.52, hx + fx * headR * 0.14 + 9, hy + headR * 0.42);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // Moustaches
    ctx.strokeStyle = 'rgba(60,40,25,0.7)';
    ctx.lineWidth = 1.4;
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(hx + side * headR * 0.28, hy + headR * 0.36 + i * 4);
        ctx.lineTo(hx + side * headR * 0.95, hy + headR * 0.22 + i * 7);
        ctx.stroke();
      }
    }
  } else {
    // Vu de dos : marque de fourrure
    ctx.beginPath();
    ctx.arc(hx, hy + headR * 0.1, headR * 0.42, 0, TAU);
    ctx.fillStyle = 'rgba(210,130,40,0.45)';
    ctx.fill();
  }

  // --- Actions --------------------------------------------------------------
  if (v.state === 'net') drawNetSwing(ctx, v, s, fx, fy);
  if (v.state === 'sword') drawSwordSwing(ctx, v, s, fx, fy);

  ctx.restore();
}

function drawNetSwing(ctx: Ctx, v: HyroView, s: number, fx: number, fy: number) {
  const a = clamp01(v.action);
  const ang = v.dir - 1.1 + a * 2.2;
  const len = s * 1.5;
  const px = v.x + Math.cos(ang) * len;
  const py = v.y - s * 0.9 + Math.sin(ang) * len * 0.75;
  ctx.save();
  // Manche
  ctx.beginPath();
  ctx.moveTo(v.x + fx * s * 0.3, v.y - s * 0.9);
  ctx.lineTo(px, py);
  ctx.strokeStyle = '#9a6b3c';
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  ctx.stroke();
  // Cerceau + filet
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.ellipse(s * 0.5, 0, s * 0.55, s * 0.44, 0, 0, TAU);
  ctx.strokeStyle = '#d8d2c4';
  ctx.lineWidth = s * 0.12;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(s * 0.5 + i * s * 0.2, -s * 0.4);
    ctx.lineTo(s * 0.5 + i * s * 0.2, s * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.0, i * s * 0.16);
    ctx.lineTo(s * 1.0, i * s * 0.16);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function drawSwordSwing(ctx: Ctx, v: HyroView, s: number, fx: number, fy: number) {
  const a = clamp01(v.action);
  const ang = v.dir - 1.2 + a * 2.4;
  ctx.save();
  ctx.translate(v.x + fx * s * 0.2, v.y - s * 0.9);
  ctx.rotate(ang);
  // Lame
  poly(ctx, [s * 0.5, -s * 0.1, s * 1.9, -s * 0.05, s * 2.05, 0, s * 1.9, s * 0.05, s * 0.5, s * 0.1]);
  fillStroke(ctx, '#e6eef7', '#4a5566', 2);
  roundRect(ctx, s * 0.28, -s * 0.16, s * 0.22, s * 0.32, 3);
  fillStroke(ctx, '#c9a227', INK, 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// SOURIS
// ---------------------------------------------------------------------------

export interface MouseView {
  x: number;
  y: number;
  dir: number;
  move: number;
  anim: number;
  kind: string;
  stunned: boolean;
  alerted: boolean;
  alpha: number;
  scale: number;
  glued: boolean;
}

export function drawMouse(ctx: Ctx, v: MouseView) {
  if (v.alpha <= 0.02) return;
  if (overrides.draw(`mouse/${v.kind}`, ctx, v.x, v.y, 46 * v.scale, 0, Math.cos(v.dir) < 0)) return;

  const s = 13 * v.scale;
  const fx = Math.cos(v.dir);
  const fy = Math.sin(v.dir);
  const bob = v.stunned ? 0 : Math.sin(v.anim * 16) * 1.6 * v.move;
  const col = BANDANA_COLORS[v.kind] ?? '#ffd23f';
  const fur = v.kind === 'black' ? '#4b4763' : v.kind === 'white' ? '#f4f1e6' : '#b9b3ab';
  const furDark = shade(fur, -0.2);

  ctx.save();
  ctx.globalAlpha = v.alpha;
  groundShadow(ctx, v.x, v.y + 2, s * 1.1, s * 0.4, 0.26 * v.alpha);

  // Queue
  const tail = Math.sin(v.anim * (v.stunned ? 2 : 11)) * s * 0.5;
  ctx.beginPath();
  ctx.moveTo(v.x - fx * s * 0.7, v.y - s * 0.4);
  ctx.quadraticCurveTo(v.x - fx * s * 1.6, v.y - s * 0.3 + tail, v.x - fx * s * 2.1, v.y - s * 1.0 + tail);
  ctx.strokeStyle = '#e0a5b0';
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Corps
  ellipse(ctx, v.x, v.y - s * 0.55 + bob, s * 0.72, s * 0.6, 0);
  fillStroke(ctx, fur, INK, 2.2);
  ellipse(ctx, v.x, v.y - s * 0.4 + bob, s * 0.46, s * 0.34, 0);
  ctx.fillStyle = shade(fur, 0.2);
  ctx.fill();

  // Tete
  const hx = v.x + fx * s * 0.5;
  const hy = v.y - s * 1.1 + bob;
  // Oreilles rondes
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(hx + side * s * 0.52, hy - s * 0.36, s * 0.34, 0, TAU);
    fillStroke(ctx, furDark, INK, 2);
    ctx.beginPath();
    ctx.arc(hx + side * s * 0.52, hy - s * 0.36, s * 0.19, 0, TAU);
    ctx.fillStyle = '#f0b8bf';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(hx, hy, s * 0.55, 0, TAU);
  fillStroke(ctx, fur, INK, 2.2);

  // Museau pointu
  poly(ctx, [hx + fx * s * 0.3, hy - s * 0.16, hx + fx * s * 1.0, hy + s * 0.06, hx + fx * s * 0.3, hy + s * 0.28]);
  fillStroke(ctx, shade(fur, 0.14), INK, 1.8);
  ctx.beginPath();
  ctx.arc(hx + fx * s * 0.98, hy + s * 0.06, s * 0.09, 0, TAU);
  ctx.fillStyle = '#d4707f';
  ctx.fill();

  // Yeux
  if (v.stunned) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (const side of [-1, 1] as const) {
      const ex = hx + side * s * 0.22;
      ctx.beginPath();
      ctx.moveTo(ex - s * 0.13, hy - s * 0.13);
      ctx.lineTo(ex + s * 0.13, hy + s * 0.13);
      ctx.moveTo(ex + s * 0.13, hy - s * 0.13);
      ctx.lineTo(ex - s * 0.13, hy + s * 0.13);
      ctx.stroke();
    }
  } else {
    for (const side of [-1, 1] as const) {
      const ex = hx + side * s * 0.2 + fx * s * 0.12;
      ctx.beginPath();
      ctx.arc(ex, hy - s * 0.04, s * (v.alerted ? 0.16 : 0.12), 0, TAU);
      ctx.fillStyle = '#1d1620';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex - s * 0.04, hy - s * 0.08, s * 0.045, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }

  // Bandana (identite) + symbole d'accessibilite
  ctx.save();
  ctx.translate(hx - fx * s * 0.18, hy + s * 0.42);
  ctx.rotate(fy * 0.1);
  poly(ctx, [-s * 0.55, -s * 0.12, s * 0.55, -s * 0.12, s * 0.5, s * 0.16, -s * 0.5, s * 0.16]);
  fillStroke(ctx, col, INK, 1.8);
  poly(ctx, [-s * 0.5, s * 0.06, -s * 0.95, s * 0.42, -s * 0.6, s * 0.44]);
  fillStroke(ctx, shade(col, -0.12), INK, 1.6);
  ctx.restore();

  // Symbole au-dessus (daltonisme)
  ctx.font = `bold ${Math.round(s * 0.85)}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(20,15,25,0.75)';
  ctx.strokeText(BANDANA_SYMBOLS[v.kind] ?? '▲', v.x, v.y - s * 2.45);
  ctx.fillStyle = col;
  ctx.fillText(BANDANA_SYMBOLS[v.kind] ?? '▲', v.x, v.y - s * 2.45);

  // Etoiles d'assommage
  if (v.stunned) {
    for (let i = 0; i < 3; i++) {
      const a = v.anim * 4 + (i / 3) * TAU;
      star(ctx, v.x + Math.cos(a) * s * 0.9, v.y - s * 2.2 + Math.sin(a) * s * 0.3, s * 0.32, 0.45, 5, a);
      fillStroke(ctx, '#ffe066', INK, 1.6);
    }
  }
  // Alerte
  if (v.alerted && !v.stunned) {
    ctx.font = `900 ${Math.round(s * 1.5)}px "Trebuchet MS", sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.strokeText('!', v.x + s * 0.9, v.y - s * 2.6);
    ctx.fillStyle = '#ffe066';
    ctx.fillText('!', v.x + s * 0.9, v.y - s * 2.6);
  }
  // Glue
  if (v.glued) {
    ctx.beginPath();
    ctx.ellipse(v.x, v.y, s * 1.1, s * 0.45, 0, 0, TAU);
    ctx.fillStyle = 'rgba(140,240,160,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,200,120,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// MOBS
// ---------------------------------------------------------------------------

export interface MobView {
  x: number;
  y: number;
  dir: number;
  anim: number;
  kind: string;
  hp: number;
  maxHp: number;
  scale: number;
  telegraph: number;
  /** Hauteur de vol (corbeaux, drones). */
  altitude: number;
  flash: number;
}

export function drawMob(ctx: Ctx, v: MobView) {
  if (overrides.draw(`mob/${v.kind}`, ctx, v.x, v.y, 60 * v.scale)) return;
  switch (v.kind) {
    case 'roach': drawRoach(ctx, v); break;
    case 'crow': drawCrow(ctx, v); break;
    case 'guard': drawGuard(ctx, v); break;
    case 'drone': drawDrone(ctx, v); break;
    default: drawElite(ctx, v); break;
  }
  if (v.flash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = v.flash * 0.6;
    ctx.beginPath();
    ctx.arc(v.x, v.y - 20 * v.scale, 30 * v.scale, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }
}

function drawRoach(ctx: Ctx, v: MobView) {
  const s = 16 * v.scale;
  const fx = Math.cos(v.dir);
  const fy = Math.sin(v.dir);
  groundShadow(ctx, v.x, v.y + 2, s * 1.1, s * 0.4, 0.3);
  ctx.save();
  ctx.translate(v.x, v.y - s * 0.5);
  ctx.rotate(v.dir + Math.PI / 2);
  // Pattes
  ctx.strokeStyle = '#2c2018';
  ctx.lineWidth = s * 0.13;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const w = Math.sin(v.anim * 18 + i) * s * 0.18;
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.45, i * s * 0.35);
      ctx.lineTo(side * s * 1.0, i * s * 0.42 + w);
      ctx.stroke();
    }
  }
  // Carapace
  ellipse(ctx, 0, 0, s * 0.62, s * 0.95, 0);
  fillStroke(ctx, '#7a4a22', '#241708', 2.6);
  ellipse(ctx, 0, -s * 0.1, s * 0.44, s * 0.66, 0);
  ctx.fillStyle = '#96602c';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.75);
  ctx.lineTo(0, s * 0.85);
  ctx.strokeStyle = '#3a2411';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // Plaques metalliques
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, -s * 0.4, -s * 0.55 + i * s * 0.42, s * 0.8, s * 0.2, 3);
    fillStroke(ctx, '#8d949c', '#3a3f45', 1.6);
  }
  // Tete + antennes
  ctx.beginPath();
  ctx.arc(0, -s * 0.95, s * 0.32, 0, TAU);
  fillStroke(ctx, '#5c3616', '#241708', 2.2);
  ctx.strokeStyle = '#241708';
  ctx.lineWidth = 2;
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(side * s * 0.15, -s * 1.15);
    ctx.quadraticCurveTo(side * s * 0.6, -s * 1.6, side * s * 0.45 + Math.sin(v.anim * 6) * 3, -s * 1.9);
    ctx.stroke();
  }
  // Yeux rouges
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(side * s * 0.14, -s * 1.02, s * 0.08, 0, TAU);
    ctx.fillStyle = '#ff5a4a';
    ctx.fill();
  }
  ctx.restore();
  void fx; void fy;
}

function drawCrow(ctx: Ctx, v: MobView) {
  const s = 20 * v.scale;
  const alt = v.altitude;
  groundShadow(ctx, v.x, v.y + 4, s * (0.9 - alt * 0.3), s * 0.35, 0.3 - alt * 0.12);
  const cy = v.y - s * 0.6 - alt * 90;
  const flap = Math.sin(v.anim * 9);
  ctx.save();
  ctx.translate(v.x, cy);
  ctx.rotate(Math.cos(v.dir) < 0 ? 0 : 0);
  // Ailes
  for (const side of [-1, 1] as const) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.rotate(-flap * 0.5);
    poly(ctx, [s * 0.3, -s * 0.1, s * 1.6, -s * 0.5 - flap * s * 0.3, s * 1.5, s * 0.1, s * 0.35, s * 0.3]);
    fillStroke(ctx, '#2a2b3a', '#111219', 2.4);
    ctx.restore();
  }
  // Corps
  ellipse(ctx, 0, 0, s * 0.55, s * 0.7, 0);
  fillStroke(ctx, '#3a3b4e', '#111219', 2.6);
  // Tete
  ctx.beginPath();
  ctx.arc(Math.sign(Math.cos(v.dir)) * s * 0.35, -s * 0.6, s * 0.32, 0, TAU);
  fillStroke(ctx, '#33344a', '#111219', 2.2);
  const bx = Math.sign(Math.cos(v.dir)) * s * 0.7;
  poly(ctx, [bx, -s * 0.68, bx + Math.sign(Math.cos(v.dir)) * s * 0.5, -s * 0.55, bx, -s * 0.44]);
  fillStroke(ctx, '#f0a93c', '#7a4a10', 1.8);
  ctx.beginPath();
  ctx.arc(Math.sign(Math.cos(v.dir)) * s * 0.42, -s * 0.66, s * 0.08, 0, TAU);
  ctx.fillStyle = '#ffe066';
  ctx.fill();
  ctx.restore();
  // Telegraphe de piqué
  if (v.telegraph > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.4 * Math.sin(v.anim * 18);
    ctx.strokeStyle = '#ff5a6a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(v.x, v.y, 26 * v.scale, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawGuard(ctx: Ctx, v: MobView) {
  const s = 22 * v.scale;
  const fx = Math.cos(v.dir);
  groundShadow(ctx, v.x, v.y + 3, s * 1.1, s * 0.42, 0.34);
  const bob = Math.sin(v.anim * 8) * 1.6;
  // Queue
  ctx.beginPath();
  ctx.moveTo(v.x - fx * s * 0.7, v.y - s * 0.5);
  ctx.quadraticCurveTo(v.x - fx * s * 1.8, v.y - s * 0.2, v.x - fx * s * 2.2, v.y - s * 1.1);
  ctx.strokeStyle = '#c8909c';
  ctx.lineWidth = s * 0.16;
  ctx.stroke();
  // Corps
  ellipse(ctx, v.x, v.y - s * 0.7 + bob, s * 0.8, s * 0.72, 0);
  fillStroke(ctx, '#6b6472', INK, 3);
  // Armure
  roundRect(ctx, v.x - s * 0.6, v.y - s * 1.0 + bob, s * 1.2, s * 0.6, 6);
  fillStroke(ctx, '#8d949c', '#3a3f45', 2.4);
  // Tete
  const hx = v.x + fx * s * 0.45;
  const hy = v.y - s * 1.5 + bob;
  ctx.beginPath();
  ctx.arc(hx, hy, s * 0.5, 0, TAU);
  fillStroke(ctx, '#77707f', INK, 2.6);
  poly(ctx, [hx + fx * s * 0.25, hy - s * 0.15, hx + fx * s * 0.95, hy + s * 0.06, hx + fx * s * 0.25, hy + s * 0.26]);
  fillStroke(ctx, '#857e8d', INK, 2);
  // Casque
  ctx.beginPath();
  ctx.arc(hx, hy - s * 0.1, s * 0.54, Math.PI, 0);
  ctx.closePath();
  fillStroke(ctx, '#9aa2ac', '#3a3f45', 2.4);
  ctx.beginPath();
  ctx.moveTo(hx, hy - s * 0.62);
  ctx.lineTo(hx, hy - s * 0.95);
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 4;
  ctx.stroke();
  // Yeux
  ctx.beginPath();
  ctx.arc(hx + fx * s * 0.12, hy + s * 0.02, s * 0.09, 0, TAU);
  ctx.fillStyle = '#ff5a4a';
  ctx.fill();
  drawHpPips(ctx, v, s);
}

function drawDrone(ctx: Ctx, v: MobView) {
  const s = 20 * v.scale;
  const alt = 0.5 + v.altitude * 0.5;
  groundShadow(ctx, v.x, v.y + 4, s * 0.8, s * 0.3, 0.26);
  const cy = v.y - s * 1.6 - Math.sin(v.anim * 3) * 4;
  // Rotor
  ctx.save();
  ctx.translate(v.x, cy - s * 0.9);
  ctx.rotate(v.anim * 22);
  for (let i = 0; i < 3; i++) {
    ctx.rotate(TAU / 3);
    ellipse(ctx, s * 0.5, 0, s * 0.5, s * 0.08, 0);
    ctx.fillStyle = 'rgba(200,215,235,0.55)';
    ctx.fill();
  }
  ctx.restore();
  // Corps : meule de fromage motorisee
  ctx.beginPath();
  ctx.arc(v.x, cy, s * 0.62, 0, TAU);
  fillStroke(ctx, '#f0c34a', '#7a5a12', 2.8);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(v.x + Math.cos(i * 2.1 + v.anim) * s * 0.3, cy + Math.sin(i * 1.7) * s * 0.3, s * 0.09, 0, TAU);
    ctx.fillStyle = 'rgba(150,95,20,0.5)';
    ctx.fill();
  }
  // Oeil / viseur
  ctx.beginPath();
  ctx.arc(v.x + Math.cos(v.dir) * s * 0.3, cy + Math.sin(v.dir) * s * 0.2, s * 0.18, 0, TAU);
  fillStroke(ctx, v.telegraph > 0 ? '#ff5a5a' : '#4bd0ff', '#25303a', 2);
  glow(ctx, v.x + Math.cos(v.dir) * s * 0.3, cy + Math.sin(v.dir) * s * 0.2, s * (v.telegraph > 0 ? 1.6 : 1), v.telegraph > 0 ? '#ff5a5a' : '#4bd0ff', 0.5);
  drawHpPips(ctx, { ...v, y: cy + s * 0.4 } as MobView, s);
  void alt;
}

function drawElite(ctx: Ctx, v: MobView) {
  const s = 24 * v.scale;
  const fx = Math.cos(v.dir);
  groundShadow(ctx, v.x, v.y + 3, s * 1.15, s * 0.44, 0.36);
  const bob = Math.sin(v.anim * 9) * 1.8;
  ctx.beginPath();
  ctx.moveTo(v.x - fx * s * 0.7, v.y - s * 0.5);
  ctx.quadraticCurveTo(v.x - fx * s * 1.9, v.y - s * 0.1, v.x - fx * s * 2.3, v.y - s * 1.2);
  ctx.strokeStyle = '#8d5a68';
  ctx.lineWidth = s * 0.17;
  ctx.stroke();
  ellipse(ctx, v.x, v.y - s * 0.72 + bob, s * 0.84, s * 0.74, 0);
  fillStroke(ctx, '#3f3a4c', INK, 3);
  roundRect(ctx, v.x - s * 0.66, v.y - s * 1.06 + bob, s * 1.32, s * 0.66, 6);
  fillStroke(ctx, '#5b2b32', '#241119', 2.6);
  // Epaulieres
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(v.x + side * s * 0.72, v.y - s * 1.0 + bob, s * 0.26, 0, TAU);
    fillStroke(ctx, '#8d949c', '#3a3f45', 2.2);
  }
  const hx = v.x + fx * s * 0.45;
  const hy = v.y - s * 1.55 + bob;
  ctx.beginPath();
  ctx.arc(hx, hy, s * 0.5, 0, TAU);
  fillStroke(ctx, '#4a4458', INK, 2.6);
  poly(ctx, [hx + fx * s * 0.25, hy - s * 0.15, hx + fx * s * 0.98, hy + s * 0.06, hx + fx * s * 0.25, hy + s * 0.26]);
  fillStroke(ctx, '#544d63', INK, 2);
  // Visiere lumineuse
  roundRect(ctx, hx - s * 0.44, hy - s * 0.18, s * 0.9, s * 0.22, 4);
  fillStroke(ctx, v.telegraph > 0 ? '#ff5a5a' : '#ff9b3a', '#2a1410', 2);
  glow(ctx, hx, hy - s * 0.06, s * 1.2, v.telegraph > 0 ? '#ff5a5a' : '#ff9b3a', 0.4);
  drawHpPips(ctx, v, s);
}

function drawHpPips(ctx: Ctx, v: MobView, s: number) {
  if (v.maxHp <= 1) return;
  const w = s * 1.1;
  const y = v.y - s * 2.5;
  ctx.save();
  roundRect(ctx, v.x - w / 2, y, w, 6, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();
  roundRect(ctx, v.x - w / 2 + 1, y + 1, (w - 2) * clamp01(v.hp / v.maxHp), 4, 2);
  ctx.fillStyle = '#ff6a5a';
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// BOSS : NERAT
// ---------------------------------------------------------------------------

export interface BossView {
  x: number;
  y: number;
  dir: number;
  anim: number;
  hp: number;
  maxHp: number;
  phase: number;
  stunned: boolean;
  glued: boolean;
  flash: number;
  scale: number;
  charging: boolean;
}

export function drawNerat(ctx: Ctx, v: BossView) {
  if (overrides.draw('boss/nerat', ctx, v.x, v.y, 200 * v.scale)) return;
  const s = 44 * v.scale;
  const fx = Math.cos(v.dir);
  groundShadow(ctx, v.x, v.y + 6, s * 1.5, s * 0.5, 0.44);
  const bob = Math.sin(v.anim * (v.charging ? 16 : 4)) * 3;

  ctx.save();
  // Queue epaisse
  ctx.beginPath();
  ctx.moveTo(v.x - fx * s * 0.9, v.y - s * 0.6);
  ctx.quadraticCurveTo(v.x - fx * s * 2.4, v.y + Math.sin(v.anim * 3) * s * 0.4, v.x - fx * s * 3.0, v.y - s * 1.4);
  ctx.strokeStyle = '#5a4450';
  ctx.lineWidth = s * 0.24;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Cape
  const capeSway = Math.sin(v.anim * 2.4) * s * 0.2;
  ctx.beginPath();
  ctx.moveTo(v.x - s * 0.9, v.y - s * 1.5 + bob);
  ctx.quadraticCurveTo(v.x + capeSway, v.y + s * 0.2, v.x + s * 0.9, v.y - s * 1.5 + bob);
  ctx.lineTo(v.x + s * 0.7, v.y - s * 1.8 + bob);
  ctx.lineTo(v.x - s * 0.7, v.y - s * 1.8 + bob);
  ctx.closePath();
  fillStroke(ctx, '#5a1220', '#200a10', 3.4);

  // Corps
  ellipse(ctx, v.x, v.y - s * 0.85 + bob, s * 0.95, s * 0.85, 0);
  fillStroke(ctx, '#2e2a3a', '#120e18', 3.6);
  ellipse(ctx, v.x, v.y - s * 0.62 + bob, s * 0.6, s * 0.45, 0);
  ctx.fillStyle = '#3f3a4e';
  ctx.fill();
  // Plastron
  roundRect(ctx, v.x - s * 0.62, v.y - s * 1.2 + bob, s * 1.24, s * 0.7, 8);
  fillStroke(ctx, '#6b5a2a', '#2a2210', 3);
  ctx.beginPath();
  ctx.moveTo(v.x - s * 0.3, v.y - s * 0.95 + bob);
  ctx.lineTo(v.x, v.y - s * 0.6 + bob);
  ctx.lineTo(v.x + s * 0.3, v.y - s * 0.95 + bob);
  ctx.strokeStyle = '#e8c65a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Tete
  const hx = v.x + fx * s * 0.5;
  const hy = v.y - s * 1.85 + bob;
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(hx + side * s * 0.6, hy - s * 0.42, s * 0.34, 0, TAU);
    fillStroke(ctx, '#3a3448', '#120e18', 3);
    ctx.beginPath();
    ctx.arc(hx + side * s * 0.6, hy - s * 0.42, s * 0.18, 0, TAU);
    ctx.fillStyle = '#7a4a58';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(hx, hy, s * 0.62, 0, TAU);
  fillStroke(ctx, '#332e42', '#120e18', 3.2);
  poly(ctx, [hx + fx * s * 0.35, hy - s * 0.2, hx + fx * s * 1.25, hy + s * 0.08, hx + fx * s * 0.35, hy + s * 0.34]);
  fillStroke(ctx, '#3d3750', '#120e18', 2.6);
  // Dents
  poly(ctx, [hx + fx * s * 0.8, hy + s * 0.12, hx + fx * s * 1.0, hy + s * 0.1, hx + fx * s * 0.9, hy + s * 0.36]);
  fillStroke(ctx, '#f2eede', '#7a7060', 1.6);
  // Couronne
  poly(ctx, [
    hx - s * 0.5, hy - s * 0.5, hx - s * 0.3, hy - s * 0.9, hx - s * 0.1, hy - s * 0.55,
    hx + s * 0.1, hy - s * 0.95, hx + s * 0.3, hy - s * 0.55, hx + s * 0.5, hy - s * 0.88,
    hx + s * 0.52, hy - s * 0.42,
  ]);
  fillStroke(ctx, '#e8c65a', '#7a5a10', 2.6);
  // Yeux
  if (v.stunned) {
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 3;
    for (const side of [-1, 1] as const) {
      const ex = hx + side * s * 0.24;
      ctx.beginPath();
      ctx.moveTo(ex - s * 0.12, hy - s * 0.1);
      ctx.lineTo(ex + s * 0.12, hy + s * 0.1);
      ctx.moveTo(ex + s * 0.12, hy - s * 0.1);
      ctx.lineTo(ex - s * 0.12, hy + s * 0.1);
      ctx.stroke();
    }
  } else {
    for (const side of [-1, 1] as const) {
      const ex = hx + side * s * 0.24 + fx * s * 0.1;
      ellipse(ctx, ex, hy - s * 0.06, s * 0.14, s * 0.16, 0);
      ctx.fillStyle = '#ffe9c9';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + fx * s * 0.04, hy - s * 0.04, s * 0.08, 0, TAU);
      ctx.fillStyle = v.phase >= 3 ? '#ff3a3a' : '#c02a2a';
      ctx.fill();
    }
    // Cicatrice
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.42, hy - s * 0.32);
    ctx.lineTo(hx - s * 0.1, hy + s * 0.06);
    ctx.strokeStyle = '#8a4a4a';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  if (v.glued) {
    ctx.beginPath();
    ctx.ellipse(v.x, v.y, s * 1.4, s * 0.5, 0, 0, TAU);
    ctx.fillStyle = 'rgba(140,240,160,0.45)';
    ctx.fill();
  }
  if (v.flash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = v.flash * 0.55;
    ctx.beginPath();
    ctx.arc(v.x, v.y - s, s * 1.4, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Petite tete de souris pour le HUD / recap. */
export function drawMouseIcon(ctx: Ctx, x: number, y: number, r: number, kind: string, dim = false) {
  const col = BANDANA_COLORS[kind] ?? '#ffd23f';
  const fur = kind === 'black' ? '#4b4763' : kind === 'white' ? '#f4f1e6' : '#b9b3ab';
  ctx.save();
  if (dim) ctx.globalAlpha = 0.3;
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(x + side * r * 0.72, y - r * 0.6, r * 0.42, 0, TAU);
    fillStroke(ctx, shade(fur, -0.15), INK, 1.8);
  }
  ctx.beginPath();
  ctx.arc(x, y, r * 0.8, 0, TAU);
  fillStroke(ctx, fur, INK, 2);
  poly(ctx, [x + r * 0.4, y - r * 0.25, x + r * 1.35, y + r * 0.08, x + r * 0.4, y + r * 0.42]);
  fillStroke(ctx, shade(fur, 0.15), INK, 1.6);
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(x + side * r * 0.26 + r * 0.12, y - r * 0.06, r * 0.14, 0, TAU);
    ctx.fillStyle = '#1d1620';
    ctx.fill();
  }
  poly(ctx, [x - r * 0.8, y + r * 0.45, x + r * 0.8, y + r * 0.45, x + r * 0.7, y + r * 0.85, x - r * 0.7, y + r * 0.85]);
  fillStroke(ctx, col, INK, 1.8);
  ctx.font = `bold ${Math.round(r * 0.8)}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(BANDANA_SYMBOLS[kind] ?? '▲', x, y + r * 0.66);
  ctx.restore();
  ctx.globalAlpha = 1;
}
