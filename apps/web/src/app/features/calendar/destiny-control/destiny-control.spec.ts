import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Theme } from '@master-jdr/shared';
import { THEMED_ICONS } from '../../../core/icons/icon-registry.generated';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { DestinyControl } from './destiny-control';

// Story 51.5 — la puce Destinée porte l'icône `destinee` (icône de sens : elle change avec le thème,
// sur place) ; les chevrons de créneau sont des utilitaires, identiques dans les trois thèmes.

describe('DestinyControl — pictogrammes (story 51.5)', () => {
  // Service de thème factice : `setTheme` du vrai service écrit le localStorage et ferait fuir le thème
  // vers les autres specs d'un même worker.
  const activeTheme = signal<Theme>('grimoire-emeraude');
  const theme = { activeTheme, tone: computed(() => TONE_MAP[activeTheme()]) };

  beforeEach(() => {
    activeTheme.set('grimoire-emeraude');
    TestBed.configureTestingModule({
      imports: [DestinyControl],
      providers: [{ provide: ThemeToneService, useValue: theme }],
    });
  });
  afterEach(() => TestBed.resetTestingModule());

  function create() {
    const fixture = TestBed.createComponent(DestinyControl);
    fixture.componentRef.setInput('polls', [{ pollId: 'p1', label: 'Chapitre 4' }]);
    fixture.componentRef.setInput('currentPollId', 'p1');
    fixture.componentRef.setInput('slotPosition', 1);
    fixture.componentRef.setInput('slotCount', 3);
    fixture.detectChanges();
    return fixture;
  }

  const chipPaths = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.destiny__chip app-icon svg path')).map((p) =>
      p.getAttribute('d'),
    );

  it('la puce porte destinee, et le dessin change en place quand le thème change', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;

    const icon = el.querySelector('.destiny__chip app-icon')!;
    expect(icon.getAttribute('data-icon')).toBe('destinee');
    expect(icon.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.destiny__chip')!.textContent).not.toContain('✦');
    const grimoire = chipPaths(el);
    expect(grimoire.length).toBeGreaterThan(0);

    activeTheme.set('foret-ancienne');
    fixture.detectChanges();

    expect(el.querySelector('.destiny__chip app-icon')).toBe(icon);
    expect(chipPaths(el)).not.toEqual(grimoire);
    expect(chipPaths(el)).toEqual(
      THEMED_ICONS['destinee']['foret-ancienne'].elements
        .filter((e) => e.tag === 'path')
        .map((e) => e.attrs['d']),
    );
  });

  it('les chevrons de créneau sont precedent / suivant, sans caractère, et ne changent pas avec le thème', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;

    const arrows = Array.from(el.querySelectorAll('.destiny__arrow'));
    expect(arrows.map((a) => a.querySelector('app-icon')!.getAttribute('data-icon'))).toEqual([
      'precedent',
      'suivant',
    ]);
    expect(arrows.map((a) => a.textContent!.trim())).toEqual(['', '']);
    const arrowMarkup = () =>
      Array.from(el.querySelectorAll('.destiny__arrow app-icon')).map((i) => i.innerHTML);
    const before = arrowMarkup();

    activeTheme.set('atelier-cuivre');
    fixture.detectChanges();
    // Les noms accessibles des boutons suivent le thème (ton) ; les dessins, eux, restent identiques.
    expect(arrowMarkup()).toEqual(before);
  });
});
