import { Component, input, output } from '@angular/core';

/** Un créneau candidat, tel que le plateau le montre. */
export interface DestinyBoardSlot {
  optionId: string;
  /** « sam. 18 oct. · Soir ». */
  label: string;
  /** « 4 oui ». */
  yesText: string;
  /** La part des oui sur l'effectif, entre 0 et 1 (la barre). */
  ratio: number;
  /** Porte l'étiquette « meilleur » : seulement `bestOption`, donc jamais sans un oui. */
  best: boolean;
  current: boolean;
}

/** Qui n'a pas répondu. Les noms ne viennent que de l'atelier et que pour l'organisateur : ici, un texte. */
export interface DestinyBoardAbsent {
  text: string;
  /** Le libellé du lien « voir qui » (vitrine, organisateur), sinon `null`. */
  whoLabel: string | null;
}

export interface DestinyBoardModel {
  title: string;
  subtitle: string;
  slots: readonly DestinyBoardSlot[];
  slotsAria: string;
  bestLabel: string;
  absent: DestinyBoardAbsent | null;
  /** Annoncé en `aria-live` poli à chaque changement de créneau courant. */
  announcement: string;
}

/**
 * Story 44.4 — le plateau de la destinée, colonne de droite des calendriers à partir de 768 px.
 *
 * Composant de **rendu pur** (même patron que `DestinyList`) : il ne lit aucun service et ne décide de rien.
 * `CalendarView` construit le modèle — qui ne porte jamais d'identité de votant, seulement des textes et des
 * compteurs — et décide de ce que « choisir un créneau » et « voir qui » font.
 *
 * Il n'a aucune action d'organisateur (modifier, fixer, prolonger : story 44.6) : un votant répond sur la
 * grille, avec le sélecteur existant.
 */
@Component({
  selector: 'app-destiny-board',
  standalone: true,
  templateUrl: './destiny-board.html',
  styleUrl: './destiny-board.scss',
})
export class DestinyBoard {
  readonly model = input.required<DestinyBoardModel>();

  /** Story 44.5 — `false` quand un hôte (le tiroir) porte déjà l'annonce du créneau courant : une seule région
   *  `aria-live`, sinon le lecteur d'écran dirait deux fois la même chose. */
  readonly announce = input(true);

  readonly slotChosen = output<string>();
  readonly whoRequested = output<void>();
}
