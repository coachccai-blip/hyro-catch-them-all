/**
 * Ecran titre anime : Hyro en idle, souris qui traversent le decor,
 * jardin ensoleille en parallaxe.
 */

import { Scene } from '../core/scene';
import { TAU, clamp01, hash2 } from '../core/math';
import { Menu } from '../ui/widgets';
import { drawHyro, drawMouse } from '../render/characters';
import { drawProp } from '../render/props';
import type { Prop } from '../levels/generator';
import { PALETTES } from '../render/palette';
import { blob, glow, outlinedText, rgba, shade, star, type Ctx } from '../render/draw';
import { audio } from '../audio/audio';
import { t } from '../ui/i18n';
import { GRAND_TOTAL_MICE, ALL_LEVELS } from '../levels/levels';
import { WorldSelectScene } from './worldselect';
import { OptionsScene } from './options';
import { CreditsScene } from './credits';
import { PlayScene } from './play';

interface TitleMouse {
  x: number;
  y: number;
  vx: number;
  kind: string;
  bob: number;
}

export class TitleScene extends Scene {
  private menu!: Menu;
  private time = 0;
  private mice: TitleMouse[] = [];
  private spawnTimer = 0;
  private started = false;

  enter() {
    const save = this.game.save;
    const hasProgress = save.levelsDone() > 0 || !!save.data.lastLevelId;
    const items = [];
    if (hasProgress) items.push({ id: 'continue', label: t('continue'), kind: 'button' as const });
    items.push({ id: 'play', label: hasProgress ? t('worlds') : t('play'), kind: 'button' as const });
    items.push({ id: 'options', label: t('options'), kind: 'button' as const });
    items.push({ id: 'credits', label: t('credits'), kind: 'button' as const });
    this.menu = new Menu(items);
    this.game.input.clearTouchButtons();
    audio.playMusic('title');
  }

  update(dt: number) {
    this.time += dt;
    if (this.game.audioStarted && !this.started) {
      this.started = true;
      audio.playMusic('title', true);
    }
    // Souris qui traversent
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.mice.length < 6) {
      this.spawnTimer = 1.2 + Math.random() * 2.4;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const kinds = ['yellow', 'blue', 'red', 'green', 'purple', 'black', 'white'];
      this.mice.push({
        x: dir > 0 ? -60 : this.game.view.w + 60,
        y: this.game.view.h * (0.62 + Math.random() * 0.3),
        vx: dir * (110 + Math.random() * 130),
        kind: kinds[Math.floor(Math.random() * kinds.length)],
        bob: Math.random() * 10,
      });
    }
    for (const m of this.mice) {
      m.x += m.vx * dt;
      m.bob += dt;
    }
    this.mice = this.mice.filter((m) => m.x > -140 && m.x < this.game.view.w + 140);

    const res = this.menu.update(dt, this.game.input);
    switch (res.activated) {
      case 'continue': {
        const id = this.game.save.data.lastLevelId ?? ALL_LEVELS[0].id;
        this.game.transition(() => this.game.replace(new PlayScene(id)));
        break;
      }
      case 'play':
        this.game.transition(() => this.game.replace(new WorldSelectScene()));
        break;
      case 'options':
        this.game.push(new OptionsScene(false));
        break;
      case 'credits':
        this.game.push(new CreditsScene());
        break;
      default:
        break;
    }
  }

  draw(ctx: Ctx) {
    const v = this.game.view;
    const pal = PALETTES[0];
    const t0 = this.time;

    // --- Ciel ---------------------------------------------------------------
    const g = ctx.createLinearGradient(0, 0, 0, v.h);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(0.5, pal.skyMid);
    g.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.w, v.h);
    glow(ctx, v.w * 0.8, v.h * 0.18, 340, '#fff3c4', 0.5);
    ctx.beginPath();
    ctx.arc(v.w * 0.8, v.h * 0.18, 56, 0, TAU);
    ctx.fillStyle = '#fff8d8';
    ctx.fill();

    // Nuages
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 420 + t0 * 12) % (v.w + 700)) - 300;
      const cy = 70 + (i % 3) * 80;
      ctx.globalAlpha = 0.5;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(cx + k * 58 - 80, cy + Math.sin(i + k) * 10, 44 + (k % 2) * 20, 0, TAU);
        ctx.fillStyle = k % 2 ? '#fffaf0' : '#ffeccd';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // --- Collines -----------------------------------------------------------
    for (const [f, col, base] of [[0.5, pal.far, 0.6], [0.7, pal.mid, 0.72], [1, pal.near, 0.84]] as const) {
      ctx.beginPath();
      ctx.moveTo(-20, v.h);
      for (let x = -20; x <= v.w + 20; x += 30) {
        const y = v.h * base - Math.sin(x * 0.004 + f * 3 + t0 * 0.05) * 40 * f - 20 * f;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(v.w + 20, v.h);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    }
    // Herbes au premier plan
    ctx.strokeStyle = shade(pal.ground, -0.25);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const x = (i * 37) % (v.w + 40) - 20;
      const h = 26 + hash2(i, 3, 5) * 40;
      const sway = Math.sin(t0 * 1.6 + i) * 8;
      ctx.beginPath();
      ctx.moveTo(x, v.h + 10);
      ctx.quadraticCurveTo(x + sway * 0.4, v.h - h * 0.6, x + sway, v.h - h);
      ctx.stroke();
    }

    // --- Souris -------------------------------------------------------------
    for (const m of this.mice) {
      drawMouse(ctx, {
        x: m.x, y: m.y, dir: m.vx > 0 ? 0 : Math.PI, move: 1, anim: m.bob,
        kind: m.kind, stunned: false, alerted: false, alpha: 1, scale: 1.3, glued: false,
      });
    }

    // --- Decors de premier plan ---------------------------------------------
    const props: Prop[] = [];
    const seedProps = [
      { kind: 'bush', x: 0.09, y: 0.94, s: 1.5 }, { kind: 'pot', x: 0.2, y: 0.99, s: 1.15 },
      { kind: 'mushroom', x: 0.3, y: 0.9, s: 1.1 }, { kind: 'daisy', x: 0.38, y: 0.96, s: 1.4 },
      { kind: 'bush', x: 0.9, y: 0.92, s: 1.35 }, { kind: 'gnome', x: 0.62, y: 0.98, s: 1.1 },
      { kind: 'wateringCan', x: 0.05, y: 0.82, s: 1 }, { kind: 'stone', x: 0.5, y: 0.88, s: 1.2 },
      { kind: 'daisy', x: 0.72, y: 0.9, s: 1.2 },
    ];
    for (let i = 0; i < seedProps.length; i++) {
      const sp = seedProps[i];
      props.push({
        kind: sp.kind, x: v.w * sp.x, y: v.h * sp.y, s: sp.s * 1.15, rot: 0, seed: i * 37,
        blocking: false, r: 0, hide: false, layer: 'sorted', anim: true,
      });
    }
    props.sort((a, b) => a.y - b.y);
    const pc = { pal, t: t0, fade: 1 };
    for (const p of props) drawProp(ctx, p, pc);

    // --- Hyro ---------------------------------------------------------------
    drawHyro(ctx, {
      x: v.w * 0.79, y: v.h * 0.93, dir: Math.PI / 2 - 0.45, move: 0, anim: t0,
      state: 'idle', action: 0, blink: 0, scale: 2.4,
    });

    // --- Logo ---------------------------------------------------------------
    const bob = Math.sin(t0 * 1.4) * 6;
    ctx.save();
    ctx.translate(v.w / 2, v.h * 0.2 + bob);
    ctx.rotate(-0.03);
    outlinedText(ctx, 'HYRO', 0, 0, Math.min(180, v.w * 0.16), '#ffe066', '#7a3a12', 22, 'center', '900');
    ctx.restore();
    outlinedText(ctx, 'ATTRAPEZ-LES TOUS !', v.w / 2, v.h * 0.2 + 82 + bob, Math.min(42, v.w * 0.035),
      '#fff6e2', '#7a3a12', 8, 'center', '900');
    for (let i = 0; i < 4; i++) {
      const a = t0 * 1.4 + i * 1.7;
      star(ctx, v.w / 2 + Math.cos(a) * (v.w * 0.14), v.h * 0.2 + Math.sin(a * 1.3) * 44 + bob, 9, 0.45, 5, a);
      ctx.fillStyle = rgba('#ffe066', 0.7);
      ctx.fill();
    }

    // --- Menu ---------------------------------------------------------------
    const mh = this.menu.height(58, 12);
    const menuTop = v.h * 0.52 - mh / 2 + 60;
    this.menu.draw(ctx, v.w / 2, menuTop, Math.min(420, v.w - 80), 58, 12);
    if (!this.game.audioStarted) {
      outlinedText(ctx, t('tapToStart'), v.w / 2, menuTop + mh + 34, 22, '#ffd166', '#4a2a10', 5, 'center', 'normal');
    }

    // Progression
    const caught = this.game.save.totalCaught();
    outlinedText(ctx, `${t('totalProgress')} : ${caught} / ${GRAND_TOTAL_MICE} ${t('mice').toLowerCase()}  ·  ${this.game.save.totalWhite()} ✦`,
      v.w / 2, v.h - 26, 20, '#fff2cf', '#4a2a10', 5, 'center', 'normal');

    if (this.game.view.portrait) {
      outlinedText(ctx, '↻ Tourne ton appareil en paysage', v.w / 2, 40, 22, '#ffd166', '#4a2a10', 5, 'center', 'normal');
    }
  }
}
