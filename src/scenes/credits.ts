/**
 * Credits : defilement doux sur fond etoile, plus la liste des gadgets et
 * des souris rencontrees (petit bestiaire).
 */

import { Scene } from '../core/scene';
import { TAU, hash2 } from '../core/math';
import { GADGETS, drawGadgetIcon } from '../game/gadgets';
import { drawMouseIcon } from '../render/characters';
import { BANDANA_COLORS } from '../render/palette';
import { drawIconButton, hitCircle } from '../ui/widgets';
import { outlinedText, panel, type Ctx } from '../render/draw';
import { audio } from '../audio/audio';
import { getLang, t } from '../ui/i18n';

const MOUSE_KINDS = ['yellow', 'blue', 'red', 'green', 'purple', 'black', 'white'];
const MOUSE_NAMES: Record<string, [string, string]> = {
  yellow: ['Trouillarde', 'Scaredy'],
  blue: ['Flâneuse', 'Stroller'],
  red: ['Bagarreuse', 'Brawler'],
  green: ['Sprinteuse', 'Sprinter'],
  purple: ['Ingénieuse', 'Tinkerer'],
  black: ['Ombre', 'Shadow'],
  white: ['Rare', 'Rare'],
};

export class CreditsScene extends Scene {
  overlay = true;
  private y = 0;
  private time = 0;

  enter() {
    this.game.input.clearTouchButtons();
    this.y = 0;
  }

  update(dt: number) {
    this.time += dt;
    this.y += dt * 42;
    const input = this.game.input;
    if (input.isDown('down')) this.y += dt * 200;
    if (input.isDown('up')) this.y = Math.max(0, this.y - dt * 260);
    if (input.pressed('cancel') || input.pressed('pause') || input.pressed('confirm')) {
      audio.sfx('uiback');
      this.game.pop();
      return;
    }
    for (const tap of input.taps) {
      if (hitCircle(tap.x, tap.y, 66, 60, 40)) {
        audio.sfx('uiback');
        this.game.pop();
      }
    }
  }

  draw(ctx: Ctx) {
    const v = this.game.view;
    const en = getLang() === 'en';
    ctx.fillStyle = 'rgba(8,11,24,0.96)';
    ctx.fillRect(0, 0, v.w, v.h);
    for (let i = 0; i < 120; i++) {
      const x = hash2(i, 1, 3) * v.w;
      const yy = (hash2(i, 2, 5) * v.h * 2 - this.y * 0.25) % (v.h + 40);
      ctx.globalAlpha = 0.15 + 0.5 * Math.abs(Math.sin(this.time + i));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, yy < 0 ? yy + v.h + 40 : yy, 2, 2);
    }
    ctx.globalAlpha = 1;

    let y = v.h * 0.9 - this.y;
    outlinedText(ctx, 'HYRO', v.w / 2, y, 92, '#ffe066', '#7a3a12', 14, 'center', '900');
    y += 70;
    outlinedText(ctx, en ? 'CATCH THEM ALL!' : 'ATTRAPEZ-LES TOUS !', v.w / 2, y, 30, '#fff6e2', '#7a3a12', 6);
    y += 90;

    const body = t('creditsBody').split('\n');
    for (const line of body) {
      outlinedText(ctx, line, v.w / 2, y, 22, '#d8e0f5', '#141a2b', 4, 'center', 'normal');
      y += 32;
    }

    y += 40;
    outlinedText(ctx, en ? 'BESTIARY' : 'BESTIAIRE', v.w / 2, y, 32, '#ffd166', '#2a1226', 6);
    y += 56;
    for (const k of MOUSE_KINDS) {
      drawMouseIcon(ctx, v.w / 2 - 150, y, 16, k);
      outlinedText(ctx, en ? MOUSE_NAMES[k][1] : MOUSE_NAMES[k][0], v.w / 2 - 110, y, 22, BANDANA_COLORS[k], '#141a2b', 4, 'left', 'normal');
      y += 46;
    }

    y += 30;
    outlinedText(ctx, en ? 'GADGETS' : 'GADGETS', v.w / 2, y, 32, '#ffd166', '#2a1226', 6);
    y += 56;
    for (const g of GADGETS) {
      drawGadgetIcon(ctx, g.id, v.w / 2 - 150, y, 34);
      outlinedText(ctx, en ? g.nameEn : g.name, v.w / 2 - 110, y, 22, g.color, '#141a2b', 4, 'left', 'normal');
      y += 46;
    }

    y += 60;
    outlinedText(ctx, en ? 'Thanks for playing!' : 'Merci d\'avoir joué !', v.w / 2, y, 30, '#ffe9b8', '#2a1226', 6);

    // Boucle du defilement
    if (y < -60) this.y = 0;

    drawIconButton(ctx, 66, 60, 34, '←');
  }
}
