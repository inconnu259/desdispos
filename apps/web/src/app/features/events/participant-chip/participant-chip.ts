import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import type { EventParticipantDto } from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { initialsOf, isPendingParticipant } from '../event-card.util';

/**
 * Participant d'une conjonction (Story 40.2, UX-DR11/19/20) : disque d'avatar de 26 px (initiales) et
 * nom ; la pastille de la personne connectée est cerclée de l'accent-1 ET dit « vous » en toutes
 * lettres. ⚠️ Un administrateur du groupe porte un écu de 14 px à l'angle de son avatar ET le mot
 * « Admin » (jamais le seul pictogramme) — dessin tiré de la proposition UX, à relire avec
 * l'utilisateur.
 *
 * Story 40.4 : une place seulement RÉSERVÉE (que l'hôte est seul à recevoir) prend la variante en
 * attente — pastille pointillée, avatar estompé — et dit son état en toutes lettres, à pleine lecture :
 * « *Nom* — invité·e, n'a pas encore accepté ». Le texte n'est jamais estompé (≥ 4,5:1) : seul le
 * disque d'avatar, décoratif, l'est.
 *
 * ⚠️ Story 48.3 : avec `libraryEnabled`, la pastille d'un autre participant (ni la sienne, ni une place
 * réservée) devient un bouton de 44 px dont le nom accessible dit « Voir le cabinet / coffre / râtelier de
 * {nom} » ; l'activer émet `libraryRequested` avec le bouton touché (le focus lui sera rendu).
 */
@Component({
  selector: 'app-participant-chip',
  imports: [NgTemplateOutlet, AppIcon],
  templateUrl: './participant-chip.html',
  styleUrl: './participant-chip.scss',
})
export class ParticipantChip {
  protected readonly theme = inject(ThemeToneService);

  readonly participant = input.required<EventParticipantDto>();
  /** La pastille est celle de la personne connectée. */
  readonly self = input(false);
  /** Story 48.3 : le nom ouvre la Ludothèque de la personne (écran d'un groupe seulement). */
  readonly libraryEnabled = input(false);
  /** Story 48.3 : le bouton touché, pour que l'hôte lui rende le focus à la fermeture. */
  readonly libraryRequested = output<HTMLElement>();

  protected readonly initials = computed(() => initialsOf(this.participant().displayName));
  /** Un bouton seulement pour un AUTRE participant dont la place est acceptée. */
  protected readonly opensLibrary = computed(
    () => this.libraryEnabled() && !this.self() && !this.pending(),
  );
  protected readonly openAria = computed(() =>
    fillTone(this.theme.tone()['board_games.open_aria'], { nom: this.participant().displayName }),
  );
  protected readonly pending = computed(() => isPendingParticipant(this.participant()));
  protected readonly pendingText = computed(() =>
    fillTone(this.theme.tone()['partie.ralliement_event_pending_text'], {
      name: this.participant().displayName,
    }),
  );

  protected openLibrary(event: Event): void {
    this.libraryRequested.emit(event.currentTarget as HTMLElement);
  }
}
