import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { atelierUrl, type EventCardDto } from '@master-jdr/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { toDateKey } from '../../calendar/day-detail.utils';
import { ConjonctionDraftService, type ConjonctionDraft } from '../conjonction-draft.service';
import { EventCreate } from '../event-create/event-create';
import { EventDialog } from '../event-dialog/event-dialog';
import { EventsApiService } from '../events-api.service';

/**
 * Premier onglet d'une rencontre isolée (Story 41.1, ralliement `ONE_SHOT`) : le détail de son
 * UNIQUE événement, en ligne — ni liste, ni carte, ni fenêtre (UX-DR10). Le rendu est celui de
 * `EventDialog` en mode `inline` : titre + badge, encadré de situation, fiche ; les participants
 * n'y figurent pas (ils sont dans le second onglet) et aucune action n'y est posée avant les
 * Stories 41.2 (modification par l'hôte) et 41.3 (invitations).
 *
 * L'événement est lu par la liste existante de la partie (la rencontre isolée n'en porte qu'un) et
 * suit le temps réel comme `ConjonctionsTab` : la page parente tient DÉJÀ la connexion
 * `partie:{id}` et `PartiesService.changed()` est notifié à chaque mutation — cet onglet s'y abonne
 * par un `effect()` (garde du premier passage), sans ouvrir de connexion ni ajouter de handler.
 * Rechargement protégé : compteur de requêtes (une réponse périmée n'écrase pas une plus fraîche)
 * et dernier état connu conservé sur un échec transitoire.
 *
 * Story 41.2 : l'événement d'une soirée naît sans date. Juste après la création de la soirée
 * (`history.state.soireeCreation`, posé par le formulaire et consommé ici une seule fois), ou au retour du
 * calendrier du groupe (« Choisir les créneaux dans le calendrier », brouillon à usage unique), la fenêtre
 * de conjonction s'ouvre en mode création par-dessus la page et COMPLÈTE cet événement (date fixée ou
 * sondage). « Renoncer » la referme : l'événement reste « Date à fixer », que l'hôte complète plus tard par
 * « Modifier ». Le détail en ligne demande aussi, ici, de relire l'événement (date fixée, vote prolongé)
 * et d'ouvrir le calendrier du groupe (vote, composition des créneaux).
 */
@Component({
  selector: 'app-soiree-tab',
  imports: [EventDialog, EventCreate],
  templateUrl: './soiree-tab.html',
  styleUrl: './soiree-tab.scss',
})
export class SoireeTab implements OnInit {
  protected readonly theme = inject(ThemeToneService);
  private readonly api = inject(EventsApiService);
  private readonly parties = inject(PartiesService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly drafts = inject(ConjonctionDraftService);

  readonly partieId = input.required<string>();
  /** Description de la soirée (celle de la partie), lue sous le titre du détail. */
  readonly description = input<string | null>(null);
  /** Story 41.4 : soirée terminée (close ou passée) — le détail n'offre plus « Modifier ». */
  readonly frozen = input(false);
  /** Story 42.2 : la personne est l'administrateur (l'hôte) de la soirée — elle peut l'annuler. */
  readonly isAdmin = input(false);

  /** L'unique événement de la rencontre (`null` tant qu'il n'est pas lu). */
  protected readonly card = signal<EventCardDto | null>(null);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);
  /** Fenêtre de création ouverte (Story 41.2) et brouillon rendu par le calendrier du groupe. */
  protected readonly creating = signal(false);
  protected readonly creationDraft = signal<ConjonctionDraft | null>(null);
  /** La fenêtre doit s'ouvrir dès que l'événement est lu (création de la soirée, retour du calendrier). */
  private pendingCreation = false;

  /** Jour courant figé à la construction : une seule source de « aujourd'hui » par écran. */
  protected readonly todayKey = toDateKey(new Date());
  protected readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? null);

  private reqId = 0;

  constructor() {
    // Chargement initial, et rechargement si la partie affichée change.
    effect(() => {
      const id = this.partieId();
      untracked(() => void this.reload(id));
    });

    effect(() => {
      if (!this.pendingCreation || !this.card()) return;
      this.pendingCreation = false;
      untracked(() => this.creating.set(true));
    });

    let firstRun = true;
    effect(() => {
      this.parties.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      untracked(() => void this.reload(this.partieId()));
    });
  }

  ngOnInit(): void {
    // Retour du calendrier du groupe : la fenêtre se rouvre avec ce que la personne y avait saisi.
    const draft = this.drafts.takeReopen(this.partieId());
    if (draft) {
      this.creationDraft.set(draft);
      this.pendingCreation = true;
      return;
    }
    // Soirée tout juste créée : la fenêtre s'ouvre une seule fois (le marqueur est consommé, un
    // rechargement de la page ne la rouvre pas).
    const state = history.state as Record<string, unknown> | null;
    if (state?.['soireeCreation']) {
      this.pendingCreation = true;
      history.replaceState({ ...state, soireeCreation: false }, '');
    }
  }

  /** « Modifier » sur une soirée qui attend sa date : la fenêtre de création, sans brouillon. */
  protected openCreate(): void {
    this.creationDraft.set(null);
    this.creating.set(true);
  }

  protected closeCreate(): void {
    this.creating.set(false);
    this.creationDraft.set(null);
    this.drafts.clear();
  }

  /** L'événement complété : la carte à jour est affichée tout de suite, puis relue. */
  protected async onCompleted(card: EventCardDto): Promise<void> {
    this.card.set(card);
    this.closeCreate();
    await this.reload(this.partieId());
  }

  /** Modification par l'hôte (détail en ligne) : même traitement. */
  protected async onSaved(card: EventCardDto): Promise<void> {
    this.card.set(card);
    await this.reload(this.partieId());
  }

  /** Date fixée ou vote prolongé depuis le détail : relecture immédiate (les autres membres la reçoivent
   *  par le signal temps réel). */
  protected refresh(): void {
    void this.reload(this.partieId());
  }

  /** Voter ou composer les créneaux : le calendrier du groupe (même page pour une soirée). */
  protected openCalendar(pollId: string | null): void {
    // Story 44.7 — « Voter dans le calendrier » arrive en Destinée sur ce vote (`?poll`).
    const url = atelierUrl(
      { partieId: this.partieId(), family: 'ralliement', role: 'member' },
      pollId ? { poll: pollId } : {},
    );
    void this.router.navigateByUrl(url);
  }

  private async reload(partieId: string): Promise<void> {
    const reqId = ++this.reqId;
    try {
      const list = await this.api.list(partieId);
      if (reqId !== this.reqId) return;
      this.card.set(list[0] ?? null);
      this.loadError.set(false);
      this.loaded.set(true);
    } catch {
      // Échec transitoire : le dernier état connu reste affiché.
      if (reqId === this.reqId) this.loadError.set(true);
    }
  }
}
