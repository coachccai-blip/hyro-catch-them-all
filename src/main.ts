/**
 * Point d'entree : initialise le canvas, charge les eventuels PNG de
 * remplacement, puis lance l'ecran titre.
 */

import { Game } from './core/game';
import { overrides } from './render/overrides';
import { TitleScene } from './scenes/title';
import { getLevel } from './levels/levels';

/**
 * Installation sur l'écran d'accueil : Chrome/Android émet cet événement quand
 * le jeu est installable. On le met de côté pour proposer un bouton
 * « Installer » sur l'écran titre.
 */
declare global {
  interface Window {
    __hyroInstall?: { prompt: () => void } | null;
  }
}

window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  window.__hyroInstall = e as unknown as { prompt: () => void };
});
window.addEventListener('appinstalled', () => {
  window.__hyroInstall = null;
});

/** Service worker : jeu jouable hors ligne et démarrage instantané. */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!location.protocol.startsWith('http')) return; // inutile en file://
  const go = () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* hors ligne indisponible : le jeu fonctionne quand meme */
    });
  };
  // Le boot est asynchrone : l'evenement `load` peut deja etre passe ici,
  // auquel cas il faut enregistrer tout de suite.
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

function fatal(message: string) {
  const el = document.getElementById('fatal');
  if (el) {
    el.style.display = 'block';
    el.textContent = `HYRO — erreur au démarrage\n\n${message}`;
  }
  document.getElementById('boot')?.classList.add('hidden');
}

window.addEventListener('error', (e) => {
  // On n'affiche l'ecran d'erreur que si le jeu n'a jamais demarre.
  if (!(window as unknown as { __hyroStarted?: boolean }).__hyroStarted) {
    fatal(String(e.message ?? e));
  }
});

async function boot() {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) {
    fatal('Canvas introuvable.');
    return;
  }
  try {
    // Les PNG d'override sont optionnels : leur absence est normale.
    await overrides.load();
    const game = new Game(canvas);
    // ?level=3-2 permet de lancer directement un niveau (tests, partage de lien).
    const wanted = new URLSearchParams(location.search).get('level');
    const target = wanted ? getLevel(wanted) : undefined;
    if (target) {
      const { PlayScene } = await import('./scenes/play');
      game.push(new PlayScene(target.id));
    } else {
      game.push(new TitleScene());
    }
    game.start();
    registerServiceWorker();
    (window as unknown as { __hyroStarted: boolean }).__hyroStarted = true;
    (window as unknown as { hyro: Game }).hyro = game;
    window.setTimeout(() => document.getElementById('boot')?.classList.add('hidden'), 260);
  } catch (err) {
    fatal(err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err));
  }
}

void boot();
