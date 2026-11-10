import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PollTrack } from './poll-track';
import type { VoteParticipation } from '../poll-track.utils';
import { fillTone } from '../../../core/theme/tone-format';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function vote(over: Partial<VoteParticipation> = {}): VoteParticipation {
  return {
    partieId: 'partie-1',
    pollId: 'poll1',
    optionId: 'o1',
    yes: 0,
    maybe: 0,
    no: 0,
    total: 4,
    myAnswer: null,
    ...over,
  };
}

async function render(v: VoteParticipation) {
  const fixture = TestBed.createComponent(PollTrack);
  fixture.componentRef.setInput('vote', v);
  fixture.detectChanges();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  return fixture;
}

describe('PollTrack (Story 36.6)', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [PollTrack] }));
  afterEach(() => TestBed.resetTestingModule());

  it('AC2 — rend trois segments distincts : oui, peut-être, non', async () => {
    const fixture = await render(vote({ yes: 2, maybe: 1, no: 1 }));
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.seg-yes')).toBeTruthy();
    expect(el.querySelector('.seg-maybe')).toBeTruthy();
    expect(el.querySelector('.seg-no')).toBeTruthy();
  });

  it('AC1/AC3 — les largeurs sont proportionnelles à l’EFFECTIF : 1 oui sur 4 ≠ 4 oui sur 4', async () => {
    const solitaire: HTMLElement = (await render(vote({ yes: 1 }))).nativeElement;
    const plebiscite: HTMLElement = (await render(vote({ yes: 4 }))).nativeElement;

    const w = (el: HTMLElement) => (el.querySelector('.seg-yes') as HTMLElement).style.width;
    expect(w(solitaire)).toBe('25%');
    expect(w(plebiscite)).toBe('100%');
  });

  it('AC2 — aucun segment « non répondu » n’est émis : la trame est le FOND de la piste', async () => {
    const fixture = await render(vote({ yes: 1 }));
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.seg-unknown')).toBeNull();
    expect(el.querySelector('.track')).toBeTruthy();
  });

  it('AC4 — le compteur « 3 / 4 » est TOUJOURS dans le DOM ; c’est le CSS qui décide de le montrer', async () => {
    const fixture = await render(vote({ yes: 2, maybe: 1 }));
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.cnt')?.textContent?.trim()).toBe('3 / 4');
  });

  it('AC5 — ma réponse est écrite en toutes lettres, jamais un code', async () => {
    const fixture = await render(vote({ yes: 1, myAnswer: 'YES' }));
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.mine')?.textContent).toContain('oui');
    expect(el.querySelector('.mine')?.textContent).not.toContain('YES');
  });

  it('AC5 — aucune réponse de ma part → aucun nœud « ma réponse »', async () => {
    const fixture = await render(vote({ yes: 1 }));
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.mine')).toBeNull();
  });

  it('AC14 — la piste porte un nom accessible complet, non tronqué par le CSS', async () => {
    const fixture = await render(vote({ yes: 2, maybe: 1, myAnswer: 'YES' }));
    const track = fixture.nativeElement.querySelector('.track') as HTMLElement;

    expect(track.getAttribute('role')).toBe('img');
    const label = track.getAttribute('aria-label') ?? '';
    expect(label).toContain(
      fillTone(GRIMOIRE_TONE['calendar.util_participation_many'], { n: 3, total: 4 }),
    );
    expect(label).toContain('2 oui');
    expect(label).toContain(
      fillTone(GRIMOIRE_TONE['calendar.util_answer_mine'], {
        answer: GRIMOIRE_TONE['calendar.util_answer_yes'],
      }),
    );
  });

  it('AC14 — le compteur et ma réponse visibles sont aria-hidden : l’information est annoncée UNE fois', async () => {
    const fixture = await render(vote({ yes: 1, myAnswer: 'YES' }));
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.cnt')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.mine')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('effectif nul → aucune largeur NaN dans un attribut de style', async () => {
    const fixture = await render(vote({ yes: 2, total: 0 }));
    const el: HTMLElement = fixture.nativeElement;

    const seg = el.querySelector('.seg-yes') as HTMLElement | null;
    expect(seg?.style.width ?? '0%').not.toContain('NaN');
  });
});
