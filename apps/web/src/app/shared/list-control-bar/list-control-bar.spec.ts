import { TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { ListControlBar } from './list-control-bar';

function makeBreakpointObserver(desktop: boolean) {
  return {
    observe: () => of({ matches: desktop, breakpoints: {} }),
    isMatched: () => desktop,
  };
}

const SORT_OPTIONS = [
  { value: 'urgence', label: 'Urgence' },
  { value: 'nom', label: 'Nom' },
];

async function setup(options: { desktop?: boolean } = {}) {
  await TestBed.configureTestingModule({
    imports: [ListControlBar],
    providers: [
      { provide: BreakpointObserver, useValue: makeBreakpointObserver(options.desktop ?? true) },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ListControlBar);
  fixture.componentRef.setInput('viewMode', 'medium');
  fixture.componentRef.setInput('sortOptions', SORT_OPTIONS);
  fixture.componentRef.setInput('sortValue', 'urgence');
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('ListControlBar (Story 29.9)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('sélecteur de mode : 3 boutons, clic émet viewModeChange avec la bonne valeur (AC1)', async () => {
    const fixture = await setup();
    const emitted: string[] = [];
    fixture.componentInstance.viewModeChange.subscribe((v) => emitted.push(v));

    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('.list-control-bar__mode');
    expect(buttons.length).toBe(3);

    buttons[0].click();
    fixture.detectChanges();

    expect(emitted).toEqual(['large']);
  });

  it('aucun libellé texte de mode dans le DOM (AC2) — le bouton ne porte que son icône', async () => {
    const fixture = await setup();

    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('.list-control-bar__mode');
    const forbiddenLabels = [
      'Grande vignette',
      'Vignette intermédiaire',
      'Liste compacte',
      'large',
      'medium',
      'compact',
    ];
    buttons.forEach((btn) => {
      expect(btn.textContent?.trim()).toBe('');
      forbiddenLabels.forEach((label) => expect(btn.textContent).not.toContain(label));
    });
  });

  it('masquage au défilement : descend au-delà du seuil → masqué, remonte → révélé (AC5)', async () => {
    const fixture = await setup();
    const bar: HTMLElement = fixture.nativeElement.querySelector('.list-control-bar');
    expect(bar.classList.contains('list-control-bar--hidden')).toBe(false);

    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(bar.classList.contains('list-control-bar--hidden')).toBe(true);

    Object.defineProperty(window, 'scrollY', { value: 20, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(bar.classList.contains('list-control-bar--hidden')).toBe(false);
  });

  it('un défilement sous le seuil ne change rien (anti-clignotement, AC5)', async () => {
    const fixture = await setup();
    const bar: HTMLElement = fixture.nativeElement.querySelector('.list-control-bar');

    Object.defineProperty(window, 'scrollY', { value: 10, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    expect(bar.classList.contains('list-control-bar--hidden')).toBe(false);
  });

  it('repli par défaut : replié au premier rendu, le clic sur le bouton déplie (patron Story 29.8)', async () => {
    const fixture = await setup();
    const bar: HTMLElement = fixture.nativeElement.querySelector('.list-control-bar');
    expect(bar.classList.contains('list-control-bar--expanded')).toBe(false);

    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.list-control-bar__toggle',
    );
    toggle.click();
    fixture.detectChanges();

    expect(bar.classList.contains('list-control-bar--expanded')).toBe(true);
  });

  describe('icônes du jeu de thème (Story 51.2)', () => {
    const iconOf = (el: Element | null) => el?.querySelector('app-icon')?.getAttribute('data-icon');

    it('filtres, trois modes de vue et recherche (desktop et mobile) portent leur utilitaire', async () => {
      const desktop = await setup({ desktop: true });
      desktop.componentRef.setInput('searchQuery', '');
      desktop.detectChanges();
      const d = desktop.nativeElement as HTMLElement;
      expect(iconOf(d.querySelector('.list-control-bar__toggle'))).toBe('filtres');
      expect(
        Array.from(d.querySelectorAll('.list-control-bar__mode')).map((b) => iconOf(b)),
      ).toEqual(['vue-large', 'vue-moyenne', 'vue-compacte']);
      expect(iconOf(d.querySelector('.list-control-bar__search'))).toBe('rechercher');
      TestBed.resetTestingModule();

      const mobile = await setup({ desktop: false });
      mobile.componentRef.setInput('searchQuery', '');
      mobile.detectChanges();
      expect(
        iconOf(
          (mobile.nativeElement as HTMLElement).querySelector('.list-control-bar__search--mobile'),
        ),
      ).toBe('rechercher');
    });

    it('pastille de réinitialisation : icône reinitialiser', async () => {
      const fixture = await setup();
      fixture.componentRef.setInput('hasDeviatedFromDefault', true);
      fixture.detectChanges();
      expect(iconOf(fixture.nativeElement.querySelector('.list-control-bar__reset'))).toBe(
        'reinitialiser',
      );
    });

    it('les icônes restent décoratives : le bouton garde son nom accessible, l’icône n’en a pas', async () => {
      const fixture = await setup();
      const mode = fixture.nativeElement.querySelector('.list-control-bar__mode') as HTMLElement;
      expect(mode.getAttribute('aria-label')).toBeTruthy();
      expect(mode.querySelector('app-icon svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(mode.querySelector('[aria-label], [role="img"]')).toBeNull();
    });
  });

  describe('recherche (AC7)', () => {
    it('desktop : recherche visible en permanence, hors de la zone repliée', async () => {
      const fixture = await setup({ desktop: true });
      fixture.componentRef.setInput('searchQuery', '');
      fixture.detectChanges();
      await fixture.whenStable();

      const search = fixture.nativeElement.querySelector(
        '.list-control-bar__row .list-control-bar__search',
      );
      expect(search).not.toBeNull();
    });

    it('mobile : recherche repliée derrière l’icône de révélation, absente de la ligne toujours visible', async () => {
      const fixture = await setup({ desktop: false });
      fixture.componentRef.setInput('searchQuery', '');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(
        fixture.nativeElement.querySelector('.list-control-bar__row .list-control-bar__search'),
      ).toBeNull();
      expect(
        fixture.nativeElement.querySelector('.list-control-bar__fields .list-control-bar__search'),
      ).not.toBeNull();
    });

    it('searchQuery=null → aucun champ de recherche rendu', async () => {
      const fixture = await setup();

      expect(fixture.nativeElement.querySelector('.list-control-bar__search')).toBeNull();
    });

    it('saisie dans le champ émet searchQueryChange', async () => {
      const fixture = await setup({ desktop: true });
      fixture.componentRef.setInput('searchQuery', '');
      fixture.detectChanges();
      await fixture.whenStable();

      const emitted: string[] = [];
      fixture.componentInstance.searchQueryChange.subscribe((v) => emitted.push(v));

      const input: HTMLInputElement = fixture.nativeElement.querySelector(
        '.list-control-bar__search input',
      );
      input.value = 'Fenn';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(emitted).toEqual(['Fenn']);
    });
  });

  describe('pastille de résumé (AC6)', () => {
    it('hasDeviatedFromDefault=false → aucune pastille', async () => {
      const fixture = await setup();

      expect(fixture.nativeElement.querySelector('.list-control-bar__reset')).toBeNull();
    });

    it('hasDeviatedFromDefault=true → pastille visible, clic émet resetRequested', async () => {
      const fixture = await setup();
      fixture.componentRef.setInput('hasDeviatedFromDefault', true);
      fixture.detectChanges();
      await fixture.whenStable();

      const reset: HTMLButtonElement = fixture.nativeElement.querySelector(
        '.list-control-bar__reset',
      );
      expect(reset).not.toBeNull();

      let emitted = false;
      fixture.componentInstance.resetRequested.subscribe(() => (emitted = true));
      reset.click();

      expect(emitted).toBe(true);
    });
  });

  it('tri : sélection émet sortChange avec la valeur choisie', async () => {
    const fixture = await setup();
    const emitted: string[] = [];
    fixture.componentInstance.sortChange.subscribe((v) => emitted.push(v));

    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      '.list-control-bar__fields select',
    );
    select.value = 'nom';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted).toEqual(['nom']);
  });
});
