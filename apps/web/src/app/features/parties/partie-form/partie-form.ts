import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import {
  GAME_SYSTEMS,
  checkPartieKindTransition,
  familyOf,
  isOpenForCreation,
  kindsOf,
} from '@master-jdr/shared';
import type { PartieKind, PartieKindTransitionRefusal, ScenarioDto } from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { PartiesService } from '../../../core/parties/parties.service';
import { MyPartiesService } from '../../../core/my-parties/my-parties.service';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { PartyBanner } from '../../../shared/party-banner/party-banner';

type FormKind = PartieKind;

/** Types proposés, dans l'ordre d'affichage. Source unique du gabarit de sélection. */
const KIND_OPTIONS: readonly FormKind[] = [
  'ONE_SHOT',
  'CAMPAGNE_LINEAIRE',
  'CAMPAGNE_EPISODIQUE',
] as const;

/** Mode de création (Story 38.2) : une quête de JDR ou un ralliement. Dérivé de la famille du
 *  système (`familyOf`), jamais stocké ; choisi à la création, définitif ensuite. */
type FormMode = 'quest' | 'ralliement';

/** Identifiant du système du mode ralliement (entrée unique du registre pour cette famille). */
const RALLIEMENT_SYSTEM_ID = 'ralliement';

/** Modes proposés par la bascule : ralliement à gauche, quête à droite (planche validée). */
const MODE_OPTIONS: readonly FormMode[] = ['ralliement', 'quest'] as const;

/** Formats acceptés par le contrôleur de couverture (`party-cover.controller.ts`). */
const ACCEPTED_COVER_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

/** Forme minimale consommée par le `<mat-select>` — `string` plutôt que `GameSystemId` pour rester
 *  compatible avec une entrée synthétique (`systems`, cas d'un id persisté inconnu de `GAME_SYSTEMS`,
 *  revue de code). */
interface GameSystemOption {
  id: string;
  name: string;
}

/**
 * Systèmes de JDR ouverts à la création (le ralliement a son propre mode, Story 38.2), repliés sur
 * le premier système de la liste si aucun ne l'est
 * (état transitoire uniquement, `GAME_SYSTEMS` n'est jamais vide). Source UNIQUE de cette règle —
 * revue de code (Story 29.17) : `DEFAULT_GAME_SYSTEM_ID` et le repli de `systems` la
 * réimplémentaient chacun indépendamment, synchronisés seulement par un commentaire manuel. Lit
 * `isOpenForCreation()` (Story 37.5, registre ; jamais un champ du registre directement) pour
 * rester la même source de vérité que l'API (`PartiesService.create()`/`update()`).
 */
const OPEN_GAME_SYSTEMS: readonly GameSystemOption[] = (() => {
  const eligible = GAME_SYSTEMS.filter((s) => familyOf(s.id) === 'jdr' && isOpenForCreation(s.id));
  return eligible.length > 0 ? eligible : [GAME_SYSTEMS[0]];
})();

/** Défaut du formulaire de création (Story 29.17) : le premier système ouvert à la création.
 *  `string`, pas `GameSystemId` — le contrôle réactif reste au même type que
 *  `PartieDto.gameSystemId` côté serveur (revue de code, cf. `savedGameSystemId`). */
const DEFAULT_GAME_SYSTEM_ID: string = OPEN_GAME_SYSTEMS[0].id;

/**
 * Plafond de dépôt appliqué AVANT tout envoi réseau (Story 29.14, AC14).
 *
 * TROISIÈME déclaration des 5 Mo, après `party-cover.controller.ts` et
 * `characters.controller.ts` — la Story 29.12 a acté que la valeur n'est pas factorisable côté
 * serveur (elle vit dans des décorateurs, qui ne peuvent pas lire une constante importée). Celle-ci
 * ne doit JAMAIS être plus permissive que celle du serveur : elle épargne un aller-retour réseau,
 * elle ne remplace pas la garde serveur.
 */
const MAX_COVER_SIZE = 5 * 1024 * 1024;

/** Ce qui s'affiche à la place du formulaire quand une conversion réclame un arbitrage. */
interface CourantChoice {
  kind: FormKind;
  scenarios: ScenarioDto[];
}

@Component({
  selector: 'app-partie-form',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatProgressBarModule,
    MatRadioModule,
    AppIcon,
    PartyBanner,
  ],
  templateUrl: './partie-form.html',
  styleUrl: './partie-form.scss',
})
export class PartieForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parties = inject(PartiesService);
  private readonly myPartiesSvc = inject(MyPartiesService);
  private readonly scenarios = inject(ScenariosService);
  private readonly contextualNav = inject(ContextualNavService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly theme = inject(ThemeToneService);
  protected readonly modeOptions = MODE_OPTIONS;
  protected readonly editId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Nom courant de la partie (édition) — sert uniquement au monogramme de repli de
   *  `PartyBanner` (Story 29.12), jamais persisté ici (le nom se sauvegarde via `submit()`). */
  protected readonly partieName = signal('');
  /** `null` = bannière générée (Story 29.12, AC1/AC3) — dépôt/retrait vivent hors du
   *  formulaire réactif : ce n'est pas un champ enregistré par `submit()`. */
  protected readonly coverImageVersion = signal<string | null>(null);
  protected readonly coverSaving = signal(false);
  protected readonly coverError = signal<string | null>(null);

  /** Création uniquement (Story 29.14, AC12) : le fichier est retenu jusqu'à ce que la partie
   *  existe, puisqu'un dépôt a besoin d'un identifiant à cibler. */
  protected readonly pendingCoverFile = signal<File | null>(null);
  protected readonly pendingCoverPreview = signal<string | null>(null);
  /** Une image personnelle existe (couverture enregistrée ou fichier en attente) : la puce
   *  « Retirer » n'apparaît alors qu'à côté de « Changer » (Story 38.3). */
  protected readonly hasPersonalCover = computed(
    () => !!this.coverImageVersion() || !!this.pendingCoverFile(),
  );
  /** Puces et champ fichier verrouillés pendant un dépôt ou l'envoi du formulaire : en création,
   *  changer le fichier en attente au milieu de `submit()` désynchroniserait aperçu et envoi. */
  protected readonly coverLocked = computed(() => this.coverSaving() || this.saving());

  constructor() {
    // Bandeau contextuel (patron Story 29.4) — le titre ne vit plus dans la carte, qui le répétait
    // (leçon de la Story 29.5). Story 38.4 : il suit le mode — bascule à la création, famille de la
    // partie à l'édition (variantes « ralliement » du registre de textes, sans mot de quête). À
    // l'édition, le sous-titre est le nom de la partie.
    effect(() => {
      const tone = this.theme.tone();
      const ralliement = this.isRalliement();
      const editing = this.editId() !== null;
      // À l'édition, la famille n'est connue qu'une fois la partie chargée (`savedKind` posé en même
      // temps que le mode) : avant cela, aucun titre — il montrerait des mots de quête à tort.
      if (editing && this.savedKind() === null) return;
      this.contextualNav.set({
        title: editing
          ? tone[ralliement ? 'partie.ralliement_edit_title' : 'partie.edit_title']
          : tone[ralliement ? 'partie.ralliement_new_title' : 'partie.new_title'],
        subtitle: editing ? this.partieName() || null : null,
      });
    });
    // Une URL de blob ne se révoque jamais toute seule : sans cela, quitter la page (navigation,
    // annulation) avec un fichier en attente la ferait fuir.
    inject(DestroyRef).onDestroy(() => this.clearPendingCover());
  }

  /** Mode courant (Story 38.2). Création : choisi par la bascule (quête par défaut). Édition :
   *  imposé par la famille de la partie, la bascule n'existe pas. */
  protected readonly mode = signal<FormMode>('quest');
  protected readonly isRalliement = computed(() => this.mode() === 'ralliement');
  /** Dernier livre de règles choisi en mode quête, restauré au retour sur ce mode. */
  private lastQuestSystemId = DEFAULT_GAME_SYSTEM_ID;

  /** Types proposés dans le mode courant, dans l'ordre d'affichage : tous ceux du JDR, ou ceux que
   *  le registre déclare pour le ralliement (`kindsOf`, source unique). */
  protected readonly kindChoices = computed<readonly FormKind[]>(() =>
    this.isRalliement()
      ? KIND_OPTIONS.filter((k) => kindsOf(RALLIEMENT_SYSTEM_ID).includes(k))
      : KIND_OPTIONS,
  );

  /** Type de la partie tel qu'enregistré (édition) — référence pour savoir si le MJ demande une
   *  conversion, et pour évaluer la matrice. */
  private readonly savedKind = signal<FormKind | null>(null);
  /** Système de jeu tel qu'enregistré (édition) — `null` en création. Type `string`, pas
   *  `GameSystemId` (revue de code) : `PartieDto.gameSystemId` est lui-même un `string` côté
   *  serveur, un cast non vérifié ici n'aurait fait que déplacer le problème sans le résoudre — la
   *  valeur peut en théorie ne correspondre à aucun `GAME_SYSTEMS` connu (ex. décalage frontend/
   *  données), cas géré explicitement par `systems` ci-dessous plutôt qu'ignoré par le typage.
   *  Permet de garder ce système visible/sélectionnable dans `systems` même fermé à la création
   *  (Story 29.17) : aucune migration, aucune perte de valeur pour une partie déjà créée dessus. */
  private readonly savedGameSystemId = signal<string | null>(null);
  private readonly partieClosed = signal(false);
  private readonly partieScenarios = signal<ScenarioDto[]>([]);
  protected readonly courantChoice = signal<CourantChoice | null>(null);
  protected readonly chosenCourantId = signal<string | null>(null);

  /**
   * Systèmes proposés au choix (Story 29.17, AC1) : ceux de `OPEN_GAME_SYSTEMS`, plus le système
   * déjà enregistré de la partie en édition — même fermé à la création — pour qu'il reste
   * visible/sélectionnable au chargement (aucun AUTRE système fermé ne devient choisissable).
   * `isOpenForCreation()` (Story 37.5, registre) reste l'unique source de vérité de l'éligibilité ;
   * le repli « aucun système n'est ouvert » est partagé avec `DEFAULT_GAME_SYSTEM_ID` via
   * `OPEN_GAME_SYSTEMS` (revue de code, plus de double implémentation à synchroniser à la main).
   *
   * Repli défensif (revue de code) : si `saved` ne correspond à AUCUN `GAME_SYSTEMS` connu (décalage
   * frontend/données, jamais atteint aujourd'hui — `@IsIn` cadre déjà `gameSystemId` côté API), une
   * entrée minimale synthétique est ajoutée plutôt que de le faire disparaître silencieusement du
   * menu pendant que le formulaire le présélectionne quand même.
   */
  protected readonly systems = computed<readonly GameSystemOption[]>(() => {
    const saved = this.savedGameSystemId();
    if (saved === null || OPEN_GAME_SYSTEMS.some((s) => s.id === saved)) {
      return OPEN_GAME_SYSTEMS;
    }
    const savedEntry: GameSystemOption | undefined = GAME_SYSTEMS.find((s) => s.id === saved);
    return [...OPEN_GAME_SYSTEMS, savedEntry ?? { id: saved, name: saved }];
  });

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    gameSystemId: [DEFAULT_GAME_SYSTEM_ID, [Validators.required]],
    kind: ['ONE_SHOT' as FormKind, [Validators.required]],
    description: [''],
  });

  /**
   * Verdicts de la matrice pour les trois types, à l'état actuel de la partie (AC11).
   *
   * Consomme exactement la même fonction que la garde serveur — le formulaire est l'écho, jamais
   * une seconde table de règles (Règle B). En création, tout est atteignable.
   */
  protected readonly kindAvailability = computed(() => {
    const from = this.savedKind();
    const state = {
      scenarioCount: this.partieScenarios().length,
      courantCount: this.partieScenarios().filter((s) => s.status === 'COURANT').length,
      isClosed: this.partieClosed(),
    };
    return this.kindChoices().map((kind) => {
      if (from === null) return { kind, disabled: false, reason: null as string | null };
      // Story 38.2 : le type d'un ralliement est définitif (le serveur refuse tout changement) ;
      // la matrice de conversion ne vaut que pour le JDR.
      if (this.isRalliement()) return { kind, disabled: true, reason: null as string | null };
      const verdict = checkPartieKindTransition(from, kind, state);
      return {
        kind,
        disabled: !verdict.allowed,
        reason: verdict.allowed ? null : this.refusalLabel(verdict.refusal, state.scenarioCount),
      };
    });
  });

  /** Raison affichée sous un type désactivé — NFR-4 : jamais un bouton grisé muet. */
  private refusalLabel(refusal: PartieKindTransitionRefusal, scenarioCount: number): string {
    switch (refusal) {
      case 'PARTIE_CLOSED':
        return this.theme.tone()['partie.kind_refusal_closed'];
      case 'TOO_MANY_SCENARIOS_FOR_ONE_SHOT':
        return this.theme
          .tone()
          ['partie.kind_refusal_too_many_scenarios'].replace('{count}', String(scenarioCount));
    }
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    // Le bandeau contextuel (patron Story 29.4) est posé par l'effet du constructeur : son titre suit
    // le mode (Story 38.4).
    if (!id) return;

    this.editId.set(id);
    const p = await this.parties.get(id);
    this.partieName.set(p.name);
    this.coverImageVersion.set(p.coverImageVersion);
    this.savedKind.set(p.kind);
    // `string` de part en part (revue de code) : plus de cast `as GameSystemId` non vérifié, ni ici
    // ni dans patchValue() ci-dessous — le contrôle réactif est lui-même typé `string`.
    this.savedGameSystemId.set(p.gameSystemId);
    this.mode.set(familyOf(p.gameSystemId) === 'ralliement' ? 'ralliement' : 'quest');
    this.partieClosed.set(p.status === 'TERMINEE');
    this.form.patchValue({
      name: p.name,
      gameSystemId: p.gameSystemId,
      kind: p.kind,
      description: p.description ?? '',
    });

    // Un seul appel, pour une seule partie : NFR-6 vise les appels proportionnels au NOMBRE de
    // parties, ce qui n'est pas le cas ici. Un échec ne bloque pas l'édition des autres champs —
    // la matrice reste alors permissive côté client, le serveur restant l'autorité (Règle B).
    // Story 38.2 : un ralliement n'a pas de scénario (lecture refusée par le serveur) — rien à lire.
    if (this.isRalliement()) return;
    try {
      this.partieScenarios.set(await this.scenarios.listAll(id));
    } catch {
      this.partieScenarios.set([]);
    }
  }

  /** Bascule quête / ralliement (création uniquement, Story 38.2). Reconfigure les champs qui
   *  suivent — livre de règles et types — sans jamais toucher au nom ni à la description. */
  protected setMode(mode: FormMode): void {
    if (this.editId() !== null || mode === this.mode()) return;
    const { gameSystemId, kind } = this.form.getRawValue();
    if (mode === 'ralliement') {
      this.lastQuestSystemId = gameSystemId;
      this.mode.set('ralliement');
      this.form.patchValue({
        gameSystemId: RALLIEMENT_SYSTEM_ID,
        kind: this.kindChoices().includes(kind) ? kind : 'ONE_SHOT',
      });
    } else {
      this.mode.set('quest');
      this.form.patchValue({ gameSystemId: this.lastQuestSystemId });
    }
  }

  /** Libellé d'un type dans le mode courant : vocabulaire du ralliement ou de la quête. */
  protected kindLabel(kind: FormKind): string {
    const key = this.isRalliement() ? `partie.ralliement_kind_${kind}` : `partie.kind_${kind}`;
    return this.theme.tone()[key] ?? kind;
  }

  /** Story 45.7 — ce que la nature crée, en clair (même texte dans les trois thèmes, vocabulaire du mode). */
  protected kindPlain(kind: FormKind): string {
    const key = this.isRalliement()
      ? `partie.ralliement_kind_plain_${kind}`
      : `partie.kind_plain_${kind}`;
    return this.theme.tone()[key] ?? '';
  }

  /** Dépôt de l'image de couverture. En édition, immédiat (Story 29.12) ; en création, le fichier
   *  est retenu jusqu'à ce que la partie existe (AC12). */
  async onCoverFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permet de redéposer le même fichier une seconde fois
    if (!file) return;

    // AC14 — rejet local avant tout envoi réseau. Le serveur reste la garde réelle ; ceci évite
    // simplement de faire transiter un fichier voué au 413.
    const rejection = this.rejectCoverFile(file);
    if (rejection) {
      this.coverError.set(rejection);
      return;
    }
    this.coverError.set(null);

    const id = this.editId();
    if (!id) {
      // Création : rien à cibler encore, on retient le fichier pour l'après-`create()`.
      // Seconde sélection : l'URL de blob précédente ne servira plus, on la révoque (fuite sinon).
      const previous = this.pendingCoverPreview();
      if (previous) URL.revokeObjectURL(previous);
      this.pendingCoverFile.set(file);
      this.pendingCoverPreview.set(URL.createObjectURL(file));
      return;
    }

    // Garde anti-double-clic (Review Findings 29.12) — même patron qu'ailleurs dans le projet :
    // `[disabled]="coverSaving()"` a un délai de peinture, un second déclenchement avant ce délai
    // enverrait deux dépôts concurrents pour la même partie.
    if (this.coverSaving()) return;

    this.coverSaving.set(true);
    try {
      const updated = await this.parties.setCoverImage(id, file);
      this.coverImageVersion.set(updated.coverImageVersion);
    } catch {
      this.coverError.set(this.theme.tone()['partie.cover_upload_error']);
    } finally {
      this.coverSaving.set(false);
    }
  }

  /** `null` si le fichier est acceptable, sinon le message expliquant la cause réelle (AC14/AC15). */
  private rejectCoverFile(file: File): string | null {
    if (!ACCEPTED_COVER_MIMES.includes(file.type)) {
      return this.theme.tone()['partie.cover_reject_type'];
    }
    if (file.size > MAX_COVER_SIZE) {
      return this.theme.tone()['partie.cover_reject_size'];
    }
    return null;
  }

  /** Retrait de l'image de couverture (AC3) — la bannière générée reprend sa place. */
  async removeCoverImage(): Promise<void> {
    const id = this.editId();
    if (!id) {
      // Création : il n'y a qu'un fichier en attente, rien de déposé.
      this.clearPendingCover();
      return;
    }
    if (this.coverSaving()) return; // garde anti-double-clic (Review Findings)
    this.coverSaving.set(true);
    this.coverError.set(null);
    try {
      const updated = await this.parties.removeCoverImage(id);
      this.coverImageVersion.set(updated.coverImageVersion);
    } catch {
      this.coverError.set(this.theme.tone()['partie.cover_remove_error']);
    } finally {
      this.coverSaving.set(false);
    }
  }

  protected clearPendingCover(): void {
    const preview = this.pendingCoverPreview();
    if (preview) URL.revokeObjectURL(preview);
    this.pendingCoverFile.set(null);
    this.pendingCoverPreview.set(null);
  }

  /** Annule l'arbitrage de scénario Courant et revient au formulaire. */
  protected cancelCourantChoice(): void {
    this.courantChoice.set(null);
    this.chosenCourantId.set(null);
    const saved = this.savedKind();
    if (saved) this.form.patchValue({ kind: saved });
  }

  protected confirmCourantChoice(): void {
    if (!this.chosenCourantId()) return;
    void this.submit();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    if (this.saving()) return; // garde anti-double-clic, même patron que le dépôt de couverture

    const v = this.form.getRawValue();
    const id = this.editId();

    // AC9 — une conversion vers une campagne linéaire avec plusieurs COURANT réclame un arbitrage
    // AVANT d'être soumise : le serveur la refuserait sans `courantScenarioId`.
    if (id && this.needsCourantChoice(v.kind) && !this.chosenCourantId()) {
      this.courantChoice.set({
        kind: v.kind,
        scenarios: this.partieScenarios().filter((s) => s.status === 'COURANT'),
      });
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const payload = {
      name: v.name,
      gameSystemId: v.gameSystemId,
      kind: v.kind,
      description: v.description || undefined,
    };

    try {
      if (id) {
        // Décision utilisateur (2026-08-14, revue de code) : les champs simples s'enregistrent
        // D'ABORD, la conversion de type ENSUITE — l'ordre inverse (conversion en premier) lisait
        // `partie.name` côté serveur AVANT que le nom renommé dans ce même envoi ne soit enregistré,
        // si bien qu'un scénario auto-créé par la conversion (AC7, cas 3/5 à 0 scénario) pouvait
        // hériter d'un nom déjà périmé. Contrepartie assumée : un refus de conversion peut laisser
        // le nouveau nom enregistré sans le changement de type (rare, resoumission possible).
        await this.parties.update(id, payload);

        if (this.savedKind() !== null && v.kind !== this.savedKind()) {
          try {
            await this.parties.convertKind(id, v.kind, this.chosenCourantId() ?? undefined);
            this.savedKind.set(v.kind);
            this.courantChoice.set(null);
            this.chosenCourantId.set(null);
          } catch (err) {
            // AC15 — distinguer les causes : les autres champs SONT enregistrés, seule la
            // conversion de type a échoué (même précédent qu'AC12/`created_but_cover_failed`).
            this.error.set(
              this.serverMessage(err) ??
                this.theme.tone()['partie.fields_saved_but_convert_failed'],
            );
            return;
          }
        }

        await this.myPartiesSvc.refreshAll();
        void this.router.navigate(['/parties', id]);
        return;
      }

      const partie = await this.parties.create(payload);
      // AC12 — la partie existe désormais : on dépose l'image retenue. Un échec ici ne remet pas
      // en cause la création, et le message ne doit jamais laisser croire le contraire.
      const file = this.pendingCoverFile();
      if (file) {
        try {
          await this.parties.setCoverImage(partie.id, file);
          // Dépôt réussi : l'URL de blob locale n'a plus lieu d'être, la couverture réelle vient
          // désormais de coverImageVersion. Sans ce nettoyage, l'URL n'est jamais révoquée (fuite).
          this.clearPendingCover();
        } catch {
          this.error.set(
            this.theme.tone()[
              this.isRalliement()
                ? 'partie.ralliement_created_but_cover_failed'
                : 'partie.created_but_cover_failed'
            ],
          );
          this.saving.set(false);
          this.editId.set(partie.id);
          this.savedKind.set(partie.kind);
          this.partieName.set(partie.name);
          this.clearPendingCover();
          return;
        }
      }
      await this.myPartiesSvc.refreshAll();
      // Story 41.2 : une soirée isolée s'ouvre sur la fenêtre de conjonction (état de navigation à usage
      // unique, consommé par l'onglet de la soirée) ; toute autre partie ouvre simplement sa page.
      const soiree = this.isRalliement() && partie.kind === 'ONE_SHOT';
      void this.router.navigate(
        ['/parties', partie.id],
        soiree ? { state: { soireeCreation: true } } : {},
      );
    } catch (err) {
      // AC15 — distinguer les causes plutôt qu'un texte unique. Un refus de conversion porte son
      // propre message serveur, qui nomme la cause réelle : le relayer plutôt que le masquer.
      this.error.set(
        this.serverMessage(err) ??
          this.theme.tone()[
            this.isRalliement() ? 'partie.ralliement_save_error' : 'partie.save_error'
          ],
      );
      this.courantChoice.set(null);
    } finally {
      this.saving.set(false);
    }
  }

  /** Vrai si la matrice exige de désigner le scénario qui reste Courant pour ce type cible. */
  private needsCourantChoice(kind: FormKind): boolean {
    const from = this.savedKind();
    if (from === null || from === kind) return false;
    const verdict = checkPartieKindTransition(from, kind, {
      scenarioCount: this.partieScenarios().length,
      courantCount: this.partieScenarios().filter((s) => s.status === 'COURANT').length,
      isClosed: this.partieClosed(),
    });
    return verdict.allowed && verdict.requiresCourantChoice;
  }

  /** Extrait le message d'une erreur HTTP Nest (`{ message: string | string[] }`), s'il existe. */
  private serverMessage(err: unknown): string | null {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
    return null;
  }

  cancel(): void {
    // Une URL de blob créée pour l'aperçu du fichier en attente (création, AC12) ne se révoque
    // jamais toute seule — sans cet appel elle fuirait à chaque annulation avec fichier choisi.
    this.clearPendingCover();
    const id = this.editId();
    void this.router.navigate(id ? ['/parties', id] : ['/']);
  }
}
