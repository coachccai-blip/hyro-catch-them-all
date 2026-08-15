/**
 * Rendu du monde : ciel + parallaxe, sol cuit par chunks, brume, meteo et
 * lumieres. C'est ici que se joue l'identite visuelle de chaque monde.
 */

import { TAU, clamp, clamp01, fbm2, hash2, lerp } from '../core/math';
import { CELL, TERR, isWalkable } from '../levels/types';
import type { GeneratedLevel, Prop } from '../levels/generator';
import { paletteFor, type WorldPalette } from './palette';
import { drawDecal, drawProp, type PropDrawCtx } from './props';
import {
  blob, ellipse, glow, offscreen, poly, rgba, roundRect, shade, star, flicker,
  type Ctx,
} from './draw';

const CHUNK = 8; // cellules par chunk
const CHUNK_PX = CHUNK * CELL;
const MAX_CACHED = 30;

export interface Camera {
  /** Coin haut-gauche de la zone monde visible. */
  x: number;
  y: number;
  /** Taille de la zone monde visible (en pixels monde). */
  w: number;
  h: number;
  /** Taille de l'ecran en pixels logiques (pour les overlays). */
  sw: number;
  sh: number;
  zoom: number;
}

interface ChunkEntry {
  canvas: HTMLCanvasElement;
  used: number;
}

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  s: number;
  seed: number;
}

export class WorldRenderer {
  level: GeneratedLevel;
  pal: WorldPalette;
  layout: string;
  private chunks = new Map<string, ChunkEntry>();
  private tick = 0;
  private ambient: AmbientParticle[] = [];
  private ambientTimer = 0;
  /** Eclair du monde 4 : intensite 0..1 */
  lightning = 0;
  private lightningTimer = 4;
  /** Qualite : reduit le nombre de particules sur mobile. */
  quality = 1;
  onThunder: (() => void) | null = null;

  constructor(level: GeneratedLevel) {
    this.level = level;
    this.pal = paletteFor(level.def.world);
    this.layout = level.def.layout;
  }

  dispose() {
    this.chunks.clear();
    this.ambient.length = 0;
  }

  // --- Ciel et parallaxe ---------------------------------------------------

  drawBackground(ctx: Ctx, cam: Camera, t: number) {
    const p = this.pal;
    const g = ctx.createLinearGradient(0, 0, 0, cam.sh);
    g.addColorStop(0, p.skyTop);
    g.addColorStop(0.55, p.skyMid);
    g.addColorStop(1, p.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cam.sw, cam.sh);

    switch (this.level.def.world) {
      case 1: this.skyGarden(ctx, cam, t); break;
      case 2: this.skyMarket(ctx, cam, t); break;
      case 3: this.skySewer(ctx, cam, t); break;
      case 4: this.skyRooftop(ctx, cam, t); break;
      default: this.skyFactory(ctx, cam, t); break;
    }
  }

  /** Decalage de parallaxe pour une couche donnee. */
  private par(cam: Camera, factor: number): { x: number; y: number } {
    return { x: -cam.x * factor, y: -cam.y * factor * 0.6 };
  }

  private skyGarden(ctx: Ctx, cam: Camera, t: number) {
    const p = this.pal;
    // Soleil bas + halo
    const sx = cam.sw * 0.78 - cam.x * 0.04;
    const sy = cam.sh * 0.16 - cam.y * 0.02;
    glow(ctx, sx, sy, 320, '#fff3c4', 0.55);
    ctx.beginPath();
    ctx.arc(sx, sy, 54, 0, TAU);
    ctx.fillStyle = '#fff8d8';
    ctx.fill();
    // Nuages doux
    const o1 = this.par(cam, 0.08);
    for (let i = 0; i < 7; i++) {
      const cx = ((i * 460 + o1.x + t * 6) % (cam.sw + 700)) - 350;
      const cy = 60 + (i % 3) * 90 + o1.y;
      ctx.globalAlpha = 0.55;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(cx + k * 62 - 90, cy + Math.sin(i + k) * 12, 48 + (k % 2) * 22, 0, TAU);
        ctx.fillStyle = k % 2 ? '#fffaf0' : '#ffeccd';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Collines et haies
    this.hills(ctx, cam, 0.16, cam.sh * 0.62, 140, p.far, 3);
    this.hills(ctx, cam, 0.3, cam.sh * 0.74, 110, p.mid, 5);
    this.treeline(ctx, cam, 0.46, cam.sh * 0.84, p.near, t);
  }

  private skyMarket(ctx: Ctx, cam: Camera, t: number) {
    const p = this.pal;
    // Lune + halo
    const mx = cam.sw * 0.2 - cam.x * 0.03;
    const my = cam.sh * 0.14 - cam.y * 0.02;
    glow(ctx, mx, my, 200, '#cfd8ff', 0.4);
    ctx.beginPath();
    ctx.arc(mx, my, 40, 0, TAU);
    ctx.fillStyle = '#f2f4ff';
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(mx - 16, my - 8, 34, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // Etoiles
    const o = this.par(cam, 0.05);
    for (let i = 0; i < 90 * this.quality; i++) {
      const x = ((hash2(i, 3, 11) * 3000 + o.x) % (cam.sw + 60)) - 30;
      const y = hash2(i, 7, 13) * cam.sh * 0.55 + o.y;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + i));
      ctx.globalAlpha = tw * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    this.cityscape(ctx, cam, 0.18, cam.sh * 0.7, 220, p.far, 0.35, t);
    this.cityscape(ctx, cam, 0.34, cam.sh * 0.82, 160, p.mid, 0.5, t);
    // Guirlandes lointaines
    const o2 = this.par(cam, 0.5);
    for (let i = 0; i < 4; i++) {
      const y = cam.sh * 0.3 + i * 40;
      ctx.beginPath();
      ctx.moveTo(-100 + ((o2.x + i * 300) % 600), y);
      ctx.quadraticCurveTo(cam.sw * 0.5, y + 60, cam.sw + 100 + ((o2.x + i * 300) % 600), y);
      ctx.strokeStyle = 'rgba(255,220,150,0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  private skySewer(ctx: Ctx, cam: Camera, t: number) {
    // Voute sombre + arches de tunnel
    const p = this.pal;
    const o = this.par(cam, 0.2);
    ctx.save();
    for (let i = -1; i < 6; i++) {
      const x = i * 420 + ((o.x % 420) + 420) % 420;
      ctx.beginPath();
      ctx.moveTo(x - 200, cam.sh);
      ctx.lineTo(x - 200, cam.sh * 0.42);
      ctx.quadraticCurveTo(x, cam.sh * 0.05, x + 200, cam.sh * 0.42);
      ctx.lineTo(x + 200, cam.sh);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? p.far : p.mid;
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // Tuyaux au plafond
    const o2 = this.par(cam, 0.35);
    for (let i = 0; i < 4; i++) {
      const y = 30 + i * 46 + o2.y * 0.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cam.sw, y + Math.sin(i) * 10);
      ctx.strokeStyle = `rgba(30,55,45,${0.5 - i * 0.08})`;
      ctx.lineWidth = 14 - i * 2;
      ctx.stroke();
    }
    // Neons lointains clignotants
    for (let i = 0; i < 6; i++) {
      const x = ((i * 340 + o2.x) % (cam.sw + 340)) - 170;
      const y = cam.sh * 0.2 + (i % 2) * 60;
      const fl = flicker(t, i * 31, 5);
      glow(ctx, x, y, 90 * fl, p.accent, 0.14 * fl);
    }
  }

  private skyRooftop(ctx: Ctx, cam: Camera, t: number) {
    const p = this.pal;
    // Nuages d'orage
    const o = this.par(cam, 0.09);
    for (let i = 0; i < 8; i++) {
      const cx = ((i * 380 + o.x + t * 14) % (cam.sw + 800)) - 400;
      const cy = 40 + (i % 3) * 80 + o.y;
      ctx.globalAlpha = 0.5;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.arc(cx + k * 70 - 120, cy + Math.sin(i * 2 + k) * 16, 60 + (k % 2) * 26, 0, TAU);
        ctx.fillStyle = k % 2 ? '#2b3554' : '#212a45';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    this.cityscape(ctx, cam, 0.14, cam.sh * 0.66, 300, p.far, 0.5, t);
    this.cityscape(ctx, cam, 0.28, cam.sh * 0.8, 210, p.mid, 0.75, t);
    this.cityscape(ctx, cam, 0.44, cam.sh * 0.92, 150, p.near, 0.9, t);
    if (this.lightning > 0.02) {
      ctx.fillStyle = `rgba(200,220,255,${this.lightning * 0.5})`;
      ctx.fillRect(0, 0, cam.sw, cam.sh);
    }
  }

  private skyFactory(ctx: Ctx, cam: Camera, t: number) {
    const p = this.pal;
    // Lueur de four au fond
    const gx = cam.sw * 0.5 - cam.x * 0.05;
    glow(ctx, gx, cam.sh * 0.8, 620, '#ff7a2b', 0.28 + 0.06 * Math.sin(t * 1.1));
    // Silhouettes de cheminees et cuves
    const o = this.par(cam, 0.16);
    ctx.fillStyle = p.far;
    for (let i = -1; i < 9; i++) {
      const x = i * 260 + ((o.x % 260) + 260) % 260;
      const h = 180 + hash2(i, 5, 3) * 200;
      ctx.fillRect(x, cam.sh * 0.72 - h, 90, h + 40);
      ctx.fillRect(x + 100, cam.sh * 0.72 - h * 0.6, 40, h * 0.6 + 40);
    }
    const o2 = this.par(cam, 0.3);
    ctx.fillStyle = p.mid;
    for (let i = -1; i < 8; i++) {
      const x = i * 320 + ((o2.x % 320) + 320) % 320;
      const h = 120 + hash2(i, 9, 7) * 160;
      ctx.beginPath();
      ctx.moveTo(x, cam.sh * 0.86);
      ctx.lineTo(x, cam.sh * 0.86 - h);
      ctx.lineTo(x + 60, cam.sh * 0.86 - h - 24);
      ctx.lineTo(x + 120, cam.sh * 0.86 - h);
      ctx.lineTo(x + 120, cam.sh * 0.86);
      ctx.closePath();
      ctx.fill();
    }
    // Tapis de vapeur
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.06 + i * 0.17) % 1;
      ctx.globalAlpha = (1 - ph) * 0.12;
      ctx.beginPath();
      ctx.arc(((i * 300 + o2.x) % (cam.sw + 400)) - 200, cam.sh * 0.8 - ph * 260, 90 + ph * 140, 0, TAU);
      ctx.fillStyle = '#ffb066';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private hills(ctx: Ctx, cam: Camera, factor: number, baseY: number, amp: number, color: string, seed: number) {
    const o = this.par(cam, factor);
    ctx.beginPath();
    ctx.moveTo(-50, cam.sh);
    for (let x = -50; x <= cam.sw + 50; x += 26) {
      const wx = (x - o.x) * 0.0016;
      const y = baseY + o.y - fbm2(wx, seed, 3, seed) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(cam.sw + 50, cam.sh);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  private treeline(ctx: Ctx, cam: Camera, factor: number, baseY: number, color: string, t: number) {
    const o = this.par(cam, factor);
    ctx.fillStyle = color;
    ctx.fillRect(0, baseY + o.y, cam.sw, cam.sh);
    for (let i = -1; i < 14; i++) {
      const x = i * 170 + ((o.x % 170) + 170) % 170;
      const h = 90 + hash2(i, 11, 5) * 70;
      const sway = Math.sin(t * 0.7 + i) * 3;
      ctx.beginPath();
      ctx.ellipse(x + sway, baseY + o.y - h * 0.4, 78, h * 0.6, 0, 0, TAU);
      ctx.fill();
    }
  }

  private cityscape(ctx: Ctx, cam: Camera, factor: number, baseY: number, maxH: number, color: string, windowAlpha: number, t: number) {
    const o = this.par(cam, factor);
    ctx.fillStyle = color;
    ctx.fillRect(0, baseY + o.y, cam.sw, cam.sh);
    for (let i = -1; i < 22; i++) {
      const x = i * 120 + ((o.x % 120) + 120) % 120;
      const w = 70 + hash2(i, 3, 17) * 60;
      const h = 60 + hash2(i, 8, 19) * maxH;
      const y = baseY + o.y - h;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h + 10);
      // Fenetres allumees
      const cols = Math.max(1, Math.floor(w / 18));
      const rowsN = Math.max(1, Math.floor(h / 22));
      for (let cxi = 0; cxi < cols; cxi++) {
        for (let ryi = 0; ryi < rowsN; ryi++) {
          const on = hash2(i * 31 + cxi, ryi, 23);
          if (on < 0.42) continue;
          const tw = on > 0.92 ? (Math.sin(t * 2 + i + cxi) > 0 ? 1 : 0.3) : 1;
          ctx.fillStyle = `rgba(255,205,120,${windowAlpha * 0.5 * tw})`;
          ctx.fillRect(x + 6 + cxi * 18, y + 8 + ryi * 22, 8, 11);
        }
      }
    }
  }

  // --- Sol cuit par chunks --------------------------------------------------

  private chunkKey(cx: number, cy: number) {
    return `${cx},${cy}`;
  }

  private getChunk(cx: number, cy: number): HTMLCanvasElement {
    const key = this.chunkKey(cx, cy);
    let e = this.chunks.get(key);
    if (e) {
      e.used = this.tick;
      return e.canvas;
    }
    const { canvas, ctx } = offscreen(CHUNK_PX, CHUNK_PX);
    this.bakeChunk(ctx, cx, cy);
    e = { canvas, used: this.tick };
    this.chunks.set(key, e);
    if (this.chunks.size > MAX_CACHED) {
      let oldestKey = '';
      let oldest = Infinity;
      for (const [k, v] of this.chunks) {
        if (v.used < oldest) {
          oldest = v.used;
          oldestKey = k;
        }
      }
      this.chunks.delete(oldestKey);
    }
    return canvas;
  }

  /** Invalide un chunk (ex: une barriere s'ouvre). */
  invalidateAround(x: number, y: number, radius = CELL * 4) {
    const c0 = Math.floor((x - radius) / CHUNK_PX);
    const c1 = Math.floor((x + radius) / CHUNK_PX);
    const r0 = Math.floor((y - radius) / CHUNK_PX);
    const r1 = Math.floor((y + radius) / CHUNK_PX);
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) this.chunks.delete(this.chunkKey(cx, cy));
    }
  }

  private bakeChunk(ctx: Ctx, chx: number, chy: number) {
    const lv = this.level;
    const ox = chx * CHUNK_PX;
    const oy = chy * CHUNK_PX;
    ctx.save();
    ctx.translate(-ox, -oy);

    const x0 = chx * CHUNK - 1;
    const y0 = chy * CHUNK - 1;
    const x1 = x0 + CHUNK + 2;
    const y1 = y0 + CHUNK + 2;

    // 1) Sols
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (cx < 0 || cy < 0 || cx >= lv.cols || cy >= lv.rows) continue;
        const t = lv.grid[cy * lv.cols + cx];
        if (t === TERR.VOID || t === TERR.WALL || t === TERR.LEDGE) continue;
        this.paintFloor(ctx, cx, cy, t);
      }
    }
    // 2) Decals au sol
    for (const d of lv.decals) {
      if (d.x < ox - 80 || d.x > ox + CHUNK_PX + 80 || d.y < oy - 80 || d.y > oy + CHUNK_PX + 80) continue;
      drawDecal(ctx, d.kind, d.x, d.y, d.rot, d.s, d.seed, this.pal);
    }
    // 3) Props plats
    const pc: PropDrawCtx = { pal: this.pal, t: 0, fade: 1 };
    for (const p of lv.props) {
      if (p.layer !== 'flat') continue;
      if (p.x < ox - 90 || p.x > ox + CHUNK_PX + 90 || p.y < oy - 90 || p.y > oy + CHUNK_PX + 90) continue;
      drawProp(ctx, p, pc);
    }
    // 4) Murs et plateformes (au-dessus des sols, avec ombre portee)
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (cx < 0 || cy < 0 || cx >= lv.cols || cy >= lv.rows) continue;
        const t = lv.grid[cy * lv.cols + cx];
        if (t === TERR.WALL) this.paintWall(ctx, cx, cy);
        else if (t === TERR.LEDGE) this.paintLedge(ctx, cx, cy);
      }
    }
    ctx.restore();
  }

  private neighbour(cx: number, cy: number): number {
    const lv = this.level;
    if (cx < 0 || cy < 0 || cx >= lv.cols || cy >= lv.rows) return TERR.VOID;
    return lv.grid[cy * lv.cols + cx];
  }

  private paintFloor(ctx: Ctx, cx: number, cy: number, t: number) {
    const p = this.pal;
    const x = cx * CELL;
    const y = cy * CELL;
    const n = hash2(cx, cy, this.level.seed);

    if (t === TERR.GAP) {
      // Gouffre : dégradé sombre + rebord
      ctx.fillStyle = '#0b0d14';
      ctx.fillRect(x, y, CELL, CELL);
      const g = ctx.createLinearGradient(x, y, x, y + CELL);
      g.addColorStop(0, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, CELL, CELL);
      if (isWalkable(this.neighbour(cx, cy - 1))) {
        ctx.fillStyle = rgba(p.groundDark, 0.85);
        ctx.fillRect(x, y, CELL, 7);
      }
      return;
    }

    if (t === TERR.WATER) {
      const g = ctx.createLinearGradient(x, y, x, y + CELL);
      g.addColorStop(0, p.waterDeep);
      g.addColorStop(1, p.water);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, CELL, CELL);
      // Ondulations cuites
      ctx.strokeStyle = rgba(p.waterFoam, 0.2);
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const yy = y + 12 + i * 20 + n * 8;
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.quadraticCurveTo(x + CELL * 0.5, yy + (i % 2 ? 5 : -5), x + CELL, yy);
        ctx.stroke();
      }
      // Ecume au bord
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        if (!isWalkable(this.neighbour(cx + dx, cy + dy))) continue;
        ctx.fillStyle = rgba(p.waterFoam, 0.35);
        if (dy === -1) ctx.fillRect(x, y, CELL, 5);
        else if (dy === 1) ctx.fillRect(x, y + CELL - 5, CELL, 5);
        else if (dx === -1) ctx.fillRect(x, y, 5, CELL);
        else ctx.fillRect(x + CELL - 5, y, 5, CELL);
      }
      return;
    }

    if (t === TERR.HAZARD) {
      const g = ctx.createLinearGradient(x, y, x, y + CELL);
      g.addColorStop(0, '#ffbb3a');
      g.addColorStop(1, '#e2600f');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, CELL, CELL);
      for (let i = 0; i < 3; i++) {
        blob(ctx, x + CELL * hash2(cx, cy + i, 3), y + CELL * hash2(cx + i, cy, 5), 10, 6, cx * 7 + cy, 0.4, 8);
        ctx.fillStyle = 'rgba(255,240,180,0.35)';
        ctx.fill();
      }
      return;
    }

    // Sols praticables : base + variation
    let base = t === TERR.PATH ? p.path : t === TERR.GRASS ? shade(p.ground, -0.14) : p.ground;
    if (t === TERR.SLICK) base = shade(p.ground, 0.06);
    // Variation douce : on evite tout damier visible a l'echelle de la cellule
    const v = fbm2(cx * 0.22, cy * 0.22, 3, this.level.seed) - 0.5;
    ctx.fillStyle = shade(base, v * 0.07);
    ctx.fillRect(x, y, CELL, CELL);

    switch (this.level.def.layout) {
      case 'garden': this.textureGarden(ctx, x, y, t, cx, cy); break;
      case 'market': this.textureMarket(ctx, x, y, t, cx, cy); break;
      case 'sewer': this.textureSewer(ctx, x, y, t, cx, cy); break;
      case 'rooftop': this.textureRooftop(ctx, x, y, t, cx, cy); break;
      default: this.textureFactory(ctx, x, y, t, cx, cy); break;
    }

    if (t === TERR.SLICK) {
      ctx.fillStyle = 'rgba(180,255,220,0.16)';
      ctx.fillRect(x, y, CELL, CELL);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 14 + n * 20);
      ctx.lineTo(x + CELL - 8, y + 8 + n * 20);
      ctx.stroke();
    }
  }

  private textureGarden(ctx: Ctx, x: number, y: number, t: number, cx: number, cy: number) {
    const p = this.pal;
    if (t === TERR.PATH) {
      // Terre battue + graviers
      for (let i = 0; i < 7; i++) {
        const gx = x + hash2(cx * 13 + i, cy, 1) * CELL;
        const gy = y + hash2(cx, cy * 13 + i, 2) * CELL;
        ctx.fillStyle = i % 2 ? rgba(p.pathAlt, 0.75) : 'rgba(255,255,255,0.10)';
        ctx.beginPath();
        ctx.ellipse(gx, gy, 3 + hash2(i, cx, cy) * 3, 2 + hash2(i, cy, cx) * 2, 0, 0, TAU);
        ctx.fill();
      }
      return;
    }
    // Pelouse : larges bandes de tonte (4 cellules) + brins
    const stripe = (Math.floor(cy / 4) % 2) === 0;
    ctx.fillStyle = stripe ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.028)';
    ctx.fillRect(x, y, CELL, CELL);
    ctx.strokeStyle = rgba(shade(p.ground, t === TERR.GRASS ? -0.3 : -0.22), 0.5);
    ctx.lineWidth = 1.6;
    const n = t === TERR.GRASS ? 16 : 11;
    for (let i = 0; i < n; i++) {
      const gx = x + hash2(cx * 7 + i, cy * 3, 4) * CELL;
      const gy = y + hash2(cx * 3, cy * 7 + i, 5) * CELL;
      const h = 4 + hash2(i, cx + cy, 6) * (t === TERR.GRASS ? 11 : 6);
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.quadraticCurveTo(gx + 2, gy - h * 0.6, gx + 4, gy - h);
      ctx.stroke();
    }
  }

  private textureMarket(ctx: Ctx, x: number, y: number, t: number, cx: number, cy: number) {
    const p = this.pal;
    // Paves : briques decalees
    const bh = 16;
    const bw = 32;
    for (let ry = 0; ry < CELL / bh; ry++) {
      const off = ((cy * (CELL / bh) + ry) % 2) * (bw / 2);
      for (let rx = -1; rx < CELL / bw + 1; rx++) {
        const px = x + rx * bw + off;
        const py = y + ry * bh;
        const s = hash2(Math.floor(px / bw), Math.floor(py / bh), 9);
        ctx.fillStyle = rgba(shade(p.ground, (s - 0.5) * 0.22), 0.9);
        ctx.fillRect(px + 1, py + 1, bw - 2, bh - 2);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
    if (t === TERR.PATH) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, y, CELL, CELL);
    }
  }

  private textureSewer(ctx: Ctx, x: number, y: number, t: number, cx: number, cy: number) {
    const p = this.pal;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
    // Taches d'humidite
    for (let i = 0; i < 3; i++) {
      const gx = x + hash2(cx + i, cy, 21) * CELL;
      const gy = y + hash2(cx, cy + i, 22) * CELL;
      blob(ctx, gx, gy, 8 + hash2(i, cx, cy) * 12, 5 + hash2(i, cy, cx) * 7, cx * 5 + cy + i, 0.35, 8);
      ctx.fillStyle = 'rgba(20,45,35,0.22)';
      ctx.fill();
    }
    // Rails
    if (t === TERR.PATH && (cy % 7 === 3 || cy % 7 === 4)) {
      ctx.fillStyle = '#6e6155';
      ctx.fillRect(x, y + (cy % 7 === 3 ? 18 : 30), CELL, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, y + (cy % 7 === 3 ? 18 : 30), CELL, 2);
    }
  }

  private textureRooftop(ctx: Ctx, x: number, y: number, t: number, cx: number, cy: number) {
    const p = this.pal;
    // Tuiles / bitume
    if (t === TERR.PATH) {
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(x, y, CELL, CELL);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(x + hash2(cx + i, cy, 31) * CELL, y + hash2(cx, cy + i, 32) * CELL, 8, 3);
      }
      return;
    }
    const th = 16;
    for (let ry = 0; ry < CELL / th; ry++) {
      const off = ((cy * (CELL / th) + ry) % 2) * 14;
      for (let rx = -1; rx < CELL / 28 + 1; rx++) {
        const px = x + rx * 28 + off;
        const s = hash2(Math.floor(px / 28), cy * 4 + ry, 33);
        ctx.beginPath();
        ctx.moveTo(px, y + ry * th + th);
        ctx.lineTo(px, y + ry * th + 4);
        ctx.quadraticCurveTo(px + 14, y + ry * th - 3, px + 28, y + ry * th + 4);
        ctx.lineTo(px + 28, y + ry * th + th);
        ctx.closePath();
        ctx.fillStyle = rgba(shade(p.ground, (s - 0.5) * 0.2), 0.85);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.16)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  private textureFactory(ctx: Ctx, x: number, y: number, t: number, cx: number, cy: number) {
    const p = this.pal;
    // Plaques metalliques + rivets
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2.5, y + 2.5, CELL - 5, CELL - 5);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x + 4, y + 4, CELL - 8, 3);
    for (let i = 0; i < 4; i++) {
      const rx = x + (i % 2 ? CELL - 10 : 10);
      const ry = y + (i < 2 ? 10 : CELL - 10);
      ctx.beginPath();
      ctx.arc(rx, ry, 2.2, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
    }
    if (t === TERR.PATH && (cx + cy) % 5 === 0) {
      ctx.fillStyle = 'rgba(255,200,60,0.12)';
      ctx.fillRect(x, y, CELL, CELL);
    }
  }

  private paintWall(ctx: Ctx, cx: number, cy: number) {
    const p = this.pal;
    const x = cx * CELL;
    const y = cy * CELL;
    const belowOpen = isWalkable(this.neighbour(cx, cy + 1)) || this.neighbour(cx, cy + 1) === TERR.WATER;
    const faceH = 20;

    // Ombre portee vers le bas/gauche (lumiere haute droite)
    if (belowOpen) {
      const g = ctx.createLinearGradient(x, y + CELL, x, y + CELL + 34);
      g.addColorStop(0, rgba(p.shadow, 0.45));
      g.addColorStop(1, rgba(p.shadow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - 6, y + CELL, CELL + 12, 34);
    }

    // Surface superieure
    ctx.fillStyle = p.wallTop;
    ctx.fillRect(x, y, CELL, CELL);
    const n = hash2(cx, cy, this.level.seed + 3);

    switch (this.level.def.layout) {
      case 'garden': {
        // Haie touffue
        ctx.fillStyle = shade(p.near, 0.06);
        ctx.fillRect(x, y, CELL, CELL);
        for (let i = 0; i < 6; i++) {
          blob(ctx, x + hash2(cx * 3 + i, cy, 41) * CELL, y + hash2(cx, cy * 3 + i, 42) * CELL, 16, 13, cx + cy + i, 0.3, 8);
          ctx.fillStyle = i % 2 ? shade(p.near, 0.12) : shade(p.near, -0.08);
          ctx.fill();
        }
        break;
      }
      case 'market': {
        ctx.fillStyle = p.wall;
        ctx.fillRect(x, y, CELL, CELL);
        // Planches verticales
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = rgba(shade(p.wall, (hash2(cx, cy + i, 43) - 0.5) * 0.3), 0.9);
          ctx.fillRect(x + i * 16, y, 15, CELL);
        }
        break;
      }
      case 'sewer': {
        ctx.fillStyle = p.wall;
        ctx.fillRect(x, y, CELL, CELL);
        // Carrelage
        for (let ry = 0; ry < 4; ry++) {
          for (let rx = 0; rx < 4; rx++) {
            ctx.fillStyle = rgba(shade(p.wall, (hash2(cx * 4 + rx, cy * 4 + ry, 44) - 0.5) * 0.24), 0.95);
            ctx.fillRect(x + rx * 16 + 1, y + ry * 16 + 1, 14, 14);
          }
        }
        break;
      }
      case 'rooftop': {
        ctx.fillStyle = p.wall;
        ctx.fillRect(x, y, CELL, CELL);
        for (let ry = 0; ry < 5; ry++) {
          const off = (ry % 2) * 16;
          for (let rx = -1; rx < 3; rx++) {
            ctx.fillStyle = rgba(shade('#6b4a4a', (hash2(cx * 5 + rx, cy * 5 + ry, 45) - 0.5) * 0.26), 0.9);
            ctx.fillRect(x + rx * 32 + off + 1, y + ry * 13 + 1, 30, 11);
          }
        }
        break;
      }
      default: {
        ctx.fillStyle = p.wall;
        ctx.fillRect(x, y, CELL, CELL);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 3.5, y + 3.5, CELL - 7, CELL - 7);
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(x + (i % 2 ? CELL - 12 : 12), y + (i < 2 ? 12 : CELL - 12), 3, 0, TAU);
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fill();
        }
        break;
      }
    }

    // Assombrissement general : un mur ne doit jamais se confondre avec le sol
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x, y, CELL, CELL);

    // Face avant (effet 2.5D)
    if (belowOpen) {
      const g = ctx.createLinearGradient(x, y + CELL - faceH, x, y + CELL);
      g.addColorStop(0, rgba(p.wallLine, 0.55));
      g.addColorStop(1, rgba(p.wallLine, 0.95));
      ctx.fillStyle = g;
      ctx.fillRect(x, y + CELL - faceH, CELL, faceH);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x, y + CELL - faceH, CELL, 2);
    }
    // Lisere uniquement sur les bords exposes (pas de quadrillage visible)
    ctx.strokeStyle = rgba(p.wallLine, 0.55);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (this.neighbour(cx, cy - 1) !== TERR.WALL) {
      ctx.moveTo(x, y + 1);
      ctx.lineTo(x + CELL, y + 1);
    }
    if (this.neighbour(cx - 1, cy) !== TERR.WALL) {
      ctx.moveTo(x + 1, y);
      ctx.lineTo(x + 1, y + CELL);
    }
    if (this.neighbour(cx + 1, cy) !== TERR.WALL) {
      ctx.moveTo(x + CELL - 1, y);
      ctx.lineTo(x + CELL - 1, y + CELL);
    }
    ctx.stroke();
    void n;
  }

  private paintLedge(ctx: Ctx, cx: number, cy: number) {
    const p = this.pal;
    const x = cx * CELL;
    const y = cy * CELL;
    const belowOpen = this.neighbour(cx, cy + 1) !== TERR.LEDGE;
    // Ombre projetee
    if (belowOpen) {
      const g = ctx.createLinearGradient(x, y + CELL, x, y + CELL + 26);
      g.addColorStop(0, rgba(p.shadow, 0.4));
      g.addColorStop(1, rgba(p.shadow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - 4, y + CELL, CELL + 8, 26);
    }
    // Chaque monde a son materiau de plateforme : la verticalite doit se lire
    // instantanement, sans confondre le dessus d'une structure et le sol.
    const n2 = hash2(cx, cy, this.level.seed + 11);
    let top = '#a9773f';
    let face = '#6b4a24';
    switch (this.level.def.layout) {
      case 'garden': top = '#b98552'; face = '#6f4c2a'; break; // terrasse en bois
      case 'market': top = '#8a6a86'; face = '#4a3350'; break; // toit d'etal
      case 'sewer': top = '#6d7a74'; face = '#39443f'; break; // passerelle metal
      case 'rooftop': top = '#5d6684'; face = '#2f3750'; break; // toiture surelevee
      default: top = '#7d6a58'; face = '#443830'; break; // caillebotis d'usine
    }
    ctx.fillStyle = shade(top, (n2 - 0.5) * 0.1);
    ctx.fillRect(x, y, CELL, CELL);

    if (this.level.def.layout === 'garden' || this.level.def.layout === 'market') {
      // Planches
      ctx.strokeStyle = rgba(face, 0.5);
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + i * 16 + 8);
        ctx.lineTo(x + CELL, y + i * 16 + 8);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      for (let i = 0; i < 4; i++) ctx.fillRect(x, y + i * 16 + 2, CELL, 2);
    } else {
      // Caillebotis metallique
      ctx.strokeStyle = rgba(face, 0.55);
      ctx.lineWidth = 1.6;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + i * 16);
        ctx.lineTo(x + CELL, y + i * 16);
        ctx.moveTo(x + i * 16, y);
        ctx.lineTo(x + i * 16, y + CELL);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 2, y + 2, CELL - 4, 2);
    }

    // Rebord clair sur les cotes exposes : c'est ce qui donne le relief
    const edge = (dx: number, dy: number) => this.neighbour(cx + dx, cy + dy) !== TERR.LEDGE;
    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    if (edge(0, -1)) ctx.fillRect(x, y, CELL, 4);
    if (edge(-1, 0)) ctx.fillRect(x, y, 4, CELL);
    if (edge(1, 0)) ctx.fillRect(x + CELL - 4, y, 4, CELL);

    if (belowOpen) {
      // Face avant : la hauteur de la structure
      const g2 = ctx.createLinearGradient(x, y + CELL - 18, x, y + CELL);
      g2.addColorStop(0, shade(face, 0.12));
      g2.addColorStop(1, face);
      ctx.fillStyle = g2;
      ctx.fillRect(x, y + CELL - 18, CELL, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, y + CELL - 18, CELL, 2);
    }
  }

  /** Dessine le sol visible (chunks caches). */
  drawGround(ctx: Ctx, cam: Camera) {
    this.tick++;
    const c0 = Math.floor(cam.x / CHUNK_PX);
    const c1 = Math.floor((cam.x + cam.w) / CHUNK_PX);
    const r0 = Math.floor(cam.y / CHUNK_PX);
    const r1 = Math.floor((cam.y + cam.h) / CHUNK_PX);
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        if (cx < 0 || cy < 0 || cx * CHUNK >= this.level.cols || cy * CHUNK >= this.level.rows) continue;
        const canvas = this.getChunk(cx, cy);
        ctx.drawImage(canvas, cx * CHUNK_PX, cy * CHUNK_PX);
      }
    }
  }

  /** Effets animes au sol : eau, fondue, tapis roulants. */
  drawFloorFx(ctx: Ctx, cam: Camera, t: number) {
    const lv = this.level;
    const c0 = Math.max(0, Math.floor(cam.x / CELL));
    const c1 = Math.min(lv.cols - 1, Math.ceil((cam.x + cam.w) / CELL));
    const r0 = Math.max(0, Math.floor(cam.y / CELL));
    const r1 = Math.min(lv.rows - 1, Math.ceil((cam.y + cam.h) / CELL));
    ctx.save();
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const ter = lv.grid[cy * lv.cols + cx];
        const x = cx * CELL;
        const y = cy * CELL;
        if (ter === TERR.WATER) {
          const ph = t * 0.8 + cx * 0.4 + cy * 0.3;
          ctx.strokeStyle = rgba(this.pal.waterFoam, 0.16 + 0.1 * Math.sin(ph));
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y + 20 + Math.sin(ph) * 4);
          ctx.quadraticCurveTo(x + CELL * 0.5, y + 26 + Math.cos(ph) * 5, x + CELL, y + 20 + Math.sin(ph + 1) * 4);
          ctx.stroke();
        } else if (ter === TERR.HAZARD) {
          const ph = t * 1.4 + cx + cy;
          ctx.fillStyle = `rgba(255,220,120,${0.15 + 0.12 * Math.sin(ph)})`;
          ctx.fillRect(x, y, CELL, CELL);
          if ((cx + cy) % 3 === 0) {
            ctx.beginPath();
            ctx.arc(x + CELL / 2 + Math.sin(ph) * 8, y + CELL / 2 + Math.cos(ph * 0.7) * 8, 4 + Math.sin(ph * 2) * 2, 0, TAU);
            ctx.fillStyle = 'rgba(255,245,200,0.5)';
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  }

  // --- Meteo, brume, particules d'ambiance ---------------------------------

  update(dt: number, cam: Camera) {
    const world = this.level.def.world;
    this.ambientTimer -= dt;
    const budget = Math.floor(this.quality * (world === 4 ? 0 : 26));

    if (this.ambientTimer <= 0) {
      this.ambientTimer = 0.08;
      if (this.ambient.length < budget) this.spawnAmbient(cam);
    }
    for (let i = this.ambient.length - 1; i >= 0; i--) {
      const a = this.ambient[i];
      a.life -= dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (world === 1) a.x += Math.sin(a.life * 2 + a.seed) * 22 * dt;
      if (a.life <= 0) this.ambient.splice(i, 1);
    }

    if (world === 4) {
      this.lightning = Math.max(0, this.lightning - dt * 2.4);
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 6 + Math.random() * 11;
        this.lightning = 1;
        this.onThunder?.();
      }
    }
  }

  private spawnAmbient(cam: Camera) {
    const world = this.level.def.world;
    const x = cam.x - 100 + Math.random() * (cam.w + 200);
    const y = cam.y - 100 + Math.random() * (cam.h + 200);
    const p: AmbientParticle = {
      x, y, vx: 0, vy: 0, life: 4 + Math.random() * 5, max: 9, s: 1, seed: Math.random() * 100,
    };
    switch (world) {
      case 1: // petales et graines de pissenlit
        p.vx = 20 + Math.random() * 40;
        p.vy = 14 + Math.random() * 22;
        p.s = 0.6 + Math.random() * 0.9;
        break;
      case 2: // lucioles
        p.vx = (Math.random() - 0.5) * 22;
        p.vy = -8 - Math.random() * 16;
        p.s = 0.5 + Math.random() * 0.7;
        break;
      case 3: // spores / brume
        p.vx = (Math.random() - 0.5) * 10;
        p.vy = -4 - Math.random() * 10;
        p.s = 0.8 + Math.random() * 1.6;
        break;
      case 5: // braises
        p.vx = (Math.random() - 0.5) * 26;
        p.vy = -40 - Math.random() * 50;
        p.s = 0.4 + Math.random() * 0.7;
        break;
      default:
        break;
    }
    this.ambient.push(p);
  }

  /** Particules d'ambiance dessinees dans l'espace monde. */
  drawAmbient(ctx: Ctx, t: number) {
    const world = this.level.def.world;
    for (const a of this.ambient) {
      const k = clamp01(a.life / a.max);
      switch (world) {
        case 1: {
          ctx.save();
          ctx.translate(a.x, a.y);
          ctx.rotate(t * 2 + a.seed);
          ctx.globalAlpha = 0.75 * k;
          ctx.beginPath();
          ctx.ellipse(0, 0, 5 * a.s, 3 * a.s, 0, 0, TAU);
          ctx.fillStyle = a.seed % 2 > 1 ? '#ffd7e8' : '#fff0c2';
          ctx.fill();
          ctx.restore();
          break;
        }
        case 2: {
          const fl = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + a.seed));
          glow(ctx, a.x, a.y, 22 * a.s * fl, '#ffe08a', 0.5 * k * fl);
          ctx.beginPath();
          ctx.arc(a.x, a.y, 2 * a.s, 0, TAU);
          ctx.fillStyle = `rgba(255,240,180,${k * fl})`;
          ctx.fill();
          break;
        }
        case 3: {
          ctx.beginPath();
          ctx.arc(a.x, a.y, 12 * a.s, 0, TAU);
          ctx.fillStyle = `rgba(150,240,200,${0.08 * k})`;
          ctx.fill();
          break;
        }
        case 5: {
          glow(ctx, a.x, a.y, 14 * a.s, '#ff9b3a', 0.4 * k);
          ctx.beginPath();
          ctx.arc(a.x, a.y, 1.8 * a.s, 0, TAU);
          ctx.fillStyle = `rgba(255,200,120,${k})`;
          ctx.fill();
          break;
        }
        default:
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Overlay ecran : brume au sol, pluie, teinte ambiante, lumieres, vignette.
   * A appeler APRES les entites, en coordonnees ecran.
   */
  drawOverlay(ctx: Ctx, cam: Camera, t: number, lightSources: { x: number; y: number; r: number; color: string; intensity: number }[]) {
    const p = this.pal;
    const world = this.level.def.world;

    // 1) Brume au sol (mondes 3 et 4)
    if (p.fogAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = p.fogAlpha;
      const fogPasses = this.quality < 0.75 ? 1 : 3;
      for (let i = 0; i < fogPasses; i++) {
        const off = ((t * (8 + i * 5) - cam.x * 0.3) % (cam.sw + 400)) - 200;
        const y = cam.sh * (0.55 + i * 0.16);
        const g = ctx.createRadialGradient(off, y, 0, off, y, 420);
        g.addColorStop(0, rgba(p.fog, 0.7));
        g.addColorStop(1, rgba(p.fog, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, y - 260, cam.sw, 520);
        const g2 = ctx.createRadialGradient(cam.sw - off, y + 60, 0, cam.sw - off, y + 60, 380);
        g2.addColorStop(0, rgba(p.fog, 0.5));
        g2.addColorStop(1, rgba(p.fog, 0));
        ctx.fillStyle = g2;
        ctx.fillRect(0, y - 200, cam.sw, 480);
      }
      ctx.restore();
    }

    // 2) Teinte ambiante (multiply)
    if (p.ambientAlpha > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = rgba(p.ambient, p.ambientAlpha * 1.35);
      ctx.fillRect(0, 0, cam.sw, cam.sh);
      ctx.restore();
    }

    // 3) Lumieres additives
    if (lightSources.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lightSources) {
        const sx = (l.x - cam.x) * cam.zoom;
        const sy = (l.y - cam.y) * cam.zoom;
        const lr = l.r * cam.zoom;
        if (sx < -lr || sy < -lr || sx > cam.sw + lr || sy > cam.sh + lr) continue;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, lr);
        g.addColorStop(0, rgba(l.color, 0.42 * l.intensity));
        g.addColorStop(0.5, rgba(l.color, 0.14 * l.intensity));
        g.addColorStop(1, rgba(l.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(sx - lr, sy - lr, lr * 2, lr * 2);
      }
      ctx.restore();
    }

    // 4) Rayons de lumiere (monde 1) / halo (monde 5)
    if (world === 1 && this.quality >= 0.75) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Rayons de soleil : fondus vers le bas pour eviter tout effet de bande
      const rayGrad = ctx.createLinearGradient(0, 0, 0, cam.sh);
      rayGrad.addColorStop(0, 'rgba(255,242,192,0.5)');
      rayGrad.addColorStop(0.6, 'rgba(255,242,192,0.12)');
      rayGrad.addColorStop(1, 'rgba(255,242,192,0)');
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = rayGrad;
      for (let i = 0; i < 3; i++) {
        const x = cam.sw * (0.62 + i * 0.16) - cam.x * 0.05;
        ctx.beginPath();
        ctx.moveTo(x, -50);
        ctx.lineTo(x + 210, -50);
        ctx.lineTo(x - 260 + i * 40, cam.sh + 50);
        ctx.lineTo(x - 500 + i * 40, cam.sh + 50);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 5) Pluie (monde 4)
    if (world === 4) this.drawRain(ctx, cam, t);

    // 6) Vignette
    if (p.vignette > 0) {
      const g = ctx.createRadialGradient(cam.sw / 2, cam.sh / 2, Math.min(cam.sw, cam.sh) * 0.32, cam.sw / 2, cam.sh / 2, Math.max(cam.sw, cam.sh) * 0.78);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${p.vignette})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cam.sw, cam.sh);
    }

    // 7) Eclair
    if (this.lightning > 0.02) {
      ctx.fillStyle = `rgba(210,225,255,${this.lightning * 0.28})`;
      ctx.fillRect(0, 0, cam.sw, cam.sh);
    }
  }

  private drawRain(ctx: Ctx, cam: Camera, t: number) {
    const count = Math.floor(260 * this.quality);
    ctx.save();
    ctx.strokeStyle = 'rgba(190,215,255,0.42)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const sp = 900 + hash2(i, 1, 51) * 700;
      const x = (hash2(i, 2, 52) * (cam.sw + 400) + t * 180 - cam.x * 0.4) % (cam.sw + 400) - 200;
      const y = (hash2(i, 3, 53) * (cam.sh + 400) + t * sp - cam.y * 0.4) % (cam.sh + 400) - 200;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 9, y + 26);
    }
    ctx.stroke();
    // Gouttes proches, plus floues
    ctx.strokeStyle = 'rgba(210,230,255,0.22)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let i = 0; i < count * 0.25; i++) {
      const x = (hash2(i, 4, 54) * (cam.sw + 400) + t * 260 - cam.x * 0.7) % (cam.sw + 400) - 200;
      const y = (hash2(i, 5, 55) * (cam.sh + 400) + t * 1500) % (cam.sh + 400) - 200;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 16, y + 46);
    }
    ctx.stroke();
    ctx.restore();
  }
}
