/**
 * Couche d'entree unifiee : clavier+souris, manette (Gamepad API) et tactile.
 * Le reste du jeu ne parle jamais aux evenements DOM : il interroge des
 * "actions" abstraites (net, sword, up...) et un point de visee logique.
 */

import { clamp, TAU, type Vec2 } from './math';

export type ActionId =
  | 'up' | 'down' | 'left' | 'right'
  | 'net' | 'sword' | 'interact' | 'jump' | 'dash'
  | 'gadgetNext' | 'gadgetPrev' | 'gadgetUse'
  | 'pause' | 'confirm' | 'cancel' | 'map';

export const ACTION_LABELS: Record<ActionId, { fr: string; en: string }> = {
  up: { fr: 'Haut', en: 'Up' },
  down: { fr: 'Bas', en: 'Down' },
  left: { fr: 'Gauche', en: 'Left' },
  right: { fr: 'Droite', en: 'Right' },
  net: { fr: 'Filet', en: 'Net' },
  sword: { fr: 'Épée', en: 'Sword' },
  interact: { fr: 'Interagir', en: 'Interact' },
  jump: { fr: 'Saut', en: 'Jump' },
  dash: { fr: 'Ruée', en: 'Dash' },
  gadgetNext: { fr: 'Gadget suivant', en: 'Next gadget' },
  gadgetPrev: { fr: 'Gadget précédent', en: 'Prev gadget' },
  gadgetUse: { fr: 'Utiliser gadget', en: 'Use gadget' },
  pause: { fr: 'Pause', en: 'Pause' },
  confirm: { fr: 'Valider', en: 'Confirm' },
  cancel: { fr: 'Retour', en: 'Back' },
  map: { fr: 'Carte', en: 'Map' },
};

/** Actions remappables proposees dans l'ecran d'options. */
export const REMAPPABLE: ActionId[] = [
  'up', 'down', 'left', 'right',
  'net', 'sword', 'jump', 'dash', 'gadgetUse', 'interact',
  'gadgetNext', 'gadgetPrev', 'pause',
];

export type KeyBindings = Record<ActionId, string[]>;
export type PadBindings = Record<ActionId, number[]>;

/**
 * Clavier par defaut : ZQSD + WASD + fleches simultanement, ce qui evite
 * d'avoir a detecter le layout AZERTY/QWERTY (les deux jeux de touches
 * repondent, un joueur AZERTY appuie sur Z = KeyW en code physique).
 */
export function defaultKeyBindings(): KeyBindings {
  return {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'KeyQ', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    net: ['Mouse0'],
    sword: ['Mouse2', 'KeyR'],
    jump: ['Space'],
    dash: ['ShiftLeft', 'ShiftRight'],
    interact: ['KeyE'],
    gadgetUse: ['KeyF'],
    gadgetNext: ['KeyX', 'WheelDown'],
    gadgetPrev: ['KeyC', 'WheelUp'],
    pause: ['Escape'],
    confirm: ['Enter', 'Space'],
    cancel: ['Escape', 'Backspace'],
    map: ['Tab'],
  };
}

/** Manette : indices standards du "standard gamepad mapping". */
export function defaultPadBindings(): PadBindings {
  return {
    up: [12],
    down: [13],
    left: [14],
    right: [15],
    net: [7], // RT / R2
    sword: [5, 3], // RB / R1, Y(triangle)
    jump: [0], // A / croix
    dash: [1], // B / rond
    interact: [2], // X / carre
    gadgetUse: [6], // LT / L2
    gadgetNext: [4], // LB / L1
    gadgetPrev: [10], // clic stick gauche
    pause: [9], // Start
    confirm: [0],
    cancel: [1],
    map: [8],
  };
}

export interface TouchButtonDef {
  id: string;
  action: ActionId | null;
  x: number;
  y: number;
  r: number;
  label?: string;
}

interface PointerRec {
  id: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  role: 'none' | 'stick' | 'aim' | 'button' | 'ui';
  button?: string;
  startedAt: number;
}

export interface TapEvent {
  x: number;
  y: number;
}

const ALL_ACTIONS: ActionId[] = [
  'up', 'down', 'left', 'right', 'net', 'sword', 'jump', 'dash', 'interact',
  'gadgetNext', 'gadgetPrev', 'gadgetUse', 'pause', 'confirm', 'cancel', 'map',
];

export class Input {
  keys: KeyBindings = defaultKeyBindings();
  pad: PadBindings = defaultPadBindings();

  /** Dernier peripherique utilise, sert a adapter les icones d'aide. */
  source: 'keyboard' | 'gamepad' | 'touch' = 'keyboard';
  touchAvailable = false;

  /** Deplacement normalise (-1..1). */
  move: Vec2 = { x: 0, y: 0 };
  /** Position de visee en coordonnees logiques ecran (souris). */
  cursor: Vec2 = { x: 0, y: 0 };
  /** Direction de visee normalisee (stick droit / glissement tactile). */
  aimDir: Vec2 = { x: 1, y: 0 };
  /** Intensite du stick de visee (0..1) : 0 = pas de visee active. */
  aimStrength = 0;
  aimMode: 'cursor' | 'stick' = 'cursor';
  /** Le joueur vient de relacher un glissement de visee (tir tactile). */
  aimReleased = false;

  /** Taps consommables par l'UI (menus). */
  taps: TapEvent[] = [];
  /** Slot de gadget demande directement (touches 1..8), sinon null. */
  slotRequest: number | null = null;
  /** Cran de molette accumule sur la frame. */
  wheel = 0;

  /** Boutons tactiles declares par la scene courante (recalcules a chaque frame). */
  touchButtons: TouchButtonDef[] = [];
  /** Zone du joystick virtuel courant, pour l'affichage. */
  stickOrigin: Vec2 | null = null;
  stickVec: Vec2 = { x: 0, y: 0 };
  aimOrigin: Vec2 | null = null;
  aimVecRaw: Vec2 = { x: 0, y: 0 };

  /** Ecoute brute des touches, utilise par l'ecran de remapping. */
  captureNext: ((binding: string, kind: 'key' | 'pad') => void) | null = null;

  private down = new Set<string>();
  private downPad = new Set<number>();
  private pressedNow = new Set<string>();
  private releasedNow = new Set<string>();
  private padPressedNow = new Set<number>();
  private pointers = new Map<number, PointerRec>();
  private viewport = { w: 1920, h: 1080, scale: 1, ox: 0, oy: 0 };
  private padIndex: number | null = null;
  private el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    this.touchAvailable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.bind();
  }

  setViewport(w: number, h: number, scale: number, ox: number, oy: number) {
    this.viewport = { w, h, scale, ox, oy };
  }

  private toLogical(clientX: number, clientY: number): Vec2 {
    const rect = this.el.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.viewport.ox) / this.viewport.scale,
      y: (clientY - rect.top - this.viewport.oy) / this.viewport.scale,
    };
  }

  private bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      // On laisse passer F5/F12 et les raccourcis systeme.
      if (!e.metaKey && !e.ctrlKey && e.code !== 'F5' && e.code !== 'F12') e.preventDefault();
      this.source = 'keyboard';
      if (this.captureNext) {
        const cb = this.captureNext;
        this.captureNext = null;
        cb(e.code, 'key');
        return;
      }
      this.down.add(e.code);
      this.pressedNow.add(e.code);
      const digit = /^Digit([1-8])$/.exec(e.code);
      if (digit) this.slotRequest = parseInt(digit[1], 10);
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.releasedNow.add(e.code);
    });

    window.addEventListener('blur', () => {
      this.down.clear();
      this.downPad.clear();
      this.pointers.clear();
      this.stickOrigin = null;
      this.aimOrigin = null;
      this.move.x = 0;
      this.move.y = 0;
    });

    this.el.addEventListener('contextmenu', (e) => e.preventDefault());

    this.el.addEventListener('pointerdown', (e) => {
      this.el.setPointerCapture?.(e.pointerId);
      const p = this.toLogical(e.clientX, e.clientY);
      if (e.pointerType === 'mouse') {
        this.source = 'keyboard';
        this.aimMode = 'cursor';
        this.cursor.x = p.x;
        this.cursor.y = p.y;
        const code = `Mouse${e.button}`;
        if (this.captureNext) {
          const cb = this.captureNext;
          this.captureNext = null;
          cb(code, 'key');
          return;
        }
        this.down.add(code);
        this.pressedNow.add(code);
        this.taps.push({ x: p.x, y: p.y });
      } else {
        this.source = 'touch';
        this.aimMode = 'stick';
        this.onTouchStart(e.pointerId, p);
        this.taps.push({ x: p.x, y: p.y });
      }
      e.preventDefault();
    }, { passive: false });

    this.el.addEventListener('pointermove', (e) => {
      const p = this.toLogical(e.clientX, e.clientY);
      if (e.pointerType === 'mouse') {
        this.cursor.x = p.x;
        this.cursor.y = p.y;
        if (this.source !== 'gamepad') this.aimMode = 'cursor';
      } else {
        const rec = this.pointers.get(e.pointerId);
        if (rec) {
          rec.x = p.x;
          rec.y = p.y;
        }
      }
    }, { passive: false });

    const up = (e: PointerEvent) => {
      const p = this.toLogical(e.clientX, e.clientY);
      if (e.pointerType === 'mouse') {
        const code = `Mouse${e.button}`;
        this.down.delete(code);
        this.releasedNow.add(code);
      } else {
        this.onTouchEnd(e.pointerId, p);
      }
    };
    this.el.addEventListener('pointerup', up);
    this.el.addEventListener('pointercancel', up);

    this.el.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      const code = e.deltaY > 0 ? 'WheelDown' : 'WheelUp';
      this.pressedNow.add(code);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('gamepadconnected', () => { /* detecte au polling */ });
  }

  private onTouchStart(id: number, p: Vec2) {
    // 1) Un bouton tactile a-t-il ete touche ?
    for (const b of this.touchButtons) {
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if (dx * dx + dy * dy <= b.r * b.r * 1.35) {
        this.pointers.set(id, { id, x: p.x, y: p.y, sx: p.x, sy: p.y, role: 'button', button: b.id, startedAt: performance.now() });
        if (b.action) {
          this.down.add(`T:${b.action}`);
          this.pressedNow.add(`T:${b.action}`);
        }
        return;
      }
    }
    // 2) Moitie gauche : joystick flottant. Moitie droite : visee.
    const half = this.viewport.w * 0.5;
    if (p.x < half) {
      this.pointers.set(id, { id, x: p.x, y: p.y, sx: p.x, sy: p.y, role: 'stick', startedAt: performance.now() });
      this.stickOrigin = { x: p.x, y: p.y };
    } else {
      this.pointers.set(id, { id, x: p.x, y: p.y, sx: p.x, sy: p.y, role: 'aim', startedAt: performance.now() });
      this.aimOrigin = { x: p.x, y: p.y };
    }
  }

  private onTouchEnd(id: number, p: Vec2) {
    const rec = this.pointers.get(id);
    this.pointers.delete(id);
    if (!rec) return;
    if (rec.role === 'button') {
      const b = this.touchButtons.find((x) => x.id === rec.button);
      if (b?.action) {
        this.down.delete(`T:${b.action}`);
        this.releasedNow.add(`T:${b.action}`);
      }
    } else if (rec.role === 'stick') {
      this.stickOrigin = null;
      this.stickVec.x = 0;
      this.stickVec.y = 0;
    } else if (rec.role === 'aim') {
      const dx = p.x - rec.sx;
      const dy = p.y - rec.sy;
      // Un glissement suffisant = lancer de filet dans la direction visee.
      if (Math.hypot(dx, dy) > 26) this.aimReleased = true;
      this.aimOrigin = null;
    }
  }

  /** Appele une fois par frame, avant la logique de jeu. */
  update(dt: number) {
    this.pollGamepad();

    // --- Deplacement -------------------------------------------------------
    let mx = 0;
    let my = 0;
    if (this.isDownRaw('right')) mx += 1;
    if (this.isDownRaw('left')) mx -= 1;
    if (this.isDownRaw('down')) my += 1;
    if (this.isDownRaw('up')) my -= 1;

    // Stick gauche de la manette
    const gp = this.getPad();
    if (gp) {
      const ax = deadzone(gp.axes[0] ?? 0);
      const ay = deadzone(gp.axes[1] ?? 0);
      if (Math.abs(ax) > 0 || Math.abs(ay) > 0) {
        mx += ax;
        my += ay;
        this.source = 'gamepad';
        this.aimMode = 'stick';
      }
    }

    // Joystick virtuel tactile
    for (const rec of this.pointers.values()) {
      if (rec.role !== 'stick') continue;
      const dx = rec.x - rec.sx;
      const dy = rec.y - rec.sy;
      const len = Math.hypot(dx, dy);
      const max = 110;
      // Le joystick "suit" le doigt s'il s'eloigne trop (confort mobile).
      if (len > max) {
        rec.sx += (dx / len) * (len - max);
        rec.sy += (dy / len) * (len - max);
        this.stickOrigin = { x: rec.sx, y: rec.sy };
      }
      const nx = clamp((rec.x - rec.sx) / max, -1, 1);
      const ny = clamp((rec.y - rec.sy) / max, -1, 1);
      this.stickVec.x = nx;
      this.stickVec.y = ny;
      const dead = 0.14;
      const l = Math.hypot(nx, ny);
      if (l > dead) {
        const k = (l - dead) / (1 - dead) / l;
        mx += nx * k;
        my += ny * k;
      }
    }

    const ml = Math.hypot(mx, my);
    if (ml > 1) {
      mx /= ml;
      my /= ml;
    }
    this.move.x = mx;
    this.move.y = my;

    // --- Visee -------------------------------------------------------------
    this.aimStrength = 0;
    if (gp) {
      const rx = deadzone(gp.axes[2] ?? 0, 0.22);
      const ry = deadzone(gp.axes[3] ?? 0, 0.22);
      const l = Math.hypot(rx, ry);
      if (l > 0.05) {
        this.aimDir.x = rx / l;
        this.aimDir.y = ry / l;
        this.aimStrength = clamp(l, 0, 1);
        this.aimMode = 'stick';
        this.source = 'gamepad';
      }
    }
    for (const rec of this.pointers.values()) {
      if (rec.role !== 'aim') continue;
      const dx = rec.x - rec.sx;
      const dy = rec.y - rec.sy;
      const l = Math.hypot(dx, dy);
      this.aimVecRaw.x = dx;
      this.aimVecRaw.y = dy;
      if (l > 12) {
        this.aimDir.x = dx / l;
        this.aimDir.y = dy / l;
        this.aimStrength = clamp(l / 150, 0.15, 1);
        this.aimMode = 'stick';
      }
    }
    // Si aucun stick de visee n'est actif, on garde la direction de marche.
    if (this.aimStrength === 0 && this.aimMode === 'stick' && ml > 0.1) {
      this.aimDir.x = mx / Math.max(ml, 0.001);
      this.aimDir.y = my / Math.max(ml, 0.001);
    }
  }

  /** Fin de frame : on vide les evenements ponctuels. */
  endFrame() {
    this.pressedNow.clear();
    this.releasedNow.clear();
    this.padPressedNow.clear();
    this.taps.length = 0;
    this.slotRequest = null;
    this.wheel = 0;
    this.aimReleased = false;
  }

  private getPad(): Gamepad | null {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (this.padIndex !== null && pads[this.padIndex]) return pads[this.padIndex];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i]) {
        this.padIndex = i;
        return pads[i];
      }
    }
    return null;
  }

  private pollGamepad() {
    const gp = this.getPad();
    if (!gp) {
      this.downPad.clear();
      return;
    }
    for (let i = 0; i < gp.buttons.length; i++) {
      const pressed = gp.buttons[i].pressed || gp.buttons[i].value > 0.4;
      if (pressed && !this.downPad.has(i)) {
        this.downPad.add(i);
        this.padPressedNow.add(i);
        this.source = 'gamepad';
        if (this.captureNext) {
          const cb = this.captureNext;
          this.captureNext = null;
          cb(String(i), 'pad');
        }
      } else if (!pressed && this.downPad.has(i)) {
        this.downPad.delete(i);
      }
    }
  }

  /** Petite vibration si la manette le supporte. */
  rumble(duration = 90, strong = 0.35, weak = 0.2) {
    const gp = this.getPad();
    const act = (gp as unknown as { vibrationActuator?: { playEffect: (t: string, o: object) => Promise<unknown> } })
      ?.vibrationActuator;
    if (!act?.playEffect) return;
    act.playEffect('dual-rumble', {
      startDelay: 0,
      duration,
      strongMagnitude: strong,
      weakMagnitude: weak,
    }).catch(() => { /* ignore */ });
  }

  private isDownRaw(a: ActionId): boolean {
    for (const k of this.keys[a]) if (this.down.has(k)) return true;
    for (const b of this.pad[a]) if (this.downPad.has(b)) return true;
    if (this.down.has(`T:${a}`)) return true;
    return false;
  }

  isDown(a: ActionId): boolean {
    return this.isDownRaw(a);
  }

  /** Acces brut a un code touche (mode debug, raccourcis systeme). */
  rawPressed(code: string): boolean {
    return this.pressedNow.has(code);
  }

  rawDown(code: string): boolean {
    return this.down.has(code);
  }

  pressed(a: ActionId): boolean {
    for (const k of this.keys[a]) if (this.pressedNow.has(k)) return true;
    for (const b of this.pad[a]) if (this.padPressedNow.has(b)) return true;
    if (this.pressedNow.has(`T:${a}`)) return true;
    return false;
  }

  released(a: ActionId): boolean {
    for (const k of this.keys[a]) if (this.releasedNow.has(k)) return true;
    if (this.releasedNow.has(`T:${a}`)) return true;
    return false;
  }

  /** Direction de menu (une impulsion par appui). */
  menuDir(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.pressed('right')) x += 1;
    if (this.pressed('left')) x -= 1;
    if (this.pressed('down')) y += 1;
    if (this.pressed('up')) y -= 1;
    return { x, y };
  }

  setTouchButtons(defs: TouchButtonDef[]) {
    this.touchButtons = defs;
  }

  clearTouchButtons() {
    this.touchButtons = [];
  }

  /** Libelle lisible d'une touche pour l'ecran d'options. */
  static prettyKey(code: string): string {
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Arrow')) return { Up: '↑', Down: '↓', Left: '←', Right: '→' }[code.slice(5)] ?? code;
    if (code === 'Mouse0') return 'Clic G';
    if (code === 'Mouse1') return 'Clic M';
    if (code === 'Mouse2') return 'Clic D';
    if (code === 'WheelUp') return 'Molette ↑';
    if (code === 'WheelDown') return 'Molette ↓';
    if (code === 'Space') return 'Espace';
    if (code === 'ShiftLeft') return 'Maj G';
    if (code === 'ShiftRight') return 'Maj D';
    if (code === 'ControlLeft') return 'Ctrl G';
    if (code === 'Escape') return 'Échap';
    if (code === 'Enter') return 'Entrée';
    if (code === 'Backspace') return 'Retour';
    return code;
  }

  static prettyPad(index: number): string {
    const names: Record<number, string> = {
      0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
      8: 'Select', 9: 'Start', 10: 'L3', 11: 'R3', 12: '↑', 13: '↓', 14: '←', 15: '→',
    };
    return names[index] ?? `B${index}`;
  }

  static allActions(): ActionId[] {
    return ALL_ACTIONS;
  }
}

function deadzone(v: number, dz = 0.18): number {
  const a = Math.abs(v);
  if (a < dz) return 0;
  return Math.sign(v) * ((a - dz) / (1 - dz));
}

/** Petit helper d'angle pour les modules de visee. */
export function aimAngle(v: Vec2): number {
  return (Math.atan2(v.y, v.x) + TAU) % TAU;
}
