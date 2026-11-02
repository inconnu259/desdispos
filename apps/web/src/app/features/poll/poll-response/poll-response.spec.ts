import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import type { SessionPollDto } from '@master-jdr/shared';
import { PollResponseComponent } from './poll-response';
import { PollService } from '../../../core/poll/poll.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

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
    { id: 'opt1', date: '2026-08-01T00:00:00.000Z', slot: 'MORNING', votes: [] },
    {
      id: 'opt2',
      date: '2026-08-08T00:00:00.000Z',
      slot: 'AFTERNOON',
      votes: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice', answer: 'YES' }],
    },
  ],
};

function makePollService() {
  return {
    castVote: vi.fn().mockResolvedValue(undefined),
    withdrawVote: vi.fn().mockResolvedValue(undefined),
  };
}

function makeAuthService(userId = 'u1') {
  return {
    currentUser: () => ({
      id: userId,
      email: 'alice@test.com',
      pseudo: 'Alice',
      role: 'USER',
      createdAt: '',
    }),
  };
}

function makeThemeService() {
  return {
    tone: () => ({
      'success.vote_cast': 'Réponse enregistrée !',
      'cta.confirm_votes': 'Confirmer',
      'cta.withdraw_vote': 'Retirer',
      'success.vote_withdrawn': 'Réponse retirée !',
      'poll.withdraw_error': 'Le retrait a échoué.',
      'poll.vote_closed': 'Vote clos',
      'poll.status_title': 'Vote en cours',
      'common.envoi': 'Envoi…',
      'common.oui': 'Oui-registre',
      'common.non': 'Non-registre',
      'common.peut_etre': 'Peut-être-registre',
      'pollui.response_not_saved_aria': 'Non enregistré',
      'pollui.response_partial_error':
        '{success}/{total} réponse(s) enregistrée(s). Réessayez pour les autres.',
    }),
  };
}

function makeSnackBar() {
  return { open: vi.fn() };
}

async function createComponent(poll = fakePoll, userId = 'u1') {
  const pollSvc = makePollService();
  const snack = makeSnackBar();
  await TestBed.configureTestingModule({
    imports: [PollResponseComponent],
    providers: [
      provideAnimationsAsync(),
      { provide: PollService, useValue: pollSvc },
      { provide: AuthService, useValue: makeAuthService(userId) },
      { provide: ThemeToneService, useValue: makeThemeService() },
      { provide: MatSnackBar, useValue: snack },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(PollResponseComponent);
  fixture.componentRef.setInput('partieId', 'p1');
  fixture.componentRef.setInput('poll', poll);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, pollSvc, snack };
}

describe('PollResponseComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('les boutons de vote affichent les textes du registre (oui, non, peut-être), dans cet ordre', async () => {
    const { fixture } = await createComponent();
    const first = fixture.nativeElement.querySelector('.poll-response__option');
    const labels = Array.from(
      first.querySelectorAll('.poll-response__buttons button:not(.poll-response__withdraw)'),
    ).map((b) => (b as HTMLElement).textContent?.trim());
    expect(labels).toEqual(['Oui-registre', 'Non-registre', 'Peut-être-registre']);
  });

  it("contient autant d'options que le poll", async () => {
    const { fixture } = await createComponent();
    expect(fixture.componentInstance.poll().options).toHaveLength(2);
  });

  it('setAnswer(opt1, YES) → pendingAnswers contient YES pour opt1', async () => {
    const { fixture } = await createComponent();

    const comp = fixture.componentInstance as any;
    comp.setAnswer('opt1', 'YES');
    expect(comp.pendingAnswers().get('opt1')).toBe('YES');
  });

  it('confirmation → castVote appelé 2×, toast affiché', async () => {
    const { fixture, pollSvc, snack } = await createComponent();

    const comp = fixture.componentInstance as any;
    // ngOnInit pre-populates opt2 → YES (from fakePoll votes for u1)
    // add opt1 → NO so we have 2 selections total
    comp.setAnswer('opt1', 'NO');
    await comp.onConfirm();
    expect(pollSvc.castVote).toHaveBeenCalledTimes(2);
    expect(snack.open).toHaveBeenCalledWith('Réponse enregistrée !', undefined, { duration: 3000 });
  });

  it('confirmation réussie → émet (responded) avec une mise à jour locale du poll précis, sans refetch (Story 8.8, revue de code)', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;
    let emitted: SessionPollDto | undefined;
    comp.responded.subscribe((p: SessionPollDto) => (emitted = p));

    comp.setAnswer('opt1', 'NO');
    await comp.onConfirm();

    expect(emitted).toBeDefined();
    expect(emitted!.id).toBe('poll1'); // le poll précis sur lequel on vient de voter, pas un autre
    const opt1 = emitted!.options.find((o) => o.id === 'opt1')!;
    expect(opt1.votes.find((v) => v.userId === 'u1')?.answer).toBe('NO');
  });

  it('échec partiel → l’option en échec conserve son état d’origine dans le poll émis', async () => {
    const { fixture, pollSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    let emitted: SessionPollDto | undefined;
    comp.responded.subscribe((p: SessionPollDto) => (emitted = p));
    pollSvc.castVote = vi.fn((_partieId: string, _pollId: string, dto: { optionId: string }) =>
      dto.optionId === 'opt1' ? Promise.reject(new Error('network')) : Promise.resolve(undefined),
    );

    comp.setAnswer('opt1', 'NO');
    await comp.onConfirm();

    const opt1 = emitted!.options.find((o) => o.id === 'opt1')!;
    // opt1 a échoué : aucun nouveau vote 'NO' de u1 ajouté (état d'origine du poll conservé).
    expect(opt1.votes.some((v) => v.userId === 'u1' && v.answer === 'NO')).toBe(false);
  });

  it("échec partiel → l'option en échec est marquée, message avec compteur, pas de toast de succès", async () => {
    const { fixture, pollSvc, snack } = await createComponent();

    const comp = fixture.componentInstance as any;
    pollSvc.castVote = vi.fn((_partieId: string, _pollId: string, dto: { optionId: string }) =>
      dto.optionId === 'opt2' ? Promise.reject(new Error('network')) : Promise.resolve(undefined),
    );
    comp.setAnswer('opt1', 'NO');
    comp.setAnswer('opt2', 'MAYBE');
    await comp.onConfirm();
    expect(snack.open).not.toHaveBeenCalled();
    expect(comp.error()).toContain('1/2');
    expect(comp.failedOptionIds().has('opt2')).toBe(true);
    expect(comp.failedOptionIds().has('opt1')).toBe(false);

    // Story 51.5 — la marque « non enregistré » est une icône nommée, et le nom n'est porté qu'une fois.
    fixture.detectChanges();
    const marks = fixture.nativeElement.querySelectorAll('.poll-response__option-error');
    expect(marks).toHaveLength(1);
    const mark = marks[0] as HTMLElement;
    expect(mark.tagName.toLowerCase()).toBe('app-icon');
    expect(mark.getAttribute('data-icon')).toBe('avertissement');
    expect(mark.getAttribute('aria-label')).toBeNull();
    expect(mark.querySelector('svg')!.getAttribute('role')).toBe('img');
    expect(mark.querySelector('svg')!.getAttribute('aria-label')).toBe('Non enregistré');
    expect(mark.textContent!.trim()).toBe('');
  });

  it('poll CLOSED → isClosed vrai, setAnswer sans effet', async () => {
    const closedPoll: SessionPollDto = { ...fakePoll, status: 'CLOSED' };
    const { fixture } = await createComponent(closedPoll);

    const comp = fixture.componentInstance as any;
    expect(comp.isClosed()).toBe(true);
    comp.setAnswer('opt1', 'YES');
    expect(comp.pendingAnswers().get('opt1')).toBeUndefined();
  });

  describe('retrait de réponse (Story 30.1, AD-10)', () => {
    it('aucun bouton de retrait sur une option sans réponse (opt1)', async () => {
      const { fixture } = await createComponent();
      const buttons = fixture.nativeElement.querySelectorAll(
        '.poll-response__option',
      ) as NodeListOf<HTMLElement>;
      // opt1 (index 0, aucune réponse pré-remplie) ne porte pas de bouton de retrait.
      expect(buttons[0].querySelector('.poll-response__withdraw')).toBeNull();
    });

    it('un bouton de retrait est visible sur une option déjà répondue (opt2, pré-remplie par ngOnInit)', async () => {
      const { fixture } = await createComponent();
      const buttons = fixture.nativeElement.querySelectorAll(
        '.poll-response__option',
      ) as NodeListOf<HTMLElement>;
      expect(buttons[1].querySelector('.poll-response__withdraw')).not.toBeNull();
    });

    it('clic sur retirer → appelle PollService.withdrawVote avec les bons ids', async () => {
      const { fixture, pollSvc } = await createComponent();
      const comp = fixture.componentInstance as any;

      await comp.withdraw('opt2');

      expect(pollSvc.withdrawVote).toHaveBeenCalledWith('p1', 'poll1', 'opt2');
    });

    it('après succès → pendingAnswers ne contient plus l’option, le bouton de retrait disparaît', async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;
      expect(comp.pendingAnswers().get('opt2')).toBe('YES');

      await comp.withdraw('opt2');
      fixture.detectChanges();

      expect(comp.pendingAnswers().get('opt2')).toBeUndefined();
      const buttons = fixture.nativeElement.querySelectorAll('.poll-response__option');
      expect(buttons[1].querySelector('.poll-response__withdraw')).toBeNull();
    });

    it('émet (responded) avec le poll mis à jour localement (ligne retirée de opt.votes)', async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;
      let emitted: SessionPollDto | undefined;
      comp.responded.subscribe((p: SessionPollDto) => (emitted = p));

      await comp.withdraw('opt2');

      expect(emitted).toBeDefined();
      const opt2 = emitted!.options.find((o) => o.id === 'opt2')!;
      expect(opt2.votes.some((v) => v.userId === 'u1')).toBe(false);
    });

    it('poll CLOSED → withdraw() sans effet', async () => {
      const closedPoll: SessionPollDto = { ...fakePoll, status: 'CLOSED' };
      const { fixture, pollSvc } = await createComponent(closedPoll);
      const comp = fixture.componentInstance as any;

      await comp.withdraw('opt2');

      expect(pollSvc.withdrawVote).not.toHaveBeenCalled();
    });

    it('un échec de retrait laisse la réponse affichée telle quelle', async () => {
      const { fixture, pollSvc } = await createComponent();
      pollSvc.withdrawVote = vi.fn().mockRejectedValue(new Error('network'));
      const comp = fixture.componentInstance as any;

      await comp.withdraw('opt2');

      expect(comp.pendingAnswers().get('opt2')).toBe('YES');
    });
  });

  describe('revue de code Story 30.1 : patches', () => {
    it("une sélection locale non confirmée (opt1) n'affiche pas le bouton de retrait", async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;

      comp.setAnswer('opt1', 'YES');
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('.poll-response__option');
      expect(buttons[0].querySelector('.poll-response__withdraw')).toBeNull();
    });

    it('après confirmation réussie, le bouton de retrait apparaît pour la nouvelle option confirmée', async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;

      comp.setAnswer('opt1', 'YES');
      await comp.onConfirm();
      fixture.detectChanges();

      expect(comp.confirmedOptionIds().has('opt1')).toBe(true);
      const buttons = fixture.nativeElement.querySelectorAll('.poll-response__option');
      expect(buttons[0].querySelector('.poll-response__withdraw')).not.toBeNull();
    });

    it('un vote en échec ne rejoint pas confirmedOptionIds', async () => {
      const { fixture, pollSvc } = await createComponent();
      const comp = fixture.componentInstance as any;
      pollSvc.castVote = vi.fn().mockRejectedValue(new Error('network'));

      comp.setAnswer('opt1', 'YES');
      await comp.onConfirm();

      expect(comp.confirmedOptionIds().has('opt1')).toBe(false);
    });

    it('après un retrait réussi, opt2 sort de confirmedOptionIds', async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;
      expect(comp.confirmedOptionIds().has('opt2')).toBe(true);

      await comp.withdraw('opt2');

      expect(comp.confirmedOptionIds().has('opt2')).toBe(false);
    });

    it('un second withdraw() pendant que le premier est en vol ne déclenche pas un second appel réseau', async () => {
      const { fixture, pollSvc } = await createComponent();
      const comp = fixture.componentInstance as any;
      let resolveWithdraw!: () => void;
      pollSvc.withdrawVote = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveWithdraw = resolve;
          }),
      );

      const first = comp.withdraw('opt2');
      await comp.withdraw('opt2');
      expect(pollSvc.withdrawVote).toHaveBeenCalledTimes(1);

      resolveWithdraw();
      await first;
    });

    it('onConfirm() exclut une option dont le retrait est en vol', async () => {
      const { fixture, pollSvc } = await createComponent();
      const comp = fixture.componentInstance as any;
      let resolveWithdraw!: () => void;
      pollSvc.withdrawVote = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveWithdraw = resolve;
          }),
      );

      const withdrawal = comp.withdraw('opt2');
      comp.setAnswer('opt1', 'NO');
      await comp.onConfirm();

      expect(pollSvc.castVote).toHaveBeenCalledTimes(1);
      expect(pollSvc.castVote).toHaveBeenCalledWith(
        'p1',
        'poll1',
        expect.objectContaining({ optionId: 'opt1' }),
      );

      resolveWithdraw();
      await withdrawal;
    });
  });
});

describe('PollResponseComponent — vote de plusieurs créneaux (Story 47.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('chaque option s’écrit de son début à sa fin', async () => {
    const { fixture } = await createComponent({ ...fakePoll, durationSlots: 6 });
    const first = fixture.nativeElement.querySelector('.poll-response__date') as HTMLElement;
    expect(first.textContent).toContain('→');
    expect(first.textContent).not.toContain('—');
  });

  it('un vote d’un créneau : « date — créneau » d’avant', async () => {
    const { fixture } = await createComponent(fakePoll);
    const first = fixture.nativeElement.querySelector('.poll-response__date') as HTMLElement;
    expect(first.textContent).toContain('—');
    expect(first.textContent).not.toContain('→');
  });
});
