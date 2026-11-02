import { Component, input, output } from '@angular/core';
import { AppIcon } from '../../../core/icons/app-icon';

/** Un créneau candidat, tel que le plateau le montre. */
export interface DestinyBoardSlot {
  optionId: string;
  /** « sam. 18 oct. · Soir ». */
  label: string;
  /** « 4 oui ». */
  yesText: string;
  /** ⚠️ Story 47.5 — « 2 dispos sur toute la plage » : le pire nombre de disponibles d'une plage candidate (JDR, carte
   *  de chaleur chargée). Absent ou `null` : rien (créneau seul, groupe, carte manquante). */
  availabilityText?: string | null;
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

/** Story 44.6 — ce que l'organisateur peut conclure depuis le plateau ; un libellé `null` : pas de bouton (droit
 *  absent, ou jamais en JDR pour « Prolonger »). */
export interface DestinyBoardActions {
  fixLabel: string | null;
  extendLabel: string | null;
  /** Story 45.6 — « Modifier les dates » : l'organisateur du vote (`can.edit`). Absent : pas de bouton. */
  modifyLabel?: string | null;
  /** Story 45.6 — le lien « Proposer des dates pour un autre rendez-vous », seulement s'il reste quelque chose à
   *  proposer. Absent : pas de lien. */
  otherLabel?: string | null;
}

export interface DestinyBoardModel {
  title: string;
  subtitle: string;
  slots: readonly DestinyBoardSlot[];
  slotsAria: string;
  bestLabel: string;
  absent: DestinyBoardAbsent | null;
  /** Les actions d'organisateur ; `null` pour qui n'en a aucune. */
  actions: DestinyBoardActions | null;
  /** Annoncé en `aria-live` poli à chaque changement de créneau courant. */
  announcement: string;
  /** Story 45.4 — vote de JDR terminé, pour son organisateur : comment le rouvrir (modifier les dates et repousser
   *  la fin du vote) ; `null` sinon. Jamais de « Prolonger » en JDR. */
  reopenHint?: string | null;
}

/**
 * Story 44.4 — le plateau de la destinée, colonne de droite des calendriers à partir de 768 px.
 *
 * Composant de **rendu pur** (même patron que `DestinyList`) : il ne lit aucun service et ne décide de rien.
 * `CalendarView` construit le modèle — qui ne porte jamais d'identité de votant, seulement des textes et des
 * compteurs — et décide de ce que « choisir un créneau » et « voir qui » font.
 *
 * Story 44.6 — l'organisateur y trouve « Fixer la date… » et, en soirée, « Prolonger le vote » ; le composant
 * ne fait que les demander (`fixRequested`, `extendRequested`), `CalendarView` ouvre les confirmations. Un
 * votant répond sur la grille, avec le sélecteur existant.
 */
@Component({
  selector: 'app-destiny-board',
  standalone: true,
  imports: [AppIcon],
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
  readonly fixRequested = output<void>();
  readonly extendRequested = output<void>();
  /** Story 45.6 — « Modifier les dates » et le lien « autre rendez-vous » : `CalendarView` arme ou ouvre l'atelier. */
  readonly modifyRequested = output<void>();
  readonly otherRequested = output<void>();
}
