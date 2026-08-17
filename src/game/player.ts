/**
 * Hyro : deplacement, filet, epee, degats et les 8 gadgets.
 * Toutes les constantes de feeling sont regroupees en haut du fichier.
 */

import { TAU, clamp, clamp01, damp, dist, wrapAngle, type Vec2 } from '../core/math';
import { CELL, TERR, type GadgetId } from '../levels/types';
import { drawHyro, type HyroView } from '../render/characters';
import { dashedCircle, rgba, type Ctx } from '../render/draw';
import type { MoveCaps } from './physics';
import type { IWorld } from './types';

// --- Reglages de feeling -----------------------------------------------------
/**
 * Vitesse de course d'Hyro. Exportee : les souris courent exactement aussi
 * vite que lui, donc une seule constante doit gouverner les deux — sinon
 * l'equilibre derive des qu'on retouche le joueur.
 */
export const PLAYER_SPEED = 268;
const SPEED = PLAYER_SPEED;
const SPEED_SKATE = 452;
const ACCEL = 14;
const ACCEL_SKATE = 6.5;
/** Longueur d'un « chat » : c'est l'unite de portee du filet. */
const CAT_LENGTH = 78;
const NET_RANGE = CAT_LENGTH;
const NET_RADIUS = 58;
const NET_COOLDOWN = 0.5;
/**
 * Bond du chat. Lancer le filet projette Hyro vers sa visee : le geste sert a
 * la fois a combler la distance et a capturer. Sans lui, une souris qui court
 * exactement aussi vite que le joueur ne se rattrape jamais — la poursuite
 * n'avait aucune conclusion.
 */
const POUNCE_DIST = 86;
const POUNCE_HEIGHT = 16;
// --- Saut ---------------------------------------------------------------
const JUMP_TIME = 0.46;
const JUMP_DIST = 118;
const JUMP_HEIGHT = 44;
const JUMP_COOLDOWN = 0.12;
const NET_STRIKE_AT = 0.42;
const SWORD_COOLDOWN = 0.36;
const SWORD_RANGE = 104;
const SWORD_ARC = 0.72;
const SWORD_STUN = 3.0;
const INVULN_TIME = 1.25;
const KNOCK_TIME = 0.3;
const DASH_TIME = 0.2;
const DASH_SPEED = 720;
// --- Ruee de base -------------------------------------------------------
// Disponible des le premier niveau, sans gadget : c'est l'outil d'esquive
// face aux mines, bombes et missiles des souris armees. Plus courte que le
// Dash-griffes et surtout **incapable de franchir un gouffre** — le gadget
// garde donc tout son role de cle de progression.
const DODGE_TIME = 0.17;
const DODGE_SPEED = 700;
const DODGE_COOLDOWN = 1;
const DODGE_IFRAMES = 0.14;
const GRAPPLE_RANGE = 440;
const MAX_HP = 5;

export interface PlayerCmd {
  moveX: number;
  moveY: number;
  /** Point vise en coordonnees monde. */
  aimX: number;
  aimY: number;
  net: boolean;
  sword: boolean;
  jump: boolean;
  dash: boolean;
  gadget: boolean;
  gadgetHeld: boolean;
  cycle: number;
  slot: number | null;
}

export class Player {
  x: number;
  y: number;
  r = 15;
  dir = -Math.PI / 2;
  hp = MAX_HP;
  maxHp = MAX_HP;
  invuln = 0;
  blinkPhase = 0;
  anim = 0;
  move = 0;
  noisy = 0;
  dead = false;

  state: HyroView['state'] = 'idle';
  action = 0;

  /** Gadgets debloques et selection courante. */
  gadgets: GadgetId[] = [];
  selected = 0;
  cooldowns: Partial<Record<GadgetId, number>> = {};

  /**
   * Vie illimitee : le coup garde tout son retour (recul, flash, son, secousse)
   * pour rester lisible comme une erreur, mais ne retire aucun coeur. Le suivi
   * des degats continue en coulisse, pour la medaille « sans dommage ».
   */
  infiniteHp = false;

  radarOn = false;
  skating = false;
  gliding = false;
  dashing = false;
  /** Hyro se tient sur une structure surelevee. */
  onLedge = false;
  /** Hauteur visuelle courante (saut). */
  z = 0;
  jumping = false;

  private vx = 0;
  private vy = 0;
  private netTimer = 0;
  private netFired = false;
  private pounceVx = 0;
  private pounceVy = 0;
  netPoint: Vec2 = { x: 0, y: 0 };
  netFlash = 0;
  private swordTimer = 0;
  private swordFired = false;
  private dashTimer = 0;
  private dashDir: Vec2 = { x: 1, y: 0 };
  /** La ruee en cours vient-elle du gadget (franchit les gouffres) ? */
  private dashPower = false;
  private dashDur = DASH_TIME;
  /** Recharge de la ruee de base, lue par le HUD. */
  dodgeCd = 0;
  private knock = 0;
  private kx = 0;
  private ky = 0;
  private lastSafe: Vec2;
  private safeTimer = 0;
  private hazardTimer = 0;
  private stepTimer = 0;
  private pulling = 0;
  private pullTo: Vec2 = { x: 0, y: 0 };
  private radarTimer = 0;
  private winTimer = 0;
  private jumpTimer = 0;
  private jumpCd = 0;
  private jumpVx = 0;
  private jumpVy = 0;
  /** Trainee de dash / patins. */
  trail: { x: number; y: number; life: number }[] = [];

  constructor(x: number, y: number, gadgets: GadgetId[]) {
    this.x = x;
    this.y = y;
    this.gadgets = gadgets.slice();
    this.lastSafe = { x, y };
  }

  get caps(): MoveCaps {
    return {
      // En l'air, on survole gouffres et rebords : c'est ce qui permet de
      // sauter d'une structure a l'autre. La ruee de base, elle, reste au sol.
      gap: (this.dashing && this.dashPower) || this.gliding || this.jumping,
      water: false,
      ledge: this.onLedge || this.jumping,
    };
  }

  /** Hyro est-il en hauteur (perche ou en plein saut) ? */
  get elevated(): boolean {
    return this.onLedge || this.jumping || this.gliding;
  }

  get airborne(): boolean {
    return this.jumping || this.gliding;
  }

  get current(): GadgetId | null {
    return this.gadgets[this.selected] ?? null;
  }

  cooldownOf(id: GadgetId): number {
    return this.cooldowns[id] ?? 0;
  }

  addGadget(id: GadgetId) {
    if (!this.gadgets.includes(id)) this.gadgets.push(id);
  }

  // -------------------------------------------------------------------------

  update(dt: number, w: IWorld, cmd: PlayerCmd) {
    this.anim += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.blinkPhase = this.invuln > 0 ? (this.blinkPhase + dt * 18) % 2 : 0;
    this.netFlash = Math.max(0, this.netFlash - dt * 3);
    for (const k of Object.keys(this.cooldowns) as GadgetId[]) {
      this.cooldowns[k] = Math.max(0, (this.cooldowns[k] ?? 0) - dt);
    }

    // --- Selection de gadget ------------------------------------------------
    if (this.gadgets.length) {
      if (cmd.cycle) {
        this.selected = (this.selected + cmd.cycle + this.gadgets.length * 2) % this.gadgets.length;
        w.sfx('ui');
      }
      if (cmd.slot !== null && cmd.slot >= 1 && cmd.slot <= this.gadgets.length) {
        this.selected = cmd.slot - 1;
        w.sfx('ui');
      }
    }

    // --- Etats speciaux -----------------------------------------------------
    if (this.pulling > 0) {
      this.pulling -= dt;
      this.x = damp(this.x, this.pullTo.x, 16, dt);
      this.y = damp(this.y, this.pullTo.y, 16, dt);
      this.move = 1;
      if (this.pulling <= 0) {
        this.x = this.pullTo.x;
        this.y = this.pullTo.y;
        this.onLedge = w.nav.terrainAt(this.x, this.y) === TERR.LEDGE;
        w.fx.dust(this.x, this.y, '#ffffff', 6);
      }
      this.updateTrail(dt);
      return;
    }

    if (this.knock > 0) {
      this.knock -= dt;
      w.nav.moveAndSlide(this, this.kx * dt, this.ky * dt, this.caps);
      this.kx *= 0.88;
      this.ky *= 0.88;
      this.state = 'hurt';
      this.updateTrail(dt);
      return;
    }

    // --- Gadgets ------------------------------------------------------------
    this.gliding = false;
    const g = this.current;
    if (g === 'glider' && cmd.gadgetHeld && this.cooldownOf('glider') <= 0) {
      this.gliding = true;
    }
    if (cmd.gadget && g) this.useGadget(g, w, cmd);

    // --- Saut ---------------------------------------------------------------
    this.jumpCd = Math.max(0, this.jumpCd - dt);
    if (this.jumpTimer > 0) {
      this.jumpTimer -= dt;
      const k = clamp01(1 - this.jumpTimer / JUMP_TIME);
      this.z = Math.sin(k * Math.PI) * JUMP_HEIGHT;
      this.jumping = this.jumpTimer > 0;
      w.nav.moveAndSlide(this, this.jumpVx * dt, this.jumpVy * dt, this.caps);
      this.move = 1;
      if (!this.jumping) this.land(w);
      // On peut viser et lancer le filet en plein saut (plongeon sur la proie)
      this.updateNet(dt, w, cmd);
      this.updateTrail(dt);
      this.state = 'run';
      return;
    }
    this.jumping = false;
    this.z = damp(this.z, 0, 18, dt);

    if (cmd.jump && this.jumpCd <= 0 && this.dashTimer <= 0) {
      this.jumpTimer = JUMP_TIME;
      this.jumping = true;
      const l = Math.hypot(cmd.moveX, cmd.moveY);
      const dx = l > 0.1 ? cmd.moveX / l : Math.cos(this.dir);
      const dy = l > 0.1 ? cmd.moveY / l : Math.sin(this.dir);
      // Saut sur place si aucune direction n'est donnee
      const dist0 = l > 0.1 ? JUMP_DIST : 0;
      this.jumpVx = (dx * dist0) / JUMP_TIME;
      this.jumpVy = (dy * dist0) / JUMP_TIME;
      if (l > 0.1) this.dir = Math.atan2(dy, dx);
      w.sfx('dash');
      w.fx.dust(this.x, this.y + 4, 'rgba(255,255,255,0.65)', 5);
    }

    // --- Ruee ---------------------------------------------------------------
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.dashing = this.dashTimer > 0;
      const base = this.dashPower ? DASH_SPEED : DODGE_SPEED;
      const sp = base * (0.4 + clamp01(this.dashTimer / this.dashDur) * 0.9);
      w.nav.moveAndSlide(this, this.dashDir.x * sp * dt, this.dashDir.y * sp * dt, this.caps);
      this.move = 1;
      this.state = 'dash';
      this.trail.push({ x: this.x, y: this.y, life: 0.3 });
      this.updateTrail(dt);
      if (!this.dashing) this.checkFall(w);
      return;
    }
    this.dashing = false;

    // Ruee de base : esquive au sol, toujours disponible
    if (cmd.dash && this.dodgeCd <= 0 && this.netTimer <= 0) {
      this.startDash(w, cmd, false);
      this.dodgeCd = DODGE_COOLDOWN;
      this.invuln = Math.max(this.invuln, DODGE_IFRAMES);
      this.updateTrail(dt);
      return;
    }

    // --- Deplacement --------------------------------------------------------
    const speed = (this.skating ? SPEED_SKATE : SPEED) * (this.gliding ? 0.86 : 1);
    const accel = this.skating ? ACCEL_SKATE : ACCEL;
    const tx = cmd.moveX * speed;
    const ty = cmd.moveY * speed;
    this.vx = damp(this.vx, tx, accel, dt);
    this.vy = damp(this.vy, ty, accel, dt);
    const sp = Math.hypot(this.vx, this.vy);
    this.move = clamp01(sp / SPEED);
    if (sp > 12) {
      // On oriente Hyro vers la visee si elle est active, sinon vers la marche
      const aimAng = Math.atan2(cmd.aimY - this.y, cmd.aimX - this.x);
      const moveAng = Math.atan2(this.vy, this.vx);
      const target = this.state === 'net' || this.state === 'sword' ? aimAng : moveAng;
      this.dir = this.dir + wrapAngle(target - this.dir) * Math.min(1, dt * 16);
    } else if (this.state === 'net' || this.state === 'sword') {
      const aimAng = Math.atan2(cmd.aimY - this.y, cmd.aimX - this.x);
      this.dir = this.dir + wrapAngle(aimAng - this.dir) * Math.min(1, dt * 20);
    }

    const terrain = w.nav.terrainAt(this.x, this.y);
    let drift = 1;
    if (terrain === TERR.SLICK) drift = 0.55; // on glisse : moins de controle
    w.nav.moveAndSlide(this, this.vx * dt * drift, this.vy * dt * drift, this.caps);
    if (terrain === TERR.SLICK) {
      // Inertie residuelle sur sol glissant
      w.nav.moveAndSlide(this, this.vx * dt * 0.45, this.vy * dt * 0.45, this.caps);
    }

    // Sortie de plateforme : Hyro redescend au sol (petite retombee)
    if (this.onLedge && w.nav.terrainAt(this.x, this.y) !== TERR.LEDGE) {
      this.onLedge = false;
      this.z = 22;
      w.fx.dust(this.x, this.y + 4, 'rgba(255,255,255,0.5)', 4);
      w.sfx('step', 0);
    }

    // --- Sol dangereux ------------------------------------------------------
    if (terrain === TERR.HAZARD && !this.skating && !this.gliding) {
      this.hazardTimer -= dt;
      if (this.hazardTimer <= 0) {
        this.hazardTimer = 0.75;
        this.hurt(1, this.x, this.y + 30, w);
        w.fx.burstHit(this.x, this.y, '#ff9b3a');
      }
    } else {
      this.hazardTimer = 0.25;
    }

    // Memorisation d'une position sure (pour les chutes)
    this.safeTimer -= dt;
    if (this.safeTimer <= 0) {
      this.safeTimer = 0.25;
      const t = w.nav.terrainAt(this.x, this.y);
      if (t === TERR.GROUND || t === TERR.PATH || t === TERR.GRASS) {
        this.lastSafe = { x: this.x, y: this.y };
      }
    }
    this.checkFall(w);

    // --- Bruit de pas -------------------------------------------------------
    this.noisy = this.skating ? 1 : this.move * 0.35;
    if (this.move > 0.35) {
      this.stepTimer -= dt * (this.skating ? 2.2 : 1);
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.32;
        w.sfx('step', terrain === TERR.WATER ? 2 : terrain === TERR.PATH ? 1 : 0);
        w.fx.dust(this.x, this.y + 4, 'rgba(255,255,255,0.5)', 2);
      }
    }
    if (this.skating && this.move > 0.4) this.trail.push({ x: this.x, y: this.y, life: 0.22 });

    // --- Attaques -----------------------------------------------------------
    this.updateNet(dt, w, cmd);
    this.updateSword(dt, w, cmd);

    // --- Radar --------------------------------------------------------------
    if (this.radarOn) {
      this.radarTimer -= dt;
      if (this.radarTimer <= 0) {
        this.radarTimer = 1.6;
        w.sfx('radar');
        w.radarPing = 1;
        for (const m of w.mice) {
          if (dist(m.x, m.y, this.x, this.y) < 900) (m as unknown as { revealed: number }).revealed = 2.2;
        }
      }
    }

    // --- Etat d'animation ---------------------------------------------------
    if (this.winTimer > 0) {
      this.winTimer -= dt;
      this.state = 'win';
    } else if (this.netTimer > 0) this.state = 'net';
    else if (this.swordTimer > 0) this.state = 'sword';
    else if (this.gliding) this.state = 'glide';
    else if (this.move > 0.12) this.state = 'run';
    else this.state = 'idle';

    this.updateTrail(dt);
  }

  /**
   * Lance une ruee. `power` distingue le Dash-griffes (long, franchit les
   * gouffres) de l'esquive de base. La direction suit le stick, sinon le
   * regard : on esquive dans la direction ou l'on va, pas ou l'on vise.
   */
  private startDash(w: IWorld, cmd: PlayerCmd, power: boolean) {
    this.dashDur = power ? DASH_TIME : DODGE_TIME;
    this.dashTimer = this.dashDur;
    this.dashPower = power;
    this.dashing = true;
    this.dashDir = { x: Math.cos(this.dir), y: Math.sin(this.dir) };
    const l = Math.hypot(cmd.moveX, cmd.moveY);
    if (l > 0.1) {
      this.dashDir = { x: cmd.moveX / l, y: cmd.moveY / l };
      this.dir = Math.atan2(this.dashDir.y, this.dashDir.x);
    }
    this.state = 'dash';
    w.sfx('dash');
    w.fx.dust(this.x, this.y, power ? '#ffd166' : 'rgba(255,255,255,0.8)', power ? 8 : 5);
  }

  private updateTrail(dt: number) {
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }
    if (this.trail.length > 40) this.trail.splice(0, this.trail.length - 40);
  }

  /** Reception du saut : on determine si Hyro atterrit sur une structure. */
  private land(w: IWorld) {
    this.jumpCd = JUMP_COOLDOWN;
    const wasUp = this.onLedge;
    let t = w.nav.terrainAt(this.x, this.y);

    // Aide a l'escalade : si le saut depasse de peu une plateforme, on
    // rattrape le rebord au lieu de retomber betement derriere. Uniquement
    // en montant — descendre d'une plateforme reste libre.
    if (t !== TERR.LEDGE && !wasUp) {
      const l = Math.hypot(this.jumpVx, this.jumpVy);
      if (l > 1) {
        const ux = this.jumpVx / l;
        const uy = this.jumpVy / l;
        for (const back of [16, 30, 44, 58]) {
          const px = this.x - ux * back;
          const py = this.y - uy * back;
          if (w.nav.terrainAt(px, py) === TERR.LEDGE
            && !w.nav.blocked(px, py, this.r, { ledge: true })) {
            this.x = px;
            this.y = py;
            t = TERR.LEDGE;
            break;
          }
        }
      }
    }
    this.jumpVx = 0;
    this.jumpVy = 0;
    this.onLedge = t === TERR.LEDGE;
    w.fx.dust(this.x, this.y + 4, 'rgba(255,255,255,0.55)', 6);
    if (this.onLedge && !wasUp) {
      w.sfx('step', 1);
      w.shake(2);
    }
    this.checkFall(w);
  }

  /** Chute dans un gouffre / le vide : perte d'un coeur et retour au bord. */
  private checkFall(w: IWorld) {
    if (this.dashing || this.gliding || this.jumping) return;
    const t = w.nav.terrainAt(this.x, this.y);
    if (t === TERR.GAP || t === TERR.VOID) {
      this.hurt(1, this.x, this.y, w, true);
      this.x = this.lastSafe.x;
      this.y = this.lastSafe.y;
      this.vx = 0;
      this.vy = 0;
      this.knock = 0;
      w.fx.dust(this.x, this.y, '#ffffff', 10);
      w.shake(6);
    }
  }

  // --- Filet ----------------------------------------------------------------

  private updateNet(dt: number, w: IWorld, cmd: PlayerCmd) {
    if (this.netTimer > 0) {
      this.netTimer -= dt;
      this.action = 1 - clamp01(this.netTimer / NET_COOLDOWN);
      // Le bond se joue pendant l'armement, juste avant que le filet ne tombe
      if (!this.netFired && (this.pounceVx || this.pounceVy)) {
        const k = clamp01(this.action / NET_STRIKE_AT);
        const ease = 1 - (1 - k) * (1 - k);
        this.z = Math.sin(ease * Math.PI) * POUNCE_HEIGHT;
        w.nav.moveAndSlide(this, this.pounceVx * dt, this.pounceVy * dt, this.caps);
        this.move = 1;
      }
      if (!this.netFired && this.action >= NET_STRIKE_AT) {
        this.netFired = true;
        this.pounceVx = 0;
        this.pounceVy = 0;
        w.fx.dust(this.x, this.y + 4, 'rgba(255,255,255,0.55)', 4);
        this.strikeNet(w);
      }
      return;
    }
    if (cmd.net && !this.gliding) {
      const aimAng = Math.atan2(cmd.aimY - this.y, cmd.aimX - this.x);
      const aimD = dist(this.x, this.y, cmd.aimX, cmd.aimY);
      // Le bond couvre exactement l'exces de distance : viser tout pres ne
      // declenche aucun saut, viser loin declenche le bond complet.
      const leap = clamp(aimD - NET_RANGE, 0, POUNCE_DIST);
      const travel = NET_COOLDOWN * NET_STRIKE_AT;
      this.pounceVx = (Math.cos(aimAng) * leap) / travel;
      this.pounceVy = (Math.sin(aimAng) * leap) / travel;
      const d = Math.min(NET_RANGE + leap, aimD);
      this.netPoint = { x: this.x + Math.cos(aimAng) * d, y: this.y + Math.sin(aimAng) * d };
      this.dir = aimAng;
      this.netTimer = NET_COOLDOWN;
      this.netFired = false;
      this.action = 0;
      w.sfx('net');
      // Le lancer est telegraphie : les souris entrainees ont le temps de
      // faire un pas de cote avant que le filet ne se referme.
      for (const m of w.mice) {
        if (m.captured) continue;
        m.onNetIncoming(this.netPoint.x, this.netPoint.y, NET_RADIUS, w);
      }
    }
  }

  private strikeNet(w: IWorld) {
    const px = this.netPoint.x;
    const py = this.netPoint.y;
    this.netFlash = 1;
    w.fx.spawn('ring', px, py, 0, 0, 0.3, NET_RADIUS * 0.5, '#ffffff');
    let caught = 0;
    let refused: string | null = null;
    for (const m of w.mice) {
      if (m.captured) continue;
      if (dist(m.x, m.y, px, py) > NET_RADIUS + m.r) continue;
      const mm = m as unknown as { canBeCaught: (w: IWorld) => boolean; whyNot: (w: IWorld) => string };
      if (mm.canBeCaught(w)) {
        m.capture();
        w.onMouseCaptured(m);
        caught++;
      } else {
        refused = mm.whyNot(w);
      }
    }
    if (caught === 0) {
      if (refused) w.fx.floatingText(px, py - 20, refused, '#ff9b9b');
      w.fx.dust(px, py, 'rgba(255,255,255,0.6)', 4);
    } else {
      this.winTimer = 0.5;
      w.shake(4);
    }
  }

  // --- Epee -----------------------------------------------------------------

  private updateSword(dt: number, w: IWorld, cmd: PlayerCmd) {
    if (this.swordTimer > 0) {
      this.swordTimer -= dt;
      this.action = 1 - clamp01(this.swordTimer / SWORD_COOLDOWN);
      if (!this.swordFired && this.action >= 0.35) {
        this.swordFired = true;
        this.strikeSword(w);
      }
      return;
    }
    if (cmd.sword && !this.gliding && this.netTimer <= 0) {
      this.dir = Math.atan2(cmd.aimY - this.y, cmd.aimX - this.x);
      this.swordTimer = SWORD_COOLDOWN;
      this.swordFired = false;
      w.sfx('sword');
    }
  }

  private strikeSword(w: IWorld) {
    const hitAngle = this.dir;
    let hit = false;
    for (const m of w.mice) {
      if (m.captured) continue;
      const d = dist(m.x, m.y, this.x, this.y);
      if (d > SWORD_RANGE + m.r) continue;
      if (Math.abs(wrapAngle(Math.atan2(m.y - this.y, m.x - this.x) - hitAngle)) > SWORD_ARC) continue;
      m.applyStun(SWORD_STUN);
      (m as unknown as { flush: (w: IWorld) => void }).flush(w);
      w.fx.burstHit(m.x, m.y - 10, '#ffe066');
      w.sfx('stun');
      hit = true;
    }
    for (const mob of w.mobs) {
      if (mob.dead) continue;
      const d = dist(mob.x, mob.y, this.x, this.y);
      if (d > SWORD_RANGE + mob.r) continue;
      if (Math.abs(wrapAngle(Math.atan2(mob.y - this.y, mob.x - this.x) - hitAngle)) > SWORD_ARC) continue;
      mob.hit(1, this.x, this.y);
      w.fx.burstHit(mob.x, mob.y - 12, '#ff9b5e');
      w.sfx('hitmob');
      hit = true;
    }
    // Desamorcage : un coup d'epee nettoie mines, bombes et missiles devant soi
    const hx = this.x + Math.cos(hitAngle) * SWORD_RANGE * 0.55;
    const hy = this.y + Math.sin(hitAngle) * SWORD_RANGE * 0.55;
    if (w.clearHazards(hx, hy, SWORD_RANGE * 0.6)) {
      hit = true;
      w.fx.floatingText(hx, hy - 20, 'Désamorcé !', '#ffd166');
    }

    // Debusquage des cachettes
    const bx = this.x + Math.cos(hitAngle) * SWORD_RANGE * 0.6;
    const by = this.y + Math.sin(hitAngle) * SWORD_RANGE * 0.6;
    w.fx.spawn('poof', bx, by, 0, 0, 0.22, 26, 'rgba(255,255,255,0.45)');
    if (hit) w.shake(3);
  }

  // --- Gadgets --------------------------------------------------------------

  private useGadget(id: GadgetId, w: IWorld, cmd: PlayerCmd) {
    if (this.cooldownOf(id) > 0) return;
    const aimAng = Math.atan2(cmd.aimY - this.y, cmd.aimX - this.x);
    switch (id) {
      case 'radar': {
        this.radarOn = !this.radarOn;
        this.cooldowns.radar = 0.4;
        w.sfx('radar');
        w.fx.floatingText(this.x, this.y - 60, this.radarOn ? 'Radar ON' : 'Radar OFF', '#5ce1e6');
        break;
      }
      case 'dash': {
        this.startDash(w, cmd, true);
        this.invuln = Math.max(this.invuln, DASH_TIME + 0.12);
        this.cooldowns.dash = 0.95;
        break;
      }
      case 'grapple': {
        this.cooldowns.grapple = 1.1;
        w.sfx('grapple');
        // 1) Une souris sur la ligne de visee ?
        let best: { m: (typeof w.mice)[number]; d: number } | null = null;
        for (const m of w.mice) {
          if (m.captured) continue;
          const d = dist(m.x, m.y, this.x, this.y);
          if (d > GRAPPLE_RANGE) continue;
          const a = Math.atan2(m.y - this.y, m.x - this.x);
          if (Math.abs(wrapAngle(a - aimAng)) > 0.4) continue;
          if (!best || d < best.d) best = { m, d };
        }
        if (best) {
          const a = Math.atan2(best.m.y - this.y, best.m.x - this.x);
          best.m.x = this.x + Math.cos(a) * 46;
          best.m.y = this.y + Math.sin(a) * 46;
          best.m.applyStun(0.9);
          w.fx.burstHit(best.m.x, best.m.y - 10, '#b3e34a');
          w.grappleLine(this.x, this.y - 20, best.m.x, best.m.y - 10);
          break;
        }
        // 2) Sinon, on se hisse vers le point vise praticable le plus loin
        let landed: Vec2 | null = null;
        for (let d = GRAPPLE_RANGE; d > 40; d -= 12) {
          const px = this.x + Math.cos(aimAng) * d;
          const py = this.y + Math.sin(aimAng) * d;
          const t = w.nav.terrainAt(px, py);
          const ok = t === TERR.GROUND || t === TERR.PATH || t === TERR.GRASS || t === TERR.LEDGE || t === TERR.SLICK;
          if (ok && !w.nav.blocked(px, py, this.r, { ledge: true, gap: true, water: true })) {
            landed = { x: px, y: py };
            break;
          }
        }
        if (landed) {
          this.pullTo = landed;
          this.pulling = 0.24;
          this.onLedge = w.nav.terrainAt(landed.x, landed.y) === TERR.LEDGE;
          w.grappleLine(this.x, this.y - 20, landed.x, landed.y);
        } else {
          w.fx.floatingText(this.x, this.y - 60, 'Rien à accrocher', '#b3e34a');
        }
        break;
      }
      case 'glue': {
        this.cooldowns.glue = 1.6;
        const d = Math.min(300, dist(this.x, this.y, cmd.aimX, cmd.aimY));
        w.spawnGlue(this.x + Math.cos(aimAng) * d, this.y + Math.sin(aimAng) * d);
        w.sfx('glue');
        break;
      }
      case 'lure': {
        this.cooldowns.lure = 3.5;
        const d = Math.min(240, dist(this.x, this.y, cmd.aimX, cmd.aimY));
        w.setLure(this.x + Math.cos(aimAng) * d, this.y + Math.sin(aimAng) * d);
        w.sfx('lure');
        break;
      }
      case 'skates': {
        this.skating = !this.skating;
        this.cooldowns.skates = 0.4;
        w.sfx('skates');
        w.fx.floatingText(this.x, this.y - 60, this.skating ? 'Patins ON' : 'Patins OFF', '#ff7ab8');
        break;
      }
      case 'boomerang': {
        this.cooldowns.boomerang = 1.5;
        w.spawnBoomerang(this.x, this.y - 18, aimAng);
        w.sfx('boomerang');
        break;
      }
      case 'glider': {
        this.cooldowns.glider = 0.2;
        w.sfx('glide');
        break;
      }
      default:
        break;
    }
  }

  // --- Degats ---------------------------------------------------------------

  /** Renvoie `true` si le coup a porte (utile pour compter les degats). */
  hurt(amount: number, fromX: number, fromY: number, w: IWorld, ignoreInvuln = false): boolean {
    if (this.dead) return false;
    if (!ignoreInvuln && (this.invuln > 0 || this.dashing)) return false;
    if (!this.infiniteHp) this.hp -= amount;
    this.invuln = INVULN_TIME;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.knock = KNOCK_TIME;
    this.kx = Math.cos(a) * 420;
    this.ky = Math.sin(a) * 420;
    this.netTimer = 0;
    this.swordTimer = 0;
    w.sfx('hurt');
    w.shake(10);
    w.fx.burstHit(this.x, this.y - 20, '#ff5a6a');
    if (this.hp <= 0 && !this.infiniteHp) {
      this.hp = 0;
      this.dead = true;
    }
    return true;
  }

  heal(n: number) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  celebrate() {
    this.winTimer = 1.1;
  }

  // --- Rendu ----------------------------------------------------------------

  view(): HyroView {
    return {
      x: this.x, y: this.y, dir: this.dir, move: this.move, anim: this.anim,
      state: this.state, action: this.action,
      blink: this.invuln > 0 && this.blinkPhase > 1 ? 1 : 0,
      scale: 1, z: this.z + (this.onLedge ? 10 : 0),
    };
  }

  draw(ctx: Ctx) {
    // Trainee de vitesse
    for (const t of this.trail) {
      ctx.globalAlpha = t.life * 1.6;
      ctx.beginPath();
      ctx.ellipse(t.x, t.y - 20, 16, 22, 0, 0, TAU);
      ctx.fillStyle = this.skating ? 'rgba(255,150,210,0.35)' : 'rgba(255,210,120,0.3)';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawHyro(ctx, this.view());
  }

  /**
   * Reticule de visee du filet.
   * Le cercle colle EXACTEMENT au curseur (aucun magnetisme, aucun lissage).
   * Hors de portee il passe au rouge, et un cercle fantome montre ou le coup
   * partira reellement — la portee du filet est d'un chat.
   */
  drawReticle(ctx: Ctx, aimX: number, aimY: number, t: number) {
    const aimAng = Math.atan2(aimY - this.y, aimX - this.x);
    const raw = dist(this.x, this.y, aimX, aimY);
    const d = Math.min(NET_RANGE, raw);
    const cx = this.x + Math.cos(aimAng) * d;
    const cy = this.y + Math.sin(aimAng) * d;
    const inRange = raw <= NET_RANGE + 1;
    const ready = this.netTimer <= 0;
    const col = !inRange ? '#ff8a7a' : ready ? '#ffffff' : '#8a8a9a';
    ctx.save();

    // Anneau de portee autour d'Hyro : la limite est toujours lisible
    ctx.beginPath();
    ctx.arc(this.x, this.y, NET_RANGE, 0, TAU);
    ctx.strokeStyle = rgba(ready ? '#ffffff' : '#8a8a9a', 0.12);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Point d'impact effectif si le curseur est trop loin
    if (!inRange) {
      dashedCircle(ctx, cx, cy, NET_RADIUS, 8, -t * 30, 'rgba(255,255,255,0.28)', 2);
    }

    // Reticule : exactement sous le curseur
    ctx.globalAlpha = 0.9;
    dashedCircle(ctx, aimX, aimY, NET_RADIUS, 10, t * 40, rgba(col, ready ? 0.8 : 0.35), 2.5);
    ctx.beginPath();
    ctx.moveTo(aimX - 8, aimY);
    ctx.lineTo(aimX + 8, aimY);
    ctx.moveTo(aimX, aimY - 8);
    ctx.lineTo(aimX, aimY + 8);
    ctx.strokeStyle = rgba(col, 0.95);
    ctx.lineWidth = 2;
    ctx.stroke();

    if (this.netFlash > 0) {
      ctx.globalAlpha = this.netFlash * 0.6;
      ctx.beginPath();
      ctx.arc(this.netPoint.x, this.netPoint.y, NET_RADIUS * (1.2 - this.netFlash * 0.3), 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export { NET_RANGE, NET_RADIUS, MAX_HP };
