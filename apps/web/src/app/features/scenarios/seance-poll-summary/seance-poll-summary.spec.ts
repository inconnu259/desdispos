import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { THEMES } from '@master-jdr/shared';
import type { SessionPollDto } from '@master-jdr/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { SeancePollSummary } from './seance-poll-summary';

const TODAY = '2026-11-01'; // un dimanche

const vote = (userId: string, answer: 'YES' | 'NO' | 'MAYBE') => ({
  userId,
  pseudo: userId,
  displayName: `Nom ${userId}`,
  answer,
});

function poll(over: Partial<SessionPollDto> = {}): SessionPollDto {
  return {
    id: 'poll1',
    partieId: 'p1',
    status: 'OPEN',
    scenarioRef: null,
    expiresAt: null,
    chosenDate: null,
    chosenSlot: null,
    membersCount: 4,
    durationSlots: 1,
    options: [
      { id: 'o1', date: '2026-11-07T00:00:00.000Z', slot: 'EVENING', votes: [] },
      { id: 'o2', date: '2026-11-08T00:00:00.000Z', slot: 'EVENING', votes: [] },
    ],
    ...over,
  };
}

async function create(
  value: SessionPollDto,
  { theme = 'grimoire-emeraude' as (typeof THEMES)[number], userId = 'me' } = {},
) {
  await TestBed.configureTestingModule({
    imports: [SeancePollSummary],
    providers: [
      { provide: ThemeToneService, useValue: { tone: signal(TONE_MAP[theme]) } },
      { provide: AuthService, useValue: { currentUser: () => ({ id: userId }) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(SeancePollSummary);
  fixture.componentRef.setInput('poll', value);
  fixture.componentRef.setInput('todayKey', TODAY);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const lines = Array.from(el.querySelectorAll('.seance-poll-summary__line')).map((l) =>
    (l.textContent ?? '').trim(),
  );
  return { el, lines };
}

// Story 54.2 — le résumé du vote côté joueur : lignes de texte, jamais un nom, aucune action.
describe('SeancePollSummary', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('aucune réponse : mes réponses, pas de meilleur créneau, 4 absents, pas d’échéance', async () => {
    const { lines } = await create(poll());
    expect(lines).toEqual([
      'Vos réponses : 0 créneau sur 2',
      'Pas encore de meilleur créneau',
      '4 personnes n’ont pas encore répondu',
    ]);
  });

  it('meilleur créneau « samedi 7 novembre, soir — 2 oui », réponses au pluriel', async () => {
    const { lines } = await create(
      poll({
        options: [
          {
            id: 'o1',
            date: '2026-11-07T00:00:00.000Z',
            slot: 'EVENING',
            votes: [vote('me', 'YES'), vote('u2', 'YES')],
          },
          {
            id: 'o2',
            date: '2026-11-08T00:00:00.000Z',
            slot: 'EVENING',
            votes: [vote('me', 'NO')],
          },
        ],
      }),
    );
    expect(lines[0]).toBe('Vos réponses : 2 créneaux sur 2');
    expect(lines[1]).toBe('Meilleur créneau pour l’instant : samedi 7 novembre, soir — 2 oui');
  });

  it('une seule réponse de ma part → « créneau » au singulier', async () => {
    const { lines } = await create(
      poll({
        options: [
          {
            id: 'o1',
            date: '2026-11-07T00:00:00.000Z',
            slot: 'EVENING',
            votes: [vote('me', 'YES')],
          },
          { id: 'o2', date: '2026-11-08T00:00:00.000Z', slot: 'EVENING', votes: [] },
        ],
      }),
    );
    expect(lines[0]).toBe('Vos réponses : 1 créneau sur 2');
  });

  it('un seul absent → « 1 personne n’a pas encore répondu » ; aucun absent → ligne absente', async () => {
    const answered = (id: string) => [
      {
        id: 'o1',
        date: '2026-11-07T00:00:00.000Z',
        slot: 'EVENING' as const,
        votes: [vote(id, 'YES')],
      },
    ];
    const one = await create(
      poll({
        membersCount: 2,
        options: [
          {
            id: 'o1',
            date: '2026-11-07T00:00:00.000Z',
            slot: 'EVENING',
            votes: [vote('me', 'YES')],
          },
        ],
      }),
    );
    expect(one.lines).toContain('1 personne n’a pas encore répondu');
    TestBed.resetTestingModule();
    const none = await create(poll({ membersCount: 1, options: answered('me') }));
    expect(none.lines.some((l) => l.includes('pas encore répondu'))).toBe(false);
  });

  it('un rendez-vous de plusieurs créneaux s’écrit avec sa plage', async () => {
    const { lines } = await create(
      poll({
        durationSlots: 2,
        options: [
          {
            id: 'o1',
            date: '2026-11-06T00:00:00.000Z',
            slot: 'EVENING',
            votes: [vote('u2', 'YES')],
          },
        ],
      }),
    );
    expect(lines[1]).toBe(
      'Meilleur créneau pour l’instant : du vendredi 6 soir au samedi 7 matin — 1 oui',
    );
  });

  it('échéance : « Échéance : jeudi 5 novembre » ; passée → « Le vote est terminé. » et le reste demeure', async () => {
    const open = await create(poll({ expiresAt: '2026-11-05T21:59:59.000Z' }));
    expect(open.lines).toContain('Échéance : jeudi 5 novembre');
    TestBed.resetTestingModule();
    const passed = await create(poll({ expiresAt: '2026-10-30T21:59:59.000Z' }));
    expect(passed.lines).toContain('Le vote est terminé.');
    expect(passed.lines.some((l) => l.startsWith('Vos réponses'))).toBe(true);
    expect(passed.lines.some((l) => l.startsWith('Échéance'))).toBe(false);
  });

  it('le jour d’échéance reste un jour de vote', async () => {
    const { lines } = await create(poll({ expiresAt: '2026-11-01T21:59:59.000Z' }));
    expect(lines).toContain('Échéance : dimanche 1er novembre');
  });

  it('aucun nom de votant, aucun élément interactif', async () => {
    const { el } = await create(
      poll({
        options: [
          {
            id: 'o1',
            date: '2026-11-07T00:00:00.000Z',
            slot: 'EVENING',
            votes: [vote('lou', 'YES')],
          },
        ],
      }),
    );
    expect(el.textContent).not.toContain('Nom lou');
    expect(el.querySelector('button, a, input, [role="button"], [tabindex]')).toBeNull();
  });

  it('Forêt : « Tes réponses » ; les autres lignes sont identiques dans les trois thèmes', async () => {
    const value = poll({ expiresAt: '2026-11-05T21:59:59.000Z' });
    const grimoire = await create(value);
    TestBed.resetTestingModule();
    const foret = await create(value, { theme: 'foret-ancienne' });
    TestBed.resetTestingModule();
    const atelier = await create(value, { theme: 'atelier-cuivre' });
    expect(foret.lines[0]).toBe('Tes réponses : 0 créneau sur 2');
    expect(atelier.lines[0]).toBe(grimoire.lines[0]);
    expect(foret.lines.slice(1)).toEqual(grimoire.lines.slice(1));
    expect(atelier.lines.slice(1)).toEqual(grimoire.lines.slice(1));
  });
});

// Story 54.3 — le résumé côté MJ : absents nommés, repli sur le nombre, actions secondaires.
describe('SeancePollSummary — côté MJ (Story 54.3)', () => {
  const members = [
    { userId: 'lou', pseudo: 'lou', displayName: 'Lou', role: 'MEMBER', joinedAt: '' },
    { userId: 'sam', pseudo: 'sam', displayName: '', role: 'MEMBER', joinedAt: '' },
    { userId: 'zoe', pseudo: 'zoe', displayName: 'Zoé', role: 'MEMBER', joinedAt: '' },
  ] as never[];
  const withVotes = poll({
    options: [
      { id: 'o1', date: '2026-11-07T00:00:00.000Z', slot: 'EVENING', votes: [vote('zoe', 'YES')] },
      { id: 'o2', date: '2026-11-08T00:00:00.000Z', slot: 'EVENING', votes: [vote('zoe', 'NO')] },
    ],
  });

  async function createGm(
    value: SessionPollDto,
    {
      loaded = true,
      dialogResult = of(true),
      theme = 'grimoire-emeraude' as (typeof THEMES)[number],
    } = {},
  ) {
    const open = vi.fn().mockReturnValue({ afterClosed: () => dialogResult });
    await TestBed.configureTestingModule({
      imports: [SeancePollSummary],
      providers: [
        { provide: ThemeToneService, useValue: { tone: signal(TONE_MAP[theme]) } },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'mj' }) } },
        { provide: MatDialog, useValue: { open } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SeancePollSummary);
    fixture.componentRef.setInput('poll', value);
    fixture.componentRef.setInput('todayKey', TODAY);
    fixture.componentRef.setInput('isMj', true);
    fixture.componentRef.setInput('members', members);
    fixture.componentRef.setInput('membersLoaded', loaded);
    const closePoll = vi.fn();
    const seeInCalendar = vi.fn();
    fixture.componentInstance.closePoll.subscribe(closePoll);
    fixture.componentInstance.seeInCalendar.subscribe(seeInCalendar);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const lines = Array.from(el.querySelectorAll('.seance-poll-summary__line')).map((l) =>
      (l.textContent ?? '').trim(),
    );
    const button = (label: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
    return { fixture, el, lines, open, closePoll, seeInCalendar, button };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('lignes du MJ : réponses, meilleur créneau, absents nommés (displayName, à défaut pseudo)', async () => {
    const { lines } = await createGm(withVotes);
    expect(lines).toEqual([
      'Réponses : 1 sur 4 joueurs',
      'Meilleur créneau pour l’instant : samedi 7 novembre, soir — 1 oui',
      'N’ont pas encore répondu : Lou, sam',
    ]);
    expect(lines.some((l) => l.startsWith('Vos réponses'))).toBe(false);
  });

  it('liste non chargée ou en échec : repli sur le nombre d’absents', async () => {
    const { lines } = await createGm(withVotes, { loaded: false });
    expect(lines).toContain('3 personnes n’ont pas encore répondu');
    expect(lines.some((l) => l.startsWith('N’ont pas'))).toBe(false);
  });

  it('zéro absent nommé : la ligne disparaît (le MJ n’est jamais nommé)', async () => {
    const all = poll({
      options: [
        {
          id: 'o1',
          date: '2026-11-07T00:00:00.000Z',
          slot: 'EVENING',
          votes: ['lou', 'sam', 'zoe'].map((id) => vote(id, 'YES')),
        },
      ],
    });
    const { lines } = await createGm(all);
    expect(lines.some((l) => l.includes('pas encore répondu'))).toBe(false);
  });

  it('échéance : « Échéance : … » ; passée → « Le vote est terminé. »', async () => {
    const open = await createGm({ ...withVotes, expiresAt: '2026-11-05T21:59:59.000Z' });
    expect(open.lines).toContain('Échéance : jeudi 5 novembre');
    TestBed.resetTestingModule();
    const passed = await createGm({ ...withVotes, expiresAt: '2026-10-30T21:59:59.000Z' });
    expect(passed.lines).toContain('Le vote est terminé.');
  });

  it('textes identiques dans les trois thèmes', async () => {
    const grimoire = await createGm(withVotes);
    TestBed.resetTestingModule();
    const foret = await createGm(withVotes, { theme: 'foret-ancienne' });
    TestBed.resetTestingModule();
    const atelier = await createGm(withVotes, { theme: 'atelier-cuivre' });
    expect(foret.lines).toEqual(grimoire.lines);
    expect(atelier.lines).toEqual(grimoire.lines);
  });

  it('actions : « Clôturer le vote » (libellé du thème) puis « Voir dans le calendrier → », jamais « Fixer la date… »', async () => {
    const { el } = await createGm(withVotes);
    const labels = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Clore le conseil', 'Voir dans le calendrier →']);
    expect(el.textContent).not.toContain('Fixer la date');
  });

  it('« Clôturer le vote » : confirmation avec le message et le libellé du thème ; confirmer émet closePoll', async () => {
    const { button, open, closePoll } = await createGm(withVotes);
    button('Clore le conseil')!.click();
    await Promise.resolve();
    await Promise.resolve();
    const [, config] = open.mock.calls[0];
    expect(config.data.message).toBe(
      'Clore le conseil sans fixer de date ? Les réponses ne pourront plus changer.',
    );
    expect(config.data.confirmLabel).toBe('Clore le conseil');
    expect(closePoll).toHaveBeenCalledTimes(1);
  });

  it('« Renoncer » laisse le vote ouvert : aucune émission', async () => {
    const { button, closePoll, open } = await createGm(withVotes, { dialogResult: of(false) });
    button('Clore le conseil')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(open).toHaveBeenCalledTimes(1);
    expect(closePoll).not.toHaveBeenCalled();
  });

  it('« Voir dans le calendrier → » émet seeInCalendar', async () => {
    const { button, seeInCalendar } = await createGm(withVotes);
    button('Voir dans le calendrier →')!.click();
    expect(seeInCalendar).toHaveBeenCalledTimes(1);
  });

  it('côté joueur : aucun bouton', async () => {
    const { el } = await create(withVotes);
    expect(el.querySelector('button')).toBeNull();
  });
});
