/**
 * Carte des mondes : cinq vignettes stylisees avec la progression.
 */

import { Scene } from '../core/scene';
import { TAU, clamp, clamp01, damp, hash2 } from '../core/math';
import { WORLDS } from '../levels/levels';
import { totalMice } from '../levels/types';
import { PALETTES } from '../render/palette';
import { drawIconButton, hitCircle, screenTitle } from '../ui/widgets';
import { blob, glow, outlinedText, panel, poly, rgba, roundRect, shade, star, type Ctx } from '../render/draw';
import { audio } from '../audio/audio';
import { getLang, t } from '../ui/i18n';
import { LevelSelectScene } from './levelselect';
import { TitleScene } from './title';

export class WorldSelectScene extends Scene {
  private index = 0;
  private scroll = 0;
  private time = 0;
  private rects: { x: number; y: number; w: number; h: number }[] = [];

  enter() {
    this.game.input.clearTouchButtons();
    audio.playMusic('menu');
    // On se place sur le dernier monde joue
    const last = this.game.save.data.lastLevelId;
    if (last) this.index = clamp(parseInt(last.split('-')[0], 10) - 1, 0, WORLDS.length - 1);
    this.scroll = this.index;
  }

  private unlocked(i: number): boolean {
    if (i === 0) return true;
    const prev = WORLDS[i - 1];
    return this.game.save.progress(prev.levels[prev.levels.length - 1].id).done;
  }

  update(dt: number) {
    this.time += dt;
    const input = this.game.input;
    const d = input.menuDir();
    if (d.x) {
      this.index = clamp(this.index + d.x, 0, WORLDS.length - 1);
      audio.sfx('ui');
    }
    this.scroll = damp(this.scroll, this.index, 12, dt);

    for (const tap of input.taps) {
      for (let i = 0; i < this.rects.length; i++) {
        const r = this.rects[i];
        if (tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h) {
          if (i === this.index) this.open();
          else {
            this.index = i;
            audio.sfx('ui');
          }
        }
      }
      if (hitCircle(tap.x, tap.y, 66, 60, 40)) this.back();
    }

    if (input.pressed('confirm') || input.pressed('interact') || input.pressed('net')) this.open();
    if (input.pressed('cancel') || input.pressed('pause')) this.back();
  }

  private open() {
    if (!this.unlocked(this.index)) {
      audio.sfx('error');
      return;
    }
    audio.sfx('uiconfirm');
    const id = WORLDS[this.index].id;
    this.game.transition(() => this.game.replace(new LevelSelectScene(id)));
  }

  private back() {
    audio.sfx('uiback');
    this.game.transition(() => this.game.replace(new TitleScene()));
  }

  draw(ctx: Ctx) {
    const v = this.game.view;
    const en = getLang() === 'en';
    // Fond : degrade du monde selectionne
    const pal = PALETTES[clamp(Math.round(this.scroll), 0, 4)];
    const g = ctx.createLinearGradient(0, 0, 0, v.h);
    g.addColorStop(0, shade(pal.skyTop, -0.1));
    g.addColorStop(1, shade(pal.skyBottom, -0.25));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.w, v.h);
    for (let i = 0; i < 40; i++) {
      const x = (hash2(i, 1, 9) * v.w + this.time * 8) % (v.w + 40) - 20;
      const y = hash2(i, 2, 11) * v.h;
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.arc(x, y, 2 + hash2(i, 3, 13) * 3, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    screenTitle(ctx, t('worlds'), v.w / 2, 96, t('selectWorld'));

    // Chemin pointille entre les mondes
    const cw = Math.min(360, v.w * 0.27);
    const ch = cw * 0.78;
    const cy = v.h * 0.55;
    ctx.save();
    ctx.setLineDash([12, 12]);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(v.w, cy);
    ctx.stroke();
    ctx.restore();

    this.rects = [];
    for (let i = 0; i < WORLDS.length; i++) {
      const world = WORLDS[i];
      const off = i - this.scroll;
      const x = v.w / 2 + off * (cw + 44) - cw / 2;
      const scale = clamp(1 - Math.abs(off) * 0.14, 0.6, 1);
      const h = ch * scale;
      const w = cw * scale;
      const y = cy - h / 2;
      this.rects.push({ x, y, w, h });
      if (x + w < -60 || x > v.w + 60) continue;

      const unlocked = this.unlocked(i);
      const p = PALETTES[i];
      ctx.save();
      ctx.globalAlpha = unlocked ? 1 : 0.55;
      // Vignette
      roundRect(ctx, x, y, w, h, 22);
      ctx.save();
      ctx.clip();
      const wg = ctx.createLinearGradient(x, y, x, y + h);
      wg.addColorStop(0, p.skyTop);
      wg.addColorStop(0.55, p.skyMid);
      wg.addColorStop(1, p.skyBottom);
      ctx.fillStyle = wg;
      ctx.fillRect(x, y, w, h);
      this.drawVignette(ctx, i, x, y, w, h);
      ctx.restore();
      ctx.lineWidth = i === this.index ? 6 : 3;
      ctx.strokeStyle = i === this.index ? '#ffd166' : 'rgba(247,231,189,0.5)';
      roundRect(ctx, x, y, w, h, 22);
      ctx.stroke();

      // Bandeau titre
      roundRect(ctx, x, y + h - 74 * scale, w, 74 * scale, 0);
      ctx.fillStyle = 'rgba(10,12,24,0.72)';
      ctx.fill();
      outlinedText(ctx, `${i + 1}. ${en ? world.nameEn : world.name}`, x + w / 2, y + h - 46 * scale, 24 * scale, '#fff6e2', '#141a2b', 5);
      // Progression
      let caught = 0;
      let total = 0;
      let done = 0;
      for (const lv of world.levels) {
        const pr = this.game.save.progress(lv.id, totalMice(lv));
        caught += pr.caught.length;
        total += totalMice(lv);
        if (pr.done) done++;
      }
      outlinedText(ctx, `${caught}/${total} 🐭   ${done}/5 ✔`, x + w / 2, y + h - 18 * scale, 19 * scale, '#ffd9a0', '#141a2b', 4, 'center', 'normal');

      if (!unlocked) {
        ctx.fillStyle = 'rgba(6,8,16,0.55)';
        roundRect(ctx, x, y, w, h, 22);
        ctx.fill();
        outlinedText(ctx, '🔒', x + w / 2, y + h / 2 - 10, 56 * scale, '#ffffff', '#141a2b', 6);
        outlinedText(ctx, t('finishPrev'), x + w / 2, y + h / 2 + 40 * scale, 17 * scale, '#c9d0e8', '#141a2b', 4, 'center', 'normal');
      }
      ctx.restore();
    }

    // Sous-titre du monde selectionne
    const wsel = WORLDS[this.index];
    outlinedText(ctx, en ? wsel.subtitleEn : wsel.subtitle, v.w / 2, v.h - 96, 26, '#ffe9b8', '#2a1226', 6);
    outlinedText(ctx, en ? '← → to browse · Enter to open' : '← → pour naviguer · Entrée pour ouvrir',
      v.w / 2, v.h - 50, 20, '#c9d0e8', '#141a2b', 4, 'center', 'normal');
    drawIconButton(ctx, 66, 60, 34, '←');
  }

  /** Petite scene resumee de chaque monde. */
  private drawVignette(ctx: Ctx, i: number, x: number, y: number, w: number, h: number) {
    const p = PALETTES[i];
    const t0 = this.time;
    switch (i) {
      case 0: {
        ctx.fillStyle = p.near;
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        for (let k = 0; k <= 10; k++) ctx.lineTo(x + (w * k) / 10, y + h * 0.62 - Math.sin(k + t0 * 0.4) * 8);
        ctx.lineTo(x + w, y + h);
        ctx.fill();
        for (let k = 0; k < 5; k++) {
          blob(ctx, x + w * (0.12 + k * 0.2), y + h * 0.7, 22, 16, k, 0.25, 8);
          ctx.fillStyle = shade(p.ground, -0.1);
          ctx.fill();
        }
        glow(ctx, x + w * 0.78, y + h * 0.22, 70, '#fff3c4', 0.6);
        break;
      }
      case 1: {
        ctx.fillStyle = p.mid;
        ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
        for (let k = 0; k < 5; k++) {
          const lx = x + w * (0.15 + k * 0.18);
          const ly = y + h * (0.3 + (k % 2) * 0.08);
          glow(ctx, lx, ly, 34, p.accent, 0.7);
          ctx.beginPath();
          ctx.ellipse(lx, ly, 9, 12, 0, 0, TAU);
          ctx.fillStyle = shade(p.accent, 0.3);
          ctx.fill();
        }
        break;
      }
      case 2: {
        ctx.fillStyle = p.mid;
        ctx.fillRect(x, y + h * 0.5, w, h * 0.5);
        for (let k = 0; k < 3; k++) {
          const lx = x + w * (0.25 + k * 0.25);
          glow(ctx, lx, y + h * 0.3, 44, p.accent, 0.5 + 0.3 * Math.sin(t0 * 6 + k));
        }
        ctx.strokeStyle = 'rgba(200,220,210,0.3)';
        ctx.lineWidth = 3;
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          ctx.moveTo(x, y + h * (0.72 + k * 0.08));
          ctx.lineTo(x + w, y + h * (0.72 + k * 0.08));
          ctx.stroke();
        }
        break;
      }
      case 3: {
        ctx.fillStyle = p.mid;
        for (let k = 0; k < 6; k++) {
          const bw = w * 0.13;
          const bh = h * (0.2 + hash2(k, 2, 7) * 0.35);
          ctx.fillRect(x + k * bw * 1.2, y + h * 0.62 - bh, bw, bh + h * 0.4);
        }
        ctx.strokeStyle = 'rgba(190,215,255,0.5)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let k = 0; k < 40; k++) {
          const rx = x + (hash2(k, 5, 3) * w + t0 * 40) % w;
          const ry = y + (hash2(k, 6, 4) * h + t0 * 320) % h;
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 5, ry + 14);
        }
        ctx.stroke();
        break;
      }
      default: {
        ctx.fillStyle = p.mid;
        ctx.fillRect(x, y + h * 0.6, w, h * 0.4);
        glow(ctx, x + w * 0.5, y + h * 0.72, 90, '#ff7a2b', 0.55);
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(x + w * (0.25 + k * 0.25), y + h * 0.5, 20, 0, TAU);
          ctx.fillStyle = '#e8b53c';
          ctx.fill();
          ctx.strokeStyle = '#2a1e18';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        break;
      }
    }
  }
}
