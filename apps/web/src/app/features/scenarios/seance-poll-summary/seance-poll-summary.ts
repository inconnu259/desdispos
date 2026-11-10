import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import type { PartieMemberDto, SessionPollDto } from '@master-jdr/shared';
import { bestOption } from '@master-jdr/shared';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import {
  getMissingVoters,
  pollAnswerCounts,
  pollRankableOptions,
} from '../../../core/poll/poll.util';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { ConfirmDialog } from '../../parties/confirm-dialog/confirm-dialog';
import { bestSlotLabel, deadlineDayLabel } from './seance-poll-summary-labels';

/**
 * Story 54.2 / 54.3 — où en est le vote, en quelques lignes de texte.
 *
 * Joueur (Story 54.2) : mes réponses, le meilleur créneau, le NOMBRE de personnes qui n'ont pas répondu,
 * l'échéance — jamais un nom, la liste des membres n'est pas lue. Aucune action : « Voter dans le calendrier »
 * n'existe que dans l'encadré de situation.
 *
 * MJ (Story 54.3) : « Réponses : x sur n joueurs », le même meilleur créneau, les absents NOMMÉS
 * (`getMissingVoters`), l'échéance, puis les deux actions secondaires — « Clôturer le vote » (après
 * confirmation) et « Voir dans le calendrier → ». « Fixer la date… » n'est que dans l'encadré.
 *
 * Tout se lit dans `poll` (`pollRankableOptions`, `pollAnswerCounts`, `bestOption`), rien n'est recalculé à
 * la main ; le composant n'écrit rien : il émet `closePoll` / `seeInCalendar`.
 */
@Component({
  selector: 'app-seance-poll-summary',
  imports: [MatButtonModule],
  templateUrl: './seance-poll-summary.html',
  styleUrl: './seance-poll-summary.scss',
})
export class SeancePollSummary {
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  protected readonly theme = inject(ThemeToneService);

  readonly poll = input.required<SessionPollDto>();
  readonly todayKey = input.required<string>();
  readonly isMj = input(false);
  /**
   * Les membres de la partie, pour nommer les absents (MJ seulement). 🚨 La liste ne contient PAS le MJ
   * (dette de la Story 36.6, partagée avec la Destinée) : le MJ n'est jamais nommé, le compte vient de
   * `membersCount`.
   */
  readonly members = input<PartieMemberDto[]>([]);
  /** `false` tant que la liste n'est pas chargée, ou si son chargement a échoué : on retombe sur le nombre. */
  readonly membersLoaded = input(false);
  /** Écriture en cours : « Clôturer le vote » est désactivé. */
  readonly busy = input(false);

  readonly closePoll = output<void>();
  readonly seeInCalendar = output<void>();

  /** Garde anti-double-ouverture de la confirmation (deux touchers rapprochés n'en ouvrent pas deux). */
  private readonly dialogPending = signal(false);

  protected readonly lines = computed(() => {
    const tone = this.theme.tone();
    const poll = this.poll();
    const counts = pollAnswerCounts(poll);
    const lines: string[] = [];

    if (this.isMj()) {
      lines.push(
        fillTone(tone['scenarios.seance_summary_mj_answers'], {
          x: counts.answered,
          n: counts.eligible,
        }),
      );
    } else {
      const userId = this.auth.currentUser()?.id;
      if (userId) {
        const x = poll.options.filter((o) => o.votes.some((v) => v.userId === userId)).length;
        const key =
          x <= 1
            ? 'scenarios.seance_summary_my_answers_one'
            : 'scenarios.seance_summary_my_answers';
        lines.push(fillTone(tone[key], { x, n: poll.options.length }));
      }
    }

    const best = bestOption(pollRankableOptions(poll), this.todayKey());
    lines.push(
      best
        ? fillTone(tone['scenarios.seance_summary_best'], {
            date: bestSlotLabel(best, poll.durationSlots),
            n: best.yes,
          })
        : tone['scenarios.seance_summary_best_none'],
    );

    if (this.isMj() && this.membersLoaded()) {
      const names = getMissingVoters(poll, this.members()).map((m) => m.displayName || m.pseudo);
      if (names.length > 0) {
        lines.push(
          fillTone(tone['scenarios.seance_summary_mj_waiting'], { names: names.join(', ') }),
        );
      }
    } else if (counts.missing === 1) {
      lines.push(tone['scenarios.seance_summary_missing_one']);
    } else if (counts.missing > 1) {
      lines.push(fillTone(tone['scenarios.seance_summary_missing_many'], { n: counts.missing }));
    }

    if (poll.expiresAt) {
      lines.push(
        poll.expiresAt.substring(0, 10) < this.todayKey()
          ? tone['scenarios.seance_summary_ended']
          : fillTone(tone['scenarios.seance_summary_deadline'], {
              date: deadlineDayLabel(poll.expiresAt),
            }),
      );
    }
    return lines;
  });

  /** « Clôturer le vote » : une confirmation d'abord (le vote ne se rouvre pas), renoncer ne change rien. */
  protected async onCloseClick(): Promise<void> {
    if (this.busy() || this.dialogPending()) return;
    this.dialogPending.set(true);
    try {
      const tone = this.theme.tone();
      const ref = this.dialog.open(ConfirmDialog, {
        data: {
          message: tone['scenarios.close_poll_confirm'],
          confirmLabel: tone['common.cloturer_le_vote'],
        },
      });
      if (await firstValueFrom(ref.afterClosed())) this.closePoll.emit();
    } finally {
      this.dialogPending.set(false);
    }
  }
}
