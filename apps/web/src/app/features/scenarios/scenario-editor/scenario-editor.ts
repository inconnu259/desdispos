import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AppIcon } from '../../../core/icons/app-icon';
import type {
  AnnouncementDto,
  CharacterDto,
  PartieMemberDto,
  ScenarioDocumentDto,
  ScenarioDto,
  UpdateScenarioDto,
} from '@master-jdr/shared';
import { ScenariosService, matchesPartie } from '../../../core/scenarios/scenarios.service';
import { CharacterService } from '../../../core/characters/character.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { AnnouncementsService } from '../../../core/announcements/announcements.service';
import { UnseenAnnouncementsService } from '../../../core/announcements/unseen-announcements.service';
import { scrollToAnnouncement } from '../../../core/announcements/scroll-to-announcement.util';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { RealtimeService, partieTopic } from '../../../core/realtime/realtime.service';
import { FieldEditPencil } from '../../characters/character-sheet/field-edit-pencil/field-edit-pencil';
import { CharacterSummaryCard } from '../../characters/character-summary-card/character-summary-card';
import { DurationStepper } from '../../../shared/duration-stepper/duration-stepper';
import { ScenarioStatusBadge } from '../scenario-status-badge/scenario-status-badge';
import { SeanceList } from '../seance-list/seance-list';
import { AnnonceCard } from '../../announcements/annonce-card/annonce-card';
import { IdentityLabel } from '../../../shared/identity/identity-label';
import { ambiguousUserIds } from '../../../shared/identity/identity-ambiguity.util';

type ScenarioTextField = keyof UpdateScenarioDto;

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse && typeof err.error?.message === 'string') {
    return err.error.message;
  }
  return fallback;
}

/**
 * Édition + documents d'un scénario — extrait de `ScenarioDetail` pour être réutilisable à la fois
 * par la page routée (campagne, scénario reçu via l'état de navigation) et par l'onglet ONE_SHOT
 * (scénario reçu directement de `listDrafts()`, sans navigation). Reçoit le `ScenarioDto` en input
 * plutôt que de le résoudre lui-même.
 */
@Component({
  selector: 'app-scenario-editor',
  imports: [
    DurationStepper,
    MatButtonModule,
    AppIcon,
    FieldEditPencil,
    ScenarioStatusBadge,
    CharacterSummaryCard,
    SeanceList,
    AnnonceCard,
    IdentityLabel,
  ],
  templateUrl: './scenario-editor.html',
  styleUrl: './scenario-editor.scss',
})
export class ScenarioEditor implements OnInit {
  private readonly scenarios = inject(ScenariosService);
  private readonly characterService = inject(CharacterService);
  private readonly partiesService = inject(PartiesService);
  private readonly announcementsService = inject(AnnouncementsService);
  private readonly unseenAnnouncementsSvc = inject(UnseenAnnouncementsService);
  protected readonly theme = inject(ThemeToneService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  // L'alias est nécessaire, pas une négligence : le nom `scenario` est déjà pris par le signal
  // local mutable déclaré plus bas (copie de travail rafraîchie par le temps réel). L'API
  // publique du composant reste `[scenario]`, l'entrée brute s'appelle `scenarioInput`.
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly scenarioInput = input.required<ScenarioDto>({ alias: 'scenario' });

  // Requêtes par nom de ref plutôt que refs de template croisant les blocs `@if` (les pencils
  // sont déclarés dans des blocs conditionnels distincts de ceux qui masquent l'affichage
  // statique — viewChild() résout indépendamment de l'imbrication, contrairement à une variable
  // de template référencée hors de son bloc de déclaration, revue de code).
  protected readonly titlePencil = viewChild<FieldEditPencil>('titlePencil');
  protected readonly dureeHeuresPencil = viewChild<FieldEditPencil>('dureeHeuresPencil');
  protected readonly dureeSeancesPencil = viewChild<FieldEditPencil>('dureeSeancesPencil');

  protected readonly scenario = signal<ScenarioDto | null>(null);
  protected readonly documents = signal<ScenarioDocumentDto[]>([]);
  protected readonly documentsError = signal<string | null>(null);
  protected readonly participantsLoadError = signal<string | null>(null);

  protected readonly isReadOnly = computed(() => this.scenario()?.status === 'PASSE');

  protected readonly ownDocuments = computed(() =>
    this.documents().filter((d) => d.scenarioId !== null),
  );
  protected readonly libraryDocuments = computed(() =>
    this.documents().filter((d) => d.scenarioId === null),
  );

  protected readonly descriptionDraft = signal('');
  protected readonly resumeFinDraft = signal('');
  protected readonly resumeFinError = signal<string | null>(null);
  protected readonly fieldEditError = signal<string | null>(null);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly downloadError = signal<string | null>(null);
  protected readonly markCourantError = signal<string | null>(null);
  protected readonly closeError = signal<string | null>(null);
  protected readonly addSeanceError = signal<string | null>(null);
  // AD-8 : un signal `pending` local par méthode de mutation (jamais partagé entre CTA
  // indépendants — cf. revue de code Story 12.2 sur ce même piège dans PartieDetail).
  // `onFieldConfirm()`/`submitDescription()` éditent chacun un champ indépendant (titre,
  // dureeHeures, dureeSeances, description) : un `pendingFields` par champ (pas un booléen
  // unique) évite qu'éditer un champ bloque silencieusement l'édition d'un autre (revue de code
  // Story 13.1 — un simple booléen partagé faisait disparaître la modification d'un champ sans
  // aucun feedback si un autre champ était déjà en cours d'envoi).
  protected readonly pendingFields = signal<ReadonlySet<ScenarioTextField>>(new Set());
  protected readonly uploadPending = signal(false);
  protected readonly downloadPending = signal(false);
  protected readonly markCourantPending = signal(false);
  protected readonly closePending = signal(false);
  protected readonly addSeancePending = signal(false);
  /** Story 47.1 : durée de la séance à ajouter, en créneaux enchaînés. */
  protected readonly newSeanceDuration = signal(1);
  protected readonly resumeFinPending = signal(false);
  protected readonly members = signal<PartieMemberDto[]>([]);
  // Story 9.2 : vue MJ — aucun filtrage de statut (le MJ ne peut pas se spoiler son propre contenu,
  // AC6 protège les joueurs, pas l'auteur).
  protected readonly announcements = signal<AnnouncementDto[]>([]);
  protected readonly scenarioAnnouncements = computed(() =>
    this.announcements().filter((a) => a.scenarioId === this.scenario()?.id),
  );
  // Story 29.13 (révision) : le marquage « vue » se déclenche sur un clic explicite de l'utilisateur
  // sur AnnonceCard (opened()), plus au simple affichage.
  protected readonly unseenAnnouncementIds = computed(
    () => new Set(this.unseenAnnouncementsSvc.unseenAnnouncements().map((a) => a.id)),
  );
  // Story 29.13 (révision) : id transmis en query param par le bandeau du Shell — consommé une
  // seule fois dès que l'annonce apparaît dans scenarioAnnouncements() (cf. effect() au constructeur).
  private pendingScrollAnnouncementId = this.route.snapshot.queryParamMap.get('announcementId');

  // AD-4 : `participants` n'est renvoyé par le backend que pour CAMPAGNE_EPISODIQUE (toujours
  // `undefined` sinon) — sa seule présence sert de signal fiable, sans avoir à threader `partieKind`
  // jusqu'ici (cette page routée n'a pas accès au signal `characters` de `partie-detail`).
  protected readonly isEpisodique = computed(() => this.scenario()?.participants !== undefined);
  protected readonly characters = signal<CharacterDto[]>([]);
  protected readonly participantCharacters = computed(() => {
    const ids = new Set((this.scenario()?.participants ?? []).map((p) => p.userId));
    return this.characters().filter((c) => ids.has(c.userId));
  });
  // Un participant peut rejoindre une enquête avant d'avoir créé son personnage sur cette Partie —
  // sans ce fallback, la section resterait vide pour lui malgré une participation bien enregistrée.
  protected readonly participantsWithoutCharacter = computed(() => {
    const characterUserIds = new Set(this.characters().map((c) => c.userId));
    return (this.scenario()?.participants ?? []).filter((p) => !characterUserIds.has(p.userId));
  });

  /** AC3 : distingue les participants homonymes par leur pseudo. */
  protected readonly ambiguousParticipants = computed(() =>
    ambiguousUserIds(this.scenario()?.participants ?? []),
  );

  protected isParticipantAmbiguous(userId: string): boolean {
    return this.ambiguousParticipants().has(userId);
  }

  constructor() {
    effect(() => {
      const s = this.scenarioInput();
      this.applyScenario(s);
      // FR2 : un message d'erreur périmé ne doit pas survivre à un changement du scénario reçu
      // en entrée (équivalent au « remontage » pour ce composant qui n'est jamais réellement
      // démonté tant que la page reste ouverte).
      this.markCourantError.set(null);
      this.closeError.set(null);
      this.addSeanceError.set(null);
      this.fieldEditError.set(null);
      this.uploadError.set(null);
      this.downloadError.set(null);
      this.resumeFinError.set(null);
    });

    // Story 19.2 (AC1) : réagit au signal générique ScenariosService.changed (RealtimeService,
    // Story 19.1). PIÈGE SPÉCIFIQUE à ce composant (contrairement à SeanceList, Story 19.1 Task 4,
    // qui n'a AUCUN autre chemin de chargement) : ScenarioEditor a DÉJÀ un chargement dédié dans
    // ngOnInit() (fresh fetch au montage). La première exécution d'un effect() a lieu à la
    // CONSTRUCTION du composant — si `changed()` porte déjà une valeur correspondant à cette Partie
    // (mutation locale antérieure dans la même session applicative, très plausible : ScenariosService
    // est `providedIn: 'root'`, son signal `_changed` persiste tant que l'onglet reste ouvert), cette
    // première exécution déclencherait un refetch REDONDANT avec celui que ngOnInit() fait juste
    // après. Le flag `firstRun` neutralise uniquement cette toute première exécution ; toute
    // ré-exécution ultérieure (un `.set()` réel sur le signal, jamais silencieux même à valeur
    // apparemment égale) reste traitée normalement.
    let firstRun = true;
    effect(() => {
      const change = this.scenarios.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      const partieId = untracked(() => this.scenarioInput().partieId);
      if (!matchesPartie(change, partieId)) return;
      untracked(() => void this.refreshScenario());
    });

    // Story 29.13 (révision du 2026-08-13, retour utilisateur) : clic sur le bandeau du Shell —
    // défile jusqu'à l'annonce visée dès qu'elle apparaît dans scenarioAnnouncements().
    effect(() => {
      const id = this.pendingScrollAnnouncementId;
      if (!id) return;
      const found = this.scenarioAnnouncements().some((a) => a.id === id);
      if (!found) return;
      untracked(() => {
        this.pendingScrollAnnouncementId = null;
        scrollToAnnouncement(id);
      });
    });
  }

  /** Story 29.13 (révision) : « j'ouvre l'annonce » = clic explicite sur AnnonceCard, plus le
   *  simple affichage. */
  protected markAnnouncementOpened(announcementId: string): void {
    void this.unseenAnnouncementsSvc.markRead(announcementId);
  }

  private applyScenario(s: ScenarioDto): void {
    // FR5 : capturer l'état précédent AVANT de l'écraser — inverser l'ordre lirait toujours la
    // valeur qu'on vient d'écrire, désactivant silencieusement toute la logique ci-dessous.
    // `untracked` évite de faire dépendre cet effect() de `this.scenario` (qu'il écrit lui-même
    // juste après), ce qui créerait une boucle de ré-exécution.
    const previous = untracked(() => this.scenario());
    this.scenario.set(s);
    // Un champ en cours de saisie ne doit pas être écrasé par un rechargement externe qui ne le
    // touche pas — seule une valeur serveur effectivement différente remplace le brouillon local.
    if (!previous || (previous.description ?? '') !== (s.description ?? '')) {
      this.descriptionDraft.set(s.description ?? '');
    }
    if (!previous || (previous.resumeFin ?? '') !== (s.resumeFin ?? '')) {
      this.resumeFinDraft.set(s.resumeFin ?? '');
    }
  }

  // Utilisée UNIQUEMENT par le second effect() ci-dessus (déclenchement temps réel) — PAS par le
  // fetch initial de ngOnInit(), qui reste un `.set()` direct ciblé par scenarioInput().id : à
  // l'instant où ngOnInit() s'exécute, l'effect() du constructeur qui peuple this.scenario() n'a
  // pas nécessairement encore flush (les effects Angular ne s'exécutent pas synchronément à la
  // construction du composant) — un garde `if (!current) return` y sauterait silencieusement le
  // chargement initial. Cette méthode est sûre ici car un événement temps réel ne peut survenir
  // qu'après le montage complet du composant, quand this.scenario() est déjà garanti non-null.
  private async refreshScenario(): Promise<void> {
    const current = this.scenario();
    if (!current) return;
    try {
      const fresh = (await this.scenarios.listAll(this.scenarioInput().partieId)).find(
        (s) => s.id === current.id,
      );
      if (fresh) this.applyScenario(fresh);
    } catch {
      // non-bloquant — le scénario affiché reste tel quel si le rafraîchissement échoue
    }
  }

  async ngOnInit(): Promise<void> {
    const partieId = this.scenarioInput().partieId;
    this.realtime.connect(partieTopic(partieId));
    this.destroyRef.onDestroy(() => this.realtime.disconnect(partieTopic(partieId)));

    // Le scénario reçu en input peut être un instantané mis en cache par l'appelant (ex. une
    // ScenarioTimeline chargée avant qu'un vote lié à une séance ait été tranché via le calendrier,
    // en dehors de cette page) — on recharge une version fraîche au montage plutôt que de faire
    // confiance à l'input pour la durée de vie du composant. Ne passe volontairement PAS par
    // applyScenario()/refreshScenario() (piège de timing, cf. commentaire de refreshScenario()).
    try {
      const fresh = (await this.scenarios.listAll(this.scenarioInput().partieId)).find(
        (s) => s.id === this.scenarioInput().id,
      );
      if (fresh) this.scenario.set(fresh);
    } catch {
      // Le scénario reçu en input reste affiché tel quel si le rafraîchissement échoue.
    }
    try {
      this.documents.set(await this.scenarios.listDocuments(this.scenarioInput().id));
    } catch {
      this.documentsError.set(this.theme.tone()['scenarios.editor_documents_load_error']);
    }
    try {
      this.characters.set(await this.characterService.listByPartie(this.scenarioInput().partieId));
    } catch {
      this.participantsLoadError.set(this.theme.tone()['scenarios.editor_participants_load_error']);
    }
    try {
      this.members.set(await this.partiesService.members(this.scenarioInput().partieId));
    } catch {
      // Liste MJ pour PollStatusPanel (relance de vote) — non-critique, même dégradation silencieuse.
    }
    try {
      this.announcements.set(
        await this.announcementsService.listAll(this.scenarioInput().partieId),
      );
    } catch {
      // Non-critique — la section annonces reste vide plutôt que de bloquer la page.
    }
  }

  protected fieldPending(field: ScenarioTextField): boolean {
    return this.pendingFields().has(field);
  }

  private setFieldPending(field: ScenarioTextField, pending: boolean): void {
    this.pendingFields.update((fields) => {
      const next = new Set(fields);
      if (pending) next.add(field);
      else next.delete(field);
      return next;
    });
  }

  protected async onFieldConfirm(field: ScenarioTextField, value: string | number): Promise<void> {
    const s = this.scenario();
    if (!s || this.isReadOnly() || this.fieldPending(field)) return;
    this.setFieldPending(field, true);
    this.fieldEditError.set(null);
    try {
      this.scenario.set(await this.scenarios.update(s.id, { [field]: value }));
    } catch (err) {
      this.fieldEditError.set(
        extractErrorMessage(
          err,
          this.theme.tone()['common.impossible_d_enregistrer_la_modification'],
        ),
      );
    } finally {
      this.setFieldPending(field, false);
    }
  }

  protected async submitDescription(): Promise<void> {
    const s = this.scenario();
    if (!s || this.isReadOnly() || this.fieldPending('description')) return;
    this.setFieldPending('description', true);
    this.fieldEditError.set(null);
    try {
      this.scenario.set(
        await this.scenarios.update(s.id, { description: this.descriptionDraft() }),
      );
    } catch (err) {
      this.fieldEditError.set(
        extractErrorMessage(
          err,
          this.theme.tone()['common.impossible_d_enregistrer_la_modification'],
        ),
      );
    } finally {
      this.setFieldPending('description', false);
    }
  }

  protected async onScenarioFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.isReadOnly()) return;
    const s = this.scenario();
    if (!s) return;
    await this.upload(file, s.partieId, s.id);
  }

  protected async onLibraryFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const s = this.scenario();
    if (!s) return;
    await this.upload(file, s.partieId, undefined);
  }

  private async upload(
    file: File,
    partieId: string,
    scenarioId: string | undefined,
  ): Promise<void> {
    if (this.uploadPending()) return;
    this.uploadPending.set(true);
    this.uploadError.set(null);
    try {
      await this.scenarios.uploadDocument(partieId, file, scenarioId);
      const s = this.scenario();
      if (s) this.documents.set(await this.scenarios.listDocuments(s.id));
    } catch (err) {
      this.uploadError.set(
        extractErrorMessage(err, this.theme.tone()['scenarios.editor_upload_error']),
      );
    } finally {
      this.uploadPending.set(false);
    }
  }

  protected async markCourant(): Promise<void> {
    const s = this.scenario();
    if (!s || s.status !== 'A_VENIR' || this.markCourantPending()) return;
    this.markCourantPending.set(true);
    this.markCourantError.set(null);
    try {
      this.scenario.set(await this.scenarios.markCourant(s.id));
    } catch (err) {
      this.markCourantError.set(
        extractErrorMessage(err, this.theme.tone()['scenarios.editor_mark_courant_error']),
      );
    } finally {
      this.markCourantPending.set(false);
    }
  }

  protected async close(): Promise<void> {
    const s = this.scenario();
    if (!s || s.status !== 'COURANT' || this.closePending()) return;
    this.closePending.set(true);
    this.closeError.set(null);
    try {
      this.scenario.set(await this.scenarios.close(s.id));
    } catch (err) {
      this.closeError.set(
        extractErrorMessage(err, this.theme.tone()['scenarios.editor_close_error']),
      );
    } finally {
      this.closePending.set(false);
    }
  }

  protected async addSeance(): Promise<void> {
    const s = this.scenario();
    if (!s || this.addSeancePending()) return;
    this.addSeancePending.set(true);
    this.addSeanceError.set(null);
    try {
      this.scenario.set(await this.scenarios.addSeance(s.id, this.newSeanceDuration()));
      this.newSeanceDuration.set(1);
    } catch (err) {
      this.addSeanceError.set(
        extractErrorMessage(err, this.theme.tone()['scenarios.editor_add_seance_error']),
      );
    } finally {
      this.addSeancePending.set(false);
    }
  }

  protected async submitResumeFin(): Promise<void> {
    const s = this.scenario();
    if (!s || this.resumeFinPending()) return;
    this.resumeFinPending.set(true);
    this.resumeFinError.set(null);
    try {
      this.scenario.set(await this.scenarios.setResumeFin(s.id, this.resumeFinDraft()));
    } catch (err) {
      this.resumeFinError.set(
        extractErrorMessage(err, this.theme.tone()['scenarios.editor_resume_save_error']),
      );
    } finally {
      this.resumeFinPending.set(false);
    }
  }

  protected onSeanceLinked(updated: ScenarioDto): void {
    this.scenario.set(updated);
  }

  protected async downloadDocument(doc: ScenarioDocumentDto): Promise<void> {
    if (this.downloadPending()) return;
    this.downloadPending.set(true);
    this.downloadError.set(null);
    try {
      const blob = await this.scenarios.downloadDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.originalName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      this.downloadError.set(
        extractErrorMessage(err, this.theme.tone()['scenarios.editor_download_error']),
      );
    } finally {
      this.downloadPending.set(false);
    }
  }
}
