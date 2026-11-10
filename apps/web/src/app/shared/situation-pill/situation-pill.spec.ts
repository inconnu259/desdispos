import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { THEMES } from '@master-jdr/shared';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../core/theme/tones';
import type { SituationValue } from '../../core/status/status-derivation';
import { SituationPill } from './situation-pill';

async function createPill(value: SituationValue, theme: (typeof THEMES)[number]) {
  await TestBed.configureTestingModule({
    imports: [SituationPill],
    providers: [{ provide: ThemeToneService, useValue: { tone: signal(TONE_MAP[theme]) } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(SituationPill);
  fixture.componentRef.setInput('value', value);
  fixture.detectChanges();
  return fixture.nativeElement.querySelector('.situation-pill') as HTMLElement;
}

// Story 53.1 — le RENDU de la pastille : un mot (jamais la couleur seule) et une classe de teinte
// par valeur. Les libellés sont identiques dans les trois thèmes : on le vérifie thème par thème.
const LABELS: Record<SituationValue, string> = {
  je_mene: 'Je mène',
  vote_a_faire: 'Vote à faire',
  j_ai_vote: 'J’ai voté',
  je_participe: 'Je participe',
  pas_inscrit: 'Pas inscrit·e',
  j_y_etais: 'J’y étais',
  place_reservee: 'Place réservée',
};

describe('SituationPill — rendu', () => {
  afterEach(() => TestBed.resetTestingModule());

  for (const theme of THEMES) {
    for (const value of Object.keys(LABELS) as SituationValue[]) {
      it(`${theme} / ${value} → « ${LABELS[value]} » et classe de teinte dédiée`, async () => {
        const el = await createPill(value, theme);
        expect(el.textContent?.trim()).toBe(LABELS[value]);
        expect(el.classList).toContain(`situation-pill--${value}`);
      });
    }
  }

  it('une seule classe de teinte à la fois', async () => {
    const el = await createPill('vote_a_faire', 'grimoire-emeraude');
    const tints = Array.from(el.classList).filter((c) => c.startsWith('situation-pill--'));
    expect(tints).toEqual(['situation-pill--vote_a_faire']);
  });
});
