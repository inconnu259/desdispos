import { Component, computed, input, model } from '@angular/core';
import { MAX_SLOT_WINDOW_SLOTS } from '@master-jdr/shared';
import { DURATION_TEXT, durationDetail, durationSlotsLabel, type SpanStart } from './duration-labels';

let nextUid = 0;

/**
 * Story 47.1 (UX-DR7) — compteur de la durée d'un rendez-vous, en créneaux enchaînés : une pilule à trois
 * segments « − n créneaux + », cibles de 44 px, « Raccourcir » / « Allonger », grisés aux bornes (1 et le
 * plafond de 15 jours). Sous la pilule, la plage en clair quand le départ est connu (« sam. 14 après-midi
 * → sam. 14 soir »), sinon « soit N jours » dès 3 créneaux. La valeur et la plage sont annoncées par une
 * région `aria-live`. Les mots sont neutres, identiques dans les trois thèmes (`DURATION_TEXT`).
 *
 * `readonly` : la durée s'affiche mais ne se règle pas ici (rendez-vous au vote ouvert : c'est le composer
 * de dates qui s'en charge). Le serveur reste juge des bornes.
 */
@Component({
  selector: 'app-duration-stepper',
  templateUrl: './duration-stepper.html',
  styleUrl: './duration-stepper.scss',
})
export class DurationStepper {
  protected readonly text = DURATION_TEXT;

  /** Durée en créneaux (1 à 45). */
  readonly value = model(1);
  /** Départ de la plage, quand il est connu (jour et créneau choisis). */
  readonly start = input<SpanStart | null>(null);
  /** La durée ne se règle pas ici : les boutons sont grisés et la raison s'écrit. */
  readonly readonly = input(false);

  protected readonly uid = `duration-stepper-${++nextUid}`;

  /** Une journée entière ne dure qu'un créneau : sur ce départ, le plafond est 1. */
  protected readonly max = computed(() =>
    this.start()?.slot === 'FULL_DAY' ? 1 : MAX_SLOT_WINDOW_SLOTS,
  );
  protected readonly atMin = computed(() => this.value() <= 1);
  protected readonly atMax = computed(() => this.value() >= this.max());
  protected readonly slotsText = computed(() =>
    durationSlotsLabel(this.value()),
  );
  protected readonly detail = computed(() =>
    durationDetail(this.value(), this.start()),
  );
  /** Annonce `aria-live` : la valeur, puis la plage ou la longueur en jours. */
  protected readonly announcement = computed(() =>
    this.detail() ? `${this.slotsText()}, ${this.detail()}` : this.slotsText(),
  );
  /** Le plafond des 15 jours s'écrit quand on l'atteint (et non pour le plafond d'une journée entière). */
  protected readonly capReached = computed(() => this.value() >= MAX_SLOT_WINDOW_SLOTS);

  protected shorten(): void {
    if (!this.readonly() && !this.atMin()) this.value.update((n) => n - 1);
  }

  protected lengthen(): void {
    if (!this.readonly() && !this.atMax()) this.value.update((n) => n + 1);
  }
}
