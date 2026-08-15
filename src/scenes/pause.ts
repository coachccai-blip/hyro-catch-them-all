/**
 * Menu de pause (scene en surimpression).
 */

import { Scene } from '../core/scene';
import { Menu } from '../ui/widgets';
import { outlinedText, panel, type Ctx } from '../render/draw';
import { t } from '../ui/i18n';
import { audio } from '../audio/audio';
import { OptionsScene } from './options';
import type { PlayScene } from './play';
import { PlayScene as Play } from './play';
import { LevelSelectScene } from './levelselect';

export class PauseScene extends Scene {
  overlay = true;
  private menu: Menu;
  private parent: PlayScene;

  constructor(parent: PlayScene) {
    super();
    this.parent = parent;
    this.menu = new Menu([
      { id: 'resume', label: t('resume'), kind: 'button' },
      { id: 'restart', label: t('restart'), kind: 'button' },
      { id: 'options', label: t('options'), kind: 'button' },
      { id: 'quit', label: t('quit'), kind: 'button' },
    ]);
  }

  enter() {
    audio.duckMusic(0.35, 999);
    this.game.input.clearTouchButtons();
  }

  exit() {
    audio.duckMusic(1, 0.1);
  }

  update(dt: number) {
    const input = this.game.input;
    const res = this.menu.update(dt, input);
    if (input.pressed('pause') || input.pressed('cancel')) {
      this.game.pop();
      return;
    }
    switch (res.activated) {
      case 'resume':
        this.game.pop();
        break;
      case 'restart':
        this.game.transition(() => {
          this.game.pop();
          this.game.replace(new Play(this.parent.levelId));
        });
        break;
      case 'options':
        this.game.push(new OptionsScene(true));
        break;
      case 'quit':
        this.game.transition(() => {
          this.game.pop();
          this.game.replace(new LevelSelectScene(this.parent.world.def.world));
        });
        break;
      default:
        break;
    }
  }

  draw(ctx: Ctx) {
    const v = this.game.view;
    ctx.fillStyle = 'rgba(8,10,20,0.62)';
    ctx.fillRect(0, 0, v.w, v.h);
    const h = this.menu.height();
    const y = v.h / 2 - h / 2 + 20;
    outlinedText(ctx, t('pause'), v.w / 2, y - 90, 62, '#ffe9b8', '#2a1226', 9, 'center', '900');
    this.menu.draw(ctx, v.w / 2, y, Math.min(520, v.w - 80));
  }
}
