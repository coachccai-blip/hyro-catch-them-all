/**
 * Localisation FR / EN. Une seule table, cle -> [fr, en].
 * `t()` retombe sur le francais si une cle manque.
 */

import type { Lang } from '../save/store';

type Entry = [string, string];

const DICT: Record<string, Entry> = {
  play: ['JOUER', 'PLAY'],
  continue: ['CONTINUER', 'CONTINUE'],
  newGame: ['NOUVELLE PARTIE', 'NEW GAME'],
  options: ['OPTIONS', 'OPTIONS'],
  credits: ['CRÉDITS', 'CREDITS'],
  install: ['INSTALLER LE JEU', 'INSTALL GAME'],
  back: ['Retour', 'Back'],
  worlds: ['MONDES', 'WORLDS'],
  selectWorld: ['Choisis un monde', 'Choose a world'],
  selectLevel: ['Choisis un niveau', 'Choose a level'],
  locked: ['Verrouillé', 'Locked'],
  finishPrev: ['Termine le niveau précédent', 'Finish the previous level'],
  mice: ['Souris', 'Mice'],
  rareMouse: ['Souris Blanche', 'White Mouse'],
  needed: ['Gadget requis', 'Gadget needed'],
  best: ['Record', 'Best'],
  quota: ['Objectif', 'Goal'],
  resume: ['Reprendre', 'Resume'],
  restart: ['Recommencer', 'Restart'],
  quit: ['Quitter le niveau', 'Quit level'],
  pause: ['PAUSE', 'PAUSED'],
  music: ['Musique', 'Music'],
  sfx: ['Effets sonores', 'Sound FX'],
  language: ['Langue', 'Language'],
  shake: ['Tremblement écran', 'Screen shake'],
  bigText: ['Texte agrandi', 'Larger text'],
  contrast: ['Contraste élevé', 'High contrast'],
  aimAssist: ['Aide à la visée', 'Aim assist'],
  showFps: ['Afficher les FPS', 'Show FPS'],
  quality: ['Qualité / résolution', 'Quality / resolution'],
  qualityAuto: ['Auto', 'Auto'],
  qualityLow: ['Basse', 'Low'],
  qualityHigh: ['Haute', 'High'],
  qualityHint: [
    'Auto ajuste la résolution pour tenir 60 FPS. Basse = plus fluide sur téléphone.',
    'Auto adjusts resolution to hold 60 FPS. Low = smoother on phones.',
  ],
  remapKeys: ['Configurer le clavier', 'Configure keyboard'],
  remapPad: ['Configurer la manette', 'Configure gamepad'],
  pressKey: ['Appuie sur une touche…', 'Press a key…'],
  pressPad: ['Appuie sur un bouton…', 'Press a button…'],
  resetSave: ['Réinitialiser la sauvegarde', 'Reset save'],
  resetConfirm1: ['Es-tu sûr ? Toute la progression sera perdue.', 'Are you sure? All progress will be lost.'],
  resetConfirm2: ['Dernière confirmation : effacer définitivement ?', 'Final confirmation: erase permanently?'],
  yes: ['Oui', 'Yes'],
  no: ['Non', 'No'],
  levelDone: ['NIVEAU TERMINÉ', 'LEVEL COMPLETE'],
  gameOver: ['HYRO EST K.O.', 'HYRO IS DOWN'],
  time: ['Temps', 'Time'],
  damage: ['Dégâts subis', 'Damage taken'],
  caught: ['Capturées', 'Caught'],
  medal: ['Note', 'Rank'],
  next: ['Niveau suivant', 'Next level'],
  retry: ['Réessayer', 'Retry'],
  levelSelect: ['Sélection de niveau', 'Level select'],
  newGadget: ['NOUVEAU GADGET !', 'NEW GADGET!'],
  totalProgress: ['Progression', 'Progress'],
  hintTitle: ['Astuce', 'Hint'],
  tapToStart: ['Touche / clic pour commencer', 'Tap / click to start'],
  controls: ['Contrôles', 'Controls'],
  move: ['Déplacement', 'Move'],
  aimNet: ['Viser / Filet', 'Aim / Net'],
  swordKey: ['Épée', 'Sword'],
  gadgetKey: ['Gadget', 'Gadget'],
  interactKey: ['Interagir', 'Interact'],
  cycleKey: ['Changer de gadget', 'Cycle gadget'],
  pauseKey: ['Pause', 'Pause'],
  goalReached: ['Objectif atteint ! Retourne au panier.', 'Goal reached! Return to the basket.'],
  finishHere: ['Terminer', 'Finish'],
  creditsBody: [
    'HYRO — Attrapez-les tous !\n\nUn jeu original : code, décors, personnages et musique\nsont générés procéduralement, sans aucun asset externe.\n\nMoteur maison en TypeScript + Canvas 2D.\nAudio synthétisé avec la Web Audio API.\n\nMerci d\'avoir joué !',
    'HYRO — Catch Them All!\n\nAn original game: code, scenery, characters and music\nare procedurally generated, with no external assets.\n\nCustom TypeScript + Canvas 2D engine.\nAudio synthesised with the Web Audio API.\n\nThanks for playing!',
  ],
};

let current: Lang = 'fr';

export function setLang(l: Lang) {
  current = l;
}

export function getLang(): Lang {
  return current;
}

export function t(key: string): string {
  const e = DICT[key];
  if (!e) return key;
  return current === 'en' ? e[1] : e[0];
}

/** Choisit entre deux variantes selon la langue (pour les donnees de niveau). */
export function pick(fr: string, en: string): string {
  return current === 'en' ? en : fr;
}
