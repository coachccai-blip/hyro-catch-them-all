/**
 * Generateur de niveaux semi-ouverts.
 *
 * A partir du seed d'un `LevelDef`, on produit une carte deterministe :
 * salles + couloirs, features propres au theme (eau, gouffres, passerelles,
 * fondue...), zones verrouillees par gadget, decors, souris et mobs.
 */

import { Rng } from '../core/rng';
import { clamp, type Vec2 } from '../core/math';
import {
  CELL, TERR, isWalkable,
  type LevelDef, type LockKind, type MobKind, type MouseKind, type Terrain,
} from './types';

export interface Prop {
  kind: string;
  x: number;
  y: number;
  s: number;
  rot: number;
  seed: number;
  blocking: boolean;
  r: number;
  /** Cachette possible pour les souris. */
  hide: boolean;
  /** flat = cuit dans le sol, sorted = trie avec les entites, fore = premier plan. */
  layer: 'flat' | 'sorted' | 'fore';
  anim: boolean;
}

export interface Decal {
  kind: string;
  x: number;
  y: number;
  rot: number;
  s: number;
  seed: number;
}

export interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
  intensity: number;
  flicker: number;
}

export interface Barrier {
  id: number;
  lock: LockKind;
  /** Rectangle en pixels monde. */
  x: number;
  y: number;
  w: number;
  h: number;
  cells: number[];
  open: boolean;
  /** Rectangle de la salle protegee, en pixels monde. */
  room: { x: number; y: number; w: number; h: number };
  /** Chrono d'ouverture (verrou 'timed'). */
  timer: number;
  switchPos?: Vec2;
  buttonPos?: Vec2;
  guardPos?: Vec2;
  guardLured?: boolean;
}

export interface RoomRect {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  locked?: LockKind;
  isSpawn?: boolean;
}

export interface MouseSpawn {
  id: string;
  kind: MouseKind;
  x: number;
  y: number;
  locked: boolean;
  /** Position de cachette associee (buisson, trou). */
  hideAt?: Vec2;
  /** La souris vit sur une structure surelevee (accessible en sautant). */
  perched?: boolean;
}

export interface MobSpawn {
  kind: MobKind;
  x: number;
  y: number;
  guardBarrier?: number;
}

export interface GeneratedLevel {
  def: LevelDef;
  cols: number;
  rows: number;
  w: number;
  h: number;
  grid: Uint8Array;
  rooms: RoomRect[];
  props: Prop[];
  decals: Decal[];
  lights: Light[];
  barriers: Barrier[];
  mice: MouseSpawn[];
  mobs: MobSpawn[];
  spawn: Vec2;
  /** Points d'ancrage du grappin (bords de passerelle, poutres). */
  anchors: Vec2[];
  /** Cachettes utilisables par les souris. */
  hideSpots: Vec2[];
  seed: number;
}

// --- Catalogues de props par theme ------------------------------------------

interface PropSpec {
  kind: string;
  weight: number;
  blocking?: boolean;
  r?: number;
  hide?: boolean;
  layer?: 'flat' | 'sorted' | 'fore';
  anim?: boolean;
  sMin?: number;
  sMax?: number;
  /** Preference de placement : 'open' au milieu, 'wall' contre un mur, 'edge' en bordure. */
  place?: 'open' | 'wall' | 'any';
}

const PROP_SETS: Record<string, PropSpec[]> = {
  garden: [
    { kind: 'grassTuft', weight: 30, layer: 'sorted', anim: true, sMin: 0.7, sMax: 1.3 },
    { kind: 'daisy', weight: 16, layer: 'flat', sMin: 0.7, sMax: 1.1 },
    { kind: 'stone', weight: 9, layer: 'flat', sMin: 0.6, sMax: 1.2 },
    { kind: 'bush', weight: 12, blocking: true, r: 26, hide: true, layer: 'sorted', anim: true, sMin: 0.9, sMax: 1.5 },
    { kind: 'pot', weight: 7, blocking: true, r: 22, layer: 'sorted', place: 'wall' },
    { kind: 'mushroom', weight: 7, layer: 'sorted', sMin: 0.6, sMax: 1.1 },
    { kind: 'gnome', weight: 2, blocking: true, r: 18, layer: 'sorted', place: 'wall' },
    { kind: 'fence', weight: 5, blocking: true, r: 20, layer: 'sorted', place: 'wall' },
    { kind: 'wateringCan', weight: 2, blocking: true, r: 18, layer: 'sorted', place: 'wall' },
    { kind: 'wheelbarrow', weight: 1.4, blocking: true, r: 30, layer: 'sorted', place: 'wall' },
    { kind: 'logs', weight: 2.4, blocking: true, r: 26, hide: true, layer: 'sorted', place: 'wall' },
    { kind: 'hose', weight: 2, layer: 'flat', sMin: 1, sMax: 1.6 },
    { kind: 'birdbath', weight: 1.2, blocking: true, r: 24, layer: 'sorted' },
    { kind: 'tree', weight: 2.6, blocking: true, r: 34, layer: 'fore', anim: true, sMin: 1.1, sMax: 1.7, place: 'wall' },
  ],
  market: [
    { kind: 'crate', weight: 16, blocking: true, r: 24, hide: true, layer: 'sorted' },
    { kind: 'barrel', weight: 10, blocking: true, r: 22, hide: true, layer: 'sorted' },
    { kind: 'stall', weight: 8, blocking: true, r: 46, layer: 'sorted', place: 'wall', sMin: 1, sMax: 1.35 },
    { kind: 'lantern', weight: 12, blocking: false, layer: 'fore', anim: true, sMin: 0.9, sMax: 1.4 },
    { kind: 'basket', weight: 10, blocking: true, r: 18, hide: true, layer: 'sorted' },
    { kind: 'sack', weight: 8, blocking: true, r: 20, layer: 'sorted' },
    { kind: 'sign', weight: 5, blocking: true, r: 14, layer: 'sorted', place: 'wall' },
    { kind: 'umbrella', weight: 4, blocking: true, r: 26, layer: 'fore', anim: true },
    { kind: 'steamVent', weight: 5, layer: 'flat', anim: true },
    { kind: 'puddle', weight: 9, layer: 'flat', sMin: 0.8, sMax: 1.8 },
    { kind: 'cart', weight: 3, blocking: true, r: 34, layer: 'sorted', place: 'wall' },
    { kind: 'garland', weight: 6, layer: 'fore', anim: true, place: 'any' },
    { kind: 'melon', weight: 5, layer: 'flat', sMin: 0.7, sMax: 1.1 },
  ],
  sewer: [
    { kind: 'pipe', weight: 12, blocking: true, r: 24, layer: 'sorted', place: 'wall' },
    { kind: 'valve', weight: 5, blocking: true, r: 18, layer: 'sorted', place: 'wall' },
    { kind: 'sleeper', weight: 14, layer: 'flat', sMin: 0.9, sMax: 1.1 },
    { kind: 'grate', weight: 8, layer: 'flat', hide: true },
    { kind: 'moss', weight: 16, layer: 'flat', sMin: 0.7, sMax: 1.5 },
    { kind: 'neonTube', weight: 9, layer: 'fore', anim: true },
    { kind: 'barrelRust', weight: 9, blocking: true, r: 22, hide: true, layer: 'sorted' },
    { kind: 'wagon', weight: 2, blocking: true, r: 60, layer: 'sorted', place: 'wall', sMin: 1.1, sMax: 1.5 },
    { kind: 'trashPile', weight: 8, blocking: true, r: 24, hide: true, layer: 'sorted' },
    { kind: 'cable', weight: 8, layer: 'fore' },
    { kind: 'drip', weight: 9, layer: 'fore', anim: true },
    { kind: 'brokenTile', weight: 12, layer: 'flat' },
    { kind: 'puddle', weight: 10, layer: 'flat', sMin: 0.9, sMax: 1.9 },
  ],
  rooftop: [
    { kind: 'chimney', weight: 10, blocking: true, r: 28, layer: 'sorted', anim: true },
    { kind: 'antenna', weight: 8, layer: 'fore', anim: true },
    { kind: 'acUnit', weight: 9, blocking: true, r: 26, hide: true, layer: 'sorted' },
    { kind: 'waterTank', weight: 4, blocking: true, r: 34, layer: 'sorted' },
    { kind: 'laundry', weight: 7, layer: 'fore', anim: true },
    { kind: 'neonSign', weight: 6, blocking: true, r: 22, layer: 'sorted', anim: true, place: 'wall' },
    { kind: 'dish', weight: 5, blocking: true, r: 20, layer: 'sorted' },
    { kind: 'skylight', weight: 6, layer: 'flat', anim: true },
    { kind: 'ventRoof', weight: 9, blocking: true, r: 18, hide: true, layer: 'sorted' },
    { kind: 'crateRoof', weight: 9, blocking: true, r: 22, hide: true, layer: 'sorted' },
    { kind: 'puddle', weight: 14, layer: 'flat', sMin: 0.9, sMax: 2 },
    { kind: 'pipeRoof', weight: 8, layer: 'flat' },
    { kind: 'tarPatch', weight: 10, layer: 'flat', sMin: 1, sMax: 2 },
  ],
  factory: [
    { kind: 'cheeseWheel', weight: 12, blocking: true, r: 30, layer: 'sorted', sMin: 0.9, sMax: 1.6 },
    { kind: 'gear', weight: 7, blocking: true, r: 30, layer: 'sorted', anim: true },
    { kind: 'pipeSteam', weight: 9, blocking: true, r: 22, layer: 'sorted', anim: true, place: 'wall' },
    { kind: 'pillar', weight: 6, blocking: true, r: 30, layer: 'sorted', place: 'wall' },
    { kind: 'banner', weight: 5, layer: 'fore', anim: true, place: 'wall' },
    { kind: 'vat', weight: 4, blocking: true, r: 34, layer: 'sorted', anim: true },
    { kind: 'chain', weight: 7, layer: 'fore', anim: true },
    { kind: 'crateCheese', weight: 11, blocking: true, r: 22, hide: true, layer: 'sorted' },
    { kind: 'lampIndus', weight: 8, layer: 'fore', anim: true },
    { kind: 'rivetPlate', weight: 14, layer: 'flat' },
    { kind: 'furnace', weight: 3, blocking: true, r: 32, layer: 'sorted', anim: true, place: 'wall' },
    { kind: 'boltPile', weight: 8, layer: 'flat' },
  ],
  arena: [
    { kind: 'pillar', weight: 10, blocking: true, r: 30, layer: 'sorted' },
    { kind: 'cheeseWheel', weight: 6, blocking: true, r: 30, layer: 'sorted' },
    { kind: 'lampIndus', weight: 10, layer: 'fore', anim: true },
    { kind: 'banner', weight: 8, layer: 'fore', anim: true },
    { kind: 'rivetPlate', weight: 12, layer: 'flat' },
    { kind: 'chain', weight: 8, layer: 'fore', anim: true },
  ],
};

const LIGHT_PROPS: Record<string, { r: number; color: string; intensity: number; flicker: number; dy: number }> = {
  lantern: { r: 190, color: '#ffb03b', intensity: 0.85, flicker: 0.12, dy: -34 },
  neonTube: { r: 210, color: '#5cf2a0', intensity: 0.75, flicker: 0.55, dy: -30 },
  neonSign: { r: 230, color: '#ff4d8d', intensity: 0.8, flicker: 0.35, dy: -26 },
  skylight: { r: 150, color: '#ffd84d', intensity: 0.45, flicker: 0.05, dy: 0 },
  lampIndus: { r: 220, color: '#ffc93c', intensity: 0.8, flicker: 0.18, dy: -30 },
  furnace: { r: 260, color: '#ff6a2b', intensity: 0.95, flicker: 0.3, dy: -10 },
  steamVent: { r: 90, color: '#ffd9a0', intensity: 0.25, flicker: 0.1, dy: 0 },
  vat: { r: 170, color: '#ffc93c', intensity: 0.6, flicker: 0.15, dy: -10 },
};

// ---------------------------------------------------------------------------

export function generateLevel(def: LevelDef): GeneratedLevel {
  const rng = new Rng(def.seed);
  const cols = def.cols;
  const rows = def.rows;
  const grid = new Uint8Array(cols * rows);
  const idx = (cx: number, cy: number) => cy * cols + cx;

  const solid = def.layout === 'rooftop' ? TERR.VOID : TERR.WALL;
  grid.fill(solid);

  const rooms: RoomRect[] = [];

  if (def.layout === 'arena') {
    buildArena(grid, cols, rows, rooms);
  } else {
    buildRooms(grid, cols, rows, rooms, rng, def, solid);
  }

  // --- Features de theme ----------------------------------------------------
  applyThemeFeatures(grid, cols, rows, rooms, rng, def);
  ensureLedges(grid, cols, rows, rooms, rng);

  // --- Salle de depart ------------------------------------------------------
  rooms[0].isSpawn = true;
  // Le centre geometrique d'une salle peut avoir ete recouvert (eau, gouffre,
  // mur d'une salle voisine) : on cherche la cellule praticable la plus proche.
  let spawnCell = findWalkableNear(grid, cols, rows, rooms[0].cx, rooms[0].cy, 10);
  if (!spawnCell) {
    for (const r of rooms) {
      spawnCell = findWalkableNear(grid, cols, rows, r.cx, r.cy, 10);
      if (spawnCell) {
        rooms[0].isSpawn = false;
        r.isSpawn = true;
        break;
      }
    }
  }
  if (!spawnCell) spawnCell = { cx: Math.floor(cols / 2), cy: Math.floor(rows / 2) };
  const spawn: Vec2 = { x: (spawnCell.cx + 0.5) * CELL, y: (spawnCell.cy + 0.5) * CELL };

  // --- Zones verrouillees ---------------------------------------------------
  const barriers: Barrier[] = [];
  const lockedRooms: RoomRect[] = [];
  let barrierId = 0;
  const candidates = rooms
    .slice(1)
    .map((r) => ({ r, d: Math.hypot(r.cx - rooms[0].cx, r.cy - rooms[0].cy) }))
    .sort((a, b) => b.d - a.d)
    .map((o) => o.r);

  for (const lock of def.locks) {
    const room = candidates.find((r) => !r.locked);
    if (!room) break;
    room.locked = lock;
    lockedRooms.push(room);
    const b = sealRoom(grid, cols, rows, room, lock, rng, barrierId++, solid);
    if (b) barriers.push(b);
  }

  // --- Connectivite ---------------------------------------------------------
  // On supprime toute poche isolee, puis on memorise les cellules réellement
  // atteignables depuis le depart (barrieres considerees comme ouvrables) :
  // souris et mobs ne seront places que la, ce qui garantit le 100 %.
  ensureConnectivity(grid, cols, rows, spawnCell, barriers, solid);
  // Flood « strict » : sans traverser eau ni gouffre. C'est la garantie qu'une
  // souris est toujours attrapable, meme sans le gadget correspondant.
  const reachable = floodFill(grid, cols, rows, spawnCell, barriers, false);

  // --- Ancrages de grappin et cachettes ------------------------------------
  const anchors: Vec2[] = [];
  const hideSpots: Vec2[] = [];

  // --- Decors ---------------------------------------------------------------
  const props: Prop[] = [];
  const decals: Decal[] = [];
  const lights: Light[] = [];
  scatterProps(grid, cols, rows, rooms, rng, def, props, decals, lights, hideSpots);
  addNarrativeDecals(grid, cols, rows, rng, def, decals, props, lockedRooms);

  // Ancrages : bords des cellules LEDGE/WATER/GAP accessibles
  for (let cy = 1; cy < rows - 1; cy++) {
    for (let cx = 1; cx < cols - 1; cx++) {
      const t = grid[idx(cx, cy)];
      if (t !== TERR.LEDGE) continue;
      if (isWalkable(grid[idx(cx, cy - 1)]) || isWalkable(grid[idx(cx, cy + 1)])) {
        anchors.push({ x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL });
      }
    }
  }

  // --- Souris ---------------------------------------------------------------
  const mice = placeMice(grid, cols, rows, rooms, lockedRooms, rng, def, hideSpots, reachable, spawn);
  const mobs = placeMobs(grid, cols, rows, rooms, rng, def, barriers, reachable);

  return {
    def, cols, rows, w: cols * CELL, h: rows * CELL,
    grid, rooms, props, decals, lights, barriers, mice, mobs, spawn,
    anchors, hideSpots, seed: def.seed,
  };
}

// --- Construction de la carte ----------------------------------------------

function buildRooms(
  grid: Uint8Array, cols: number, rows: number, rooms: RoomRect[],
  rng: Rng, def: LevelDef, solid: Terrain,
) {
  const idx = (cx: number, cy: number) => cy * cols + cx;
  // Grille de placement : on decoupe la carte en cases et on pose une salle
  // dans la plupart d'entre elles, avec du jitter → aspect organique.
  // Les salles sont volontairement plus grandes que leur case : elles se
  // chevauchent, ce qui produit de vastes zones ouvertes reliees entre elles
  // (semi-ouvert) plutot qu'un labyrinthe de petites pieces.
  const gx = Math.max(3, Math.round(cols / 15));
  const gy = Math.max(3, Math.round(rows / 12));
  const cw = cols / gx;
  const ch = rows / gy;
  const cellsList: { i: number; j: number }[] = [];
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) cellsList.push({ i, j });
  rng.shuffle(cellsList);
  const keep = Math.max(6, Math.floor(cellsList.length * 0.92));

  for (let k = 0; k < keep; k++) {
    const { i, j } = cellsList[k];
    const w = Math.round(rng.range(cw * 0.72, cw * 1.16));
    const h = Math.round(rng.range(ch * 0.72, ch * 1.16));
    const ccx = (i + 0.5) * cw + rng.range(-cw * 0.16, cw * 0.16);
    const ccy = (j + 0.5) * ch + rng.range(-ch * 0.16, ch * 0.16);
    const rx = clamp(Math.round(ccx - w / 2), 2, Math.max(2, cols - w - 3));
    const ry = clamp(Math.round(ccy - h / 2), 2, Math.max(2, rows - h - 3));
    const room: RoomRect = { x: rx, y: ry, w, h, cx: Math.floor(rx + w / 2), cy: Math.floor(ry + h / 2) };
    carveRoom(grid, cols, rows, room, rng, def);
    rooms.push(room);
  }

  // Connexions : chaque salle rejoint la plus proche non encore reliee (MST simple)
  const connected = [0];
  const pending = rooms.map((_, i) => i).slice(1);
  while (pending.length) {
    let best = { a: 0, b: 0, d: Infinity, pi: 0 };
    for (let p = 0; p < pending.length; p++) {
      const b = pending[p];
      for (const a of connected) {
        const d = Math.hypot(rooms[a].cx - rooms[b].cx, rooms[a].cy - rooms[b].cy);
        if (d < best.d) best = { a, b, d, pi: p };
      }
    }
    carveCorridor(grid, cols, rows, rooms[best.a], rooms[best.b], rng, def);
    connected.push(best.b);
    pending.splice(best.pi, 1);
  }
  // Quelques boucles supplementaires pour un vrai semi-ouvert
  const extra = Math.max(2, Math.floor(rooms.length * 0.35));
  for (let i = 0; i < extra; i++) {
    const a = rng.int(0, rooms.length - 1);
    const b = rng.int(0, rooms.length - 1);
    if (a !== b) carveCorridor(grid, cols, rows, rooms[a], rooms[b], rng, def);
  }

  // Bordure solide
  for (let cx = 0; cx < cols; cx++) {
    grid[idx(cx, 0)] = solid;
    grid[idx(cx, 1)] = solid;
    grid[idx(cx, rows - 1)] = solid;
    grid[idx(cx, rows - 2)] = solid;
  }
  for (let cy = 0; cy < rows; cy++) {
    grid[idx(0, cy)] = solid;
    grid[idx(1, cy)] = solid;
    grid[idx(cols - 1, cy)] = solid;
    grid[idx(cols - 2, cy)] = solid;
  }
}

function carveRoom(grid: Uint8Array, cols: number, rows: number, r: RoomRect, rng: Rng, def: LevelDef) {
  const idx = (cx: number, cy: number) => cy * cols + cx;
  const round = def.layout === 'garden' || def.layout === 'sewer';
  const base = def.layout === 'market' || def.layout === 'factory' ? TERR.PATH : TERR.GROUND;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (x < 2 || y < 2 || x >= cols - 2 || y >= rows - 2) continue;
      if (round) {
        // Coins arrondis : on retire les angles pour une silhouette organique
        const nx = (x - r.x) / (r.w - 1) * 2 - 1;
        const ny = (y - r.y) / (r.h - 1) * 2 - 1;
        if (nx * nx + ny * ny > 1.45 + rng.range(-0.12, 0.12)) continue;
      }
      grid[idx(x, y)] = base;
    }
  }
}

function carveCorridor(grid: Uint8Array, cols: number, rows: number, a: RoomRect, b: RoomRect, rng: Rng, def: LevelDef) {
  const idx = (cx: number, cy: number) => cy * cols + cx;
  const width = def.layout === 'sewer' ? rng.int(2, 3) : rng.int(3, 4);
  const t = def.layout === 'garden' ? TERR.PATH : TERR.PATH;
  const horizFirst = rng.bool();
  const paint = (x: number, y: number) => {
    for (let dy = 0; dy < width; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const px = x + dx - (width >> 1);
        const py = y + dy - (width >> 1);
        if (px < 2 || py < 2 || px >= cols - 2 || py >= rows - 2) continue;
        const cur = grid[idx(px, py)];
        if (cur === TERR.GROUND || cur === TERR.PATH) continue;
        grid[idx(px, py)] = t;
      }
    }
  };
  let x = a.cx;
  let y = a.cy;
  if (horizFirst) {
    while (x !== b.cx) { x += Math.sign(b.cx - x); paint(x, y); }
    while (y !== b.cy) { y += Math.sign(b.cy - y); paint(x, y); }
  } else {
    while (y !== b.cy) { y += Math.sign(b.cy - y); paint(x, y); }
    while (x !== b.cx) { x += Math.sign(b.cx - x); paint(x, y); }
  }
}

function buildArena(grid: Uint8Array, cols: number, rows: number, rooms: RoomRect[]) {
  const idx = (cx: number, cy: number) => cy * cols + cx;
  const ccx = cols / 2;
  const ccy = rows / 2;
  const R = Math.min(cols, rows) / 2 - 3;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.hypot(x - ccx + 0.5, y - ccy + 0.5);
      if (d < R) grid[idx(x, y)] = TERR.PATH;
      else if (d < R + 1.5) grid[idx(x, y)] = TERR.WALL;
    }
  }
  // Passerelles hautes (phase 2 du boss) : quatre plateformes cardinales
  for (const [ox, oy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    const px = Math.round(ccx + ox * (R - 5));
    const py = Math.round(ccy + oy * (R - 5));
    for (let y = py - 2; y <= py + 2; y++) {
      for (let x = px - 2; x <= px + 2; x++) {
        if (x > 1 && y > 1 && x < cols - 2 && y < rows - 2) grid[idx(x, y)] = TERR.LEDGE;
      }
    }
  }
  rooms.push({ x: Math.floor(ccx - R * 0.4), y: Math.floor(ccy + R * 0.35), w: 6, h: 5, cx: Math.floor(ccx), cy: Math.floor(ccy + R * 0.55) });
  rooms.push({ x: Math.floor(ccx - 4), y: Math.floor(ccy - 4), w: 8, h: 8, cx: Math.floor(ccx), cy: Math.floor(ccy) });
}

/**
 * Garantit un minimum de structures surelevees : le saut doit toujours avoir
 * quelque chose a escalader, dans tous les mondes.
 */
function ensureLedges(
  grid: Uint8Array, cols: number, rows: number, rooms: RoomRect[], rng: Rng,
) {
  const idx = (cx: number, cy: number) => cy * cols + cx;
  let count = 0;
  for (const t of grid) if (t === TERR.LEDGE) count++;
  const target = Math.floor(cols * rows * 0.03);
  let guard = 0;
  while (count < target && guard++ < 120) {
    const r = rng.pick(rooms);
    const cx = r.cx + rng.int(-4, 4);
    const cy = r.cy + rng.int(-3, 3);
    const rad = rng.range(1.8, 2.6);
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) {
      for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        if (x < 2 || y < 2 || x >= cols - 2 || y >= rows - 2) continue;
        if (Math.hypot(x - cx, y - cy) / rad > 0.8) continue;
        if (!isWalkable(grid[idx(x, y)])) continue;
        grid[idx(x, y)] = TERR.LEDGE;
        count++;
      }
    }
  }
}

/** Ajoute eau, gouffres, herbes hautes, passerelles, fondue selon le theme. */
function applyThemeFeatures(
  grid: Uint8Array, cols: number, rows: number, rooms: RoomRect[], rng: Rng, def: LevelDef,
) {
  const idx = (cx: number, cy: number) => cy * cols + cx;
  const stampBlob = (cx: number, cy: number, r: number, t: Terrain, onlyWalkable = true) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (x < 2 || y < 2 || x >= cols - 2 || y >= rows - 2) continue;
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d > 0.75 + rng.range(-0.2, 0.25)) continue;
        if (onlyWalkable && !isWalkable(grid[idx(x, y)])) continue;
        grid[idx(x, y)] = t;
      }
    }
  };

  switch (def.layout) {
    case 'garden': {
      // Massifs d'herbes hautes (cachettes) et mare
      const tufts = 5 + Math.floor(def.world * 1.5);
      for (let i = 0; i < tufts; i++) {
        const r = rng.pick(rooms);
        stampBlob(r.cx + rng.int(-4, 4), r.cy + rng.int(-3, 3), rng.range(2, 4.5), TERR.GRASS);
      }
      if (def.index >= 2) {
        const r = rng.pick(rooms.slice(1));
        stampBlob(r.cx, r.cy, rng.range(2.5, 4), TERR.WATER);
      }
      // Trous de taupe = petits gouffres
      for (let i = 0; i < def.index; i++) {
        const r = rng.pick(rooms.slice(1));
        stampBlob(r.cx + rng.int(-3, 3), r.cy + rng.int(-2, 2), rng.range(1.2, 2), TERR.GAP);
      }
      // Murets, table de jardin, gros rochers plats : de la verticalite
      for (let i = 0; i < 3 + def.index; i++) {
        const r = rng.pick(rooms);
        stampBlob(r.cx + rng.int(-4, 4), r.cy + rng.int(-3, 3), rng.range(1.3, 2.4), TERR.LEDGE);
      }
      break;
    }
    case 'market': {
      // Flaques praticables (visuelles) + quelques toits d'etals (LEDGE)
      for (let i = 0; i < 4 + def.index; i++) {
        const r = rng.pick(rooms);
        const px = r.x + rng.int(0, Math.max(0, r.w - 4));
        const py = r.y + rng.int(0, Math.max(0, r.h - 4));
        for (let y = py; y < py + rng.int(2, 4); y++) {
          for (let x = px; x < px + rng.int(2, 4); x++) {
            if (x < 2 || y < 2 || x >= cols - 2 || y >= rows - 2) continue;
            if (isWalkable(grid[idx(x, y)])) grid[idx(x, y)] = TERR.LEDGE;
          }
        }
      }
      if (def.index >= 3) {
        const r = rng.pick(rooms.slice(1));
        stampBlob(r.cx, r.cy, rng.range(2.5, 4.5), TERR.WATER);
      }
      break;
    }
    case 'sewer': {
      // Canal central + zones glissantes
      const cy = Math.floor(rows / 2) + rng.int(-3, 3);
      for (let x = 3; x < cols - 3; x++) {
        if (rng.bool(0.82)) {
          for (let y = cy - 1; y <= cy + 1; y++) {
            if (isWalkable(grid[idx(x, y)])) grid[idx(x, y)] = TERR.WATER;
          }
        }
      }
      for (let i = 0; i < 3 + def.index; i++) {
        const r = rng.pick(rooms);
        stampBlob(r.cx + rng.int(-3, 3), r.cy + rng.int(-2, 2), rng.range(1.5, 3), TERR.SLICK);
      }
      for (let i = 0; i < 2 + def.index; i++) {
        const r = rng.pick(rooms.slice(1));
        stampBlob(r.cx, r.cy, rng.range(1.5, 2.5), TERR.LEDGE);
      }
      break;
    }
    case 'rooftop': {
      // Les toits sont des ilots : on creuse des vides entre certaines salles
      for (let i = 0; i < 6 + def.index * 2; i++) {
        const r = rng.pick(rooms);
        stampBlob(r.cx + rng.int(-6, 6), r.cy + rng.int(-4, 4), rng.range(1.2, 2.4), TERR.GAP);
      }
      for (let i = 0; i < 3 + def.index; i++) {
        const r = rng.pick(rooms.slice(1));
        stampBlob(r.cx, r.cy, rng.range(1.5, 3), TERR.LEDGE);
      }
      // Flaques : rendues visuellement, terrain praticable
      break;
    }
    case 'factory': {
      for (let i = 0; i < 3 + def.index; i++) {
        const r = rng.pick(rooms.slice(1));
        stampBlob(r.cx + rng.int(-3, 3), r.cy + rng.int(-2, 2), rng.range(1.6, 3.2), TERR.HAZARD);
      }
      for (let i = 0; i < 4 + def.index; i++) {
        const r = rng.pick(rooms);
        stampBlob(r.cx + rng.int(-4, 4), r.cy + rng.int(-3, 3), rng.range(1.5, 3), TERR.SLICK);
      }
      for (let i = 0; i < 3 + def.index; i++) {
        const r = rng.pick(rooms.slice(1));
        stampBlob(r.cx, r.cy, rng.range(1.8, 3), TERR.LEDGE);
      }
      for (let i = 0; i < 2 + def.index; i++) {
        const r = rng.pick(rooms.slice(1));
        stampBlob(r.cx + rng.int(-5, 5), r.cy + rng.int(-3, 3), rng.range(1.2, 2), TERR.GAP);
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Isole une salle derriere un verrou : on mure tout son perimetre puis on
 * ouvre une unique breche occupee par la barriere.
 */
function sealRoom(
  grid: Uint8Array, cols: number, rows: number, room: RoomRect,
  lock: LockKind, rng: Rng, id: number, solid: Terrain,
): Barrier | null {
  const idx = (cx: number, cy: number) => cy * cols + cx;
  const x0 = room.x - 1;
  const y0 = room.y - 1;
  const x1 = room.x + room.w;
  const y1 = room.y + room.h;

  // 1) On mure le perimetre
  const perimeter: { x: number; y: number }[] = [];
  for (let x = x0; x <= x1; x++) {
    perimeter.push({ x, y: y0 }, { x, y: y1 });
  }
  for (let y = y0 + 1; y < y1; y++) {
    perimeter.push({ x: x0, y }, { x: x1, y });
  }
  for (const p of perimeter) {
    if (p.x < 2 || p.y < 2 || p.x >= cols - 2 || p.y >= rows - 2) continue;
    grid[idx(p.x, p.y)] = solid === TERR.VOID ? TERR.WALL : solid;
  }

  // 2) Choix d'une breche : un cote qui touche une zone praticable
  const sides = rng.shuffle([0, 1, 2, 3]);
  for (const side of sides) {
    let bx = 0;
    let by = 0;
    let dx = 0;
    let dy = 0;
    if (side === 0) { bx = room.x + Math.floor(room.w / 2); by = y0; dy = -1; }
    else if (side === 1) { bx = room.x + Math.floor(room.w / 2); by = y1; dy = 1; }
    else if (side === 2) { bx = x0; by = room.y + Math.floor(room.h / 2); dx = -1; }
    else { bx = x1; by = room.y + Math.floor(room.h / 2); dx = 1; }
    if (bx < 3 || by < 3 || bx >= cols - 3 || by >= rows - 3) continue;

    // La zone au-dela doit etre praticable a moins de 6 cases
    let reach = -1;
    for (let k = 1; k <= 7; k++) {
      const tx = bx + dx * k;
      const ty = by + dy * k;
      if (tx < 2 || ty < 2 || tx >= cols - 2 || ty >= rows - 2) break;
      if (isWalkable(grid[idx(tx, ty)])) { reach = k; break; }
    }
    if (reach < 0) continue;

    // 3) Creusement du tunnel + pose de la barriere
    const cells: number[] = [];
    const thickness = lock === 'chasm' ? 4 : lock === 'gap' ? 2 : 1;
    const wide = 3;
    for (let k = 0; k <= reach; k++) {
      for (let s = -(wide >> 1); s <= wide >> 1; s++) {
        const tx = bx + dx * k + (dx === 0 ? s : 0);
        const ty = by + dy * k + (dy === 0 ? s : 0);
        if (tx < 2 || ty < 2 || tx >= cols - 2 || ty >= rows - 2) continue;
        const isBarrier = k < thickness;
        if (isBarrier) {
          if (lock === 'gap' || lock === 'chasm') grid[idx(tx, ty)] = TERR.GAP;
          else if (lock === 'ledge') grid[idx(tx, ty)] = TERR.LEDGE;
          else grid[idx(tx, ty)] = TERR.WALL;
          cells.push(idx(tx, ty));
        } else {
          grid[idx(tx, ty)] = TERR.PATH;
        }
      }
    }

    const px = (bx + dx * (thickness - 1) * 0.5 + 0.5) * CELL;
    const py = (by + dy * (thickness - 1) * 0.5 + 0.5) * CELL;
    const bw = (dx !== 0 ? thickness : wide) * CELL;
    const bh = (dy !== 0 ? thickness : wide) * CELL;

    const barrier: Barrier = {
      id, lock, x: px - bw / 2, y: py - bh / 2, w: bw, h: bh,
      cells, open: lock === 'gap' || lock === 'chasm' || lock === 'ledge', timer: 0,
      room: { x: room.x * CELL, y: room.y * CELL, w: room.w * CELL, h: room.h * CELL },
    };

    // Elements associes au verrou
    if (lock === 'switch') {
      barrier.switchPos = { x: px - dx * CELL * 9 + rng.range(-90, 90), y: py - dy * CELL * 9 + rng.range(-90, 90) };
      barrier.open = false;
    } else if (lock === 'timed') {
      barrier.buttonPos = { x: px - dx * CELL * 11, y: py - dy * CELL * 11 };
      barrier.open = false;
    } else if (lock === 'guard') {
      // Le rat de garde se tient du cote ACCESSIBLE de la porte (sinon le
      // leurre ne pourrait jamais l'atteindre).
      barrier.guardPos = { x: px + dx * CELL * 1.8, y: py + dy * CELL * 1.8 };
      barrier.open = false;
    } else if (lock === 'hidden' || lock === 'slick') {
      barrier.open = false;
    }
    return barrier;
  }
  return null;
}

/** Cellule praticable la plus proche d'un point (recherche en spirale). */
function findWalkableNear(
  grid: Uint8Array, cols: number, rows: number, cx: number, cy: number, maxR: number,
): { cx: number; cy: number } | null {
  const idx = (x: number, y: number) => y * cols + x;
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 2 || y < 2 || x >= cols - 2 || y >= rows - 2) continue;
        const t = grid[idx(x, y)];
        if (t === TERR.GROUND || t === TERR.PATH || t === TERR.GRASS) return { cx: x, cy: y };
      }
    }
  }
  return null;
}

/**
 * Supprime les poches inaccessibles et retourne les cellules atteignables
 * depuis le depart (les barrieres sont franchissables : elles s'ouvriront).
 */
function floodFill(
  grid: Uint8Array, cols: number, rows: number, start: { cx: number; cy: number },
  barriers: Barrier[], crossGadgetTerrain: boolean,
): Uint8Array {
  const idx = (cx: number, cy: number) => cy * cols + cx;
  const seen = new Uint8Array(cols * rows);
  const stack: number[] = [idx(start.cx, start.cy)];
  seen[stack[0]] = 1;
  // Les cellules de barriere sont traversables : elles finiront par s'ouvrir.
  const barrierCells = new Set<number>();
  for (const b of barriers) for (const c of b.cells) barrierCells.add(c);

  while (stack.length) {
    const cur = stack.pop()!;
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    const neigh = [idx(cx + 1, cy), idx(cx - 1, cy), idx(cx, cy + 1), idx(cx, cy - 1)];
    for (const n of neigh) {
      if (n < 0 || n >= grid.length || seen[n]) continue;
      const nx = n % cols;
      if (Math.abs(nx - cx) > 1) continue;
      const t = grid[n];
      // Les plateformes sont accessibles au saut, disponible des le niveau 1 :
      // elles comptent donc comme atteignables meme en flood strict.
      const passable = isWalkable(t)
        || t === TERR.LEDGE
        || barrierCells.has(n)
        || (crossGadgetTerrain && (t === TERR.WATER || t === TERR.GAP));
      if (!passable) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  return seen;
}

/**
 * Supprime les poches definitivement inaccessibles. Le flood est ici permissif
 * (eau, gouffres et passerelles se franchissent avec les gadgets), pour ne pas
 * amputer la carte de zones que le joueur pourra atteindre plus tard.
 */
function ensureConnectivity(
  grid: Uint8Array, cols: number, rows: number, start: { cx: number; cy: number },
  barriers: Barrier[], solid: Terrain,
): Uint8Array {
  const seen = floodFill(grid, cols, rows, start, barriers, true);
  for (let i = 0; i < grid.length; i++) {
    if (isWalkable(grid[i]) && !seen[i]) grid[i] = solid === TERR.VOID ? TERR.VOID : TERR.WALL;
  }
  return seen;
}

// --- Decors -----------------------------------------------------------------

function scatterProps(
  grid: Uint8Array, cols: number, rows: number, rooms: RoomRect[], rng: Rng, def: LevelDef,
  props: Prop[], decals: Decal[], lights: Light[], hideSpots: Vec2[],
) {
  const idx = (cx: number, cy: number) => cy * cols + cx;
  const set = PROP_SETS[def.layout] ?? PROP_SETS.garden;
  const totalWeight = set.reduce((s, p) => s + p.weight, 0);
  const pick = (): PropSpec => {
    let r = rng.next() * totalWeight;
    for (const p of set) {
      r -= p.weight;
      if (r <= 0) return p;
    }
    return set[0];
  };

  const nearWall = (cx: number, cy: number) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = grid[idx(clamp(cx + dx, 0, cols - 1), clamp(cy + dy, 0, rows - 1))];
        if (t === TERR.WALL || t === TERR.VOID || t === TERR.LEDGE) return true;
      }
    }
    return false;
  };

  // Densite : assez elevee, le brief demande des decors riches
  const walkableCount = grid.reduce<number>((n, t) => n + (isWalkable(t) ? 1 : 0), 0);
  const target = Math.floor(walkableCount * 0.34);
  const occupied = new Set<number>();
  let attempts = 0;

  while (props.length < target && attempts < target * 8) {
    attempts++;
    const cx = rng.int(2, cols - 3);
    const cy = rng.int(2, rows - 3);
    const t = grid[idx(cx, cy)];
    if (!isWalkable(t)) continue;
    const spec = pick();
    if (spec.place === 'wall' && !nearWall(cx, cy)) continue;
    if (spec.place === 'open' && nearWall(cx, cy)) continue;
    const key = idx(cx, cy);
    if (spec.blocking && occupied.has(key)) continue;
    if (spec.blocking) {
      // On ne bouche jamais un couloir etroit
      let open = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (isWalkable(grid[idx(clamp(cx + dx, 0, cols - 1), clamp(cy + dy, 0, rows - 1))])) open++;
      }
      if (open < 3) continue;
      occupied.add(key);
      occupied.add(idx(cx + 1, cy));
      occupied.add(idx(cx, cy + 1));
    }

    const x = (cx + 0.5) * CELL + rng.range(-18, 18);
    const y = (cy + 0.5) * CELL + rng.range(-18, 18);
    const s = rng.range(spec.sMin ?? 0.85, spec.sMax ?? 1.2);
    const prop: Prop = {
      kind: spec.kind, x, y, s,
      rot: spec.layer === 'flat' ? rng.range(0, Math.PI * 2) : rng.range(-0.06, 0.06),
      seed: rng.int(0, 9999),
      blocking: !!spec.blocking,
      r: (spec.r ?? 0) * s,
      hide: !!spec.hide,
      layer: spec.layer ?? 'sorted',
      anim: !!spec.anim,
    };
    props.push(prop);
    if (prop.hide) hideSpots.push({ x, y });

    const lp = LIGHT_PROPS[spec.kind];
    if (lp) {
      lights.push({ x, y: y + lp.dy, r: lp.r * s, color: lp.color, intensity: lp.intensity, flicker: lp.flicker });
    }
  }

  // Herbes hautes : on remplit densement les cellules GRASS
  for (let cy = 2; cy < rows - 2; cy++) {
    for (let cx = 2; cx < cols - 2; cx++) {
      if (grid[idx(cx, cy)] !== TERR.GRASS) continue;
      const n = rng.int(2, 4);
      for (let i = 0; i < n; i++) {
        const x = cx * CELL + rng.range(4, CELL - 4);
        const y = cy * CELL + rng.range(4, CELL - 4);
        props.push({
          kind: 'grassTuft', x, y, s: rng.range(0.95, 1.45), rot: 0, seed: rng.int(0, 9999),
          blocking: false, r: 0, hide: true, layer: 'sorted', anim: true,
        });
      }
      if (rng.bool(0.3)) hideSpots.push({ x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL });
    }
  }
}

/** Petits details narratifs : empreintes, graffitis, fromages voles. */
function addNarrativeDecals(
  grid: Uint8Array, cols: number, rows: number, rng: Rng, def: LevelDef,
  decals: Decal[], props: Prop[], lockedRooms: RoomRect[],
) {
  const idx = (cx: number, cy: number) => cy * cols + cx;
  // Traces de pas : petites trainees qui menent vers une cachette
  const trails = 4 + def.world;
  for (let i = 0; i < trails; i++) {
    let cx = rng.int(3, cols - 4);
    let cy = rng.int(3, rows - 4);
    if (!isWalkable(grid[idx(cx, cy)])) continue;
    const ang = rng.range(0, Math.PI * 2);
    const steps = rng.int(4, 9);
    for (let s = 0; s < steps; s++) {
      const x = (cx + 0.5) * CELL + Math.cos(ang) * s * 26;
      const y = (cy + 0.5) * CELL + Math.sin(ang) * s * 26;
      const gx = Math.floor(x / CELL);
      const gy = Math.floor(y / CELL);
      if (gx < 2 || gy < 2 || gx >= cols - 2 || gy >= rows - 2) break;
      if (!isWalkable(grid[idx(gx, gy)])) break;
      decals.push({ kind: 'pawPrint', x, y, rot: ang + Math.PI / 2, s: rng.range(0.75, 1), seed: s });
    }
    void cx; void cy;
  }

  // Graffitis de souris sur les murs
  const graffiti = 5 + def.world * 2;
  for (let i = 0; i < graffiti; i++) {
    const cx = rng.int(3, cols - 4);
    const cy = rng.int(3, rows - 4);
    if (grid[idx(cx, cy)] !== TERR.WALL) continue;
    if (!isWalkable(grid[idx(cx, cy + 1)])) continue;
    decals.push({
      kind: 'graffiti', x: (cx + 0.5) * CELL, y: (cy + 0.9) * CELL,
      rot: rng.range(-0.08, 0.08), s: rng.range(0.8, 1.25), seed: rng.int(0, 999),
    });
  }

  // Butin : tas de fromages voles, plus gros pres des zones verrouillees
  const piles = 3 + def.world;
  for (let i = 0; i < piles; i++) {
    const cx = rng.int(3, cols - 4);
    const cy = rng.int(3, rows - 4);
    if (!isWalkable(grid[idx(cx, cy)])) continue;
    props.push({
      kind: 'cheesePile', x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL,
      s: rng.range(0.8, 1.25), rot: rng.range(-0.1, 0.1), seed: rng.int(0, 999),
      blocking: false, r: 0, hide: false, layer: 'sorted', anim: false,
    });
  }
  for (const room of lockedRooms) {
    props.push({
      kind: 'cheesePile', x: (room.cx + 0.5) * CELL, y: (room.cy + 1.2) * CELL,
      s: 1.6, rot: 0, seed: 7, blocking: false, r: 0, hide: false, layer: 'sorted', anim: false,
    });
  }
}

// --- Peuplement -------------------------------------------------------------

/**
 * Position praticable ET atteignable dans une salle.
 * Retourne null si la salle n'offre aucun emplacement valide : l'appelant
 * choisira alors une autre salle (aucune souris ne doit etre inatteignable).
 */
function randomWalkable(
  grid: Uint8Array, cols: number, rows: number, room: RoomRect, rng: Rng, reach: Uint8Array,
): Vec2 | null {
  const idx = (cx: number, cy: number) => cy * cols + cx;
  const ok = (cx: number, cy: number) => {
    const t = grid[idx(cx, cy)];
    return reach[idx(cx, cy)] === 1 && (t === TERR.GROUND || t === TERR.PATH || t === TERR.GRASS);
  };
  for (let i = 0; i < 40; i++) {
    const cx = clamp(room.x + rng.int(0, room.w - 1), 2, cols - 3);
    const cy = clamp(room.y + rng.int(0, room.h - 1), 2, rows - 3);
    if (ok(cx, cy)) {
      return { x: (cx + 0.5) * CELL + rng.range(-14, 14), y: (cy + 0.5) * CELL + rng.range(-14, 14) };
    }
  }
  // Balayage exhaustif de la salle en dernier recours
  for (let cy = Math.max(2, room.y); cy < Math.min(rows - 2, room.y + room.h); cy++) {
    for (let cx = Math.max(2, room.x); cx < Math.min(cols - 2, room.x + room.w); cx++) {
      if (ok(cx, cy)) return { x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL };
    }
  }
  return null;
}

/**
 * Emplacement sur une structure surelevee, atteignable au saut : la cellule
 * LEDGE doit toucher (a 2 cases) une cellule praticable elle-meme atteignable.
 */
function randomPerch(
  grid: Uint8Array, cols: number, rows: number, rng: Rng, reach: Uint8Array,
): Vec2 | null {
  const idx = (cx: number, cy: number) => cy * cols + cx;
  const spots: number[] = [];
  for (let cy = 2; cy < rows - 2; cy++) {
    for (let cx = 2; cx < cols - 2; cx++) {
      const i = idx(cx, cy);
      if (grid[i] !== TERR.LEDGE || !reach[i]) continue;
      let jumpable = false;
      for (let d = 1; d <= 2 && !jumpable; d++) {
        for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]] as const) {
          const n = idx(clamp(cx + dx, 0, cols - 1), clamp(cy + dy, 0, rows - 1));
          if (reach[n] && isWalkable(grid[n])) {
            jumpable = true;
            break;
          }
        }
      }
      if (jumpable) spots.push(i);
    }
  }
  if (!spots.length) return null;
  const pick = spots[rng.int(0, spots.length - 1)];
  return { x: ((pick % cols) + 0.5) * CELL, y: (Math.floor(pick / cols) + 0.5) * CELL };
}

function placeMice(
  grid: Uint8Array, cols: number, rows: number, rooms: RoomRect[], lockedRooms: RoomRect[],
  rng: Rng, def: LevelDef, hideSpots: Vec2[], reach: Uint8Array, fallback: Vec2,
): MouseSpawn[] {
  const out: MouseSpawn[] = [];
  // On ne garde que les salles offrant au moins un emplacement atteignable.
  const usableLocked = lockedRooms.filter((r) => randomWalkable(grid, cols, rows, r, rng, reach) !== null);
  const freeRooms = rooms.filter((r) => !r.locked && !r.isSpawn
    && randomWalkable(grid, cols, rows, r, rng, reach) !== null);
  const anyRoom = rooms.filter((r) => randomWalkable(grid, cols, rows, r, rng, reach) !== null);
  const pool = freeRooms.length ? freeRooms : (anyRoom.length ? anyRoom : rooms);
  let n = 0;

  const perchChance = 0.18;
  const push = (kind: MouseKind, room: RoomRect, forcePerch = false) => {
    // Certaines souris se planquent en hauteur : il faudra sauter pour elles.
    if ((forcePerch || rng.bool(perchChance)) && !room.locked) {
      const perch = randomPerch(grid, cols, rows, rng, reach);
      if (perch) {
        out.push({ id: `${def.id}#${n++}`, kind, x: perch.x, y: perch.y, locked: false, perched: true });
        return;
      }
    }
    let p = randomWalkable(grid, cols, rows, room, rng, reach);
    let locked = !!room.locked;
    if (!p) {
      // Repli : n'importe quelle salle valide, sinon la position de depart
      for (const r of rng.shuffle(anyRoom.slice())) {
        p = randomWalkable(grid, cols, rows, r, rng, reach);
        if (p) {
          locked = !!r.locked;
          break;
        }
      }
    }
    const pos = p ?? fallback;
    const hide = hideSpots.length ? hideSpots[rng.int(0, hideSpots.length - 1)] : undefined;
    out.push({ id: `${def.id}#${n++}`, kind, x: pos.x, y: pos.y, locked, hideAt: hide });
  };

  // La souris Blanche va dans une zone verrouillee si possible
  const entries = Object.entries(def.mice) as [MouseKind, number][];
  let first = true;
  for (const [kind, count] of entries) {
    for (let i = 0; i < (count ?? 0); i++) {
      if (kind === 'white') {
        push('white', usableLocked.length ? usableLocked[0] : rng.pick(pool));
      } else {
        // La toute premiere souris ordinaire est perchee : le joueur decouvre
        // toujours la verticalite, meme dans le premier niveau.
        const useLocked = !first && usableLocked.length > 0 && rng.bool(0.14);
        push(kind, useLocked ? rng.pick(usableLocked) : rng.pick(pool), first);
        first = false;
      }
    }
  }
  return out;
}

function placeMobs(
  grid: Uint8Array, cols: number, rows: number, rooms: RoomRect[], rng: Rng,
  def: LevelDef, barriers: Barrier[], reach: Uint8Array,
): MobSpawn[] {
  const out: MobSpawn[] = [];
  const pool = rooms.filter((r) => !r.isSpawn && randomWalkable(grid, cols, rows, r, rng, reach) !== null);
  const usable = pool.length ? pool : rooms;
  for (const [kind, count] of Object.entries(def.mobs) as [MobKind, number][]) {
    for (let i = 0; i < (count ?? 0); i++) {
      const room = rng.pick(usable);
      const p = randomWalkable(grid, cols, rows, room, rng, reach);
      if (p) out.push({ kind, x: p.x, y: p.y });
    }
  }
  // Rats de garde bloquant les portes 'guard'
  for (const b of barriers) {
    if (b.lock === 'guard' && b.guardPos) {
      out.push({ kind: 'guard', x: b.guardPos.x, y: b.guardPos.y, guardBarrier: b.id });
    }
  }
  // Mini-boss dans la salle la plus eloignee du depart
  if (def.miniBoss) {
    const far = usable[usable.length - 1];
    const p = randomWalkable(grid, cols, rows, far, rng, reach)
      ?? { x: (far.cx + 0.5) * CELL, y: (far.cy + 0.5) * CELL };
    out.push({ kind: def.miniBoss, x: p.x, y: p.y, guardBarrier: -2 });
  }
  return out;
}
