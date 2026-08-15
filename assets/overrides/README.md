# assets/overrides

Dossier optionnel. Déposez ici des PNG pour remplacer le rendu procédural,
puis listez-les dans un fichier `manifest.json` placé dans ce même dossier :

```json
{
  "hyro/body":  { "file": "hyro.png", "anchor": [0.5, 0.9], "scale": 1 },
  "mouse/red":  { "file": "souris_rouge.png" },
  "mob/roach":  "cafard.png",
  "prop/bush":  { "file": "buisson.png" },
  "boss/nerat": { "file": "nerat.png" }
}
```

- `anchor` : point d'ancrage dans l'image, en fraction de sa taille.
  `[0.5, 0.85]` (défaut) = centré horizontalement, ancré près du bas — c'est ce
  qui aligne le sprite sur ses « pieds » pour le tri par profondeur.
- `scale` : multiplicateur de taille appliqué au rendu.
- Une valeur en chaîne simple (`"cafard.png"`) équivaut à `{ "file": "..." }`.

Toute clé absente du manifeste garde son dessin vectoriel d'origine.
L'absence totale de `manifest.json` est le cas normal : le jeu tourne alors
entièrement en rendu procédural.

Clés reconnues :

| Clé | Élément |
|---|---|
| `hyro/body` | Hyro |
| `mouse/yellow` `mouse/blue` `mouse/red` `mouse/green` `mouse/purple` `mouse/black` `mouse/white` | souris par bandana |
| `mob/roach` `mob/crow` `mob/guard` `mob/drone` `mob/elite` | mobs hostiles |
| `boss/nerat` | le boss final |
| `prop/<kind>` | n'importe quel décor (`bush`, `pot`, `lantern`, `crate`, `chimney`, `cheeseWheel`…) — la liste complète est dans `src/render/props.ts` |
