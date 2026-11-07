import { Component, computed, inject, input } from '@angular/core';
import type { SessionPollDto } from '@master-jdr/shared';
import { bestOption } from '@master-jdr/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { pollAnswerCounts, pollRankableOptions } from '../../../core/poll/poll.util';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { bestSlotLabel, deadlineDayLabel } from './seance-poll-summary-labels';

/**
 * Story 54.2 — où en est le vote, en quelques lignes de texte, côté joueur : mes réponses, le meilleur
 * créneau, le nombre de personnes qui n'ont pas répondu, l'échéance.
 *
 * Autonome et présentationnel : tout se lit dans `poll` (`pollRankableOptions`, `pollAnswerCounts`, `bestOption`),
 * rien n'est recalculé à la main. Le joueur ne voit qu'un NOMBRE, jamais un nom — la liste des membres n'est
 * pas lue. Aucune action : « Voter dans le calendrier » n'existe que dans l'encadré de situation.
 */
@Component({
  selector: 'app-seance-poll-summary',
  templateUrl: './seance-poll-summary.html',
  styleUrl: './seance-poll-summary.scss',
})
export class SeancePollSummary {
  private readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeToneService);

  readonly poll = input.required<SessionPollDto>();
  readonly todayKey = input.required<string>();

  protected readonly lines = computed(() => {
    const tone = this.theme.tone();
    const poll = this.poll();
    const lines: string[] = [];

    const userId = this.auth.currentUser()?.id;
    if (userId) {
      const x = poll.options.filter((o) => o.votes.some((v) => v.userId === userId)).length;
      const key = x <= 1 ? 'scenarios.seance_summary_my_answers_one' : 'scenarios.seance_summary_my_answers';
      lines.push(fillTone(tone[key], { x, n: poll.options.length }));
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

    const { missing } = pollAnswerCounts(poll);
    if (missing === 1) lines.push(tone['scenarios.seance_summary_missing_one']);
    else if (missing > 1) {
      lines.push(fillTone(tone['scenarios.seance_summary_missing_many'], { n: missing }));
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
}
