import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import type { EventCardDto, EventParticipantDto, PartieMemberDto } from '@master-jdr/shared';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { DetailSurface } from '../../../shared/detail-surface/detail-surface';
import { StatusBadge } from '../../../shared/status-badge/status-badge';
import {
  CancelEventDialog,
  type CancelEventData,
} from '../cancel-event-dialog/cancel-event-dialog';
import { DateFixDialog, type DateFixData } from '../date-fix-dialog/date-fix-dialog';
import {
  canCancelEvent,
  canExtendVote,
  canFixDate,
  canManageReservations,
  canRespondToReservation,
  canSignUp,
  canUnsubscribe,
  eventBadge,
  eventDateLabel,
  eventSituation,
  eventSituationTextKey,
  extendMinKey,
  hasPendingPoll,
  isCancelled,
  isFull,
  isFullForViewer,
  isHostOf,
  isPastEvent,
  isPendingParticipant,
  participationLine,
  pollDeadlineKey,
  pollPanel,
  pollSlotRows,
  rankedPollSlots,
} from '../event-card.util';
import { EventForm } from '../event-form/event-form';
import { ExtendVoteDialog, type ExtendVoteData } from '../extend-vote-dialog/extend-vote-dialog';
import { EventsApiService } from '../events-api.service';
import { LibrarySheet } from '../../board-games/library-sheet/library-sheet';
import { EventGamesTab } from '../event-games-tab/event-games-tab';
import { ParticipantChip } from '../participant-chip/participant-chip';
import { refusalMessage } from '../refusal-message';

let nextUid = 0;

/**
 * Fenêtre d'une conjonction (Story 40.2, EventDialog) sur la `DetailSurface` en variante LARGE
 * (⚠️ contrat UX). Ordre du contrat : titre (nom de la conjonction) + badge → panneau de situation
 * (la situation de la personne, puis date, heure et lieu en grand — pas de vote à ce palier) →
 * fiche (date, hôte, lieu, heure, participation, infos pratiques ; lignes facultatives vides omises)
 * → participants → pied. Pied : l'hôte voit « Modifier » tant que la conjonction n'est pas passée,
 * puis « Refermer ».
 *
 * Story 40.3 : le panneau de situation offre « S'inscrire » à un membre non inscrit (et pas l'hôte)
 * tant que la conjonction est à venir — remplacé par « Complet », écrit, quand il n'y a plus de
 * place — et le pied offre « Me désinscrire » à un inscrit (pas l'hôte). Les boutons sont gardés
 * contre le double clic (`busy`), le refus du serveur (complet, passée) s'affiche dans la fenêtre,
 * et la carte à jour est remise à l'onglet (`saved`) : participants, chip et ligne de participation
 * se lisent ensuite dans la liste vivante, comme pour tout changement reçu en direct.
 *
 * Story 40.4 : la personne à qui une place est réservée voit, dans le panneau de situation, « Accepter »
 * et « Décliner » (gardés contre le double clic, refus du serveur affiché dans la fenêtre) ; refuser
 * passe par la désinscription, qui libère la place. L'hôte, tant que la conjonction à places limitées
 * n'est pas passée, voit sous les participants le sélecteur « Réserver une place à des membres »
 * (un clic sur un membre lui réserve une place) et, sur chaque réservation en attente — affichée en
 * pastille pointillée — une action « Retirer la réservation ». Les membres du groupe sont lus une seule
 * fois, à l'ouverture.
 *
 * Story 40.5b : le panneau du sondage offre un lien écrit vers le calendrier du groupe — « Voter dans le
 * calendrier » à un votant éligible tant que le vote est ouvert, « Composer les créneaux » à l'hôte d'un
 * sondage ouvert. Ni l'un ni l'autre ne vote ni ne compose ici : la fenêtre demande à l'onglet
 * (`calendarRequested`) d'ouvrir la page : « Voter dans le calendrier » vise SON vote (`pollId`, Story 44.7 : la
 * Destinée s'y ouvre), « Composer les créneaux » n'en vise aucun (`null`).
 *
 * Story 40.6 : l'hôte d'un sondage voit « Fixer la date… » dans son panneau (actif tant que le sondage est
 * ouvert et propose au moins un créneau). Il ouvre la confirmation « Votre accord » (`DateFixDialog`) : les
 * créneaux du plus au moins plébiscité, le meilleur présélectionné. Au succès, la fenêtre demande à l'onglet
 * de relire la liste (`refreshRequested`) et suit la carte vivante : le panneau du sondage cède la place à la
 * date, l'heure et le lieu en grand, comme pour toute conjonction datée.
 *
 * Story 40.7 : l'hôte d'un sondage ouvert et sans date voit aussi « Prolonger le vote » (échéance dépassée
 * comprise : prolonger rouvre le vote). Il ouvre la confirmation « Votre accord » (`ExtendVoteDialog`) : champ
 * « Nouvelle échéance » (date native, au plus tôt le lendemain de l'échéance actuelle), texte de relance. Au
 * succès, la fenêtre demande à l'onglet de relire la liste (`refreshRequested`) et suit la carte vivante.
 *
 * La carte vient de la liste vivante de l'onglet (lue par identifiant) : toute mise à jour reçue en
 * temps réel se reflète ici sans rechargement. « Modifier » bascule la MÊME fenêtre en mode édition
 * (les champs de la création, via `EventForm`), pied « Renoncer » · « Enregistrer » ; le refus du
 * serveur s'affiche dans la fenêtre. Le focus est piégé par la `DetailSurface` ; le retour du focus
 * sur la carte est l'affaire de l'onglet.
 */
@Component({
  selector: 'app-event-dialog',
  imports: [
    MatButtonModule,
    NgTemplateOutlet,
    DetailSurface,
    StatusBadge,
    ParticipantChip,
    EventForm,
    LibrarySheet,
    EventGamesTab,
  ],
  templateUrl: './event-dialog.html',
  styleUrl: './event-dialog.scss',
})
export class EventDialog {
  protected readonly theme = inject(ThemeToneService);
  private readonly api = inject(EventsApiService);
  private readonly parties = inject(PartiesService);
  private readonly dialog = inject(MatDialog);

  readonly partieId = input.required<string>();
  readonly card = input.required<EventCardDto>();
  /** Clé `YYYY-MM-DD` du jour courant, figée par l'écran parent. */
  readonly todayKey = input.required<string>();
  readonly currentUserId = input<string | null>(null);
  /** Story 41.1 : rendu EN LIGNE (page d'une rencontre isolée) au lieu de la fenêtre — mêmes blocs, sans
   *  `DetailSurface`, sans participants ni actions d'inscription/réservation/modification (la modification
   *  par l'hôte arrive avec la Story 41.2), participation « sur invitation », pied omis. */
  readonly inline = input(false);
  /** Description de la partie, affichée sous le titre en mode `inline` seulement (la soirée isolée n'a
   *  plus d'onglet « Détails » où la lire). */
  readonly description = input<string | null>(null);
  /** Story 41.2 : l'hôte veut compléter une soirée qui attend sa date — l'onglet ouvre alors la fenêtre de
   *  création (mêmes champs, brouillon du calendrier compris) au lieu de l'édition en ligne. */
  readonly completeRequested = output<void>();
  /** Story 41.4 : soirée terminée (close ou passée) — plus de « Modifier ». */
  readonly frozen = input(false);
  /** Story 42.1 : la personne est administrateur du groupe — elle peut annuler la conjonction d'un autre. */
  readonly viewerIsAdmin = input(false);
  /** Carte à jour renvoyée par le serveur (modification par l'hôte, inscription, désinscription) :
   *  l'onglet la met à jour tout de suite. */
  readonly saved = output<EventCardDto>();
  readonly closed = output<void>();
  /** Story 40.5b : la personne veut voter ou composer ses créneaux dans le calendrier du groupe. */
  readonly calendarRequested = output<string | null>();
  /** Story 40.6 : la date vient d'être fixée — l'onglet relit la liste pour montrer la conjonction datée. */
  readonly refreshRequested = output<void>();

  protected readonly uid = `event-dialog-${++nextUid}`;
  private readonly form = viewChild(EventForm);

  protected readonly editing = signal(false);
  protected readonly busy = signal(false);

  /** ⚠️ Story 48.3 : la Ludothèque ouverte par le nom d'un participant (`null` = fermée) — la feuille est
   *  rendue sous `<body>`, au-dessus de cette fenêtre, et rend le focus à `trigger`. */
  protected readonly library = signal<{
    userId: string;
    name: string;
    trigger: HTMLElement;
  } | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Membres du groupe (hôte seulement, lus une fois) : source du sélecteur de places réservées. */
  private readonly members = signal<PartieMemberDto[]>([]);
  private membersRequested = false;

  constructor() {
    effect(() => {
      if ((this.canReserve() || this.hostNeedsNames()) && !this.membersRequested) {
        this.membersRequested = true;
        untracked(() => void this.loadMembers());
      }
    });
  }

  /** Story 40.5 : l'hôte d'un sondage nomme ceux qui n'ont pas encore répondu — il lui faut les membres
   *  du groupe (tous les membres votent quand la conjonction n'a pas de limite de places). */
  private readonly hostNeedsNames = computed(
    () => isHostOf(this.card(), this.currentUserId()) && hasPendingPoll(this.card()),
  );

  protected readonly past = computed(() => isPastEvent(this.card(), this.todayKey()));

  /** ⚠️ Story 49.1 : l'onglet des jeux sur place n'existe que pour une conjonction OUVERTE de la fenêtre —
   *  ni en ligne (la rencontre isolée a le sien), ni passée, ni annulée, ni figée. */
  protected readonly gamesAvailable = computed(
    () => !this.inline() && !this.past() && !this.cancelled() && !this.frozen(),
  );
  /** Le bandeau d'onglets est posé tant que l'onglet des jeux existe ; en modification, la fenêtre ne montre que le
   *  formulaire. */
  protected readonly showTabs = computed(() => this.gamesAvailable() && !this.editing());
  private readonly selectedTab = signal<'main' | 'games'>('main');
  protected readonly activeTab = computed(() => (this.showTabs() ? this.selectedTab() : 'main'));
  /** Nombre de jeux sur place, remonté par l'onglet (`null` tant qu'il n'est pas lu). */
  protected readonly gamesCount = signal<number | null>(null);
  protected readonly gamesLabel = computed(() => {
    const count = this.gamesCount();
    const tone = this.theme.tone();
    return count === null
      ? tone['event_games.tab']
      : fillTone(tone['event_games.tab_count'], { n: count });
  });

  protected selectTab(tab: 'main' | 'games'): void {
    this.selectedTab.set(tab);
  }

  /** Navigation au clavier du bandeau d'onglets : flèches et début/fin, activation automatique. */
  protected onTabKeydown(event: KeyboardEvent): void {
    const order: ('main' | 'games')[] = ['main', 'games'];
    const current = order.indexOf(this.activeTab());
    const targets: Record<string, number> = {
      ArrowRight: (current + 1) % order.length,
      ArrowLeft: (current + order.length - 1) % order.length,
      Home: 0,
      End: order.length - 1,
    };
    if (!Object.hasOwn(targets, event.key)) return;
    const next = targets[event.key];
    event.preventDefault();
    this.selectedTab.set(order[next]);
    const list = (event.currentTarget as HTMLElement).parentElement;
    list?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }

  /** Story 42.1 : annulée — état écrit en tête, plus aucune action. */
  protected readonly cancelled = computed(() => isCancelled(this.card()));
  protected readonly canEdit = computed(
    () =>
      !this.frozen() &&
      !this.cancelled() &&
      isHostOf(this.card(), this.currentUserId()) &&
      !this.past(),
  );
  /** Story 42.1 : « Annuler la conjonction » — l'hôte ou un administrateur, avant la date. Story 42.2 : aussi
   *  dans le détail en ligne d'une soirée isolée, sauf si elle est figée (terminée, annulée). */
  protected readonly canCancel = computed(
    () =>
      !this.frozen() &&
      canCancelEvent(this.card(), this.currentUserId(), this.viewerIsAdmin(), this.todayKey()),
  );
  /** Story 41.4 : « Ma situation » d'une soirée en pastille écrite (« Je participe », « J'y étais »…). */
  protected readonly situationChip = computed(() =>
    this.inline() ? eventSituation(this.card(), this.currentUserId(), this.todayKey(), true) : null,
  );
  /** Story 41.2 : événement sans date ni sondage (une soirée fraîchement créée). */
  protected readonly awaitingDate = computed(() => {
    const seance = this.card().seance;
    return seance !== null && seance.date === null && this.card().poll === null;
  });
  /** Pied en ligne : seulement quand il porte une action (modifier, enregistrer) ou une erreur. */
  protected readonly showInlineFooter = computed(
    () => this.editing() || this.canEdit() || this.canCancel() || this.error() !== null,
  );
  protected readonly badge = computed(() =>
    eventBadge(this.card(), this.todayKey(), this.theme.tone(), this.currentUserId()),
  );
  protected readonly showSignUp = computed(
    () => !this.inline() && canSignUp(this.card(), this.currentUserId(), this.todayKey()),
  );
  /** « Complet », écrit, à la place de « S'inscrire » : seulement pour qui n'est pas inscrit. */
  protected readonly showFull = computed(
    () => !this.inline() && isFullForViewer(this.card(), this.currentUserId(), this.todayKey()),
  );
  protected readonly showUnsubscribe = computed(
    () => !this.inline() && canUnsubscribe(this.card(), this.currentUserId(), this.todayKey()),
  );
  /** Story 40.4 : « Accepter » / « Décliner » pour qui tient une place réservée. */
  protected readonly showRespond = computed(
    () => !this.inline() && canRespondToReservation(this.card(), this.todayKey()),
  );
  /** Story 40.4 : l'hôte gère les réservations (places limitées, pas passée). */
  protected readonly canReserve = computed(
    () =>
      !this.inline() && canManageReservations(this.card(), this.currentUserId(), this.todayKey()),
  );
  /** Membres à qui une place peut encore être réservée : ni l'hôte, ni quiconque a déjà une ligne
   *  (l'hôte voit toutes les lignes, réservées comprises, dans les participants). */
  protected readonly candidates = computed(() => {
    const taken = new Set(this.card().participants.map((p) => p.userId));
    return this.members().filter((m) => m.userId !== this.card().hostId && !taken.has(m.userId));
  });
  /** Plus aucune place à réserver : les pastilles sont désactivées. */
  protected readonly noPlaceLeft = computed(() => isFull(this.card()));
  /** Story 40.5 : panneau du sondage (membre « Vote à faire » / hôte), recalculé depuis la carte vivante
   *  — il suit donc les réponses qui arrivent en direct. Aucun vote dans la fenêtre : il se fait dans le
   *  calendrier du groupe (Story 40.5b). */
  protected readonly poll = computed(() =>
    pollPanel(this.card(), this.currentUserId(), this.todayKey(), this.theme.tone(), (id) =>
      this.nameOf(id),
    ),
  );
  /** Story 40.5b : « Voter dans le calendrier » — un votant éligible, tant que le vote est ouvert. */
  protected readonly showVoteInCalendar = computed(() => {
    const p = this.poll();
    return !!p && (p.kind === 'member-todo' || p.kind === 'member-done') && !p.ended;
  });
  /** Story 40.5b : « Composer les créneaux » — l'hôte d'un sondage ouvert. */
  protected readonly showComposeInCalendar = computed(
    () => this.poll()?.kind === 'host' && this.card().poll?.status === 'OPEN',
  );
  /** Story 40.6 : « Fixer la date… » — l'hôte, sondage ouvert avec au moins un créneau. */
  protected readonly canFix = computed(() => canFixDate(this.card()));
  /** Story 40.7 : « Prolonger le vote » — l'hôte, sondage ouvert et sans date (échéance dépassée comprise). */
  protected readonly canExtend = computed(() => canExtendVote(this.card()));
  /** Créneaux candidats de la fiche, avec le nombre d'inscrits libres sur chacun. */
  protected readonly slotRows = computed(() => pollSlotRows(this.card(), this.theme.tone()));
  protected readonly dateLabel = computed(() => eventDateLabel(this.card(), this.theme.tone()));
  protected readonly situationText = computed(
    () =>
      this.theme.tone()[
        eventSituationTextKey(this.card(), this.currentUserId(), this.todayKey(), this.inline())
      ],
  );
  protected readonly timeText = computed(() => {
    const time = this.card().seance?.heureRdv;
    return time
      ? fillTone(this.theme.tone()['partie.ralliement_event_panel_time'], { time })
      : null;
  });
  protected readonly participation = computed(() =>
    this.inline()
      ? this.theme.tone()['partie.ralliement_soiree_participation']
      : participationLine(this.card(), this.theme.tone()),
  );
  /** Le pied (« Modifier », « Refermer »…) n'existe que dans la fenêtre : en ligne, aucune action ne s'y
   *  pose encore et « Refermer » n'a pas de sens. */
  protected readonly hasFooter = computed(() => !this.inline());
  protected readonly windowTitle = computed(() =>
    this.editing() ? this.theme.tone()['partie.ralliement_event_edit_title'] : this.card().title,
  );
  protected readonly canSave = computed(() => !this.busy() && !!this.form()?.valid());

  /** Story 40.6 : ouvre la confirmation « Votre accord » ; le serveur est seul juge (hôte, date déjà fixée). */
  protected openFixDate(): void {
    const poll = this.card().poll;
    if (!poll || !this.canFix()) return;
    const data: DateFixData = {
      title: this.card().title,
      slots: rankedPollSlots(this.card(), this.todayKey()),
      todayKey: this.todayKey(),
      confirm: (optionId) => this.api.choose(this.partieId(), poll.id, optionId),
    };
    const ref = this.dialog.open<DateFixDialog, DateFixData, boolean>(DateFixDialog, {
      data,
      width: 'min(560px, 96vw)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
    ref.afterClosed().subscribe((fixed) => {
      if (fixed) this.refreshRequested.emit();
    });
  }

  /** Story 40.7 : ouvre la confirmation « Votre accord » de la prolongation ; le serveur est seul juge (hôte,
   *  date déjà fixée, jour non postérieur). */
  protected openExtendVote(): void {
    const poll = this.card().poll;
    if (!poll || !this.canExtend()) return;
    const data: ExtendVoteData = {
      title: this.card().title,
      deadlineKey: pollDeadlineKey(this.card()),
      minKey: extendMinKey(this.card(), this.todayKey()),
      confirm: (day) => this.api.extend(this.partieId(), poll.id, day),
    };
    const ref = this.dialog.open<ExtendVoteDialog, ExtendVoteData, boolean>(ExtendVoteDialog, {
      data,
      width: 'min(560px, 96vw)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
    ref.afterClosed().subscribe((extended) => {
      if (extended) this.refreshRequested.emit();
    });
  }

  /** Story 42.1 : ouvre la confirmation « Votre accord » (bouton rouge) ; le serveur est seul juge (droit,
   *  jour passé, déjà annulée). Au succès la carte à jour remplace l'ancienne (`saved`) et la liste est relue. */
  protected openCancel(): void {
    if (!this.canCancel()) return;
    let cancelled: EventCardDto | null = null;
    const data: CancelEventData = {
      title: this.card().title,
      confirm: async () => {
        cancelled = await this.api.cancel(this.partieId(), this.card().id);
      },
    };
    const ref = this.dialog.open<CancelEventDialog, CancelEventData, boolean>(CancelEventDialog, {
      data,
      width: 'min(560px, 96vw)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
    ref.afterClosed().subscribe((done) => {
      if (done && cancelled) this.saved.emit(cancelled);
    });
  }

  protected startEdit(): void {
    this.error.set(null);
    // Story 41.2 : une soirée qui attend sa date se complète dans la fenêtre de création.
    if (this.inline() && this.awaitingDate()) {
      this.completeRequested.emit();
      return;
    }
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.error.set(null);
    this.editing.set(false);
  }

  /** Story 40.3 : s'inscrire. Le serveur est seul juge (complet, passée) ; son refus s'affiche ici. */
  protected async signUp(): Promise<void> {
    await this.changeRoster(
      (seanceId) => this.api.inscrire(seanceId),
      'partie.ralliement_event_signup_error',
    );
  }

  /** Story 40.3 : se désinscrire (libre tant que la conjonction n'est pas passée). */
  protected async unsubscribe(): Promise<void> {
    await this.changeRoster(
      (seanceId) => this.api.desinscrire(seanceId),
      'partie.ralliement_event_unsubscribe_error',
    );
  }

  /** Story 40.4 : accepter la place réservée. */
  protected async accept(): Promise<void> {
    await this.changeRoster(
      (seanceId) => this.api.accepter(seanceId),
      'partie.ralliement_event_accept_error',
    );
  }

  /** Story 40.4 : décliner la place réservée — la ligne est supprimée, la place est libre. */
  protected async decline(): Promise<void> {
    await this.changeRoster(
      (seanceId) => this.api.desinscrire(seanceId),
      'partie.ralliement_event_decline_error',
    );
  }

  /** Story 40.4 : l'hôte réserve une place à `member`. Le serveur est seul juge (complet, déjà inscrit). */
  protected async reserve(member: PartieMemberDto): Promise<void> {
    await this.changeRoster(
      (seanceId) => this.api.reserver(seanceId, member.userId),
      'partie.ralliement_event_reserve_error',
    );
  }

  /** Story 40.4 : l'hôte retire la réservation en attente de `participant`. */
  protected async unreserve(participant: EventParticipantDto): Promise<void> {
    await this.changeRoster(
      (seanceId) => this.api.retirerReservation(seanceId, participant.userId),
      'partie.ralliement_event_unreserve_error',
    );
  }

  protected isPending(participant: EventParticipantDto): boolean {
    return isPendingParticipant(participant);
  }

  protected reserveAria(member: PartieMemberDto): string {
    return fillTone(this.theme.tone()['partie.ralliement_event_reserve_chip_aria'], {
      name: member.displayName,
    });
  }

  protected unreserveAria(participant: EventParticipantDto): string {
    return fillTone(this.theme.tone()['partie.ralliement_event_unreserve_aria'], {
      name: participant.displayName,
    });
  }

  /** Nom affiché d'une personne : les membres du groupe, puis les participants de la carte. */
  private nameOf(id: string): string {
    return (
      this.members().find((m) => m.userId === id)?.displayName ??
      this.card().participants.find((p) => p.userId === id)?.displayName ??
      '—'
    );
  }

  private async loadMembers(): Promise<void> {
    try {
      this.members.set(await this.parties.members(this.partieId()));
    } catch {
      // Sans la liste, le sélecteur reste vide : réserver n'est pas bloquant pour le reste de la fenêtre.
      this.members.set([]);
    }
  }

  private async changeRoster(
    call: (seanceId: string) => Promise<EventCardDto>,
    errorKey: string,
  ): Promise<void> {
    const seanceId = this.card().seance?.id;
    if (!seanceId || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.saved.emit(await call(seanceId));
    } catch (err) {
      this.error.set(refusalMessage(err, this.theme.tone()[errorKey]));
    } finally {
      this.busy.set(false);
    }
  }

  protected async save(): Promise<void> {
    const form = this.form();
    if (!form || !this.canSave()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const card = await this.api.update(this.partieId(), this.card().id, form.dto());
      this.saved.emit(card);
      this.editing.set(false);
    } catch (err) {
      this.error.set(
        refusalMessage(err, this.theme.tone()['partie.ralliement_event_update_error']),
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected openLibrary(participant: EventParticipantDto, trigger: HTMLElement): void {
    this.library.set({ userId: participant.userId, name: participant.displayName, trigger });
  }

  protected closeLibrary(): void {
    this.library.set(null);
  }
}
