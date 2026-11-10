import { Component, ViewEncapsulation, input } from '@angular/core';

/**
 * Contenu déployé sous une carte de choix sélectionnée (Story 31.4, piste B du contrat UI) : la
 * carte choisie s'ouvre EN PLACE et porte son détail — description, pastilles de termes, choix
 * obligatoires — au lieu d'un bloc séparé sous la grille (plus de défilement à chaque sélection).
 *
 * Volontairement un CONTENEUR VOISIN du bouton radio, pas un enfant : un `<button role="radio">` ne
 * doit contenir aucun autre contrôle (piège du radiogroup relevé en 31.3). Visuellement l'en-tête
 * (la carte) et ce bloc ne forment qu'une seule carte.
 *
 * `ViewEncapsulation.None` : les pastilles / étiquettes / libellés ci-dessous sont partagés par les
 * étapes qui projettent leur contenu ici (classe, type…) ; les noms `choice-detail__*` sont uniques.
 */
@Component({
  selector: 'app-choice-detail',
  standalone: true,
  template:
    '<div class="choice-detail" role="group" [attr.aria-label]="label()"><ng-content /></div>',
  styleUrl: './choice-detail.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ChoiceDetail {
  /** Nom accessible du groupe (le libellé de l'option déployée). */
  readonly label = input.required<string>();
}
