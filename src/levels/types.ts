/**
 * Modele de donnees des niveaux : declaratif, lisible, facile a etendre.
 * Ajouter un niveau = ajouter une entree dans `levels.ts`.
 */

/** Types de terrain de la grille de collision (1 cellule = 64 px). */
export const TERR = {
  VOID: 0,   // hors carte (noir / vide)
  GROUND: 1, // sol praticable standard
  PATH: 2,   // chemin / dallage (praticable, visuellement distinct)
  GRASS: 3,  // herbes hautes : praticable, cache les souris
  WATER: 4,  // eau : infranchissable sans grappin
  GAP: 5,    // gouffre : franchissable au dash / planeur
  WALL: 6,   // mur plein
  LEDGE: 7,  // plateforme surelevee : accessible au grappin uniquement
  HAZARD: 8, // fondue / zone brulante : traversable vite (patins) sinon degats
  SLICK: 9,  // sol glissant / glue adverse
} as const;
export type Terrain = number;

export const CELL = 64;

export function isWalkable(t: Terrain): boolean {
  return t === TERR.GROUND || t === TERR.PATH || t === TERR.GRASS || t === TERR.SLICK || t === TERR.HAZARD;
}

export function blocksSight(t: Terrain): boolean {
  return t === TERR.WALL || t === TERR.VOID;
}

export type MouseKind = 'yellow' | 'blue' | 'red' | 'green' | 'purple' | 'black' | 'white';
export type MobKind = 'roach' | 'crow' | 'guard' | 'drone' | 'elite';
export type GadgetId = 'radar' | 'dash' | 'grapple' | 'glue' | 'lure' | 'skates' | 'boomerang' | 'glider';

/** Types de zone verrouillee et gadget qui les ouvre. */
export type LockKind = 'gap' | 'ledge' | 'switch' | 'timed' | 'chasm' | 'hidden' | 'guard' | 'slick';

export const LOCK_GADGET: Record<LockKind, GadgetId> = {
  gap: 'dash',
  ledge: 'grapple',
  switch: 'boomerang',
  timed: 'skates',
  chasm: 'glider',
  hidden: 'radar',
  guard: 'lure',
  slick: 'glue',
};

export const LOCK_LABEL: Record<LockKind, string> = {
  gap: 'Gouffre',
  ledge: 'Plateforme haute',
  switch: 'Interrupteur lointain',
  timed: 'Grille chronométrée',
  chasm: 'Grand vide',
  hidden: 'Passage secret',
  guard: 'Rat de garde',
  slick: 'Souris trop rapides',
};

export type LayoutStyle = 'garden' | 'market' | 'sewer' | 'rooftop' | 'factory' | 'arena';

export interface LevelDef {
  id: string;
  world: number;
  index: number;
  name: string;
  nameEn: string;
  seed: number;
  cols: number;
  rows: number;
  /** Nombre de souris a capturer pour terminer le niveau. */
  quota: number;
  mice: Partial<Record<MouseKind, number>>;
  mobs: Partial<Record<MobKind, number>>;
  /** Zones verrouillees presentes (chacune contient 1 a 2 souris bonus). */
  locks: LockKind[];
  /** Gadget offert a la fin du niveau. */
  unlock?: GadgetId;
  miniBoss?: MobKind;
  boss?: boolean;
  hint: string;
  hintEn: string;
  tutorials?: string[];
  /** Temps (s) en dessous duquel on vise la medaille or. */
  targetTime: number;
  layout: LayoutStyle;
}

export interface WorldDef {
  id: number;
  name: string;
  nameEn: string;
  subtitle: string;
  subtitleEn: string;
  levels: LevelDef[];
}

/** Nombre total de souris d'un niveau (utile pour le 100 %). */
export function totalMice(def: LevelDef): number {
  let n = 0;
  for (const v of Object.values(def.mice)) n += v ?? 0;
  return n;
}
