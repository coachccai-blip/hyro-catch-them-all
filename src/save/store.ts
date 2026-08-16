/**
 * Sauvegarde locale (localStorage) avec versionnage de schema et migrations douces.
 * Aucune donnee ne quitte le navigateur, aucun backend.
 */

import { defaultKeyBindings, defaultPadBindings, type KeyBindings, type PadBindings } from '../core/input';

export const SAVE_KEY = 'hyro.save';
export const SAVE_VERSION = 5;

export type Medal = 'none' | 'bronze' | 'silver' | 'gold';
export type Lang = 'fr' | 'en';

export interface LevelProgress {
  /** Niveau termine au moins une fois (quota atteint). */
  done: boolean;
  /** Identifiants des souris capturees (stables entre sessions grace au seed). */
  caught: string[];
  /** Nombre total de souris presentes dans le niveau. */
  total: number;
  /** La souris Blanche rare a-t-elle ete attrapee ? */
  white: boolean;
  bestTimeMs: number;
  bestMedal: Medal;
  /** Niveau termine sans subir de degat. */
  noHit: boolean;
}

export interface Settings {
  musicVol: number;
  sfxVol: number;
  lang: Lang;
  screenShake: number; // 0..1
  showFps: boolean;
  bigText: boolean;
  highContrast: boolean;
  aimAssist: boolean;
  /** Vie illimitee : les coups font reculer et clignoter, mais ne tuent plus. */
  infiniteHp: boolean;
  quality: 'auto' | 'low' | 'high';
  keys: KeyBindings;
  pad: PadBindings;
}

export interface SaveData {
  version: number;
  createdAt: number;
  updatedAt: number;
  levels: Record<string, LevelProgress>;
  gadgets: string[];
  seenTutorials: string[];
  lastLevelId: string | null;
  playtimeMs: number;
  settings: Settings;
}

export function defaultSettings(): Settings {
  return {
    musicVol: 0.55,
    sfxVol: 0.8,
    lang: 'fr',
    screenShake: 1,
    showFps: false,
    bigText: false,
    highContrast: false,
    aimAssist: true,
    infiniteHp: true,
    quality: 'auto',
    keys: defaultKeyBindings(),
    pad: defaultPadBindings(),
  };
}

export function emptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    levels: {},
    gadgets: [],
    seenTutorials: [],
    lastLevelId: null,
    playtimeMs: 0,
    settings: defaultSettings(),
  };
}

export function emptyProgress(total = 0): LevelProgress {
  return { done: false, caught: [], total, white: false, bestTimeMs: 0, bestMedal: 'none', noHit: false };
}

/**
 * Migrations : on ne casse jamais une sauvegarde existante, on complete les
 * champs manquants avec les valeurs par defaut.
 */
function migrate(raw: Partial<SaveData> & { version?: number }): SaveData {
  const base = emptySave();
  const out: SaveData = {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings ?? {}) },
    levels: { ...(raw.levels ?? {}) },
    gadgets: Array.isArray(raw.gadgets) ? raw.gadgets.slice() : [],
    seenTutorials: Array.isArray(raw.seenTutorials) ? raw.seenTutorials.slice() : [],
  };
  // Les bindings peuvent manquer une action ajoutee par une mise a jour.
  out.settings.keys = { ...defaultKeyBindings(), ...(raw.settings?.keys ?? {}) };
  out.settings.pad = { ...defaultPadBindings(), ...(raw.settings?.pad ?? {}) };
  // v5 : la vie illimitee est activee par defaut, y compris pour une
  // sauvegarde existante — c'est le reglage demande, l'option permet de la
  // couper pour qui veut le defi complet.
  if ((raw.version ?? 0) < 5) out.settings.infiniteHp = true;
  // v4 : la ruee prend Maj, le gadget se replie sur F. Sans ce nettoyage, une
  // vieille sauvegarde declencherait les deux sur la meme touche.
  if ((raw.version ?? 0) < 4) {
    out.settings.keys.gadgetUse = out.settings.keys.gadgetUse.filter((k) => !k.startsWith('Shift'));
    if (!out.settings.keys.gadgetUse.length) out.settings.keys.gadgetUse = ['KeyF'];
    out.settings.keys.dash = defaultKeyBindings().dash;
    out.settings.pad.dash = defaultPadBindings().dash;
  }
  for (const [id, p] of Object.entries(out.levels)) {
    out.levels[id] = { ...emptyProgress(), ...(p as LevelProgress) };
  }
  out.version = SAVE_VERSION;
  return out;
}

export class SaveStore {
  data: SaveData;
  private dirty = false;
  private timer = 0;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return emptySave();
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return emptySave();
      return migrate(parsed);
    } catch {
      return emptySave();
    }
  }

  /** Marque la sauvegarde comme a ecrire (ecriture groupee, evite le spam I/O). */
  touch() {
    this.dirty = true;
  }

  update(dt: number) {
    if (!this.dirty) return;
    this.timer += dt;
    if (this.timer > 0.75) {
      this.flush();
    }
  }

  flush() {
    this.dirty = false;
    this.timer = 0;
    try {
      this.data.updatedAt = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* quota plein ou mode prive : le jeu continue sans sauvegarde */
    }
  }

  reset() {
    const settings = this.data.settings;
    this.data = emptySave();
    this.data.settings = settings; // on conserve les options / remapping
    this.flush();
  }

  get settings(): Settings {
    return this.data.settings;
  }

  progress(levelId: string, total = 0): LevelProgress {
    let p = this.data.levels[levelId];
    if (!p) {
      p = emptyProgress(total);
      this.data.levels[levelId] = p;
    }
    if (total && p.total !== total) p.total = total;
    return p;
  }

  hasGadget(id: string): boolean {
    return this.data.gadgets.includes(id);
  }

  unlockGadget(id: string): boolean {
    if (this.hasGadget(id)) return false;
    this.data.gadgets.push(id);
    this.touch();
    return true;
  }

  markTutorial(id: string): boolean {
    if (this.data.seenTutorials.includes(id)) return false;
    this.data.seenTutorials.push(id);
    this.touch();
    return true;
  }

  seenTutorial(id: string): boolean {
    return this.data.seenTutorials.includes(id);
  }

  /** Total de souris capturees toutes parties confondues. */
  totalCaught(): number {
    let n = 0;
    for (const p of Object.values(this.data.levels)) n += p.caught.length;
    return n;
  }

  totalWhite(): number {
    let n = 0;
    for (const p of Object.values(this.data.levels)) if (p.white) n++;
    return n;
  }

  levelsDone(): number {
    let n = 0;
    for (const p of Object.values(this.data.levels)) if (p.done) n++;
    return n;
  }
}
