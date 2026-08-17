/**
 * Ecran de fin de niveau : recap anime (souris qui defilent dans le filet),
 * medaille cosmetique, gadget debloque.
 */

import { Scene } from '../core/scene';
import { clamp01, easeOutBack, easeOutCubic } from '../core/math';
import { Menu } from '../ui/widgets';
import { getLevel, nextLevelId } from '../levels/levels';
import { drawMedal, drawGadgetIcon, drawNetIcon } from '../game/gadgets';
import { gadgetDef } from '../game/gadgets';
import { drawMouseIcon } from '../render/characters';
import { outlinedText, panel, rgba, star, type Ctx } from '../render/draw';
import { getLang, t } from '../ui/i18n';
import { audio } from '../audio/audio';
import type { GadgetId } from '../levels/types';
import type { Medal } from '../save/store';
import { PlayScene } from './play';
import { LevelSelectScene } from './levelselect';

export interface LevelResult {
  caught: number;
  total: number;
  time: number;
  damage: number;
  /** Meilleure serie de captures sans encaisser de coup. */
  streak?: number;
  white: boolean;
  medal: Medal;
  unlocked: GadgetId | null;
  quota: number;
  /** Bandanas reellement captures, pour le recap anime. */
  kinds: string[];
}

export class ResultsScene extends Scene {
  overlay = true;
  private levelId: string;
  private result: LevelResult | null;
  private menu: Menu;
  private timer = 0;

  constructor(levelId: string, result: LevelResult | null) {
    super();
    this.levelId = levelId;
    this.result = result;
    const next = nextLevelId(levelId);
    const items = result
      ? [
        ...(next ? [{ id: 'next', label: t('next'), kind: 'button' as const }] : []),
        { id: 'retry', label: t('restart'), kind: 'button' as const },
        { id: 'select', label: t('levelSelect'), kind: 'button' as const },
      ]
      : [
        { id: 'retry', label: t('retry'), kind: 'button' as const },
        { id: 'select', label: t('levelSelect'), kind: 'button' as const },
      ];
    this.menu = new Menu(items);
  }

  enter() {
    this.game.input.clearTouchButtons();
    audio.duckMusic(0.3, 999);
  }

  exit() {
    audio.duckMusic(1, 0.1);
  }

  update(dt: number) {
    this.timer += dt;
    const res = this.menu.update(dt, this.game.input);
    const def = getLevel(this.levelId)!;
    switch (res.activated) {
      case 'next': {
        const n = nextLevelId(this.levelId);
        if (n) this.game.transition(() => this.game.replace(new PlayScene(n)));
        break;
      }
      case 'retry':
        this.game.transition(() => this.game.replace(new PlayScene(this.levelId)));
        break;
      case 'select':
        this.game.transition(() => this.game.replace(new LevelSelectScene(def.world)));
        break;
      default:
        break;
    }
  }

  draw(ctx: Ctx) {
    const v = this.game.view;
    const def = getLevel(this.levelId)!;
    const en = getLang() === 'en';
    ctx.fillStyle = 'rgba(6,9,18,0.78)';
    ctx.fillRect(0, 0, v.w, v.h);

    const menuH = this.menu.height(50, 8);
    const w = Math.min(880, v.w - 60);
    const h = Math.min(500, v.h - menuH - 70);
    const x = (v.w - w) / 2;
    const y = Math.max(24, (v.h - h - menuH - 24) / 2);
    const pop = easeOutBack(clamp01(this.timer * 2.2));
    ctx.save();
    ctx.translate(v.w / 2, v.h / 2);
    ctx.scale(0.85 + pop * 0.15, 0.85 + pop * 0.15);
    ctx.translate(-v.w / 2, -v.h / 2);
    panel(ctx, x, y, w, h, {
      fill: this.result ? '#161d34' : '#2a1020',
      stroke: this.result ? '#ffd166' : '#ff8a6a',
      radius: 24, alpha: 0.97,
    });

    outlinedText(ctx, this.result ? t('levelDone') : t('gameOver'), v.w / 2, y + 48, 42,
      this.result ? '#ffe9b8' : '#ff9b9b', '#2a1226', 8, 'center', '900');
    outlinedText(ctx, `${def.id} · ${en ? def.nameEn : def.name}`, v.w / 2, y + 86, 22, '#c9d0e8', '#141a2b', 5, 'center', 'normal');

    if (this.result) {
      const r = this.result;
      // Defile des souris capturees "dans le filet"
      const shown = Math.min(r.caught, Math.floor(this.timer * 8));
      const perRow = 14;
      const step = 32;
      for (let i = 0; i < shown; i++) {
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        const k = clamp01((this.timer * 8 - i) * 2);
        const px = v.w / 2 - (Math.min(r.caught, perRow) - 1) * (step / 2) - 26 + col * step;
        const py = y + 132 + row * 36 - (1 - k) * 34;
        ctx.save();
        ctx.globalAlpha = k;
        drawMouseIcon(ctx, px, py, 12, r.kinds[i] ?? 'yellow');
        ctx.restore();
      }
      drawNetIcon(ctx, v.w / 2 + Math.min(r.caught, perRow) * (step / 2) + 4, y + 136, 66);

      // Colonne de statistiques (moitie gauche) + medaille (a droite)
      const statW = w * 0.62;
      const rows: [string, string][] = [
        [t('caught'), `${r.caught} / ${r.total}`],
        [t('time'), `${Math.floor(r.time / 60)}:${Math.floor(r.time % 60).toString().padStart(2, '0')} / ${def.targetTime}s`],
        [t('damage'), `${r.damage}`],
        [t('bestStreak'), `×${r.streak ?? 0}`],
        [t('rareMouse'), r.white ? '✔' : '✘'],
      ];
      let ry = y + 200;
      for (const [label, val] of rows) {
        outlinedText(ctx, label, x + 46, ry, 22, '#c9d0e8', '#141a2b', 4, 'left', 'normal');
        outlinedText(ctx, val, x + statW, ry, 24, '#fff6e2', '#141a2b', 5, 'right');
        ry += 36;
      }

      // Medaille
      const mx = x + w - 96;
      const my = y + 244;
      ctx.save();
      ctx.translate(mx, my);
      const ms = clamp01((this.timer - 1.1) * 2.5);
      ctx.scale(easeOutBack(ms), easeOutBack(ms));
      drawMedal(ctx, 0, 0, 46, r.medal);
      ctx.restore();
      if (this.timer > 1.1) {
        outlinedText(ctx, r.medal === 'none' ? '—' : r.medal.toUpperCase(), mx, my + 68, 20, '#ffd9a0', '#141a2b', 4);
      }

      // Gadget debloque
      if (r.unlocked) {
        const g = gadgetDef(r.unlocked);
        const gy = y + h - 108;
        const gk = clamp01((this.timer - 1.6) * 2);
        ctx.save();
        ctx.globalAlpha = gk;
        panel(ctx, x + 34, gy, w - 68, 86, { fill: '#22304e', stroke: g.color, radius: 16, alpha: 0.95, glowColor: g.color });
        drawGadgetIcon(ctx, r.unlocked, x + 86, gy + 43, 56);
        outlinedText(ctx, t('newGadget'), x + 134, gy + 28, 22, g.color, '#141a2b', 5, 'left', '900');
        outlinedText(ctx, `${en ? g.nameEn : g.name} — ${en ? g.descEn : g.desc}`, x + 134, gy + 60, 17, '#e6ebfa', '#141a2b', 4, 'left', 'normal');
        ctx.restore();
        for (let i = 0; i < 3; i++) {
          const a = this.timer * 2 + i * 2.1;
          star(ctx, x + 86 + Math.cos(a) * 48, gy + 43 + Math.sin(a) * 36, 7, 0.45, 5, a);
          ctx.fillStyle = rgba(g.color, 0.8 * gk);
          ctx.fill();
        }
      }
    } else {
      outlinedText(ctx, en ? 'The mice got the better of you… try again!' : 'Les souris ont eu raison de toi… réessaie !',
        v.w / 2, y + h / 2, 24, '#e6ebfa', '#141a2b', 5, 'center', 'normal');
    }

    ctx.restore();
    this.menu.draw(ctx, v.w / 2, y + h + 18, Math.min(420, w - 80), 50, 8);
  }
}
