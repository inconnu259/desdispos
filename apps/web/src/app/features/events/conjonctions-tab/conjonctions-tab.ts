import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { atelierUrl, type EventCardDto } from '@master-jdr/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { toDateKey } from '../../calendar/day-detail.utils';
import { ConjonctionDraftService, type ConjonctionDraft } from '../conjonction-draft.service';
import { EventCard } from '../event-card/event-card';
import { splitEvents } from '../event-card.util';
import { EventCreate } from '../event-create/event-create';
import { EventDialog } from '../event-dialog/event-dialog';
import { EventsApiService } from '../events-api.service';

/**
 * Onglet « Conjonctions » d'un groupe (Story 39.1 pour la coquille, Story 40.1 pour le contenu) :
 * en-tête (titre + « + Nouvelle conjonction », pour tout membre), sections « À venir » puis
 * « Passées » (passée = jour avant aujourd'hui), état vide global conservé.
 *
 * Story 40.2 : une carte ouvre sa fenêtre de détail (`EventDialog`). La fenêtre lit sa carte dans la
 * liste VIVANTE de l'onglet, par identifiant — elle suit donc les mises à jour reçues en temps réel.
 * Ouverture = une entrée d'historique (même URL) ; le bouton « retour » du navigateur, Échap et
 * « Refermer » la ferment sans toucher à la liste (filtres, défilement : rien n'est re-rendu), et le
 * focus revient sur la carte. L'état d'historique porte le marqueur de la fenêtre EN PLUS de l'état
 * du routeur, qui n'est jamais remplacé : le routeur ignore un retour sur une même URL.
 *
 * Temps réel (checklist) : la page parente (`PartieDetail`) tient DÉJÀ la connexion `partie:{id}`,
 * et `PartiesService.changed()` est notifié sur toute mutation de cette partie — l'onglet s'y
 * abonne par un `effect()` (garde firstRun) et n'ouvre aucune connexion, n'ajoute aucun handler.
 * Rechargement protégé : compteur de requêtes (une réponse périmée n'écrase pas une plus fraîche) et
 * dernier état connu conservé sur un échec transitoire (jamais de `.set([])`).
 *
 * Story 40.5b : l'en-tête porte le lien « Calendrier du groupe » (écrit, jamais une icône seule) ; la
 * fenêtre de détail y envoie aussi (« Voter dans le calendrier », « Composer les créneaux ») en REMPLAÇANT
 * l'entrée d'historique qu'elle avait poussée, pour qu'un retour arrière revienne à la liste sans fenêtre
 * fantôme. Au retour de l'aller-retour « Choisir les créneaux dans le calendrier », la fenêtre de création
 * se rouvre avec son brouillon (`ConjonctionDraftService`, à usage unique).
 *
 * `countChange` remonte le nombre réel de conjonctions du groupe (passées comprises) — l'avertissement
 * du dernier administrateur (Story 39.4) le cite.
 */
/** Clé du marqueur de la fenêtre dans `history.state`. */
const HISTORY_KEY = 'conjonctionDialog';

@Component({
  selector: 'app-conjonctions-tab',
  imports: [MatButtonModule, RouterLink, EventCard, EventCreate, EventDialog],
  templateUrl: './conjonctions-tab.html',
  styleUrl: './conjonctions-tab.scss',
})
export class ConjonctionsTab implements OnInit {
  protected readonly theme = inject(ThemeToneService);
  private readonly api = inject(EventsApiService);
  private readonly parties = inject(PartiesService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly drafts = inject(ConjonctionDraftService);

  readonly partieId = input.required<string>();
  /** Story 42.1 : la personne est administrateur du groupe — elle peut annuler la conjonction d'un autre. */
  readonly isAdmin = input(false);
  readonly countChange = output<number>();

  protected readonly events = signal<EventCardDto[]>([]);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);
  protected readonly creating = signal(false);
  /** Story 40.5b : brouillon rendu par le calendrier du groupe, que la fenêtre de création restaure. */
  protected readonly creationDraft = signal<ConjonctionDraft | null>(null);
  /** Conjonction dont la fenêtre est ouverte (Story 40.2) ; sa carte est relue dans `events`. */
  protected readonly selectedId = signal<string | null>(null);

  /** Jour courant figé à la construction : une seule source de « aujourd'hui » par écran. */
  protected readonly todayKey = toDateKey(new Date());
  protected readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? null);
  protected readonly sections = computed(() => splitEvents(this.events(), this.todayKey));
  protected readonly selectedCard = computed(() => {
    const id = this.selectedId();
    return id === null ? null : (this.events().find((e) => e.id === id) ?? null);
  });

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);
  private reqId = 0;
  /** Carte qui a ouvert la fenêtre : elle récupère le focus à la fermeture. */
  private trigger: HTMLElement | null = null;
  /** Une entrée d'historique a été ajoutée à l'ouverture et n'a pas encore été retirée. */
  private pushed = false;
  private readonly onPopState = () => {
    if (this.selectedId() === null) return;
    // Encore sur l'entrée de la fenêtre (ou une plus récente qui la porte) : rien à fermer.
    const state = history.state as Record<string, unknown> | null;
    if (state?.[HISTORY_KEY]) return;
    this.pushed = false;
    this.dismiss();
  };

  constructor() {
    // Chargement initial, et rechargement si la partie affichée change.
    effect(() => {
      const id = this.partieId();
      untracked(() => void this.reload(id));
    });

    // La conjonction ouverte a disparu de la liste (relue après un signal) : la fenêtre se referme.
    effect(() => {
      if (this.selectedId() !== null && this.loaded() && !this.selectedCard()) {
        untracked(() => this.closeDialog());
      }
    });
    inject(DestroyRef).onDestroy(() => window.removeEventListener('popstate', this.onPopState));

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
    // Retour du calendrier du groupe (« Choisir les créneaux dans le calendrier ») : la fenêtre de
    // création se rouvre avec ce que la personne y avait saisi, créneaux choisis compris.
    const draft = this.drafts.takeReopen(this.partieId());
    if (draft) {
      this.creationDraft.set(draft);
      this.creating.set(true);
    }
  }

  /** Ouvre la fenêtre de la carte `card` (clic ou Entrée) : une entrée d'historique, même URL. */
  protected openDialog(card: EventCardDto, trigger: HTMLElement): void {
    this.trigger = trigger;
    this.selectedId.set(card.id);
    if (!this.pushed) {
      const state = (history.state as Record<string, unknown> | null) ?? {};
      history.pushState({ ...state, [HISTORY_KEY]: card.id }, '');
      this.pushed = true;
      window.addEventListener('popstate', this.onPopState);
    }
  }

  /** Fermeture par l'interface (Échap, « Refermer », croix) : l'entrée d'historique ajoutée est
   *  retirée, puis la fenêtre se ferme. Le retour du navigateur passe par `onPopState`. */
  protected closeDialog(): void {
    if (this.pushed) {
      this.pushed = false;
      window.removeEventListener('popstate', this.onPopState);
      history.back();
    }
    this.dismiss();
  }

  /** Enregistrement par l'hôte : la carte à jour remplace l'ancienne tout de suite, puis la liste
   *  est relue (les autres membres la reçoivent par le signal temps réel). */
  protected async onSaved(card: EventCardDto): Promise<void> {
    this.events.update((list) => list.map((e) => (e.id === card.id ? card : e)));
    await this.reload(this.partieId());
  }

  /** Story 40.5b : la fenêtre de détail envoie vers le calendrier du groupe. L'entrée d'historique poussée
   *  à l'ouverture est REMPLACÉE par le calendrier (et non laissée derrière) : un retour arrière ramène à
   *  la liste, sans fenêtre fantôme ni second retour à faire. */
  protected openCalendar(pollId: string | null): void {
    this.pushed = false;
    window.removeEventListener('popstate', this.onPopState);
    // Story 44.7 — « Voter dans le calendrier » arrive en Destinée sur ce vote (`?poll`).
    const url = atelierUrl(
      { partieId: this.partieId(), family: 'ralliement', role: 'member' },
      pollId ? { poll: pollId } : {},
    );
    void this.router.navigateByUrl(url, { replaceUrl: true });
  }

  /** Story 40.6 : la date d'une conjonction vient d'être fixée — la liste est relue tout de suite (les autres
   *  membres la reçoivent par le signal temps réel). */
  protected refresh(): void {
    void this.reload(this.partieId());
  }

  private dismiss(): void {
    window.removeEventListener('popstate', this.onPopState);
    const id = this.selectedId();
    this.selectedId.set(null);
    const trigger = this.trigger;
    this.trigger = null;
    // Après le retrait de la fenêtre du DOM : la carte (ou, si elle a été re-rendue, sa jumelle)
    // récupère le focus.
    afterNextRender(
      () => {
        const target =
          trigger && trigger.isConnected
            ? trigger
            : id !== null
              ? this.host.nativeElement.querySelector<HTMLElement>(`[data-event-id="${id}"]`)
              : null;
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  protected openCreate(): void {
    this.creating.set(true);
  }

  protected closeCreate(): void {
    this.creating.set(false);
    this.creationDraft.set(null);
    this.drafts.clear();
  }

  /** Conjonction créée : la fenêtre se referme, la carte apparaît tout de suite (puis la liste est
   *  relue — les autres membres la reçoivent par le signal temps réel). */
  protected async onCreated(card: EventCardDto): Promise<void> {
    this.creating.set(false);
    this.creationDraft.set(null);
    this.drafts.clear();
    if (!this.events().some((e) => e.id === card.id)) {
      this.events.update((list) => [...list, card]);
      this.countChange.emit(this.events().length);
    }
    await this.reload(this.partieId());
  }

  private async reload(partieId: string): Promise<void> {
    const reqId = ++this.reqId;
    try {
      const list = await this.api.list(partieId);
      if (reqId !== this.reqId) return;
      this.events.set(list);
      this.loadError.set(false);
      this.loaded.set(true);
      this.countChange.emit(list.length);
    } catch {
      // Échec transitoire : le dernier état connu reste affiché.
      if (reqId === this.reqId) this.loadError.set(true);
    }
  }
}
