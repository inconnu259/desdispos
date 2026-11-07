import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { THEMES } from '@master-jdr/shared';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../core/theme/tones';
import type { SituationValue } from '../../core/status/status-derivation';
import { SituationLine } from './situation-line';

async function createLine(value: SituationValue | null, theme: (typeof THEMES)[number]) {
  await TestBed.configureTestingModule({
    imports: [SituationLine],
    providers: [{ provide: ThemeToneService, useValue: { tone: signal(TONE_MAP[theme]) } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(SituationLine);
  fixture.componentRef.setInput('value', value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

// Story 53.3 — la ligne rend le libellé « Ma situation » et la pastille ; rien pour `null`.
describe('SituationLine — rendu', () => {
  afterEach(() => TestBed.resetTestingModule());

  for (const theme of THEMES) {
    it(`${theme} : libellé + pastille pour une valeur`, async () => {
      const el = await createLine('vote_a_faire', theme);
      expect(el.querySelector('.situation-line__label')?.textContent?.trim()).toBe(
        'Ma situation',
      );
      expect(el.querySelector('.situation-pill')?.textContent?.trim()).toBe('Vote à faire');
    });
  }

  it('null : aucune ligne, ni libellé orphelin', async () => {
    const el = await createLine(null, 'grimoire-emeraude');
    expect(el.querySelector('.situation-line')).toBeNull();
    expect(el.querySelector('.situation-pill')).toBeNull();
    expect(el.textContent?.trim()).toBe('');
  });

  it('texte seul : aucun élément interactif', async () => {
    const el = await createLine('je_mene', 'grimoire-emeraude');
    expect(el.querySelector('button, a, input, [role="button"], [tabindex]')).toBeNull();
  });
});
