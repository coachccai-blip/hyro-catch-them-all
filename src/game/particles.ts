/**
 * Systeme de particules poole (aucune allocation en regime permanent).
 * Sert au feedback : capture, coups, pas, eclaboussures, etincelles...
 */

import { TAU, clamp01 } from '../core/math';
import { rgba, star, type Ctx } from '../render/draw';

export type ParticleKind =
  | 'poof' | 'star' | 'dust' | 'splash' | 'spark' | 'ring' | 'glue'
  | 'heart' | 'note' | 'ember' | 'feather' | 'text' | 'flash';

interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  spin: number;
  grav: number;
  drag: number;
  text?: string;
}

const MAX = 520;

export class Particles {
  private pool: Particle[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < MAX; i++) {
      this.pool.push({
        active: false, kind: 'dust', x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1,
        size: 4, color: '#fff', rot: 0, spin: 0, grav: 0, drag: 0.9,
      });
    }
  }

  clear() {
    for (const p of this.pool) p.active = false;
  }

  private alloc(): Particle {
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[(this.cursor + i) % MAX];
      if (!p.active) {
        this.cursor = (this.cursor + i + 1) % MAX;
        return p;
      }
    }
    // Tout est occupe : on recycle le plus ancien emplacement.
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % MAX;
    return p;
  }

  spawn(
    kind: ParticleKind, x: number, y: number, vx: number, vy: number,
    life: number, size: number, color: string,
    opts: { grav?: number; drag?: number; spin?: number; text?: string } = {},
  ) {
    const p = this.alloc();
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.size = size;
    p.color = color;
    p.rot = Math.random() * TAU;
    p.spin = opts.spin ?? (Math.random() - 0.5) * 6;
    p.grav = opts.grav ?? 0;
    p.drag = opts.drag ?? 0.9;
    p.text = opts.text;
  }

  // --- Effets pretsts a l'emploi -------------------------------------------

  burstCapture(x: number, y: number, color: string) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + Math.random() * 0.3;
      const sp = 110 + Math.random() * 160;
      this.spawn('star', x, y - 10, Math.cos(a) * sp, Math.sin(a) * sp - 60, 0.65, 7 + Math.random() * 5, i % 3 === 0 ? color : '#ffe066', { grav: 340, drag: 0.92 });
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * TAU;
      const sp = 40 + Math.random() * 110;
      this.spawn('poof', x, y - 8, Math.cos(a) * sp, Math.sin(a) * sp, 0.5, 14 + Math.random() * 14, '#ffffff', { drag: 0.86 });
    }
    this.spawn('ring', x, y, 0, 0, 0.42, 16, color);
  }

  burstHit(x: number, y: number, color = '#ffd166') {
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * TAU;
      const sp = 90 + Math.random() * 200;
      this.spawn('spark', x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.3, 4 + Math.random() * 4, color, { drag: 0.84 });
    }
  }

  dust(x: number, y: number, color: string, n = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = 20 + Math.random() * 50;
      this.spawn('dust', x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.4 - 12, 0.4, 5 + Math.random() * 6, color, { drag: 0.85 });
    }
  }

  splash(x: number, y: number, color: string) {
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const sp = 60 + Math.random() * 120;
      this.spawn('splash', x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.4, 3 + Math.random() * 4, color, { grav: 420 });
    }
    this.spawn('ring', x, y, 0, 0, 0.35, 10, color);
  }

  floatingText(x: number, y: number, text: string, color = '#ffffff') {
    this.spawn('text', x, y, 0, -46, 0.95, 24, color, { drag: 0.98, text });
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.grav * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }

  draw(ctx: Ctx) {
    for (const p of this.pool) {
      if (!p.active) continue;
      const k = clamp01(p.life / p.max);
      switch (p.kind) {
        case 'star':
          ctx.save();
          ctx.globalAlpha = k;
          star(ctx, p.x, p.y, p.size * (0.5 + k * 0.7), 0.45, 5, p.rot);
          ctx.fillStyle = p.color;
          ctx.fill();
          ctx.restore();
          break;
        case 'flash': {
          // Boule de feu : elle s'ouvre vite et s'eteint plus vite encore
          const e = 1 - k;
          ctx.globalAlpha = Math.pow(k, 0.55);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + e * 0.85), 0, TAU);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;
        }
        case 'poof':
          ctx.globalAlpha = k * 0.6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.5 - k * 0.6), 0, TAU);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;
        case 'ring':
          ctx.globalAlpha = k * 0.8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size + (1 - k) * 70, 0, TAU);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4 * k + 1;
          ctx.stroke();
          break;
        case 'spark':
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
          ctx.stroke();
          break;
        case 'text':
          ctx.save();
          ctx.globalAlpha = k;
          ctx.font = `900 ${p.size}px "Trebuchet MS", sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 5;
          ctx.strokeStyle = 'rgba(20,14,26,0.8)';
          ctx.strokeText(p.text ?? '', p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text ?? '', p.x, p.y);
          ctx.restore();
          break;
        case 'glue':
          ctx.globalAlpha = k * 0.8;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size, p.size * 0.5, p.rot, 0, TAU);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;
        default:
          ctx.globalAlpha = k * 0.85;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * k, p.size * k * 0.7, p.rot, 0, TAU);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
}
