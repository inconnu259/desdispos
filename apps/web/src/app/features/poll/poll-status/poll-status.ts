import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import type {
  DaySlot,
  PartieMemberDto,
  PollOptionDto,
  SessionPollDto,
  VoteAnswer,
} from '@master-jdr/shared';
import type { IconName } from '../../../core/icons/icon-registry.generated';
import { AppIcon } from '../../../core/icons/app-icon';
import { getMissingVoters, getMissingVotersForOption } from '../../../core/poll/poll.util';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { candidateSpanShort } from '../../calendar/span-label';
import { IdentityLabel } from '../../../shared/identity/identity-label';
import { ConfirmDialog } from '../../parties/confirm-dialog/confirm-dialog';

const SLOT_LABELS: Record<DaySlot, string> = {
  MORNING: 'Matin',
  AFTERNOON: 'Après-midi',
  EVENING: 'Soir',
  FULL_DAY: 'Journée',
};

/** Clés du registre de ton (libellés « Oui / Non / Peut-être »), résolues par le gabarit. */
const ANSWER_LABEL_KEYS: Record<VoteAnswer, string> = {
  YES: 'common.oui',
  NO: 'common.non',
  MAYBE: 'common.peut_etre',
};

// Les trois réponses se distinguent par la FORME du dessin (mêmes pictogrammes que les compteurs de dispos).
const ANSWER_ICONS: Record<VoteAnswer, IconName> = {
  YES: 'dispo-oui',
  NO: 'dispo-non',
  MAYBE: 'dispo-partiel',
};

@Component({
  selector: 'app-poll-status',
  standalone: true,
  imports: [MatButtonModule, IdentityLabel, AppIcon],
  templateUrl: './poll-status.html',
  styleUrl: './poll-status.scss',
})
export class PollStatusPanel {
  readonly poll = input.required<SessionPollDto>();
  /** true pendant qu'une action (choix/annulation) est en cours côté parent — désactive le bouton pour éviter une double requête. */
  readonly busy = input(false);
  readonly members = input<PartieMemberDto[]>([]);

  readonly chosen = output<string>();

  protected readonly theme = inject(ThemeToneService);
  private readonly dialog = inject(MatDialog);

  /** Garde locale contre un double-clic ouvrant deux dialogues avant qu'Angular ne redessine [disabled]. */
  protected readonly dialogPending = signal(false);

  readonly SLOT_LABELS = SLOT_LABELS;
  readonly ANSWER_LABEL_KEYS = ANSWER_LABEL_KEYS;
  readonly ANSWER_ICONS = ANSWER_ICONS;

  protected formatDate(iso: string): string {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(d);
  }

  /** « sam. 25 oct. — Soir » ; Story 47.5 : un candidat de plusieurs créneaux s'écrit de son début à sa fin
   *  (« ven. 6 nov. soir → dim. 8 nov. après-midi »). Un créneau seul est inchangé. */
  protected optionLabel(opt: PollOptionDto): string {
    return (
      candidateSpanShort(opt, this.poll().durationSlots) ??
      `${this.formatDate(opt.date)} — ${SLOT_LABELS[opt.slot]}`
    );
  }

  protected countByAnswer(opt: PollOptionDto, answer: VoteAnswer): number {
    return opt.votes.filter((v) => v.answer === answer).length;
  }

  protected isAllYes(opt: PollOptionDto): boolean {
    return (
      this.poll().status === 'OPEN' &&
      opt.votes.length > 0 &&
      opt.votes.every((v) => v.answer === 'YES')
    );
  }

  /** true seulement si TOUS les membres ont voté sur TOUTES les options — condition du bandeau positif global. */
  protected readonly allResponded = computed(
    () => this.members().length > 0 && getMissingVoters(this.poll(), this.members()).length === 0,
  );

  /** Granularité par date : qui n'a pas encore voté sur CETTE option précise (indépendant des autres options). */
  protected missingVotersForOption(opt: PollOptionDto): PartieMemberDto[] {
    return getMissingVotersForOption(opt, this.members());
  }

  protected missingAlert(displayName: string): string {
    return this.theme.tone()['alert.missing_player'].replace('{name}', displayName);
  }

  protected async onChooseClick(opt: PollOptionDto): Promise<void> {
    if (this.busy() || this.dialogPending()) return;
    this.dialogPending.set(true);
    try {
      const tone = this.theme.tone();
      const noVoteWarning = tone['pollui.status_choose_no_vote_warning'];
      // L'avertissement « aucun vote » n'est plus collé à la question : le dialogue le montre sous
      // le message, précédé de son pictogramme.
      const warning = opt.votes.length === 0 ? noVoteWarning : undefined;
      // Story 47.5 : une plage se scelle écrite de son début à sa fin (pas de « — créneau » en plus).
      const span = candidateSpanShort(opt, this.poll().durationSlots);
      const question = span
        ? fillTone(tone['pollui.status_choose_confirm'], { date: span, slot: '' }).replace(
            `${span} — `,
            span,
          )
        : fillTone(tone['pollui.status_choose_confirm'], {
            date: this.formatDate(opt.date),
            slot: SLOT_LABELS[opt.slot],
          });
      const ref = this.dialog.open(ConfirmDialog, {
        data: {
          message: question,
          warning,
          confirmLabel: tone['cta.choose_date'],
        },
      });
      const confirmed = await firstValueFrom(ref.afterClosed());
      if (confirmed) this.chosen.emit(opt.id);
    } finally {
      this.dialogPending.set(false);
    }
  }
}
