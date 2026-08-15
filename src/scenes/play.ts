/**
 * Scene de jeu : relie les entrees au monde, gere les encarts de tutoriel,
 * la pause, la fin de niveau et la sauvegarde.
 */

import { Scene } from '../core/scene';
import { clamp, dist, type Vec2 } from '../core/math';
import { CELL, TERR, totalMice, type GadgetId } from '../levels/types';
import { getLevel } from '../levels/levels';
import { World } from '../game/world';
import type { PlayerCmd } from '../game/player';
import { Hud } from '../ui/hud';
import { TUTORIALS } from '../ui/tutorials';
import { drawGadgetIcon, drawMedal, drawNetIcon, drawSwordIcon } from '../game/gadgets';
import { drawMouseIcon, drawMob } from '../render/characters';
import { audio, type MusicId } from '../audio/audio';
import { outlinedText, panel, rgba, wrapText, setFont, type Ctx } from '../render/draw';
import { getLang, t } from '../ui/i18n';
import { PauseScene } from './pause';
import { ResultsScene } from './results';
import type { Medal } from '../save/store';

export class PlayScene extends Scene {
  levelId: string;
  world!: World;
  hud = new Hud();
  private tutorialQueue: string[] = [];
  private tutorialTimer = 0;
  private ended = false;
  private aim: Vec2 = { x: 0, y: 0 };
  private debug = false;
  private startBanner = 2.4;

  constructor(levelId: string) {
    super();
    this.levelId = levelId;
  }

  enter() {
    const def = getLevel(this.levelId)!;
    const save = this.game.save;
    const gadgets = save.data.gadgets as GadgetId[];
    this.world = new World(def, gadgets, [], save.settings.screenShake);
    this.world.resize(this.game.view.w, this.game.view.h);
    this.world.renderer.quality = this.game.quality;
    save.data.lastLevelId = this.levelId;
    save.touch();

    // Encarts de tutoriel non encore vus
    this.tutorialQueue = (def.tutorials ?? []).filter((id) => !save.seenTutorial(id) && TUTORIALS[id]);

    const music: MusicId = def.boss ? 'boss' : (`w${def.world}` as MusicId);
    audio.playMusic(music);
  }

  exit() {
    this.world.dispose();
  }

  resize(w: number, h: number) {
    this.world?.resize(w, h);
  }

  update(dt: number) {
    const input = this.game.input;
    const view = this.game.view;
    this.world.renderer.quality = this.game.quality;

    if (input.rawPressed('F1')) this.debug = !this.debug;
    this.startBanner = Math.max(0, this.startBanner - dt);

    // --- Encart de tutoriel : le jeu attend -----------------------------------
    if (this.tutorialQueue.length) {
      this.tutorialTimer += dt;
      const dismiss = this.tutorialTimer > 0.45
        && (input.pressed('confirm') || input.pressed('net') || input.pressed('interact')
          || input.pressed('cancel') || input.taps.length > 0);
      if (dismiss) {
        this.game.save.markTutorial(this.tutorialQueue.shift()!);
        this.tutorialTimer = 0;
        audio.sfx('uiconfirm');
      }
      // Le monde continue de vivre discretement (ambiance) mais sans action
      this.world.update(Math.min(dt, 0.016) * 0.15, this.idleCmd(), false);
      return;
    }

    if (input.pressed('pause') && !this.ended) {
      this.game.push(new PauseScene(this));
      return;
    }

    // --- Commandes ------------------------------------------------------------
    const p = this.world.player;
    const cam = this.world.camera;
    if (input.aimMode === 'cursor') {
      // Ecran -> monde : la camera est dessinee avec un zoom, il faut le
      // diviser ici sinon le reticule derive par rapport au curseur.
      this.aim = {
        x: cam.x + input.cursor.x / cam.zoom,
        y: cam.y + input.cursor.y / cam.zoom,
      };
    } else {
      const reach = 110;
      this.aim = { x: p.x + input.aimDir.x * reach, y: p.y + input.aimDir.y * reach };
    }
    // Aide a la visee : uniquement au stick / au tactile. A la souris, le
    // reticule doit coller EXACTEMENT au curseur, sans magnetisme.
    if (this.game.save.settings.aimAssist && input.aimMode !== 'cursor') {
      let best: { x: number; y: number; d: number } | null = null;
      for (const m of this.world.mice) {
        if (m.captured || !m.visible) continue;
        const d = dist(m.x, m.y, this.aim.x, this.aim.y);
        if (d < 84 && (!best || d < best.d)) best = { x: m.x, y: m.y, d };
      }
      if (best) {
        this.aim.x += (best.x - this.aim.x) * 0.55;
        this.aim.y += (best.y - this.aim.y) * 0.55;
      }
    }
    this.world.setAim(this.aim.x, this.aim.y);

    const cmd: PlayerCmd = {
      moveX: input.move.x,
      moveY: input.move.y,
      aimX: this.aim.x,
      aimY: this.aim.y,
      net: input.pressed('net') || input.aimReleased,
      sword: input.pressed('sword'),
      jump: input.pressed('jump'),
      gadget: input.pressed('gadgetUse'),
      gadgetHeld: input.isDown('gadgetUse'),
      cycle: (input.pressed('gadgetNext') ? 1 : 0) - (input.pressed('gadgetPrev') ? 1 : 0) + Math.sign(input.wheel),
      slot: input.slotRequest,
    };

    this.world.update(dt, cmd, input.pressed('interact'));
    this.hud.update(dt, this.world.hudState(), this.world.player.move > 0.1 || this.world.toastTimer > 0);

    // --- Evenements -----------------------------------------------------------
    while (this.world.events.length) {
      const ev = this.world.events.shift()!;
      if (ev.type === 'win' && !this.ended) {
        this.ended = true;
        const result = this.saveProgress(ev.caught, ev.total, ev.time, ev.damage, ev.white);
        window.setTimeout(() => {
          this.game.transition(() => this.game.push(new ResultsScene(this.levelId, result)));
        }, 900);
      } else if (ev.type === 'lose' && !this.ended) {
        this.ended = true;
        window.setTimeout(() => {
          this.game.transition(() => this.game.push(new ResultsScene(this.levelId, null)));
        }, 1200);
      }
    }
  }

  private idleCmd(): PlayerCmd {
    return {
      moveX: 0, moveY: 0, aimX: this.world.player.x + 100, aimY: this.world.player.y,
      net: false, sword: false, jump: false, gadget: false, gadgetHeld: false, cycle: 0, slot: null,
    };
  }

  private saveProgress(caught: number, total: number, time: number, damage: number, white: boolean) {
    const def = getLevel(this.levelId)!;
    const save = this.game.save;
    const p = save.progress(this.levelId, total);
    for (const m of this.world.mice) {
      if (m.captured && !p.caught.includes(m.id)) p.caught.push(m.id);
    }
    p.total = total;
    p.done = true;
    if (white) p.white = true;
    if (damage === 0) p.noHit = true;

    let score = 0;
    if (time <= def.targetTime) score++;
    if (damage === 0) score++;
    if (caught >= total) score += 2;
    else if (caught >= def.quota + 2) score++;
    const medal: Medal = score >= 3 ? 'gold' : score === 2 ? 'silver' : score >= 1 ? 'bronze' : 'none';
    const rank = { none: 0, bronze: 1, silver: 2, gold: 3 };
    if (rank[medal] > rank[p.bestMedal]) p.bestMedal = medal;
    if (!p.bestTimeMs || time * 1000 < p.bestTimeMs) p.bestTimeMs = Math.round(time * 1000);

    let unlocked: GadgetId | null = null;
    if (def.unlock && !save.hasGadget(def.unlock)) {
      save.unlockGadget(def.unlock);
      unlocked = def.unlock;
    }
    save.touch();
    save.flush();
    const kinds = this.world.mice.filter((m) => m.captured).map((m) => m.kind as string);
    return { caught, total, time, damage, white, medal, unlocked, quota: def.quota, kinds };
  }

  draw(ctx: Ctx) {
    const view = this.game.view;
    this.world.draw(ctx);

    if (this.debug) this.drawDebug(ctx);

    const state = this.world.hudState();
    this.hud.draw(ctx, view, state, this.game.save.settings.showFps, this.game.fps, this.game.save.settings.bigText);

    if (this.game.input.touchAvailable) {
      const defs = this.hud.layoutTouch(view, view.w > 1000);
      this.game.input.setTouchButtons(this.tutorialQueue.length ? [] : defs);
      if (!this.tutorialQueue.length) {
        this.hud.drawTouch(ctx, this.game.input, state.gadgets, state.selected);
      }
    }

    // Banniere de debut de niveau
    if (this.startBanner > 0) {
      const def = getLevel(this.levelId)!;
      const a = Math.min(1, this.startBanner * 1.5) * Math.min(1, (2.4 - this.startBanner) * 3);
      ctx.save();
      ctx.globalAlpha = a;
      panel(ctx, view.w / 2 - 380, view.h * 0.36, 760, 130, { fill: '#141a2e', stroke: '#ffd166', radius: 18, alpha: 0.88 });
      outlinedText(ctx, `${def.id}  ·  ${getLang() === 'en' ? def.nameEn : def.name}`, view.w / 2, view.h * 0.36 + 48, 40, '#ffe9b8', '#2a1226', 7);
      outlinedText(ctx, getLang() === 'en' ? def.hintEn : def.hint, view.w / 2, view.h * 0.36 + 96, 22, '#c9d0e8', '#141a2b', 5, 'center', 'normal');
      ctx.restore();
    }

    if (this.tutorialQueue.length) this.drawTutorial(ctx);

    if (this.world.failed) {
      ctx.fillStyle = 'rgba(30,4,10,0.45)';
      ctx.fillRect(0, 0, view.w, view.h);
      outlinedText(ctx, t('gameOver'), view.w / 2, view.h / 2, 64, '#ff8a8a', '#2a0a12', 9, 'center', '900');
    }
  }

  private drawTutorial(ctx: Ctx) {
    const view = this.game.view;
    const id = this.tutorialQueue[0];
    const card = TUTORIALS[id];
    if (!card) return;
    const en = getLang() === 'en';
    ctx.save();
    ctx.fillStyle = 'rgba(6,8,16,0.6)';
    ctx.fillRect(0, 0, view.w, view.h);
    const w = Math.min(760, view.w - 80);
    const h = 300;
    const x = (view.w - w) / 2;
    const y = (view.h - h) / 2;
    const pop = Math.min(1, this.tutorialTimer * 6);
    ctx.translate(view.w / 2, view.h / 2);
    ctx.scale(0.9 + pop * 0.1, 0.9 + pop * 0.1);
    ctx.translate(-view.w / 2, -view.h / 2);
    panel(ctx, x, y, w, h, { fill: '#161d34', stroke: '#ffd166', radius: 22, alpha: 0.97 });

    // Icone
    const ix = x + 108;
    const iy = y + 130;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ix, iy, 66, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,209,102,0.14)';
    ctx.fill();
    ctx.restore();
    if (card.icon.kind === 'gadget') drawGadgetIcon(ctx, card.icon.id as never, ix, iy, 92);
    else if (card.icon.kind === 'mouse') drawMouseIcon(ctx, ix, iy, 30, card.icon.id);
    else if (card.icon.kind === 'net') drawNetIcon(ctx, ix, iy, 96);
    else if (card.icon.kind === 'sword') drawSwordIcon(ctx, ix, iy, 96);
    else {
      drawMob(ctx, {
        x: ix, y: iy + 34, dir: 0.6, anim: performance.now() / 1000, kind: card.icon.id,
        hp: 1, maxHp: 1, scale: 1.1, telegraph: 0, altitude: 0, flash: 0,
      });
    }

    outlinedText(ctx, en ? card.titleEn : card.title, x + 200, y + 74, 36, '#ffe9b8', '#2a1226', 7, 'left', '900');
    setFont(ctx, 23, 'normal');
    const lines = wrapText(ctx, en ? card.bodyEn : card.body, w - 240);
    lines.forEach((line, i) => {
      outlinedText(ctx, line, x + 200, y + 130 + i * 34, 23, '#e6ebfa', '#141a2b', 4, 'left', 'normal');
    });
    outlinedText(ctx, en ? 'Press any key / tap to continue' : 'Touche ou clic pour continuer',
      view.w / 2, y + h - 34, 20, '#ffd166', '#2a1e18', 4, 'center', 'normal');
    ctx.restore();
  }

  private drawDebug(ctx: Ctx) {
    const w = this.world;
    const cam = w.camera;
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    ctx.lineWidth = 1.5;
    // Hitboxes
    ctx.strokeStyle = '#00ffcc';
    for (const m of w.mice) {
      if (m.captured) continue;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.stroke();
      // Cone de vision
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.arc(m.x, m.y, 200, m.dir - 1.2, m.dir + 1.2);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,120,120,0.35)';
      ctx.stroke();
      ctx.strokeStyle = '#00ffcc';
    }
    ctx.strokeStyle = '#ff8a4a';
    for (const m of w.mobs) {
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(w.player.x, w.player.y, w.player.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    outlinedText(ctx, `DEBUG  props:${w.level.props.length} mice:${w.mice.length} mobs:${w.mobs.length}`,
      24, 24, 18, '#00ffcc', '#001a14', 3, 'left', 'normal');
  }
}
