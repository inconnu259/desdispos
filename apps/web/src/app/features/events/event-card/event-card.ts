import { Component, computed, inject, input, output } from '@angular/core';
import type { EventCardDto } from '@desdispos/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { SituationPill } from '../../../shared/situation-pill/situation-pill';
import { StatusBadge } from '../../../shared/status-badge/status-badge';
import {
  eventBadge,
  eventDateLabel,
  eventSituation,
  isCancelled,
  isImminentEvent,
  isPastEvent,
} from '../event-card.util';

/**
 * Carte d'une conjonction (Story 40.1, UX-DR7) : titre, badge d'état, date en gras, hôte, lieu (ligne
 * omise s'il est vide), « Ma situation » + pastille (`app-situation-pill`, Story 53.2). Rien de plus sur la carte ; l'état est TOUJOURS
 * écrit (badge, pastille), jamais porté par la seule couleur ou la seule épaisseur du filet.
 *
 * Story 42.1 (⚠️ contrat UI, UX-DR16) : une conjonction annulée reste dans sa section et reste cliquable ;
 * son contenu est estompé à 50 %, un trait diagonal rouge semi-transparent la barre, son badge dit « Annulée »
 * (le trait ne porte jamais seul le sens) et la ligne « Ma situation » disparaît.
 *
 * Story 40.3 : le badge devient « Complet » (grisé) pour un membre non inscrit quand toutes les places
 * sont prises ; les inscrits et l'hôte gardent leur badge normal.
 *
 * Story 40.2 : la carte s'ouvre au clic n'importe où sur elle, à Entrée et à Espace : son titre est
 * un bouton natif (nom accessible = titre) étiré sur toute la carte. Elle émet `open` avec ce bouton,
 * que l'onglet retrouve à la fermeture pour lui rendre le focus. Rendu pur sinon : aucune donnée n'est lue ni écrite ici.
 */
@Component({
  selector: 'app-event-card',
  imports: [SituationPill, StatusBadge],
  templateUrl: './event-card.html',
  styleUrl: './event-card.scss',
})
export class EventCard {
  protected readonly theme = inject(ThemeToneService);

  readonly card = input.required<EventCardDto>();
  /** Clé `YYYY-MM-DD` du jour courant, figée par l'écran parent (une seule source par écran). */
  readonly todayKey = input.required<string>();
  readonly currentUserId = input<string | null>(null);
  /** Demande d'ouverture de la fenêtre de détail ; porte le bouton de la carte (retour du focus). */
  readonly open = output<HTMLElement>();

  protected activate(event: Event): void {
    this.open.emit(event.currentTarget as HTMLElement);
  }

  /** Story 42.1 : annulée — contenu estompé, trait diagonal, badge « Annulée » écrit, sans « Ma situation ». */
  protected readonly cancelled = computed(() => isCancelled(this.card()));
  protected readonly past = computed(() => isPastEvent(this.card(), this.todayKey()));
  protected readonly imminent = computed(() => isImminentEvent(this.card(), this.todayKey()));
  protected readonly badge = computed(() =>
    eventBadge(this.card(), this.todayKey(), this.theme.tone(), this.currentUserId()),
  );
  protected readonly dateLabel = computed(() => eventDateLabel(this.card(), this.theme.tone()));
  protected readonly hostLabel = computed(() =>
    fillTone(this.theme.tone()['partie.ralliement_event_host'], {
      name: this.card().hostDisplayName ?? '—',
    }),
  );
  protected readonly situation = computed(() =>
    eventSituation(this.card(), this.currentUserId(), this.todayKey()),
  );
}
