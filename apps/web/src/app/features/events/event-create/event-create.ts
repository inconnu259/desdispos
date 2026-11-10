import {
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import type { EventCardDto, PartieMemberDto } from '@master-jdr/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { DetailSurface } from '../../../shared/detail-surface/detail-surface';
import { ConjonctionDraftService, type ConjonctionDraft } from '../conjonction-draft.service';
import { EventForm } from '../event-form/event-form';
import { EventsApiService } from '../events-api.service';
import { refusalMessage } from '../refusal-message';

let nextUid = 0;

/**
 * Fenêtre de création d'une conjonction à date fixée (Story 40.1), sur la `DetailSurface` en
 * variante LARGE (⚠️ contrat UX, EventDialog). Les champs vivent dans `EventForm` (partagé avec le
 * mode édition de la fenêtre de détail, Story 40.2) ; ici : titre, pied « Renoncer » · « Créer la
 * conjonction », garde de double envoi (`busy`) et refus du serveur affiché DANS la fenêtre (message
 * français tel quel, sinon repli du thème). Le serveur reste juge de toutes les règles.
 *
 * Story 40.5b : en mode sondage, « Choisir les créneaux dans le calendrier » dépose le brouillon des
 * champs dans `ConjonctionDraftService` et ouvre le calendrier du groupe (aucun appel au serveur) ; au retour,
 * l'onglet rouvre cette fenêtre avec `draft`, que le formulaire restaure.
 *
 * Story 40.4 : la fenêtre charge les membres du groupe (une fois, échec toléré : le sélecteur de places
 * réservées reste alors vide) et les remet à `EventForm`, avec l'hôte — la personne connectée — qu'on
 * ne peut pas inviter à sa propre conjonction.
 */
@Component({
  selector: 'app-event-create',
  imports: [MatButtonModule, DetailSurface, EventForm],
  templateUrl: './event-create.html',
  styleUrl: './event-create.scss',
})
export class EventCreate implements OnInit {
  protected readonly theme = inject(ThemeToneService);
  private readonly api = inject(EventsApiService);
  private readonly parties = inject(PartiesService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly drafts = inject(ConjonctionDraftService);

  readonly partieId = input.required<string>();
  /** Story 40.5b : brouillon restauré au retour du calendrier du groupe. */
  readonly draft = input<ConjonctionDraft | null>(null);
  /** Story 41.2 : mode « soirée isolée » — l'événement existe déjà (créé avec la partie) : la fenêtre le
   *  COMPLÈTE (modification) au lieu d'en créer un, nom pré-rempli, participation en lecture seule. */
  readonly eventId = input<string | null>(null);
  readonly initialTitle = input('');
  readonly created = output<EventCardDto>();
  readonly closed = output<void>();

  protected readonly uid = `event-create-${++nextUid}`;
  private readonly form = viewChild.required(EventForm);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly members = signal<PartieMemberDto[]>([]);
  protected readonly hostId = computed(() => this.auth.currentUser()?.id ?? null);
  /** Story 41.2 : la soirée isolée n'a ni places limitées ni réservations — aucun membre à charger. */
  protected readonly soiree = computed(() => this.eventId() !== null);

  ngOnInit(): void {
    if (!this.soiree()) void this.loadMembers();
  }

  /** Membres du groupe pour le sélecteur de places réservées. Un échec n'empêche pas de créer. */
  private async loadMembers(): Promise<void> {
    try {
      this.members.set(await this.parties.members(this.partieId()));
    } catch {
      this.members.set([]);
    }
  }

  /** Story 40.5b : choisir les créneaux sur la grille du groupe. Le brouillon part avec la personne ; la
   *  fenêtre se ferme avec la page (rien n'est enregistré). */
  protected async pickInCalendar(): Promise<void> {
    this.drafts.beginCompose(this.form().snapshot(this.partieId()));
    await this.router.navigate(['/parties', this.partieId(), 'guild-calendar']);
  }

  protected readonly canSubmit = computed(() => !this.busy() && this.form().valid());

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const eventId = this.eventId();
      const dto = this.form().dto();
      const card = eventId
        ? await this.api.update(this.partieId(), eventId, dto)
        : await this.api.create(this.partieId(), dto);
      this.created.emit(card);
    } catch (err) {
      this.error.set(
        refusalMessage(err, this.theme.tone()['partie.ralliement_event_create_error']),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
