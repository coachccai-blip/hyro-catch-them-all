/**
 * Scene de base + pile de scenes avec fondu.
 */

import type { Ctx } from '../render/draw';
import type { Game } from './game';

export abstract class Scene {
  game!: Game;
  /** Si true, la scene sous-jacente reste dessinee (pause, tutoriel...). */
  overlay = false;
  /** Si true, la scene sous-jacente continue d'etre mise a jour. */
  updatesBelow = false;

  enter(_params?: unknown): void { /* optionnel */ }
  exit(): void { /* optionnel */ }
  resize(_w: number, _h: number): void { /* optionnel */ }
  abstract update(dt: number): void;
  abstract draw(ctx: Ctx): void;
}
