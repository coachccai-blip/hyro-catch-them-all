/**
 * Widgets de menu reutilisables : navigation clavier / manette / souris /
 * tactile, avec un rendu cartoon coherent.
 */

import { clamp, clamp01, damp } from '../core/math';
import type { Input } from '../core/input';
import { audio } from '../audio/audio';
import {
  outlinedText, panel, roundRect, rgba, shade, setFont, type Ctx,
} from '../render/draw';

export type ItemKind = 'button' | 'slider' | 'toggle' | 'choice' | 'label';

export interface MenuItem {
  id: string;
  label: string;
  kind: ItemKind;
  value?: number;
  /** Pour 'choice' : liste des libelles. */
  choices?: string[];
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
}

export interface MenuResult {
  activated?: string;
  changed?: string;
}

export class Menu {
  items: MenuItem[] = [];
  index = 0;
  private rects: { x: number; y: number; w: number; h: number }[] = [];
  private hover = -1;
  private repeat = 0;
  private anim: number[] = [];

  constructor(items: MenuItem[] = []) {
    this.setItems(items);
  }

  setItems(items: MenuItem[]) {
    this.items = items;
    this.anim = items.map(() => 0);
    this.rects = items.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
    if (this.items[this.index]?.disabled || this.items[this.index]?.kind === 'label') this.moveSel(1);
  }

  private selectable(i: number): boolean {
    const it = this.items[i];
    return !!it && !it.disabled && it.kind !== 'label';
  }

  moveSel(dir: number) {
    if (!this.items.length) return;
    let i = this.index;
    for (let k = 0; k < this.items.length; k++) {
      i = (i + dir + this.items.length) % this.items.length;
      if (this.selectable(i)) {
        this.index = i;
        return;
      }
    }
  }

  update(dt: number, input: Input): MenuResult {
    const out: MenuResult = {};
    for (let i = 0; i < this.anim.length; i++) {
      this.anim[i] = damp(this.anim[i], i === this.index ? 1 : 0, 14, dt);
    }

    // Navigation directionnelle (avec auto-repeat)
    const dy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
    if (dy !== 0) {
      this.repeat -= dt;
      if (input.pressed('down') || input.pressed('up') || this.repeat <= 0) {
        this.repeat = input.pressed('down') || input.pressed('up') ? 0.36 : 0.11;
        this.moveSel(dy);
        audio.sfx('ui');
      }
    } else {
      this.repeat = 0;
    }

    // Souris / tactile
    const mx = input.cursor.x;
    const my = input.cursor.y;
    this.hover = -1;
    for (let i = 0; i < this.items.length; i++) {
      const r = this.rects[i];
      if (!this.selectable(i) || r.w <= 0) continue;
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        this.hover = i;
        if (this.index !== i && input.source !== 'gamepad') {
          this.index = i;
          audio.sfx('ui');
        }
      }
    }
    for (const tap of input.taps) {
      for (let i = 0; i < this.items.length; i++) {
        const r = this.rects[i];
        if (!this.selectable(i) || r.w <= 0) continue;
        if (tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h) {
          this.index = i;
          const it = this.items[i];
          if (it.kind === 'slider') {
            it.value = clamp01((tap.x - (r.x + r.w * 0.45)) / (r.w * 0.5));
            out.changed = it.id;
            audio.sfx('ui');
          } else {
            out.activated = it.id;
            audio.sfx('uiconfirm');
          }
        }
      }
    }

    const it = this.items[this.index];
    if (it) {
      const dx = (input.pressed('right') ? 1 : 0) - (input.pressed('left') ? 1 : 0);
      if (it.kind === 'slider' && dx !== 0) {
        it.value = clamp01((it.value ?? 0) + dx * 0.1);
        out.changed = it.id;
        audio.sfx('ui');
      } else if ((it.kind === 'choice' || it.kind === 'toggle') && dx !== 0) {
        out.changed = it.id;
        audio.sfx('ui');
      }
      if (input.pressed('confirm') || input.pressed('interact') || input.pressed('net')) {
        if (it.kind === 'slider') {
          /* rien */
        } else {
          out.activated = it.id;
          audio.sfx('uiconfirm');
        }
      }
    }
    return out;
  }

  /** Rendu vertical centre sur x, demarrant a y. */
  draw(ctx: Ctx, x: number, y: number, w: number, rowH = 62, gap = 12, big = false) {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const h = it.kind === 'label' ? rowH * 0.7 : rowH;
      const r = this.rects[i];
      r.x = x - w / 2;
      r.y = y;
      r.w = w;
      r.h = h;
      const a = this.anim[i];
      const sel = i === this.index;

      if (it.kind === 'label') {
        outlinedText(ctx, it.label, x, y + h / 2, big ? 30 : 24, '#ffd9a0', '#2a1e18', 4, 'center');
        y += h + gap * 0.5;
        continue;
      }

      const px = x - w / 2 - a * 8;
      const pw = w + a * 16;
      panel(ctx, px, y, pw, h, {
        fill: it.danger ? '#3a1622' : sel ? '#2a3358' : '#1a2038',
        stroke: it.disabled ? 'rgba(200,200,220,0.25)' : sel ? '#ffd166' : 'rgba(247,231,189,0.45)',
        radius: 14,
        alpha: it.disabled ? 0.55 : 0.94,
        glowColor: sel ? 'rgba(255,209,102,0.5)' : undefined,
      });

      const fs = big ? 30 : 25;
      const labelX = it.kind === 'button' ? x : px + 26;
      const align: CanvasTextAlign = it.kind === 'button' ? 'center' : 'left';
      outlinedText(ctx, it.label, labelX, y + h / 2, fs,
        it.disabled ? '#9aa0b4' : '#fff6e2', '#1a1226', 4, align);

      if (it.kind === 'slider') {
        const bx = px + pw * 0.48;
        const bw = pw * 0.44;
        const by = y + h / 2;
        roundRect(ctx, bx, by - 7, bw, 14, 7);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fill();
        roundRect(ctx, bx, by - 7, bw * clamp01(it.value ?? 0), 14, 7);
        ctx.fillStyle = '#ffd166';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx + bw * clamp01(it.value ?? 0), by, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#fff6e2';
        ctx.fill();
        ctx.strokeStyle = '#2a1e18';
        ctx.lineWidth = 3;
        ctx.stroke();
        outlinedText(ctx, `${Math.round((it.value ?? 0) * 100)}%`, px + pw - 22, by, 20, '#ffd9a0', '#1a1226', 3, 'right');
      } else if (it.kind === 'toggle') {
        const on = (it.value ?? 0) > 0.5;
        const bx = px + pw - 100;
        const by = y + h / 2 - 17;
        roundRect(ctx, bx, by, 74, 34, 17);
        ctx.fillStyle = on ? '#4bd07a' : 'rgba(255,255,255,0.16)';
        ctx.fill();
        ctx.strokeStyle = '#1a1226';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bx + (on ? 55 : 19), by + 17, 13, 0, Math.PI * 2);
        ctx.fillStyle = '#fff6e2';
        ctx.fill();
        ctx.stroke();
      } else if (it.kind === 'choice') {
        const val = it.choices?.[Math.round(it.value ?? 0)] ?? '';
        outlinedText(ctx, `◀ ${val} ▶`, px + pw - 26, y + h / 2, 23, '#ffd9a0', '#1a1226', 4, 'right');
      }

      if (sel && it.hint) {
        outlinedText(ctx, it.hint, x, y + h + 16, 18, '#c9d0e8', '#141a2b', 4, 'center', 'normal');
      }
      y += h + gap + (sel && it.hint ? 22 : 0);
    }
  }

  /** Hauteur totale occupee (pour centrer verticalement). */
  height(rowH = 62, gap = 12): number {
    let h = 0;
    for (const it of this.items) h += (it.kind === 'label' ? rowH * 0.7 : rowH) + gap;
    return h - gap;
  }
}

/** Bouton flottant simple (retour, etc.). */
export function drawIconButton(ctx: Ctx, x: number, y: number, r: number, label: string, highlight = false) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = highlight ? 'rgba(255,209,102,0.85)' : 'rgba(20,26,46,0.8)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(247,231,189,0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();
  outlinedText(ctx, label, x, y, r * 0.9, highlight ? '#2a1e18' : '#fff6e2', 'rgba(0,0,0,0.6)', 4);
  ctx.restore();
}

export function hitCircle(px: number, py: number, x: number, y: number, r: number): boolean {
  const dx = px - x;
  const dy = py - y;
  return dx * dx + dy * dy <= r * r;
}

/** Bandeau de titre commun aux ecrans de menu. */
export function screenTitle(ctx: Ctx, text: string, x: number, y: number, sub?: string) {
  outlinedText(ctx, text, x, y, 62, '#ffe9b8', '#2a1226', 9, 'center', '900');
  if (sub) outlinedText(ctx, sub, x, y + 46, 24, '#c9d0e8', '#141a2b', 5, 'center', 'normal');
}
