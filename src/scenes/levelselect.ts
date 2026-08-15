/**
 * Selection de niveau : vignettes avec souris capturées X/Y, souris Blanche,
 * medaille et gadget requis pour le 100 % (rejouabilite).
 */

import { Scene } from '../core/scene';
import { clamp, damp } from '../core/math';
import { WORLDS } from '../levels/levels';
import { LOCK_GADGET, LOCK_LABEL, totalMice, type GadgetId } from '../levels/types';
import { PALETTES } from '../render/palette';
import { drawIconButton, hitCircle, screenTitle } from '../ui/widgets';
import { drawGadgetIcon, drawMedal, gadgetDef } from '../game/gadgets';
import { drawMouseIcon } from '../render/characters';
import { outlinedText, panel, rgba, roundRect, shade, type Ctx } from '../render/draw';
import { audio } from '../audio/audio';
import { getLang, t } from '../ui/i18n';
import { PlayScene } from './play';
import { WorldSelectScene } from './worldselect';

export class LevelSelectScene extends Scene {
  private worldId: number;
  private index = 0;
  private time = 0;
  private rects: { x: number; y: number; w: number; h: number }[] = [];

  constructor(worldId: number) {
    super();
    this.worldId = worldId;
  }

  enter() {
    this.game.input.clearTouchButtons();
    audio.playMusic('menu');
    const last = this.game.save.data.lastLevelId;
    if (last && parseInt(last.split('-')[0], 10) === this.worldId) {
      this.index = clamp(parseInt(last.split('-')[1], 10) - 1, 0, 4);
    }
  }

  private world() {
    return WORLDS.find((w) => w.id === this.worldId)!;
  }

  private unlocked(i: number): boolean {
    if (i === 0) return true;
    return this.game.save.progress(this.world().levels[i - 1].id).done;
  }

  update(dt: number) {
    this.time += dt;
    const input = this.game.input;
    const d = input.menuDir();
    if (d.x) {
      this.index = clamp(this.index + d.x, 0, 4);
      audio.sfx('ui');
    }
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
    const id = this.world().levels[this.index].id;
    this.game.transition(() => this.game.replace(new PlayScene(id)));
  }

  private back() {
    audio.sfx('uiback');
    this.game.transition(() => this.game.replace(new WorldSelectScene()));
  }

  draw(ctx: Ctx) {
    const v = this.game.view;
    const en = getLang() === 'en';
    const world = this.world();
    const pal = PALETTES[this.worldId - 1];

    const g = ctx.createLinearGradient(0, 0, 0, v.h);
    g.addColorStop(0, shade(pal.skyTop, -0.12));
    g.addColorStop(1, shade(pal.skyBottom, -0.3));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.w, v.h);

    screenTitle(ctx, `${world.id}. ${en ? world.nameEn : world.name}`, v.w / 2, 92, en ? world.subtitleEn : world.subtitle);

    const n = 5;
    const gap = 18;
    const cw = Math.min(300, (v.w - 120 - gap * (n - 1)) / n);
    const chh = Math.min(360, v.h * 0.46);
    const totalW = n * cw + (n - 1) * gap;
    const x0 = (v.w - totalW) / 2;
    const y = v.h * 0.28;
    this.rects = [];

    for (let i = 0; i < n; i++) {
      const lv = world.levels[i];
      const pr = this.game.save.progress(lv.id, totalMice(lv));
      const unlocked = this.unlocked(i);
      const sel = i === this.index;
      const x = x0 + i * (cw + gap);
      const lift = sel ? 14 : 0;
      this.rects.push({ x, y: y - lift, w: cw, h: chh });

      ctx.save();
      ctx.globalAlpha = unlocked ? 1 : 0.6;
      panel(ctx, x, y - lift, cw, chh, {
        fill: sel ? '#222b4c' : '#161d34',
        stroke: sel ? '#ffd166' : 'rgba(247,231,189,0.4)',
        radius: 18,
        alpha: 0.95,
        glowColor: sel ? 'rgba(255,209,102,0.45)' : undefined,
      });

      // Numero + nom
      outlinedText(ctx, lv.id, x + cw / 2, y - lift + 36, 30, '#ffe9b8', '#2a1226', 6, 'center', '900');
      const name = en ? lv.nameEn : lv.name;
      outlinedText(ctx, name.length > 22 ? `${name.slice(0, 21)}…` : name,
        x + cw / 2, y - lift + 70, 17, '#c9d0e8', '#141a2b', 4, 'center', 'normal');

      // Souris capturees
      const tot = totalMice(lv);
      const cnt = pr.caught.length;
      outlinedText(ctx, `${cnt} / ${tot}`, x + cw / 2, y - lift + 118, 34,
        cnt >= tot ? '#8cf0a0' : '#fff6e2', '#141a2b', 6);
      outlinedText(ctx, `${t('quota')} ${lv.quota}`, x + cw / 2, y - lift + 146, 16, '#9aa7c4', '#141a2b', 3, 'center', 'normal');

      // Barre de progression
      roundRect(ctx, x + 24, y - lift + 162, cw - 48, 12, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();
      roundRect(ctx, x + 24, y - lift + 162, (cw - 48) * (tot ? cnt / tot : 0), 12, 6);
      ctx.fillStyle = cnt >= tot ? '#8cf0a0' : '#ffd166';
      ctx.fill();

      // Souris Blanche
      drawMouseIcon(ctx, x + 44, y - lift + 210, 15, 'white', !pr.white);
      outlinedText(ctx, pr.white ? '✔' : '✘', x + 72, y - lift + 212, 20, pr.white ? '#8cf0a0' : '#ff8a8a', '#141a2b', 4, 'left');

      // Medaille
      drawMedal(ctx, x + cw - 46, y - lift + 208, 22, pr.bestMedal);

      // Gadgets requis pour le 100 %
      const needed = new Set<GadgetId>();
      for (const lock of lv.locks) {
        const gid = LOCK_GADGET[lock];
        if (!this.game.save.hasGadget(gid)) needed.add(gid);
      }
      let gx = x + 28;
      const gy = y - lift + chh - 46;
      if (needed.size) {
        outlinedText(ctx, t('needed'), x + cw / 2, gy - 26, 15, '#ffb3b3', '#141a2b', 3, 'center', 'normal');
        for (const gid of needed) {
          const gd = gadgetDef(gid);
          roundRect(ctx, gx, gy - 18, 38, 38, 9);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fill();
          ctx.strokeStyle = rgba(gd.color, 0.7);
          ctx.lineWidth = 2;
          ctx.stroke();
          drawGadgetIcon(ctx, gid, gx + 19, gy + 1, 30);
          gx += 46;
        }
      } else if (cnt >= tot) {
        outlinedText(ctx, en ? '100 % complete!' : '100 % complété !', x + cw / 2, gy, 19, '#8cf0a0', '#14261c', 4);
      } else {
        outlinedText(ctx, en ? 'All reachable' : 'Tout est accessible', x + cw / 2, gy, 17, '#c9d0e8', '#141a2b', 3, 'center', 'normal');
      }

      if (!unlocked) {
        roundRect(ctx, x, y - lift, cw, chh, 18);
        ctx.fillStyle = 'rgba(6,8,16,0.6)';
        ctx.fill();
        outlinedText(ctx, '🔒', x + cw / 2, y - lift + chh / 2, 52, '#ffffff', '#141a2b', 6);
      }
      ctx.restore();
    }

    // Astuce du niveau selectionne
    const lv = world.levels[this.index];
    panel(ctx, v.w / 2 - Math.min(760, v.w - 80) / 2, v.h - 148, Math.min(760, v.w - 80), 86,
      { fill: '#141a2e', stroke: 'rgba(247,231,189,0.4)', radius: 14, alpha: 0.85 });
    outlinedText(ctx, `${t('hintTitle')} — ${en ? lv.hintEn : lv.hint}`, v.w / 2, v.h - 116, 21, '#ffd9a0', '#141a2b', 4, 'center', 'normal');
    if (lv.locks.length) {
      outlinedText(ctx, lv.locks.map((l) => LOCK_LABEL[l]).join(' · '), v.w / 2, v.h - 86, 17, '#9aa7c4', '#141a2b', 3, 'center', 'normal');
    }
    outlinedText(ctx, en ? '← → to browse · Enter to play · Esc to go back' : '← → naviguer · Entrée jouer · Échap retour',
      v.w / 2, v.h - 34, 19, '#c9d0e8', '#141a2b', 4, 'center', 'normal');
    drawIconButton(ctx, 66, 60, 34, '←');
  }
}
