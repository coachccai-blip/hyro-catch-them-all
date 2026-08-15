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
- **Hors ligne** : `npm run build:single` produit `dist/hyro.html`, le jeu
  entier dans un seul fichier — il suffit de double-cliquer dessus.
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
| Saut | `Espace` |
| Épée | clic droit ou `R` |
| Gadget | `Maj` ou `F` |
| Changer de gadget | `X` / `C`, molette, ou `1`–`8` |
| Interagir / terminer le niveau | `E` |
| Pause | `Échap` |
| Debug (hitboxes, cônes de vision) | `F1` |

### Manette (Gamepad API)
Stick gauche : déplacement · Stick droit : visée · `RT` : filet · `A` : saut ·
`RB`/`Y` : épée · `LT` : gadget · `LB` : gadget suivant · `X` : interagir ·
`Start` : pause.
Vibration légère sur capture et sur coup reçu si la manette la supporte.

### Tactile
Joystick virtuel flottant à gauche, glissement à droite pour viser (relâcher
lance le filet), plus des boutons larges : filet, épée, saut, gadget, cycle,
`E`, pause.

Toutes les touches clavier et manette sont **reconfigurables** dans les options.

---

## Contenu

- **Verticalité** : chaque monde comporte des structures surélevées (terrasses
  de jardin, toits d'étals, passerelles d'égout, toitures, caillebotis d'usine).
  Le saut permet d'y grimper et de franchir les petits trous ; **certaines
  souris se planquent en hauteur** et sont intouchables depuis le sol — il faut
  monter sur la structure, les attraper en plein saut, ou fondre dessus au
  planeur.
- **7 types de souris**, identifiables par la couleur du bandana **et** par un
  symbole distinct (daltonisme) : Trouillarde ▲, Flâneuse ●, Bagarreuse ✚,
  Sprinteuse ◆, Ingénieuse ★, Ombre ☾, Blanche ✦ (1 par niveau, très cachée).
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
Le schéma est **versionné** avec migration douce ; la réinitialisation demande
une **double confirmation**.

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

## Performance & accessibilité

- Cible 60 FPS desktop, 30–60 FPS mobile : sol pré-cuit, culling hors écran,
  particules poolées, halos et ombres pré-rendus, qualité adaptative
  automatique si les FPS chutent (réglable dans les options).
- Texte contrasté et cerclé, option texte agrandi, réduction du tremblement
  d'écran, symboles en plus des couleurs pour les bandanas, aide à la visée
  activable, pause à tout moment.
