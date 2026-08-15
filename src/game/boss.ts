/**
 * NERAT, le Rat Noir — combat final en trois phases (niveau 5-5).
 *  1. Charges : il fonce, s'assomme contre les murs → fenetre d'epee.
 *  2. Invocations : il se refugie sur les passerelles (grappin requis) et
 *     appelle des vagues de souris et d'elites.
 *  3. Fureur fondue : le sol se couvre de fondue, il faut le coller puis
 *     enchainer l'epee, avant la capture finale au filet geant.
 */

import { TAU, clamp01, damp, dist, wrapAngle, type Vec2 } from '../core/math';
import { CELL, TERR, type MouseKind } from '../levels/types';
import { drawNerat, type BossView } from '../render/characters';
import { glow, rgba, type Ctx } from '../render/draw';
import type { IWorld } from './types';
import type { MoveCaps } from './physics';

export interface BossWorld extends IWorld {
  summonMouse(kind: MouseKind, x: number, y: number): void;
  summonMob(kind: 'elite' | 'guard', x: number, y: number): void;
  addFondue(x: number, y: number, r: number, life: number): void;
  bossDefeated(): void;
  ledgePoints: Vec2[];
  arenaCenter: Vec2;
}

const CAPS: MoveCaps = { ledge: true };
const MAX_HP = 30;

export class Nerat {
  x: number;
  y: number;
  r = 46;
  hp = MAX_HP;
  maxHp = MAX_HP;
  phase = 1;
  dir = 0;
  anim = 0;
  stun = 0;
  glue = 0;
  flash = 0;
  dead = false;
  captured = false;
  /** Etat final : capturable au filet geant. */
  capturable = false;
  onLedge = false;
  intro = 2.6;

  private state: 'idle' | 'aim' | 'charge' | 'stunned' | 'summon' | 'jump' | 'rage' | 'defeat' = 'idle';
  private timer = 1.4;
  private chargeDir: Vec2 = { x: 1, y: 0 };
  private vx = 0;
  private vy = 0;
  private summonCount = 0;
  private ledgeIndex = 0;
  private fondueTimer = 0;
  private hitCooldown = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get vulnerable(): boolean {
    if (this.capturable) return false;
    if (this.phase === 1) return this.stun > 0;
    if (this.phase === 2) return true; // atteignable seulement en montant sur la passerelle
    return this.glue > 0 || this.stun > 0;
  }

  hit(damage: number, fromX: number, fromY: number, w: BossWorld) {
    if (this.capturable || this.dead) return;
    if (!this.vulnerable) {
      this.flash = 0.2;
      w.fx.floatingText(this.x, this.y - 120, this.phase === 1 ? 'Étourdis-le !' : 'Colle-le !', '#ffd166');
      return;
    }
    if (this.hitCooldown > 0) return;
    this.hitCooldown = 0.18;
    this.hp -= damage;
    this.flash = 0.4;
    w.sfx('bosshit');
    w.shake(9);
    w.fx.burstHit(this.x, this.y - 60, '#ffd166');
    const prevPhase = this.phase;
    if (this.hp <= MAX_HP * 0.66 && this.phase === 1) this.enterPhase(2, w);
    else if (this.hp <= MAX_HP * 0.33 && this.phase === 2) this.enterPhase(3, w);
    if (this.hp <= 0) {
      this.hp = 0;
      this.capturable = true;
      this.state = 'defeat';
      this.stun = 999;
      w.sfx('roar');
      w.fx.floatingText(this.x, this.y - 140, 'CAPTURE-LE AU FILET !', '#ffe066');
    }
    void prevPhase;
  }

  applyGlue(seconds: number) {
    this.glue = Math.max(this.glue, seconds);
  }

  applyStun(seconds: number) {
    if (this.phase === 1 || this.phase === 3) this.stun = Math.max(this.stun, seconds);
  }

  private enterPhase(p: number, w: BossWorld) {
    this.phase = p;
    this.state = 'idle';
    this.timer = 1.2;
    this.stun = 0;
    w.sfx('roar');
    w.shake(16);
    w.fx.floatingText(this.x, this.y - 150, p === 2 ? 'PHASE 2 — Invocations' : 'PHASE 3 — Fureur fondue', '#ff6a5e');
    if (p === 2) {
      this.state = 'jump';
      this.timer = 0.6;
    }
  }

  update(dt: number, w: BossWorld) {
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt * 3);
    this.hitCooldown -= dt;
    if (this.intro > 0) {
      this.intro -= dt;
      return;
    }
    if (this.capturable) {
      this.vx = damp(this.vx, 0, 8, dt);
      this.vy = damp(this.vy, 0, 8, dt);
      return;
    }
    if (this.glue > 0) this.glue -= dt;
    if (this.stun > 0) {
      this.stun -= dt;
      if (this.stun <= 0 && this.state === 'stunned') {
        this.state = 'idle';
        this.timer = 0.8;
      }
    }

    const p = w.player;
    this.timer -= dt;

    switch (this.phase) {
      case 1: this.updatePhase1(dt, w, p); break;
      case 2: this.updatePhase2(dt, w, p); break;
      default: this.updatePhase3(dt, w, p); break;
    }

    // Degats au contact pendant les charges
    if (this.state === 'charge' && dist(this.x, this.y, p.x, p.y) < this.r + p.r) {
      w.damagePlayer(1, this.x, this.y);
    }
  }

  private updatePhase1(dt: number, w: BossWorld, p: { x: number; y: number }) {
    if (this.stun > 0) {
      this.state = 'stunned';
      this.vx = damp(this.vx, 0, 10, dt);
      this.vy = damp(this.vy, 0, 10, dt);
      return;
    }
    switch (this.state) {
      case 'aim':
        this.dir = damp(this.dir, Math.atan2(p.y - this.y, p.x - this.x), 6, dt);
        this.dir = this.dir + wrapAngle(Math.atan2(p.y - this.y, p.x - this.x) - this.dir) * Math.min(1, dt * 5);
        if (this.timer <= 0) {
          this.state = 'charge';
          this.timer = 2.2;
          this.chargeDir = { x: Math.cos(this.dir), y: Math.sin(this.dir) };
          w.sfx('roar');
        }
        break;
      case 'charge': {
        const sp = 620;
        const before = { x: this.x, y: this.y };
        w.nav.moveAndSlide(this, this.chargeDir.x * sp * dt, this.chargeDir.y * sp * dt, CAPS);
        const moved = dist(before.x, before.y, this.x, this.y);
        w.fx.dust(this.x, this.y + 10, 'rgba(255,180,120,0.6)', 2);
        if (moved < sp * dt * 0.4 || this.timer <= 0) {
          // Impact contre un mur : etourdissement
          this.state = 'stunned';
          this.stun = 2.6;
          w.shake(18);
          w.sfx('bosshit');
          w.fx.burstHit(this.x, this.y - 40, '#ffffff');
        }
        break;
      }
      default:
        this.vx = damp(this.vx, 0, 8, dt);
        this.vy = damp(this.vy, 0, 8, dt);
        this.dir = Math.atan2(p.y - this.y, p.x - this.x);
        if (this.timer <= 0) {
          this.state = 'aim';
          this.timer = 0.85;
        }
        break;
    }
  }

  private updatePhase2(dt: number, w: BossWorld, p: { x: number; y: number }) {
    this.onLedge = true;
    switch (this.state) {
      case 'jump': {
        if (this.timer <= 0) {
          const pts = w.ledgePoints;
          this.ledgeIndex = (this.ledgeIndex + 1 + Math.floor(Math.random() * (pts.length - 1))) % pts.length;
          const t = pts[this.ledgeIndex];
          this.x = t.x;
          this.y = t.y;
          w.shake(10);
          w.fx.dust(this.x, this.y, '#ffffff', 12);
          this.state = 'summon';
          this.timer = 1;
          this.summonCount = 0;
        }
        break;
      }
      case 'summon': {
        if (this.timer <= 0) {
          this.timer = 0.55;
          this.summonCount++;
          const a = Math.random() * TAU;
          const d = 150 + Math.random() * 180;
          const sx = w.arenaCenter.x + Math.cos(a) * d;
          const sy = w.arenaCenter.y + Math.sin(a) * d;
          if (this.summonCount % 4 === 0) w.summonMob('elite', sx, sy);
          else w.summonMouse((['red', 'green', 'purple', 'black'] as MouseKind[])[this.summonCount % 4], sx, sy);
          w.fx.burstHit(sx, sy, '#b768e8');
          w.sfx('squeak', 3);
          if (this.summonCount >= 6) {
            this.state = 'idle';
            this.timer = 5.5;
          }
        }
        break;
      }
      default:
        this.dir = Math.atan2(p.y - this.y, p.x - this.x);
        if (this.timer <= 0) {
          this.state = 'jump';
          this.timer = 0.5;
        }
        break;
    }
  }

  private updatePhase3(dt: number, w: BossWorld, p: { x: number; y: number }) {
    this.onLedge = false;
    this.fondueTimer -= dt;
    if (this.fondueTimer <= 0) {
      this.fondueTimer = 1.5;
      const a = Math.random() * TAU;
      const d = Math.random() * 300;
      w.addFondue(w.arenaCenter.x + Math.cos(a) * d, w.arenaCenter.y + Math.sin(a) * d, 70 + Math.random() * 50, 7);
    }
    if (this.stun > 0 || this.glue > 0) {
      this.state = 'stunned';
      this.vx = damp(this.vx, 0, 12, dt);
      this.vy = damp(this.vy, 0, 12, dt);
      return;
    }
    switch (this.state) {
      case 'aim':
        this.dir = this.dir + wrapAngle(Math.atan2(p.y - this.y, p.x - this.x) - this.dir) * Math.min(1, dt * 7);
        if (this.timer <= 0) {
          this.state = 'charge';
          this.timer = 1.6;
          this.chargeDir = { x: Math.cos(this.dir), y: Math.sin(this.dir) };
          w.sfx('roar');
        }
        break;
      case 'charge': {
        const sp = 760;
        const before = { x: this.x, y: this.y };
        w.nav.moveAndSlide(this, this.chargeDir.x * sp * dt, this.chargeDir.y * sp * dt, CAPS);
        w.fx.spawn('ember', this.x, this.y + 6, (Math.random() - 0.5) * 60, -40, 0.5, 6, '#ff9b3a');
        if (dist(before.x, before.y, this.x, this.y) < sp * dt * 0.4 || this.timer <= 0) {
          this.state = 'rage';
          this.timer = 1.1;
          w.shake(14);
        }
        break;
      }
      case 'rage': {
        if (this.timer <= 0) {
          this.state = 'idle';
          this.timer = 0.7;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            w.spawnProjectile(this.x, this.y - 40, Math.cos(a) * 240, Math.sin(a) * 240, 'mob', 1);
          }
          w.sfx('roar');
        }
        break;
      }
      default:
        this.dir = Math.atan2(p.y - this.y, p.x - this.x);
        if (this.timer <= 0) {
          this.state = 'aim';
          this.timer = 0.6;
        }
        break;
    }
  }

  view(): BossView {
    return {
      x: this.x, y: this.y, dir: this.dir, anim: this.anim, hp: this.hp, maxHp: this.maxHp,
      phase: this.phase, stunned: this.stun > 0, glued: this.glue > 0, flash: this.flash,
      scale: 1, charging: this.state === 'charge',
    };
  }

  draw(ctx: Ctx) {
    // Telegraphe de charge
    if (this.state === 'aim') {
      ctx.save();
      ctx.globalAlpha = 0.28 + 0.2 * Math.sin(this.anim * 18);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.dir - 0.09) * 900, this.y + Math.sin(this.dir - 0.09) * 900);
      ctx.lineTo(this.x + Math.cos(this.dir + 0.09) * 900, this.y + Math.sin(this.dir + 0.09) * 900);
      ctx.closePath();
      ctx.fillStyle = '#ff5a4a';
      ctx.fill();
      ctx.restore();
    }
    if (this.capturable) glow(ctx, this.x, this.y - 50, 180, '#ffe066', 0.4 + 0.2 * Math.sin(this.anim * 4));
    drawNerat(ctx, this.view());
  }
}

export { MAX_HP as NERAT_MAX_HP };
