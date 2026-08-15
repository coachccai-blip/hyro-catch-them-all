/**
 * Catalogue des 8 gadgets : metadonnees, icones vectorielles et textes de
 * tutoriel. La logique d'utilisation vit dans `player.ts` (un cas par gadget),
 * ce qui garde un seul endroit a toucher pour en ajouter un.
 */

import { TAU } from '../core/math';
import type { GadgetId } from '../levels/types';
import { fillStroke, poly, roundRect, star, type Ctx } from '../render/draw';

export type GadgetMode = 'toggle' | 'aim' | 'instant' | 'hold';

export interface GadgetDef {
  id: GadgetId;
  name: string;
  nameEn: string;
  desc: string;
  descEn: string;
  /** Ou l'obtient-on ? */
  from: string;
  mode: GadgetMode;
  cooldown: number;
  color: string;
}

export const GADGETS: GadgetDef[] = [
  {
    id: 'radar', name: 'Radar à moustaches', nameEn: 'Whisker Radar',
    desc: 'Révèle les souris cachées et les Ombres. Indique les passages secrets.',
    descEn: 'Reveals hidden and Shadow mice. Shows secret passages.',
    from: 'Fin 1-2', mode: 'toggle', cooldown: 0.4, color: '#5ce1e6',
  },
  {
    id: 'dash', name: 'Dash-griffes', nameEn: 'Claw Dash',
    desc: 'Ruée courte et invulnérable. Franchit les petits gouffres.',
    descEn: 'Short invulnerable dash. Crosses small gaps.',
    from: 'Fin 1-4', mode: 'instant', cooldown: 0.95, color: '#ffb03b',
  },
  {
    id: 'grapple', name: 'Grappin-queue', nameEn: 'Tail Grapple',
    desc: 'Attire une souris vers soi, ou se hisse sur une plateforme.',
    descEn: 'Pulls a mouse toward you, or hoists you onto a platform.',
    from: 'Fin 2-3', mode: 'aim', cooldown: 1.1, color: '#b3e34a',
  },
  {
    id: 'glue', name: 'Pistolet à glue', nameEn: 'Glue Gun',
    desc: 'Flaque qui immobilise 3 s. Dissout aussi la glue adverse.',
    descEn: 'Puddle that freezes for 3s. Also dissolves enemy glue.',
    from: 'Fin 2-5', mode: 'aim', cooldown: 1.6, color: '#8cf0a0',
  },
  {
    id: 'lure', name: 'Leurre à fromage', nameEn: 'Cheese Lure',
    desc: 'Attire souris et rats de garde vers un point pendant 7 s.',
    descEn: 'Draws mice and guard rats to a spot for 7s.',
    from: 'Fin 3-2', mode: 'aim', cooldown: 3.5, color: '#ffd23f',
  },
  {
    id: 'skates', name: 'Patins turbo', nameEn: 'Turbo Skates',
    desc: 'Course très rapide, capture en mouvement. Bruyant !',
    descEn: 'Very fast run, capture on the move. Noisy!',
    from: 'Fin 3-5', mode: 'toggle', cooldown: 0.4, color: '#ff7ab8',
  },
  {
    id: 'boomerang', name: 'Boomerang sonique', nameEn: 'Sonic Boomerang',
    desc: 'Assomme à distance en arc de cercle. Active les interrupteurs.',
    descEn: 'Stuns at range in an arc. Triggers switches.',
    from: 'Fin 4-2', mode: 'aim', cooldown: 1.5, color: '#9ad0ff',
  },
  {
    id: 'glider', name: 'Cape planeur', nameEn: 'Glider Cape',
    desc: 'Maintiens pour planer au-dessus des grands vides.',
    descEn: 'Hold to glide over wide chasms.',
    from: 'Fin 4-5', mode: 'hold', cooldown: 0.2, color: '#7aa8ff',
  },
];

export function gadgetDef(id: GadgetId): GadgetDef {
  return GADGETS.find((g) => g.id === id) ?? GADGETS[0];
}

/** Icone vectorielle d'un gadget, centree en (x, y), taille s. */
export function drawGadgetIcon(ctx: Ctx, id: GadgetId, x: number, y: number, s: number, ink = '#1e1a2a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (id) {
    case 'radar': {
      ctx.strokeStyle = '#5ce1e6';
      ctx.lineWidth = s * 0.11;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(-s * 0.1, s * 0.1, s * 0.16 * i, -1.1, 0.5);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(-s * 0.1, s * 0.1, s * 0.09, 0, TAU);
      ctx.fillStyle = '#5ce1e6';
      ctx.fill();
      break;
    }
    case 'dash': {
      ctx.strokeStyle = '#ffb03b';
      ctx.lineWidth = s * 0.12;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.45, i * s * 0.22);
        ctx.lineTo(s * 0.1, i * s * 0.22);
        ctx.stroke();
      }
      poly(ctx, [s * 0.14, -s * 0.34, s * 0.48, 0, s * 0.14, s * 0.34]);
      fillStroke(ctx, '#ffd166', ink, s * 0.07);
      break;
    }
    case 'grapple': {
      ctx.strokeStyle = '#b3e34a';
      ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, s * 0.4);
      ctx.quadraticCurveTo(0, -s * 0.1, s * 0.28, -s * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s * 0.3, -s * 0.32, s * 0.16, 0.4, TAU - 0.4);
      ctx.lineWidth = s * 0.12;
      ctx.stroke();
      break;
    }
    case 'glue': {
      poly(ctx, [-s * 0.42, -s * 0.1, s * 0.06, -s * 0.1, s * 0.06, s * 0.06, -s * 0.2, s * 0.06, -s * 0.2, s * 0.34, -s * 0.42, s * 0.34]);
      fillStroke(ctx, '#8cf0a0', ink, s * 0.07);
      ctx.beginPath();
      ctx.arc(s * 0.3, s * 0.12, s * 0.17, 0, TAU);
      ctx.fillStyle = '#8cf0a0';
      ctx.fill();
      break;
    }
    case 'lure': {
      poly(ctx, [-s * 0.4, s * 0.3, s * 0.4, s * 0.3, 0, -s * 0.36]);
      fillStroke(ctx, '#ffd23f', ink, s * 0.08);
      ctx.beginPath();
      ctx.arc(0, s * 0.1, s * 0.08, 0, TAU);
      ctx.arc(-s * 0.16, s * 0.22, s * 0.05, 0, TAU);
      ctx.fillStyle = 'rgba(150,95,20,0.6)';
      ctx.fill();
      break;
    }
    case 'skates': {
      roundRect(ctx, -s * 0.4, -s * 0.24, s * 0.7, s * 0.28, s * 0.08);
      fillStroke(ctx, '#ff7ab8', ink, s * 0.07);
      ctx.strokeStyle = '#ffd7ea';
      ctx.lineWidth = s * 0.09;
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, s * 0.16);
      ctx.lineTo(s * 0.34, s * 0.16);
      ctx.stroke();
      for (const cx of [-s * 0.24, s * 0.14]) {
        ctx.beginPath();
        ctx.arc(cx, s * 0.3, s * 0.1, 0, TAU);
        ctx.fillStyle = '#ffd7ea';
        ctx.fill();
      }
      break;
    }
    case 'boomerang': {
      ctx.strokeStyle = '#9ad0ff';
      ctx.lineWidth = s * 0.16;
      ctx.beginPath();
      ctx.moveTo(-s * 0.34, s * 0.3);
      ctx.quadraticCurveTo(s * 0.05, -s * 0.42, s * 0.36, s * 0.06);
      ctx.stroke();
      break;
    }
    default: {
      poly(ctx, [-s * 0.46, -s * 0.06, 0, -s * 0.34, s * 0.46, -s * 0.06, s * 0.2, s * 0.3, -s * 0.2, s * 0.3]);
      fillStroke(ctx, '#7aa8ff', ink, s * 0.07);
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, -s * 0.02);
      ctx.lineTo(0, s * 0.22);
      ctx.lineTo(s * 0.3, -s * 0.02);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = s * 0.07;
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

/** Icone du filet et de l'epee pour le HUD tactile. */
export function drawNetIcon(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.6);
  ctx.strokeStyle = '#c99a5c';
  ctx.lineWidth = s * 0.14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, s * 0.5);
  ctx.lineTo(0, -s * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.3, s * 0.34, s * 0.28, 0, 0, TAU);
  ctx.strokeStyle = '#e8e2d4';
  ctx.lineWidth = s * 0.12;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = s * 0.05;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s * 0.16, -s * 0.55);
    ctx.lineTo(i * s * 0.16, -s * 0.05);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSwordIcon(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.75);
  poly(ctx, [-s * 0.07, s * 0.42, s * 0.07, s * 0.42, s * 0.07, -s * 0.34, 0, -s * 0.5, -s * 0.07, -s * 0.34]);
  fillStroke(ctx, '#e6eef7', '#4a5566', s * 0.06);
  roundRect(ctx, -s * 0.22, s * 0.36, s * 0.44, s * 0.1, s * 0.04);
  fillStroke(ctx, '#c9a227', '#5a4a10', s * 0.05);
  ctx.restore();
}

export function drawHeartIcon(ctx: Ctx, x: number, y: number, s: number, filled: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.34);
  ctx.bezierCurveTo(-s * 0.16, s * 0.06, -s, -s * 0.1, -s * 0.52, -s * 0.52);
  ctx.bezierCurveTo(-s * 0.2, -s * 0.82, 0, -s * 0.46, 0, -s * 0.28);
  ctx.bezierCurveTo(0, -s * 0.46, s * 0.2, -s * 0.82, s * 0.52, -s * 0.52);
  ctx.bezierCurveTo(s, -s * 0.1, s * 0.16, s * 0.06, 0, s * 0.34);
  ctx.closePath();
  fillStroke(ctx, filled ? '#ff4d6a' : 'rgba(255,255,255,0.14)', '#2a1226', s * 0.11);
  if (filled) {
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, -s * 0.36, s * 0.14, s * 0.09, -0.6, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
  }
  ctx.restore();
}

/** Etoile de medaille (ecran de fin de niveau). */
export function drawMedal(ctx: Ctx, x: number, y: number, s: number, medal: string) {
  const cols: Record<string, [string, string]> = {
    gold: ['#ffd54a', '#b8860b'],
    silver: ['#e2e8ef', '#8d99a8'],
    bronze: ['#e0925a', '#8a5227'],
    none: ['#3a3550', '#22203a'],
  };
  const [a, b] = cols[medal] ?? cols.none;
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, TAU);
  fillStroke(ctx, g, '#2a2118', s * 0.12);
  star(ctx, 0, 0, s * 0.55, 0.44, 5, -Math.PI / 2);
  ctx.fillStyle = medal === 'none' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.75)';
  ctx.fill();
  ctx.restore();
}
