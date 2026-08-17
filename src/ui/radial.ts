/**
 * Roue des gadgets : l'alternative aux touches 1-8.
 *
 * On maintient un bouton, le temps ralentit, on pointe un secteur et on
 * relache — le gadget est selectionne **et** declenche. C'est le seul schema
 * qui marche identiquement a la souris, au stick et au doigt, sans demander de
 * memoriser un numero. Les chiffres restent disponibles pour qui les prefere.
 */

import { TAU, clamp01, damp } from '../core/math';
import type { Input } from '../core/input';
import type { View } from '../core/game';
import { drawGadgetIcon, gadgetDef } from '../game/gadgets';
import { glow, outlinedText, poly, rgba, type Ctx } from '../render/draw';

/** Rayon du disque mort central : en dessous, on ne change pas de selection. */
const DEAD_ZONE = 46;

export class RadialMenu {
  open = false;
  /** Ouverture animee 0..1. */
  anim = 0;
  /** Index survole, -1 si aucun. */
  hover = -1;
  private count = 0;

  /** Ralentissement a appliquer au monde tant que la roue est ouverte. */
  get timeScale(): number {
    return 1 - this.anim * 0.82;
  }

  /**
   * @returns l'index choisi au moment du relachement, sinon null.
   */
  update(dt: number, input: Input, view: View, count: number, selected: number): number | null {
    this.count = count;
    const held = count > 0 && input.isDown('radial');

    if (held && !this.open) {
      this.open = true;
      this.hover = selected;
    }
    this.anim = damp(this.anim, this.open ? 1 : 0, 16, dt);

    if (!this.open) return null;

    // Direction pointee : stick droit s'il est sollicite, sinon le curseur
    // par rapport au centre de l'ecran.
    let vx: number;
    let vy: number;
    let reach: number;
    if (input.aimMode === 'stick' && input.aimStrength > 0.05) {
      vx = input.aimDir.x;
      vy = input.aimDir.y;
      reach = input.aimStrength * 200;
    } else {
      vx = input.cursor.x - view.w / 2;
      vy = input.cursor.y - view.h / 2;
      reach = Math.hypot(vx, vy);
    }

    if (reach > DEAD_ZONE) {
      // Secteur 0 en haut, puis dans le sens horaire.
      const a = Math.atan2(vy, vx) + Math.PI / 2;
      const norm = ((a % TAU) + TAU) % TAU;
      this.hover = Math.floor((norm / TAU) * count + 0.5) % count;
    }

    if (!held) {
      this.open = false;
      const pick = this.hover;
      this.hover = -1;
      return pick >= 0 && pick < count ? pick : null;
    }
    return null;
  }

  /** Fermeture immediate (pause, fin de niveau). */
  cancel() {
    this.open = false;
    this.hover = -1;
  }

  draw(ctx: Ctx, view: View, gadgets: string[], cooldowns: Record<string, number>) {
    if (this.anim < 0.01) return;
    const k = this.anim;
    const n = this.count;
    if (!n) return;
    const cx = view.w / 2;
    const cy = view.h / 2;
    const R = Math.min(view.w, view.h) * 0.3 * (0.86 + k * 0.14);
    const inner = R * 0.34;

    ctx.save();
    ctx.globalAlpha = k;
    // Voile : la roue doit dominer l'ecran sans le masquer completement
    ctx.fillStyle = 'rgba(8,10,20,0.5)';
    ctx.fillRect(0, 0, view.w, view.h);

    for (let i = 0; i < n; i++) {
      const id = gadgets[i];
      const def = gadgetDef(id as never);
      const mid = -Math.PI / 2 + (i / n) * TAU;
      const half = Math.PI / n;
      const on = i === this.hover;
      const push = on ? R * 0.06 : 0;

      // Secteur
      ctx.beginPath();
      ctx.arc(cx, cy, R + push, mid - half + 0.02, mid + half - 0.02);
      ctx.arc(cx, cy, inner, mid + half - 0.02, mid - half + 0.02, true);
      ctx.closePath();
      ctx.fillStyle = on ? rgba(def.color, 0.42) : 'rgba(20,26,46,0.82)';
      ctx.fill();
      ctx.strokeStyle = on ? def.color : 'rgba(247,231,189,0.3)';
      ctx.lineWidth = on ? 4 : 2;
      ctx.stroke();

      // Icone au milieu du secteur
      const ix = cx + Math.cos(mid) * (inner + R) * 0.5;
      const iy = cy + Math.sin(mid) * (inner + R) * 0.5;
      if (on) glow(ctx, ix, iy, R * 0.3, def.color, 0.5);
      const cd = cooldowns[id] ?? 0;
      ctx.globalAlpha = k * (cd > 0 ? 0.4 : 1);
      drawGadgetIcon(ctx, id as never, ix, iy, R * (on ? 0.4 : 0.34));
      ctx.globalAlpha = k;
      // Rappel du numero, pour qui veut passer aux touches
      outlinedText(ctx, String(i + 1), ix, iy + R * 0.28, 15, '#9aa7c4', '#141a2b', 3, 'center', 'normal');
    }

    // Moyeu + nom du gadget survole
    ctx.beginPath();
    ctx.arc(cx, cy, inner - 6, 0, TAU);
    ctx.fillStyle = 'rgba(12,16,30,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(247,231,189,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const cur = this.hover >= 0 ? gadgets[this.hover] : null;
    if (cur) {
      const def = gadgetDef(cur as never);
      // Libelle **au-dessus** de la roue : en dessous, il tombait pile sur la
      // barre de gadgets et les deux textes se superposaient.
      outlinedText(ctx, def.name, cx, cy - R - 46, 28, def.color, '#141a2b', 7);
      outlinedText(ctx, def.desc, cx, cy - R - 18, 17, '#c9d0e8', '#141a2b', 4, 'center', 'normal');
      // Aiguille vers le secteur choisi
      const mid = -Math.PI / 2 + (this.hover / n) * TAU;
      poly(ctx, [
        cx + Math.cos(mid) * (inner - 14), cy + Math.sin(mid) * (inner - 14),
        cx + Math.cos(mid + 2.4) * 11, cy + Math.sin(mid + 2.4) * 11,
        cx + Math.cos(mid - 2.4) * 11, cy + Math.sin(mid - 2.4) * 11,
      ]);
      ctx.fillStyle = def.color;
      ctx.fill();
    } else {
      outlinedText(ctx, 'Choisis un gadget', cx, cy + 6, 18, '#c9d0e8', '#141a2b', 4, 'center', 'normal');
    }
    ctx.globalAlpha = clamp01(k) * 0.75;
    outlinedText(ctx, 'Relâche pour utiliser', cx, cy + R + 42, 18, '#d9cfe8', '#231436', 5, 'center', 'normal');
    ctx.restore();
  }
}
