import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ComposeConfirmDialog, type ComposeConfirmData } from './compose-confirm-dialog';
import { TONE_MAP } from '../../../core/theme/tones';
import { fillTone } from '../../../core/theme/tone-format';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function makeData(overrides: Partial<ComposeConfirmData> = {}): ComposeConfirmData {
  return {
    slotCount: 3,
    removedCount: 2,
    voterCount: 4,
    ...overrides,
  };
}

async function createComponent(data: ComposeConfirmData) {
  await TestBed.configureTestingModule({
    imports: [ComposeConfirmDialog],
    providers: [
      provideNoopAnimations(),
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ComposeConfirmDialog);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const text = (el: HTMLElement, selector: string) =>
  el.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

// Story 35.2 — les accords en nombre vivent désormais dans le registre de ton : le nombre de votants
// est NOMMÉ dans l'avertissement (AC6 de la 36.10), au singulier comme au pluriel.
describe('ComposeConfirmDialog — textes du registre (Story 35.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('pluriel : avertissement nommant créneaux et réponses perdus', async () => {
    const el = await createComponent(makeData({ removedCount: 2, voterCount: 4 }));

    expect(text(el, '.compose-confirm__warning')).toBe(
      fillTone(GRIMOIRE_TONE['calendar.compose_confirm_warning_many'], {
        slots: fillTone(GRIMOIRE_TONE['calendar.compose_confirm_slots_many'], { n: 2 }),
        votes: fillTone(GRIMOIRE_TONE['calendar.compose_confirm_responses_many'], { n: 4 }),
      }),
    );
    expect(text(el, 'h2')).toBe(GRIMOIRE_TONE['calendar.compose_confirm_title_modify']);
  });

  it('singulier : « 1 créneau » et « 1 réponse déjà posée »', async () => {
    const el = await createComponent(makeData({ removedCount: 1, voterCount: 1 }));

    expect(text(el, '.compose-confirm__warning')).toBe(
      fillTone(GRIMOIRE_TONE['calendar.compose_confirm_warning_one'], {
        slots: fillTone(GRIMOIRE_TONE['calendar.compose_confirm_slots_one'], { n: 1 }),
        votes: fillTone(GRIMOIRE_TONE['calendar.compose_confirm_responses_one'], { n: 1 }),
      }),
    );
  });

  it('sans votant : aucun avertissement', async () => {
    const el = await createComponent(makeData({ voterCount: 0 }));

    expect(el.querySelector('.compose-confirm__warning')).toBeNull();
  });

  it('résumé accordé en nombre', async () => {
    const one = await createComponent(makeData({ slotCount: 1 }));
    expect(text(one, '.compose-confirm__summary')).toBe(
      fillTone(GRIMOIRE_TONE['calendar.compose_confirm_summary_one'], { n: 1 }),
    );
    TestBed.resetTestingModule();

    const many = await createComponent(makeData({ slotCount: 5 }));
    expect(text(many, '.compose-confirm__summary')).toBe(
      fillTone(GRIMOIRE_TONE['calendar.compose_confirm_summary_many'], { n: 5 }),
    );
  });

  it('Story 45.2 — plus de sélecteur de séance : le rendez-vous se choisit avant le composer', async () => {
    const el = await createComponent(makeData());

    expect(el.querySelector('.compose-confirm__field')).toBeNull();
    expect(el.querySelector('.compose-confirm__select')).toBeNull();
  });
});

// Story 40.5b — la conjonction d'un groupe : mêmes questions, mots du groupe (créneaux, jamais « séance »).
describe('ComposeConfirmDialog — conjonction d’un groupe (Story 40.5b)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('l’avertissement nomme les créneaux et les réponses perdus avec les textes du groupe', async () => {
    const el = await createComponent(makeData({ group: true, removedCount: 2, voterCount: 4 }));

    expect(text(el, 'h2')).toBe(GRIMOIRE_TONE['partie.ralliement_calendar_confirm_title']);
    expect(text(el, '.compose-confirm__warning')).toBe(
      fillTone(GRIMOIRE_TONE['partie.ralliement_calendar_confirm_warning_many'], {
        slots: fillTone(GRIMOIRE_TONE['partie.ralliement_calendar_confirm_slots_many'], { n: 2 }),
        votes: fillTone(GRIMOIRE_TONE['partie.ralliement_calendar_confirm_responses_many'], {
          n: 4,
        }),
      }),
    );
    expect(text(el, '.compose-confirm__note')).toBe(
      GRIMOIRE_TONE['partie.ralliement_calendar_confirm_note'],
    );
  });

  it('singulier et résumé accordés en nombre', async () => {
    const el = await createComponent(
      makeData({ group: true, slotCount: 1, removedCount: 1, voterCount: 1 }),
    );
    expect(text(el, '.compose-confirm__warning')).toBe(
      fillTone(GRIMOIRE_TONE['partie.ralliement_calendar_confirm_warning_one'], {
        slots: fillTone(GRIMOIRE_TONE['partie.ralliement_calendar_confirm_slots_one'], { n: 1 }),
        votes: fillTone(GRIMOIRE_TONE['partie.ralliement_calendar_confirm_responses_one'], {
          n: 1,
        }),
      }),
    );
    expect(text(el, '.compose-confirm__summary')).toBe(
      fillTone(GRIMOIRE_TONE['partie.ralliement_calendar_confirm_summary_one'], { n: 1 }),
    );
  });

  it('sans l’indicateur de groupe, les textes du JDR ne changent pas', async () => {
    const el = await createComponent(makeData());
    expect(text(el, 'h2')).toBe(GRIMOIRE_TONE['calendar.compose_confirm_title_modify']);
    expect(text(el, '.compose-confirm__note')).toBe(GRIMOIRE_TONE['calendar.compose_confirm_note']);
  });
});

// ⚠️ Story 47.4 — la durée change : toutes les réponses partent, et l'avertissement le dit en ces termes.
describe('ComposeConfirmDialog — durée changée (Story 47.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('« Changer la durée efface les 4 réponses déjà données. », sans la note des créneaux gardés', async () => {
    const el = await createComponent(
      makeData({ removedCount: 0, voterCount: 4, durationChanged: true }),
    );

    expect(text(el, '.compose-confirm__warning')).toBe(
      'Changer la durée efface les 4 réponses déjà données.',
    );
    expect(el.querySelector('.compose-confirm__note')).toBeNull();
  });

  it('au singulier, et pour un groupe aussi', async () => {
    const el = await createComponent(
      makeData({ removedCount: 0, voterCount: 1, durationChanged: true, group: true }),
    );

    expect(text(el, '.compose-confirm__warning')).toBe(
      'Changer la durée efface la réponse déjà donnée.',
    );
  });
});
