import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import type {
  DaySlot,
  PartieMemberDto,
  ScenarioDto,
  SeanceDto,
  SessionPollDto,
} from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { AuthService } from '../../../core/auth/auth.service';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { PollService } from '../../../core/poll/poll.service';
import { atelierUrl } from '@master-jdr/shared';
import { composeSeanceInfo, toDateKey } from '../../calendar/day-detail.utils';
import { PollStatusPanel } from '../../poll/poll-status/poll-status';
import { PollResponseComponent } from '../../poll/poll-response/poll-response';
import { FillIndicator } from '../fill-indicator/fill-indicator';
import { DurationStepper } from '../../../shared/duration-stepper/duration-stepper';
import { StatusBadge } from '../../../shared/status-badge/status-badge';
import { seanceState, type StatusBadgeState } from '../../../core/status/status-derivation';
import { isSpan, spanShortLabel } from '../../calendar/span-label';

/** Même forme que côté serveur (`set-infos-pratiques.dto.ts`) : sert uniquement à détecter une
 *  valeur stockée hors app (écriture directe en base) que le widget natif `type="time"` rendrait
 *  vide sans le signaler — jamais à revalider une saisie qui passe par ce composant. */
const HEURE_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

const SLOT_LABELS: Record<DaySlot, string> = {
  MORNING: 'Matin',
  AFTERNOON: 'Après-midi',
  EVENING: 'Soir',
  FULL_DAY: 'Journée',
};

/**
 * Liste des séances d'un scénario (Story 8.2, retravaillé Story 8.7/8.8) — la création de vote ne
 * vit plus ici (panneau `<app-poll-creation>` retiré, point d'entrée unique désormais le calendrier
 * via `goToCalendarForSeance`, cf. AC2/AC3 Story 8.7). AD-4 révisé (Story 8.8) : une séance
 * épisodique peut désormais avoir à la fois un vote (`PollStatusPanel`/`PollResponseComponent`,
 * choisit *quand*) et une inscription à capacité limitée (choisit *qui*) — les deux coexistent.
 */
@Component({
  selector: 'app-seance-list',
  imports: [
    AppIcon,
    DurationStepper,
    MatButtonModule,
    PollStatusPanel,
    PollResponseComponent,
    FillIndicator,
    StatusBadge,
  ],
  templateUrl: './seance-list.html',
  styleUrl: './seance-list.scss',
})
export class SeanceList {
  private readonly scenarios = inject(ScenariosService);
  private readonly pollSvc = inject(PollService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeToneService);

  protected readonly currentUserId = computed(() => this.auth.currentUser()?.id);

  readonly scenario = input.required<ScenarioDto>();
  readonly partieId = input.required<string>();
  readonly isMj = input(false);
  readonly isEpisodique = input.required<boolean>();
  readonly members = input<PartieMemberDto[]>([]);

  readonly seanceLinked = output<ScenarioDto>();

  constructor() {
    // Story 19.1 (AC2) : réutilise le signal ScenariosService.changed déjà actif — SeanceList
    // n'ouvre AUCUNE connexion SSE propre, son parent (ScenarioEditor/ScenarioReadDialog,
    // toujours ouvert depuis ScenarioTimeline lui-même enfant de PartieDetail, Story 18.3)
    // maintient déjà la connexion partie:{id}. Réutilise refreshScenario() existante — pas de
    // nouvelle méthode.
    // Garde firstRun (même piège que partout ailleurs, cf. PartieDetail/CalendarView) : le signal
    // ScenariosService.changed peut déjà porter une valeur avant le montage — sans cette garde,
    // chaque SeanceList (une par séance affichée) déclenchait un refreshScenario() inutile dès sa
    // création, en plus de l'input `scenario` déjà à jour.
    let firstRun = true;
    effect(() => {
      this.scenarios.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      untracked(() => void this.refreshScenario());
    });

    // Story 36.5 (revue de code) : un rechargement externe (SSE sans rapport, poll d'un autre
    // joueur…) ne doit pas écraser une saisie MJ en cours dans les champs d'informations
    // pratiques — même patron de brouillon que ScenarioEditor.applyScenario() : seule une valeur
    // serveur EFFECTIVEMENT différente de la précédente remplace le brouillon local.
    effect(() => {
      const s = this.scenario();
      untracked(() => this.syncInfosDrafts(s));
    });
  }

  private previousScenarioSeances: readonly SeanceDto[] | null = null;
  protected readonly infosDrafts = signal<
    Record<string, { heureRdv: string; lieu: string; notePratique: string }>
  >({});

  /** Story 47.1 : durée saisie par séance (brouillon local, comme les informations pratiques). */
  protected readonly durationDrafts = signal<Record<string, number>>({});

  protected durationDraft(seanceId: string): number {
    return this.durationDrafts()[seanceId] ?? 1;
  }

  protected setDurationDraft(seanceId: string, value: number): void {
    this.durationDrafts.update((d) => ({ ...d, [seanceId]: value }));
  }

  /** Départ de la plage d'une séance datée, pour que le compteur l'écrive en clair. */
  protected durationStart(seance: SeanceDto): { date: string; slot: DaySlot } | null {
    return seance.dateValidee && seance.slotValidee
      ? { date: seance.dateValidee.substring(0, 10), slot: seance.slotValidee }
      : null;
  }

  /** Un vote ouvert sans date : sa durée se règle dans le composer de dates (Story 47.4), pas ici. */
  protected durationLocked(seance: SeanceDto): boolean {
    return seance.poll !== undefined && !seance.dateValidee;
  }

  private syncInfosDrafts(s: ScenarioDto): void {
    const previous = this.previousScenarioSeances;
    this.previousScenarioSeances = s.seances;
    const next = { ...this.infosDrafts() };
    const nextDurations = { ...this.durationDrafts() };
    let durationsTouched = false;
    let touched = false;
    for (const seance of s.seances) {
      const prevSeance = previous?.find((p) => p.id === seance.id);
      if (!prevSeance || prevSeance.durationSlots !== seance.durationSlots) {
        nextDurations[seance.id] = seance.durationSlots;
        durationsTouched = true;
      }
      const serverChanged =
        !prevSeance ||
        (prevSeance.heureRdv ?? '') !== (seance.heureRdv ?? '') ||
        (prevSeance.lieu ?? '') !== (seance.lieu ?? '') ||
        (prevSeance.notePratique ?? '') !== (seance.notePratique ?? '');
      if (serverChanged || !next[seance.id]) {
        next[seance.id] = {
          heureRdv: seance.heureRdv ?? '',
          lieu: seance.lieu ?? '',
          notePratique: seance.notePratique ?? '',
        };
        touched = true;
      }
    }
    if (touched) this.infosDrafts.set(next);
    if (durationsTouched) this.durationDrafts.set(nextDurations);
  }

  /** Valeur à afficher dans un champ d'informations pratiques : le brouillon local, jamais
   *  directement `seance.champ` (cf. `syncInfosDrafts`, garde anti-écrasement). */
  protected infoDraft(seanceId: string, field: 'heureRdv' | 'lieu' | 'notePratique'): string {
    return this.infosDrafts()[seanceId]?.[field] ?? '';
  }

  /** Non-null uniquement si `heureRdv` est renseignée mais ne respecte pas `HH:MM` — le widget
   *  natif `type="time"` l'afficherait vide sans distinction avec « jamais renseignée », et
   *  enregistrer sans y toucher effacerait silencieusement la valeur stockée. */
  protected malformedHeureRdv(seance: SeanceDto): string | null {
    const v = seance.heureRdv;
    return v && !HEURE_HH_MM.test(v) ? v : null;
  }

  protected readonly pollActionPending = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Séance dont le formulaire de capacité est rouvert pour édition (AC6, Story 8.7) — un seul à la
   *  fois. Pré-rempli avec les valeurs déjà définies, contrairement à la création initiale. */
  protected readonly editingCapacitySeanceId = signal<string | null>(null);

  readonly SLOT_LABELS = SLOT_LABELS;

  /**
   * Story 32.3 — jour courant figé à la CONSTRUCTION, une seule fois pour toute la liste.
   *
   * 🚨 Même raison que `CalendarView.todayKey` : si chaque badge relisait l'horloge, deux séances
   * rendues de part et d'autre de minuit ne compareraient plus au même « aujourd'hui », et
   * l'intensité d'imminence deviendrait incohérente d'une ligne à l'autre.
   */
  private readonly todayKey = toDateKey(new Date());

  /**
   * L'état affiché d'une séance — dérivé, jamais servi (AD-20 : aucun champ `status` sur
   * `SeanceDto`). Dépend du LECTEUR : un vote sans sa réponse appelle une action, le même vote
   * une fois répondu se contente d'informer.
   *
   * ⚠️ Ce badge ne remplace RIEN : l'indicateur de remplissage, le panneau de vote et le
   * compte-rendu restent exactement où ils étaient. Il les résume, il ne les supplante pas.
   */
  protected seanceBadge(seance: SeanceDto): StatusBadgeState {
    return seanceState(seance, this.currentUserId(), this.todayKey);
  }

  /**
   * Date effective de la séance, ou `null`.
   *
   * 🚨 La RACINE du DTO (story 32.3) prend le relais des deux sources historiques quand elles sont
   * vides : c'est exactement le cas d'une séance linéaire datée par héritage, sans vote ni
   * inscription, qui portait un badge « Programmée » avec aucune date à côté. Même résolution que
   * `seanceState()`, pour que le badge et le texte ne puissent pas se contredire.
   */
  protected resolvedDate(seance: SeanceDto): string | null {
    return seance.poll?.chosenDate ?? seance.dateValidee ?? seance.inscription?.dateValidee ?? null;
  }

  /** « Séance N » — l'index est 0-based côté gabarit, le libellé est 1-based. */
  protected seanceLabel(index: number): string {
    return fillTone(this.theme.tone()['common.seance_n'], { n: index + 1 });
  }

  /** « Date retenue : … » — la date, déjà mise en forme, s'insère dans le gabarit du thème. */
  protected dateRetenue(date: string): string {
    return fillTone(this.theme.tone()['common.date_retenue_date'], { date });
  }

  /** Avertissement affiché sous le champ Heure quand la valeur stockée est illisible (`raw`). */
  protected heureMalformedWarning(raw: string): string {
    return fillTone(this.theme.tone()['scenarios.seances_heure_malformed'], { raw });
  }

  /** Libellé « Date retenue ». Le créneau n'existe que sur un vote scellé, d'où les deux mises en
   *  forme — `formatChosenDate()` l'ajoute, `formatValidatedDate()` n'a rien à ajouter. */
  protected formatSeanceDate(seance: SeanceDto): string {
    // Story 47.3 : une plage de plusieurs créneaux s'écrit du départ à la fin.
    const startIso = this.resolvedDate(seance);
    if (startIso && seance.endDate) {
      const start = { date: startIso.substring(0, 10), slot: seance.poll?.chosenSlot ?? seance.slotValidee };
      const end = { date: seance.endDate.substring(0, 10), slot: seance.endSlot };
      if (isSpan(start, end)) return spanShortLabel(start, end);
    }
    return seance.poll?.chosenDate
      ? this.formatChosenDate(seance.poll)
      : this.formatValidatedDate(this.resolvedDate(seance)!);
  }

  // Story 8.7, AC2/AC3 : point d'entrée unique — envoie le MJ sur le calendrier (mode MJ) plutôt qu'un panneau
  // de création dupliqué ici. Story 8.8 : aussi utilisé pour l'épisodique.
  // ⚠️ Story 45.2 : `?seanceId` ARME le composer du calendrier pour cette séance (le panneau 8.7 n'existe plus),
  // par l'adresse de l'atelier construite par la fonction unique `atelierUrl`.
  protected goToCalendarForSeance(seanceId: string): void {
    void this.router.navigateByUrl(
      atelierUrl({ partieId: this.partieId(), family: 'jdr', role: 'mj' }, { seanceId }),
    );
  }

  protected openCapacityEdit(seanceId: string): void {
    this.editingCapacitySeanceId.set(seanceId);
  }

  protected cancelCapacityEdit(): void {
    this.editingCapacitySeanceId.set(null);
  }

  // 🚨 Revue de code (deferred-work.md, 2026-08-24) : PAS de confirmation ici. `PollStatusPanel`
  // (`app-poll-status`, seul émetteur de `chosen`) ouvre déjà son propre `ConfirmDialog` stylé
  // AVANT d'émettre l'événement (`poll-status.ts:onChooseClick`) — un `window.confirm()` ajouté
  // ici (décision du 2026-08-24, retirée) doublait le prompt : deux confirmations successives
  // pour le même scellement. Toujours confirmé, une seule fois, via le MatDialog déjà en place —
  // même mécanisme que `CalendarView.onSealRequested()` (Agenda/grille).
  protected async onChoose(pollId: string, optionId: string): Promise<void> {
    if (this.pollActionPending()) return;
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      await this.pollSvc.chooseDate(this.partieId(), pollId, { optionId });
      await this.refreshScenario();
    } catch {
      this.error.set(this.theme.tone()['scenarios.seances_choose_error']);
    } finally {
      this.pollActionPending.set(false);
    }
  }

  protected async onClosePoll(pollId: string): Promise<void> {
    if (this.pollActionPending()) return;
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      await this.pollSvc.closePoll(this.partieId(), pollId);
      await this.refreshScenario();
    } catch {
      this.error.set(this.theme.tone()['common.impossible_de_cloturer_le_vote_reessayez']);
    } finally {
      this.pollActionPending.set(false);
    }
  }

  protected onPollResponded(poll: SessionPollDto): void {
    this.seanceLinked.emit({
      ...this.scenario(),
      seances: this.scenario().seances.map((s) => (s.poll?.id === poll.id ? { ...s, poll } : s)),
    });
  }

  protected isInscrit(inscrits: { userId: string; pseudo: string }[]): boolean {
    const userId = this.currentUserId();
    return userId !== undefined && inscrits.some((i) => i.userId === userId);
  }

  /** Aucun état à mettre à jour — sert uniquement à déclencher un cycle de détection de
   *  changements zoneless sur `(input)`, pour que le bouton `[disabled]` (qui lit `minInput.value`/
   *  `maxInput.value` directement) reflète l'état courant des champs au fil de la saisie. */
  protected onCapacityFormInput(): void {
    // Volontairement vide : cf. commentaire ci-dessus. Le corps porte ce commentaire parce que
    // `no-empty-function` accepte une fonction dont le corps est commenté — et qu'il ne faut
    // surtout pas « réparer » ce no-op en lui inventant un effet.
  }

  protected async onSetCapacity(seanceId: string, min: number, max: number): Promise<void> {
    if (this.pollActionPending()) return;
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      const updated = await this.scenarios.setSeanceCapacity(seanceId, min, max);
      this.editingCapacitySeanceId.set(null);
      this.seanceLinked.emit(updated);
    } catch {
      this.error.set(this.theme.tone()['scenarios.seances_capacity_error']);
    } finally {
      this.pollActionPending.set(false);
    }
  }

  protected async onInscrire(seanceId: string): Promise<void> {
    if (this.pollActionPending()) return;
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      const updated = await this.scenarios.inscrire(seanceId);
      this.seanceLinked.emit(updated);
    } catch {
      this.error.set(this.theme.tone()['scenarios.seances_inscrire_error']);
    } finally {
      this.pollActionPending.set(false);
    }
  }

  protected async onDesinscrire(seanceId: string): Promise<void> {
    if (this.pollActionPending()) return;
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      const updated = await this.scenarios.desinscrire(seanceId);
      this.seanceLinked.emit(updated);
    } catch {
      this.error.set(this.theme.tone()['scenarios.seances_desinscrire_error']);
    } finally {
      this.pollActionPending.set(false);
    }
  }

  // Story 8.7, AC5 : la toute première séance d'un scénario ne peut jamais être supprimée (garde
  // déjà posée côté backend, `window.confirm` ici évite un clic accidentel destructeur). Revue de
  // code : confirmation renforcée quand une date a déjà été validée (roster/planning déjà figés) —
  // suppression autorisée (décision utilisateur), mais le MJ doit être prévenu explicitement.
  protected async onDeleteSeance(seance: SeanceDto): Promise<void> {
    if (this.pollActionPending()) return;
    const hasValidatedDate = this.resolvedDate(seance) !== null;
    const key = hasValidatedDate
      ? 'scenarios.seances_delete_confirm_dated'
      : 'scenarios.seances_delete_confirm';
    const message = this.theme.tone()[key];
    if (!window.confirm(message)) return;
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      const updated = await this.scenarios.deleteSeance(seance.id);
      this.seanceLinked.emit(updated);
    } catch {
      this.error.set(this.theme.tone()['scenarios.seances_delete_error']);
    } finally {
      this.pollActionPending.set(false);
    }
  }

  // Story 8.8, AC4 : détache le vote de la séance (et retire l'éventuelle dateValidee héritée)
  // pour permettre d'en relancer un nouveau — confirmation avant réinitialisation (action
  // destructive, même style que la suppression de séance à date validée, Story 8.7 revue).
  protected async onResetSeanceDate(seanceId: string): Promise<void> {
    if (this.pollActionPending()) return;
    if (!window.confirm(this.theme.tone()['scenarios.seances_reset_confirm'])) return;
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      const updated = await this.scenarios.resetSeanceDate(seanceId);
      this.seanceLinked.emit(updated);
    } catch {
      this.error.set(this.theme.tone()['scenarios.seances_reset_error']);
    } finally {
      this.pollActionPending.set(false);
    }
  }

  // AC1 : aucune restriction de kind — s'applique aux branches linéaire ET épisodique.
  /** Story 36.5 — les trois champs partent ensemble. Une valeur vide devient `null` : c'est ce
   *  qui distingue « effacé » de « jamais rempli », et c'est le seul moyen de vider un champ. */
  protected async onSetInfosPratiques(
    seanceId: string,
    heureRdv: string,
    lieu: string,
    notePratique: string,
  ): Promise<void> {
    if (this.pollActionPending()) return;
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      const current = this.scenario().seances.find((x) => x.id === seanceId);
      const updated = await this.scenarios.setInfosPratiques(seanceId, {
        heureRdv: heureRdv.trim() || null,
        lieu: lieu.trim() || null,
        notePratique: notePratique.trim() || null,
        // Story 47.1 : la durée ne part que si le compteur a bougé (absente = inchangée côté serveur) et
        // jamais sous un vote ouvert sans date.
        ...(current &&
        !this.durationLocked(current) &&
        this.durationDraft(seanceId) !== current.durationSlots
          ? { durationSlots: this.durationDraft(seanceId) }
          : {}),
      });
      this.seanceLinked.emit(updated);
    } catch (err) {
      // Story 47.1 : un refus du serveur sur la durée (déjà écrit en français) est montré tel quel.
      this.error.set(
        err instanceof HttpErrorResponse && typeof err.error?.message === 'string'
          ? err.error.message
          : this.theme.tone()['scenarios.seances_infos_error'],
      );
    } finally {
      this.pollActionPending.set(false);
    }
  }

  /** Lecture côté joueur — même composition que le calendrier (AC10), niveau complet. */
  protected seanceInfos(seance: SeanceDto): string {
    return composeSeanceInfo(
      {
        seanceHeure: seance.heureRdv,
        seanceLieu: seance.lieu,
        seanceNote: seance.notePratique,
      },
      'full',
    );
  }

  protected async onSetCompteRendu(seanceId: string, compteRendu: string): Promise<void> {
    if (this.pollActionPending()) return;
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      const updated = await this.scenarios.setCompteRendu(seanceId, compteRendu);
      this.seanceLinked.emit(updated);
    } catch {
      this.error.set(this.theme.tone()['scenarios.seances_compte_rendu_error']);
    } finally {
      this.pollActionPending.set(false);
    }
  }

  protected formatValidatedDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(iso));
  }

  protected formatChosenDate(poll: SessionPollDto): string {
    if (!poll.chosenDate) return '';
    const d = new Date(poll.chosenDate);
    const dateStr = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(d);
    return poll.chosenSlot ? `${dateStr} — ${SLOT_LABELS[poll.chosenSlot]}` : dateStr;
  }

  // Bug fix (revue de code) : ScenariosService.listAll() déduplique désormais les appels en vol par
  // partieId (cf. scenarios.service.ts, sans traçabilité de causalité) — sans ce compteur de
  // génération, une réponse encore en vol au moment d'une mutation locale (ex. suppression de
  // séance) pouvait se résoudre APRÈS coup et réappliquer un état périmé (la séance supprimée
  // réapparaissait), écrasant silencieusement l'état pourtant à jour. Même pattern que
  // PartieDetail.reloadAnnouncements()/ScenarioTimeline.loadScenarios() (reqId/génération).
  private refreshGeneration = 0;

  /** `chooseDate`/`closePoll` ne renvoient pas le poll mis à jour (void) — sans ce rechargement, la
   *  séance restait affichée comme un vote OPEN avec les boutons de choix encore actifs après une
   *  action pourtant bien traitée côté serveur. */
  private async refreshScenario(): Promise<void> {
    const generation = ++this.refreshGeneration;
    try {
      const fresh = (await this.scenarios.listAll(this.partieId())).find(
        (s) => s.id === this.scenario().id,
      );
      if (generation !== this.refreshGeneration) return; // réponse obsolète, une requête plus récente est en vol
      if (fresh) this.seanceLinked.emit(fresh);
    } catch {
      if (generation !== this.refreshGeneration) return;
      // Retry unique après un court délai — un échec transitoire (ex. throttling API en rafale
      // sur un fan-out temps réel) ne doit pas laisser l'affichage figé sur l'état périmé.
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const fresh = (await this.scenarios.listAll(this.partieId())).find(
          (s) => s.id === this.scenario().id,
        );
        if (generation !== this.refreshGeneration) return;
        if (fresh) this.seanceLinked.emit(fresh);
      } catch {
        if (generation !== this.refreshGeneration) return;
        this.error.set(this.theme.tone()['scenarios.seances_refresh_error']);
      }
    }
  }
}
