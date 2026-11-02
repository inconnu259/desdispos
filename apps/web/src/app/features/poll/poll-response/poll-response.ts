import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import type {
  CastVoteDto,
  DaySlot,
  PollOptionDto,
  SessionPollDto,
  VoteAnswer,
} from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { AuthService } from '../../../core/auth/auth.service';
import { PollService } from '../../../core/poll/poll.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { candidateSpanShort } from '../../calendar/span-label';

const SLOT_LABELS: Record<DaySlot, string> = {
  MORNING: 'Matin',
  AFTERNOON: 'Après-midi',
  EVENING: 'Soir',
  FULL_DAY: 'Journée',
};

@Component({
  selector: 'app-poll-response',
  standalone: true,
  imports: [MatButtonModule, AppIcon],
  templateUrl: './poll-response.html',
  styleUrl: './poll-response.scss',
})
export class PollResponseComponent {
  readonly partieId = input.required<string>();
  readonly poll = input.required<SessionPollDto>();

  readonly responded = output<SessionPollDto>();

  private readonly pollSvc = inject(PollService);
  private readonly authSvc = inject(AuthService);
  protected readonly theme = inject(ThemeToneService);
  private readonly snack = inject(MatSnackBar);

  protected readonly pendingAnswers = signal<Map<string, VoteAnswer>>(new Map());
  protected readonly failedOptionIds = signal<Set<string>>(new Set());
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Options dont le retrait est en cours (Story 30.1) — désactive le bouton concerné, même
   *  garde anti-double-clic que `coverSaving()` ailleurs dans le projet. */
  protected readonly withdrawingOptionIds = signal<Set<string>>(new Set());
  /** Revue de code (Story 30.1) : distinct de `pendingAnswers`, qui contient aussi bien une
   *  réponse déjà enregistrée côté serveur qu'une sélection locale pas encore confirmée (ou en
   *  échec). Le bouton de retrait ne doit apparaître QUE pour une réponse réellement persistée
   *  (AC1 : « j'ai répondu ») — sans cette distinction, cliquer « Retirer » sur une sélection
   *  jamais envoyée efface silencieusement un choix local sans qu'il y ait quoi que ce soit à
   *  retirer côté serveur. */
  protected readonly confirmedOptionIds = signal<Set<string>>(new Set());

  readonly SLOT_LABELS = SLOT_LABELS;
  readonly VOTE_OPTIONS: VoteAnswer[] = ['YES', 'NO', 'MAYBE'];
  /** Clé de ton du libellé de chaque bouton de vote : les valeurs d'API (YES / NO / MAYBE) ne
   *  s'affichent jamais telles quelles. */
  readonly VOTE_LABEL_KEYS: Record<VoteAnswer, string> = {
    YES: 'common.oui',
    NO: 'common.non',
    MAYBE: 'common.peut_etre',
  };

  protected readonly isClosed = computed(() => this.poll().status === 'CLOSED');
  protected readonly hasSelection = computed(() => this.pendingAnswers().size > 0);

  constructor() {
    // authSvc.currentUser() se peuple de façon asynchrone (App.ngOnInit lance loadSession()
    // sans l'attendre) — un ngOnInit classique risquerait de s'exécuter avant que l'utilisateur
    // soit connu, empêchant la surbrillance des votes déjà soumis (AC2). effect() se redéclenche
    // dès que currentUser() change. La lecture de poll() est délibérément untracked : on ne veut
    // resynchroniser pendingAnswers que sur la résolution de l'utilisateur courant, pas à chaque
    // remplacement de l'input poll (ex. après un vote, cf. onPollResponded).
    effect(() => {
      const userId = this.authSvc.currentUser()?.id;
      if (!userId) return;
      const poll = untracked(() => this.poll());
      const map = new Map<string, VoteAnswer>();
      const confirmed = new Set<string>();
      for (const opt of poll.options) {
        const myVote = opt.votes.find((v) => v.userId === userId);
        if (myVote) {
          map.set(opt.id, myVote.answer);
          confirmed.add(opt.id);
        }
      }
      this.pendingAnswers.set(map);
      this.confirmedOptionIds.set(confirmed);
    });
  }

  protected setAnswer(optionId: string, answer: VoteAnswer): void {
    if (this.isClosed()) return;
    const m = new Map(this.pendingAnswers());
    m.set(optionId, answer);
    this.pendingAnswers.set(m);
  }

  /** « sam. 25 oct. — Soir » ; Story 47.5 : un candidat de plusieurs créneaux s'écrit de son début à sa fin. */
  protected optionLabel(opt: PollOptionDto): string {
    return (
      candidateSpanShort(opt, this.poll().durationSlots) ??
      `${this.formatDate(opt.date)} — ${SLOT_LABELS[opt.slot]}`
    );
  }

  protected getAnswer(optionId: string): VoteAnswer | null {
    return this.pendingAnswers().get(optionId) ?? null;
  }

  protected formatDate(iso: string): string {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(d);
  }

  protected async onConfirm(): Promise<void> {
    if (!this.hasSelection() || this.saving() || this.isClosed()) return;
    this.saving.set(true);
    this.error.set(null);
    this.failedOptionIds.set(new Set());

    // Revue de code (Story 30.1) : une option dont le retrait est encore en vol est exclue de ce
    // lot — voter dessus pendant que la suppression serveur n'a pas encore résolu risquerait de
    // faire arriver les deux requêtes dans le désordre (le retrait pourrait effacer le vote qui
    // vient juste d'être posé). Les autres options du lot ne sont pas bloquées.
    const withdrawing = this.withdrawingOptionIds();
    const entries = [...this.pendingAnswers()].filter(([optionId]) => !withdrawing.has(optionId));
    const results = await Promise.allSettled(
      entries.map(([optionId, answer]) =>
        this.pollSvc.castVote(this.partieId(), this.poll().id, {
          optionId,
          answer,
        } satisfies CastVoteDto),
      ),
    );

    const failed = new Set<string>();
    results.forEach((result, i) => {
      if (result.status === 'rejected') failed.add(entries[i][0]);
    });
    this.failedOptionIds.set(failed);

    const succeeded = entries.filter(([optionId]) => !failed.has(optionId)).map(([id]) => id);
    if (succeeded.length > 0) {
      this.confirmedOptionIds.update((s) => {
        const next = new Set(s);
        for (const id of succeeded) next.add(id);
        return next;
      });
    }

    // Story 8.8 (revue de code) : mise à jour locale optimiste du poll précis plutôt qu'un refetch
    // via getCurrentPoll() — celui-ci suppose « un seul poll par Partie » (findFirst arbitraire),
    // hypothèse invalidée depuis que plusieurs votes peuvent être actifs en parallèle (Décision 2) :
    // un refetch pouvait renvoyer un tout autre poll, laissant l'entrée réellement votée périmée
    // dans l'Oracle multi-poll (bug « rien ne se passe après avoir voté », réintroduit sans ce fix).
    const currentUser = this.authSvc.currentUser();
    if (currentUser) {
      const poll = this.poll();
      const updatedPoll: SessionPollDto = {
        ...poll,
        options: poll.options.map((opt) => {
          if (failed.has(opt.id)) return opt;
          const answer = this.pendingAnswers().get(opt.id);
          if (!answer) return opt;
          const votes = opt.votes.filter((v) => v.userId !== currentUser.id);
          votes.push({
            userId: currentUser.id,
            pseudo: currentUser.pseudo,
            displayName: currentUser.displayName,
            answer,
          });
          return { ...opt, votes };
        }),
      };
      this.responded.emit(updatedPoll);
    }

    if (failed.size === 0) {
      this.snack.open(this.theme.tone()['success.vote_cast'], undefined, { duration: 3000 });
    } else {
      const successCount = entries.length - failed.size;
      this.error.set(
        fillTone(this.theme.tone()['pollui.response_partial_error'], {
          success: successCount,
          total: entries.length,
        }),
      );
    }
    this.saving.set(false);
  }

  /** Retrait immédiat (Story 30.1, AD-10) — décision : action immédiate au clic, comme
   *  `removeFavorite()`/`removeCoverImage()` ailleurs dans le projet, plutôt qu'intégrée au lot
   *  différé `onConfirm()`. `pendingAnswers` n'a pas d'état « à effacer » représentable sans
   *  sentinelle, et mélanger POST (vote) et DELETE (retrait) dans le même `Promise.allSettled`
   *  compliquerait `onConfirm()` sans bénéfice — le retrait est une action indépendante. */
  protected async withdraw(optionId: string): Promise<void> {
    if (this.isClosed() || this.saving() || this.withdrawingOptionIds().has(optionId)) return;
    this.withdrawingOptionIds.update((s) => new Set(s).add(optionId));
    this.error.set(null);
    try {
      await this.pollSvc.withdrawVote(this.partieId(), this.poll().id, optionId);
    } catch {
      this.error.set(this.theme.tone()['poll.withdraw_error']);
      return;
    } finally {
      this.withdrawingOptionIds.update((s) => {
        const next = new Set(s);
        next.delete(optionId);
        return next;
      });
    }

    const m = new Map(this.pendingAnswers());
    m.delete(optionId);
    this.pendingAnswers.set(m);
    this.confirmedOptionIds.update((s) => {
      const next = new Set(s);
      next.delete(optionId);
      return next;
    });

    const currentUser = this.authSvc.currentUser();
    if (currentUser) {
      const poll = this.poll();
      const updatedPoll: SessionPollDto = {
        ...poll,
        options: poll.options.map((opt) =>
          opt.id === optionId
            ? { ...opt, votes: opt.votes.filter((v) => v.userId !== currentUser.id) }
            : opt,
        ),
      };
      this.responded.emit(updatedPoll);
    }

    this.snack.open(this.theme.tone()['success.vote_withdrawn'], undefined, { duration: 3000 });
  }
}
