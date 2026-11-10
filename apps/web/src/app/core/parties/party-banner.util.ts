import type { Theme } from '@master-jdr/shared';

/**
 * POINT DE DÉRIVATION UNIQUE de la bannière générative (AD-19, Story 29.10).
 *
 * Tout rendu de bannière — grande carte, vignette moyenne, vignette de liste — passe par
 * `bannerParams()`. Aucun composant ne tire une position, un angle, un compte ou une teinte :
 * deux implémentations produiraient deux bannières pour la même partie selon l'écran, et c'est
 * le vrai risque d'AD-19, avant même celui du stockage.
 *
 * **Rien n'est persisté.** Ni la graine, ni les paramètres tirés, ni le rendu. Le déterminisme
 * de ce fichier EST le mécanisme de stabilité : une même partie donne exactement la même
 * composition sur tous les appareils et à toutes les connexions. Ajouter du stockage « pour
 * garantir la stabilité » créerait une seconde source de vérité qui divergerait à la première
 * évolution des règles ci-dessous.
 *
 * **La graine dérive de l'identifiant de la partie et de lui seul** — ni le nom, ni la clé de
 * thème. Renommer une partie, ou renommer un thème (AD-13, Story 35.1), ne doit rien changer.
 * Le thème sélectionne le STYLE appliqué aux paramètres tirés ; il n'intervient pas dans le
 * tirage (cf. `dominant`, premier tirage du flux, identique pour les trois thèmes).
 *
 * Le monogramme, lui, est dérivé du NOM — il n'est pas tiré, il est lu. Aucune contradiction :
 * il ne passe pas par la graine (`partyMonogram()` est une fonction distincte).
 */

/** Espace de dessin normalisé de toute composition. Le cadrage par mode se fait en SVG
 *  (`preserveAspectRatio="xMidYMid slice"`), jamais en redessinant : c'est ce qui garantit
 *  qu'une seule composition sert les modes grand et moyen (AC3/AC4).
 *
 *  **320 × 124, et ce n'est pas arbitraire** (Story 29.11, Task 0a) : c'est la taille réelle de
 *  la zone `.cov` des maquettes (`iteration-6`/`iteration-7`), dont TOUTES les bornes de tirage
 *  ci-dessous sont issues. La Story 29.10 avait fixé 160 × 88 tout en recopiant ces bornes —
 *  chaque élément était donc rendu à environ le double de sa taille relative (rouages saturant
 *  le cadre, halos débordant en demi-cercles, manomètre occupant la moitié de la hauteur).
 *  Si ces constantes changent un jour, les bornes doivent changer avec elles, ou l'écart se
 *  reproduira à l'identique. */
export const BANNER_VIEWBOX_WIDTH = 320;
export const BANNER_VIEWBOX_HEIGHT = 124;

/** Les deux accents du thème actif. Le fichier ne connaît jamais de couleur littérale : il
 *  désigne un rôle, la feuille de style résout `--jdr-accent-1`/`--jdr-accent-2`. C'est ce qui
 *  permet au même tirage de rendre trois styles différents. */
export type BannerTint = 'accent-1' | 'accent-2';

// ─────────────────────────────────────────────────────────────────────────────
// Graine et générateur pseudo-aléatoire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hachage FNV-1a 32 bits de l'identifiant de la partie.
 *
 * Choix documenté (aucune AC ne le fixe) : court, sans dépendance, et surtout **déterministe et
 * stable dans le temps** — c'est la seule propriété qui compte ici. Jamais `Math.random()`,
 * jamais `Date`, jamais `crypto`.
 *
 * `Partie.id` est un UUID v4 (`schema.prisma`, `@default(uuid())`) : 36 caractères dont des
 * tirets à positions fixes, communs à tous les identifiants. On hache donc **la chaîne entière**
 * — un préfixe ou un fragment concentrerait l'entropie au mauvais endroit.
 */
export function bannerSeed(partieId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < partieId.length; i++) {
    hash ^= partieId.charCodeAt(i);
    // Multiplication par le prime FNV 16777619, en arithmétique 32 bits non signée.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Générateur pseudo-aléatoire mulberry32 — explicite et stable, comme l'exige DESIGN.md §7.3
 * (« pas `Math.random()` »). Retourne des valeurs dans [0, 1).
 */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entier dans [min, max] inclus. */
function pickInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Réel dans [min, max). */
function pickFloat(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Élément d'un tableau non vide. */
function pickOne<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Monogramme
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mots non significatifs écartés du monogramme. Liste proposée par la story (aucune AC ne la
 * fixe) : articles et contractions courants du français. Comparaison faite en minuscules,
 * accents conservés — aucun mot de cette liste n'en porte.
 */
const MONOGRAM_STOP_WORDS: ReadonlySet<string> = new Set([
  'le',
  'la',
  'les',
  'l',
  'un',
  'une',
  'des',
  'du',
  'de',
  'd',
  'au',
  'aux',
]);

/**
 * Initiales des **deux premiers mots significatifs** du nom, articles exclus, en capitales
 * (DESIGN.md §7.3) : « Les Cendres de Kavaan » → `CK`, « Le Convoi du Nord » → `CN`.
 * Un seul mot significatif → ses deux premières lettres.
 *
 * Repli défensif sur `?` : un nom vide ou entièrement composé d'articles ne doit pas produire une
 * vignette muette (même patron que `CharacterAvatar.initials()`).
 */
export function partyMonogram(name: string): string {
  // L'apostrophe (droite ou typographique) sépare : « L'Auberge » → ['l', 'auberge'].
  const words = name
    .split(/[\s'’]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word.length > 0);
  const significant = words.filter((word) => !MONOGRAM_STOP_WORDS.has(word.toLowerCase()));
  // Un nom entièrement fait d'articles retombe sur les mots bruts plutôt que sur rien.
  const source = significant.length > 0 ? significant : words;

  if (source.length === 0) return '?';
  if (source.length === 1) return source[0].slice(0, 2).toUpperCase();
  return (source[0][0] + source[1][0]).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Paramètres tirés — un type par thème (aucune structure commune, DESIGN.md §7.3)
// ─────────────────────────────────────────────────────────────────────────────

interface BannerBase {
  /** Dominante colorée de la partie. **Premier tirage du flux, commun aux trois thèmes** : c'est
   *  la preuve exécutable que la clé de thème n'entre pas dans le tirage (AC2). C'est aussi elle
   *  qui distingue deux parties en mode liste, où la composition n'est pas rendue (§7.3). */
  dominant: BannerTint;
  /** Foyer du dégradé de fond, en pourcentage de l'espace de dessin. */
  backgroundFocus: { x: number; y: number };
}

export interface HaloParams {
  size: number;
  x: number;
  y: number;
  tint: BannerTint;
  /** Décalage de pulsation, en secondes — inutilisé tant que la Story 29.11 n'anime pas, mais
   *  tiré ici : les paramètres d'un élément sont tirés en un seul endroit, jamais complétés
   *  après coup par la story qui les anime. */
  delaySeconds: number;
}

export interface StarParams {
  x: number;
  y: number;
  radius: number;
  delaySeconds: number;
}

export interface CometParams {
  /** Angle unique θ, en degrés. **Il pilote à lui seul l'orientation de la queue, la position de
   *  la tête et la direction de vol** (DESIGN.md §8, règle extraite de deux défauts successifs du
   *  run d'UX). Le rendu place queue et tête dans un même repère pivoté de θ ; la Story 29.11
   *  n'aura qu'à y appliquer un `translateX` local. Ne jamais réintroduire une seconde valeur
   *  d'orientation à tenir accordée à la main. */
  angle: number;
  x: number;
  y: number;
  length: number;
  headSize: number;
  tint: BannerTint;
  /** +1 = gauche→droite, -1 = droite→gauche. Appliqué comme `scale(direction, 1)` DANS le repère
   *  pivoté, donc toujours accordé à θ (iteration-7 : le sens fait partie du tirage). */
  direction: 1 | -1;
  speedSeconds: number;
}

export interface EmeraudeBanner extends BannerBase {
  theme: 'grimoire-emeraude';
  halo: HaloParams;
  stars: StarParams[];
  comets: CometParams[];
}

/** Feuilles tombantes **ou** points lumineux ascendants — jamais les deux (DESIGN.md §7.3). */
export type ForestMobileKind = 'leaves' | 'motes';

export interface ForestMobileParams {
  size: number;
  x: number;
  /** Position verticale, tirée (Story 29.11, Task 0c). La Story 29.10 plaçait tous les mobiles
   *  sur la même ligne (`viewBoxHeight / 2`) : quatre feuilles alignées au cordeau, mécanique et
   *  faux. Une clairière n'a pas d'horizon. */
  y: number;
  /** Inclinaison propre, en degrés — une feuille tombe rarement à plat. */
  rotation: number;
  /** Dérive latérale, en unités de l'espace de dessin. */
  driftX: number;
  tint: BannerTint;
  delaySeconds: number;
}

export interface ForetBanner extends BannerBase {
  theme: 'foret-ancienne';
  /** **Toujours deux**, jamais un ni trois (DESIGN.md §7.3). */
  halos: [HaloParams, HaloParams];
  mobileKind: ForestMobileKind;
  mobiles: ForestMobileParams[];
}

/** Techniques de rouage autorisées. **D est rejetée** (DESIGN.md §7.3) — ne pas la réintroduire. */
export type GearTechnique = 'B' | 'C' | 'E';

export interface GearParams {
  size: number;
  x: number;
  y: number;
  technique: GearTechnique;
  tint: BannerTint;
  /** Sens alternés le long de la chaîne : des rouages engrenés ne peuvent pas tourner dans le
   *  même sens. Dérivé de l'index, jamais tiré. */
  reverse: boolean;
  speedSeconds: number;
}

export interface GaugeParams {
  size: number;
  /** Coin haut d'ancrage. La chaîne de rouages se déploie **du côté opposé** (corollaire de la
   *  contrainte de composition, DESIGN.md §7.3). */
  corner: 'left' | 'right';
  x: number;
  y: number;
}

export interface RivetParams {
  x: number;
  y: number;
}

export interface SteampunkBanner extends BannerBase {
  theme: 'atelier-cuivre';
  gauge: GaugeParams;
  gears: GearParams[];
  rivets: RivetParams[];
  steam: boolean;
}

export type BannerParams = EmeraudeBanner | ForetBanner | SteampunkBanner;

/** Rectangle en unités de l'espace de dessin. */
export interface BannerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Marge de la zone d'exclusion du manomètre, sur les quatre côtés (DESIGN.md §7.3, contrainte
 *  dure). Exportée pour que le test de propriété reprenne la constante et non une copie. */
export const GAUGE_EXCLUSION_MARGIN = 8;

/**
 * Zone d'exclusion du manomètre : son cercle **plus 8 px de marge sur les quatre côtés**.
 * Aucun rouage, rivet ou accessoire ne peut y être placé, même partiellement — le test porte sur
 * les **boîtes englobantes**, jamais sur les centres.
 */
export function gaugeExclusionZone(gauge: GaugeParams): BannerRect {
  return {
    x: gauge.x - GAUGE_EXCLUSION_MARGIN,
    y: gauge.y - GAUGE_EXCLUSION_MARGIN,
    width: gauge.size + GAUGE_EXCLUSION_MARGIN * 2,
    height: gauge.size + GAUGE_EXCLUSION_MARGIN * 2,
  };
}

/** Intersection de deux rectangles — le contact bord à bord ne compte pas comme un chevauchement. */
export function rectsIntersect(a: BannerRect, b: BannerRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Repousse un élément hors de la zone d'exclusion, horizontalement — vers le côté opposé au
 * manomètre (`corner`).
 *
 * Une seule passe suffit et se démontre : après déplacement, les plages en x de la boîte et de
 * la zone sont disjointes (bord à bord exclu, cf. `rectsIntersect`), donc les deux rectangles ne
 * peuvent plus se couper — quelle que soit la position verticale de l'élément. Pas de boucle,
 * pas de rejet-et-retirage (qui consommerait le flux PRNG de façon dépendante des données et
 * casserait la reproductibilité).
 *
 * Repoussement horizontal plutôt que vertical (Review Findings, 2026-08-12) : la zone touche
 * toujours le haut du canvas (`gauge.y` constant à 8px, marge 8px ⇒ `zone.y = 0`), donc un
 * repoussement vers le bas laisse au mieux ~26-30 px de marge avant le bord inférieur (88 px) —
 * insuffisant pour un rouage de grande taille (jusqu'à 84 px), qui déborderait alors du canvas.
 * Le repoussement horizontal reste dans les limites du canvas (`BANNER_VIEWBOX_WIDTH` = 320 px,
 * contre 58-62 px de large pour la zone) quelle que soit la taille de l'élément repoussé.
 */
function pushOutOfZone(box: BannerRect, zone: BannerRect, corner: 'left' | 'right'): BannerRect {
  if (!rectsIntersect(box, zone)) return box;
  const x = corner === 'right' ? zone.x - box.width : zone.x + zone.width;
  return { ...box, x };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tirage par thème
// ─────────────────────────────────────────────────────────────────────────────

const TINTS: readonly BannerTint[] = ['accent-1', 'accent-2'];
const GEAR_TECHNIQUES: readonly GearTechnique[] = ['B', 'C', 'E'];

/** Bornes de DESIGN.md §7.3, reprises telles quelles. Regroupées pour que le test de propriété
 *  les lise ici plutôt que d'en recopier des littéraux. */
export const BANNER_BOUNDS = {
  emeraude: {
    comets: { min: 1, max: 3 },
    stars: { min: 8, max: 16 },
    haloSize: { min: 76, max: 120 },
    cometLength: { min: 42, max: 96 },
    cometHead: { min: 11, max: 22 },
    cometAngle: { min: -24, max: 34 },
  },
  foret: {
    halos: 2,
    haloSize: { min: 56, max: 130 },
    haloDelay: { min: 0, max: 4 },
    mobiles: { min: 2, max: 5 },
    mobileSize: { min: 4, max: 12 },
    mobileDrift: { min: -26, max: 26 },
    mobileDelay: { min: 0, max: 6 },
  },
  steampunk: {
    gears: { min: 2, max: 6 },
    gearSize: { min: 18, max: 84 },
    /** Écart minimal entre deux rouages consécutifs — c'est lui qui rend la décroissance
     *  **strictement** monotone par construction, jamais par vérification a posteriori. */
    gearSizeStep: 4,
    /** Plancher du PREMIER rouage de la chaîne — le plus grand. */
    gearSizeFirstMin: 60,
    gaugeSize: { min: 42, max: 46 },
    rivets: { min: 0, max: 3 },
  },
} as const;

function drawEmeraude(rng: () => number, base: BannerBase): EmeraudeBanner {
  const b = BANNER_BOUNDS.emeraude;
  const halo: HaloParams = {
    size: pickInt(rng, b.haloSize.min, b.haloSize.max),
    x: pickInt(rng, 8, BANNER_VIEWBOX_WIDTH - 40),
    y: pickInt(rng, -20, BANNER_VIEWBOX_HEIGHT - 30),
    tint: pickOne(rng, TINTS),
    delaySeconds: pickFloat(rng, 0, 4),
  };

  const starCount = pickInt(rng, b.stars.min, b.stars.max);
  const stars: StarParams[] = [];
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: pickInt(rng, 4, BANNER_VIEWBOX_WIDTH - 4),
      y: pickInt(rng, 4, BANNER_VIEWBOX_HEIGHT - 4),
      radius: pickFloat(rng, 0.7, 1.4),
      delaySeconds: pickFloat(rng, 0, 3.4),
    });
  }

  const cometCount = pickInt(rng, b.comets.min, b.comets.max);
  const comets: CometParams[] = [];
  for (let i = 0; i < cometCount; i++) {
    const length = pickInt(rng, b.cometLength.min, b.cometLength.max);
    comets.push({
      angle: Math.round(pickFloat(rng, b.cometAngle.min, b.cometAngle.max)),
      x: pickInt(rng, 0, Math.round(BANNER_VIEWBOX_WIDTH * 0.25)),
      // Réparties sur la hauteur pour que deux comètes ne se superposent pas.
      y: Math.round(((i + 1) * BANNER_VIEWBOX_HEIGHT) / (cometCount + 1) + pickFloat(rng, -8, 8)),
      length,
      headSize: pickInt(rng, b.cometHead.min, b.cometHead.max),
      tint: pickOne(rng, TINTS),
      direction: rng() < 0.5 ? 1 : -1,
      speedSeconds: pickFloat(rng, 5.5, 11),
    });
  }

  return { ...base, theme: 'grimoire-emeraude', halo, stars, comets };
}

function drawForet(rng: () => number, base: BannerBase): ForetBanner {
  const b = BANNER_BOUNDS.foret;
  const drawHalo = (): HaloParams => ({
    size: pickInt(rng, b.haloSize.min, b.haloSize.max),
    x: pickInt(rng, -28, BANNER_VIEWBOX_WIDTH - 30),
    y: pickInt(rng, -46, BANNER_VIEWBOX_HEIGHT - 20),
    tint: pickOne(rng, TINTS),
    delaySeconds: pickFloat(rng, b.haloDelay.min, b.haloDelay.max),
  });
  const halos: [HaloParams, HaloParams] = [drawHalo(), drawHalo()];

  // Tirage EXCLUSIF (DESIGN.md §7.3) : feuilles OU points lumineux, jamais les deux. Un seul
  // booléen porte le choix — deux compteurs indépendants finiraient par produire les deux.
  const mobileKind: ForestMobileKind = rng() < 0.5 ? 'leaves' : 'motes';
  const mobileCount = pickInt(rng, b.mobiles.min, b.mobiles.max);
  const mobiles: ForestMobileParams[] = [];
  for (let i = 0; i < mobileCount; i++) {
    mobiles.push({
      size: pickInt(rng, b.mobileSize.min, b.mobileSize.max),
      x: pickInt(rng, 8, BANNER_VIEWBOX_WIDTH - 8),
      y: pickInt(rng, 10, BANNER_VIEWBOX_HEIGHT - 10),
      rotation: Math.round(pickFloat(rng, -60, 60)),
      driftX: Math.round(pickFloat(rng, b.mobileDrift.min, b.mobileDrift.max)),
      tint: pickOne(rng, TINTS),
      delaySeconds: pickFloat(rng, b.mobileDelay.min, b.mobileDelay.max),
    });
  }

  return { ...base, theme: 'foret-ancienne', halos, mobileKind, mobiles };
}

function drawSteampunk(rng: () => number, base: BannerBase): SteampunkBanner {
  const b = BANNER_BOUNDS.steampunk;

  const gaugeSize = pickInt(rng, b.gaugeSize.min, b.gaugeSize.max);
  const corner: 'left' | 'right' = rng() < 0.5 ? 'left' : 'right';
  const gauge: GaugeParams = {
    size: gaugeSize,
    corner,
    x: corner === 'left' ? 10 : BANNER_VIEWBOX_WIDTH - gaugeSize - 10,
    y: 8,
  };
  const zone = gaugeExclusionZone(gauge);

  const gearCount = pickInt(rng, b.gears.min, b.gears.max);
  // Tailles STRICTEMENT décroissantes par construction : chaque rouage est tiré dans
  // [plancher réservé, précédent − pas]. Le plancher réserve `pas` unités par rouage restant, ce
  // qui rend l'intervalle toujours non vide — on ne vérifie donc jamais la décroissance après
  // coup, elle est impossible à violer.
  const sizes: number[] = [pickInt(rng, b.gearSizeFirstMin, b.gearSize.max)];
  for (let i = 1; i < gearCount; i++) {
    const floorForRest = b.gearSize.min + (gearCount - 1 - i) * b.gearSizeStep;
    const upper = sizes[i - 1] - b.gearSizeStep;
    sizes.push(pickInt(rng, floorForRest, Math.max(floorForRest, upper)));
  }

  const gears: GearParams[] = sizes.map((size, i) => {
    // Deferred-work (2026-08-25) : commentaire corrigé — pour `corner === 'right'`, `rawX`
    // AUGMENTE avec `progress` (rouages tardifs, plus petits) et dérive donc VERS le coin du
    // manomètre, pas à l'opposé (l'inverse est vrai pour `corner === 'left'`). C'est
    // `pushOutOfZone()` ci-dessous, pas cette formule, qui garantit l'absence de collision —
    // testé par le test de propriété sur 500 graines par thème.
    const progress = gearCount === 1 ? 0 : i / (gearCount - 1);
    const spanX = BANNER_VIEWBOX_WIDTH - size;
    const rawX =
      corner === 'right'
        ? Math.round(-8 + progress * (spanX * 0.75))
        : Math.round(BANNER_VIEWBOX_WIDTH - size + 8 - progress * (spanX * 0.75));
    const rawY = Math.round(12 + progress * (BANNER_VIEWBOX_HEIGHT - 20) + pickFloat(rng, -6, 6));
    const box = pushOutOfZone({ x: rawX, y: rawY, width: size, height: size }, zone, corner);
    return {
      size,
      x: box.x,
      y: box.y,
      technique: pickOne(rng, GEAR_TECHNIQUES),
      tint: pickOne(rng, TINTS),
      // Sens alternés le long de la chaîne (DESIGN.md §7.3) — dérivé, jamais tiré.
      reverse: i % 2 === 1,
      speedSeconds: pickFloat(rng, 7, 26),
    };
  });

  const rivetCount = pickInt(rng, b.rivets.min, b.rivets.max);
  const rivets: RivetParams[] = [];
  const RIVET_RADIUS = 2;
  for (let i = 0; i < rivetCount; i++) {
    // `RivetParams.x`/`.y` sont le CENTRE du rivet (rendu en `<circle r="2">`, party-banner.html)
    // — la boîte testée contre la zone d'exclusion doit donc être centrée sur ce même point,
    // jamais avoir ce point comme coin haut-gauche (Review Findings, 2026-08-12 : un décalage de
    // 2px entre boîte testée et cercle rendu pouvait laisser jusqu'à la moitié du disque dans la
    // zone d'exclusion pour un rivet repoussé pile au bord).
    const centerX = pickInt(rng, 6, BANNER_VIEWBOX_WIDTH - 10);
    const centerY = pickInt(rng, 6, BANNER_VIEWBOX_HEIGHT - 10);
    const box = pushOutOfZone(
      {
        x: centerX - RIVET_RADIUS,
        y: centerY - RIVET_RADIUS,
        width: RIVET_RADIUS * 2,
        height: RIVET_RADIUS * 2,
      },
      zone,
      corner,
    );
    rivets.push({ x: box.x + RIVET_RADIUS, y: box.y + RIVET_RADIUS });
  }

  const steam = rng() < 0.5;

  return { ...base, theme: 'atelier-cuivre', gauge, gears, rivets, steam };
}

/**
 * Traduit un identifiant de partie en paramètres de bannière pour le thème actif.
 *
 * **Le seul point d'entrée.** Le nom de la partie n'est pas un paramètre : il ne peut donc pas
 * entrer dans le tirage, par construction (AC1/AC2).
 */
export function bannerParams(partieId: string, theme: Theme): BannerParams {
  const rng = makeRng(bannerSeed(partieId));

  // PREMIER tirage du flux, et il est commun aux trois thèmes : pour un même identifiant, la
  // dominante colorée est la même quel que soit le thème actif. C'est la trace exécutable de
  // « le thème n'intervient pas dans le tirage » (AD-19).
  const base: BannerBase = {
    dominant: pickOne(rng, TINTS),
    backgroundFocus: { x: pickInt(rng, 20, 80), y: pickInt(rng, 0, 90) },
  };

  switch (theme) {
    case 'grimoire-emeraude':
      return drawEmeraude(rng, base);
    case 'foret-ancienne':
      return drawForet(rng, base);
    case 'atelier-cuivre':
      return drawSteampunk(rng, base);
  }
}
