import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { PartieMemberDto, SessionPollDto } from '@desdispos/shared';
import { PollMissingPanel } from './poll-missing';

/** Story 36.9 — le panneau « Vote en cours » du calendrier, réduit à des personnes. */
describe('PollMissingPanel (Story 36.9)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const MEMBERS: PartieMemberDto[] = [
    { userId: 'u1', pseudo: 'incon', displayName: 'Incon' },
    { userId: 'u2', pseudo: 'marc', displayName: 'Marc' },
    { userId: 'u3', pseudo: 'lea', displayName: 'Léa' },
  ] as PartieMemberDto[];

  function poll(over: Partial<SessionPollDto> = {}): SessionPollDto {
    return {
      id: 'poll1',
      partieId: 'partie-1',
      status: 'OPEN',
      scenarioRef: null,
      expiresAt: null,
      chosenDate: null,
      chosenSlot: null,
      membersCount: 4,
      options: [
        {
          id: 'o1',
          date: '2026-08-28T00:00:00.000Z',
          slot: 'EVENING',
          votes: [
            { userId: 'u1', pseudo: 'incon', displayName: 'Incon', answer: 'YES' },
            { userId: 'u2', pseudo: 'marc', displayName: 'Marc', answer: 'NO' },
          ],
        },
      ],
      ...over,
    } as SessionPollDto;
  }

  function create(p: SessionPollDto = poll(), members = MEMBERS): HTMLElement {
    TestBed.configureTestingModule({ imports: [PollMissingPanel] });
    const f = TestBed.createComponent(PollMissingPanel);
    f.componentRef.setInput('poll', p);
    f.componentRef.setInput('members', members);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('AC4 — il nomme qui manque ET qui a répondu', () => {
    const el = create();
    const rows = el.querySelectorAll('.poll-missing__row');

    expect(rows[0].textContent).toContain('Léa');
    expect(rows[0].textContent).not.toContain('Incon');
    expect(rows[1].textContent).toContain('Incon');
    expect(rows[1].textContent).toContain('Marc');
  });

  it('AC4 — 🚨 aucune liste de créneaux, aucun bouton de scellement', () => {
    const el = create();

    expect(el.querySelector('.poll-status__options')).toBeNull();
    expect(el.querySelectorAll('button')).toHaveLength(0);
    // Aucune date n'est rendue : elles vivent désormais dans la grille.
    expect(el.textContent).not.toContain('août');
    expect(el.textContent).not.toContain('Soir');
  });

  it('AC7 — 🚨 le dénominateur vient de `membersCount`, jamais de la longueur de la liste', () => {
    // 3 membres nommés, mais une troupe de 4 : le MJ n'a pas de ligne `Membership`.
    const el = create();
    expect(el.querySelector('.poll-missing__summary')!.textContent).toContain('2/4');
    expect(el.querySelector('.poll-missing__summary')!.textContent).not.toContain('2/3');
  });

  it('AC7 — le compte suit les réponses, pas le nombre d’options', () => {
    const el = create(
      poll({
        membersCount: 4,
        options: [
          {
            id: 'o1',
            date: '2026-08-28T00:00:00.000Z',
            slot: 'EVENING',
            votes: [{ userId: 'u1', pseudo: 'incon', displayName: 'Incon', answer: 'YES' }],
          },
          // Incon n'a PAS voté sur la seconde : il n'a donc pas « répondu » (définition partagée).
          { id: 'o2', date: '2026-08-29T00:00:00.000Z', slot: 'EVENING', votes: [] },
        ],
      } as Partial<SessionPollDto>),
    );
    expect(el.querySelector('.poll-missing__summary')!.textContent).toContain('0/4');
  });

  it('tous les membres ont répondu : le panneau le dit plutôt que d’afficher une ligne vide', () => {
    const el = create(
      poll({
        options: [
          {
            id: 'o1',
            date: '2026-08-28T00:00:00.000Z',
            slot: 'EVENING',
            votes: [
              { userId: 'u1', pseudo: 'incon', displayName: 'Incon', answer: 'YES' },
              { userId: 'u2', pseudo: 'marc', displayName: 'Marc', answer: 'NO' },
              { userId: 'u3', pseudo: 'lea', displayName: 'Léa', answer: 'YES' },
            ],
          },
        ],
      } as Partial<SessionPollDto>),
    );

    expect(el.querySelector('.poll-missing__all')).toBeTruthy();
    expect(el.querySelector('.poll-missing__row--missing')).toBeNull();
  });

  it('P-1 — le préfixe « qui manque » est écrit en toutes lettres, pas porté par la seule couleur', () => {
    const el = create();
    const prefix = el.querySelector('.poll-missing__row--missing .poll-missing__prefix')!;
    expect(prefix.textContent!.trim().length).toBeGreaterThan(0);
  });
});
