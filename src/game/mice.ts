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
import { PLAYER_SPEED } from './player';

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
  /** Armement propre à ce bandana. */
  weapon: 'none' | 'bomb' | 'mine' | 'mineTrail' | 'missile';
  /** Ruée courte pour rompre la distance (et esquiver le filet). */
  dashes: boolean;
  /** Emprunte les trous de souris, inaccessibles à Hyro. */
  usesHoles: boolean;
  /** Tente d'esquiver un filet lancé dans sa direction. */
  dodges: boolean;
  /**
   * Délai entre deux ripostes en pleine fuite (s). Aucune souris ne se
   * contente de courir : toutes se retournent pour mordre, plus ou moins
   * souvent. C'est le curseur d'agressivité du bandana — large pour les deux
   * du premier monde, qui enseignent la parade, serré ensuite.
   */
  harass: number;
}

/**
 * Toutes les souris courent **exactement aussi vite qu'Hyro**. On ne les
 * distance donc jamais : il faut les acculer, les assommer, couper leur
 * trajectoire ou gagner du terrain à la ruée. La vitesse de patrouille reste
 * plus basse — une souris qui ne t'a pas vu flâne.
 */
const FLEE = PLAYER_SPEED;

export const PROFILES: Record<MouseKind, Profile> = {
  // La Flâneuse reste la plus tendre : sans arme, sans esquive de filet — mais
  // elle mord quand même quand on la serre de trop près.
  blue: { speed: 96,  fleeSpeed: FLEE, detect: 240, cone: 1.25, hides: 0.1,  aggressive: false, needsStun: false, tinker: false, shadow: false, zigzag: 0,    scale: 1,    weapon: 'none',      dashes: false, usesHoles: false, dodges: false, harass: 4.6 },
  // La Trouillarde file dans le premier trou venu, en griffant au passage.
  yellow: { speed: 122, fleeSpeed: FLEE, detect: 320, cone: 1.4,  hides: 0.5,  aggressive: false, needsStun: false, tinker: false, shadow: false, zigzag: 0.25, scale: 1,    weapon: 'none',      dashes: true,  usesHoles: true,  dodges: true,  harass: 3.5 },
  // La Bagarreuse charge et jette des bombes à courte portée.
  red: { speed: 150, fleeSpeed: FLEE, detect: 380, cone: 1.35, hides: 0.05, aggressive: true,  needsStun: true,  tinker: false, shadow: false, zigzag: 0,    scale: 1.1,  weapon: 'bomb',      dashes: true,  usesHoles: false, dodges: true,  harass: 1.5 },
  // La Sprinteuse sème des mines derrière elle en fuyant.
  green: { speed: 168, fleeSpeed: FLEE, detect: 360, cone: 1.5,  hides: 0.35, aggressive: false, needsStun: true,  tinker: false, shadow: false, zigzag: 0.9,  scale: 0.95, weapon: 'mineTrail', dashes: true,  usesHoles: true,  dodges: true,  harass: 2.0 },
  // L'Ingénieuse piège le terrain et tire des missiles téléguidés.
  purple: { speed: 132, fleeSpeed: FLEE, detect: 400, cone: 1.45, hides: 0.3,  aggressive: false, needsStun: false, tinker: true,  shadow: false, zigzag: 0.3,  scale: 1.05, weapon: 'missile',   dashes: true,  usesHoles: false, dodges: true,  harass: 1.8 },
  // L'Ombre pose des mines qu'on ne voit qu'au radar, et disparaît par les trous.
  black: { speed: 146, fleeSpeed: FLEE, detect: 340, cone: 1.55, hides: 0.55, aggressive: false, needsStun: false, tinker: false, shadow: true,  zigzag: 0.45, scale: 1,    weapon: 'mine',      dashes: true,  usesHoles: true,  dodges: true,  harass: 1.7 },
  // La Rare cumule tout : missiles, ruée et réseau de trous.
  white: { speed: 160, fleeSpeed: FLEE, detect: 440, cone: 1.65, hides: 0.6,  aggressive: false, needsStun: false, tinker: false, shadow: false, zigzag: 0.6,  scale: 1.05, weapon: 'missile',   dashes: true,  usesHoles: true,  dodges: true,  harass: 1.4 },
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
  /** Elle s'est engouffree dans un trou : introuvable et intouchable. */
  inHole = false;
  /** Ruee en cours (esquive / rupture de distance). */
  dashing = false;
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
  private dashCd = 0;
  private dashTimer = 0;
  private dashDir: Vec2 = { x: 1, y: 0 };
  /** La ruee en cours est une charge : elle blesse au contact. */
  private dashBites = false;
  /** Delai avant la prochaine riposte. */
  private harassCd = 1 + Math.random() * 2;
  /** Temps d'armement de la charge : la souris se retourne avant de mordre. */
  private lungeWind = 0;
  private weaponCd = 2;
  private holeTimer = 0;
  /** Delai avant de pouvoir replonger : sans lui, une souris se rend inattrapable. */
  private holeCd = 0;
  private holeExit: Vec2 | null = null;
  private holeTarget: Vec2 | null = null;

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
    if (this.escapeGrace > 0) return false;
    // Une souris perchee n'est atteignable que si Hyro est lui aussi en
    // hauteur : sur la structure, en plein saut, ou en vol plane.
    if (this.inHole) return false;
    if (this.perched && !w.player.elevated) return false;
    if (this.stun > 0 || this.glue > 0) return true;
    if (this.prof.shadow && !w.radarActive && this.revealed <= 0) return false;
    if (this.hiddenIn && !w.radarActive && this.revealed <= 0) return false;
    if (this.prof.needsStun) return false;
    return true;
  }

  /** Raison affichee au joueur quand la capture echoue. */
  whyNot(w: IWorld): string {
    if (this.escapeGrace > 0) return 'Elle file !';
    if (this.inHole) return 'Elle est dans un trou !';
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

  /**
   * Elle se fait la belle : un coup encaisse par Hyro libere une prise du
   * panier. Elle repart terrifiee, avec un court sursis pour qu'on ne la
   * recapture pas dans la meme seconde — sinon l'enjeu disparait.
   */
  escape(x: number, y: number, w: IWorld) {
    this.captured = false;
    this.dead = false;
    this.x = x;
    this.y = y;
    this.state = 'flee';
    this.timer = 4;
    this.lastSeen = 2;
    this.home = { x, y };
    this.inHole = false;
    this.hiddenIn = false;
    this.stun = 0;
    this.glue = 0;
    this.alpha = 1;
    this.visible = true;
    this.holeCd = 3;
    this.dashCd = 0;
    this.escapeGrace = 0.9;
    w.fx.burstCapture(x, y - 10, this.color);
    w.sfx('squeak', 0);
  }

  /** Sursis apres une evasion : intouchable au filet le temps de detaler. */
  escapeGrace = 0;

  update(dt: number, w: IWorld) {
    if (this.captured) return;
    this.anim += dt;
    this.alerted = Math.max(0, this.alerted - dt);
    this.revealed = Math.max(0, this.revealed - dt);
    this.cooldown -= dt;
    this.squeakTimer -= dt;
    this.dashCd -= dt;
    this.weaponCd -= dt;
    this.holeCd -= dt;
    this.harassCd -= dt;
    this.escapeGrace = Math.max(0, this.escapeGrace - dt);

    // --- Dans un trou de souris : hors de portee, elle ressort ailleurs -----
    if (this.inHole) {
      this.holeTimer -= dt;
      this.alpha = damp(this.alpha, 0, 14, dt);
      this.visible = false;
      this.move = 0;
      if (this.holeTimer <= 0) {
        const exit = this.holeExit ?? { x: this.x, y: this.y };
        this.x = exit.x;
        this.y = exit.y;
        this.inHole = false;
        this.holeExit = null;
        this.holeTarget = null;
        this.holeCd = 7;
        this.state = 'flee';
        this.timer = 2.5;
        this.lastSeen = 0;
        this.home = { x: this.x, y: this.y };
        w.fx.dust(this.x, this.y, '#d8c8a8', 8);
        w.sfx('squeak', 1);
      }
      return;
    }

    // --- Armement de la charge ---------------------------------------------
    // Court mais bien visible : la souris se plante, se retourne vers Hyro et
    // rougeoie. Le joueur a le temps de reculer ou de lancer le filet.
    if (this.lungeWind > 0) {
      this.lungeWind -= dt;
      this.move = damp(this.move, 0, 12, dt);
      this.alerted = 0.4;
      const pp = w.player;
      this.dir = damp(this.dir, Math.atan2(pp.y - this.y, pp.x - this.x), 18, dt);
      w.fx.spawn('spark', this.x, this.y - 10, 0, -30, 0.2, 3, '#ff6a5a');
      if (this.lungeWind <= 0) {
        // Le cap est fige a l'instant du depart : un pas de cote suffit a
        // faire mordre la poussiere a la souris.
        this.startDash(Math.cos(this.dir), Math.sin(this.dir), w, true);
      }
      return;
    }

    // --- Ruee en cours ------------------------------------------------------
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.dashing = this.dashTimer > 0;
      const sp = this.dashBites ? 700 : 620;
      w.nav.moveAndSlide(this, this.dashDir.x * sp * dt, this.dashDir.y * sp * dt,
        this.perched ? PERCHED_CAPS : CAPS);
      this.move = 1;
      this.dir = Math.atan2(this.dashDir.y, this.dashDir.x);
      w.fx.spawn('dust', this.x, this.y, 0, 0, 0.22, 6,
        this.dashBites ? 'rgba(255,140,120,0.5)' : 'rgba(255,255,255,0.4)');
      // Coup de griffe : la charge blesse au contact, puis s'arrete net.
      if (this.dashBites) {
        const pp = w.player;
        if (dist(this.x, this.y, pp.x, pp.y) < this.r + pp.r + 4) {
          w.damagePlayer(1, this.x, this.y);
          w.fx.burstHit(pp.x, pp.y - 10, '#ff6a5a');
          this.dashTimer = 0;
          this.dashing = false;
          this.dashBites = false;
          // Elle repart aussitot : mordre et filer, jamais s'incruster
          this.state = 'flee';
          this.timer = 1.8;
          this.cooldown = Math.max(this.cooldown, 1.2);
        }
      }
      return;
    }
    this.dashing = false;
    this.dashBites = false;

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
        w.alertNearby(this.x, this.y, 430);
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

  /**
   * Déclenche une ruée dans une direction donnée. `bites` en fait une charge
   * offensive : elle blesse au contact et s'arrête sur l'impact.
   */
  private startDash(ax: number, ay: number, w: IWorld, bites = false) {
    const l = Math.hypot(ax, ay) || 1;
    this.dashDir = { x: ax / l, y: ay / l };
    this.dashTimer = bites ? 0.3 : 0.24;
    this.dashing = true;
    this.dashBites = bites;
    this.dashCd = 1.6 + Math.random() * 0.8;
    w.sfx(bites ? 'squeak' : 'dash', bites ? 2 : 0);
  }

  /**
   * Riposte en pleine fuite : la souris se retourne et charge. C'est ce qui
   * empêche de la poursuivre bêtement en ligne droite — courir derrière elle
   * coûte un cœur si on ne lit pas l'armement.
   */
  private tryHarass(w: IWorld, p: { x: number; y: number }, d: number): boolean {
    if (this.harassCd > 0 || this.dashCd > 0 || this.perched) return false;
    // Portee courte : elle mord celui qui la serre, pas celui qui passe au loin
    if (d > 175 || d < 36) return false;
    if (!w.nav.lineOfSight(this.x, this.y, p.x, p.y)) return false;
    if (!w.claimLunge()) return false;
    this.harassCd = this.prof.harass * (0.8 + Math.random() * 0.5);
    this.lungeWind = 0.32;
    w.fx.floatingText(this.x, this.y - 26, '!', '#ff6a5a');
    w.sfx('alert');
    return true;
  }

  /**
   * Le filet arrive : les souris entraînées tentent une esquive latérale.
   * Appelé pendant l'armement du coup, donc parfaitement lisible : on voit la
   * souris bondir avant que le filet ne retombe.
   */
  onNetIncoming(x: number, y: number, r: number, w: IWorld) {
    if (this.captured || this.inHole || this.stun > 0 || this.glue > 0) return;
    if (!this.prof.dodges || this.dashCd > 0 || this.dashTimer > 0) return;
    if (dist(this.x, this.y, x, y) > r * 1.35) return;
    // On s'écarte perpendiculairement au filet : plus élégant qu'une fuite
    // droit devant, et ça laisse une chance au joueur qui anticipe.
    const a = Math.atan2(this.y - y, this.x - x);
    const side = Math.random() < 0.5 ? 1 : -1;
    const esc = a + side * 0.7;
    this.startDash(Math.cos(esc), Math.sin(esc), w);
    this.state = 'flee';
    this.timer = 2.4;
    this.lastSeen = 1.6;
  }

  /** Trou de souris le plus proche, s'il est utilisable. */
  private findHole(w: IWorld): { x: number; y: number; link: number } | null {
    if (!this.prof.usesHoles || this.perched || this.holeCd > 0) return null;
    let best: { x: number; y: number; link: number } | null = null;
    let bd = 340 * 340;
    for (const h of w.holes) {
      if (h.blocked) continue;
      const dx = h.x - this.x;
      const dy = h.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) {
        bd = d2;
        best = h;
      }
    }
    return best;
  }

  private enterHole(w: IWorld, hole: { x: number; y: number; link: number }) {
    const exit = w.holes[hole.link] ?? hole;
    this.inHole = true;
    this.holeTimer = 2.2 + Math.random() * 2.6;
    this.holeExit = { x: exit.x, y: exit.y };
    this.x = hole.x;
    this.y = hole.y;
    w.fx.dust(this.x, this.y, '#c8b898', 10);
    w.sfx('squeak', 3);
  }

  /** Emploi de l'arme du bandana. */
  private useWeapon(dt: number, w: IWorld, p: { x: number; y: number }, d: number) {
    if (this.weaponCd > 0) return;
    switch (this.prof.weapon) {
      case 'bomb':
        if (d < 360 && d > 50) {
          this.weaponCd = 2.4 + Math.random() * 0.8;
          w.throwBomb(this.x, this.y - 10, p.x, p.y);
        }
        break;
      case 'mine':
        if (d < 460) {
          this.weaponCd = 2.6 + Math.random() * 0.8;
          w.spawnMine(this.x, this.y);
        }
        break;
      case 'mineTrail':
        // Semée en pleine fuite : la Sprinteuse laisse un chapelet derrière elle
        if (this.state === 'flee' && this.move > 0.5) {
          this.weaponCd = 1.1 + Math.random() * 0.6;
          w.spawnMine(this.x, this.y);
        }
        break;
      case 'missile':
        if (d < 560 && w.nav.lineOfSight(this.x, this.y, p.x, p.y)) {
          this.weaponCd = 2.6 + Math.random() * 1;
          w.fireMissile(this.x, this.y - 10, Math.atan2(p.y - this.y, p.x - this.x));
          w.sfx('boomerang');
        }
        break;
      default:
        break;
    }
    void dt;
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
    this.useWeapon(dt, w, p, d);
    // Elle fuit **et** elle mord : la poursuite n'est jamais gratuite.
    if (this.tryHarass(w, p, d)) return;

    // Filer dans un trou : la meilleure sortie de secours du jeu
    const hole = this.holeTarget ? null : this.findHole(w);
    if (hole && this.lastSeen > 0 && Math.random() < 0.02) this.holeTarget = { x: hole.x, y: hole.y };
    if (this.holeTarget) {
      const target = w.holes.find((h) => dist(h.x, h.y, this.holeTarget!.x, this.holeTarget!.y) < 8);
      if (!target || target.blocked) {
        this.holeTarget = null;
      } else {
        this.moveTowards(dt, w, target.x, target.y, this.prof.fleeSpeed);
        if (dist(this.x, this.y, target.x, target.y) < 22) this.enterHole(w, target);
        return;
      }
    }

    // Ruée de rupture quand Hyro colle de trop près
    if (this.prof.dashes && this.dashCd <= 0 && d < 130) {
      this.startDash(this.x - p.x, this.y - p.y, w);
      return;
    }
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
    } else if (this.prof.aggressive && this.timer <= 0 && this.lastSeen > 0) {
      // La Bagarreuse ne fuit jamais longtemps : elle revient au contact.
      this.state = 'attack';
      this.timer = 3;
    }
  }

  private doAttack(dt: number, w: IWorld, p: { x: number; y: number; r: number }, d: number) {
    this.timer -= dt;
    if (d > this.prof.detect * 1.5 && this.lastSeen <= 0) {
      this.state = 'patrol';
      return;
    }
    this.useWeapon(dt, w, p, d);
    if (this.tryHarass(w, p, d)) return;
    // La parite de vitesse vaut pour la **fuite** : c'est ce qui rend la
    // chasse difficile. En poursuite, elle est volontairement un cran en
    // dessous — mesure au navigateur : a vitesse egale et sans rampe
    // d'acceleration, une Bagarreuse colle a 36 px quoi que fasse le joueur,
    // qui perd alors ses cinq coeurs sans aucun recours. A 88 %, courir droit
    // devant rompt toujours le contact, et la ruee le rompt d'un coup.
    this.moveTowards(dt, w, p.x, p.y, Math.min(this.prof.speed * 1.85, PLAYER_SPEED * 0.88));
    if (d < this.r + p.r + 6 && this.cooldown <= 0) {
      this.cooldown = 1.9;
      w.damagePlayer(1, this.x, this.y);
      // Mordre puis decrocher. Sans ce repli, une souris collee au chat le
      // grignote indefiniment : dans un decor encombre, le joueur ne peut pas
      // toujours fuir en ligne droite, et il n'a alors aucune parade.
      this.state = 'flee';
      this.timer = 1.6;
      this.lastSeen = 1.6;
      this.harassCd = Math.max(this.harassCd, 1.2);
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
    this.useWeapon(dt, w, p, d);
    if (this.tryHarass(w, p, d)) return;
    if (this.cooldown <= 0 && d < 420 && w.nav.lineOfSight(this.x, this.y, p.x, p.y)) {
      this.cooldown = 2.6 + Math.random();
      // L'Ingénieuse piège aussi le sol entre deux tirs
      if (Math.random() < 0.5) w.spawnMine(this.x, this.y);
      else {
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        w.spawnProjectile(this.x, this.y - 14, Math.cos(a) * 250, Math.sin(a) * 250, 'mouse', 1);
      }
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
      dashing: this.dashing,
    };
  }

  draw(ctx: Ctx) {
    drawMouse(ctx, this.view());
  }
}
