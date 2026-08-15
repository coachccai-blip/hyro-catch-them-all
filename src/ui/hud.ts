/**
 * HUD in-game : coeurs, compteur de souris, barre de gadgets, mini-radar,
 * messages contextuels, barre de boss et commandes tactiles.
 * Discret par defaut, il s'estompe legerement hors action.
 */

import { TAU, clamp01, damp } from '../core/math';
import type { Input, TouchButtonDef } from '../core/input';
import type { View } from '../core/game';
import { BANDANA_COLORS } from '../render/palette';
import { drawMouseIcon } from '../render/characters';
import { drawGadgetIcon, drawHeartIcon, drawNetIcon, drawSwordIcon } from '../game/gadgets';
import { gadgetDef } from '../game/gadgets';
import {
  outlinedText, panel, roundRect, rgba, shade, glow, type Ctx,
} from '../render/draw';
import { t } from './i18n';

export interface HudState {
  hp: number;
  maxHp: number;
  caught: number;
  quota: number;
  total: number;
  gadgets: string[];
  selected: number;
  cooldowns: Record<string, number | undefined>;
  radar: boolean;
  skating: boolean;
  exitReady: boolean;
  toast: string;
  caughtKinds: string[];
  boss: { hp: number; max: number; phase: number; capturable: boolean } | null;
  elapsed: number;
}

export class Hud {
  private alpha = 1;
  private heartPop: number[] = [];
  private lastHp = 5;
  private lastCaught = 0;
  private counterPop = 0;
  touch: TouchButtonDef[] = [];

  update(dt: number, s: HudState, busy: boolean) {
    this.alpha = damp(this.alpha, busy ? 1 : 0.82, 5, dt);
    if (s.hp < this.lastHp) this.heartPop[s.hp] = 1;
    this.lastHp = s.hp;
    if (s.caught > this.lastCaught) this.counterPop = 1;
    this.lastCaught = s.caught;
    this.counterPop = Math.max(0, this.counterPop - dt * 2.4);
    for (let i = 0; i < this.heartPop.length; i++) {
      this.heartPop[i] = Math.max(0, (this.heartPop[i] ?? 0) - dt * 1.6);
    }
  }

  /** Positionne les boutons tactiles selon la taille d'ecran. */
  layoutTouch(view: View, big: boolean): TouchButtonDef[] {
    const k = big ? 1 : 0.86;
    const w = view.w;
    const h = view.h;
    this.touch = [
      { id: 'net', action: 'net', x: w - 150 * k, y: h - 150 * k, r: 76 * k, label: 'net' },
      { id: 'sword', action: 'sword', x: w - 300 * k, y: h - 122 * k, r: 56 * k, label: 'sword' },
      { id: 'jump', action: 'jump', x: w - 262 * k, y: h - 262 * k, r: 52 * k, label: 'jump' },
      { id: 'gadget', action: 'gadgetUse', x: w - 148 * k, y: h - 322 * k, r: 58 * k, label: 'gadget' },
      { id: 'cycle', action: 'gadgetNext', x: w - 106 * k, y: h - 452 * k, r: 40 * k, label: 'cycle' },
      { id: 'interact', action: 'interact', x: w - 382 * k, y: h - 218 * k, r: 40 * k, label: 'E' },
      { id: 'pause', action: 'pause', x: 58, y: 138, r: 34, label: 'pause' },
    ];
    return this.touch;
  }

  drawTouch(ctx: Ctx, input: Input, gadgets: string[], selected: number) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (const b of this.touch) {
      const pressed = input.isDown(b.action ?? 'net');
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * (pressed ? 0.94 : 1), 0, TAU);
      ctx.fillStyle = pressed ? 'rgba(255,209,102,0.5)' : 'rgba(18,22,40,0.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(247,231,189,0.55)';
      ctx.lineWidth = 3;
      ctx.stroke();
      const s = b.r * 1.15;
      switch (b.label) {
        case 'net': drawNetIcon(ctx, b.x, b.y, s); break;
        case 'sword': drawSwordIcon(ctx, b.x, b.y, s); break;
        case 'gadget': {
          const g = gadgets[selected];
          if (g) drawGadgetIcon(ctx, g as never, b.x, b.y, s);
          else outlinedText(ctx, '—', b.x, b.y, s * 0.6, '#fff6e2');
          break;
        }
        case 'cycle': outlinedText(ctx, '⟳', b.x, b.y, s * 0.8, '#fff6e2'); break;
        case 'jump': outlinedText(ctx, '⤒', b.x, b.y, s * 0.85, '#fff6e2'); break;
        case 'pause': outlinedText(ctx, '❚❚', b.x, b.y, s * 0.5, '#fff6e2'); break;
        default: outlinedText(ctx, b.label ?? '', b.x, b.y, s * 0.55, '#fff6e2'); break;
      }
    }
    // Joystick virtuel
    if (input.stickOrigin) {
      const o = input.stickOrigin;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 96, 0, TAU);
      ctx.strokeStyle = 'rgba(247,231,189,0.6)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(o.x + input.stickVec.x * 70, o.y + input.stickVec.y * 70, 38, 0, TAU);
      ctx.fillStyle = 'rgba(255,209,102,0.7)';
      ctx.fill();
    }
    // Guide de visee tactile
    if (input.aimOrigin) {
      const o = input.aimOrigin;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(o.x + input.aimVecRaw.x, o.y + input.aimVecRaw.y);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(o.x, o.y, 16, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  draw(ctx: Ctx, view: View, s: HudState, showFps: boolean, fps: number, bigText: boolean) {
    const a = this.alpha;
    ctx.save();
    ctx.globalAlpha = a;
    const fs = bigText ? 1.18 : 1;

    // --- Coeurs -------------------------------------------------------------
    for (let i = 0; i < s.maxHp; i++) {
      const pop = this.heartPop[i] ?? 0;
      const x = 56 + i * 52;
      const y = 54 + pop * 6;
      drawHeartIcon(ctx, x, y, 22 * (1 + pop * 0.25), i < s.hp);
    }

    // --- Compteur de souris -------------------------------------------------
    const cw = 268 * fs;
    const cx = view.w - cw - 26;
    panel(ctx, cx, 26, cw, 78 * fs, { fill: '#141a2e', stroke: '#f7e7bd', radius: 16, alpha: 0.75 });
    const pop = 1 + this.counterPop * 0.22;
    ctx.save();
    ctx.translate(cx + 78 * fs, 26 + 39 * fs);
    ctx.scale(pop, pop);
    outlinedText(ctx, `${s.caught}`, 0, 0, 40 * fs, s.caught >= s.quota ? '#8cf0a0' : '#fff6e2', '#1a1226', 6, 'right');
    ctx.restore();
    outlinedText(ctx, `/ ${s.quota}`, cx + 90 * fs, 26 + 40 * fs, 27 * fs, '#ffd9a0', '#1a1226', 5, 'left');
    outlinedText(ctx, `${s.total} ${t('mice').toLowerCase()}`, cx + cw - 16, 26 + 62 * fs, 16 * fs, '#9aa7c4', '#141a2b', 3, 'right', 'normal');
    // Bandanas captures
    const kinds = s.caughtKinds.slice(-7);
    for (let i = 0; i < kinds.length; i++) {
      drawMouseIcon(ctx, cx + cw - 22 - i * 30, 122, 12, kinds[kinds.length - 1 - i]);
    }

    // --- Chrono -------------------------------------------------------------
    const mm = Math.floor(s.elapsed / 60);
    const ss = Math.floor(s.elapsed % 60);
    outlinedText(ctx, `${mm}:${ss.toString().padStart(2, '0')}`, view.w / 2, 40, 26 * fs, '#e8e2d0', '#141a2b', 5);

    // --- Barre de boss ------------------------------------------------------
    if (s.boss) {
      const bw = Math.min(760, view.w * 0.6);
      const bx = (view.w - bw) / 2;
      panel(ctx, bx, 62, bw, 40, { fill: '#2a1020', stroke: '#ff8a6a', radius: 12, alpha: 0.85 });
      roundRect(ctx, bx + 8, 70, (bw - 16) * clamp01(s.boss.hp / s.boss.max), 24, 8);
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, '#ff5a4a');
      g.addColorStop(1, '#ffb03b');
      ctx.fillStyle = g;
      ctx.fill();
      outlinedText(ctx, s.boss.capturable ? 'NERAT — CAPTURE-LE !' : `NERAT — Phase ${s.boss.phase}`, view.w / 2, 82, 22, '#fff6e2', '#2a1020', 5);
    }

    // --- Barre de gadgets ---------------------------------------------------
    if (s.gadgets.length) {
      const n = s.gadgets.length;
      const slot = 66 * fs;
      const gap = 10;
      const totalW = n * slot + (n - 1) * gap;
      let gx = (view.w - totalW) / 2;
      const gy = view.h - 108 * fs;
      for (let i = 0; i < n; i++) {
        const id = s.gadgets[i];
        const sel = i === s.selected;
        const cd = s.cooldowns[id] ?? 0;
        const def = gadgetDef(id as never);
        ctx.save();
        if (sel) glow(ctx, gx + slot / 2, gy + slot / 2, slot * 0.9, def.color, 0.35);
        roundRect(ctx, gx, gy, slot, slot, 14);
        ctx.fillStyle = sel ? 'rgba(40,50,88,0.92)' : 'rgba(16,20,36,0.72)';
        ctx.fill();
        ctx.strokeStyle = sel ? def.color : 'rgba(247,231,189,0.35)';
        ctx.lineWidth = sel ? 4 : 2.5;
        ctx.stroke();
        drawGadgetIcon(ctx, id as never, gx + slot / 2, gy + slot / 2, slot * 0.62);
        if (cd > 0) {
          ctx.globalAlpha = 0.6;
          roundRect(ctx, gx, gy, slot, slot * clamp01(cd / Math.max(0.2, def.cooldown)), 14);
          ctx.fillStyle = 'rgba(8,10,20,0.7)';
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        // Etat actif (radar / patins)
        const active = (id === 'radar' && s.radar) || (id === 'skates' && s.skating);
        if (active) {
          ctx.beginPath();
          ctx.arc(gx + slot - 12, gy + 12, 7, 0, TAU);
          ctx.fillStyle = '#4bd07a';
          ctx.fill();
        }
        outlinedText(ctx, String(i + 1), gx + 12, gy + slot - 12, 15, '#c9d0e8', '#141a2b', 3, 'center', 'normal');
        ctx.restore();
        gx += slot + gap;
      }
      const cur = s.gadgets[s.selected];
      if (cur) {
        outlinedText(ctx, gadgetDef(cur as never).name, view.w / 2, view.h - 24 * fs, 20 * fs, '#ffd9a0', '#141a2b', 4);
      }
    }

    // --- Message contextuel -------------------------------------------------
    if (s.toast) {
      const tw = ctx.measureText(s.toast).width;
      panel(ctx, view.w / 2 - Math.max(200, tw) / 2 - 24, view.h - 192 * fs, Math.max(200, tw) + 48, 50, {
        fill: '#1a2038', stroke: '#ffd166', radius: 14, alpha: 0.85,
      });
      outlinedText(ctx, s.toast, view.w / 2, view.h - 167 * fs, 24 * fs, '#fff6e2', '#1a1226', 5);
    }

    // --- Rappel de sortie ---------------------------------------------------
    if (s.exitReady) {
      outlinedText(ctx, t('goalReached'), view.w / 2, 132, 22 * fs, '#8cf0a0', '#14261c', 5);
    }

    if (showFps) {
      outlinedText(ctx, `${Math.round(fps)} FPS`, 24, view.h - 22, 18, '#9aa7c4', '#141a2b', 3, 'left', 'normal');
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
