/**
 * Le monde de jeu : assemble le niveau genere, les entites, les verrous de
 * gadget, la camera et le rendu. C'est le chef d'orchestre d'une partie.
 */

import { TAU, clamp, clamp01, damp, dist, pointInRect, type Vec2 } from '../core/math';
import { CELL, TERR, LOCK_GADGET, LOCK_LABEL, isWalkable, type GadgetId, type MouseKind } from '../levels/types';
import type { LevelDef } from '../levels/types';
import { generateLevel, type Barrier, type GeneratedLevel, type Prop } from '../levels/generator';
import { WorldRenderer, type Camera } from '../render/world';
import { drawProp, type PropDrawCtx } from '../render/props';
import { paletteFor } from '../render/palette';
import { dashedCircle, glow, outlinedText, poly, rgba, roundRect, shade, star, type Ctx } from '../render/draw';
import { audio } from '../audio/audio';
import { Nav } from './physics';
import { Particles } from './particles';
import { Player, type PlayerCmd } from './player';
import { MouseEnt } from './mice';
import { MobEnt, Projectile } from './mobs';
import { Nerat, type BossWorld } from './boss';
import { gadgetDef } from './gadgets';
import { Hazard } from './hazards';
import { drawMouseIcon } from '../render/characters';
import type { IMouse, IWorld } from './types';

interface GluePool {
  x: number;
  y: number;
  r: number;
  life: number;
}

interface Fondue {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
}

class Boomerang {
  x: number;
  y: number;
  dead = false;
  private t = 0;
  private ox: number;
  private oy: number;
  private angle: number;
  private hitOnce = new Set<unknown>();

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    this.ox = x;
    this.oy = y;
    this.angle = angle;
  }

  update(dt: number, w: World) {
    this.t += dt;
    const dur = 1.5;
    const k = this.t / dur;
    if (k >= 1) {
      this.dead = true;
      return;
    }
    // Trajectoire en arc de cercle qui revient
    const reach = 420 * Math.sin(k * Math.PI);
    const side = Math.sin(k * TAU) * 150;
    const cx = Math.cos(this.angle);
    const cy = Math.sin(this.angle);
    this.x = this.ox + cx * reach - cy * side;
    this.y = this.oy + cy * reach + cx * side;

    for (const m of w.mice) {
      if (m.captured || this.hitOnce.has(m)) continue;
      if (dist(m.x, m.y, this.x, this.y) < 32 + m.r) {
        this.hitOnce.add(m);
        m.applyStun(3);
        w.fx.burstHit(m.x, m.y - 10, '#9ad0ff');
        w.sfx('stun');
      }
    }
    for (const mob of w.mobs) {
      if (mob.dead || this.hitOnce.has(mob)) continue;
      if (dist(mob.x, mob.y, this.x, this.y) < 32 + mob.r) {
        this.hitOnce.add(mob);
        mob.hit(1, this.x, this.y);
        w.fx.burstHit(mob.x, mob.y - 10, '#9ad0ff');
        w.sfx('hitmob');
      }
    }
    if (w.boss && !this.hitOnce.has(w.boss) && dist(w.boss.x, w.boss.y, this.x, this.y) < 60) {
      this.hitOnce.add(w.boss);
      w.boss.applyStun(2);
    }
    // Interrupteurs a distance
    for (const b of w.level.barriers) {
      if (b.lock !== 'switch' || b.open || !b.switchPos) continue;
      if (dist(b.switchPos.x, b.switchPos.y, this.x, this.y) < 48) w.openBarrier(b, 'Interrupteur activé !');
    }
    w.fx.spawn('spark', this.x, this.y, 0, 0, 0.18, 4, '#9ad0ff');
  }

  draw(ctx: Ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.t * 22);
    ctx.strokeStyle = '#9ad0ff';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, 12);
    ctx.quadraticCurveTo(2, -16, 16, 3);
    ctx.stroke();
    ctx.restore();
    glow(ctx, this.x, this.y, 40, '#9ad0ff', 0.35);
  }
}

/**
 * Cinematique de capture : le temps s'arrete, la camera plonge sur la souris
 * et l'ecran explose. Volontairement courte (0,9 s) pour ne pas hacher le
 * rythme, et interruptible par n'importe quel bouton d'action.
 */
export interface CaptureCine {
  x: number;
  y: number;
  color: string;
  kind: MouseKind;
  t: number;
  dur: number;
  /** Derniere souris du quota : version longue, puis victoire. */
  final: boolean;
  index: number;
}

export type WorldEvent =
  | { type: 'win'; caught: number; total: number; time: number; damage: number; white: boolean }
  | { type: 'lose' }
  | { type: 'tutorial'; id: string };

export class World implements IWorld, BossWorld {
  def: LevelDef;
  level: GeneratedLevel;
  nav: Nav;
  fx = new Particles();
  renderer: WorldRenderer;
  player: Player;
  mice: MouseEnt[] = [];
  mobs: MobEnt[] = [];
  projectiles: Projectile[] = [];
  boomerangs: Boomerang[] = [];
  gluePools: GluePool[] = [];
  fondues: Fondue[] = [];
  /** Mines, bombes et missiles poses par les souris armees. */
  hazards: Hazard[] = [];
  /** Trous de souris : raccourcis interdits a Hyro. */
  holes: { x: number; y: number; link: number; blocked: boolean }[] = [];
  boss: Nerat | null = null;
  lurePoint: Vec2 | null = null;
  lureLife = 0;

  time = 0;
  elapsed = 0;
  radarActive = false;
  radarPing = 0;
  camera: Camera = { x: 0, y: 0, w: 1280, h: 720, sw: 1280, sh: 720, zoom: 1 };
  shakePower = 0;
  timeScale = 1;
  private slowmoTimer = 0;

  caught: string[] = [];
  quota: number;
  totalMice: number;
  damageTaken = 0;
  finished = false;
  failed = false;
  /** Cinematique de capture (zoom facon Ape Escape). */
  cine: CaptureCine | null = null;
  /** Message contextuel affiche en bas de l'ecran. */
  toast = '';
  toastTimer = 0;
  events: WorldEvent[] = [];
  grappleFx: { x0: number; y0: number; x1: number; y1: number; life: number } | null = null;
  arenaCenter: Vec2;
  ledgePoints: Vec2[] = [];
  bossIntroDone = false;

  private sortBuffer: { y: number; kind: number; ref: unknown }[] = [];
  private gadgets: GadgetId[];
  private screenShakeScale = 1;

  constructor(def: LevelDef, gadgets: GadgetId[], alreadyCaught: string[] = [], shakeScale = 1) {
    this.def = def;
    this.gadgets = gadgets;
    this.level = generateLevel(def);
    this.nav = new Nav(this.level);
    this.renderer = new WorldRenderer(this.level);
    this.renderer.onThunder = () => this.sfx('thunder');
    this.player = new Player(this.level.spawn.x, this.level.spawn.y, gadgets);
    this.screenShakeScale = shakeScale;
    this.arenaCenter = { x: this.level.w / 2, y: this.level.h / 2 };

    this.holes = this.level.holes;
    for (const s of this.level.mice) this.mice.push(new MouseEnt(s));
    for (const s of this.level.mobs) {
      this.mobs.push(new MobEnt(s.kind, s.x, s.y, s.guardBarrier === -2, s.guardBarrier));
    }
    this.totalMice = this.mice.length;
    this.quota = Math.min(def.quota, this.totalMice);

    // Points de passerelle pour le boss
    for (let cy = 0; cy < this.level.rows; cy++) {
      for (let cx = 0; cx < this.level.cols; cx++) {
        if (this.level.grid[cy * this.level.cols + cx] !== TERR.LEDGE) continue;
        const p = { x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL };
        if (!this.ledgePoints.some((q) => dist(q.x, q.y, p.x, p.y) < 200)) this.ledgePoints.push(p);
      }
    }

    if (def.boss) {
      this.boss = new Nerat(this.arenaCenter.x, this.arenaCenter.y - 220);
      this.quota = 1;
      this.totalMice = 1;
    }
    void alreadyCaught;
    this.camera.x = this.player.x - this.camera.w / 2;
    this.camera.y = this.player.y - this.camera.h / 2;
  }

  dispose() {
    this.renderer.dispose();
    this.fx.clear();
  }

  // --- Interface IWorld -----------------------------------------------------

  hasGadget(id: GadgetId): boolean {
    return this.gadgets.includes(id);
  }

  shake(power: number) {
    this.shakePower = Math.min(26, this.shakePower + power * this.screenShakeScale);
  }

  sfx(name: string, variant = 0) {
    audio.sfx(name, variant);
  }

  slowmo(duration: number) {
    this.slowmoTimer = Math.max(this.slowmoTimer, duration);
  }

  alertNearby(x: number, y: number, radius: number) {
    for (const m of this.mice) {
      if (m.captured) continue;
      if (dist(m.x, m.y, x, y) < radius) m.alert({ x, y });
    }
  }

  damagePlayer(amount: number, fromX: number, fromY: number) {
    const before = this.player.hp;
    this.player.hurt(amount, fromX, fromY, this);
    if (this.player.hp < before) this.damageTaken += before - this.player.hp;
  }

  spawnProjectile(x: number, y: number, vx: number, vy: number, owner: 'mob' | 'mouse', damage: number) {
    this.projectiles.push(new Projectile(x, y, vx, vy, owner, damage));
  }

  grappleLine(x0: number, y0: number, x1: number, y1: number) {
    this.grappleFx = { x0, y0, x1, y1, life: 0.3 };
  }

  spawnGlue(x: number, y: number) {
    this.gluePools.push({ x, y, r: 72, life: 6 });
    this.fx.splash(x, y, '#8cf0a0');
    // Dissout une barriere englues
    for (const b of this.level.barriers) {
      if (b.lock !== 'slick' || b.open) continue;
      if (dist(x, y, b.x + b.w / 2, b.y + b.h / 2) < 130) this.openBarrier(b, 'Glue dissoute !');
    }
  }

  setLure(x: number, y: number) {
    this.lurePoint = { x, y };
    this.lureLife = 7;
    this.fx.burstHit(x, y, '#ffd23f');
  }

  spawnBoomerang(x: number, y: number, angle: number) {
    this.boomerangs.push(new Boomerang(x, y, angle));
  }

  // --- Armement des souris --------------------------------------------------
  // Plafond volontaire : au-dela le niveau devient illisible, et une arene
  // saturee de mines punit la patience au lieu de recompenser la lecture.
  // Plafonds par type en plus : trois missiles simultanes restent esquivables,
  // six deviennent un barrage que rien ne permet d'eviter.
  private readonly maxHazards = 26;
  private readonly maxOf = { mine: 18, bomb: 4, missile: 3 };

  private countOf(kind: 'mine' | 'bomb' | 'missile'): number {
    let n = 0;
    for (const h of this.hazards) if (!h.dead && h.kind === kind) n++;
    return n;
  }

  private canSpawn(kind: 'mine' | 'bomb' | 'missile'): boolean {
    return this.hazards.length < this.maxHazards && this.countOf(kind) < this.maxOf[kind];
  }

  spawnMine(x: number, y: number) {
    if (!this.canSpawn('mine')) return;
    this.hazards.push(new Hazard('mine', x, y));
    this.fx.dust(x, y, 'rgba(180,180,200,0.8)', 3);
  }

  throwBomb(x: number, y: number, tx: number, ty: number) {
    if (!this.canSpawn('bomb')) return;
    const h = new Hazard('bomb', x, y);
    h.throwTo(tx, ty);
    this.hazards.push(h);
    this.sfx('boomerang');
  }

  fireMissile(x: number, y: number, angle: number) {
    if (!this.canSpawn('missile')) return;
    const h = new Hazard('missile', x, y);
    h.launch(angle);
    this.hazards.push(h);
    this.sfx('dash');
    this.fx.burstHit(x, y, '#ff9b3a');
  }

  /**
   * Jeton de charge : une seule souris peut foncer a la fois, avec un temps
   * mort entre deux. C'est ce qui separe « elles ripostent » de « elles te
   * lynchent » — la difficulte doit venir de la lecture, pas du nombre.
   */
  private lungeGate = 0;

  claimLunge(): boolean {
    // Jamais pendant les i-frames : on ne s'acharne pas sur un chat au sol.
    if (this.player.invuln > 0) return false;
    if (this.time < this.lungeGate) return false;
    this.lungeGate = this.time + 0.95;
    return true;
  }

  /** L'epee et le boomerang desamorcent les pieges. Renvoie le nombre detruit. */
  clearHazards(x: number, y: number, radius: number): number {
    let n = 0;
    for (const h of this.hazards) {
      if (h.dead) continue;
      if (dist(h.x, h.y, x, y) > radius + h.r) continue;
      h.destroy(this);
      n++;
    }
    return n;
  }

  summonMouse(kind: MouseKind, x: number, y: number) {
    const m = new MouseEnt({ id: `sum-${this.mice.length}`, kind, x, y, locked: false });
    this.mice.push(m);
  }

  summonMob(kind: 'elite' | 'guard', x: number, y: number) {
    this.mobs.push(new MobEnt(kind, x, y));
  }

  addFondue(x: number, y: number, r: number, life: number) {
    this.fondues.push({ x, y, r, life, max: life });
  }

  bossDefeated() {
    this.finish();
  }

  onMouseCaptured(m: IMouse) {
    if (this.caught.includes(m.id)) return;
    this.fx.burstCapture(m.x, m.y, (m as MouseEnt).color);
    this.sfx('capture', this.caught.length % 4);
    // Les souris proches paniquent
    this.alertNearby(m.x, m.y, 260);

    // Pendant le combat de boss, les sbires invoques ne comptent pas dans le
    // quota : seul Nerat termine le niveau.
    if (this.boss && !this.boss.dead) {
      this.showToast('Sbire capturé !', 1.2);
      return;
    }

    this.caught.push(m.id);
    const final = this.caught.length >= this.quota;
    this.cine = {
      x: m.x,
      y: m.y,
      color: (m as MouseEnt).color,
      kind: m.kind,
      t: 0,
      dur: final ? 1.9 : 0.9,
      final,
      index: this.caught.length,
    };
    this.shake(final ? 10 : 5);
    if (final) this.sfx('unlock');
  }

  /** Un bouton d'action pendant la cinematique : on coupe court. */
  private skipCine() {
    const c = this.cine;
    if (!c || c.t < 0.22) return;
    c.t = Math.max(c.t, c.dur - 0.18);
  }

  private updateCine(dt: number) {
    const c = this.cine;
    if (!c) return;
    c.t += dt;
    // Gerbe d'etincelles au moment de l'impact
    if (c.t < 0.3) {
      const a = Math.random() * TAU;
      const sp = 200 + Math.random() * 320;
      this.fx.spawn('spark', c.x, c.y - 10, Math.cos(a) * sp, Math.sin(a) * sp, 0.4, 5, c.color);
    }
    if (c.t >= c.dur) {
      this.cine = null;
      if (c.final) this.finish();
      else this.showToast(`${c.index} / ${this.quota}`, 1.4);
    }
  }

  showToast(text: string, time = 1.8) {
    this.toast = text;
    this.toastTimer = time;
  }

  // --- Verrous --------------------------------------------------------------

  openBarrier(b: Barrier, message: string) {
    if (b.open) return;
    b.open = true;
    for (const c of b.cells) {
      this.level.grid[c] = TERR.PATH;
    }
    this.renderer.invalidateAround(b.x + b.w / 2, b.y + b.h / 2, CELL * 6);
    this.sfx('unlock');
    this.shake(6);
    this.fx.burstHit(b.x + b.w / 2, b.y + b.h / 2, '#ffe066');
    this.showToast(message, 2.6);
  }

  private closeBarrier(b: Barrier) {
    b.open = false;
    for (const c of b.cells) this.level.grid[c] = TERR.WALL;
    this.renderer.invalidateAround(b.x + b.w / 2, b.y + b.h / 2, CELL * 6);
  }

  private updateBarriers(dt: number) {
    const p = this.player;
    for (const b of this.level.barriers) {
      switch (b.lock) {
        case 'hidden': {
          if (!b.open && this.radarActive && dist(p.x, p.y, b.x + b.w / 2, b.y + b.h / 2) < 300) {
            this.openBarrier(b, 'Passage secret révélé !');
          }
          break;
        }
        case 'switch': {
          if (!b.open && b.switchPos) {
            // Interaction manuelle possible si on est juste a cote
            if (dist(p.x, p.y, b.switchPos.x, b.switchPos.y) < 46) {
              this.showToast('Interrupteur hors de portée : utilise le boomerang', 1.2);
            }
          }
          break;
        }
        case 'timed': {
          if (b.timer > 0) {
            b.timer -= dt;
            if (b.timer <= 0) {
              // Si Hyro est passe de l'autre cote, la grille reste ouverte
              if (pointInRect(p.x, p.y, b.room.x, b.room.y, b.room.w, b.room.h)) {
                this.showToast('Tu es passé !', 1.6);
              } else {
                this.closeBarrier(b);
                this.showToast('La grille se referme…', 1.6);
              }
            }
          }
          break;
        }
        case 'guard': {
          if (!b.open && b.guardPos) {
            const guard = this.mobs.find((m) => m.barrierId === b.id);
            if (!guard || guard.dead || dist(guard.x, guard.y, b.guardPos.x, b.guardPos.y) > 150) {
              if (guard) guard.barrierId = undefined;
              this.openBarrier(b, 'Le rat de garde a quitté son poste !');
            }
          }
          break;
        }
        default:
          break;
      }
    }
  }

  /** Interaction contextuelle (touche E). */
  interact() {
    const p = this.player;
    for (const b of this.level.barriers) {
      if (b.lock === 'timed' && !b.open && b.buttonPos && dist(p.x, p.y, b.buttonPos.x, b.buttonPos.y) < 60) {
        b.open = true;
        b.timer = 4;
        for (const c of b.cells) this.level.grid[c] = TERR.PATH;
        this.renderer.invalidateAround(b.x + b.w / 2, b.y + b.h / 2, CELL * 6);
        this.sfx('unlock');
        this.showToast('Grille ouverte 4 s — cours !', 2.4);
        return;
      }
    }
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.player.celebrate();
    this.sfx('win');
    this.events.push({
      type: 'win',
      caught: this.caught.length,
      total: this.totalMice,
      time: this.elapsed,
      damage: this.damageTaken,
      white: this.mice.some((m) => m.kind === 'white' && m.captured),
    });
  }

  // --- Boucle ---------------------------------------------------------------

  update(dt: number, cmd: PlayerCmd, interactPressed: boolean) {
    // --- Cinematique de capture : le monde se fige, seuls la camera, les
    // particules et l'animation de la cinematique continuent.
    if (this.cine) {
      if (interactPressed || cmd.net || cmd.jump || cmd.sword) this.skipCine();
      this.time += dt * 0.25;
      this.shakePower = damp(this.shakePower, 0, 7, dt);
      this.toastTimer -= dt;
      this.updateCine(dt);
      this.fx.update(dt * 0.35);
      this.renderer.update(dt * 0.3, this.camera);
      this.updateCamera(dt);
      return;
    }

    // Ralenti scenaristique (derniere souris du quota, phase de boss)
    if (this.slowmoTimer > 0) {
      this.slowmoTimer -= dt;
      this.timeScale = damp(this.timeScale, 0.28, 12, dt);
    } else {
      this.timeScale = damp(this.timeScale, 1, 6, dt);
    }
    const sdt = dt * this.timeScale;

    this.time += sdt;
    if (!this.finished && !this.failed) this.elapsed += dt;
    this.shakePower = damp(this.shakePower, 0, 7, dt);
    this.toastTimer -= dt;
    this.radarPing = Math.max(0, this.radarPing - sdt);
    this.radarActive = this.player.radarOn && this.hasGadget('radar');

    if (interactPressed) this.interact();

    if (!this.finished && !this.failed) {
      this.player.update(sdt, this, cmd);
      if (this.player.dead) {
        this.failed = true;
        this.sfx('lose');
        this.events.push({ type: 'lose' });
      }
    } else {
      this.player.update(sdt, this, { ...cmd, net: false, sword: false, gadget: false, moveX: 0, moveY: 0 });
    }

    for (const m of this.mice) m.update(sdt, this);
    for (const mob of this.mobs) mob.update(sdt, this);
    this.mobs = this.mobs.filter((m) => {
      if (m.dead) {
        this.fx.burstCapture(m.x, m.y, '#ff9b5e');
        if (m.isMiniBoss) {
          this.showToast('Mini-boss vaincu ! +1 cœur', 3);
          this.player.heal(1);
          this.slowmo(0.5);
        }
        return false;
      }
      return true;
    });

    for (const p of this.projectiles) p.update(sdt, this);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    for (const b of this.boomerangs) b.update(sdt, this);
    this.boomerangs = this.boomerangs.filter((b) => !b.dead);

    // Pieges des souris. Le boomerang balaie tout sur son passage : c'est sa
    // vraie utilite offensive une fois les interrupteurs actionnes.
    for (const h of this.hazards) h.update(sdt, this);
    for (const b of this.boomerangs) this.clearHazards(b.x, b.y, 26);
    this.hazards = this.hazards.filter((h) => !h.dead);

    // Glue
    for (let i = this.gluePools.length - 1; i >= 0; i--) {
      const g = this.gluePools[i];
      g.life -= sdt;
      if (g.life <= 0) {
        this.gluePools.splice(i, 1);
        continue;
      }
      for (const m of this.mice) {
        if (!m.captured && dist(m.x, m.y, g.x, g.y) < g.r) m.applyGlue(1.2);
      }
      if (this.boss && dist(this.boss.x, this.boss.y, g.x, g.y) < g.r + 40) this.boss.applyGlue(1.4);
    }

    // Une flaque de glue bouche un trou : c'est la reponse du joueur aux
    // souris qui prennent leurs raccourcis.
    for (const h of this.holes) {
      h.blocked = this.gluePools.some((g) => dist(h.x, h.y, g.x, g.y) < g.r * 0.9);
    }

    // Leurre
    if (this.lureLife > 0) {
      this.lureLife -= sdt;
      if (this.lureLife <= 0) this.lurePoint = null;
    }

    // Fondue (boss phase 3)
    for (let i = this.fondues.length - 1; i >= 0; i--) {
      const f = this.fondues[i];
      f.life -= sdt;
      if (f.life <= 0) {
        this.fondues.splice(i, 1);
        continue;
      }
      if (f.life < f.max - 0.8 && dist(this.player.x, this.player.y, f.x, f.y) < f.r && !this.player.skating && !this.player.gliding) {
        this.damagePlayer(1, f.x, f.y);
      }
    }

    if (this.grappleFx) {
      this.grappleFx.life -= dt;
      if (this.grappleFx.life <= 0) this.grappleFx = null;
    }

    this.updateBarriers(dt);

    // Boss
    if (this.boss) {
      this.boss.update(sdt, this);
      if (this.boss.capturable && !this.finished) {
        // Capture finale au filet geant
        if (dist(this.player.netPoint.x, this.player.netPoint.y, this.boss.x, this.boss.y) < 120 && this.player.netFlash > 0.5) {
          this.boss.captured = true;
          this.boss.dead = true;
          this.caught.push('nerat');
          this.fx.burstCapture(this.boss.x, this.boss.y - 40, '#ffe066');
          this.slowmo(1.4);
          this.shake(22);
          this.finish();
        }
      }
      // L'epee touche le boss
      if (!this.boss.dead) {
        const p = this.player;
        if (p.state === 'sword' && p.action > 0.35 && p.action < 0.6) {
          if (dist(p.x, p.y, this.boss.x, this.boss.y) < 120) this.boss.hit(1, p.x, p.y, this);
        }
      }
    }

    this.renderer.update(dt, this.camera);
    this.fx.update(sdt);
    this.updateCamera(dt);
  }

  /** Progression 0..1 du plongee de camera pendant la cinematique. */
  private cinePush(): number {
    const c = this.cine;
    if (!c) return 0;
    // Montee seche (0,16 s), palier, puis retour souple.
    const inK = clamp01(c.t / 0.16);
    const outK = clamp01((c.dur - c.t) / 0.3);
    return Math.min(inK * inK * (3 - 2 * inK), outK * outK * (3 - 2 * outK));
  }

  private updateCamera(dt: number) {
    const c = this.camera;
    // Zoom cinematique : la camera plonge sur la souris attrapee.
    const push = this.cinePush();
    const zoom = this.baseZoom * (1 + push * (this.cine?.final ? 1.25 : 0.85));
    c.zoom = zoom;
    c.w = c.sw / zoom;
    c.h = c.sh / zoom;

    const fx = this.cine ? this.cine.x : this.player.x;
    const fy = this.cine ? this.cine.y : this.player.y;
    const targetX = clamp(fx - c.w / 2, 0, Math.max(0, this.level.w - c.w));
    const targetY = clamp(fy - c.h / 2, 0, Math.max(0, this.level.h - c.h));
    const rate = this.cine ? 16 : 7;
    c.x = damp(c.x, targetX, rate, dt);
    c.y = damp(c.y, targetY, rate, dt);
    if (this.level.w < c.w) c.x = (this.level.w - c.w) / 2;
    if (this.level.h < c.h) c.y = (this.level.h - c.h) / 2;
  }

  private baseZoom = 1;

  resize(w: number, h: number) {
    // Zoom : Hyro doit rester bien lisible sans perdre la vision d'ensemble.
    this.baseZoom = clamp(w / 950, 1.05, 1.6);
    this.camera.sw = w;
    this.camera.sh = h;
    this.camera.zoom = this.baseZoom;
    this.camera.w = w / this.baseZoom;
    this.camera.h = h / this.baseZoom;
  }

  // --- Rendu ----------------------------------------------------------------

  /** Profilage par phase de rendu (ms), lu par le mode debug. */
  prof = { bg: 0, ground: 0, sorted: 0, fx: 0, overlay: 0, bake: 0, bakes: 0 };

  draw(ctx: Ctx) {
    const cam = this.camera;
    const T = () => performance.now();
    let t0 = T();
    this.renderer.bakeMs = 0;
    this.renderer.bakeCount = 0;
    const shake = this.shakePower;
    const ox = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;
    const oy = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;

    this.renderer.drawBackground(ctx, cam, this.time);
    this.prof.bg = T() - t0;
    t0 = T();

    ctx.save();
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x + ox, -cam.y + oy);

    this.renderer.drawGround(ctx, cam);
    this.renderer.drawFloorFx(ctx, cam, this.time);
    this.drawGroundOverlays(ctx);
    this.prof.ground = T() - t0;
    t0 = T();

    if (!this.finished && !this.failed && !this.cine) {
      this.player.drawReticle(ctx, this.lastAimX, this.lastAimY, this.time);
    }

    this.drawSorted(ctx);
    this.prof.sorted = T() - t0;
    t0 = T();

    this.fx.draw(ctx);
    this.drawForeground(ctx);
    this.renderer.drawAmbient(ctx, this.time);
    this.prof.fx = T() - t0;
    t0 = T();

    ctx.restore();

    const lights = this.collectLights();
    this.renderer.drawOverlay(ctx, cam, this.time, lights);
    this.prof.overlay = T() - t0;
    this.prof.bake = this.renderer.bakeMs;
    this.prof.bakes = this.renderer.bakeCount;

    // Le radar dessine par-dessus l'ambiance pour rester lisible
    if (this.radarActive) this.drawRadar(ctx);

    if (this.cine) this.drawCine(ctx);
  }

  /**
   * Fanfare de capture : lignes de vitesse, ondes de choc, souris brandie et
   * banniere. Tout est en coordonnees ecran pour rester net quel que soit le
   * zoom de la camera.
   */
  private drawCine(ctx: Ctx) {
    const c = this.cine!;
    const cam = this.camera;
    const k = clamp01(c.t / c.dur);
    const push = this.cinePush();
    // Point d'impact a l'ecran
    const sx = (c.x - cam.x) * cam.zoom;
    const sy = (c.y - cam.y) * cam.zoom;
    const R = Math.hypot(cam.sw, cam.sh);

    ctx.save();

    // 1) Assombrissement en iris centre sur la prise
    const iris = ctx.createRadialGradient(sx, sy, R * 0.06, sx, sy, R * 0.62);
    iris.addColorStop(0, 'rgba(0,0,0,0)');
    iris.addColorStop(1, rgba('#120a1c', 0.72 * push));
    ctx.fillStyle = iris;
    ctx.fillRect(0, 0, cam.sw, cam.sh);

    // 2) Lignes de vitesse convergentes (le trait de la BD)
    const lines = 30;
    ctx.globalAlpha = 0.5 * push;
    for (let i = 0; i < lines; i++) {
      const a = (i / lines) * TAU + c.t * 0.6 + (i % 2) * 0.05;
      const r0 = R * (0.18 + ((i * 7919) % 100) / 700);
      const wdt = 0.012 + ((i * 104729) % 100) / 5200;
      poly(ctx, [
        sx + Math.cos(a) * r0, sy + Math.sin(a) * r0,
        sx + Math.cos(a - wdt) * R, sy + Math.sin(a - wdt) * R,
        sx + Math.cos(a + wdt) * R, sy + Math.sin(a + wdt) * R,
      ]);
      ctx.fillStyle = i % 3 === 0 ? rgba(c.color, 0.5) : 'rgba(255,255,255,0.35)';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 3) Ondes de choc successives
    for (let i = 0; i < 3; i++) {
      const rt = clamp01((c.t - i * 0.09) / 0.5);
      if (rt <= 0 || rt >= 1) continue;
      ctx.globalAlpha = (1 - rt) * 0.75;
      ctx.beginPath();
      ctx.arc(sx, sy, 30 + rt * R * 0.42, 0, TAU);
      ctx.strokeStyle = i === 1 ? c.color : '#fff6e2';
      ctx.lineWidth = 9 * (1 - rt) + 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 4) Flash blanc a l'impact
    if (c.t < 0.14) {
      ctx.fillStyle = `rgba(255,255,255,${(1 - c.t / 0.14) * 0.7})`;
      ctx.fillRect(0, 0, cam.sw, cam.sh);
    }

    // 5) La souris brandie : elle jaillit, tremble, puis retombe.
    // Position bornee dans la moitie basse : la banniere occupe le haut, les
    // deux ne doivent jamais se marcher dessus.
    const pop = c.t < 0.22 ? Math.pow(clamp01(c.t / 0.22), 0.45) * 1.18 : 1 + Math.sin((c.t - 0.22) * 9) * 0.05;
    const iconR = Math.min(cam.sw, cam.sh) * 0.12 * pop * push;
    const ix = clamp(sx, iconR * 1.8, cam.sw - iconR * 1.8);
    const iy = clamp(sy - 60 * push, cam.sh * 0.46, cam.sh * 0.76);
    if (iconR > 2) {
      ctx.save();
      ctx.translate(ix, iy);
      ctx.rotate(Math.sin(c.t * 11) * 0.16);
      // Etoile tournante en fond
      star(ctx, 0, 0, iconR * 2.5, 0.42, 12, c.t * 1.4);
      ctx.fillStyle = rgba(c.color, 0.3);
      ctx.fill();
      glow(ctx, 0, 0, iconR * 3, c.color, 0.5);
      // Filet : quelques mailles par-dessus la prise
      drawMouseIcon(ctx, 0, 0, iconR, c.kind);
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1.5, iconR * 0.05);
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * iconR * 0.42, -iconR * 1.2);
        ctx.lineTo(i * iconR * 0.42 + iconR * 0.5, iconR * 1.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-iconR * 1.3, i * iconR * 0.42);
        ctx.lineTo(iconR * 1.3, i * iconR * 0.42 + iconR * 0.3);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 6) Banniere + compteur
    const bt = clamp01((c.t - 0.1) / 0.18);
    const bs = bt < 1 ? 1.8 - 0.8 * (bt * bt * (3 - 2 * bt)) : 1 + Math.sin(c.t * 7) * 0.02;
    const fade = clamp01((c.dur - c.t) / 0.25);
    ctx.globalAlpha = fade;
    const by = Math.max(96, cam.sh * 0.17);
    // Bandeau sombre : le texte doit rester lisible sur n'importe quel decor
    ctx.save();
    ctx.globalAlpha = fade * 0.62 * push;
    ctx.fillStyle = '#150c22';
    ctx.fillRect(0, by - 46, cam.sw, c.final ? 130 : 96);
    ctx.restore();
    ctx.save();
    ctx.translate(cam.sw / 2, by);
    ctx.scale(bs, bs);
    const label = c.final ? 'OBJECTIF ATTEINT !' : 'ATTRAPÉE !';
    outlinedText(ctx, label, 0, 0, 46, c.final ? '#8cf0a0' : '#ffe066', '#231436', 9);
    ctx.restore();
    outlinedText(ctx, `${c.index} / ${this.quota}`, cam.sw / 2, by + 44, 32, '#fff6e2', '#231436', 7);
    if (c.final) {
      outlinedText(ctx, 'Victoire !', cam.sw / 2, by + 78, 24, '#ffd166', '#231436', 6);
    } else if (k > 0.45) {
      ctx.globalAlpha = fade * 0.7;
      outlinedText(ctx, 'Appuie pour continuer', cam.sw / 2, cam.sh - 46, 18, '#d9cfe8', '#231436', 5);
    }
    ctx.restore();
  }

  lastAimX = 0;
  lastAimY = 0;
  setAim(x: number, y: number) {
    this.lastAimX = x;
    this.lastAimY = y;
  }

  private collectLights() {
    const out: { x: number; y: number; r: number; color: string; intensity: number }[] = [];
    const cam = this.camera;
    const ccx = cam.x + cam.w / 2;
    const ccy = cam.y + cam.h / 2;
    for (const l of this.level.lights) {
      if (l.x < cam.x - l.r || l.x > cam.x + cam.w + l.r || l.y < cam.y - l.r || l.y > cam.y + cam.h + l.r) continue;
      const fl = 1 - l.flicker * 0.5 * (0.5 + 0.5 * Math.sin(this.time * 7 + l.x));
      out.push({ x: l.x, y: l.y, r: l.r, color: l.color, intensity: l.intensity * fl });
    }
    // Les plus proches d'abord : le rendu n'en garde qu'un nombre borne.
    if (out.length > 6) {
      out.sort((a, b) => dist(a.x, a.y, ccx, ccy) - dist(b.x, b.y, ccx, ccy));
    }
    for (const f of this.fondues) {
      out.push({ x: f.x, y: f.y, r: f.r * 2.4, color: '#ff8a2b', intensity: 0.8 });
    }
    if (this.lurePoint) out.push({ x: this.lurePoint.x, y: this.lurePoint.y, r: 130, color: '#ffd23f', intensity: 0.5 });
    return out;
  }

  private drawGroundOverlays(ctx: Ctx) {
    // Flaques de glue
    for (const g of this.gluePools) {
      const k = clamp01(g.life / 6);
      ctx.save();
      ctx.globalAlpha = 0.55 * clamp01(k * 2);
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, g.r, g.r * 0.55, 0, 0, TAU);
      ctx.fillStyle = '#8cf0a0';
      ctx.fill();
      ctx.strokeStyle = '#5bc97a';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(g.x + Math.sin(i * 2 + this.time) * g.r * 0.4, g.y + Math.cos(i * 3) * g.r * 0.25, 10, 6, 0, 0, TAU);
        ctx.fillStyle = '#d8ffe4';
        ctx.fill();
      }
      ctx.restore();
    }
    // Fondue du boss
    for (const f of this.fondues) {
      const warn = f.life > f.max - 0.8;
      ctx.save();
      ctx.globalAlpha = warn ? 0.35 + 0.25 * Math.sin(this.time * 16) : 0.85;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, TAU);
      ctx.fillStyle = warn ? '#ff5a4a' : '#ffab33';
      ctx.fill();
      if (!warn) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r * 0.7, f.r * 0.4, 0, 0, TAU);
        ctx.fillStyle = '#ffe08a';
        ctx.fill();
      }
      ctx.restore();
    }
    // Trous bouches a la glue : le raccourci est condamne
    for (const h of this.holes) {
      if (!h.blocked) continue;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, 16, 10, 0, 0, TAU);
      ctx.fillStyle = '#8cf0a0';
      ctx.fill();
      ctx.strokeStyle = '#3f8f62';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Entites et props tries par profondeur (effet 2.5D). */
  private drawSorted(ctx: Ctx) {
    const cam = this.camera;
    const buf = this.sortBuffer;
    buf.length = 0;
    const m = 140;
    const inView = (x: number, y: number) =>
      x > cam.x - m && x < cam.x + cam.w + m && y > cam.y - m && y < cam.y + cam.h + m;

    for (const p of this.level.props) {
      if (p.layer !== 'sorted' || !inView(p.x, p.y)) continue;
      buf.push({ y: p.y, kind: 0, ref: p });
    }
    for (const mm of this.mice) {
      if (mm.captured || !inView(mm.x, mm.y)) continue;
      buf.push({ y: mm.y, kind: 1, ref: mm });
    }
    for (const mob of this.mobs) {
      if (!inView(mob.x, mob.y)) continue;
      buf.push({ y: mob.y, kind: 2, ref: mob });
    }
    for (const pr of this.projectiles) buf.push({ y: pr.y, kind: 3, ref: pr });
    for (const bm of this.boomerangs) buf.push({ y: bm.y, kind: 4, ref: bm });
    for (const hz of this.hazards) buf.push({ y: hz.y, kind: 7, ref: hz });
    if (this.boss && !this.boss.dead) buf.push({ y: this.boss.y, kind: 5, ref: this.boss });
    buf.push({ y: this.player.y, kind: 6, ref: this.player });

    buf.sort((a, b) => a.y - b.y);
    const pc: PropDrawCtx = { pal: this.renderer.pal, t: this.time, fade: 1 };
    for (const item of buf) {
      switch (item.kind) {
        case 0: drawProp(ctx, item.ref as Prop, pc); break;
        case 1: (item.ref as MouseEnt).draw(ctx); break;
        case 2: (item.ref as MobEnt).draw(ctx); break;
        case 3: (item.ref as Projectile).draw(ctx); break;
        case 4: (item.ref as Boomerang).draw(ctx); break;
        case 5: (item.ref as Nerat).draw(ctx); break;
        case 7: (item.ref as Hazard).draw(ctx, this.time); break;
        default: this.player.draw(ctx); break;
      }
    }

    // Barrieres et elements de verrou (au-dessus du sol)
    this.drawBarriers(ctx);

    // Leurre
    if (this.lurePoint) {
      const l = this.lurePoint;
      const bob = Math.sin(this.time * 4) * 4;
      poly(ctx, [l.x - 18, l.y + bob, l.x + 18, l.y + bob, l.x, l.y - 28 + bob]);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      ctx.strokeStyle = '#2a1e18';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      dashedCircle(ctx, l.x, l.y, 60 + Math.sin(this.time * 3) * 6, 10, this.time * 30, 'rgba(255,210,63,0.5)', 2);
    }

    // Cable de grappin
    if (this.grappleFx) {
      const g = this.grappleFx;
      ctx.save();
      ctx.globalAlpha = clamp01(g.life * 4);
      ctx.strokeStyle = '#b3e34a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(g.x0, g.y0);
      ctx.lineTo(g.x1, g.y1);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawBarriers(ctx: Ctx) {
    for (const b of this.level.barriers) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      if (b.open && b.lock !== 'timed') {
        // Rien a dessiner : le sol a ete converti
      } else if (b.lock === 'hidden') {
        // Mur illusoire : quelques etincelles quand le radar est actif
        if (this.radarActive) {
          for (let i = 0; i < 3; i++) {
            const a = this.time * 2 + i * 2;
            star(ctx, cx + Math.cos(a) * b.w * 0.3, cy + Math.sin(a) * b.h * 0.3, 6, 0.4, 4, a);
            ctx.fillStyle = 'rgba(92,225,230,0.8)';
            ctx.fill();
          }
        }
      } else if (b.lock === 'slick') {
        ctx.save();
        ctx.globalAlpha = 0.85;
        roundRect(ctx, b.x, b.y, b.w, b.h, 8);
        ctx.fillStyle = '#7ad6a0';
        ctx.fill();
        ctx.strokeStyle = '#3f8f62';
        ctx.lineWidth = 3;
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.arc(b.x + ((i * 37) % b.w), b.y + ((i * 53) % b.h), 7, 0, TAU);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fill();
        }
        ctx.restore();
      } else if (b.lock === 'switch' || b.lock === 'timed' || b.lock === 'guard') {
        if (!b.open) {
          // Grille metallique
          ctx.save();
          roundRect(ctx, b.x, b.y, b.w, b.h, 4);
          ctx.fillStyle = '#4a4f5e';
          ctx.fill();
          ctx.strokeStyle = '#20242e';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.strokeStyle = '#7d8698';
          ctx.lineWidth = 4;
          for (let i = 1; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(b.x + (b.w * i) / 5, b.y);
            ctx.lineTo(b.x + (b.w * i) / 5, b.y + b.h);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Interrupteur / bouton
      if (b.lock === 'switch' && b.switchPos) {
        const s = b.switchPos;
        ctx.save();
        roundRect(ctx, s.x - 16, s.y - 34, 32, 34, 5);
        ctx.fillStyle = b.open ? '#4bd07a' : '#8a3a3a';
        ctx.fill();
        ctx.strokeStyle = '#241a1a';
        ctx.lineWidth = 3;
        ctx.stroke();
        glow(ctx, s.x, s.y - 18, 44, b.open ? '#4bd07a' : '#ff5a4a', 0.5);
        ctx.restore();
      }
      if (b.lock === 'timed' && b.buttonPos) {
        const s = b.buttonPos;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 22, 12, 0, 0, TAU);
        ctx.fillStyle = b.timer > 0 ? '#4bd07a' : '#d0a03a';
        ctx.fill();
        ctx.strokeStyle = '#2a2118';
        ctx.lineWidth = 3;
        ctx.stroke();
        if (b.timer > 0) {
          outlinedText(ctx, b.timer.toFixed(1), s.x, s.y - 34, 22, '#ffe066');
        }
        ctx.restore();
      }

      // Etiquette du verrou quand on approche sans le gadget
      const need = LOCK_GADGET[b.lock];
      if (!b.open && !this.hasGadget(need) && dist(this.player.x, this.player.y, cx, cy) < 220) {
        const g = gadgetDef(need);
        outlinedText(ctx, `${LOCK_LABEL[b.lock]} — ${g.name} requis`, cx, cy - 60, 22, '#ffd166', '#2a1e18', 5);
      }
    }
  }

  private drawForeground(ctx: Ctx) {
    const cam = this.camera;
    const pc: PropDrawCtx = { pal: this.renderer.pal, t: this.time, fade: 1 };
    for (const p of this.level.props) {
      if (p.layer !== 'fore') continue;
      if (p.x < cam.x - 160 || p.x > cam.x + cam.w + 160 || p.y < cam.y - 200 || p.y > cam.y + cam.h + 260) continue;
      // Les gros props de premier plan deviennent translucides si Hyro est dessous
      const near = dist(p.x, p.y, this.player.x, this.player.y) < 90;
      pc.fade = near ? 0.45 : 1;
      drawProp(ctx, p, pc);
    }
  }

  /** Radar : ping circulaire + fleches vers les souris hors ecran. */
  private drawRadar(ctx: Ctx) {
    const cam = this.camera;
    const z = cam.zoom;
    const px = (this.player.x - cam.x) * z;
    const py = (this.player.y - cam.y) * z;
    if (this.radarPing > 0) {
      const k = 1 - this.radarPing;
      ctx.save();
      ctx.globalAlpha = this.radarPing * 0.5;
      ctx.strokeStyle = '#5ce1e6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(px, py, k * 900 * z, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    const cxm = cam.sw / 2;
    const cym = cam.sh / 2;
    const margin = 70;
    for (const m of this.mice) {
      if (m.captured) continue;
      const sx = (m.x - cam.x) * z;
      const sy = (m.y - cam.y) * z;
      const onScreen = sx > 0 && sy > 0 && sx < cam.sw && sy < cam.sh;
      if (onScreen) continue;
      const a = Math.atan2(sy - cym, sx - cxm);
      const ax = cxm + Math.cos(a) * (cxm - margin);
      const ay = cym + Math.sin(a) * (cym - margin);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fillStyle = m.color;
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,15,25,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Etat pour le HUD. */
  hudState() {
    return {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      caught: this.caught.length,
      quota: this.quota,
      dodgeCd: this.player.dodgeCd,
      total: this.totalMice,
      gadgets: this.player.gadgets,
      selected: this.player.selected,
      cooldowns: this.player.cooldowns,
      radar: this.radarActive,
      skating: this.player.skating,
      toast: this.toastTimer > 0 ? this.toast : '',
      caughtKinds: this.mice.filter((m) => m.captured).map((m) => m.kind),
      boss: this.boss ? { hp: this.boss.hp, max: this.boss.maxHp, phase: this.boss.phase, capturable: this.boss.capturable } : null,
      elapsed: this.elapsed,
    };
  }
}
