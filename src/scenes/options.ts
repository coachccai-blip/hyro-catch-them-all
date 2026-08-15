/**
 * Options : volumes, langue, accessibilite, remapping clavier/manette,
 * et reinitialisation de la sauvegarde en double confirmation.
 */

import { Scene } from '../core/scene';
import { Menu, screenTitle, drawIconButton, hitCircle, type MenuItem } from '../ui/widgets';
import { ACTION_LABELS, Input, REMAPPABLE, defaultKeyBindings, defaultPadBindings, type ActionId } from '../core/input';
import { clamp } from '../core/math';
import { outlinedText, panel, roundRect, type Ctx } from '../render/draw';
import { audio } from '../audio/audio';
import { getLang, setLang, t } from '../ui/i18n';
import { TitleScene } from './title';

type Mode = 'main' | 'keys' | 'pad' | 'reset1' | 'reset2';

export class OptionsScene extends Scene {
  overlay = true;
  private mode: Mode = 'main';
  private menu = new Menu();
  private capturing: ActionId | null = null;
  private inGame: boolean;
  private scroll = 0;

  constructor(inGame: boolean) {
    super();
    this.inGame = inGame;
  }

  enter() {
    this.game.input.clearTouchButtons();
    this.buildMain();
  }

  exit() {
    this.game.save.flush();
  }

  private buildMain() {
    const s = this.game.save.settings;
    this.mode = 'main';
    this.menu.setItems([
      { id: 'music', label: t('music'), kind: 'slider', value: s.musicVol },
      { id: 'sfx', label: t('sfx'), kind: 'slider', value: s.sfxVol },
      { id: 'lang', label: t('language'), kind: 'choice', choices: ['Français', 'English'], value: s.lang === 'en' ? 1 : 0 },
      { id: 'shake', label: t('shake'), kind: 'slider', value: s.screenShake },
      { id: 'aim', label: t('aimAssist'), kind: 'toggle', value: s.aimAssist ? 1 : 0 },
      { id: 'big', label: t('bigText'), kind: 'toggle', value: s.bigText ? 1 : 0 },
      { id: 'fps', label: t('showFps'), kind: 'toggle', value: s.showFps ? 1 : 0 },
      { id: 'quality', label: t('quality'), kind: 'choice', hint: t('qualityHint'), choices: [t('qualityAuto'), t('qualityLow'), t('qualityHigh')], value: s.quality === 'low' ? 1 : s.quality === 'high' ? 2 : 0 },
      { id: 'keys', label: t('remapKeys'), kind: 'button' },
      { id: 'pad', label: t('remapPad'), kind: 'button' },
      { id: 'reset', label: t('resetSave'), kind: 'button', danger: true },
      { id: 'back', label: t('back'), kind: 'button' },
    ]);
  }

  private buildRemap(pad: boolean) {
    this.mode = pad ? 'pad' : 'keys';
    const s = this.game.save.settings;
    const items: MenuItem[] = REMAPPABLE.map((a) => ({
      id: a as string,
      label: `${ACTION_LABELS[a][getLang()]}`,
      kind: 'button' as const,
      hint: pad
        ? s.pad[a].map((b) => Input.prettyPad(b)).join(' / ') || '—'
        : s.keys[a].map((k) => Input.prettyKey(k)).join(' / ') || '—',
    }));
    items.push({ id: 'defaults', label: getLang() === 'en' ? 'Reset to defaults' : 'Réinitialiser', kind: 'button', hint: '' });
    items.push({ id: 'back', label: t('back'), kind: 'button', hint: '' });
    this.menu.setItems(items);
  }

  update(dt: number) {
    const input = this.game.input;
    const save = this.game.save;
    const s = save.settings;

    if (this.capturing) return; // on attend la touche

    const res = this.menu.update(dt, input);
    if (input.pressed('cancel') || input.pressed('pause')) {
      this.goBack();
      return;
    }
    for (const tap of input.taps) {
      if (hitCircle(tap.x, tap.y, 66, 60, 40)) {
        this.goBack();
        return;
      }
    }

    if (this.mode === 'main') {
      const it = this.menu.items[this.menu.index];
      if (res.changed) {
        switch (res.changed) {
          case 'music':
            s.musicVol = it.value ?? 0;
            audio.setVolumes(s.musicVol, s.sfxVol);
            break;
          case 'sfx':
            s.sfxVol = it.value ?? 0;
            audio.setVolumes(s.musicVol, s.sfxVol);
            audio.sfx('capture');
            break;
          case 'shake':
            s.screenShake = it.value ?? 0;
            break;
          case 'lang': {
            it.value = ((it.value ?? 0) + 1) % 2;
            s.lang = it.value === 1 ? 'en' : 'fr';
            setLang(s.lang);
            this.buildMain();
            break;
          }
          case 'quality': {
            it.value = ((it.value ?? 0) + 1) % 3;
            s.quality = it.value === 1 ? 'low' : it.value === 2 ? 'high' : 'auto';
            break;
          }
          default:
            break;
        }
        save.touch();
      }
      switch (res.activated) {
        case 'aim': it.value = it.value ? 0 : 1; s.aimAssist = !!it.value; save.touch(); break;
        case 'big': it.value = it.value ? 0 : 1; s.bigText = !!it.value; save.touch(); break;
        case 'fps': it.value = it.value ? 0 : 1; s.showFps = !!it.value; save.touch(); break;
        case 'lang': it.value = ((it.value ?? 0) + 1) % 2; s.lang = it.value === 1 ? 'en' : 'fr'; setLang(s.lang); this.buildMain(); save.touch(); break;
        case 'quality': it.value = ((it.value ?? 0) + 1) % 3; s.quality = it.value === 1 ? 'low' : it.value === 2 ? 'high' : 'auto'; save.touch(); break;
        case 'keys': this.buildRemap(false); break;
        case 'pad': this.buildRemap(true); break;
        case 'reset': this.mode = 'reset1'; break;
        case 'back': this.goBack(); break;
        default: break;
      }
      return;
    }

    if (this.mode === 'keys' || this.mode === 'pad') {
      if (res.activated === 'back') {
        this.buildMain();
        return;
      }
      if (res.activated === 'defaults') {
        if (this.mode === 'pad') s.pad = defaultPadBindings();
        else s.keys = defaultKeyBindings();
        this.game.input.keys = s.keys;
        this.game.input.pad = s.pad;
        save.touch();
        this.buildRemap(this.mode === 'pad');
        return;
      }
      if (res.activated) {
        const action = res.activated as ActionId;
        this.capturing = action;
        const isPad = this.mode === 'pad';
        this.game.input.captureNext = (binding, kind) => {
          if ((isPad && kind === 'pad') || (!isPad && kind === 'key')) {
            if (isPad) s.pad[action] = [parseInt(binding, 10)];
            else s.keys[action] = [binding];
            this.game.input.keys = s.keys;
            this.game.input.pad = s.pad;
            save.touch();
            audio.sfx('uiconfirm');
          }
          this.capturing = null;
          this.buildRemap(isPad);
        };
      }
      return;
    }

    // Confirmations de reinitialisation
    if (input.pressed('confirm') || input.pressed('net') || input.pressed('interact')) {
      if (this.mode === 'reset1') this.mode = 'reset2';
      else {
        save.reset();
        audio.sfx('unlock');
        this.game.transition(() => this.game.replace(new TitleScene()));
      }
    }
    for (const tap of input.taps) {
      const v = this.game.view;
      if (tap.y > v.h / 2 && tap.y < v.h / 2 + 120) {
        if (tap.x < v.w / 2) {
          if (this.mode === 'reset1') this.mode = 'reset2';
          else {
            save.reset();
            this.game.transition(() => this.game.replace(new TitleScene()));
          }
        } else {
          this.buildMain();
        }
      }
    }
  }

  private goBack() {
    audio.sfx('uiback');
    if (this.mode === 'main') {
      this.game.save.flush();
      this.game.pop();
    } else if (this.mode === 'reset1' || this.mode === 'reset2') {
      this.buildMain();
    } else {
      this.buildMain();
    }
  }

  draw(ctx: Ctx) {
    const v = this.game.view;
    ctx.fillStyle = this.inGame ? 'rgba(8,10,20,0.82)' : 'rgba(10,14,28,0.95)';
    ctx.fillRect(0, 0, v.w, v.h);

    if (this.mode === 'reset1' || this.mode === 'reset2') {
      panel(ctx, v.w / 2 - 400, v.h / 2 - 160, 800, 300, { fill: '#3a1622', stroke: '#ff8a6a', radius: 20 });
      outlinedText(ctx, t('resetSave'), v.w / 2, v.h / 2 - 100, 40, '#ff9b9b', '#2a0a12', 7, 'center', '900');
      outlinedText(ctx, this.mode === 'reset1' ? t('resetConfirm1') : t('resetConfirm2'),
        v.w / 2, v.h / 2 - 40, 23, '#ffe0e0', '#2a0a12', 5, 'center', 'normal');
      panel(ctx, v.w / 2 - 320, v.h / 2 + 10, 280, 74, { fill: '#5a1622', stroke: '#ff8a6a', radius: 14 });
      outlinedText(ctx, this.mode === 'reset2' ? `${t('yes')} — ${t('resetSave')}` : t('yes'), v.w / 2 - 180, v.h / 2 + 47, 24, '#fff6e2', '#2a0a12', 5);
      panel(ctx, v.w / 2 + 40, v.h / 2 + 10, 280, 74, { fill: '#1a2038', stroke: '#f7e7bd', radius: 14 });
      outlinedText(ctx, t('no'), v.w / 2 + 180, v.h / 2 + 47, 24, '#fff6e2', '#141a2b', 5);
      return;
    }

    const title = this.mode === 'main' ? t('options') : this.mode === 'pad' ? t('remapPad') : t('remapKeys');
    screenTitle(ctx, title, v.w / 2, 84);

    const rowH = this.mode === 'main' ? 56 : 50;
    const gap = 8;
    const h = this.menu.height(rowH, gap);
    const top = 138;
    const avail = v.h - top - 26;
    // Liste plus haute que l'ecran (remapping) : on defile pour garder la
    // ligne selectionnee visible.
    let startY = h <= avail ? Math.max(top, v.h / 2 - h / 2) : top;
    if (h > avail) {
      const selY = this.menu.index * (rowH + gap);
      startY = top - clamp(selY - avail * 0.45, 0, h - avail);
    }
    if (h > avail) {
      // Zone de defilement decoupee : les lignes hors cadre ne debordent pas
      // sur le titre.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, top - 6, v.w, avail + 12);
      ctx.clip();
      this.menu.draw(ctx, v.w / 2, startY, Math.min(720, v.w - 80), rowH, gap);
      ctx.restore();
    } else {
      this.menu.draw(ctx, v.w / 2, startY, Math.min(720, v.w - 80), rowH, gap);
    }
    if (h > avail) {
      // Indicateur de defilement
      const frac = clamp((top - startY) / (h - avail), 0, 1);
      const trackH = avail - 40;
      roundRect(ctx, v.w / 2 + Math.min(720, v.w - 80) / 2 + 16, top + 20 + frac * (trackH - 60), 6, 60, 3);
      ctx.fillStyle = 'rgba(255,209,102,0.65)';
      ctx.fill();
    }

    if (this.capturing) {
      panel(ctx, v.w / 2 - 300, v.h / 2 - 70, 600, 140, { fill: '#22304e', stroke: '#ffd166', radius: 18 });
      outlinedText(ctx, this.mode === 'pad' ? t('pressPad') : t('pressKey'), v.w / 2, v.h / 2, 30, '#ffe9b8', '#141a2b', 6);
    }
    drawIconButton(ctx, 66, 60, 34, '←');
  }
}
