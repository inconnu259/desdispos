import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AppIcon } from '../../../core/icons/app-icon';
import type { SituationValue } from '../../../core/status/status-derivation';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { SituationLine } from '../../../shared/situation-line/situation-line';
import { voteDeadlineLabel, type SeanceSituationBox } from './seance-situation-box';

/**
 * Story 54.1 — l'encadré de situation d'une séance : « Ma situation » en tête, le texte de ce qu'il
 * y a à faire, puis l'action. Présentationnel : il ne décide ni du cas (`seanceSituationBox()`) ni de
 * la situation (`seanceSituation()`), et n'exécute rien — l'action remonte par `action`.
 *
 * Aucun rôle d'annonce (`role="status"`) : il ne doit pas être lu à voix haute à chaque rechargement.
 * La bordure ne dit jamais seule qui doit agir : le texte et le bouton écrits le disent.
 */
@Component({
  selector: 'app-seance-situation',
  imports: [AppIcon, MatButtonModule, SituationLine],
  templateUrl: './seance-situation.html',
  styleUrl: './seance-situation.scss',
})
export class SeanceSituationComponent {
  protected readonly theme = inject(ThemeToneService);

  readonly box = input.required<SeanceSituationBox>();
  /** La valeur de `seanceSituation()`, rendue dans la ligne « Ma situation » en tête. */
  readonly situation = input<SituationValue | null>(null);
  /** Échéance du vote (`SessionPollDto.expiresAt`), pour l'encadré `voter`. */
  readonly expiresAt = input<string | null>(null);
  readonly todayKey = input.required<string>();
  /** Écriture en cours : l'action est désactivée. */
  readonly busy = input(false);

  readonly action = output<void>();

  protected readonly isMj = computed(
    () => this.box() === 'lancer_le_vote' || this.box() === 'reinitialiser_la_date',
  );

  protected readonly text = computed(() => {
    const tone = this.theme.tone();
    switch (this.box()) {
      case 'voter': {
        const deadline = this.expiresAt();
        return deadline
          ? fillTone(tone['scenarios.seance_situation_vote_open'], {
              date: voteDeadlineLabel(deadline, this.todayKey()),
            })
          : tone['scenarios.seance_situation_vote_open_no_deadline'];
      }
      case 'participer':
        return tone['scenarios.seance_situation_not_registered'];
      case 'se_desinscrire':
        return tone['scenarios.seance_situation_registered'];
      case 'lancer_le_vote':
        return tone['scenarios.seance_situation_no_date'];
      case 'reinitialiser_la_date':
        return tone['common.vote_cloture_sans_date_retenue'];
    }
  });

  protected readonly actionLabel = computed(() => {
    const tone = this.theme.tone();
    switch (this.box()) {
      case 'voter':
        return tone['scenarios.seance_situation_vote_in_calendar'];
      case 'participer':
        return tone['scenarios.seances_inscrire'];
      case 'se_desinscrire':
        return tone['scenarios.seances_desinscrire'];
      case 'lancer_le_vote':
        return tone['common.lancer_le_vote'];
      case 'reinitialiser_la_date':
        return tone['common.reinitialiser_la_date'];
    }
  });
}
