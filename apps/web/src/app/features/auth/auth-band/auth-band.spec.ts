import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthBand } from './auth-band';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { THEMES, TONE_MAP, type Theme } from '../../../core/theme/tones';

function makeThemeService(theme: Theme = 'grimoire-emeraude') {
  const activeTheme = signal<Theme>(theme);
  return {
    activeTheme,
    tone: signal(TONE_MAP[theme]),
    /** Reproduit `ThemeToneService.setTheme` : le même signal pilote tout. */
    switchTo(next: Theme) {
      activeTheme.set(next);
      this.tone.set(TONE_MAP[next]);
    },
  };
}

async function render(themeSvc = makeThemeService()) {
  await TestBed.configureTestingModule({
    imports: [AuthBand],
    providers: [{ provide: ThemeToneService, useValue: themeSvc }],
  }).compileComponents();
  const fixture = TestBed.createComponent(AuthBand);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, themeSvc };
}

describe('AuthBand — bande de marque des écrans d’authentification (Story 34.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  for (const theme of THEMES) {
    describe(theme, () => {
      it('un <header> sans <h1> ni <main> : nom « Dés Dispos » et accroche du thème en texte', async () => {
        const { el } = await render(makeThemeService(theme));

        expect(el.querySelector('header')).not.toBeNull();
        expect(el.querySelector('h1, h2, h3, main')).toBeNull();
        expect(el.querySelector('.nm')?.textContent?.trim()).toBe('Dés Dispos');
        expect(el.querySelector('.tag')?.textContent?.trim()).toBe(TONE_MAP[theme]['auth.tagline']);
      });

      it('rend une scène et un emblème, tous les SVG décoratifs étant aria-hidden et non focalisables', async () => {
        const { el } = await render(makeThemeService(theme));

        const scene = el.querySelector('svg.scene')!;
        expect(scene.getAttribute('aria-hidden')).toBe('true');
        expect(scene.getAttribute('focusable')).toBe('false');
        expect(scene.getAttribute('viewBox')).toBe('0 0 440 180');
        // Emblème : un <use> du filigrane qui pointe sur un <symbol> bien présent.
        const use = el.querySelector('use.bgemb')!;
        const href = use.getAttribute('href')!;
        expect(href.startsWith('#')).toBe(true);
        expect(scene.querySelector(`symbol[id="${href.slice(1)}"]`)).not.toBeNull();
        // Pictogramme du logo : décoratif lui aussi (le nom est écrit à côté).
        const logo = el.querySelector('app-brand-logo svg')!;
        expect(logo.getAttribute('aria-hidden')).toBe('true');
        expect(logo.getAttribute('focusable')).toBe('false');
        // Aucun SVG de la bande n'est exposé comme image ni titré.
        expect(el.querySelector('svg[role], svg title')).toBeNull();
      });
    });
  }

  it('chaque thème a sa propre scène', async () => {
    const signatures: string[] = [];
    for (const theme of THEMES) {
      const { el } = await render(makeThemeService(theme));
      signatures.push(
        ['.star', '.mote', '.spin', '.needle'].map((s) => el.querySelectorAll(s).length).join(','),
      );
      TestBed.resetTestingModule();
    }
    expect(new Set(signatures).size).toBe(THEMES.length);
  });

  it('une seule source de vérité : scène, emblème et accroche suivent le même thème actif', async () => {
    const { fixture, el, themeSvc } = await render(makeThemeService('grimoire-emeraude'));
    expect(el.querySelectorAll('.star').length).toBeGreaterThan(0);

    themeSvc.switchTo('atelier-cuivre');
    fixture.detectChanges();
    expect(el.querySelectorAll('.star').length).toBe(0);
    expect(el.querySelectorAll('.spin').length).toBeGreaterThan(0);
    expect(el.querySelector('.tag')?.textContent?.trim()).toBe(
      TONE_MAP['atelier-cuivre']['auth.tagline'],
    );

    themeSvc.switchTo('foret-ancienne');
    fixture.detectChanges();
    expect(el.querySelectorAll('.mote').length).toBeGreaterThan(0);
    expect(el.querySelector('.tag')?.textContent?.trim()).toBe(
      TONE_MAP['foret-ancienne']['auth.tagline'],
    );
  });

  describe('pause au clic sur la scène', () => {
    it('un clic fige l’animation, un second la relance ; aucun bouton', async () => {
      const { fixture, el } = await render();
      const band = el.querySelector('header.band')!;
      const scene = el.querySelector('svg.scene') as SVGElement;
      expect(band.classList.contains('is-paused')).toBe(false);

      scene.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(band.classList.contains('is-paused')).toBe(true);

      scene.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(band.classList.contains('is-paused')).toBe(false);

      expect(el.querySelector('button, [role="button"], a')).toBeNull();
    });

    it('un clic sur le bloc-marque ou sur l’accroche ne fait rien', async () => {
      const { fixture, el } = await render();
      const band = el.querySelector('header.band')!;

      (el.querySelector('.bm') as HTMLElement).click();
      (el.querySelector('.nm') as HTMLElement).click();
      (el.querySelector('.tag') as HTMLElement).click();
      fixture.detectChanges();

      expect(band.classList.contains('is-paused')).toBe(false);
    });

    it('l’état de pause n’est jamais mémorisé : une nouvelle bande repart animée', async () => {
      const first = await render();
      (first.el.querySelector('svg.scene') as SVGElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      first.fixture.detectChanges();
      expect(first.el.querySelector('header.band')!.classList.contains('is-paused')).toBe(true);
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
      TestBed.resetTestingModule();

      const second = await render();
      expect(second.el.querySelector('header.band')!.classList.contains('is-paused')).toBe(false);
    });
  });

  it('les id des défs SVG sont uniques d’une instance à l’autre', async () => {
    const themeSvc = makeThemeService('foret-ancienne');
    await TestBed.configureTestingModule({
      imports: [AuthBand],
      providers: [{ provide: ThemeToneService, useValue: themeSvc }],
    }).compileComponents();
    const a = TestBed.createComponent(AuthBand);
    const b = TestBed.createComponent(AuthBand);
    a.detectChanges();
    b.detectChanges();

    const ids = (f: typeof a) =>
      Array.from((f.nativeElement as HTMLElement).querySelectorAll('[id]')).map((e) => e.id);
    const idsA = ids(a);
    const idsB = ids(b);
    expect(idsA.length).toBeGreaterThan(0);
    expect(idsA.filter((id) => idsB.includes(id))).toEqual([]);
    // Les remplissages pointent bien sur les défs de leur propre instance.
    const fill = (a.nativeElement as HTMLElement).querySelector('.mote')!.getAttribute('fill')!;
    expect(idsA).toContain(fill.replace(/^url\(#|\)$/g, ''));
  });
});
