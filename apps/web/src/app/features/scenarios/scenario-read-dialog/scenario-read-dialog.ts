import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import type {
  AnnouncementDto,
  CharacterDto,
  CharacterNoteDto,
  PartieKind,
  ScenarioDto,
} from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { AuthService } from '../../../core/auth/auth.service';
import { ScenariosService, matchesPartie } from '../../../core/scenarios/scenarios.service';
import { CharacterService } from '../../../core/characters/character.service';
import { AnnouncementsService } from '../../../core/announcements/announcements.service';
import { UnseenAnnouncementsService } from '../../../core/announcements/unseen-announcements.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { ScenarioStatusBadge } from '../scenario-status-badge/scenario-status-badge';
import { CharacterSummaryCard } from '../../characters/character-summary-card/character-summary-card';
import { SeanceList } from '../seance-list/seance-list';
import { AnnonceCard } from '../../announcements/annonce-card/annonce-card';
import { IdentityLabel } from '../../../shared/identity/identity-label';
import { ambiguousUserIds } from '../../../shared/identity/identity-ambiguity.util';

export interface ScenarioReadDialogData {
  scenario: ScenarioDto;
  partieKind: PartieKind;
  characters: CharacterDto[];
  /**
   * Le viewer courant est le MJ de la Partie (Story 8.5) — seul cas où ce dialogue, normalement
   * strictement lecture seule, expose un CTA de navigation vers ScenarioEditor pour rédiger le
   * résumé de fin. Optionnel (défaut `false`) : seul `ScenarioTimeline` le renseigne aujourd'hui.
   */
  isMj?: boolean;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse && typeof err.error?.message === 'string') {
    return err.error.message;
  }
  return fallback;
}

/**
 * Fiche scénario joueur, strictement en lecture seule — jamais de FieldEditPencil/upload, quel que
 * soit le statut ou le rôle du viewer (contrainte plus stricte que ScenarioEditor, MJ-only, Story
 * 7.4, qui reste inchangé). Rendu conditionnel anti-spoil (AD-6) : A_VENIR n'affiche que le titre.
 */
@Component({
  selector: 'app-scenario-read-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    AppIcon,
    ScenarioStatusBadge,
    CharacterSummaryCard,
    SeanceList,
    AnnonceCard,
    IdentityLabel,
  ],
  templateUrl: './scenario-read-dialog.html',
  styleUrl: './scenario-read-dialog.scss',
})
export class ScenarioReadDialog implements OnInit {
  private readonly data = inject<ScenarioReadDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ScenarioReadDialog, void>>(MatDialogRef);
  private readonly scenarios = inject(ScenariosService);
  private readonly characterSvc = inject(CharacterService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly announcementsSvc = inject(AnnouncementsService);
  private readonly unseenAnnouncementsSvc = inject(UnseenAnnouncementsService);
  protected readonly theme = inject(ThemeToneService);
  protected readonly currentUserId = computed(() => this.auth.currentUser()?.id);
  protected readonly isMj = computed(() => this.data.isMj ?? false);

  protected readonly scenario = signal<ScenarioDto>(this.data.scenario);
  // Copie locale mutable de data.characters (Story 8.6) — mise à jour après
  // setJournalAutoAssociate() pour que le switch reflète le nouveau réglage sans rechargement.
  protected readonly characters = signal<CharacterDto[]>(this.data.characters);
  protected readonly ownCharacter = computed(() =>
    this.characters().find((c) => c.userId === this.currentUserId()),
  );
  protected readonly ownNotes = signal<CharacterNoteDto[]>([]);
  protected readonly journalError = signal<string | null>(null);
  // Garde défensive : BROUILLON ne devrait jamais atteindre ce dialogue (ScenarioTimeline le filtre
  // toujours en amont), mais si un futur appelant l'ouvrait quand même, il reste protégé comme
  // A_VENIR (titre seul) plutôt que de tomber dans la branche complète par défaut.
  protected readonly isRestricted = computed(() => {
    const status = this.scenario().status;
    return status === 'A_VENIR' || status === 'BROUILLON';
  });
  protected readonly isPasse = computed(() => this.scenario().status === 'PASSE');

  protected readonly isEpisodique = computed(() => this.data.partieKind === 'CAMPAGNE_EPISODIQUE');
  protected readonly isParticipating = computed(() =>
    (this.scenario().participants ?? []).some((p) => p.userId === this.currentUserId()),
  );

  // Story 9.2 (AC3) : un non-participant d'un scénario épisodique ne voit jamais ses annonces ;
  // le MJ et les scénarios non-épisodiques ne sont pas concernés par cette restriction.
  protected readonly announcements = signal<AnnouncementDto[]>([]);
  protected readonly scenarioAnnouncements = computed(() =>
    this.announcements().filter((a) => a.scenarioId === this.scenario().id),
  );
  protected readonly canSeeAnnouncements = computed(
    () => this.isMj() || !this.isEpisodique() || this.isParticipating(),
  );
  // Story 29.13 (révision) : le marquage « vue » se déclenche sur un clic explicite de l'utilisateur
  // sur AnnonceCard (opened()), plus au simple affichage — le template lui-même n'itère déjà que
  // sur les annonces effectivement affichées (`isRestricted()`/`canSeeAnnouncements()`, AC3/AC6).
  protected readonly unseenAnnouncementIds = computed(
    () => new Set(this.unseenAnnouncementsSvc.unseenAnnouncements().map((a) => a.id)),
  );
  protected readonly participantCharacters = computed(() => {
    const ids = new Set((this.scenario().participants ?? []).map((p) => p.userId));
    return this.characters().filter((c) => ids.has(c.userId));
  });
  // Un participant peut rejoindre une enquête avant d'avoir créé son personnage sur cette Partie —
  // sans ce fallback, cliquer « Participer » ne montre alors aucune confirmation visuelle (ni carte,
  // ni texte), ce qui donne l'impression que l'action n'a pas fonctionné.
  protected readonly participantsWithoutCharacter = computed(() => {
    const characterUserIds = new Set(this.characters().map((c) => c.userId));
    return (this.scenario().participants ?? []).filter((p) => !characterUserIds.has(p.userId));
  });
  protected readonly participantError = signal<string | null>(null);
  // AD-8 : signal `pending` local, même pattern que `SeanceList.pollActionPending`.
  protected readonly participatePending = signal(false);

  /** AC3 : distingue les participants homonymes par leur pseudo. */
  protected readonly ambiguousParticipants = computed(() =>
    ambiguousUserIds(this.scenario().participants ?? []),
  );

  protected isParticipantAmbiguous(userId: string): boolean {
    return this.ambiguousParticipants().has(userId);
  }

  constructor() {
    // Story 19.2 (AC1) : réagit au signal générique ScenariosService.changed (RealtimeService,
    // Story 19.1). ScenarioReadDialog n'est ouvert QUE via MatDialog.open() depuis ScenarioTimeline
    // (vérifié empiriquement), toujours enfant de PartieDetail qui maintient déjà sa propre
    // connexion SSE (Story 18.3) — ce dialogue réutilise ce signal sans ouvrir sa propre connexion
    // (même raisonnement que SeanceList, Story 19.1 Task 4). Garde `firstRun` : même piège que
    // ScenarioEditor (Task 1) — ngOnInit() a son propre fetch initial juste en dessous, la première
    // exécution de cet effect() (à la construction) doit être ignorée pour ne pas le doubler.
    let firstRun = true;
    effect(() => {
      const change = this.scenarios.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      if (!matchesPartie(change, this.data.scenario.partieId)) return;
      untracked(() => void this.refreshScenario());
    });
  }

  /** Story 29.13 (révision) : « j'ouvre l'annonce » = clic explicite sur AnnonceCard, plus le
   *  simple affichage. */
  protected markAnnouncementOpened(announcementId: string): void {
    void this.unseenAnnouncementsSvc.markRead(announcementId);
  }

  private async refreshScenario(): Promise<void> {
    try {
      const fresh = (await this.scenarios.listAll(this.data.scenario.partieId)).find(
        (s) => s.id === this.scenario().id,
      );
      if (fresh) {
        this.scenario.set(fresh);
        // FR2 : un message d'erreur périmé ne doit pas survivre à un rechargement effectif du
        // scénario — pas d'effacement si le rechargement échoue (cf. catch ci-dessous).
        this.participantError.set(null);
      }
    } catch {
      // non-bloquant — le scénario affiché reste tel quel si le rafraîchissement échoue
    }
  }

  // Le scénario reçu via MAT_DIALOG_DATA peut être un instantané mis en cache par l'appelant (ex.
  // ScenarioTimeline chargée avant qu'un vote lié à une séance ait été tranché via le calendrier, en
  // dehors de ce dialogue) — on recharge une version fraîche à l'ouverture plutôt que de faire
  // confiance à l'instantané pour la durée de vie du dialogue.
  async ngOnInit(): Promise<void> {
    await this.refreshScenario();

    const owner = this.ownCharacter();
    if (owner) {
      try {
        this.ownNotes.set(await this.characterSvc.getNotes(owner.id));
      } catch {
        this.journalError.set(this.theme.tone()['scenarios.read_journal_load_error']);
      }
    }

    try {
      this.announcements.set(await this.announcementsSvc.listAll(this.data.scenario.partieId));
    } catch {
      // Non-critique — la section annonces reste vide plutôt que de bloquer le dialogue.
    }
  }

  protected async participate(): Promise<void> {
    if (this.participatePending()) return;
    this.participatePending.set(true);
    this.participantError.set(null);
    try {
      this.scenario.set(await this.scenarios.participate(this.scenario().id));
    } catch (err) {
      this.participantError.set(
        extractErrorMessage(err, this.theme.tone()['scenarios.read_participate_error']),
      );
    } finally {
      this.participatePending.set(false);
    }
  }

  protected onSeanceLinked(updated: ScenarioDto): void {
    this.scenario.set(updated);
  }

  // Story 8.6 : réglage propriétaire-seul, par personnage (AC6) — aucun impact sur les notes déjà
  // associées manuellement (AC4), seulement sur le calcul de l'ensemble « auto » côté backend.
  protected async toggleAutoAssociate(value: boolean): Promise<void> {
    const owner = this.ownCharacter();
    if (!owner) return;
    this.journalError.set(null);
    try {
      const updated = await this.characterSvc.setJournalAutoAssociate(owner.id, value);
      this.characters.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      this.journalError.set(
        extractErrorMessage(err, this.theme.tone()['scenarios.read_setting_error']),
      );
    }
  }

  // Revue de code (2026-07-14) : une note associée mais non partagée (`shared: false`) n'apparaît
  // jamais dans `retrospectiveNotes` (le backend filtre désormais `shared: true` sur la branche
  // manuelle, cf. fix confidentialité) — plutôt qu'un filtrage muet qui laisserait le joueur
  // perplexe devant une note cochée mais invisible, le cadenas est actionnable directement ici,
  // sans aller-retour vers la fiche de personnage.
  protected async toggleShare(note: CharacterNoteDto): Promise<void> {
    const owner = this.ownCharacter();
    if (!owner) return;
    this.journalError.set(null);
    try {
      const updated = await this.characterSvc.toggleNoteShare(owner.id, note.id, !note.shared);
      this.ownNotes.update((list) => list.map((n) => (n.id === updated.id ? updated : n)));
    } catch (err) {
      this.journalError.set(
        extractErrorMessage(err, this.theme.tone()['scenarios.read_note_visibility_error']),
      );
    }
  }

  // Association manuelle indépendante du switch (AC2) — `checked` détermine si on pose
  // `scenario().id` ou `null` (désassociation) sur la note visée.
  protected async toggleNoteAssociation(note: CharacterNoteDto, checked: boolean): Promise<void> {
    const owner = this.ownCharacter();
    if (!owner) return;
    this.journalError.set(null);
    try {
      const updated = await this.characterSvc.setNoteScenario(
        owner.id,
        note.id,
        checked ? this.scenario().id : null,
      );
      this.ownNotes.update((list) => list.map((n) => (n.id === updated.id ? updated : n)));
    } catch (err) {
      this.journalError.set(
        extractErrorMessage(err, this.theme.tone()['scenarios.read_note_association_error']),
      );
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  /** Libellé du bouton MJ : « Modifier » si un résumé de fin existe déjà, « Rédiger » sinon. */
  protected resumeButtonLabel(): string {
    const key = this.scenario().resumeFin
      ? 'scenarios.read_resume_edit'
      : 'scenarios.read_resume_write';
    return this.theme.tone()[key];
  }

  /** Étiquette d'accessibilité du cadenas : l'état courant de la note (partagée ou privée). */
  protected noteShareLabel(shared: boolean): string {
    return this.theme.tone()[
      shared ? 'scenarios.read_note_shared_aria' : 'scenarios.read_note_private_aria'
    ];
  }

  // Story 8.5 : seul chemin de navigation MJ → ScenarioEditor pour un scénario PASSE (fix revue de
  // code — ScenarioTimeline route toujours PASSE vers ce dialogue en lecture seule, sans quoi le
  // panneau de rédaction du résumé de fin serait inatteignable en pratique).
  protected editResume(): void {
    const s = this.scenario();
    this.dialogRef.close();
    void this.router.navigate(['/parties', s.partieId, 'scenarios', s.id], {
      state: { scenario: s },
    });
  }
}
