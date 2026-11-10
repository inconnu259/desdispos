import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { DurationStepper } from '../../../shared/duration-stepper/duration-stepper';
import type { SpanStart } from '../../../shared/duration-stepper/duration-labels';
import { AppIcon } from '../../../core/icons/app-icon';
import { fillTone } from '../../../core/theme/tone-format';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { shortDayLabel } from '../../events/event-card.util';

/**
 * Story 36.10 — la barre **persistante** du mode de composition d'un vote (AC1).
 *
 * Composant de **rendu pur** : aucun service, aucun état propre, aucune écriture. Il affiche ce
 * qui est composé et signale les deux issues — `CalendarView` décide. Même patron que
 * `DestinyControl`, `SelectionBar`, `PollTrack`.
 *
 * 🚨 **Ce n'est PAS `SelectionBar`, et il ne doit jamais le devenir.** `SelectionBar` n'existe à
 * l'écran que tant qu'une sélection existe ; celle-ci doit rester visible **pendant toute la
 * durée du mode**, y compris à zéro créneau composé — c'est elle qui porte la seule sortie du
 * mode avec `Échap`, et une barre qui disparaîtrait quand on retire le dernier créneau
 * enfermerait le MJ.
 *
 * ⚠️ Écart assumé avec `contrat-ui-calendrier.html:376`, qui dessine « Ajouter des dates » dans
 * la barre de sélection : cet armement suppose une sélection préalable, que l'AC1 interdit
 * d'exiger. Le bouton d'armement vit donc dans la bande de contrôles, frère de la Destinée.
 */
@Component({
  selector: 'app-compose-bar',
  standalone: true,
  imports: [MatButtonModule, DurationStepper, AppIcon],
  templateUrl: './compose-bar.html',
  styleUrl: './compose-bar.scss',
})
export class ComposeBar {
  /** Nombre de créneaux actuellement composés. */
  readonly count = input.required<number>();
  /** Ce que la composition vise : le nom du vote modifié, ou l'annonce d'un vote neuf. */
  readonly targetLabel = input.required<string>();
  /** `true` pendant l'écriture — évite une double validation (patron `pollActionPending`). */
  readonly busy = input(false);
  /**
   * `false` quand la validation n'aboutirait pas : moins de deux créneaux (borne serveur), ou
   * création demandée sans aucune séance éligible (AC11). Le bouton est alors **désactivé et
   * expliqué** — jamais silencieusement inerte.
   */
  readonly canConfirm = input.required<boolean>();
  /** Pourquoi la validation est impossible, en toutes lettres. Vide quand elle l'est. */
  readonly blockedReason = input<string>('');

  /** ⚠️ Story 45.4 — la fin du vote, un jour `YYYY-MM-DD` ; `null` : pas de champ (la composition d'une conjonction à
   *  créer n'écrit rien, la fin se règle dans la fenêtre de création). */
  readonly deadlineDay = input<string | null>(null);
  /** Le plus petit jour proposable (aujourd'hui) : la date native ne propose pas le passé. */
  readonly deadlineMin = input('');
  /** L'explication du défaut (« Proposé : dans 14 jours. ») ; vide dès que l'organisateur a choisi sa date. */
  readonly deadlineHint = input('');
  /** La fin est déjà passée : marquée en toutes lettres, et « Valider » est bloqué (la raison est dite plus haut). */
  readonly deadlinePast = input(false);

  /** ⚠️ Story 47.4 — la durée du rendez-vous, en créneaux : la ligne « Durée » est TOUJOURS là, initialisée par
   *  `CalendarView` à la durée de la séance visée. Chaque créneau désigné est le DÉPART d'une plage de cette durée. */
  readonly durationSlots = input(1);
  /** Le premier départ désigné : la plage s'écrit en clair sous le compteur (« ven. 6 soir → dim. 8 après-midi »). */
  readonly durationStart = input<SpanStart | null>(null);

  readonly confirmed = output<void>();
  /** Story 47.4 — une nouvelle durée choisie au compteur. Rien n'est écrit ici. */
  readonly durationChanged = output<number>();
  readonly cancelled = output<void>();
  /** Un nouveau jour choisi dans la date native. Rien n'est écrit ici. */
  readonly deadlineChanged = output<string>();

  /** Le champ est en cours d'édition : la date native remplace le texte. */
  protected readonly editing = signal(false);
  private readonly dateInput = viewChild<ElementRef<HTMLInputElement>>('dateInput');

  protected readonly theme = inject(ThemeToneService);

  /** « Fin du vote : ven. 6 nov. » — le jour en lettres, jamais l'ISO brut. */
  protected readonly deadlineText = computed(() => {
    const day = this.deadlineDay();
    if (!day) return '';
    return fillTone(this.theme.tone()['calendar.compose_deadline_field'], {
      date: shortDayLabel(day).replace(/\.$/, ''),
    });
  });

  constructor() {
    // Le champ s'ouvre sur la date native, focalisée ; le sélecteur du navigateur s'ouvre quand il sait le faire.
    effect(() => {
      const input = this.dateInput()?.nativeElement;
      if (!input) return;
      input.focus();
      try {
        input.showPicker?.();
      } catch {
        /* le focus suffit */
      }
    });
  }

  protected onPick(value: string): void {
    this.editing.set(false);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) this.deadlineChanged.emit(value);
  }

  /** AC16 — l'état du mode vit dans du TEXTE, pas seulement dans un liseré. */
  protected readonly countLabel = computed(() => {
    const n = this.count();
    const tone = this.theme.tone();
    if (n === 0) return tone['calendar.compose_count_none'];
    return fillTone(tone[n > 1 ? 'calendar.compose_count_many' : 'calendar.compose_count_one'], {
      n,
    });
  });
}
