/**
 * Contrat commun entre le monde de jeu et les entites.
 * Permet a chaque entite de reagir sans dependre de l'implementation du monde.
 */

import type { Nav } from './physics';
import type { Particles } from './particles';
import type { GadgetId, MouseKind } from '../levels/types';
import type { Vec2 } from '../core/math';

export interface IEntity {
  x: number;
  y: number;
  r: number;
  dead: boolean;
  update(dt: number, w: IWorld): void;
}

export interface IWorld {
  nav: Nav;
  fx: Particles;
  time: number;
  player: IPlayer;
  mice: IMouse[];
  mobs: IMob[];
  radarActive: boolean;
  radarPing: number;
  hasGadget(id: GadgetId): boolean;
  shake(power: number): void;
  sfx(name: string, variant?: number): void;
  /** Declenche un cri d'alerte : les souris proches fuient aussi. */
  alertNearby(x: number, y: number, radius: number): void;
  damagePlayer(amount: number, fromX: number, fromY: number): void;
  spawnProjectile(x: number, y: number, vx: number, vy: number, owner: 'mob' | 'mouse', damage: number): void;
  /** Point d'attraction actif (leurre a fromage). */
  lurePoint: Vec2 | null;
  /** Zones de glue posees par le joueur. */
  gluePools: { x: number; y: number; r: number; life: number }[];
  onMouseCaptured(m: IMouse): void;
  slowmo(duration: number): void;
  /** Effets declenches par les gadgets. */
  grappleLine(x0: number, y0: number, x1: number, y1: number): void;
  spawnGlue(x: number, y: number): void;
  setLure(x: number, y: number): void;
  spawnBoomerang(x: number, y: number, angle: number): void;
}

export interface IPlayer {
  x: number;
  y: number;
  r: number;
  dir: number;
  invuln: number;
  dashing: boolean;
  gliding: boolean;
  skating: boolean;
  hp: number;
  noisy: number;
}

export interface IMouse {
  id: string;
  kind: MouseKind;
  x: number;
  y: number;
  r: number;
  state: string;
  stun: number;
  glue: number;
  captured: boolean;
  visible: boolean;
  alert(from: Vec2): void;
  capture(): void;
  applyStun(seconds: number): void;
}

export interface IMob {
  x: number;
  y: number;
  r: number;
  hp: number;
  dead: boolean;
  kind: string;
  hit(damage: number, fromX: number, fromY: number): void;
}
