/**
 * Produit `dist/hyro.html` : le jeu entier dans UN seul fichier HTML.
 *
 * Utile pour jouer hors ligne (double-clic sur le fichier), pour partager le
 * jeu sans serveur, ou comme solution de repli si GitHub Pages n'est pas
 * encore activé sur le dépôt.
 *
 * Usage : npm run build:single   (lance `vite build` puis ce script)
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

let html = readFileSync(join(dist, 'index.html'), 'utf8');

// Inline du bundle JS (un seul chunk produit par Vite)
const assets = readdirSync(join(dist, 'assets'));
const jsFile = assets.find((f) => f.endsWith('.js'));
if (!jsFile) throw new Error('Bundle JS introuvable dans dist/assets');
const js = readFileSync(join(dist, 'assets', jsFile), 'utf8');

html = html.replace(
  /<script[^>]*src="[^"]*"[^>]*><\/script>/,
  `<script type="module">\n${js}\n</script>`,
);

// Inline des CSS éventuels
const cssFile = assets.find((f) => f.endsWith('.css'));
if (cssFile) {
  const css = readFileSync(join(dist, 'assets', cssFile), 'utf8');
  html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/, `<style>\n${css}\n</style>`);
}

writeFileSync(join(dist, 'hyro.html'), html);
console.log(`dist/hyro.html — ${(html.length / 1024).toFixed(0)} kB (fichier unique, hors ligne)`);
