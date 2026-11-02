import { Component, input, output } from '@angular/core';
import { AppIcon } from '../../../core/icons/app-icon';
import { DestinyBoard, type DestinyBoardModel } from '../destiny-board/destiny-board';
import type { DestinyState } from '../destiny-list/destiny-list';

/** Ce que le tiroir montre : des textes et des compteurs, jamais d'identité de votant. */
export interface DestinySheetModel {
  /** « Destinée : {nom} » — le nom de la région. */
  region: string;
  title: string;
  /** « 2 / 5 · sam. 18 oct. soir · 4 oui · fin du vote ven. 30 oct. ». */
  summary: string;
  state: DestinyState;
  stateLabel: string;
  /** « Voir les 5 dates ». */
  datesLabel: string;
  /** « Replier ». */
  hideLabel: string;
  /** « Fixer la date… » à côté de « Voir les N dates » (tiroir replié, organisateur), sinon `null`. Déplié, le
   *  bouton est celui du plateau. */
  fixLabel: string | null;
  collapseAria: string;
  /** Annoncé en `aria-live` poli à chaque changement de créneau courant (la seule région du tiroir). */
  announcement: string;
  /** Le plateau complet de la story 44.4, montré une fois déplié. */
  board: DestinyBoardModel;
}

/**
 * Story 44.5 — le tiroir de la destinée : le plateau de la 44.4 sous 768 px.
 *
 * Composant de **rendu pur** (même patron que `DestinyBoard`) : `CalendarView` construit le modèle, porte l'état
 * replié/déplié et décide de ce que « choisir un créneau » et « voir qui » font. Tiroir du bas NON modal : ni
 * fond assombri, ni piège de focus — la grille reste utilisable derrière. Aucune action n'est atteignable par le
 * seul glissement : la poignée et « Voir les N dates » sont deux boutons.
 */
@Component({
  selector: 'app-destiny-sheet',
  standalone: true,
  imports: [DestinyBoard, AppIcon],
  templateUrl: './destiny-sheet.html',
  styleUrl: './destiny-sheet.scss',
})
export class DestinySheet {
  readonly model = input.required<DestinySheetModel>();
  readonly expanded = input(false);

  readonly toggled = output<void>();
  readonly slotChosen = output<string>();
  readonly whoRequested = output<void>();
  readonly fixRequested = output<void>();
  readonly extendRequested = output<void>();
  /** Story 45.6 — transmis du plateau déplié. */
  readonly modifyRequested = output<void>();
  readonly otherRequested = output<void>();
}
