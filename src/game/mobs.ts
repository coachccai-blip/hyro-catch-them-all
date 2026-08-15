/**
 * Mobs hostiles : non capturables, ils se tuent a l'epee.
 * Chaque type a un pattern lisible et telegraphe.
 */

import { TAU, clamp01, damp, dist, type Vec2 } from '../core/math';
import type { MobKind } from '../levels/types';
import { drawMob, type MobView } from '../render/characters';
import type { Ctx } from '../render/draw';
import type { IMob, IWorld } from './types';
import type { MoveCaps } from './physics';

interface MobProfile {
  hp: number;
  speed: number;
  detect: number;
  fly: boolean;
  scale: number;
  contact: number;
  shoots: boolean;
}

export const MOB_PROFILES: Record<MobKind, MobProfile> = {
  roach: { hp: 2, speed: 165, detect: 320, fly: false, scale: 1, contact: 1, shoots: false },
  crow: { hp: 2, speed: 205, detect: 420, fly: true, scale: 1, contact: 1, shoots: false },
  guard: { hp: 3, speed: 128, detect: 300, fly: false, scale: 1, contact: 1, shoots: false },
  drone: { hp: 2, speed: 145, detect: 460, fly: true, scale: 1, contact: 1, shoots: true },
  elite: { hp: 4, speed: 190, detect: 460, fly: false, scale: 1.15, contact: 1, shoots: true },
};

const GROUND_CAPS: MoveCaps = {};
const FLY_CAPS: MoveCaps = { fly: true };

export class MobEnt implements IMob {
  kind: MobKind;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  dead = false;
  dir = 0;
  anim = Math.random() * 10;
  scale: number;
  /** Hauteur de vol normalisee 0..1 (corbeaux, drones). */
  altitude = 0;
  telegraph = 0;
  flash = 0;
  /** Rat de garde attache a une barriere (verrou 'guard'). */
  barrierId: number | undefined;
  isMiniBoss = false;
  lured = false;

  private prof: MobProfile;
  private state: 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'dive' | 'lured' = 'idle';
  private timer = 0;
  private cooldown = 0;
  private target: Vec2;
  private home: Vec2;
  private vx = 0;
  private vy = 0;
  private knock = 0;
  private kx = 0;
  private ky = 0;

  constructor(kind: MobKind, x: number, y: number, miniBoss = false, barrierId?: number) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.prof = MOB_PROFILES[kind];
    this.isMiniBoss = miniBoss;
    this.scale = this.prof.scale * (miniBoss ? 2 : 1);
    this.hp = this.prof.hp * (miniBoss ? 4 : 1);
    this.maxHp = this.hp;
    this.r = 18 * this.scale;
    this.home = { x, y };
    this.target = { x, y };
    this.barrierId = barrierId;
    this.altitude = this.prof.fly ? 1 : 0;
  }

  get caps(): MoveCaps {
    return this.prof.fly ? FLY_CAPS : GROUND_CAPS;
  }

  hit(damage: number, fromX: number, fromY: number) {
    if (this.dead) return;
    // Un rat de garde bloquant une porte est invulnerable : il faut le leurrer
    if (this.barrierId !== undefined && this.barrierId >= 0) {
      this.flash = 0.3;
      return;
    }
    this.hp -= damage;
    this.flash = 0.35;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.knock = 0.22;
    this.kx = Math.cos(a) * 380;
    this.ky = Math.sin(a) * 380;
    if (this.hp <= 0) this.dead = true;
  }

  update(dt: number, w: IWorld) {
    if (this.dead) return;
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt * 3);
    this.cooldown -= dt;
    const p = w.player;
    const d = dist(this.x, this.y, p.x, p.y);

    if (this.knock > 0) {
      this.knock -= dt;
      w.nav.moveAndSlide(this, this.kx * dt, this.ky * dt, this.caps);
      this.kx *= 0.86;
      this.ky *= 0.86;
      return;
    }

    // Leurre a fromage : detourne les mobs terrestres
    if (w.lurePoint && !this.prof.fly) {
      const dl = dist(this.x, this.y, w.lurePoint.x, w.lurePoint.y);
      if (dl < 560) {
        this.state = 'lured';
        this.lured = true;
      }
    } else if (this.state === 'lured') {
      this.state = 'idle';
      this.lured = false;
    }

    switch (this.kind) {
      case 'roach': this.updateRoach(dt, w, p, d); break;
      case 'crow': this.updateCrow(dt, w, p, d); break;
      case 'guard': this.updateGuard(dt, w, p, d); break;
      case 'drone': this.updateDrone(dt, w, p, d); break;
      default: this.updateElite(dt, w, p, d); break;
    }

    // Degats au contact
    if (this.state !== 'lured' && d < this.r + p.r && this.cooldown <= 0 && this.altitude < 0.35) {
      this.cooldown = 1;
      w.damagePlayer(this.prof.contact, this.x, this.y);
    }
  }

  private goto(dt: number, w: IWorld, tx: number, ty: number, speed: number, away = false) {
    const s = w.nav.steer(this.x, this.y, this.r, tx, ty, this.caps, away);
    this.vx = damp(this.vx, s.x * speed, 9, dt);
    this.vy = damp(this.vy, s.y * speed, 9, dt);
    if (Math.hypot(this.vx, this.vy) > 8) this.dir = Math.atan2(this.vy, this.vx);
    w.nav.moveAndSlide(this, this.vx * dt, this.vy * dt, this.caps);
  }

  private wander(dt: number, w: IWorld, radius = 260) {
    this.timer -= dt;
    if (this.timer <= 0 || dist(this.x, this.y, this.target.x, this.target.y) < 26) {
      this.timer = 1.6 + Math.random() * 2.4;
      this.target = w.nav.randomWalkableNear(this.home.x, this.home.y, radius, this.caps);
    }
    this.goto(dt, w, this.target.x, this.target.y, this.prof.speed * 0.42);
  }

  private updateRoach(dt: number, w: IWorld, p: Vec2, d: number) {
    if (this.state === 'lured' && w.lurePoint) {
      this.goto(dt, w, w.lurePoint.x, w.lurePoint.y, this.prof.speed * 0.6);
      return;
    }
    if (d < this.prof.detect && w.nav.lineOfSight(this.x, this.y, p.x, p.y)) {
      // Charge en ligne droite
      this.goto(dt, w, p.x, p.y, this.prof.speed);
      this.state = 'chase';
    } else {
      this.state = 'idle';
      this.wander(dt, w);
    }
  }

  private updateCrow(dt: number, w: IWorld, p: Vec2, d: number) {
    this.timer -= dt;
    switch (this.state) {
      case 'windup':
        this.altitude = damp(this.altitude, 1, 6, dt);
        this.telegraph = 1;
        this.goto(dt, w, p.x, p.y, this.prof.speed * 0.35);
        if (this.timer <= 0) {
          this.state = 'dive';
          this.timer = 0.55;
          this.target = { x: p.x, y: p.y };
          w.sfx('squeak', 1);
        }
        break;
      case 'dive': {
        this.telegraph = 0;
        this.altitude = damp(this.altitude, 0, 12, dt);
        this.goto(dt, w, this.target.x, this.target.y, this.prof.speed * 2.1);
        if (this.timer <= 0) {
          this.state = 'recover';
          this.timer = 1.4;
        }
        break;
      }
      case 'recover':
        this.altitude = damp(this.altitude, 1, 4, dt);
        this.goto(dt, w, this.home.x, this.home.y, this.prof.speed * 0.6);
        if (this.timer <= 0) this.state = 'idle';
        break;
      default:
        this.altitude = damp(this.altitude, 1, 3, dt);
        this.telegraph = 0;
        if (d < this.prof.detect && this.cooldown <= 0) {
          this.state = 'windup';
          this.timer = 0.85;
          this.cooldown = 3.2;
        } else {
          this.wander(dt, w, 320);
        }
        break;
    }
  }

  private updateGuard(dt: number, w: IWorld, p: Vec2, d: number) {
    if (this.state === 'lured' && w.lurePoint) {
      this.goto(dt, w, w.lurePoint.x, w.lurePoint.y, this.prof.speed * 0.9);
      return;
    }
    // Un garde de porte ne quitte jamais son poste sans leurre
    if (this.barrierId !== undefined && this.barrierId >= 0) {
      this.goto(dt, w, this.home.x, this.home.y, this.prof.speed * 0.5);
      this.dir = Math.atan2(p.y - this.y, p.x - this.x);
      return;
    }
    this.timer -= dt;
    if (this.state === 'windup') {
      this.telegraph = 1;
      if (this.timer <= 0) {
        this.state = 'attack';
        this.timer = 0.25;
        this.telegraph = 0;
        if (dist(this.x, this.y, p.x, p.y) < this.r + 46) w.damagePlayer(1, this.x, this.y);
        w.sfx('hitmob');
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) {
        this.state = 'idle';
        this.cooldown = 1.2;
      }
      return;
    }
    if (d < this.prof.detect && w.nav.lineOfSight(this.x, this.y, p.x, p.y)) {
      this.goto(dt, w, p.x, p.y, this.prof.speed);
      if (d < this.r + 46 && this.cooldown <= 0) {
        this.state = 'windup';
        this.timer = 0.55;
      }
    } else {
      this.wander(dt, w, 300);
    }
  }

  private updateDrone(dt: number, w: IWorld, p: Vec2, d: number) {
    this.altitude = damp(this.altitude, 1, 3, dt);
    if (d < this.prof.detect) {
      this.dir = Math.atan2(p.y - this.y, p.x - this.x);
      if (d < 220) this.goto(dt, w, p.x, p.y, this.prof.speed, true);
      else if (d > 340) this.goto(dt, w, p.x, p.y, this.prof.speed);
      else this.goto(dt, w, this.x + Math.cos(this.anim) * 60, this.y + Math.sin(this.anim) * 60, this.prof.speed * 0.6);

      this.timer -= dt;
      if (this.cooldown <= 0 && this.state !== 'windup') {
        this.state = 'windup';
        this.timer = 0.7;
        this.telegraph = 1;
      } else if (this.state === 'windup' && this.timer <= 0) {
        this.state = 'idle';
        this.telegraph = 0;
        this.cooldown = 2.4;
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        w.spawnProjectile(this.x, this.y - 40, Math.cos(a) * 300, Math.sin(a) * 300, 'mob', 1);
        w.sfx('boomerang');
      }
    } else {
      this.telegraph = 0;
      this.wander(dt, w, 300);
    }
  }

  private updateElite(dt: number, w: IWorld, p: Vec2, d: number) {
    if (this.state === 'lured' && w.lurePoint) {
      this.goto(dt, w, w.lurePoint.x, w.lurePoint.y, this.prof.speed * 0.8);
      return;
    }
    this.timer -= dt;
    if (d < this.prof.detect) {
      if (this.state === 'windup') {
        this.telegraph = 1;
        if (this.timer <= 0) {
          this.telegraph = 0;
          this.state = 'idle';
          this.cooldown = 2.6;
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          for (let i = -1; i <= 1; i++) {
            w.spawnProjectile(this.x, this.y - 30, Math.cos(a + i * 0.22) * 320, Math.sin(a + i * 0.22) * 320, 'mob', 1);
          }
          w.sfx('boomerang');
        }
        return;
      }
      this.goto(dt, w, p.x, p.y, this.prof.speed * (d > 240 ? 1.3 : 0.8));
      if (this.cooldown <= 0 && d > 150) {
        this.state = 'windup';
        this.timer = 0.6;
      }
    } else {
      this.wander(dt, w, 320);
    }
  }

  view(): MobView {
    return {
      x: this.x, y: this.y, dir: this.dir, anim: this.anim, kind: this.kind,
      hp: this.hp, maxHp: this.maxHp, scale: this.scale, telegraph: this.telegraph,
      altitude: this.altitude, flash: this.flash,
    };
  }

  draw(ctx: Ctx) {
    drawMob(ctx, this.view());
  }
}

// ---------------------------------------------------------------------------

export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r = 9;
  life = 3.2;
  dead = false;
  owner: 'mob' | 'mouse' | 'player';
  damage: number;
  anim = 0;

  constructor(x: number, y: number, vx: number, vy: number, owner: 'mob' | 'mouse' | 'player', damage = 1) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.owner = owner;
    this.damage = damage;
  }

  update(dt: number, w: IWorld) {
    this.anim += dt;
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.life <= 0) this.dead = true;
    if (w.nav.blocked(this.x, this.y, 5, { gap: true, water: true, ledge: false })) {
      this.dead = true;
      w.fx.burstHit(this.x, this.y, '#ffd166');
    }
    const p = w.player;
    if (dist(this.x, this.y, p.x, p.y) < this.r + p.r) {
      this.dead = true;
      w.damagePlayer(this.damage, this.x, this.y);
    }
  }

  draw(ctx: Ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.anim * 8);
    ctx.beginPath();
    if (this.owner === 'mouse') {
      // Objet jete (boulon)
      ctx.moveTo(-7, -7);
      ctx.lineTo(7, -5);
      ctx.lineTo(6, 7);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fillStyle = '#a89c8c';
    } else {
      ctx.arc(0, 0, 8, 0, TAU);
      ctx.fillStyle = '#ffd166';
    }
    ctx.fill();
    ctx.strokeStyle = '#3a2a18';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}
