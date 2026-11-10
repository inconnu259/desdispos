import { Component, computed, input, output } from '@angular/core';

export interface ChoiceCardOption {
  key: string;
  label: string;
  /** Sous-titre descriptif visible (Story 31.4, DESIGN §7.1) — absent/vide ⇒ aucune ligne rendue. */
  detail?: string;
}

let nextCardId = 0;

@Component({
  selector: 'app-choice-card',
  standalone: true,
  templateUrl: './choice-card.html',
  styleUrl: './choice-card.scss',
})
export class ChoiceCard {
  readonly option = input.required<ChoiceCardOption>();
  readonly selected = input<boolean>(false);
  /** Alignement du contenu : `start` par défaut, `center` pour les cartes courtes (profils). */
  readonly align = input<'start' | 'center'>('start');

  /**
   * Carte DÉPLOYÉE (piste B, Story 31.4) : c'est l'en-tête d'un bloc dont le détail vit juste en
   * dessous (`app-choice-detail`). Le sous-titre laisse alors la place à `expandedHint`, puisque le
   * détail complet est déjà affiché.
   */
  readonly expanded = input<boolean>(false);
  /** Indication affichée dans l'en-tête d'une carte déployée (ex. « Toucher pour désélectionner »). */
  readonly expandedHint = input<string>('');

  /**
   * Variante TEINTÉE (Story 33.3, DESIGN Homme Dragon §7) : liséré, lueur de coin et gemme
   * décorative. Les couleurs ne sont PAS portées ici — le parent les fournit en variables CSS
   * (`--h`, `--h-text`, `--g1`, `--g2`, `--glow`, `--hl`) sur un ancêtre. Faux par défaut : le rendu
   * standard est inchangé.
   */
  readonly tint = input<boolean>(false);
  /** Sous-titre affiché EN ENTIER (aucune coupe à 2/3 lignes) — pour les surfaces larges où la
   *  place ne manque pas (Story 33.3, artefacts sur desktop). Faux par défaut. */
  readonly fullDetail = input<boolean>(false);
  /** Étiquette courte (contour teinté), rendue seulement sur une carte teintée. */
  readonly badge = input<string>('');

  readonly selectedOption = output<string>();

  /** Identifiant du sous-titre, cible d'`aria-describedby` (unique par instance). */
  protected readonly detailId = `choice-card-detail-${nextCardId++}`;
  protected readonly detail = computed(() => this.option().detail?.trim() || null);
  /** Sous-titre réellement rendu : jamais sur une carte déployée (le détail est dessous). */
  protected readonly showDetail = computed(() => (this.expanded() ? null : this.detail()));

  protected onClick(): void {
    this.selectedOption.emit(this.option().key);
  }
}
