/**
 * Systeme de remplacement d'assets.
 *
 * Tout le jeu est dessine en code (vectoriel procedural). Mais si un PNG existe
 * dans `assets/overrides/`, il remplace automatiquement le rendu procedural.
 *
 * Fonctionnement :
 *  - `assets/overrides/manifest.json` liste les cles disponibles :
 *        { "hyro/idle": { "file": "hyro_idle.png", "anchor": [0.5, 0.85], "scale": 1 } }
 *  - Les fonctions de dessin appellent `overrides.draw(key, ctx, x, y, size, angle)`
 *    qui retourne `true` si un PNG a ete utilise (sinon on dessine en procedural).
 *
 * Le manifeste est optionnel : son absence est un cas normal (404 silencieux).
 */

export interface OverrideEntry {
  file: string;
  /** Point d'ancrage dans l'image (0..1). Par defaut le centre-bas. */
  anchor?: [number, number];
  /** Multiplicateur de taille applique au rendu. */
  scale?: number;
}

interface LoadedOverride {
  img: HTMLImageElement;
  anchor: [number, number];
  scale: number;
}

const BASE = 'assets/overrides/';

class OverrideRegistry {
  private map = new Map<string, LoadedOverride>();
  loaded = false;

  async load(): Promise<void> {
    try {
      const res = await fetch(`${BASE}manifest.json`, { cache: 'no-cache' });
      if (!res.ok) {
        this.loaded = true;
        return;
      }
      const manifest = (await res.json()) as Record<string, OverrideEntry | string>;
      const jobs: Promise<void>[] = [];
      for (const [key, raw] of Object.entries(manifest)) {
        const entry: OverrideEntry = typeof raw === 'string' ? { file: raw } : raw;
        jobs.push(
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              this.map.set(key, {
                img,
                anchor: entry.anchor ?? [0.5, 0.85],
                scale: entry.scale ?? 1,
              });
              resolve();
            };
            img.onerror = () => resolve();
            img.src = BASE + entry.file;
          }),
        );
      }
      await Promise.all(jobs);
    } catch {
      /* pas de manifeste : rendu 100 % procedural */
    }
    this.loaded = true;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  /**
   * Dessine le PNG de remplacement s'il existe.
   * @param size hauteur cible en pixels monde
   * @returns true si l'override a ete dessine
   */
  draw(
    key: string, ctx: CanvasRenderingContext2D,
    x: number, y: number, size: number, angle = 0, flipX = false,
  ): boolean {
    const o = this.map.get(key);
    if (!o) return false;
    const h = size * o.scale;
    const w = (o.img.width / o.img.height) * h;
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(o.img, -w * o.anchor[0], -h * o.anchor[1], w, h);
    ctx.restore();
    return true;
  }
}

export const overrides = new OverrideRegistry();
