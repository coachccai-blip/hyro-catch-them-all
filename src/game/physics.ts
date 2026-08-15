/**
 * Collisions sur grille et navigation.
 * Modele : cercle contre cellules, resolution axe par axe (glissement le long
 * des murs), plus un steering a 8 directions pour l'IA (pas de A* : les cartes
 * sont ouvertes, l'evitement local suffit et coute bien moins cher).
 */

import { TAU, clamp, dist2, type Vec2 } from '../core/math';
import { CELL, TERR } from '../levels/types';
import type { GeneratedLevel } from '../levels/generator';

export interface MoveCaps {
  /** Peut traverser les gouffres (dash, planeur, vol). */
  gap?: boolean;
  /** Peut traverser l'eau. */
  water?: boolean;
  /** Peut marcher sur les plateformes hautes. */
  ledge?: boolean;
  /** Vol : ignore tout sauf les murs pleins. */
  fly?: boolean;
}

export class Nav {
  level: GeneratedLevel;

  constructor(level: GeneratedLevel) {
    this.level = level;
  }

  terrainAt(x: number, y: number): number {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= this.level.cols || cy >= this.level.rows) return TERR.VOID;
    return this.level.grid[cy * this.level.cols + cx];
  }

  terrainAtCell(cx: number, cy: number): number {
    if (cx < 0 || cy < 0 || cx >= this.level.cols || cy >= this.level.rows) return TERR.VOID;
    return this.level.grid[cy * this.level.cols + cx];
  }

  setCell(cx: number, cy: number, t: number) {
    if (cx < 0 || cy < 0 || cx >= this.level.cols || cy >= this.level.rows) return;
    this.level.grid[cy * this.level.cols + cx] = t;
  }

  /** Une cellule bloque-t-elle cette entite ? */
  cellSolid(t: number, caps: MoveCaps): boolean {
    switch (t) {
      case TERR.VOID:
        return !caps.fly;
      case TERR.WALL:
        return true;
      case TERR.LEDGE:
        return !caps.ledge && !caps.fly;
      case TERR.WATER:
        return !caps.water && !caps.fly;
      case TERR.GAP:
        return !caps.gap && !caps.fly;
      default:
        return false;
    }
  }

  /** Le cercle (x,y,r) chevauche-t-il une cellule bloquante ? */
  blocked(x: number, y: number, r: number, caps: MoveCaps): boolean {
    const c0 = Math.floor((x - r) / CELL);
    const c1 = Math.floor((x + r) / CELL);
    const r0 = Math.floor((y - r) / CELL);
    const r1 = Math.floor((y + r) / CELL);
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const t = this.terrainAtCell(cx, cy);
        if (!this.cellSolid(t, caps)) continue;
        // Chevauchement cercle / rectangle
        const nx = clamp(x, cx * CELL, cx * CELL + CELL);
        const ny = clamp(y, cy * CELL, cy * CELL + CELL);
        if (dist2(x, y, nx, ny) < r * r) return true;
      }
    }
    return false;
  }

  /** Deplace une entite avec glissement. Retourne true si un mur a ete touche. */
  moveAndSlide(ent: { x: number; y: number; r: number }, dx: number, dy: number, caps: MoveCaps): boolean {
    let hit = false;
    if (dx !== 0) {
      const nx = ent.x + dx;
      if (!this.blocked(nx, ent.y, ent.r, caps)) ent.x = nx;
      else {
        hit = true;
        // Petit "pas de cote" pour ne pas rester coince sur un angle
        const step = Math.sign(dx) * Math.min(Math.abs(dx), 3);
        if (!this.blocked(ent.x + step, ent.y, ent.r, caps)) ent.x += step;
      }
    }
    if (dy !== 0) {
      const ny = ent.y + dy;
      if (!this.blocked(ent.x, ny, ent.r, caps)) ent.y = ny;
      else {
        hit = true;
        const step = Math.sign(dy) * Math.min(Math.abs(dy), 3);
        if (!this.blocked(ent.x, ent.y + step, ent.r, caps)) ent.y += step;
      }
    }
    return hit;
  }

  /** Ligne de vue : bloquee par les murs pleins uniquement. */
  lineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (CELL * 0.5));
    if (steps <= 0) return true;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const ter = this.terrainAt(x, y);
      if (ter === TERR.WALL || ter === TERR.VOID) return false;
    }
    return true;
  }

  /**
   * Steering : choisit parmi 8 directions celle qui approche le plus du but
   * tout en restant praticable sur une courte distance.
   */
  steer(x: number, y: number, r: number, goalX: number, goalY: number, caps: MoveCaps, away = false): Vec2 {
    const gx = goalX - x;
    const gy = goalY - y;
    const gl = Math.hypot(gx, gy) || 1;
    const dx = (away ? -gx : gx) / gl;
    const dy = (away ? -gy : gy) / gl;
    let best: Vec2 = { x: 0, y: 0 };
    let bestScore = -Infinity;
    const probe = CELL * 0.9;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      const align = cx * dx + cy * dy;
      let clearance = 1;
      if (this.blocked(x + cx * probe, y + cy * probe, r, caps)) clearance = 0;
      else if (this.blocked(x + cx * probe * 1.8, y + cy * probe * 1.8, r, caps)) clearance = 0.45;
      const score = align + clearance * 1.15;
      if (clearance === 0) continue;
      if (score > bestScore) {
        bestScore = score;
        best = { x: cx, y: cy };
      }
    }
    if (bestScore === -Infinity) return { x: -dx, y: -dy };
    return best;
  }

  /** Point praticable aleatoire autour d'une position. */
  randomWalkableNear(x: number, y: number, radius: number, caps: MoveCaps, tries = 24): Vec2 {
    for (let i = 0; i < tries; i++) {
      const a = Math.random() * TAU;
      const d = Math.random() * radius;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      if (!this.blocked(px, py, 12, caps)) return { x: px, y: py };
    }
    return { x, y };
  }

  /** Repousse une entite hors d'un mur (securite anti-blocage). */
  unstick(ent: { x: number; y: number; r: number }, caps: MoveCaps) {
    if (!this.blocked(ent.x, ent.y, ent.r, caps)) return;
    for (let ring = 1; ring <= 6; ring++) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const nx = ent.x + Math.cos(a) * ring * 10;
        const ny = ent.y + Math.sin(a) * ring * 10;
        if (!this.blocked(nx, ny, ent.r, caps)) {
          ent.x = nx;
          ent.y = ny;
          return;
        }
      }
    }
  }
}
