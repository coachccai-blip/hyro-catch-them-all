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
  mine: { arm: 0.8, life: 22, trigger: 44, blast: 78, damage: 1, r: 14 },
  bomb: { arm: 0, life: 1.7, trigger: 0, blast: 104, damage: 1, r: 16 },
  missile: { arm: 0, life: 5, trigger: 26, blast: 62, damage: 1, r: 12 },
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
  /** Derniere position connue du joueur : sert au trace de visee. */
  private tx = 0;
  private ty = 0;
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
        this.tx = p.x;
        this.ty = p.y;
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
    w.shake(this.kind === 'bomb' ? 16 : 11);
    w.slowmo(0.12);

    // Ordre de dessin = ordre de creation : la fumee d'abord, la boule de feu
    // par-dessus. L'inverse noyait le coeur incandescent sous le gris.
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * TAU;
      const sp = 40 + Math.random() * 130;
      w.fx.spawn('poof', this.x, this.y, Math.cos(a) * sp, Math.sin(a) * sp - 50,
        0.8 + Math.random() * 0.5, 16 + Math.random() * 18, 'rgba(176,170,188,0.55)', { drag: 0.88 });
    }
    // Onde de choc au sol
    w.fx.spawn('ring', this.x, this.y, 0, 0, 0.45, c.blast * 0.95, 'rgba(255,220,160,0.9)');
    for (let i = 0; i < 2; i++) {
      w.fx.spawn('ring', this.x, this.y, 0, 0, 0.28 + i * 0.08,
        c.blast * (0.4 + i * 0.2), i ? '#ff7a2b' : '#ffe9b8');
    }
    // Boule de feu : trois couches pleines, du coeur blanc a l'enveloppe orange
    w.fx.spawn('flash', this.x, this.y, 0, 0, 0.3, c.blast * 0.62, '#ff7a2b');
    w.fx.spawn('flash', this.x, this.y, 0, 0, 0.22, c.blast * 0.44, '#ffc44a');
    w.fx.spawn('flash', this.x, this.y, 0, 0, 0.15, c.blast * 0.26, '#fffbe8');
    // Langues de feu projetees autour du coeur
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + Math.random();
      const d = c.blast * (0.22 + Math.random() * 0.3);
      w.fx.spawn('flash', this.x + Math.cos(a) * d, this.y + Math.sin(a) * d * 0.7,
        Math.cos(a) * 70, Math.sin(a) * 50, 0.24 + Math.random() * 0.14,
        c.blast * (0.16 + Math.random() * 0.12), i % 2 ? '#ff9b3a' : '#ffd166');
    }
    // Eclats et braises projetes
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU + Math.random() * 0.3;
      const sp = 200 + Math.random() * 320;
      w.fx.spawn('spark', this.x, this.y, Math.cos(a) * sp, Math.sin(a) * sp,
        0.3 + Math.random() * 0.3, 4 + Math.random() * 5,
        i % 3 === 0 ? '#fff3c4' : '#ffb03b', { drag: 0.86 });
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * TAU;
      const sp = 60 + Math.random() * 180;
      w.fx.spawn('ember', this.x, this.y, Math.cos(a) * sp, Math.sin(a) * sp - 90,
        0.7 + Math.random() * 0.4, 4 + Math.random() * 4, '#ff8a3a', { grav: 420, drag: 0.93 });
    }
    if (dist(this.x, this.y, w.player.x, w.player.y) < c.blast) {
      w.damagePlayer(c.damage, this.x, this.y);
    }
  }

  draw(ctx: Ctx, t: number) {
    if (this.dead) return;
    switch (this.kind) {
      case 'mine': this.drawMine(ctx, t); break;
      case 'bomb': this.drawBomb(ctx, t); break;
      default: this.drawMissile(ctx, t); break;
    }
  }

  /**
   * Mine : un radar au sol. Le disque de declenchement pulse, un balayage
   * tourne dessus et la diode s'affole quand elle est armee. Impossible de
   * marcher dessus sans l'avoir vue.
   */
  private drawMine(ctx: Ctx, t: number) {
    const armed = this.armed;
    const R = CONF.mine.trigger;
    const pulse = 0.5 + 0.5 * Math.sin(t * (armed ? 9 : 20));
    const col = armed ? '#ff5a4a' : '#8f96ad';

    ctx.save();
    // Disque de menace
    ctx.globalAlpha = armed ? 0.2 + pulse * 0.16 : 0.12;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, R, R * 0.62, 0, 0, TAU);
    ctx.fillStyle = col;
    ctx.fill();
    // Balayage radar
    ctx.globalAlpha = armed ? 0.34 : 0.18;
    const sweep = t * (armed ? 3.4 : 1.6);
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.ellipse(this.x, this.y, R, R * 0.62, 0, sweep, sweep + 0.7);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    // Rebord
    ctx.globalAlpha = armed ? 0.75 : 0.4;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, R, R * 0.62, 0, 0, TAU);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = -t * 26;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Onde d'armement : elle se resserre puis disparait
    if (!armed) {
      const k = clamp01(this.age / CONF.mine.arm);
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, R * (1.5 - k * 0.9), R * 0.62 * (1.5 - k * 0.9), 0, 0, TAU);
      ctx.strokeStyle = '#cfd6e8';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // Corps : socle, picots, coque, diode
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 3, this.r * 1.25, this.r * 0.55, 0, 0, TAU);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      poly(ctx, [
        this.x + Math.cos(a) * this.r * 0.8, this.y + Math.sin(a) * this.r * 0.48 - 3,
        this.x + Math.cos(a) * this.r * 1.7, this.y + Math.sin(a) * this.r * 1.0 - 5,
        this.x + Math.cos(a + 0.35) * this.r * 0.8, this.y + Math.sin(a + 0.35) * this.r * 0.48 - 3,
      ]);
      ctx.fillStyle = '#6b6478';
      ctx.fill();
      ctx.strokeStyle = '#20202a';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(this.x, this.y - 4, this.r, this.r * 0.74, 0, 0, TAU);
    ctx.fillStyle = '#4a4450';
    ctx.fill();
    ctx.strokeStyle = '#191922';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(this.x - this.r * 0.28, this.y - this.r * 0.5, this.r * 0.34, this.r * 0.2, -0.5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    // Diode
    ctx.beginPath();
    ctx.arc(this.x, this.y - this.r * 0.55, 3 + pulse * 1.6, 0, TAU);
    ctx.fillStyle = armed ? '#ff3a2a' : '#8fe0a0';
    ctx.fill();
    glow(ctx, this.x, this.y - this.r * 0.55, 14 + pulse * 12, armed ? '#ff4a3a' : '#8fe0a0', 0.5 + pulse * 0.4);
  }

  /**
   * Bombe : masse lourde qui tourne en cloche, mèche qui se consume, et un
   * marqueur au sol qui annonce le point de chute **et** le rayon de souffle.
   */
  private drawBomb(ctx: Ctx, t: number) {
    const k = clamp01(this.life / CONF.bomb.life);
    const y = this.y - this.z;
    const urgent = 1 - k;

    // Marqueur d'impact : cercle de souffle au sol
    ctx.save();
    ctx.globalAlpha = 0.2 + urgent * 0.3;
    ctx.beginPath();
    ctx.ellipse(this.to.x || this.x, this.to.y || this.y, CONF.bomb.blast, CONF.bomb.blast * 0.6, 0, 0, TAU);
    ctx.fillStyle = '#ff5a3a';
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#ff7a4a';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 9]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath();
    ctx.ellipse(this.to.x || this.x, this.to.y || this.y, CONF.bomb.blast, CONF.bomb.blast * 0.6, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Ombre portee : elle se resserre quand la bombe redescend
    const zk = 1 - Math.min(0.5, this.z / 90);
    ctx.save();
    ctx.globalAlpha = 0.3 * zk + 0.1;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 11 * zk, 5.5 * zk, 0, 0, TAU);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, y);
    ctx.rotate(this.age * 5.5);
    // Corps
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, TAU);
    ctx.fillStyle = '#26262f';
    ctx.fill();
    ctx.strokeStyle = '#101018';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    // Ceinture metallique
    ctx.beginPath();
    ctx.ellipse(0, 0, this.r, this.r * 0.34, 0.3, 0, TAU);
    ctx.strokeStyle = '#6a6a7c';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Reflet
    ctx.beginPath();
    ctx.arc(-this.r * 0.34, -this.r * 0.34, this.r * 0.28, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
    // Pulsation rouge, de plus en plus rapide
    const beat = 0.5 + 0.5 * Math.sin(t * (7 + urgent * 34));
    ctx.globalAlpha = 0.25 + urgent * 0.55 * beat;
    ctx.beginPath();
    ctx.arc(0, 0, this.r * 0.92, 0, TAU);
    ctx.fillStyle = '#ff3a2a';
    ctx.fill();
    ctx.restore();

    // Mèche : sa longueur EST le compte à rebours
    const fuseX = this.x + 5 + k * 9;
    const fuseY = y - this.r * (1.35 + k * 0.7);
    ctx.beginPath();
    ctx.moveTo(this.x + 3, y - this.r * 0.85);
    ctx.quadraticCurveTo(this.x + 12, y - this.r * 1.5, fuseX, fuseY);
    ctx.strokeStyle = '#caa63a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Flamme de mèche
    const fz = 4 + Math.sin(t * 44) * 2 + urgent * 3;
    glow(ctx, fuseX, fuseY, 22 + fz * 2.2, '#ffb03b', 0.85);
    star(ctx, fuseX, fuseY, fz * 1.5, 0.4, 6, t * 14);
    ctx.fillStyle = '#ffd166';
    ctx.fill();
    star(ctx, fuseX, fuseY, fz * 0.75, 0.45, 6, -t * 11);
    ctx.fillStyle = '#fffbe0';
    ctx.fill();
  }

  /**
   * Missile : corps profile, tuyere a trois couches, anneaux de choc et
   * **ligne de visee** jusqu'au joueur. On doit comprendre en un coup d'oeil
   * qu'il vient pour soi, et de quel cote s'ecarter.
   */
  private drawMissile(ctx: Ctx, t: number) {
    const cs = Math.cos(this.dir);
    const sn = Math.sin(this.dir);

    // Ligne de visee jusqu'a la cible
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 12);
    ctx.strokeStyle = '#ff6a4a';
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 8]);
    ctx.lineDashOffset = -t * 90;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.tx, this.ty);
    ctx.stroke();
    ctx.setLineDash([]);
    // Reticule sur la cible
    const rr = 20 + Math.sin(t * 9) * 4;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(this.tx, this.ty, rr, rr * 0.6, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // Ombre au sol
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 10, 12, 5, 0, 0, TAU);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.dir);
    ctx.scale(1.45, 1.45);

    // Tuyere : trois couches qui battent
    const fl = 18 + Math.sin(t * 38) * 6;
    glow(ctx, -14 - fl * 0.4, 0, 30 + fl, '#ff8a2b', 0.75);
    poly(ctx, [-11, -6, -11 - fl, 0, -11, 6]);
    ctx.fillStyle = '#ff6a1e';
    ctx.fill();
    poly(ctx, [-11, -4, -11 - fl * 0.66, 0, -11, 4]);
    ctx.fillStyle = '#ffc44a';
    ctx.fill();
    poly(ctx, [-11, -2, -11 - fl * 0.34, 0, -11, 2]);
    ctx.fillStyle = '#fffbe0';
    ctx.fill();

    // Anneaux de choc le long du fuselage
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 2; i++) {
      const o = ((t * 90 + i * 22) % 44) - 6;
      ctx.beginPath();
      ctx.ellipse(-10 - o, 0, 2.5, 7 + o * 0.16, 0, 0, TAU);
      ctx.stroke();
    }

    // Ailerons arriere
    poly(ctx, [-9, -5, -15, -12, -4, -4]);
    ctx.fillStyle = '#8a3428';
    ctx.fill();
    ctx.strokeStyle = '#2e1410';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    poly(ctx, [-9, 5, -15, 12, -4, 4]);
    ctx.fill();
    ctx.stroke();

    // Fuselage
    poly(ctx, [-11, -5.5, 5, -5.5, 14, 0, 5, 5.5, -11, 5.5]);
    ctx.fillStyle = '#d8d2c8';
    ctx.fill();
    ctx.strokeStyle = '#2e1410';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    // Ogive rouge
    poly(ctx, [5, -5.5, 14, 0, 5, 5.5]);
    ctx.fillStyle = '#d8412f';
    ctx.fill();
    ctx.stroke();
    // Bandes d'avertissement
    ctx.fillStyle = '#2e1410';
    ctx.fillRect(-2, -5.4, 2, 10.8);
    ctx.fillRect(2, -5.2, 1.4, 10.4);
    // Reflet superieur
    ctx.beginPath();
    ctx.moveTo(-9, -3.4);
    ctx.lineTo(4, -3.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Petit oeil de guidage qui clignote
    ctx.beginPath();
    ctx.arc(8, 0, 1.8, 0, TAU);
    ctx.fillStyle = Math.sin(t * 18) > 0 ? '#ffe066' : '#8a2a1e';
    ctx.fill();
    ctx.restore();
  }
}
