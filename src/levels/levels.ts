/**
 * Les 25 niveaux du jeu, en donnees pures.
 * La geometrie est generee a partir du `seed` (voir `generator.ts`), ce qui
 * garantit qu'un niveau est toujours identique d'une session a l'autre.
 */

import type { LevelDef, WorldDef, MouseKind, MobKind } from './types';
import { totalMice } from './types';

type Mice = Partial<Record<MouseKind, number>>;
type Mobs = Partial<Record<MobKind, number>>;

let seedCounter = 1337;

function lvl(p: Omit<LevelDef, 'seed' | 'nameEn' | 'hintEn'> & { nameEn?: string; hintEn?: string }): LevelDef {
  seedCounter = (seedCounter * 1103515245 + 12345) >>> 0;
  return {
    ...p,
    nameEn: p.nameEn ?? p.name,
    hintEn: p.hintEn ?? p.hint,
    seed: seedCounter,
  } as LevelDef;
}

// ---------------------------------------------------------------------------
// MONDE 1 — Le Jardin de la Maison
// ---------------------------------------------------------------------------
const W1: LevelDef[] = [
  lvl({
    id: '1-1', world: 1, index: 1, name: 'Le Carré de Pelouse', nameEn: 'The Lawn Patch',
    cols: 52, rows: 32, quota: 5, layout: 'garden', targetTime: 90,
    mice: { blue: 6, yellow: 3, white: 1 } as Mice,
    mobs: {} as Mobs,
    locks: ['hidden'],
    hint: 'Vise avec la souris, clic gauche pour lancer le filet.',
    hintEn: 'Aim with the mouse, left click to throw the net.',
    tutorials: ['move', 'net', 'sword', 'quota'],
  }),
  lvl({
    id: '1-2', world: 1, index: 2, name: 'Les Pots Renversés', nameEn: 'Toppled Pots',
    cols: 56, rows: 34, quota: 6, layout: 'garden', targetTime: 110,
    mice: { blue: 4, yellow: 6, white: 1 } as Mice,
    mobs: { roach: 3 } as Mobs,
    locks: ['hidden', 'gap'],
    unlock: 'radar',
    hint: 'L\'épée assomme les souris et tue les cafards blindés.',
    hintEn: 'The sword stuns mice and kills armoured roaches.',
    tutorials: ['sword', 'roach'],
  }),
  lvl({
    id: '1-3', world: 1, index: 3, name: 'Sous les Hortensias', nameEn: 'Under the Hydrangeas',
    cols: 58, rows: 36, quota: 6, layout: 'garden', targetTime: 120,
    mice: { blue: 3, yellow: 7, white: 1 } as Mice,
    mobs: { roach: 4 } as Mobs,
    locks: ['hidden', 'gap'],
    hint: 'Le radar révèle les souris cachées dans les buissons.',
    hintEn: 'The radar reveals mice hidden in bushes.',
    tutorials: ['radar', 'hide'],
  }),
  lvl({
    id: '1-4', world: 1, index: 4, name: 'L\'Allée du Nain', nameEn: 'Gnome Alley',
    cols: 60, rows: 36, quota: 7, layout: 'garden', targetTime: 130,
    mice: { blue: 3, yellow: 6, red: 2, white: 1 } as Mice,
    mobs: { roach: 4 } as Mobs,
    locks: ['gap', 'hidden'],
    unlock: 'dash',
    hint: 'Les Bagarreuses rouges chargent : assomme-les d\'abord.',
    hintEn: 'Red Brawlers charge at you: stun them first.',
    tutorials: ['red'],
  }),
  lvl({
    id: '1-5', world: 1, index: 5, name: 'Le Grand Cafard', nameEn: 'The Great Roach',
    cols: 62, rows: 38, quota: 8, layout: 'garden', targetTime: 150,
    mice: { blue: 3, yellow: 6, red: 3, white: 1 } as Mice,
    mobs: { roach: 5 } as Mobs,
    miniBoss: 'roach',
    locks: ['gap', 'hidden'],
    hint: 'Le dash traverse les gouffres et rattrape les fuyardes.',
    hintEn: 'The dash crosses gaps and catches runaways.',
    tutorials: ['dash', 'miniboss'],
  }),
];

// ---------------------------------------------------------------------------
// MONDE 2 — Le Marché de Nuit
// ---------------------------------------------------------------------------
const W2: LevelDef[] = [
  lvl({
    id: '2-1', world: 2, index: 1, name: 'Lampions et Cageots', nameEn: 'Lanterns and Crates',
    cols: 64, rows: 38, quota: 7, layout: 'market', targetTime: 140,
    mice: { yellow: 5, blue: 3, red: 4, white: 1 } as Mice,
    mobs: { crow: 3, roach: 2 } as Mobs,
    locks: ['hidden', 'gap'],
    hint: 'Les corbeaux piquent depuis les airs : surveille leur ombre.',
    hintEn: 'Crows dive from above: watch their shadow.',
    tutorials: ['crow'],
  }),
  lvl({
    id: '2-2', world: 2, index: 2, name: 'La Ruelle des Épices', nameEn: 'Spice Alley',
    cols: 66, rows: 40, quota: 7, layout: 'market', targetTime: 150,
    mice: { yellow: 5, red: 3, green: 3, white: 1 } as Mice,
    mobs: { crow: 3 } as Mobs,
    locks: ['gap', 'ledge'],
    hint: 'Les Sprinteuses vertes sont trop rapides pour le filet seul.',
    hintEn: 'Green Sprinters are too fast for the net alone.',
    tutorials: ['green'],
  }),
  lvl({
    id: '2-3', world: 2, index: 3, name: 'Les Toits d\'Étals', nameEn: 'Stall Rooftops',
    cols: 68, rows: 40, quota: 8, layout: 'market', targetTime: 160,
    mice: { yellow: 4, red: 4, green: 3, white: 1 } as Mice,
    mobs: { crow: 4, roach: 2 } as Mobs,
    locks: ['ledge', 'hidden'],
    unlock: 'grapple',
    hint: 'Le grappin attire les souris et te hisse sur les hauteurs.',
    hintEn: 'The grapple pulls mice in and hoists you up high.',
    tutorials: ['grapple'],
  }),
  lvl({
    id: '2-4', world: 2, index: 4, name: 'Le Bassin aux Reflets', nameEn: 'The Mirror Pond',
    cols: 70, rows: 42, quota: 8, layout: 'market', targetTime: 170,
    mice: { yellow: 3, blue: 2, red: 4, green: 4, white: 1 } as Mice,
    mobs: { crow: 4, roach: 3 } as Mobs,
    locks: ['ledge', 'gap', 'slick'],
    hint: 'Le grappin permet aussi de franchir l\'eau.',
    hintEn: 'The grapple also lets you cross water.',
  }),
  lvl({
    id: '2-5', world: 2, index: 5, name: 'Le Corbeau Doyen', nameEn: 'The Elder Crow',
    cols: 70, rows: 42, quota: 9, layout: 'market', targetTime: 185,
    mice: { yellow: 4, red: 4, green: 4, white: 1 } as Mice,
    mobs: { crow: 5, roach: 2 } as Mobs,
    miniBoss: 'crow',
    locks: ['ledge', 'gap'],
    unlock: 'glue',
    hint: 'La glue immobilise trois secondes : parfait contre les Vertes.',
    hintEn: 'Glue freezes them for three seconds: perfect against Greens.',
    tutorials: ['glue', 'miniboss'],
  }),
];

// ---------------------------------------------------------------------------
// MONDE 3 — Égouts & Métro abandonné
// ---------------------------------------------------------------------------
const W3: LevelDef[] = [
  lvl({
    id: '3-1', world: 3, index: 1, name: 'Collecteur Nord', nameEn: 'North Collector',
    cols: 68, rows: 42, quota: 8, layout: 'sewer', targetTime: 165,
    mice: { yellow: 4, red: 3, green: 3, purple: 3, white: 1 } as Mice,
    mobs: { guard: 3, roach: 3 } as Mobs,
    locks: ['slick', 'hidden'],
    hint: 'Les Ingénieuses violettes posent des pièges : reste mobile.',
    hintEn: 'Purple Tinkerers lay traps: keep moving.',
    tutorials: ['purple', 'guard'],
  }),
  lvl({
    id: '3-2', world: 3, index: 2, name: 'Quai Fantôme', nameEn: 'Ghost Platform',
    cols: 72, rows: 44, quota: 8, layout: 'sewer', targetTime: 175,
    mice: { yellow: 3, red: 3, green: 3, purple: 4, black: 2, white: 1 } as Mice,
    mobs: { guard: 4, roach: 2 } as Mobs,
    locks: ['guard', 'ledge'],
    unlock: 'lure',
    hint: 'Les souris Ombres n\'apparaissent qu\'au radar.',
    hintEn: 'Shadow mice only show up on radar.',
    tutorials: ['black', 'lure'],
  }),
  lvl({
    id: '3-3', world: 3, index: 3, name: 'Le Wagon Taggé', nameEn: 'The Tagged Car',
    cols: 74, rows: 44, quota: 9, layout: 'sewer', targetTime: 185,
    mice: { yellow: 3, red: 4, green: 3, purple: 4, black: 2, white: 1 } as Mice,
    mobs: { guard: 4, crow: 2 } as Mobs,
    locks: ['guard', 'gap', 'hidden'],
    hint: 'Le leurre à fromage détourne les rats de garde.',
    hintEn: 'The cheese lure distracts guard rats.',
  }),
  lvl({
    id: '3-4', world: 3, index: 4, name: 'Canalisation Verte', nameEn: 'Green Pipeworks',
    cols: 76, rows: 46, quota: 9, layout: 'sewer', targetTime: 195,
    mice: { yellow: 3, red: 4, green: 4, purple: 4, black: 3, white: 1 } as Mice,
    mobs: { guard: 5, roach: 3 } as Mobs,
    locks: ['guard', 'ledge', 'slick'],
    hint: 'Un coup d\'épée sur une cachette en fait sortir les souris.',
    hintEn: 'A sword hit on a hiding spot flushes mice out.',
  }),
  lvl({
    id: '3-5', world: 3, index: 5, name: 'Le Chef de Quai', nameEn: 'The Yard Master',
    cols: 76, rows: 46, quota: 10, layout: 'sewer', targetTime: 210,
    mice: { yellow: 3, red: 4, green: 4, purple: 4, black: 3, white: 1 } as Mice,
    mobs: { guard: 6, crow: 2 } as Mobs,
    miniBoss: 'guard',
    locks: ['guard', 'ledge', 'gap'],
    unlock: 'skates',
    hint: 'Les patins turbo permettent de capturer en pleine course.',
    hintEn: 'Turbo skates let you capture while sprinting.',
    tutorials: ['skates', 'miniboss'],
  }),
];

// ---------------------------------------------------------------------------
// MONDE 4 — Les Toits sous la Pluie
// ---------------------------------------------------------------------------
const W4: LevelDef[] = [
  lvl({
    id: '4-1', world: 4, index: 1, name: 'Averse sur les Tuiles', nameEn: 'Downpour on Tiles',
    cols: 74, rows: 44, quota: 9, layout: 'rooftop', targetTime: 190,
    mice: { yellow: 3, red: 4, green: 4, purple: 3, black: 2, white: 1 } as Mice,
    mobs: { drone: 3, crow: 3 } as Mobs,
    locks: ['timed', 'gap'],
    hint: 'Les drones tirent des projectiles lents : esquive latérale.',
    hintEn: 'Drones fire slow shots: strafe sideways.',
    tutorials: ['drone'],
  }),
  lvl({
    id: '4-2', world: 4, index: 2, name: 'Le Linge du Voisin', nameEn: 'Neighbour\'s Laundry',
    cols: 76, rows: 46, quota: 9, layout: 'rooftop', targetTime: 195,
    mice: { yellow: 3, red: 4, green: 4, purple: 4, black: 3, white: 1 } as Mice,
    mobs: { drone: 4, crow: 3 } as Mobs,
    locks: ['timed', 'ledge'],
    unlock: 'boomerang',
    hint: 'Le boomerang sonique assomme à distance en arc de cercle.',
    hintEn: 'The sonic boomerang stuns at range in an arc.',
    tutorials: ['boomerang'],
  }),
  lvl({
    id: '4-3', world: 4, index: 3, name: 'Enseignes Grésillantes', nameEn: 'Sizzling Signs',
    cols: 78, rows: 46, quota: 10, layout: 'rooftop', targetTime: 205,
    mice: { yellow: 3, red: 5, green: 4, purple: 4, black: 3, white: 1 } as Mice,
    mobs: { drone: 4, crow: 4 } as Mobs,
    locks: ['switch', 'gap', 'timed'],
    hint: 'Le boomerang active les interrupteurs hors de portée.',
    hintEn: 'The boomerang triggers far-away switches.',
  }),
  lvl({
    id: '4-4', world: 4, index: 4, name: 'Cheminées et Courants', nameEn: 'Chimneys and Gusts',
    cols: 80, rows: 48, quota: 10, layout: 'rooftop', targetTime: 215,
    mice: { yellow: 3, red: 5, green: 5, purple: 4, black: 3, white: 1 } as Mice,
    mobs: { drone: 5, crow: 4 } as Mobs,
    locks: ['switch', 'timed', 'ledge'],
    hint: 'Une chute te coûte un cœur et te renvoie au bord.',
    hintEn: 'Falling costs a heart and puts you back on the edge.',
  }),
  lvl({
    id: '4-5', world: 4, index: 5, name: 'Le Drone Sentinelle', nameEn: 'The Sentinel Drone',
    cols: 80, rows: 48, quota: 11, layout: 'rooftop', targetTime: 230,
    mice: { yellow: 3, red: 5, green: 5, purple: 5, black: 3, white: 1 } as Mice,
    mobs: { drone: 6, crow: 3 } as Mobs,
    miniBoss: 'drone',
    locks: ['switch', 'chasm', 'timed'],
    unlock: 'glider',
    hint: 'La cape planeur plonge du haut des toits sur les souris.',
    hintEn: 'The glider cape dives from rooftops onto mice.',
    tutorials: ['glider', 'miniboss'],
  }),
];

// ---------------------------------------------------------------------------
// MONDE 5 — La Forteresse Fromagère de Nerat
// ---------------------------------------------------------------------------
const W5: LevelDef[] = [
  lvl({
    id: '5-1', world: 5, index: 1, name: 'Le Hall des Meules', nameEn: 'Hall of Wheels',
    cols: 78, rows: 46, quota: 10, layout: 'factory', targetTime: 210,
    mice: { yellow: 3, red: 5, green: 4, purple: 4, black: 3, white: 1 } as Mice,
    mobs: { elite: 3, guard: 3, drone: 2 } as Mobs,
    locks: ['chasm', 'switch'],
    hint: 'Les élites de Nerat combinent charge et projectiles.',
    hintEn: 'Nerat\'s elites combine charges and projectiles.',
    tutorials: ['elite'],
  }),
  lvl({
    id: '5-2', world: 5, index: 2, name: 'Tapis Roulants', nameEn: 'Conveyor Floor',
    cols: 80, rows: 48, quota: 11, layout: 'factory', targetTime: 220,
    mice: { yellow: 3, red: 5, green: 5, purple: 4, black: 4, white: 1 } as Mice,
    mobs: { elite: 4, guard: 3, drone: 3 } as Mobs,
    locks: ['chasm', 'timed', 'switch'],
    hint: 'Les tapis roulants modifient ta trajectoire : anticipe.',
    hintEn: 'Conveyors shift your path: plan ahead.',
  }),
  lvl({
    id: '5-3', world: 5, index: 3, name: 'La Fonderie de Fondue', nameEn: 'The Fondue Foundry',
    cols: 82, rows: 48, quota: 11, layout: 'factory', targetTime: 230,
    mice: { yellow: 3, red: 5, green: 5, purple: 5, black: 4, white: 1 } as Mice,
    mobs: { elite: 4, guard: 4, drone: 3 } as Mobs,
    locks: ['chasm', 'guard', 'switch'],
    hint: 'La fondue brûle : traverse aux patins ou plane au-dessus.',
    hintEn: 'Fondue burns: skate across or glide over it.',
  }),
  lvl({
    id: '5-4', world: 5, index: 4, name: 'Les Passerelles Hautes', nameEn: 'The High Catwalks',
    cols: 82, rows: 50, quota: 12, layout: 'factory', targetTime: 245,
    mice: { yellow: 3, red: 6, green: 5, purple: 5, black: 4, white: 1 } as Mice,
    mobs: { elite: 5, guard: 4, drone: 4 } as Mobs,
    locks: ['chasm', 'ledge', 'timed', 'switch'],
    hint: 'Enchaîne grappin puis planeur pour atteindre le sommet.',
    hintEn: 'Chain grapple then glider to reach the top.',
  }),
  lvl({
    id: '5-5', world: 5, index: 5, name: 'NERAT, le Rat Noir', nameEn: 'NERAT, the Black Rat',
    cols: 46, rows: 40, quota: 1, layout: 'arena', targetTime: 240,
    mice: { white: 1 } as Mice,
    mobs: {} as Mobs,
    boss: true,
    locks: [],
    hint: 'Trois phases. Assomme, colle, puis capture au filet géant.',
    hintEn: 'Three phases. Stun, glue, then catch with the giant net.',
    tutorials: ['boss'],
  }),
];

export const WORLDS: WorldDef[] = [
  { id: 1, name: 'Jardin de la Maison', nameEn: 'Home Garden', subtitle: 'Après-midi doré', subtitleEn: 'Golden afternoon', levels: W1 },
  { id: 2, name: 'Marché de Nuit', nameEn: 'Night Market', subtitle: 'Lampions et vapeur', subtitleEn: 'Lanterns and steam', levels: W2 },
  { id: 3, name: 'Égouts & Métro', nameEn: 'Sewers & Subway', subtitle: 'Néons verdâtres', subtitleEn: 'Greenish neon', levels: W3 },
  { id: 4, name: 'Toits sous la Pluie', nameEn: 'Rooftops in the Rain', subtitle: 'Orage et enseignes', subtitleEn: 'Storm and signs', levels: W4 },
  { id: 5, name: 'Forteresse Fromagère', nameEn: 'Cheese Fortress', subtitle: 'Le repaire de Nerat', subtitleEn: 'Nerat\'s lair', levels: W5 },
];

export const ALL_LEVELS: LevelDef[] = WORLDS.flatMap((w) => w.levels);

export function getLevel(id: string): LevelDef | undefined {
  return ALL_LEVELS.find((l) => l.id === id);
}

export function nextLevelId(id: string): string | null {
  const i = ALL_LEVELS.findIndex((l) => l.id === id);
  if (i < 0 || i >= ALL_LEVELS.length - 1) return null;
  return ALL_LEVELS[i + 1].id;
}

export function worldOf(id: string): number {
  return parseInt(id.split('-')[0], 10);
}

/** Total de souris du jeu entier (pour le compteur de completion). */
export const GRAND_TOTAL_MICE = ALL_LEVELS.reduce((n, l) => n + totalMice(l), 0);
