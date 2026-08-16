/**
 * Armement des souris : mines, bombes et missiles téléguidés.
 *
 * Règle de conception : tout est **télégraphié et destructible**. Une mine
 * clignote avant d'être armée, une bombe montre sa mèche, un missile laisse une
 * traînée — et un coup d'épée détruit n'importe lequel des trois. La difficulté
 * vient de la lecture du terrain, jamais d'un coup impossible à voir venir.
 */

import { TAU, clamp01, dist, wrapAngle } from '../core/math';
import { TERR } from '../levels/types';
import { glow, poly, rgba, star, type Ctx } from '../render/draw';
import type { IWorld } from './types';

export type HazardKind = 'mine' | 'bomb' | 'missile';

const CONF = {
  mine: { arm: 0.8, life: 22, trigger: 42, blast: 78, damage: 1, r: 12 },
  bomb: { arm: 0, life: 1.7, trigger: 0, blast: 104, damage: 1, r: 13 },
  missile: { arm: 0, life: 5, trigger: 26, blast: 62, damage: 1, r: 10 },
};

export class Hazard {
  kind: HazardKind;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** Hauteur visuelle (bombe lancée en cloche). */
  z = 0;
  life: number;
  age = 0;
  dead = false;
  r: number;
  /** Cap du missile. */
  dir = 0;
  private exploded = false;
  private arcT = 0;
  private arcDur = 0;
  private from = { x: 0, y: 0 };
  private to = { x: 0, y: 0 };

  constructor(kind: HazardKind, x: number, y: number) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.life = CONF[kind].life;
    this.r = CONF[kind].r;
  }

  /** Bombe : trajectoire en cloche vers un point. */
  throwTo(tx: number, ty: number) {
    this.from = { x: this.x, y: this.y };
    this.to = { x: tx, y: ty };
    this.arcDur = Math.max(0.35, dist(this.x, this.y, tx, ty) / 420);
    this.arcT = 0;
  }

  launch(angle: number) {
    this.dir = angle;
  }

  get armed(): boolean {
    return this.age >= CONF[this.kind].arm;
  }

  update(dt: number, w: IWorld) {
    if (this.dead) return;
    this.age += dt;
    this.life -= dt;

    switch (this.kind) {
      case 'bomb': {
        if (this.arcDur > 0) {
          this.arcT = Math.min(1, this.arcT + dt / this.arcDur);
          this.x = this.from.x + (this.to.x - this.from.x) * this.arcT;
          this.y = this.from.y + (this.to.y - this.from.y) * this.arcT;
          this.z = Math.sin(this.arcT * Math.PI) * 60;
        }
        if (this.life <= 0) this.explode(w);
        break;
      }
      case 'missile': {
        // Guidage : virage limité, donc esquivable par un pas de côté sec
        const p = w.player;
        const want = Math.atan2(p.y - this.y, p.x - this.x);
        this.dir += wrapAngle(want - this.dir) * Math.min(1, dt * 2.4);
        const sp = 210;
        this.x += Math.cos(this.dir) * sp * dt;
        this.y += Math.sin(this.dir) * sp * dt;
        w.fx.spawn('ember', this.x - Math.cos(this.dir) * 10, this.y - Math.sin(this.dir) * 10,
          0, 0, 0.3, 4, '#ff9b3a');
        const t = w.nav.terrainAt(this.x, this.y);
        if (t === TERR.WALL || t === TERR.VOID) this.explode(w);
        else if (dist(this.x, this.y, p.x, p.y) < this.r + p.r) this.explode(w);
        else if (this.life <= 0) this.explode(w);
        break;
      }
      default: {
        // Mine : armement puis déclenchement de proximité. On l'enjambe en
        // sautant — la verticalité doit servir aussi à ça.
        const p = w.player;
        if (this.armed && !p.airborne && dist(this.x, this.y, p.x, p.y) < CONF.mine.trigger + p.r) this.explode(w);
        else if (this.life <= 0) this.dead = true;
        break;
      }
    }
  }

  /** Détruite par l'épée / le boomerang : elle saute sans blesser. */
  destroy(w: IWorld) {
    if (this.dead || this.exploded) return;
    this.exploded = true;
    this.dead = true;
    w.fx.burstHit(this.x, this.y, '#ffd166');
    w.sfx('hitmob');
  }

  explode(w: IWorld) {
    if (this.exploded) return;
    this.exploded = true;
    this.dead = true;
    const c = CONF[this.kind];
    w.sfx('bosshit');
    w.shake(this.kind === 'bomb' ? 12 : 8);
    w.fx.burstHit(this.x, this.y, '#ff8a3a');
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      w.fx.spawn('spark', this.x, this.y, Math.cos(a) * 240, Math.sin(a) * 240, 0.35, 5, '#ffce6a');
    }
    w.fx.spawn('ring', this.x, this.y, 0, 0, 0.32, c.blast * 0.4, '#ff8a3a');
    if (dist(this.x, this.y, w.player.x, w.player.y) < c.blast) {
      w.damagePlayer(c.damage, this.x, this.y);
    }
  }

  draw(ctx: Ctx, t: number) {
    if (this.dead) return;
    const y = this.y - this.z;
    switch (this.kind) {
      case 'mine': {
        const armed = this.armed;
        const blink = armed ? 0.5 + 0.5 * Math.sin(t * 10) : 0.5 + 0.5 * Math.sin(t * 22);
        // Zone de déclenchement, toujours visible : la mine ne piège jamais
        // quelqu'un qui regarde le sol.
        ctx.save();
        ctx.globalAlpha = armed ? 0.28 + blink * 0.2 : 0.16;
        ctx.beginPath();
        ctx.arc(this.x, this.y, CONF.mine.trigger, 0, TAU);
        ctx.fillStyle = armed ? '#ff5a4a' : '#8a8a9a';
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.r, this.r * 0.6, 0, 0, TAU);
        ctx.fillStyle = '#4a4450';
        ctx.fill();
        ctx.strokeStyle = '#20202a';
        ctx.lineWidth = 2;
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + 0.4;
          ctx.beginPath();
          ctx.moveTo(this.x + Math.cos(a) * this.r * 0.7, this.y + Math.sin(a) * this.r * 0.4);
          ctx.lineTo(this.x + Math.cos(a) * this.r * 1.35, this.y + Math.sin(a) * this.r * 0.8);
          ctx.strokeStyle = '#6b6478';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        glow(ctx, this.x, this.y - 4, 16 + blink * 8, armed ? '#ff5a4a' : '#9aa0b4', 0.6 * blink);
        break;
      }
      case 'bomb': {
        const k = clamp01(this.life / CONF.bomb.life);
        // Ombre au sol pendant le vol
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, 10, 5, 0, 0, TAU);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(this.x, y, this.r, 0, TAU);
        ctx.fillStyle = '#2b2b36';
        ctx.fill();
        ctx.strokeStyle = '#15151d';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.x - 4, y - 4, 3.5, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();
        // Mèche : sa longueur EST le compte à rebours
        ctx.beginPath();
        ctx.moveTo(this.x + 4, y - this.r * 0.8);
        ctx.quadraticCurveTo(this.x + 12, y - this.r * 1.6, this.x + 6 + k * 8, y - this.r * 1.9);
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        const fz = 3 + Math.sin(t * 40) * 1.6;
        glow(ctx, this.x + 6 + k * 8, y - this.r * 1.9, 14 + fz, '#ffb03b', 0.8);
        star(ctx, this.x + 6 + k * 8, y - this.r * 1.9, fz, 0.4, 5, t * 12);
        ctx.fillStyle = '#fff0a0';
        ctx.fill();
        break;
      }
      default: {
        // Missile : corps + ailerons + traînée
        ctx.save();
        ctx.translate(this.x, y);
        ctx.rotate(this.dir);
        poly(ctx, [-10, -5, 6, -5, 12, 0, 6, 5, -10, 5]);
        ctx.fillStyle = '#c8503c';
        ctx.fill();
        ctx.strokeStyle = '#3a1a14';
        ctx.lineWidth = 2;
        ctx.stroke();
        poly(ctx, [-10, -5, -14, -10, -6, -4]);
        ctx.fillStyle = '#8a3428';
        ctx.fill();
        poly(ctx, [-10, 5, -14, 10, -6, 4]);
        ctx.fill();
        ctx.restore();
        glow(ctx, this.x - Math.cos(this.dir) * 12, y - Math.sin(this.dir) * 12, 22, '#ff9b3a', 0.6);
        break;
      }
    }
  }
}
