import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { it, vi } from 'vitest';
import type { PartieMemberDto, SessionPollDto } from '@master-jdr/shared';
import { PollStatusPanel } from './poll-status';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';

const alice: PartieMemberDto = {
  role: 'MEMBER',
  userId: 'u1',
  pseudo: 'Alice',
  displayName: 'Alice au pays',
  email: 'alice@test.com',
  joinedAt: '',
};
const bob: PartieMemberDto = {
  role: 'MEMBER',
  userId: 'u2',
  pseudo: 'Bob',
  displayName: 'Bobby',
  email: 'bob@test.com',
  joinedAt: '',
};
const carol: PartieMemberDto = {
  role: 'MEMBER',
  userId: 'u3',
  pseudo: 'Carol',
  displayName: 'Carol',
  email: 'carol@test.com',
  joinedAt: '',
};

const fakePoll: SessionPollDto = {
  id: 'poll1',
  partieId: 'p1',
  status: 'OPEN',
  scenarioRef: null,
  expiresAt: null,
  chosenDate: null,
  chosenSlot: null,
  // Story 36.6 — effectif de la troupe (MJ + membres).
  membersCount: 4,
  durationSlots: 1,
  options: [
    {
      id: 'opt1',
      date: '2026-08-01T00:00:00.000Z',
      slot: 'MORNING',
      votes: [
        { userId: 'u1', pseudo: 'Alice', displayName: 'Alice', answer: 'YES' },
        { userId: 'u2', pseudo: 'Bob', displayName: 'Bob', answer: 'YES' },
      ],
    },
    {
      id: 'opt2',
      date: '2026-08-08T00:00:00.000Z',
      slot: 'AFTERNOON',
      votes: [
        { userId: 'u1', pseudo: 'Alice', displayName: 'Alice', answer: 'YES' },
        { userId: 'u2', pseudo: 'Bob', displayName: 'Bob', answer: 'NO' },
      ],
    },
  ],
};

function makeThemeService() {
  return {
    // `activeTheme` : `<app-icon>` (icônes « de sens », story 51.7) lit le thème actif.
    activeTheme: signal('grimoire-emeraude'),
    tone: () => ({
      'poll.status_title': 'Vote en cours',
      'cta.choose_date': 'Sceller ce créneau',
      'alert.all_responded': 'Tous ont répondu.',
      'alert.missing_player': "{name} n'a pas encore répondu.",
      'common.oui': 'Oui',
      'common.non': 'Non',
      'common.peut_etre': 'Peut-être',
      'calendar.util_answer_yes': 'oui',
      'calendar.util_answer_no': 'non',
      'calendar.util_answer_maybe': 'peut-être',
      'pollui.status_voters_aria': 'Votants',
      'pollui.status_missing_aria': "N'ont pas encore répondu pour cette date",
      'pollui.status_choose_confirm':
        'Confirmer {date} — {slot} comme date de la prochaine séance ?',
      'pollui.status_choose_no_vote_warning': "Aucun membre n'a voté pour cette date.",
    }),
  };
}

function makeDialog(confirmed: boolean) {
  return { open: vi.fn().mockReturnValue({ afterClosed: () => of(confirmed) }) };
}

async function createComponent(poll = fakePoll, confirmed = true) {
  const dialog = makeDialog(confirmed);
  await TestBed.configureTestingModule({
    imports: [PollStatusPanel],
    providers: [
      provideAnimationsAsync(),
      { provide: ThemeToneService, useValue: makeThemeService() },
      { provide: MatDialog, useValue: dialog },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(PollStatusPanel);
  fixture.componentRef.setInput('poll', poll);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, dialog };
}

describe('PollStatusPanel', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('countByAnswer compte correctement YES/NO/MAYBE par option', async () => {
    const { fixture } = await createComponent();

    const comp = fixture.componentInstance as any;
    expect(comp.countByAnswer(fakePoll.options[0], 'YES')).toBe(2);
    expect(comp.countByAnswer(fakePoll.options[1], 'NO')).toBe(1);
  });

  it('affiche un badge par votant (pseudo + réponse)', async () => {
    const { fixture } = await createComponent();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Alice');
    expect(text).toContain('Bob');
  });

  it('isAllYes vrai si tous les votants ont répondu YES', async () => {
    const { fixture } = await createComponent();

    const comp = fixture.componentInstance as any;
    expect(comp.isAllYes(fakePoll.options[0])).toBe(true);
    expect(comp.isAllYes(fakePoll.options[1])).toBe(false);
  });

  it('isAllYes retourne false si le poll est CLOSED même si tous les votes sont YES', async () => {
    const closedPoll: SessionPollDto = { ...fakePoll, status: 'CLOSED' };
    const { fixture } = await createComponent(closedPoll);

    const comp = fixture.componentInstance as any;
    expect(comp.isAllYes(closedPoll.options[0])).toBe(false);
  });

  it('onChooseClick + confirmation → émet chosen avec optionId', async () => {
    const { fixture } = await createComponent(fakePoll, true);

    const comp = fixture.componentInstance as any;
    const emitted: string[] = [];
    comp.chosen.subscribe((id: string) => emitted.push(id));
    await comp.onChooseClick(fakePoll.options[0]);
    expect(emitted).toEqual(['opt1']);
  });

  it("onChooseClick + annulation → pas d'émission", async () => {
    const { fixture } = await createComponent(fakePoll, false);

    const comp = fixture.componentInstance as any;
    const emitted: string[] = [];
    comp.chosen.subscribe((id: string) => emitted.push(id));
    await comp.onChooseClick(fakePoll.options[0]);
    expect(emitted).toEqual([]);
  });

  it('onChooseClick sur une option à 0 vote passe l’avertissement dans le champ warning, pas dans le message', async () => {
    const zeroVotePoll: SessionPollDto = {
      ...fakePoll,
      options: [{ ...fakePoll.options[0], votes: [] }, fakePoll.options[1]],
    };
    const { fixture, dialog } = await createComponent(zeroVotePoll, true);

    const comp = fixture.componentInstance as any;
    await comp.onChooseClick(zeroVotePoll.options[0]);
    const data = dialog.open.mock.calls[0][1].data;
    expect(data.warning).toBe("Aucun membre n'a voté pour cette date.");
    expect(data.warning).not.toContain('⚠');
    // Le message reste la question simple, sans avertissement concaténé.
    expect(data.message).not.toContain("Aucun membre n'a voté");
    expect(data.message).toContain('Confirmer');
  });

  it("onChooseClick sur une option avec des votes n'inclut pas l'avertissement 0-vote", async () => {
    const { fixture, dialog } = await createComponent(fakePoll, true);

    const comp = fixture.componentInstance as any;
    await comp.onChooseClick(fakePoll.options[0]);
    const data = dialog.open.mock.calls[0][1].data;
    expect(data.message).not.toContain("Aucun membre n'a voté");
    expect(data.warning).toBeUndefined();
  });

  it("double-clic rapide → le dialogue ne s'ouvre qu'une seule fois (garde dialogPending)", async () => {
    const { fixture, dialog } = await createComponent(fakePoll, true);

    const comp = fixture.componentInstance as any;
    const p1 = comp.onChooseClick(fakePoll.options[0]);
    const p2 = comp.onChooseClick(fakePoll.options[0]);
    await Promise.all([p1, p2]);
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it("busy=true → onChooseClick n'ouvre pas de dialogue", async () => {
    const { fixture, dialog } = await createComponent(fakePoll, true);
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();

    const comp = fixture.componentInstance as any;
    await comp.onChooseClick(fakePoll.options[0]);
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('members non fourni (défaut []) → pas de bannière "tous ont répondu", aucun manquant affiché', async () => {
    const { fixture } = await createComponent();

    const comp = fixture.componentInstance as any;
    expect(comp.members()).toEqual([]);
    expect(comp.allResponded()).toBe(false);
    expect(comp.missingVotersForOption(fakePoll.options[0])).toEqual([]);
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Tous ont répondu.');
  });

  it('bannière "tous ont répondu" quand tous les membres ont voté sur toutes les options', async () => {
    const { fixture } = await createComponent();
    fixture.componentRef.setInput('members', [alice, bob]);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Tous ont répondu.');
  });

  it("Carol (n'a voté nulle part) apparaît comme manquante sur CHAQUE option, pas de bannière globale", async () => {
    const { fixture } = await createComponent();
    fixture.componentRef.setInput('members', [alice, bob, carol]);
    fixture.detectChanges();

    const comp = fixture.componentInstance as any;
    expect(
      comp.missingVotersForOption(fakePoll.options[0]).map((m: PartieMemberDto) => m.pseudo),
    ).toEqual(['Carol']);
    expect(
      comp.missingVotersForOption(fakePoll.options[1]).map((m: PartieMemberDto) => m.pseudo),
    ).toEqual(['Carol']);
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Tous ont répondu.');
  });

  it("vote partiel : un membre ayant voté sur une option mais pas l'autre n'apparaît manquant QUE sur celle où il n'a pas voté", async () => {
    // Dans fakePoll, Bob a voté sur opt1 et opt2 — on ajoute Dana qui ne vote QUE sur opt1.
    const dana: PartieMemberDto = {
      role: 'MEMBER',
      userId: 'u4',
      pseudo: 'Dana',
      displayName: 'Dana',
      email: 'dana@test.com',
      joinedAt: '',
    };
    const pollWithPartialVote: SessionPollDto = {
      ...fakePoll,
      options: [
        {
          ...fakePoll.options[0],
          votes: [
            ...fakePoll.options[0].votes,
            { userId: 'u4', pseudo: 'Dana', displayName: 'Dana', answer: 'YES' },
          ],
        },
        fakePoll.options[1],
      ],
    };
    const { fixture } = await createComponent(pollWithPartialVote);
    fixture.componentRef.setInput('members', [alice, bob, dana]);
    fixture.detectChanges();

    const comp = fixture.componentInstance as any;
    // Dana a voté sur opt1 → absente des manquants de opt1
    expect(
      comp
        .missingVotersForOption(pollWithPartialVote.options[0])
        .map((m: PartieMemberDto) => m.pseudo),
    ).toEqual([]);
    // Dana n'a pas voté sur opt2 → présente dans les manquants de opt2 (et seulement elle, Alice/Bob ont voté)
    expect(
      comp
        .missingVotersForOption(pollWithPartialVote.options[1])
        .map((m: PartieMemberDto) => m.pseudo),
    ).toEqual(['Dana']);
  });
});

describe('PollStatusPanel — vote de plusieurs créneaux (Story 47.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const longPoll: SessionPollDto = { ...fakePoll, durationSlots: 6 };

  it('chaque option s’écrit de son début à sa fin ; un vote d’un créneau garde « date — créneau »', async () => {
    const { fixture } = await createComponent(longPoll);
    const dates = [...fixture.nativeElement.querySelectorAll('.poll-status__date')].map((n) =>
      (n as HTMLElement).textContent?.trim(),
    );
    expect(dates).toEqual([
      'sam. 1 août matin → dim. 2 août soir',
      'sam. 8 août après-midi → lun. 10 août matin',
    ]);
    TestBed.resetTestingModule();

    const single = await createComponent(fakePoll);
    const first = single.fixture.nativeElement.querySelector('.poll-status__date') as HTMLElement;
    expect(first.textContent?.trim()).toBe('sam. 1 août — Matin');
  });

  it('la confirmation de scellement nomme la plage, sans « — créneau » en plus', async () => {
    const { fixture, dialog } = await createComponent(longPoll, true);

    await (fixture.componentInstance as any).onChooseClick(longPoll.options[0]);

    expect(dialog.open.mock.calls[0][1].data.message).toBe(
      'Confirmer sam. 1 août matin → dim. 2 août soir comme date de la prochaine séance ?',
    );
  });
});

describe('PollStatusPanel — gabarit réel de la confirmation de scellement (Story 47.5)', () => {
  // Pour une plage, `onChooseClick` remplit {date} par la plage « début → fin » et {slot} par du vide, puis retire le
  // séparateur « {date} — » pour ne pas écrire un « — » orphelin. Cette retouche repose sur le motif exact
  // « {date} — {slot} » : si un thème change son gabarit, ce test casse AVANT que la phrase ne soit fausse à l'écran.
  it.each([
    ['atelier-cuivre', TONE_MAP['atelier-cuivre']],
    ['foret-ancienne', TONE_MAP['foret-ancienne']],
    ['grimoire-emeraude', TONE_MAP['grimoire-emeraude']],
  ])('%s : « pollui.status_choose_confirm » contient « {date} — {slot} »', (_name, tone) => {
    expect(tone['pollui.status_choose_confirm']).toContain('{date} — {slot}');
  });
});

describe('PollStatusPanel — pictogrammes de disponibilité (story 51.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const iconNames = (root: Element) =>
    Array.from(root.querySelectorAll('app-icon')).map((i) => i.getAttribute('data-icon'));

  it('les compteurs oui / non / peut-être sont trois dessins distincts, chiffres conservés', async () => {
    const { fixture } = await createComponent();
    const breakdown = fixture.nativeElement.querySelector('.poll-status__breakdown') as HTMLElement;
    expect(iconNames(breakdown)).toEqual(['dispo-oui', 'dispo-non', 'dispo-partiel']);
    expect(new Set(iconNames(breakdown)).size).toBe(3);
    // opt1 : 2 oui, 0 non, 0 peut-être.
    expect(breakdown.textContent!.replace(/\s+/g, ' ').trim()).toBe('2 · 0 · 0');
    expect(breakdown.textContent).not.toMatch(/[✅❌❔]/u);
    // Chaque compteur est nommé par son icône (clés de ton existantes), sans texte visible en plus.
    const svgs = Array.from(breakdown.querySelectorAll('app-icon svg'));
    expect(svgs.map((s) => s.getAttribute('aria-label'))).toEqual(['oui', 'non', 'peut-être']);
  });

  it('la réponse de chaque votant porte le pictogramme de sa réponse, en plus du libellé', async () => {
    const { fixture } = await createComponent();
    const answers = Array.from(
      fixture.nativeElement
        .querySelectorAll('.poll-status__option')[1]
        .querySelectorAll('.poll-status__answer'),
    ) as HTMLElement[];
    expect(answers.map((a) => a.querySelector('app-icon')!.getAttribute('data-icon'))).toEqual([
      'dispo-oui',
      'dispo-non',
    ]);
    expect(answers.map((a) => a.textContent!.trim())).toEqual(['Oui', 'Non']);
  });
});

describe('Avertissement « aucun vote » — fichiers de ton (story 51.5)', () => {
  it.each(['grimoire-emeraude', 'foret-ancienne', 'atelier-cuivre'] as const)(
    '%s : la phrase n’a plus de ⚠, le pictogramme vient du dialogue',
    (theme) => {
      const text = TONE_MAP[theme]['pollui.status_choose_no_vote_warning'];
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/⚠|️/u);
      expect(text).toMatch(/^Aucun /u);
    },
  );
});
