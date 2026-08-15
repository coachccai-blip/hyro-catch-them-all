/**
 * Les souris : une machine a etats commune, un profil de comportement par
 * bandana. Ajouter un type = ajouter une entree dans PROFILES.
 */

import { TAU, clamp, clamp01, damp, dist, inCone, wrapAngle, type Vec2 } from '../core/math';
import { CELL, TERR, type MouseKind } from '../levels/types';
import type { MouseSpawn } from '../levels/generator';
import { BANDANA_COLORS } from '../render/palette';
import { drawMouse, type MouseView } from '../render/characters';
import type { Ctx } from '../render/draw';
import type { IMouse, IWorld } from './types';
import type { MoveCaps } from './physics';

export type MouseState =
  | 'patrol' | 'alert' | 'flee' | 'attack' | 'hide' | 'stunned' | 'captured' | 'lured' | 'sabotage';

interface Profile {
  speed: number;
  fleeSpeed: number;
  detect: number;
  /** Demi-angle du cone de vision (rad). */
  cone: number;
  /** Chance de se cacher apres une fuite. */
  hides: number;
  /** Attaque Hyro au corps a corps. */
  aggressive: boolean;
  /** Necessite d'etre assommee ou collee pour etre capturee. */
  needsStun: boolean;
  /** Utilise des gadgets adverses. */
  tinker: boolean;
  /** Semi-transparente : visible seulement au radar. */
  shadow: boolean;
  /** Zigzag pendant la fuite. */
  zigzag: number;
  scale: number;
}

export const PROFILES: Record<MouseKind, Profile> = {
  blue: { speed: 62, fleeSpeed: 120, detect: 170, cone: 1.1, hides: 0.1, aggressive: false, needsStun: false, tinker: false, shadow: false, zigzag: 0, scale: 1 },
  yellow: { speed: 88, fleeSpeed: 205, detect: 265, cone: 1.35, hides: 0.5, aggressive: false, needsStun: false, tinker: false, shadow: false, zigzag: 0.25, scale: 1 },
  red: { speed: 96, fleeSpeed: 150, detect: 300, cone: 1.2, hides: 0.05, aggressive: true, needsStun: true, tinker: false, shadow: false, zigzag: 0, scale: 1.1 },
  green: { speed: 130, fleeSpeed: 355, detect: 310, cone: 1.5, hides: 0.35, aggressive: false, needsStun: true, tinker: false, shadow: false, zigzag: 0.9, scale: 0.95 },
  purple: { speed: 92, fleeSpeed: 185, detect: 330, cone: 1.4, hides: 0.3, aggressive: false, needsStun: false, tinker: true, shadow: false, zigzag: 0.3, scale: 1.05 },
  black: { speed: 105, fleeSpeed: 235, detect: 280, cone: 1.5, hides: 0.55, aggressive: false, needsStun: false, tinker: false, shadow: true, zigzag: 0.45, scale: 1 },
  white: { speed: 120, fleeSpeed: 300, detect: 380, cone: 1.6, hides: 0.6, aggressive: false, needsStun: false, tinker: false, shadow: false, zigzag: 0.6, scale: 1.05 },
};

const CAPS: MoveCaps = {};
const PERCHED_CAPS: MoveCaps = { ledge: true };

export class MouseEnt implements IMouse {
  id: string;
  kind: MouseKind;
  x: number;
  y: number;
  r = 12;
  dir = 0;
  state: MouseState = 'patrol';
  stun = 0;
  glue = 0;
  captured = false;
  dead = false;
  /** Souris perchee : elle vit sur une structure surelevee. */
  perched = false;
  /** Opacite courante (souris Ombre / cachee). */
  alpha = 1;
  visible = true;
  anim = Math.random() * 10;
  move = 0;
  alerted = 0;

  private prof: Profile;
  private home: Vec2;
  private target: Vec2;
  private hideAt: Vec2 | null;
  private timer = 0;
  private zig = 0;
  private cooldown = 0;
  private lastSeen = 0;
  private squeakTimer = Math.random() * 6;
  private hiddenIn = false;
  /** Revelation temporaire par le radar. */
  revealed = 0;

  constructor(spawn: MouseSpawn) {
    this.id = spawn.id;
    this.kind = spawn.kind;
    this.x = spawn.x;
    this.y = spawn.y;
    this.prof = PROFILES[spawn.kind];
    this.home = { x: spawn.x, y: spawn.y };
    this.target = { x: spawn.x, y: spawn.y };
    this.hideAt = spawn.hideAt ?? null;
    this.perched = !!spawn.perched;
    this.r = 12 * this.prof.scale;
    this.dir = Math.random() * TAU;
  }

  get color(): string {
    return BANDANA_COLORS[this.kind];
  }

  /** Une souris est capturable au filet si elle est au sol et pas trop rapide. */
  canBeCaught(w: IWorld): boolean {
    if (this.captured || this.dead) return false;
    // Une souris perchee n'est atteignable que si Hyro est lui aussi en
    // hauteur : sur la structure, en plein saut, ou en vol plane.
    if (this.perched && !w.player.elevated) return false;
    if (this.stun > 0 || this.glue > 0) return true;
    if (this.prof.shadow && !w.radarActive && this.revealed <= 0) return false;
    if (this.hiddenIn && !w.radarActive && this.revealed <= 0) return false;
    if (this.prof.needsStun) return false;
    return true;
  }

  /** Raison affichee au joueur quand la capture echoue. */
  whyNot(w: IWorld): string {
    if (this.perched && !w.player.elevated) return 'En hauteur — saute !';
    if (this.prof.shadow && !w.radarActive && this.revealed <= 0) return 'Radar requis';
    if (this.prof.needsStun && this.kind === 'green') return 'Trop rapide !';
    if (this.prof.needsStun) return 'Assomme-la !';
    return 'Trop loin';
  }

  alert(from: Vec2) {
    if (this.captured || this.stun > 0) return;
    if (this.state === 'patrol' || this.state === 'lured' || this.state === 'hide') {
      this.state = this.prof.aggressive ? 'attack' : 'alert';
      this.alerted = 1.2;
      this.timer = 0.25;
      this.dir = Math.atan2(from.y - this.y, from.x - this.x);
    }
  }

  applyStun(seconds: number) {
    if (this.captured) return;
    this.stun = Math.max(this.stun, seconds);
    this.state = 'stunned';
    this.hiddenIn = false;
  }

  applyGlue(seconds: number) {
    if (this.captured) return;
    this.glue = Math.max(this.glue, seconds);
  }

  capture() {
    this.captured = true;
    this.state = 'captured';
    this.dead = true;
  }

  update(dt: number, w: IWorld) {
    if (this.captured) return;
    this.anim += dt;
    this.alerted = Math.max(0, this.alerted - dt);
    this.revealed = Math.max(0, this.revealed - dt);
    this.cooldown -= dt;
    this.squeakTimer -= dt;

    // Visibilite : les Ombres sont quasi transparentes hors radar
    let targetAlpha = 1;
    if (this.prof.shadow) targetAlpha = w.radarActive || this.revealed > 0 ? 0.95 : 0.13;
    if (this.hiddenIn) targetAlpha = w.radarActive || this.revealed > 0 ? 0.6 : 0.12;
    this.alpha = damp(this.alpha, targetAlpha, 8, dt);
    this.visible = this.alpha > 0.4;

    if (this.stun > 0) {
      this.stun -= dt;
      this.move = damp(this.move, 0, 10, dt);
      if (this.stun <= 0) this.state = 'flee';
      return;
    }
    if (this.glue > 0) {
      this.glue -= dt;
      this.move = damp(this.move, 0, 10, dt);
      return;
    }

    const p = w.player;
    const d = dist(this.x, this.y, p.x, p.y);
    const sees = d < this.prof.detect
      && (inCone(this.x, this.y, this.dir, this.prof.cone, this.prof.detect, p.x, p.y) || d < 90)
      && w.nav.lineOfSight(this.x, this.y, p.x, p.y);
    // Le bruit (course, patins) attire l'attention
    const heard = d < 150 + p.noisy * 190;

    if (sees || heard) {
      this.lastSeen = 1.6;
      if (this.state === 'patrol' || this.state === 'lured' || this.state === 'hide') {
        this.state = this.prof.aggressive ? 'attack' : 'alert';
        this.alerted = 1.4;
        this.timer = this.prof.aggressive ? 0.25 : 0.35;
        this.hiddenIn = false;
        w.sfx('alert');
        w.alertNearby(this.x, this.y, 300);
      }
    } else {
      this.lastSeen -= dt;
    }

    switch (this.state) {
      case 'patrol': this.doPatrol(dt, w); break;
      case 'lured': this.doLured(dt, w); break;
      case 'alert': this.doAlert(dt, w, p); break;
      case 'flee': this.doFlee(dt, w, p, d); break;
      case 'attack': this.doAttack(dt, w, p, d); break;
      case 'hide': this.doHide(dt, w, d); break;
      case 'sabotage': this.doSabotage(dt, w, p, d); break;
      default: break;
    }

    // Le leurre a fromage detourne meme une souris en patrouille
    if (!this.perched && w.lurePoint && (this.state === 'patrol' || this.state === 'alert')) {
      const dl = dist(this.x, this.y, w.lurePoint.x, w.lurePoint.y);
      if (dl < 520) {
        this.state = 'lured';
        this.target = { ...w.lurePoint };
      }
    }

    if (this.squeakTimer <= 0 && this.state !== 'patrol' && Math.random() < 0.35) {
      this.squeakTimer = 2.5 + Math.random() * 4;
      w.sfx('squeak', this.kind.length % 4);
    }
  }

  private moveTowards(dt: number, w: IWorld, tx: number, ty: number, speed: number, away = false) {
    const caps = this.perched ? PERCHED_CAPS : CAPS;
    const s = w.nav.steer(this.x, this.y, this.r, tx, ty, caps, away);
    const vx = s.x * speed;
    const vy = s.y * speed;
    if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
      this.dir = Math.atan2(vy, vx);
      this.move = clamp01(speed / this.prof.fleeSpeed);
    } else {
      this.move = damp(this.move, 0, 8, dt);
    }
    if (this.perched) {
      // Elle ne quitte jamais sa plateforme : tout pas qui l'en ferait
      // descendre est annule.
      const bx = this.x;
      const by = this.y;
      w.nav.moveAndSlide(this, vx * dt, vy * dt, caps);
      if (w.nav.terrainAt(this.x, this.y) !== TERR.LEDGE) {
        this.x = bx;
        this.y = by;
        this.move = 0;
      }
      return;
    }
    w.nav.moveAndSlide(this, vx * dt, vy * dt, caps);
  }

  private doPatrol(dt: number, w: IWorld) {
    this.timer -= dt;
    if (this.timer <= 0 || dist(this.x, this.y, this.target.x, this.target.y) < 22) {
      this.timer = 1.4 + Math.random() * 2.6;
      this.target = w.nav.randomWalkableNear(this.home.x, this.home.y, 230, CAPS);
    }
    this.moveTowards(dt, w, this.target.x, this.target.y, this.prof.speed);
  }

  private doLured(dt: number, w: IWorld) {
    if (!w.lurePoint) {
      this.state = 'patrol';
      this.timer = 0;
      return;
    }
    this.moveTowards(dt, w, w.lurePoint.x, w.lurePoint.y, this.prof.speed * 1.35);
    if (dist(this.x, this.y, w.lurePoint.x, w.lurePoint.y) < 40) this.move = 0;
  }

  private doAlert(dt: number, w: IWorld, p: { x: number; y: number }) {
    this.timer -= dt;
    this.move = damp(this.move, 0, 6, dt);
    this.dir = damp(this.dir, Math.atan2(p.y - this.y, p.x - this.x), 8, dt);
    if (this.timer <= 0) {
      this.state = this.prof.tinker ? 'sabotage' : 'flee';
      this.timer = 4;
    }
  }

  private doFlee(dt: number, w: IWorld, p: { x: number; y: number }, d: number) {
    this.timer -= dt;
    this.zig += dt * (5 + this.prof.zigzag * 7);
    let tx = p.x;
    let ty = p.y;
    if (this.prof.zigzag > 0) {
      const perp = this.zig;
      tx += Math.cos(perp) * 130 * this.prof.zigzag;
      ty += Math.sin(perp) * 130 * this.prof.zigzag;
    }
    this.moveTowards(dt, w, tx, ty, this.prof.fleeSpeed, true);
    if (this.lastSeen <= 0 && this.timer <= 0) {
      const spot = this.perched ? null : this.nearestHideSpot(w);
      if (spot) this.hideAt = spot;
      if (this.hideAt && Math.random() < this.prof.hides) {
        this.state = 'hide';
        this.timer = 3 + Math.random() * 4;
      } else {
        this.state = 'patrol';
        this.home = { x: this.x, y: this.y };
        this.timer = 0;
      }
    }
    if (d > this.prof.detect * 1.9 && this.timer <= 0) {
      this.state = 'patrol';
      this.home = { x: this.x, y: this.y };
    }
  }

  private doAttack(dt: number, w: IWorld, p: { x: number; y: number; r: number }, d: number) {
    this.timer -= dt;
    if (d > this.prof.detect * 1.5 && this.lastSeen <= 0) {
      this.state = 'patrol';
      return;
    }
    this.moveTowards(dt, w, p.x, p.y, this.prof.speed * 1.85);
    if (d < this.r + p.r + 6 && this.cooldown <= 0) {
      this.cooldown = 1.4;
      w.damagePlayer(1, this.x, this.y);
    }
  }

  /** Cachette utilisable la plus proche (sinon la souris continue de fuir). */
  private nearestHideSpot(w: IWorld): Vec2 | null {
    const spots = (w as unknown as { level?: { hideSpots?: Vec2[] } }).level?.hideSpots;
    if (!spots || !spots.length) return null;
    let best: Vec2 | null = null;
    let bd = 420 * 420;
    for (const s of spots) {
      const dx = s.x - this.x;
      const dy = s.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) {
        bd = d2;
        best = s;
      }
    }
    return best;
  }

  private doHide(dt: number, w: IWorld, d: number) {
    this.timer -= dt;
    if (!this.hideAt) {
      this.state = 'patrol';
      return;
    }
    const dh = dist(this.x, this.y, this.hideAt.x, this.hideAt.y);
    if (dh > 26) {
      this.moveTowards(dt, w, this.hideAt.x, this.hideAt.y, this.prof.fleeSpeed * 0.8);
      this.hiddenIn = false;
    } else {
      this.move = damp(this.move, 0, 10, dt);
      this.hiddenIn = true;
      if (this.timer <= 0 || d < 70) {
        this.hiddenIn = false;
        this.state = 'patrol';
        this.home = { x: this.x, y: this.y };
      }
    }
  }

  /** Souris Ingenieuse : garde ses distances et jette des objets. */
  private doSabotage(dt: number, w: IWorld, p: { x: number; y: number }, d: number) {
    this.timer -= dt;
    if (d < 220) {
      this.moveTowards(dt, w, p.x, p.y, this.prof.fleeSpeed, true);
    } else if (d > 380) {
      this.moveTowards(dt, w, p.x, p.y, this.prof.speed);
    } else {
      this.move = damp(this.move, 0, 6, dt);
      this.dir = Math.atan2(p.y - this.y, p.x - this.x);
    }
    if (this.cooldown <= 0 && d < 420 && w.nav.lineOfSight(this.x, this.y, p.x, p.y)) {
      this.cooldown = 2.2 + Math.random();
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      w.spawnProjectile(this.x, this.y - 14, Math.cos(a) * 250, Math.sin(a) * 250, 'mouse', 1);
      w.sfx('squeak', 2);
    }
    if (this.timer <= 0) {
      this.state = 'flee';
      this.timer = 3;
    }
  }

  /** Debusquer : un coup d'epee sur la cachette la fait sortir. */
  flush(w: IWorld) {
    if (this.hiddenIn) {
      this.hiddenIn = false;
      this.state = 'flee';
      this.timer = 2.5;
      this.revealed = 3;
      w.fx.burstHit(this.x, this.y - 10, this.color);
    }
  }

  view(): MouseView {
    return {
      x: this.x, y: this.y, dir: this.dir, move: this.move, anim: this.anim,
      kind: this.kind, stunned: this.stun > 0, alerted: this.alerted > 0,
      alpha: this.alpha, scale: PROFILES[this.kind].scale, glued: this.glue > 0,
      perched: this.perched,
    };
  }

  draw(ctx: Ctx) {
    drawMouse(ctx, this.view());
  }
}
