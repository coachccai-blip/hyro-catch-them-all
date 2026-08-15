/**
 * Palettes des 5 mondes. Chaque monde a une identite chromatique forte :
 * c'est la base de la "beaute des decors" demandee par le brief.
 */

export interface WorldPalette {
  /** Ciel / fond lointain */
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  /** Silhouettes de parallaxe (du plus loin au plus proche) */
  far: string;
  mid: string;
  near: string;
  /** Sols */
  ground: string;
  groundAlt: string;
  groundDark: string;
  path: string;
  pathAlt: string;
  /** Murs / obstacles */
  wall: string;
  wallTop: string;
  wallLine: string;
  /** Liquides */
  water: string;
  waterDeep: string;
  waterFoam: string;
  /** Accents (neons, fleurs, lanternes...) */
  accent: string;
  accent2: string;
  accent3: string;
  /** Lumiere ambiante appliquee en overlay */
  ambient: string;
  ambientAlpha: number;
  /** Brume / vignette */
  fog: string;
  fogAlpha: number;
  vignette: number;
  /** Teinte des ombres portees */
  shadow: string;
  /** Direction de la lumiere (pour les ombres longues) */
  lightDir: [number, number];
  /** Couleur des contours cartoon */
  ink: string;
}

export const PALETTES: WorldPalette[] = [
  // --- Monde 1 : Jardin de la Maison, fin d'apres-midi doree ----------------
  {
    skyTop: '#8fd0ef', skyMid: '#ffe0a3', skyBottom: '#ffd08a',
    far: '#7fae6a', mid: '#5d9455', near: '#417a45',
    ground: '#6cbc55', groundAlt: '#5aa848', groundDark: '#3f7d38',
    path: '#d9b678', pathAlt: '#c7a061',
    wall: '#8a6a45', wallTop: '#a5814f', wallLine: '#5c452c',
    water: '#5fc7e0', waterDeep: '#2f93b8', waterFoam: '#d8f6ff',
    accent: '#ff8f5e', accent2: '#ffd166', accent3: '#ef6f9b',
    ambient: '#ffbe6b', ambientAlpha: 0.16,
    fog: '#ffe3b0', fogAlpha: 0.05, vignette: 0.28,
    shadow: '#2c4a2a', lightDir: [-0.55, 0.83], ink: '#2b2118',
  },
  // --- Monde 2 : Marche de Nuit ---------------------------------------------
  {
    skyTop: '#150d33', skyMid: '#2d1a52', skyBottom: '#5b2b5e',
    far: '#241645', mid: '#33204f', near: '#3d2652',
    ground: '#574c66', groundAlt: '#4b4157', groundDark: '#312a3c',
    path: '#5a4f66', pathAlt: '#6b5c76',
    wall: '#4a3350', wallTop: '#63446a', wallLine: '#241633',
    water: '#3f5f8f', waterDeep: '#22375c', waterFoam: '#a9d8ff',
    accent: '#ffb03b', accent2: '#ff5f7e', accent3: '#4be0d0',
    ambient: '#4a3a80', ambientAlpha: 0.3,
    fog: '#5a3d7a', fogAlpha: 0.1, vignette: 0.44,
    shadow: '#120a22', lightDir: [-0.3, 0.95], ink: '#180f26',
  },
  // --- Monde 3 : Egouts & Metro abandonne -----------------------------------
  {
    skyTop: '#0a1512', skyMid: '#0d1c18', skyBottom: '#11241e',
    far: '#132a24', mid: '#17332b', near: '#1c3d33',
    ground: '#4d5750', groundAlt: '#434b46', groundDark: '#2b322e',
    path: '#5c665e', pathAlt: '#6a746b',
    wall: '#2e3a35', wallTop: '#3d4a44', wallLine: '#141b18',
    water: '#2f6a52', waterDeep: '#1a4335', waterFoam: '#8ff0c0',
    accent: '#5cf2a0', accent2: '#8be04b', accent3: '#ff7a4d',
    ambient: '#2a7a5e', ambientAlpha: 0.3,
    fog: '#7fd9b0', fogAlpha: 0.11, vignette: 0.44,
    shadow: '#050a08', lightDir: [-0.2, 0.98], ink: '#0c110f',
  },
  // --- Monde 4 : Toits de la ville sous la pluie -----------------------------
  {
    skyTop: '#111a33', skyMid: '#1c2a4d', skyBottom: '#31456e',
    far: '#22304f', mid: '#2b3a5c', near: '#354669',
    ground: '#46506b', groundAlt: '#3d4660', groundDark: '#2a3247',
    path: '#59617a', pathAlt: '#666f88',
    wall: '#39415c', wallTop: '#4b5473', wallLine: '#1c2136',
    water: '#4b6f9e', waterDeep: '#2b4568', waterFoam: '#cfe6ff',
    accent: '#ff4d8d', accent2: '#43d9ff', accent3: '#ffd84d',
    ambient: '#3a4f85', ambientAlpha: 0.3,
    fog: '#8fa8cc', fogAlpha: 0.12, vignette: 0.48,
    shadow: '#0d1322', lightDir: [-0.35, 0.94], ink: '#141a2b',
  },
  // --- Monde 5 : Forteresse Fromagere de Nerat -------------------------------
  {
    skyTop: '#1a0d12', skyMid: '#2c1414', skyBottom: '#48200f',
    far: '#2a1a20', mid: '#382026', near: '#46282a',
    ground: '#584b46', groundAlt: '#4c403c', groundDark: '#332b29',
    path: '#6b5a4a', pathAlt: '#7d6a55',
    wall: '#463a3c', wallTop: '#5b4a4a', wallLine: '#1f1719',
    water: '#ff9b2f', waterDeep: '#d85a12', waterFoam: '#ffe08a',
    accent: '#ffc93c', accent2: '#ff6a2b', accent3: '#b9e34a',
    ambient: '#7a3a1c', ambientAlpha: 0.28,
    fog: '#c76b2a', fogAlpha: 0.1, vignette: 0.55,
    shadow: '#140b0a', lightDir: [-0.25, 0.97], ink: '#170f10',
  },
];

/** Couleurs des bandanas de souris (identite + accessibilite). */
export const BANDANA_COLORS: Record<string, string> = {
  yellow: '#ffd23f',
  blue: '#4aa8ff',
  red: '#f4483c',
  green: '#48d96a',
  purple: '#b768e8',
  black: '#3a3550',
  white: '#f6f2e8',
};

/** Symbole distinct par bandana : lisible meme en cas de daltonisme. */
export const BANDANA_SYMBOLS: Record<string, string> = {
  yellow: '▲',
  blue: '●',
  red: '✚',
  green: '◆',
  purple: '★',
  black: '☾',
  white: '✦',
};

export function paletteFor(worldId: number): WorldPalette {
  return PALETTES[Math.max(0, Math.min(PALETTES.length - 1, worldId - 1))];
}
