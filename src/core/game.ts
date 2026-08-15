/**
 * Racine du jeu : canvas, boucle, mise a l'echelle responsive, pile de scenes.
 */

import { clamp } from './math';
import { Input } from './input';
import { Scene } from './scene';
import { SaveStore } from '../save/store';
import { audio } from '../audio/audio';
import { setLang } from '../ui/i18n';
import type { Ctx } from '../render/draw';

/** Zone de jeu logique minimale garantie. */
const MIN_W = 1280;
const MIN_H = 720;
const MAX_W = 2200;
const MAX_H = 1500;

export interface View {
  w: number;
  h: number;
  scale: number;
  ox: number;
  oy: number;
  portrait: boolean;
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: Ctx;
  input: Input;
  save: SaveStore;
  view: View = { w: 1280, h: 720, scale: 1, ox: 0, oy: 0, portrait: false };

  private stack: Scene[] = [];
  private last = 0;
  private acc = 0;
  private fpsSamples: number[] = [];
  fps = 60;
  /** Qualite adaptative (1 = pleine, 0.5 = reduite). */
  quality = 1;
  private lowFrames = 0;
  private fade = 0;
  private fadeDir = 0;
  private pendingAction: (() => void) | null = null;
  audioStarted = false;
  debug = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.save = new SaveStore();
    setLang(this.save.settings.lang);
    this.input = new Input(canvas);
    // Sur telephone on demarre volontairement en dessous de la resolution
    // maximale : mieux vaut monter en finesse si l'appareil suit que d'ouvrir
    // le jeu sur trois secondes de saccades.
    if (this.input.touchAvailable) this.renderScale = 0.8;
    this.input.keys = this.save.settings.keys;
    this.input.pad = this.save.settings.pad;
    audio.setVolumes(this.save.settings.musicVol, this.save.settings.sfxVol);

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.resize(), 250));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save.flush();
    });
    // Le contexte audio ne peut demarrer que sur un geste utilisateur.
    const unlock = () => {
      if (this.audioStarted) return;
      if (audio.init()) {
        this.audioStarted = true;
        audio.setVolumes(this.save.settings.musicVol, this.save.settings.sfxVol);
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    this.resize();
  }

  /**
   * Resolution de rendu. Le jeu est limite par le nombre de pixels a remplir
   * (ciel, brume, lumieres, vignette se superposent) : baisser la resolution
   * interne est de loin le levier le plus efficace sur telephone. L'image est
   * ensuite reetiree par le navigateur, ce qui reste tres propre sur des
   * aplats cartoon.
   */
  renderScale = 1;
  private perfSamples: number[] = [];
  private perfCooldown = 0;

  private maxDpr(): number {
    return this.isMobile() ? 1.5 : 2;
  }

  resize() {
    const dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, this.maxDpr()) * this.renderScale);
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    const pw = Math.max(320, Math.floor(cssW * dpr));
    const ph = Math.max(240, Math.floor(cssH * dpr));
    this.canvas.width = pw;
    this.canvas.height = ph;

    const s1 = Math.min(pw / MIN_W, ph / MIN_H);
    const s2 = Math.max(pw / MAX_W, ph / MAX_H);
    const scale = Math.max(s1, s2);
    this.view = {
      w: pw / scale,
      h: ph / scale,
      scale: scale / dpr, // conversion client -> logique
      ox: 0,
      oy: 0,
      portrait: cssH > cssW * 1.15,
    };
    this.input.setViewport(this.view.w, this.view.h, this.view.scale, 0, 0);
    for (const s of this.stack) s.resize(this.view.w, this.view.h);
  }

  isMobile(): boolean {
    return this.input.touchAvailable && Math.min(window.innerWidth, window.innerHeight) < 900;
  }

  private setRenderScale(v: number) {
    const nv = clamp(v, 0.5, 1);
    if (Math.abs(nv - this.renderScale) < 0.01) return;
    this.renderScale = nv;
    this.resize();
  }

  /**
   * Ajuste la resolution interne d'apres le temps de frame median : on vise
   * ~60 FPS, quitte a rendre un peu moins fin. Mediane (et non moyenne) pour
   * ignorer les a-coups ponctuels, plus un temps de garde entre deux
   * changements afin d'eviter les oscillations.
   */
  private adaptResolution(dt: number) {
    this.perfCooldown -= dt;
    if (this.perfCooldown > 0) return; // on laisse la frame se stabiliser
    this.perfSamples.push(dt * 1000);
    if (this.perfSamples.length < 45) return;
    const sorted = this.perfSamples.slice().sort((a, b) => a - b);
    const med = sorted[sorted.length >> 1];
    this.perfSamples.length = 0;
    if (med > 20.5 && this.renderScale > 0.5) {
      // Plus on est loin de la cible, plus la marche est grande : on converge
      // en une seconde ou deux au lieu de trainer.
      this.perfCooldown = 0.7;
      this.setRenderScale(this.renderScale - (med > 28 ? 0.18 : 0.1));
    } else if (med < 14 && this.renderScale < 1) {
      this.perfCooldown = 2.5;
      this.setRenderScale(this.renderScale + 0.08);
    }
  }

  // --- Pile de scenes -------------------------------------------------------

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  push(scene: Scene, params?: unknown) {
    scene.game = this;
    this.stack.push(scene);
    scene.resize(this.view.w, this.view.h);
    scene.enter(params);
  }

  pop() {
    const s = this.stack.pop();
    s?.exit();
  }

  replace(scene: Scene, params?: unknown) {
    while (this.stack.length) this.pop();
    this.push(scene, params);
  }

  /** Transition en fondu : l'action est executee au noir. */
  transition(action: () => void, speed = 2.6) {
    if (this.pendingAction) return;
    this.pendingAction = action;
    this.fadeDir = speed;
  }

  get transitioning(): boolean {
    return this.pendingAction !== null || this.fade > 0.01;
  }

  // --- Boucle ---------------------------------------------------------------

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.1) dt = 0.1; // onglet en arriere-plan
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }

  private frame(dt: number) {
    // FPS moyen glissant + qualite adaptative
    this.fpsSamples.push(1 / Math.max(dt, 0.0001));
    if (this.fpsSamples.length > 40) this.fpsSamples.shift();
    this.fps = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    const q = this.save.settings.quality;
    if (q === 'low') {
      this.quality = 0.5;
      this.setRenderScale(0.62);
    } else if (q === 'high') {
      this.quality = 1;
      this.setRenderScale(1);
    } else {
      if (this.fps < 45) this.lowFrames++;
      else this.lowFrames = Math.max(0, this.lowFrames - 1);
      this.quality = this.lowFrames > 60 ? 0.5 : 1;
      this.adaptResolution(dt);
    }

    this.input.update(dt);
    audio.update(dt);
    this.save.update(dt);

    // Fondu de transition
    if (this.fadeDir !== 0) {
      this.fade += this.fadeDir * dt;
      if (this.fade >= 1 && this.pendingAction) {
        this.fade = 1;
        const a = this.pendingAction;
        this.pendingAction = null;
        a();
        this.fadeDir = -2.6;
      } else if (this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    }

    // Mise a jour : la scene du dessus, plus celles qui l'autorisent
    const top = this.top;
    if (top) {
      let i = this.stack.length - 1;
      const toUpdate: Scene[] = [this.stack[i]];
      while (i > 0 && this.stack[i].updatesBelow) {
        i--;
        toUpdate.unshift(this.stack[i]);
      }
      for (const s of toUpdate) s.update(dt);
    }

    // Rendu
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(this.canvas.width / this.view.w, this.canvas.height / this.view.h);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#080b14';
    ctx.fillRect(0, 0, this.view.w, this.view.h);

    let first = this.stack.length - 1;
    while (first > 0 && this.stack[first].overlay) first--;
    for (let i = first; i < this.stack.length; i++) this.stack[i].draw(ctx);

    if (this.fade > 0.001) {
      ctx.fillStyle = `rgba(6,8,14,${clamp(this.fade, 0, 1)})`;
      ctx.fillRect(0, 0, this.view.w, this.view.h);
    }
    ctx.restore();

    this.input.endFrame();
  }
}
