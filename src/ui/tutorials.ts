/**
 * Encarts de tutoriel : courts, illustres, jamais un mur de texte.
 * Chaque encart n'apparait qu'une fois (memorise dans la sauvegarde).
 */

export interface TutorialCard {
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  /** Icone dessinee : gadget, arme ou souris. */
  icon: { kind: 'gadget' | 'mouse' | 'net' | 'sword' | 'mob'; id: string };
}

export const TUTORIALS: Record<string, TutorialCard> = {
  move: {
    title: 'Bienvenue, Hyro !',
    titleEn: 'Welcome, Hyro!',
    body: 'Déplace-toi avec ZQSD / WASD, les flèches, le stick ou le joystick tactile.',
    bodyEn: 'Move with WASD, arrows, the stick or the touch joystick.',
    icon: { kind: 'mouse', id: 'blue' },
  },
  net: {
    title: 'Le filet',
    titleEn: 'The net',
    body: 'Vise avec la souris (ou glisse à droite de l\'écran) puis lance le filet — Hyro le tient dans la main droite. Le cercle indique la zone d\'effet.',
    bodyEn: 'Aim with the mouse (or swipe on the right side) then throw the net — Hyro holds it in his right hand. The circle shows the effect area.',
    icon: { kind: 'net', id: 'net' },
  },
  quota: {
    title: 'Objectif',
    titleEn: 'Goal',
    body: 'Capture le quota affiché en haut à droite : le niveau se termine dès la dernière prise, inutile de revenir sur tes pas.',
    bodyEn: 'Catch the quota shown top-right: the level ends on the final capture — no need to walk back.',
    icon: { kind: 'mouse', id: 'yellow' },
  },
  dodge: {
    title: 'Ruée',
    titleEn: 'Dash',
    body: 'Maj (ou B à la manette) pour une ruée brève, rechargée en 1 seconde. Elle t\'offre quelques images d\'invincibilité : c\'est ta parade contre les mines, les bombes et les missiles.',
    bodyEn: 'Shift (or B on a gamepad) for a short dash, back in 1 second. It grants a few invulnerability frames — your answer to mines, bombs and missiles.',
    icon: { kind: 'sword', id: 'sword' },
  },
  chase: {
    title: 'Elles courent aussi vite que toi',
    titleEn: 'They run as fast as you',
    body: 'Impossible de rattraper une souris à la course : coupe-lui la route, coince-la, assomme-la, ou gagne du terrain à la ruée. Et méfie-toi — elle se retourne pour mordre. Un « ! » rouge annonce la charge.',
    bodyEn: 'You cannot outrun a fleeing mouse: cut it off, corner it, stun it, or close the gap with a dash. And watch out — it turns around to bite. A red "!" telegraphs the charge.',
    icon: { kind: 'mouse', id: 'blue' },
  },
  pounce: {
    title: 'Le bond',
    titleEn: 'The pounce',
    body: 'Lancer le filet vers une cible lointaine propulse Hyro dessus. C\'est ta seule façon de rattraper une souris — viser loin, c\'est bondir loin.',
    bodyEn: 'Throwing the net at a distant target launches Hyro at it. That is your only way to catch up with a mouse — aim far, leap far.',
    icon: { kind: 'net', id: 'net' },
  },
  streak: {
    title: 'Série',
    titleEn: 'Streak',
    body: 'Enchaîne les captures sans te faire toucher : la série monte. Un coup encaissé la brise **et libère ta dernière prise**, qui repart en courant. Protège ton panier !',
    bodyEn: 'Chain captures without getting hit and the streak climbs. One hit breaks it **and frees your last catch**, which runs off. Protect your basket!',
    icon: { kind: 'mouse', id: 'white' },
  },
  wheel: {
    title: 'La roue des gadgets',
    titleEn: 'The gadget wheel',
    body: 'Maintiens Tab (ou clic molette, R3, bouton ◎) : le temps ralentit, pointe un gadget et relâche — il est choisi et déclenché d\'un coup.',
    bodyEn: 'Hold Tab (or middle click, R3, the ◎ button): time slows, point at a gadget and release — it is picked and fired in one move.',
    icon: { kind: 'gadget', id: 'radar' },
  },
  holes: {
    title: 'Trous de souris',
    titleEn: 'Mouse holes',
    body: 'Les souris se faufilent dans des trous que tu ne peux pas emprunter, et ressortent ailleurs. Un tir de glue en bouche un : c\'est la parade.',
    bodyEn: 'Mice slip into holes you cannot use and pop out elsewhere. A glue shot plugs one — that is the counter.',
    icon: { kind: 'mouse', id: 'yellow' },
  },
  traps: {
    title: 'Souris armées',
    titleEn: 'Armed mice',
    body: 'Chaque bandana a son arme : bombes (rouge), mines (noire), chapelet de mines en fuite (verte), missiles téléguidés (violette, blanche). Tout est visible avant d\'exploser — et un coup d\'épée désamorce.',
    bodyEn: 'Each bandana has its weapon: bombs (red), mines (black), a mine trail while fleeing (green), homing missiles (purple, white). Everything is telegraphed — and a sword swing defuses it.',
    icon: { kind: 'mouse', id: 'red' },
  },
  jump: {
    title: 'Saut',
    titleEn: 'Jump',
    body: 'Espace (ou A à la manette) pour sauter : franchis les petits trous et grimpe sur les structures. Certaines souris se planquent en hauteur — impossible de les attraper depuis le sol.',
    bodyEn: 'Space (or A on a gamepad) to jump: clear small holes and climb onto structures. Some mice hide up high — you cannot net them from the ground.',
    icon: { kind: 'mouse', id: 'yellow' },
  },
  sword: {
    title: 'L\'épée',
    titleEn: 'The sword',
    body: 'Un arc frontal court : elle assomme les souris (étoiles) et élimine les mobs hostiles.',
    bodyEn: 'A short frontal arc: it stuns mice (stars) and kills hostile mobs.',
    icon: { kind: 'sword', id: 'sword' },
  },
  roach: {
    title: 'Cafard blindé',
    titleEn: 'Armoured roach',
    body: 'Lent mais il fonce en ligne droite. Deux coups d\'épée suffisent.',
    bodyEn: 'Slow but charges in a straight line. Two sword hits are enough.',
    icon: { kind: 'mob', id: 'roach' },
  },
  radar: {
    title: 'Radar à moustaches',
    titleEn: 'Whisker radar',
    body: 'Active-le pour révéler les souris cachées, les Ombres et les passages secrets.',
    bodyEn: 'Toggle it to reveal hidden mice, Shadows and secret passages.',
    icon: { kind: 'gadget', id: 'radar' },
  },
  hide: {
    title: 'Cachettes',
    titleEn: 'Hiding spots',
    body: 'Les souris se planquent dans les buissons et les caisses. Un coup d\'épée les débusque.',
    bodyEn: 'Mice hide in bushes and crates. A sword hit flushes them out.',
    icon: { kind: 'mouse', id: 'yellow' },
  },
  red: {
    title: 'Bagarreuse rouge',
    titleEn: 'Red brawler',
    body: 'Elle charge et frappe. Assomme-la à l\'épée avant de sortir le filet.',
    bodyEn: 'It charges and hits. Stun it with the sword before using the net.',
    icon: { kind: 'mouse', id: 'red' },
  },
  dash: {
    title: 'Dash-griffes',
    titleEn: 'Claw dash',
    body: 'Une ruée courte et invulnérable : elle franchit les petits gouffres et rattrape les fuyardes.',
    bodyEn: 'A short invulnerable dash: crosses small gaps and catches runaways.',
    icon: { kind: 'gadget', id: 'dash' },
  },
  miniboss: {
    title: 'Mini-boss',
    titleEn: 'Mini-boss',
    body: 'Une version géante rôde dans ce niveau. Le vaincre rend un cœur.',
    bodyEn: 'A giant version roams this level. Beating it restores a heart.',
    icon: { kind: 'mob', id: 'guard' },
  },
  crow: {
    title: 'Corbeau',
    titleEn: 'Crow',
    body: 'Il pique depuis les airs. Son ombre au sol annonce l\'attaque : esquive puis frappe.',
    bodyEn: 'It dives from above. Its ground shadow telegraphs the attack: dodge then strike.',
    icon: { kind: 'mob', id: 'crow' },
  },
  green: {
    title: 'Sprinteuse verte',
    titleEn: 'Green sprinter',
    body: 'Trop rapide pour le filet seul. Colle-la, assomme-la, ou tends une embuscade.',
    bodyEn: 'Too fast for the net alone. Glue it, stun it, or set an ambush.',
    icon: { kind: 'mouse', id: 'green' },
  },
  grapple: {
    title: 'Grappin-queue',
    titleEn: 'Tail grapple',
    body: 'Vise une souris pour l\'attirer, ou une plateforme / l\'autre rive pour t\'y hisser.',
    bodyEn: 'Aim at a mouse to pull it, or at a platform / far bank to hoist yourself over.',
    icon: { kind: 'gadget', id: 'grapple' },
  },
  glue: {
    title: 'Pistolet à glue',
    titleEn: 'Glue gun',
    body: 'Une flaque immobilise tout ce qui la traverse. Elle dissout aussi la glue adverse.',
    bodyEn: 'A puddle freezes whatever crosses it. It also dissolves enemy glue.',
    icon: { kind: 'gadget', id: 'glue' },
  },
  purple: {
    title: 'Ingénieuse violette',
    titleEn: 'Purple tinkerer',
    body: 'Elle garde ses distances et jette des objets. Approche par un flanc.',
    bodyEn: 'It keeps its distance and throws objects. Approach from a flank.',
    icon: { kind: 'mouse', id: 'purple' },
  },
  guard: {
    title: 'Rat de garde',
    titleEn: 'Guard rat',
    body: 'Trois points de vie et un gros coup. Celui qui garde une porte est incorruptible… sauf au fromage.',
    bodyEn: 'Three hit points and a heavy blow. A door guard is incorruptible… except with cheese.',
    icon: { kind: 'mob', id: 'guard' },
  },
  black: {
    title: 'Souris Ombre',
    titleEn: 'Shadow mouse',
    body: 'Quasi invisible : seul le radar la révèle, et seul le radar permet de la capturer.',
    bodyEn: 'Nearly invisible: only the radar reveals it, and only the radar lets you catch it.',
    icon: { kind: 'mouse', id: 'black' },
  },
  lure: {
    title: 'Leurre à fromage',
    titleEn: 'Cheese lure',
    body: 'Pose-le pour attirer souris et rats de garde. Idéal pour dégager une porte.',
    bodyEn: 'Drop it to attract mice and guard rats. Perfect for clearing a doorway.',
    icon: { kind: 'gadget', id: 'lure' },
  },
  skates: {
    title: 'Patins turbo',
    titleEn: 'Turbo skates',
    body: 'Très rapide mais bruyant, et tu glisses. Indispensable pour les grilles chronométrées.',
    bodyEn: 'Very fast but noisy, and you slide. Essential for timed gates.',
    icon: { kind: 'gadget', id: 'skates' },
  },
  drone: {
    title: 'Drone à fromage',
    titleEn: 'Cheese drone',
    body: 'Il tire des projectiles lents et télégraphiés. Déplace-toi latéralement.',
    bodyEn: 'It fires slow, telegraphed shots. Strafe sideways.',
    icon: { kind: 'mob', id: 'drone' },
  },
  boomerang: {
    title: 'Boomerang sonique',
    titleEn: 'Sonic boomerang',
    body: 'Assomme en arc de cercle et déclenche les interrupteurs hors de portée.',
    bodyEn: 'Stuns in an arc and triggers out-of-reach switches.',
    icon: { kind: 'gadget', id: 'boomerang' },
  },
  glider: {
    title: 'Cape planeur',
    titleEn: 'Glider cape',
    body: 'Maintiens la touche gadget pour planer au-dessus des grands vides.',
    bodyEn: 'Hold the gadget button to glide over wide chasms.',
    icon: { kind: 'gadget', id: 'glider' },
  },
  elite: {
    title: 'Élite de Nerat',
    titleEn: 'Nerat elite',
    body: 'Charge ET projectiles. Quatre points de vie : utilise les gadgets.',
    bodyEn: 'Charges AND shoots. Four hit points: use your gadgets.',
    icon: { kind: 'mob', id: 'elite' },
  },
  boss: {
    title: 'NERAT',
    titleEn: 'NERAT',
    body: 'Trois phases : esquive ses charges, monte sur les passerelles, puis colle-le et capture-le au filet géant.',
    bodyEn: 'Three phases: dodge his charges, climb the catwalks, then glue him and catch him with the giant net.',
    icon: { kind: 'mob', id: 'elite' },
  },
};
