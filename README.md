# HYRO — Attrapez-les tous !

Jeu d'action-capture 2.5D en vue de dessus, style cartoon anime.
Hyro, un chat agile, capture au filet des souris à bandana dans **cinq mondes**
de **cinq niveaux** semi-ouverts, débloque **huit gadgets** et affronte
**Nerat**, le gros rat noir, dans un combat final en trois phases.

> 100 % original, 100 % statique, 100 % généré en code : aucun asset, nom,
> musique ou personnage provenant d'une licence existante.

---

## Jouer

- **En ligne** : **https://coachccai-blip.github.io/hyro-catch-them-all/**
- **Sur téléphone (recommandé)** : ouvrez le lien, puis « Ajouter à l'écran
  d'accueil » (Android : menu ⋮ → *Installer l'application*, ou le bouton
  **INSTALLER LE JEU** de l'écran titre ; iOS : Partager → *Sur l'écran
  d'accueil*). Le jeu s'installe comme une app, démarre en plein écran sans
  barre de navigateur et **fonctionne ensuite entièrement hors ligne**.
- **Fichier unique** : `npm run build:single` produit `dist/hyro.html`, le jeu
  entier dans un seul fichier — il suffit de double-cliquer dessus, sans
  serveur ni connexion.
- **En local** :

```bash
npm install
npm run dev        # http://localhost:5173
```

Astuce : `?level=3-2` dans l'URL lance directement un niveau
(pratique pour tester ou partager un passage précis).

---

## Contrôles

### Clavier + souris
| Action | Touche |
|---|---|
| Déplacement | `ZQSD` / `WASD` / flèches (les deux jeux répondent, pas de config AZERTY à faire) |
| Viser | souris — le réticule colle exactement au curseur |
| Filet | clic gauche (portée : **un chat**, l'anneau autour d'Hyro la montre) |
| Gadget | **clic sur son emplacement** dans la barre du bas (sélectionne *et* déclenche) |
| Saut | `Espace` |
| Ruée / esquive | `Maj` (recharge 1 s) |
| Épée | clic droit ou `R` |
| Gadget | `F` |
| Changer de gadget | `X` / `C`, molette, ou `1`–`8` |
| Interagir / terminer le niveau | `E` |
| Pause | `Échap` |
| Debug (hitboxes, cônes de vision) | `F1` |

### Manette (Gamepad API)
Stick gauche : déplacement · Stick droit : visée · `RT` : filet · `A` : saut ·
`B` : ruée · `RB`/`Y` : épée · `LT` : gadget · `LB` : gadget suivant ·
`X` : interagir · `Start` : pause.
Vibration légère sur capture et sur coup reçu si la manette la supporte.

### Tactile
Joystick virtuel flottant à gauche, glissement à droite pour viser (relâcher
lance le filet), plus des boutons larges : filet, épée, saut, **ruée**, gadget,
cycle, `E`, pause. La **barre de gadgets du bas est tactile** : un appui sur un
emplacement le sélectionne et l'active d'un coup — pareil au clic souris.

Toutes les touches clavier et manette sont **reconfigurables** dans les options.

---

## Contenu

- **Objectif** : le niveau est gagné **dès la dernière souris du quota** —
  aucun aller-retour vers le panier. Chaque capture déclenche une
  **cinématique** : la caméra plonge sur la prise, l'écran part en lignes de
  vitesse et la souris est brandie dans le filet (0,9 s, interruptible d'une
  touche ; version longue et fanfare de victoire pour la dernière).
- **Verticalité** : chaque monde comporte des structures surélevées (terrasses
  de jardin, toits d'étals, passerelles d'égout, toitures, caillebotis d'usine).
  Le saut permet d'y grimper et de franchir les petits trous ; **certaines
  souris se planquent en hauteur** et sont intouchables depuis le sol — il faut
  monter sur la structure, les attraper en plein saut, ou fondre dessus au
  planeur.
- **Hyro** porte son bandana rouge **noué sur la tête** (pans qui flottent
  derrière lui) et tient son filet **dans la main droite** en permanence : au
  repos il pend le long du bras, et à chaque capture il part en arrière, balaie
  droit devant en laissant un sillage, la poche du filet se creusant à l'opposé
  du mouvement. Il passe automatiquement derrière ou devant le chat selon le
  côté qu'il balaie.
- **7 types de souris**, identifiables par la couleur du bandana **et** par un
  symbole distinct (daltonisme) : Trouillarde ▲, Flâneuse ●, Bagarreuse ✚,
  Sprinteuse ◆, Ingénieuse ★, Ombre ☾, Blanche ✦ (1 par niveau, très cachée).
- **Souris armées** — chaque bandana a son armement, et tout est **télégraphié
  et destructible**. Une mine pose un disque de déclenchement balayé par un
  radar, hérisse ses picots et fait clignoter sa diode (verte tant qu'elle
  s'arme, rouge ensuite) ; une bombe tourne en cloche, pulse de plus en plus
  vite, consume une mèche dont la longueur *est* le compte à rebours et
  projette au sol le cercle exact de son souffle ; un missile déploie une
  tuyère à trois couches, laisse fumée et braises, et **trace en pointillé la
  ligne qui le relie à sa cible**, réticule compris. Chaque explosion ouvre une
  boule de feu à cœur blanc, sept langues de flamme, deux ondes de choc, des
  éclats et un champignon de fumée. Un coup d'épée ou un passage de boomerang
  désamorce n'importe lequel.

| Bandana | Arme | Riposte | Trous | Esquive du filet |
|---|---|---|---|---|
| Trouillarde (bleu) | — | 4,6 s | non | non |
| Flâneuse (jaune) | — | 3,5 s | **oui** | oui |
| Bagarreuse (rouge) | bombes lancées en cloche | **1,5 s** | non | oui |
| Sprinteuse (vert) | chapelet de mines en fuite | 2,0 s | **oui** | oui |
| Ingénieuse (violet) | missiles téléguidés | 1,8 s | non | oui |
| Ombre (noir) | mines | 1,7 s | **oui** | oui |
| Blanche | missiles | **1,4 s** | **oui** | oui |

- **Elles courent aussi vite qu'Hyro.** Une seule constante gouverne les deux
  vitesses : on ne distance jamais une souris en fuite. Il faut la couper, la
  coincer, l'assommer, ou gagner du terrain à la ruée. La vitesse de
  *patrouille* reste plus basse — une souris qui ne t'a pas vu flâne.
- **Elles fuient en mordant.** Aucune ne se contente de courir : à intervalle
  régulier (colonne « Riposte »), elle se plante, se retourne — un « ! » rouge
  et un temps d'armement de 0,32 s la trahissent — puis charge, **cap figé au
  départ** : un pas de côté suffit à la faire mordre la poussière. La charge
  blesse au contact et s'arrête sur l'impact. Poursuivre en ligne droite sans
  lire l'armement coûte un cœur.
- **Une seule charge à la fois.** Un jeton global (0,95 s de battement, jamais
  pendant les images d'invincibilité) empêche la meute de prendre Hyro en
  tenailles : la difficulté doit venir de la lecture, pas du nombre. Sans ce
  garde-fou, mesuré au bot, le niveau 1-1 devenait mortel.
- **Mordre puis décrocher.** Une souris qui touche Hyro repart aussitôt en
  fuite pendant ~1,6 s. La parité de vitesse vaut pour la **fuite** ; en
  poursuite elle reste un cran en dessous (88 %). Sans ces deux règles,
  mesuré au navigateur, une Bagarreuse se colle à 27 px — la distance de
  contact exacte — et vide les cinq cœurs sans qu'aucune fuite, dans un décor
  encombré, ne puisse rompre le contact.
- **Répit de départ** de 2 s, et **trêve pendant les encarts de tutoriel** :
  Hyro apparaît parfois à portée d'une souris agressive, et il n'a pas la main
  tant qu'une fiche est affichée.

- **Ruée d'Hyro** — `Maj` / `B`, recharge **1 seconde**, quelques images
  d'invincibilité. C'est la réponse aux mines, bombes et missiles. Elle ne
  franchit **pas** les gouffres : le Dash-griffes garde tout son rôle de clé
  de progression.
- **Trous de souris** — dix passages par niveau, appariés deux à deux, que
  seules les souris empruntent : elles y disparaissent et ressortent ailleurs
  sur la carte. Un tir de **glue** en bouche un ; une souris qui vient de
  ressortir ne peut pas replonger avant 7 s, pour qu'aucune ne devienne
  inattrapable.
- **5 mobs hostiles** : cafards blindés, corbeaux, rats de garde, drones à
  fromage, élites de Nerat. Un mini-boss au niveau 5 de chaque monde.
- **8 gadgets** débloqués progressivement — chacun ouvre d'anciennes zones, ce
  qui rend les niveaux précédents rejouables pour le 100 % :

| Gadget | Débloqué | Ouvre |
|---|---|---|
| Radar à moustaches | fin 1-2 | passages secrets, souris cachées et Ombres |
| Dash-griffes | fin 1-4 | petits gouffres |
| Grappin-queue | fin 2-3 | plateformes hautes, rivières |
| Pistolet à glue | fin 2-5 | couloirs englués, Sprinteuses |
| Leurre à fromage | fin 3-2 | portes gardées par un rat |
| Patins turbo | fin 3-5 | grilles chronométrées |
| Boomerang sonique | fin 4-2 | interrupteurs hors de portée |
| Cape planeur | fin 4-5 | grands vides |

Le sélecteur de niveau affiche, pour chaque niveau, les souris capturées, la
souris Blanche et **les gadgets encore manquants** pour le compléter à 100 %.

---

## Décors

Chaque monde a sa palette, sa lumière et ses éléments animés d'ambiance :

1. **Jardin de la Maison** — après-midi doré, herbes hautes qui ondulent, pots,
   nain de jardin, tuyau d'arrosage, pétales qui volent, rayons de soleil.
2. **Marché de Nuit** — lampions à halo scintillant, guirlandes, vapeur des
   stands, flaques réfléchissantes, lucioles, skyline éclairée en parallaxe.
3. **Égouts & Métro abandonné** — néons verdâtres qui grésillent, gouttes qui
   tombent, rails rouillés, wagon taggé, brume au sol, mousse.
4. **Toits sous la Pluie** — pluie sur deux couches, éclairs et tonnerre, linge
   qui claque au vent, cheminées fumantes, enseignes néon, antennes.
5. **Forteresse Fromagère** — meules géantes, engrenages qui tournent, cuves,
   bannières à l'effigie de Nerat, fondue incandescente, braises.

Détails narratifs communs : empreintes de pattes qui mènent aux cachettes,
graffitis de souris sur les murs, tas de fromages volés (plus gros près des
zones verrouillées).

Techniquement : ciel + 3 couches de parallaxe, sol **cuit par chunks** (cache
LRU) pour ne peindre la texture qu'une fois, props triés par profondeur pour
l'effet 2.5D, lumières additives, brume, teinte ambiante et vignette par monde.

---

## Audio

Tout est synthétisé avec la Web Audio API : un thème par monde, thème titre,
thème de boss, jingles, et un SFX distinct par événement (filet, capture, épée,
assommage, cri d'alerte, pas selon la surface, chaque gadget, UI).
Volumes musique et effets réglables séparément, avec ducking sur les jingles.

---

## Sauvegarde

Automatique dans le `localStorage` : niveaux terminés, souris capturées par
identifiant (suivi des Blanches), gadgets, médailles, options et remapping.
Le schéma est **versionné** avec migration douce (la v4 déplace `Maj` du
gadget vers la ruée sans casser un remapping existant) ; la réinitialisation
demande une **double confirmation**.

---

## Structure du projet

```
hyro/
├─ src/
│  ├─ core/       boucle de jeu, scènes, entrées unifiées, maths, RNG
│  ├─ render/     palettes, primitives, props, personnages, monde, overrides
│  ├─ game/       joueur, souris, mobs, boss, gadgets, physique, particules
│  ├─ levels/     types, données des 25 niveaux, générateur déterministe
│  ├─ ui/         HUD, widgets de menu, tutoriels, i18n FR/EN
│  ├─ audio/      synthèse musique + SFX
│  ├─ save/       localStorage + migrations
│  ├─ scenes/     titre, mondes, niveaux, jeu, pause, résultats, options, crédits
│  └─ main.ts
├─ public/assets/overrides/   PNG optionnels remplaçant le rendu procédural
└─ .github/workflows/deploy.yml
```

Les niveaux sont des **données déclaratives** (`src/levels/levels.ts`) : la
géométrie est générée à partir d'un `seed`, donc identique d'une partie à
l'autre. Ajouter un niveau, un type de souris ou un gadget se fait en ajoutant
une entrée dans le tableau correspondant.

---

## Remplacer un dessin par un PNG

Tout le rendu est procédural, mais chaque élément peut être remplacé par une
image sans toucher au code :

1. Déposez vos PNG dans `public/assets/overrides/`.
2. Créez `public/assets/overrides/manifest.json` :

```json
{
  "hyro/body":   { "file": "hyro.png",   "anchor": [0.5, 0.9], "scale": 1 },
  "mouse/red":   { "file": "souris_rouge.png" },
  "mob/roach":   "cafard.png",
  "prop/bush":   { "file": "buisson.png", "anchor": [0.5, 0.85] },
  "boss/nerat":  { "file": "nerat.png" }
}
```

`anchor` est le point d'ancrage dans l'image (`[0.5, 0.85]` = centre-bas, la
valeur par défaut). Si une clé est absente, le rendu procédural est conservé.
Clés disponibles : `hyro/body`, `mouse/<bandana>`, `mob/<type>`, `boss/nerat`,
`prop/<kind>` (tous les `kind` de `src/render/props.ts`).

---

## Build & déploiement

```bash
npm run build      # typecheck + build statique dans dist/
npm run preview    # sert dist/ en local
```

Le workflow `.github/workflows/deploy.yml` construit et publie automatiquement
sur **GitHub Pages** à chaque push (Pages est activé par le workflow lui-même).
Le build utilise des chemins relatifs (`base: './'`), donc `dist/` fonctionne
aussi bien à la racine d'un domaine que dans un sous-dossier.

---

## Performance

Le jeu est limité par le **remplissage de pixels** (ciel, brume, lumières,
vignette et décors se superposent), pas par le JavaScript : mesuré au
navigateur, la logique tient en ~1 ms par image, tout le reste est de la
rasterisation. Les optimisations suivent donc cette contrainte :

- **Résolution de rendu adaptative** — le levier principal. Le jeu mesure la
  médiane du temps d'image et ajuste la résolution interne pour tenir 60 FPS ;
  l'image est ensuite ré-étirée par le navigateur, ce qui reste propre sur des
  aplats cartoon. Sur téléphone il démarre volontairement un cran en dessous
  puis remonte si l'appareil suit. Réglable dans les options (Auto / Basse /
  Haute).
- **Ambiance pré-composée** — teinte ambiante et vignette sont fusionnées dans
  une seule image mise en cache : deux passes plein écran par image (dont un
  dégradé radial recréé à chaque fois) deviennent un simple blit.
- **Brume pré-rendue** en petite texture étirée, au lieu de six dégradés
  radiaux recalculés par image.
- **Halos et ombres** dessinés depuis des sprites mis en cache, **nombre de
  lumières borné** et trié par proximité, **flou d'ombre (`shadowBlur`)
  proscrit** — c'est l'opération la plus coûteuse du canvas 2D sur mobile.
- **Sol cuit par chunks** avec cache LRU (≈1,5 ms par chunk, aucun à-coup
  mesuré en déplacement), culling hors écran, particules poolées.

Résultat mesuré sur un profil téléphone (844×390, rendu logiciel, niveau le
plus chargé du jeu — 165 lumières, 850 décors) : **36 → 58 FPS**, sans aucune
image au-delà de 40 ms, et *sans* dégrader les effets. Sur un vrai GPU de
téléphone la marge est bien plus large.

Le **service worker** met le jeu en cache dès la première ouverture : les
lancements suivants sont instantanés et fonctionnent sans réseau.

## Accessibilité

- Qualité adaptative automatique (réglable dans les options).
- Texte contrasté et cerclé, option texte agrandi, réduction du tremblement
  d'écran, symboles en plus des couleurs pour les bandanas, aide à la visée
  activable, pause à tout moment.
