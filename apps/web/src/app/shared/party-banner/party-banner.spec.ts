import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { Theme } from '@master-jdr/shared';
import { PartyBanner } from './party-banner';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../core/theme/tones';
import { bannerParams, partyMonogram } from '../../core/parties/party-banner.util';

const PARTIE_ID = '3f2b8c1a-4d5e-6f70-8a9b-1c2d3e4f5a6b';
const PARTIE_NAME = 'Les Cendres de Kavaan';

function makeThemeService(theme: Theme = 'grimoire-emeraude') {
  const activeTheme = signal<Theme>(theme);
  return {
    activeTheme,
    tone: signal(TONE_MAP[theme]),
  };
}

async function render(
  mode: 'large' | 'medium' | 'compact',
  themeSvc = makeThemeService(),
  name = PARTIE_NAME,
  coverImageVersion: string | null = null,
) {
  await TestBed.configureTestingModule({
    imports: [PartyBanner],
    providers: [{ provide: ThemeToneService, useValue: themeSvc }],
  }).compileComponents();
  const fixture = TestBed.createComponent(PartyBanner);
  fixture.componentRef.setInput('partieId', PARTIE_ID);
  fixture.componentRef.setInput('partieName', name);
  fixture.componentRef.setInput('mode', mode);
  fixture.componentRef.setInput('coverImageVersion', coverImageVersion);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, themeSvc };
}

/** Neutralise les identifiants SVG scopés par instance (`pb1`, `pb2`…) avant de comparer deux
 *  compositions : ils sont précisément ce qui DOIT différer pour que plusieurs bannières
 *  coexistent dans un même document, et ils ne font pas partie de la composition. */
function composition(fixture: { nativeElement: HTMLElement }): string {
  const svg = fixture.nativeElement.querySelector('svg.party-banner');
  return (svg?.innerHTML ?? '').replace(/pb\d+/g, 'pbX');
}

describe('PartyBanner — les trois rendus (Story 29.10, AC4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('mode grand → composition SVG pleine largeur, aucun monogramme', async () => {
    const { fixture } = await render('large');
    const svg = fixture.nativeElement.querySelector('svg.party-banner');
    expect(svg).not.toBeNull();
    // 320 × 124 depuis la Story 29.11 (Task 0a) : la taille réelle de la zone `.cov` des
    // maquettes, celle pour laquelle toutes les bornes de tirage ont été dessinées.
    expect(svg.getAttribute('viewBox')).toBe('0 0 320 124');
    expect(fixture.nativeElement.querySelector('.party-banner__monogram')).toBeNull();
    expect(fixture.nativeElement.classList.contains('party-banner-host--large')).toBe(true);
  });

  it('mode moyen → LA MÊME composition, recadrée au centre par preserveAspectRatio (jamais redessinée)', async () => {
    const large = await render('large');
    const largeComposition = composition(large.fixture);
    TestBed.resetTestingModule();

    const { fixture } = await render('medium');
    const svg = fixture.nativeElement.querySelector('svg.party-banner');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice');
    expect(composition(fixture)).toBe(largeComposition);
    expect(fixture.nativeElement.querySelector('.party-banner__monogram')).toBeNull();
  });

  it('mode liste → rendu PROPRE : monogramme, et surtout aucune composition SVG', async () => {
    const { fixture } = await render('compact');
    expect(fixture.nativeElement.querySelector('svg.party-banner')).toBeNull();
    const monogram = fixture.nativeElement.querySelector('.party-banner__monogram');
    expect(monogram.textContent.trim()).toBe('CK');
    expect(monogram.textContent.trim()).toBe(partyMonogram(PARTIE_NAME));
  });

  it('mode liste → la vignette porte la dominante colorée tirée (seul repère à 28 px)', async () => {
    const { fixture } = await render('compact');
    const vignette = fixture.nativeElement.querySelector('.party-banner--compact');
    const expected =
      bannerParams(PARTIE_ID, 'grimoire-emeraude').dominant === 'accent-1' ? 'tint-1' : 'tint-2';
    expect(vignette.classList.contains(expected)).toBe(true);
  });

  it('décoratif dans les trois modes : aria-hidden, aucun rôle, aucun libellé', async () => {
    for (const mode of ['large', 'medium', 'compact'] as const) {
      const { fixture } = await render(mode);
      const root = fixture.nativeElement.querySelector('[aria-hidden="true"]');
      expect(root).not.toBeNull();
      expect(root.getAttribute('role')).toBeNull();
      expect(root.getAttribute('aria-label')).toBeNull();
      TestBed.resetTestingModule();
    }
  });
});

describe('PartyBanner — image de couverture (Story 29.12, AC2/AC3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const COVER_VERSION = '99999999-9999-9999-9999-999999999999';

  it('avec couverture → un <img> est rendu, aucune composition SVG, dans les trois modes', async () => {
    for (const mode of ['large', 'medium', 'compact'] as const) {
      const { fixture } = await render(mode, makeThemeService(), PARTIE_NAME, COVER_VERSION);
      const img = fixture.nativeElement.querySelector('img.party-banner');
      expect(img).not.toBeNull();
      expect(fixture.nativeElement.querySelector('svg.party-banner')).toBeNull();
      expect(fixture.nativeElement.querySelector('.party-banner__monogram')).toBeNull();
      TestBed.resetTestingModule();
    }
  });

  it('sans couverture → composition générée inchangée (non-régression Stories 29.10/29.11)', async () => {
    const { fixture } = await render('large', makeThemeService(), PARTIE_NAME, null);
    expect(fixture.nativeElement.querySelector('img.party-banner')).toBeNull();
    expect(fixture.nativeElement.querySelector('svg.party-banner')).not.toBeNull();
  });

  it('la source de l’image porte le mode courant et le jeton de version', async () => {
    const { fixture } = await render('medium', makeThemeService(), PARTIE_NAME, COVER_VERSION);
    const img = fixture.nativeElement.querySelector('img.party-banner') as HTMLImageElement;
    expect(img.src).toContain(`/parties/${PARTIE_ID}/cover`);
    expect(img.src).toContain('mode=medium');
    expect(img.src).toContain(`v=${COVER_VERSION}`);
  });

  it('échec de chargement de l’image → repli sur la bannière générée, jamais une image cassée (CAP-20)', async () => {
    const { fixture } = await render('large', makeThemeService(), PARTIE_NAME, COVER_VERSION);
    expect(fixture.nativeElement.querySelector('img.party-banner')).not.toBeNull();

    const img = fixture.nativeElement.querySelector('img.party-banner') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('img.party-banner')).toBeNull();
    expect(fixture.nativeElement.querySelector('svg.party-banner')).not.toBeNull();
  });

  it('un nouveau jeton de version (remplacement de l’image) retente le chargement après un échec précédent', async () => {
    const { fixture } = await render('large', makeThemeService(), PARTIE_NAME, COVER_VERSION);
    const img = fixture.nativeElement.querySelector('img.party-banner') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img.party-banner')).toBeNull();

    fixture.componentRef.setInput('coverImageVersion', '88888888-8888-8888-8888-888888888888');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('img.party-banner')).not.toBeNull();
  });

  it('décoratif : aria-hidden="true", alt="" sur l’image de couverture', async () => {
    const { fixture } = await render('large', makeThemeService(), PARTIE_NAME, COVER_VERSION);
    const img = fixture.nativeElement.querySelector('img.party-banner') as HTMLImageElement;
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(img.getAttribute('alt')).toBe('');
  });
});

describe('PartyBanner — dérivation (Story 29.10, AC1, AC2, AC3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renommer la partie ne change que le monogramme, jamais la composition', async () => {
    const first = await render('large');
    const firstComposition = composition(first.fixture);
    TestBed.resetTestingModule();

    const second = await render('large', makeThemeService(), 'Un Tout Autre Nom');
    expect(composition(second.fixture)).toBe(firstComposition);
  });

  it('changer de thème change le style mais pas le monogramme', async () => {
    const emeraude = await render('compact');
    expect(
      emeraude.fixture.nativeElement.querySelector('.party-banner__monogram').textContent.trim(),
    ).toBe('CK');

    emeraude.themeSvc.activeTheme.set('atelier-cuivre');
    emeraude.fixture.detectChanges();
    await emeraude.fixture.whenStable();

    expect(
      emeraude.fixture.nativeElement.querySelector('.party-banner__monogram').textContent.trim(),
    ).toBe('CK');
  });

  it('changer de thème rend une composition différente (le thème sélectionne le style)', async () => {
    const { fixture, themeSvc } = await render('large');
    const emeraudeComposition = composition(fixture);

    themeSvc.activeTheme.set('atelier-cuivre');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(composition(fixture)).not.toBe(emeraudeComposition);
  });

  it('deux instances de la même partie produisent exactement la même composition (AC3)', async () => {
    const a = await render('large');
    const compositionA = composition(a.fixture);
    TestBed.resetTestingModule();
    const b = await render('large');

    expect(composition(b.fixture)).toBe(compositionA);
  });

  it('les identifiants SVG sont uniques par instance — deux bannières ne partagent pas leurs défs', async () => {
    await TestBed.configureTestingModule({
      imports: [PartyBanner],
      providers: [{ provide: ThemeToneService, useValue: makeThemeService('atelier-cuivre') }],
    }).compileComponents();

    const makeOne = () => {
      const f = TestBed.createComponent(PartyBanner);
      f.componentRef.setInput('partieId', PARTIE_ID);
      f.componentRef.setInput('partieName', PARTIE_NAME);
      f.componentRef.setInput('mode', 'large');
      f.detectChanges();
      return f.nativeElement.querySelector('g[id]').getAttribute('id');
    };

    expect(makeOne()).not.toBe(makeOne());
  });
});

describe('PartyBanner — composition par thème (Story 29.10, AC6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('grimoire-emeraude → étoiles et comètes rendues, chacune dans un repère pivoté unique', async () => {
    const { fixture } = await render('large', makeThemeService('grimoire-emeraude'));
    const params = bannerParams(PARTIE_ID, 'grimoire-emeraude');

    expect(fixture.nativeElement.querySelectorAll('.party-banner__star').length).toBe(
      params.theme === 'grimoire-emeraude' ? params.stars.length : -1,
    );
    const comets = fixture.nativeElement.querySelectorAll('.party-banner__comet');
    expect(comets.length).toBe(params.theme === 'grimoire-emeraude' ? params.comets.length : -1);

    // §8 : un SEUL θ porte orientation, position de tête et sens. La queue part de l'origine du
    // repère et la tête est posée à son extrémité — jamais deux valeurs à tenir accordées.
    for (const comet of comets) {
      expect(comet.getAttribute('transform')).toMatch(
        /^translate\([-\d. ]+\) rotate\(-?[\d.]+\) scale\(-?1 1\)$/,
      );
      // La queue est un tracé effilé depuis la Story 29.11 (Task 0b) : elle part TOUJOURS de
      // l'origine du repère (`M 0 0`) et s'élargit jusqu'à la tête, dont l'abscisse vaut la
      // longueur de la queue. Le lien tête/queue reste structurel, seule la forme a changé.
      const tail = comet.querySelector('.party-banner__comet-tail');
      const head = comet.querySelector('.party-banner__comet-head');
      const path = tail.getAttribute('d');
      expect(path.startsWith('M 0 0 ')).toBe(true);
      const tailEnd = path.split('L ')[1].split(' ')[0];
      expect(head.getAttribute('cx')).toBe(tailEnd);
    }
  });

  it('foret-ancienne → exactement 2 halos, et un seul type d’élément mobile', async () => {
    const { fixture } = await render('large', makeThemeService('foret-ancienne'));
    expect(fixture.nativeElement.querySelectorAll('.party-banner__halo').length).toBe(2);

    const leaves = fixture.nativeElement.querySelectorAll('.party-banner__leaf').length;
    const motes = fixture.nativeElement.querySelectorAll('.party-banner__mote').length;
    // Exclusivité : l'un des deux compteurs est nécessairement nul.
    expect(leaves === 0 || motes === 0).toBe(true);
    expect(leaves + motes).toBeGreaterThan(0);
  });

  it('atelier-cuivre → grille constante et manomètre présents sur toute bannière', async () => {
    const { fixture } = await render('large', makeThemeService('atelier-cuivre'));
    expect(fixture.nativeElement.querySelector('.party-banner__grid')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.party-banner__gauge')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('.party-banner__gear').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('atelier-cuivre → le manomètre est dessiné APRÈS les rouages (il reste au-dessus)', async () => {
    const { fixture } = await render('large', makeThemeService('atelier-cuivre'));
    const svg = fixture.nativeElement.querySelector('svg.party-banner');
    const nodes = Array.from(svg.querySelectorAll('.party-banner__gear, .party-banner__gauge'));
    expect((nodes[nodes.length - 1] as Element).classList.contains('party-banner__gauge')).toBe(
      true,
    );
  });
});

// AC1/AC2/AC3 : la portée de l'animation est portée par la classe d'hôte, jamais par le balisage.
// jsdom ne calcule aucune animation : ces tests vérifient donc ce qui est VÉRIFIABLE — que les
// paramètres tirés arrivent bien au CSS, et que le DOM ne dépend pas du mode ni de la réduction
// des animations. Le mouvement lui-même relève de la vérification visuelle.
describe('PartyBanner — portée de l’animation (Story 29.11, AC1, AC2, AC3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('mode grand → les paramètres tirés sont transmis au CSS en propriétés personnalisées, avec leur unité', async () => {
    const { fixture } = await render('large', makeThemeService('grimoire-emeraude'));
    const fly = fixture.nativeElement.querySelector('.party-banner__comet-fly') as SVGElement;

    const speed = fly.style.getPropertyValue('--pb-speed');
    expect(speed).toMatch(/^[\d.]+s$/);
    const params = bannerParams(PARTIE_ID, 'grimoire-emeraude');
    if (params.theme === 'grimoire-emeraude') {
      expect(speed).toBe(`${params.comets[0].speedSeconds.toFixed(2)}s`);
    }
    expect(fly.style.getPropertyValue('--pb-travel')).toMatch(/^\d+px$/);
  });

  it('les rouages reçoivent leur vitesse tirée et leur sens dérivé', async () => {
    const { fixture } = await render('large', makeThemeService('atelier-cuivre'));
    const spins = Array.from(
      fixture.nativeElement.querySelectorAll('.party-banner__gear-spin'),
    ) as SVGElement[];
    expect(spins.length).toBeGreaterThanOrEqual(2);

    for (const spin of spins) {
      expect(spin.style.getPropertyValue('--pb-speed')).toMatch(/^[\d.]+s$/);
    }
    // Sens alternés : deux rouages engrenés ne tournent jamais dans le même sens.
    for (let i = 1; i < spins.length; i++) {
      const previous = spins[i - 1].classList.contains('party-banner__gear-spin--reverse');
      const current = spins[i].classList.contains('party-banner__gear-spin--reverse');
      expect(current).not.toBe(previous);
    }
  });

  it('AC2 : le balisage est IDENTIQUE en grand et en moyen — seule la classe d’hôte change', async () => {
    const large = await render('large');
    const largeComposition = composition(large.fixture);
    expect(large.fixture.nativeElement.classList.contains('party-banner-host--large')).toBe(true);
    TestBed.resetTestingModule();

    const medium = await render('medium');
    expect(medium.fixture.nativeElement.classList.contains('party-banner-host--large')).toBe(false);
    // Si ce test casse, c'est que l'animation a été portée par le template plutôt que par le CSS :
    // la composition aurait alors été dupliquée, ce que la Story 29.10 interdit (AC3).
    expect(composition(medium.fixture)).toBe(largeComposition);
  });

  it('AC2 : le mode liste ne rend aucune composition, donc rien à animer', async () => {
    const { fixture } = await render('compact');
    expect(fixture.nativeElement.querySelector('svg.party-banner')).toBeNull();
    expect(fixture.nativeElement.querySelector('.party-banner__comet-fly')).toBeNull();
    expect(fixture.nativeElement.querySelector('.party-banner__gear-spin')).toBeNull();
  });

  it('AC3 : le placement statique n’est jamais porté par la propriété que l’animation occupe (comète)', async () => {
    // Piège structurel : un élément ne porte qu'une seule propriété `transform`. Le placement vit
    // sur le `<g>` externe, l'animation sur un `<g>` interne — sinon l'animation effacerait le
    // placement et la composition partirait au repos dans un coin.
    const { fixture } = await render('large', makeThemeService('grimoire-emeraude'));
    const comet = fixture.nativeElement.querySelector('.party-banner__comet') as SVGElement;
    const fly = comet.querySelector('.party-banner__comet-fly') as SVGElement;
    expect(comet.getAttribute('transform')).toBeTruthy();
    expect(fly.getAttribute('transform')).toBeNull();
  });

  it('AC3 : même invariant sur l’aiguille du manomètre (Review Findings — piège réellement rencontré)', async () => {
    const { fixture } = await render('large', makeThemeService('atelier-cuivre'));
    const pivot = fixture.nativeElement.querySelector(
      '.party-banner__gauge-needle-pivot',
    ) as SVGElement;
    const placement = pivot.parentElement as unknown as SVGElement;
    expect(placement.getAttribute('transform')).toBeTruthy();
    expect(pivot.getAttribute('transform')).toBeNull();
  });

  it('AC3 : même invariant sur la feuille de la Forêt, quand le tirage en produit (Review Findings — piège réellement rencontré)', async () => {
    const params = bannerParams(PARTIE_ID, 'foret-ancienne');
    if (params.theme !== 'foret-ancienne' || params.mobileKind !== 'leaves') return;
    const { fixture } = await render('large', makeThemeService('foret-ancienne'));
    const leaf = fixture.nativeElement.querySelector('.party-banner__leaf') as SVGElement;
    const placement = leaf.parentElement as unknown as SVGElement;
    expect(placement.getAttribute('transform')).toBeTruthy();
    expect(leaf.getAttribute('transform')).toBeNull();
  });

  it('AC3 : la composition au repos est complète — rien n’est ajouté ni retiré par l’animation', async () => {
    const { fixture } = await render('large', makeThemeService('foret-ancienne'));
    const params = bannerParams(PARTIE_ID, 'foret-ancienne');
    if (params.theme !== 'foret-ancienne') throw new Error('thème inattendu');

    const rendered =
      fixture.nativeElement.querySelectorAll('.party-banner__leaf').length +
      fixture.nativeElement.querySelectorAll('.party-banner__mote').length;
    expect(rendered).toBe(params.mobiles.length);
    expect(fixture.nativeElement.querySelectorAll('.party-banner__halo').length).toBe(2);
  });
});
