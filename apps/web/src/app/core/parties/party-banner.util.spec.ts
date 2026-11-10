import { THEMES, type Theme } from '@master-jdr/shared';
import {
  BANNER_BOUNDS,
  BANNER_VIEWBOX_HEIGHT,
  BANNER_VIEWBOX_WIDTH,
  bannerParams,
  bannerSeed,
  gaugeExclusionZone,
  makeRng,
  partyMonogram,
  rectsIntersect,
  type BannerRect,
  type ForetBanner,
  type EmeraudeBanner,
  type SteampunkBanner,
} from './party-banner.util';

/** Identifiants déterministes : la suite doit être reproductible d'une exécution à l'autre —
 *  un test de propriété alimenté par `Math.random()` ne dit rien de stable en cas d'échec. */
function makeIds(count: number, prefix = 'partie'): string[] {
  return Array.from(
    { length: count },
    (_, i) => `${prefix}-${i}-3f2b8c1a-4d5e-6f70-8a9b-1c2d3e4f5a6b`,
  );
}

describe('bannerSeed / makeRng (Story 29.10, AC1)', () => {
  it('même identifiant → même graine, sur 100 appels', () => {
    const id = makeIds(1)[0];
    const first = bannerSeed(id);
    for (let i = 0; i < 100; i++) expect(bannerSeed(id)).toBe(first);
  });

  it('identifiants différents → graines différentes (aucune collision sur 500)', () => {
    const seeds = new Set(makeIds(500).map(bannerSeed));
    expect(seeds.size).toBe(500);
  });

  it("l'identifiant est haché en entier : deux UUID ne différant que par leur dernier caractère donnent des graines différentes", () => {
    expect(bannerSeed('3f2b8c1a-4d5e-6f70-8a9b-1c2d3e4f5a6a')).not.toBe(
      bannerSeed('3f2b8c1a-4d5e-6f70-8a9b-1c2d3e4f5a6b'),
    );
  });

  it('le générateur est stable et borné dans [0, 1)', () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    for (let i = 0; i < 200; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('bannerParams — déterminisme et indépendance (Story 29.10, AC1, AC2, AC3)', () => {
  it('même identifiant + même thème → paramètres profondément égaux, sur 100 appels', () => {
    const id = makeIds(1)[0];
    const first = bannerParams(id, 'grimoire-emeraude');
    for (let i = 0; i < 100; i++) {
      expect(bannerParams(id, 'grimoire-emeraude')).toEqual(first);
    }
  });

  it('identifiants différents → compositions différentes (aucun doublon sur 50)', () => {
    const rendered = makeIds(50).map((id) => JSON.stringify(bannerParams(id, 'grimoire-emeraude')));
    expect(new Set(rendered).size).toBe(50);
  });

  it("le nom de la partie n'entre pas dans la dérivation : ce n'est pas un paramètre de la fonction (AC2)", () => {
    // Garde exécutable contre une régression future qui ajouterait le nom à la signature :
    // `bannerParams` prend exactement 2 arguments, et renommer une partie ne peut donc rien
    // changer — c'est structurel, pas une convention.
    expect(bannerParams.length).toBe(2);
  });

  it('la clé de thème ne change pas le tirage, seulement le style : la dominante est la même pour les trois thèmes (AC2)', () => {
    for (const id of makeIds(50)) {
      const dominants = THEMES.map((theme) => bannerParams(id, theme).dominant);
      expect(new Set(dominants).size).toBe(1);
    }
  });

  it('le fond est cadré dans son espace de dessin quel que soit le thème', () => {
    for (const id of makeIds(30)) {
      for (const theme of THEMES) {
        const { backgroundFocus } = bannerParams(id, theme);
        expect(backgroundFocus.x).toBeGreaterThanOrEqual(0);
        expect(backgroundFocus.x).toBeLessThanOrEqual(100);
        expect(backgroundFocus.y).toBeGreaterThanOrEqual(0);
        expect(backgroundFocus.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('chaque thème produit son propre type discriminé (un seul point de dérivation, trois styles)', () => {
    const id = makeIds(1)[0];
    expect(bannerParams(id, 'grimoire-emeraude').theme).toBe('grimoire-emeraude');
    expect(bannerParams(id, 'foret-ancienne').theme).toBe('foret-ancienne');
    expect(bannerParams(id, 'atelier-cuivre').theme).toBe('atelier-cuivre');
  });
});

describe('partyMonogram (Story 29.10, DESIGN.md §7.3)', () => {
  it('les deux cas de référence de la spécification', () => {
    expect(partyMonogram('Les Cendres de Kavaan')).toBe('CK');
    expect(partyMonogram('Le Convoi du Nord')).toBe('CN');
  });

  it('un seul mot significatif → ses deux premières lettres', () => {
    expect(partyMonogram('Le Vellombre')).toBe('VE');
    expect(partyMonogram('Kavaan')).toBe('KA');
  });

  it("l'apostrophe sépare les mots", () => {
    expect(partyMonogram("L'Auberge Rouge")).toBe('AR');
    expect(partyMonogram('L’Auberge Rouge')).toBe('AR');
  });

  it('la ponctuation est ignorée, les capitales forcées', () => {
    expect(partyMonogram('  cendres,   kavaan ! ')).toBe('CK');
  });

  it('les accents sont conservés en capitale', () => {
    expect(partyMonogram('Émeraude Ancienne')).toBe('ÉA');
  });

  it('un nom entièrement fait d’articles retombe sur les mots bruts plutôt que sur rien', () => {
    expect(partyMonogram('Le La')).toBe('LL');
  });

  it('nom vide ou sans lettre → repli défensif, jamais une vignette muette', () => {
    expect(partyMonogram('')).toBe('?');
    expect(partyMonogram('   ')).toBe('?');
    expect(partyMonogram('!!!')).toBe('?');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invariants de tirage — tests de propriété (AC6)
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE = makeIds(500, 'propriete');

describe('Invariants de tirage — grimoire-emeraude (AC6)', () => {
  it('1 à 3 comètes, densité d’étoiles et bornes respectées sur 500 graines', () => {
    const b = BANNER_BOUNDS.emeraude;
    for (const id of SAMPLE) {
      const params = bannerParams(id, 'grimoire-emeraude') as EmeraudeBanner;

      expect(params.comets.length).toBeGreaterThanOrEqual(b.comets.min);
      expect(params.comets.length).toBeLessThanOrEqual(b.comets.max);
      expect(params.stars.length).toBeGreaterThanOrEqual(b.stars.min);
      expect(params.stars.length).toBeLessThanOrEqual(b.stars.max);

      for (const comet of params.comets) {
        expect(comet.length).toBeGreaterThanOrEqual(b.cometLength.min);
        expect(comet.length).toBeLessThanOrEqual(b.cometLength.max);
        expect(comet.headSize).toBeGreaterThanOrEqual(b.cometHead.min);
        expect(comet.headSize).toBeLessThanOrEqual(b.cometHead.max);
        expect(comet.angle).toBeGreaterThanOrEqual(b.cometAngle.min);
        expect(comet.angle).toBeLessThanOrEqual(b.cometAngle.max);
        expect(['accent-1', 'accent-2']).toContain(comet.tint);
        expect([1, -1]).toContain(comet.direction);
      }
    }
  });

  it('un halo, toujours exactement un', () => {
    for (const id of SAMPLE) {
      const params = bannerParams(id, 'grimoire-emeraude') as EmeraudeBanner;
      expect(params.halo).toBeDefined();
      expect(params.halo.size).toBeGreaterThan(0);
    }
  });

  it('les deux sens de déplacement sont réellement tirés sur l’échantillon (iteration-7)', () => {
    const directions = new Set<number>();
    for (const id of SAMPLE) {
      const params = bannerParams(id, 'grimoire-emeraude') as EmeraudeBanner;
      for (const comet of params.comets) directions.add(comet.direction);
    }
    expect(directions).toEqual(new Set([1, -1]));
  });
});

describe('Invariants de tirage — foret-ancienne (AC6)', () => {
  it('toujours exactement 2 halos, et bornes respectées sur 500 graines', () => {
    const b = BANNER_BOUNDS.foret;
    for (const id of SAMPLE) {
      const params = bannerParams(id, 'foret-ancienne') as ForetBanner;

      expect(params.halos.length).toBe(b.halos);
      for (const halo of params.halos) {
        expect(halo.size).toBeGreaterThanOrEqual(b.haloSize.min);
        expect(halo.size).toBeLessThanOrEqual(b.haloSize.max);
        expect(halo.delaySeconds).toBeGreaterThanOrEqual(b.haloDelay.min);
        expect(halo.delaySeconds).toBeLessThanOrEqual(b.haloDelay.max);
      }
    }
  });

  it('tirage EXCLUSIF : feuilles OU points lumineux, jamais les deux', () => {
    const kinds = new Set<string>();
    for (const id of SAMPLE) {
      const params = bannerParams(id, 'foret-ancienne') as ForetBanner;
      // Un seul champ porte le choix : il est structurellement impossible d'avoir les deux.
      expect(['leaves', 'motes']).toContain(params.mobileKind);
      kinds.add(params.mobileKind);
    }
    // Et les deux branches sont réellement atteintes — sinon le « tirage » n'en serait pas un.
    expect(kinds).toEqual(new Set(['leaves', 'motes']));
  });

  it('2 à 5 éléments mobiles, taille / dérive / décalage dans les bornes', () => {
    const b = BANNER_BOUNDS.foret;
    for (const id of SAMPLE) {
      const params = bannerParams(id, 'foret-ancienne') as ForetBanner;
      expect(params.mobiles.length).toBeGreaterThanOrEqual(b.mobiles.min);
      expect(params.mobiles.length).toBeLessThanOrEqual(b.mobiles.max);
      for (const mobile of params.mobiles) {
        expect(mobile.size).toBeGreaterThanOrEqual(b.mobileSize.min);
        expect(mobile.size).toBeLessThanOrEqual(b.mobileSize.max);
        expect(mobile.driftX).toBeGreaterThanOrEqual(b.mobileDrift.min);
        expect(mobile.driftX).toBeLessThanOrEqual(b.mobileDrift.max);
        expect(mobile.delaySeconds).toBeGreaterThanOrEqual(b.mobileDelay.min);
        expect(mobile.delaySeconds).toBeLessThanOrEqual(b.mobileDelay.max);
      }
    }
  });
});

describe('Invariants de tirage — atelier-cuivre (AC6)', () => {
  it('2 à 6 rouages, tailles STRICTEMENT décroissantes, sur 500 graines', () => {
    const b = BANNER_BOUNDS.steampunk;
    for (const id of SAMPLE) {
      const params = bannerParams(id, 'atelier-cuivre') as SteampunkBanner;

      expect(params.gears.length).toBeGreaterThanOrEqual(b.gears.min);
      expect(params.gears.length).toBeLessThanOrEqual(b.gears.max);

      for (let i = 0; i < params.gears.length; i++) {
        expect(params.gears[i].size).toBeGreaterThanOrEqual(b.gearSize.min);
        expect(params.gears[i].size).toBeLessThanOrEqual(b.gearSize.max);
        if (i > 0) {
          expect(params.gears[i].size).toBeLessThan(params.gears[i - 1].size);
        }
      }
    }
  });

  it('techniques limitées à B, C, E — la technique D est rejetée', () => {
    const used = new Set<string>();
    for (const id of SAMPLE) {
      const params = bannerParams(id, 'atelier-cuivre') as SteampunkBanner;
      for (const gear of params.gears) {
        expect(['B', 'C', 'E']).toContain(gear.technique);
        used.add(gear.technique);
      }
    }
    expect(used).toEqual(new Set(['B', 'C', 'E']));
  });

  it('sens alternés le long de la chaîne — deux rouages engrenés ne tournent jamais dans le même sens', () => {
    for (const id of SAMPLE) {
      const params = bannerParams(id, 'atelier-cuivre') as SteampunkBanner;
      for (let i = 1; i < params.gears.length; i++) {
        expect(params.gears[i].reverse).not.toBe(params.gears[i - 1].reverse);
      }
    }
  });

  it('manomètre toujours présent, 42-46 px, ancré dans un coin haut', () => {
    const b = BANNER_BOUNDS.steampunk;
    for (const id of SAMPLE) {
      const { gauge } = bannerParams(id, 'atelier-cuivre') as SteampunkBanner;
      expect(gauge.size).toBeGreaterThanOrEqual(b.gaugeSize.min);
      expect(gauge.size).toBeLessThanOrEqual(b.gaugeSize.max);
      expect(['left', 'right']).toContain(gauge.corner);
      expect(gauge.y).toBeLessThan(20);
    }
  });

  it('les deux ancrages du manomètre sont réellement tirés', () => {
    const corners = new Set(
      SAMPLE.map((id) => (bannerParams(id, 'atelier-cuivre') as SteampunkBanner).gauge.corner),
    );
    expect(corners).toEqual(new Set(['left', 'right']));
  });

  it('0 à 3 rivets', () => {
    const b = BANNER_BOUNDS.steampunk;
    for (const id of SAMPLE) {
      const params = bannerParams(id, 'atelier-cuivre') as SteampunkBanner;
      expect(params.rivets.length).toBeGreaterThanOrEqual(b.rivets.min);
      expect(params.rivets.length).toBeLessThanOrEqual(b.rivets.max);
    }
  });

  // ── LE test qui porte l'AC6 ──────────────────────────────────────────────────
  it('AUCUNE boîte englobante ne pénètre la zone d’exclusion du manomètre, sur 500 graines', () => {
    for (const id of SAMPLE) {
      const params = bannerParams(id, 'atelier-cuivre') as SteampunkBanner;
      const zone = gaugeExclusionZone(params.gauge);

      const boxes: BannerRect[] = [
        ...params.gears.map((g) => ({ x: g.x, y: g.y, width: g.size, height: g.size })),
        // `RivetParams.x`/`.y` sont le CENTRE du rivet (rendu en `<circle r="2">`) — la boîte
        // englobante testée doit donc être recentrée, pas avoir ce point comme coin haut-gauche.
        ...params.rivets.map((r) => ({ x: r.x - 2, y: r.y - 2, width: 4, height: 4 })),
      ];

      for (const box of boxes) {
        // Test sur boîtes englobantes, JAMAIS sur distance entre centres (DESIGN.md §7.3).
        expect(rectsIntersect(box, zone)).toBe(false);
      }
    }
  });

  it('AUCUN rouage ni rivet repoussé hors de la zone d’exclusion ne disparaît du canvas 160×88, sur 500 graines (Review Findings)', () => {
    // Le repoussement horizontal (Review Findings, 2026-08-12) doit garder l'élément au moins
    // partiellement visible dans le canvas — un léger débordement contrôlé (~8px) est un patron
    // déjà utilisé ailleurs (halos/comètes qui bordent volontairement le cadre), mais l'élément ne
    // doit jamais devenir entièrement invisible comme avec l'ancien repoussement vertical.
    const viewBox: BannerRect = {
      x: 0,
      y: 0,
      width: BANNER_VIEWBOX_WIDTH,
      height: BANNER_VIEWBOX_HEIGHT,
    };
    for (const id of SAMPLE) {
      const params = bannerParams(id, 'atelier-cuivre') as SteampunkBanner;
      const boxes: BannerRect[] = [
        ...params.gears.map((g) => ({ x: g.x, y: g.y, width: g.size, height: g.size })),
        ...params.rivets.map((r) => ({ x: r.x - 2, y: r.y - 2, width: 4, height: 4 })),
      ];

      for (const box of boxes) {
        expect(rectsIntersect(box, viewBox)).toBe(true);
      }
    }
  });

  it('la zone d’exclusion vaut bien le cercle plus 8 px sur les quatre côtés', () => {
    const zone = gaugeExclusionZone({ size: 44, corner: 'left', x: 10, y: 8 });
    expect(zone).toEqual({ x: 2, y: 0, width: 60, height: 60 });
  });

  it('rectsIntersect : le contact bord à bord ne compte pas comme un chevauchement', () => {
    const a: BannerRect = { x: 0, y: 0, width: 10, height: 10 };
    expect(rectsIntersect(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(rectsIntersect(a, { x: 9.9, y: 0, width: 10, height: 10 })).toBe(true);
  });
});

describe('Aucune dérivation cachée (AC3, AC5)', () => {
  it('les trois thèmes de THEMES sont couverts — aucun thème ne tombe dans un cas par défaut', () => {
    const id = makeIds(1)[0];
    for (const theme of THEMES as readonly Theme[]) {
      expect(() => bannerParams(id, theme)).not.toThrow();
      expect(bannerParams(id, theme).theme).toBe(theme);
    }
  });
});
