import { Component, computed, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

/** Un vote ouvert, tel que le contrôle a besoin de le connaître : son identité et son nom.
 *
 *  🚨 **`pollId`, jamais un index** (story 36.9, encadré n°2). La liste est reconstruite à chaque
 *  événement temps réel ; un index survivrait au rechargement en désignant un AUTRE vote, et la
 *  Destinée basculerait toute seule sur un vote que personne n'a demandé. */
export interface DestinyPollRef {
  pollId: string;
  label: string;
}

/**
 * Story 36.9 — le contrôle du mode Destinée.
 *
 * Composant de **rendu pur** : aucun service de données, aucun état propre. Il reçoit la liste
 * des votes ouverts et celui qui est courant, il signale ce que l'utilisateur demande —
 * `CalendarView` décide. Même patron que `CalendarLayerToggle`, `PollTrack` et `GroupGauge`.
 *
 * 🚨 **Il vit HORS du panneau des couches** (AC5, `EXPERIENCE.md:198`) : *« Reste en dehors du
 * panneau — c'est un mode, pas un filtre, et il doit se voir tant qu'il est actif. »* Il est donc
 * rendu comme un **frère** d'`<app-calendar-layer-toggle>` dans `calendar-view.html`, jamais
 * comme une chip de plus à l'intérieur. Quand la story 36.14 repliera la barre derrière
 * « ☰ Affichage », ce composant devra **rester dehors** — c'est la raison pour laquelle il est
 * autonome et déplaçable sans réécriture.
 */
@Component({
  selector: 'app-destiny-control',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './destiny-control.html',
  styleUrl: './destiny-control.scss',
})
export class DestinyControl {
  /** Les votes ouverts, dans l'ordre. Vide ⇒ **rien n'est rendu** (AC10) : pas de bouton grisé,
   *  une affordance qui ne mène nulle part est un piège (règle posée par la story 36.1). */
  readonly polls = input.required<readonly DestinyPollRef[]>();
  /** Le vote courant, ou `null` quand le mode est inactif. */
  readonly currentPollId = input<string | null>(null);

  /** Story 44.3 — la liste des destinées est ouverte (état porté par `CalendarView`, qui l'enveloppe). */
  readonly listOpen = input(false);

  /** ⚠️ Story 44.4 — les chevrons parcourent les CRÉNEAUX du vote actif : `slotPosition` est le rang (base 1)
   *  du créneau courant dans l'ordre chronologique, `slotCount` le nombre de créneaux. `0` / `0` : inconnus. */
  readonly slotPosition = input(0);
  readonly slotCount = input(0);

  /** ⚠️ Story 44.3 — la puce ne bascule plus le mode : elle DEMANDE la liste des destinées. */
  readonly listRequested = output<void>();
  readonly prevRequested = output<void>();
  readonly nextRequested = output<void>();

  protected readonly theme = inject(ThemeToneService);

  private readonly chip = viewChild<ElementRef<HTMLButtonElement>>('chip');

  /** La puce : l'ancre du menu de la liste, et la cible du focus quand la liste se referme. */
  readonly chipElement = computed(() => this.chip()?.nativeElement ?? null);

  protected readonly active = computed(
    () =>
      this.currentPollId() !== null && this.polls().some((p) => p.pollId === this.currentPollId()),
  );

  protected readonly currentLabel = computed(
    () => this.polls().find((p) => p.pollId === this.currentPollId())?.label ?? '',
  );

  /** AC11 — l'état du mode et le vote courant vivent dans du TEXTE (la puce porte le nom du vote actif),
   *  jamais dans la seule estompe de la grille : une opacité n'existe pas pour un lecteur d'écran, et
   *  elle disparaît en contraste élevé (P-1). Depuis la story 44.3 la puce ouvre une liste : son
   *  `aria-expanded` dit l'état de la liste, plus celui du mode. */
  protected readonly chipLabel = computed(() => {
    const name = this.theme.tone()['cta.destiny_mode'];
    return this.active() ? `${name} · ${this.currentLabel()}` : name;
  });
}
