import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type {
  ContentEntryDto,
  HommeDragonAventureDto,
  HommeDragonDto,
  HommeDragonRace,
} from '@master-jdr/shared';
import { ARTEFACT_CADEAU_LEVEL, SOUFFLES_RITUELS_LEVEL } from '@master-jdr/game-rules';
import { ReserveSection } from '../reserve-section/reserve-section';
import { RACES, RACE_LABELS, RACE_TAGS } from '../homme-dragon-races';
import {
  ChoiceCard,
  type ChoiceCardOption,
} from '../../characters/character-wizard/choice-card/choice-card';
import { RadioGroupNavDirective } from '../../characters/character-wizard/choice-card/radio-group-nav.directive';
import { AppIcon } from '../../../core/icons/app-icon';
import { HommeDragonService } from '../../../core/homme-dragon/homme-dragon.service';
import { hommeDragonName } from '../../../core/homme-dragon/homme-dragon.util';
import { CharacterService } from '../../../core/characters/character.service';
import { MyPartiesService } from '../../../core/my-parties/my-parties.service';
import { PartySignalsService } from '../../../core/parties/party-signals.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { ConfirmDialog } from '../../parties/confirm-dialog/confirm-dialog';
import { IdentityLabel } from '../../../shared/identity/identity-label';
import { ambiguousUserIds } from '../../../shared/identity/identity-ambiguity.util';
import { DetailSurface } from '../../../shared/detail-surface/detail-surface';
import {
  createDetailSurfaceHost,
  detailContent,
  type DetailSurfaceContent,
} from '../../../shared/detail-surface/detail-surface-host';

/** Familles des souffles communs (Story 33.2), dans l'ordre du livre (`docs/dragons.md`,
 *  « Souffles communs ») — libellé et consigne d'usage transcrits tels quels ; `consigne` est
 *  `null` quand le livre n'en donne pas (souffles aidant les PNJ). */
type SouffleFamille = 'temps' | 'destin' | 'pnj';

const SOUFFLE_FAMILLES: SouffleFamille[] = ['temps', 'destin', 'pnj'];

const SOUFFLE_FAMILLE_INFO: Record<SouffleFamille, { label: string; consigne: string | null }> = {
  temps: {
    label: 'Souffles manipulant le temps',
    consigne: 'ne peuvent pas être mis en réserve, coûtent 2 PS',
  },
  destin: {
    label: 'Souffles manipulant le destin',
    consigne: 'à utiliser juste avant ou après un jet de dés',
  },
  pnj: { label: 'Souffles aidant les PNJ', consigne: null },
};

/** Niveau des « souffles multicolores » (`docs/dragons.md`, « Niveaux ») : à partir de là,
 *  l'homme-dragon peut choisir des souffles appartenant à une autre race que la sienne. */
const SOUFFLES_MULTICOLORES_LEVEL = 3;

type SouffleData = {
  label?: string;
  description?: string;
  ps?: number;
  race?: string;
  famille?: string;
  reservable?: boolean;
};

const souffleData = (entry: ContentEntryDto): SouffleData => (entry.data ?? {}) as SouffleData;

type LevelCapacityData = { label?: string; description?: string; level?: number };

const levelCapacityData = (entry: ContentEntryDto): LevelCapacityData =>
  (entry.data ?? {}) as LevelCapacityData;

type ArtefactCatalogData = { label?: string; description?: string; race?: string };

const artefactData = (entry: ContentEntryDto): ArtefactCatalogData =>
  (entry.data ?? {}) as ArtefactCatalogData;

/**
 * Fiche d'un Homme Dragon (Story 10.1, refonte 33.1-33.7) — adressée par son `id` (AD-23, Story
 * 33.8) : la page `/homme-dragons/:id` l'héberge, propriétaire seul. Un Homme Dragon suit 0..N
 * aventures : niveau et historique cumulent les scénarios `PASSE` de toutes, les voyageurs
 * protégés se lisent par aventure, et la section « Aventures » associe / dissocie (confirmation
 * avant dissociation : le niveau peut baisser, rien n'est purgé). La création (parcours guidé)
 * vit dans la page de création par partie, jamais ici.
 */
@Component({
  selector: 'app-homme-dragon-sheet',
  imports: [
    FormsModule,
    MatButtonModule,
    AppIcon,
    DatePipe,
    NgTemplateOutlet,
    DetailSurface,
    RouterLink,
    IdentityLabel,
    ReserveSection,
    ChoiceCard,
    RadioGroupNavDirective,
  ],
  templateUrl: './homme-dragon-sheet.html',
  styleUrl: './homme-dragon-sheet.scss',
})
export class HommeDragonSheet implements OnInit {
  /** Identifiant de l'Homme Dragon (AD-23) — la fiche n'est plus rattachée à une partie. */
  readonly hommeDragonId = input.required<string>();
  /** `true` quand la page arrive du parcours de création : affiche le bandeau « fiche créée ». */
  readonly showCreatedNotice = input(false);

  private readonly hommeDragonSvc = inject(HommeDragonService);
  private readonly characterSvc = inject(CharacterService);
  private readonly dialog = inject(MatDialog);
  private readonly partySignals = inject(PartySignalsService);
  private readonly myParties = inject(MyPartiesService);
  protected readonly theme = inject(ThemeToneService);

  protected readonly raceLabel = (race: HommeDragonRace): string => RACE_LABELS[race];

  /**
   * Surface de détail (Story 33.1) — même plomberie que `CharacterSheet` : un seul emplacement
   * ouvert à la fois, le jeton d'ouverture et le retour du focus vivent dans le host partagé.
   */
  protected readonly detail = createDetailSurfaceHost();

  /** `undefined` = chargement en cours, sinon la fiche (une fiche absente ou étrangère répond
   *  `404` : message d'erreur, jamais de fiche vide). */
  protected readonly hommeDragon = signal<HommeDragonDto | undefined>(undefined);
  protected readonly artefactCatalog = signal<ContentEntryDto[]>([]);
  protected readonly loadError = signal<string | null>(null);

  /** Nom affiché sur la fiche — même convention de repli que `characterName()`
   *  (`character.util.ts`) : valeur normalisée ou libellé de repli en français si absente. */
  protected readonly displayName = computed<string>(() =>
    hommeDragonName(this.hommeDragon()?.sheetData.nom),
  );

  /** Bandeau « fiche créée » (le parcours guidé vit dans `HommeDragonCreationWizard`, Story 33.3,
   *  hébergé par la page de création) : refermé dès que le MJ interagit à nouveau avec la fiche. */
  private readonly noticeDismissed = signal(false);
  protected readonly justCreated = computed(
    () => this.showCreatedNotice() && !this.noticeDismissed(),
  );

  // — Édition de l'artefact (fiche existante) —
  protected readonly editingArtefact = signal(false);
  protected readonly editArtefactKey = signal<string | null>(null);
  protected readonly updating = signal(false);
  protected readonly updateError = signal<string | null>(null);

  protected readonly artefactsForExistingRace = computed(() => {
    const hd = this.hommeDragon();
    if (!hd) return [];
    return this.artefactCatalog().filter(
      (e) => (e.data as { race?: string }).race === hd.sheetData.race,
    );
  });

  /** Libellé affiché de l'artefact courant : `nom` personnalisé par le MJ en priorité, sinon le
   *  `label` du catalogue `hommeDragonArtefact`, sinon la clé brute en dernier repli. */
  protected readonly artefactLabel = computed<string>(() => {
    const hd = this.hommeDragon();
    if (!hd) return '';
    const art = hd.sheetData.artefact;
    const catalogData = this.artefactCatalog().find((e) => e.key === art.key)?.data as
      { label?: string } | undefined;
    return art.nom?.trim() || catalogData?.label || art.key;
  });

  /** Contenu de la surface de détail pour l'artefact courant (Story 33.1) — `null` quand ni
   *  l'`inscription` du MJ ni la `description` du catalogue ne sont disponibles (pas de
   *  déclencheur dans ce cas, cf. `detailContent()`). */
  protected readonly artefactDetail = computed<DetailSurfaceContent | null>(() => {
    const hd = this.hommeDragon();
    if (!hd) return null;
    const art = hd.sheetData.artefact;
    const catalogData = this.artefactCatalog().find((e) => e.key === art.key)?.data as
      { description?: string } | undefined;
    return detailContent(this.artefactLabel(), art.inscription?.trim() || catalogData?.description);
  });

  constructor() {
    // Story 20.2 (AC1) : réagit au signal générique HommeDragonService.changed (RealtimeService).
    // PIÈGE (même classe que CharacterSheet, Story 20.1) : HommeDragonSheet a DÉJÀ un chargement
    // dédié dans ngOnInit() (fetch au montage). La première exécution d'un effect() a lieu à la
    // CONSTRUCTION du composant — si `changed()` porte déjà une valeur (mutation locale antérieure
    // dans la même session applicative, HommeDragonService étant `providedIn: 'root'`), cette
    // première exécution déclencherait un refetch REDONDANT avec celui que ngOnInit() fait juste
    // après. Le flag `firstRun` neutralise uniquement cette toute première exécution.
    let firstRun = true;
    effect(() => {
      this.hommeDragonSvc.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      untracked(() => void this.refreshHommeDragon());
    });
  }

  // Utilisée UNIQUEMENT par l'effect() ci-dessus — PAS par le fetch initial de ngOnInit(), qui
  // reste ciblé par this.hommeDragonId() (jamais par une valeur dérivée de this.hommeDragon(), pas
  // encore garantie peuplée au moment où ngOnInit() s'exécute, même piège de timing que
  // Story 20.1). `hommeDragon() === undefined` signifie « chargement initial en cours ».
  private async refreshHommeDragon(): Promise<void> {
    if (this.hommeDragon() === undefined) return;
    try {
      const fresh = await this.hommeDragonSvc.findOne(this.hommeDragonId());
      // Story 33.6 : une lecture partie AVANT une écriture de la réserve (réponse déjà appliquée
      // par `(updated)`) peut arriver APRÈS elle — elle ne doit pas la remplacer par une fiche
      // plus ancienne. Le signal `changed` émis par l'écriture déclenche de toute façon une
      // lecture plus récente.
      const current = this.hommeDragon();
      if (current && Date.parse(fresh.updatedAt) < Date.parse(current.updatedAt)) return;
      this.hommeDragon.set(fresh);
    } catch {
      // non-bloquant — la fiche affichée reste telle quelle si le rafraîchissement échoue
    }
  }

  async ngOnInit(): Promise<void> {
    // « Ajouter une aventure » lit les signaux déjà calculés (HOMME_DRAGON_A_CREER) — aucun appel
    // par partie ; un rafraîchissement à l'ouverture garantit un état frais.
    void this.partySignals.refresh();
    try {
      const [hommeDragon, content] = await Promise.all([
        this.hommeDragonSvc.findOne(this.hommeDragonId()),
        this.characterSvc.getGameSystemContent('ryuutama'),
      ]);
      this.hommeDragon.set(hommeDragon);
      this.artefactCatalog.set(content['hommeDragonArtefact'] ?? []);
      this.eveilPowerCatalog.set(content['eveilPower'] ?? []);
      this.souffleCatalog.set(content['souffle'] ?? []);
      this.levelCapacityCatalog.set(content['hommeDragonLevelCapacity'] ?? []);
      this.ritualCatalog.set(content['souffleRituel'] ?? []);
    } catch (e) {
      // Un Homme Dragon absent ou étranger répond `404` (jamais `403`) : même message dans les
      // deux cas, l'existence d'une fiche d'autrui ne fuit pas. Toute autre erreur (réseau,
      // serveur) reste transitoire : même état `undefined` que le chargement, message distinct.
      this.loadError.set(
        e instanceof HttpErrorResponse && e.status === 404
          ? this.theme.tone()['common.homme_dragon_introuvable']
          : this.theme.tone()['hd.sheet_load_error'],
      );
    }
  }

  // — Aventures (Story 33.8, AD-23) —

  protected readonly aventures = computed<HommeDragonAventureDto[]>(
    () => this.hommeDragon()?.aventures ?? [],
  );

  /** `userId` dont le nom affiché est partagé par plusieurs voyageurs d'une même aventure : le
   *  pseudo les distingue (même motif que les autres écrans « sans personnage »). */
  protected readonly ambiguousByAventure = computed(
    () =>
      new Map(this.aventures().map((a) => [a.partieId, ambiguousUserIds(a.voyageurs)] as const)),
  );

  protected isAmbiguous(partieId: string, userId: string): boolean {
    return this.ambiguousByAventure().get(partieId)?.has(userId) ?? false;
  }

  /** Nom accessible du bouton « Retirer » d'une aventure (contient le libellé visible). */
  protected removeAventureAria(nom: string): string {
    return fillTone(this.theme.tone()['hd.sheet_aventure_remove_aria'], { nom });
  }

  /** Aventures éligibles à « Ajouter une aventure » : mes parties Ryuutama sans Homme Dragon, lues
   *  dans les signaux DÉJÀ calculés (`HOMME_DRAGON_A_CREER`, serveur) croisés avec mes parties pour
   *  le nom — aucun appel par partie. */
  protected readonly eligibleAventures = computed(() => {
    const signals = this.partySignals.signals();
    // Une partie déjà liée à CET Homme Dragon n'est plus proposée, même si les signaux ne sont pas
    // encore rafraîchis après le lien (re-lier donnerait un 409).
    const linked = new Set(this.aventures().map((a) => a.partieId));
    return this.myParties
      .mjParties()
      .filter((p) => !linked.has(p.id))
      .filter((p) => signals.get(p.id)?.signals.includes('HOMME_DRAGON_A_CREER'))
      .map((p) => ({ id: p.id, name: p.name }));
  });

  protected readonly selectedAventureId = signal<string | null>(null);
  protected readonly aventureBusy = signal(false);
  protected readonly aventureError = signal<string | null>(null);

  /** Nom de l'aventure d'une entrée d'historique (`partieId`) ; vide si elle n'est plus liée. */
  protected aventureName(partieId: string): string {
    return this.aventures().find((a) => a.partieId === partieId)?.nom ?? '';
  }

  protected async onAddAventure(): Promise<void> {
    const partieId = this.selectedAventureId();
    if (!partieId || this.aventureBusy()) return;
    this.aventureBusy.set(true);
    this.aventureError.set(null);
    try {
      this.hommeDragon.set(await this.hommeDragonSvc.link(partieId, this.hommeDragonId()));
      this.selectedAventureId.set(null);
      void this.partySignals.refresh();
    } catch {
      this.aventureError.set(this.theme.tone()['hd.sheet_aventure_add_error']);
    } finally {
      this.aventureBusy.set(false);
    }
  }

  /** Dissocier demande une confirmation courte : le niveau peut baisser (sans rien purger). */
  protected async onRemoveAventure(aventure: HommeDragonAventureDto): Promise<void> {
    if (this.aventureBusy()) return;
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        message: fillTone(this.theme.tone()['hd.sheet_aventure_remove_confirm'], {
          nom: aventure.nom,
        }),
        confirmLabel: this.theme.tone()['common.retirer'],
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    this.aventureBusy.set(true);
    this.aventureError.set(null);
    try {
      this.hommeDragon.set(
        await this.hommeDragonSvc.unlink(aventure.partieId, this.hommeDragonId()),
      );
      void this.partySignals.refresh();
    } catch {
      this.aventureError.set(this.theme.tone()['hd.sheet_aventure_remove_error']);
    } finally {
      this.aventureBusy.set(false);
    }
  }

  protected openArtefactEdit(): void {
    this.editArtefactKey.set(this.hommeDragon()?.sheetData.artefact.key ?? null);
    this.updateError.set(null);
    this.editingArtefact.set(true);
    // Revue de code : le bandeau « fiche créée » restait affiché indéfiniment — le refermer dès
    // que le MJ interagit à nouveau avec la fiche (édition d'artefact), pas seulement à la création.
    this.noticeDismissed.set(true);
  }

  protected async onArtefactSubmit(): Promise<void> {
    const key = this.editArtefactKey();
    if (!key || this.updating()) return;
    this.updating.set(true);
    this.updateError.set(null);
    try {
      const updated = await this.hommeDragonSvc.update(this.hommeDragonId(), {
        artefact: { key },
      });
      this.hommeDragon.set(updated);
      this.editingArtefact.set(false);
    } catch {
      this.updateError.set(this.theme.tone()['hd.sheet_artefact_change_error']);
    } finally {
      this.updating.set(false);
    }
  }

  // — Choix d'un pouvoir d'éveil (Story 10.4) —
  protected readonly eveilPowerCatalog = signal<ContentEntryDto[]>([]);
  protected readonly currentPendingLevel = computed(
    () => this.hommeDragon()?.pendingEveilLevels[0] ?? null,
  );
  /** Pool commun à toutes les races (décision utilisateur, Story 10.4) : le sélecteur propose tous
   * les pouvoirs du catalogue non encore choisis, pas un filtrage par niveau — un pouvoir d'éveil
   * n'est jamais lié à un niveau de déblocage précis. */
  protected readonly eveilPowersForCurrentLevel = computed(() => {
    const chosenKeys = new Set((this.hommeDragon()?.eveilPowers ?? []).map((ep) => ep.key));
    return this.eveilPowerCatalog().filter((e) => !chosenKeys.has(e.key));
  });
  protected readonly selectedEveilPowerKey = signal<string | null>(null);
  protected readonly choosingEveilPower = signal(false);
  protected readonly eveilPowerError = signal<string | null>(null);

  protected eveilPowerLabel(key: string): string {
    const entry = this.eveilPowerCatalog().find((e) => e.key === key);
    return entry ? ((entry.data as { label?: string }).label ?? key) : key;
  }

  /** Contenu de la surface de détail d'un pouvoir d'éveil déjà choisi (Story 33.1) — `null` quand
   *  le catalogue ne porte pas de `description` pour cette clé (pas de déclencheur dans ce cas). */
  protected eveilPowerDetail(key: string): DetailSurfaceContent | null {
    const entry = this.eveilPowerCatalog().find((e) => e.key === key);
    const description = (entry?.data as { description?: string } | undefined)?.description;
    return detailContent(this.eveilPowerLabel(key), description);
  }

  protected async onChooseEveilPower(): Promise<void> {
    const level = this.currentPendingLevel();
    const key = this.selectedEveilPowerKey();
    if (!key || !level || this.choosingEveilPower()) return;
    this.choosingEveilPower.set(true);
    this.eveilPowerError.set(null);
    try {
      const updated = await this.hommeDragonSvc.chooseEveilPower(this.hommeDragonId(), {
        level,
        key,
      });
      this.hommeDragon.set(updated);
      this.selectedEveilPowerKey.set(null);
    } catch {
      this.eveilPowerError.set(
        this.theme.tone()['common.impossible_d_enregistrer_ce_choix_reessayez'],
      );
    } finally {
      this.choosingEveilPower.set(false);
    }
  }

  // — Souffles disponibles (Story 33.2) —
  protected readonly souffleCatalog = signal<ContentEntryDto[]>([]);

  // Lecture seule, catalogue `souffle` (`souffles.json`) UNIQUEMENT : les éveils
  // (`eveilPowerCatalog`) ne sont jamais des souffles — la Q-13 qui les assimilait aux souffles
  // communs reposait sur une confusion, levée le 2026-09-25 par `docs/dragons.md`. Indépendant du
  // choix de pouvoir d'éveil au level-up ci-dessus (`eveilPowersForCurrentLevel`,
  // `chooseEveilPower()`), que ces listes n'affectent jamais. Pas de décompte ici : la réserve de
  // souffles vit dans sa propre section (`ReserveSection`, Story 33.6).

  /** Souffles communs (sans `race`), groupés par famille dans l'ordre du livre. Une famille sans
   *  entrée au catalogue n'est pas affichée ; une entrée commune sans famille connue non plus. */
  protected readonly commonSouffleGroups = computed(() => {
    const communs = this.souffleCatalog().filter((e) => !souffleData(e).race);
    return SOUFFLE_FAMILLES.map((famille) => ({
      famille,
      ...SOUFFLE_FAMILLE_INFO[famille],
      souffles: communs.filter((e) => souffleData(e).famille === famille),
    })).filter((g) => g.souffles.length > 0);
  });

  /** Souffles propres à la race du dragon affiché — vide (sans erreur) si le catalogue n'en porte
   *  aucun pour cette race. */
  protected readonly raceSouffles = computed<ContentEntryDto[]>(() => {
    const race = this.hommeDragon()?.sheetData.race;
    if (!race) return [];
    return this.souffleCatalog().filter((e) => souffleData(e).race === race);
  });

  /** Souffles des trois autres races, groupés par race (ordre de `RACES`) — uniquement à partir
   *  du niveau des souffles multicolores, vide en dessous. */
  protected readonly otherRaceSouffleGroups = computed(() => {
    const hd = this.hommeDragon();
    if (!hd || hd.derived.level < SOUFFLES_MULTICOLORES_LEVEL) return [];
    return RACES.filter((r) => r !== hd.sheetData.race)
      .map((race) => ({
        race,
        souffles: this.souffleCatalog().filter((e) => souffleData(e).race === race),
      }))
      .filter((g) => g.souffles.length > 0);
  });

  protected readonly hasSouffles = computed(
    () =>
      this.commonSouffleGroups().length > 0 ||
      this.raceSouffles().length > 0 ||
      this.otherRaceSouffleGroups().length > 0,
  );

  /** Libellé d'un souffle : `label` du catalogue, repli sur la clé brute si le catalogue est
   *  incomplet — même patron que `artefactLabel()`/`eveilPowerLabel()`. */
  protected souffleLabel(entry: ContentEntryDto): string {
    return souffleData(entry).label || entry.key;
  }

  /** Coût affiché (« 1 PS », « 2 PS »…), `null` si `ps` est absent — pas de garde runtime sur la
   *  complétude du catalogue (discipline de revue de contenu uniquement, cf. spec). */
  protected souffleCost(entry: ContentEntryDto): string | null {
    const ps = souffleData(entry).ps;
    return typeof ps === 'number' ? `${ps} PS` : null;
  }

  /** `true` pour les souffles qui ne peuvent pas être mis en réserve (souffles du temps). */
  protected souffleNonReservable(entry: ContentEntryDto): boolean {
    return souffleData(entry).reservable === false;
  }

  /** Contenu de la surface de détail d'un souffle (même patron que `eveilPowerDetail()`) — `null`
   *  quand le catalogue ne porte pas de `description` (pas de déclencheur dans ce cas). */
  protected souffleDetail(entry: ContentEntryDto): DetailSurfaceContent | null {
    return detailContent(this.souffleLabel(entry), souffleData(entry).description);
  }

  // — Souffles rituels (Story 33.7) —
  protected readonly ritualCatalog = signal<ContentEntryDto[]>([]);

  /** Consultables à partir du niveau 5 (mère-dragon) ; ils peuvent aussi être placés dans la
   *  réserve (33.6, `ReserveSection`), sans décompte. Le catalogue `souffleRituel` est distinct de `souffle` : ses entrées n'ont ni race ni
   *  famille, elles ne sont donc jamais classées « autre race ». Liste vide si le catalogue l'est. */
  protected readonly rituals = computed<ContentEntryDto[]>(() => {
    const hd = this.hommeDragon();
    if (!hd || hd.derived.level < SOUFFLES_RITUELS_LEVEL) return [];
    return this.ritualCatalog();
  });

  // — Capacités de niveau (Story 33.7) —
  protected readonly levelCapacityCatalog = signal<ContentEntryDto[]>([]);

  /** Capacités acquises (niveau de la capacité ≤ niveau du dragon), par niveau croissant puis dans
   *  l'ordre du catalogue ; vide au niveau 1 (la carte est alors masquée). */
  protected readonly acquiredCapacities = computed(() => {
    const hd = this.hommeDragon();
    if (!hd) return [];
    return this.levelCapacityCatalog()
      .map((entry, index) => ({ entry, index, data: levelCapacityData(entry) }))
      .filter((c) => typeof c.data.level === 'number' && c.data.level <= hd.derived.level)
      .sort((a, b) => (a.data.level as number) - (b.data.level as number) || a.index - b.index)
      .map((c) => ({
        key: c.entry.key,
        level: c.data.level as number,
        label: c.data.label?.trim() || c.entry.key,
        description: c.data.description?.trim() ?? '',
      }));
  });

  // — Artefact cadeau (Story 33.7) —
  protected readonly artefactCadeauLevel = ARTEFACT_CADEAU_LEVEL;

  /** Artefact cadeau déjà choisi : libellé lu au catalogue d'artefacts, repli sur la clé brute si
   *  l'entrée a disparu du catalogue (jamais de fiche cassée). `null` tant que rien n'est choisi. */
  protected readonly artefactCadeau = computed(() => {
    const cadeau = this.hommeDragon()?.sheetData.artefactCadeau;
    if (!cadeau) return null;
    const entry = this.artefactCatalog().find((e) => e.key === cadeau.key);
    const data = entry ? artefactData(entry) : {};
    const label = data.label?.trim() || cadeau.key;
    const race = data.race as HommeDragonRace | undefined;
    return {
      key: cadeau.key,
      label,
      raceLabel: race && RACE_LABELS[race] ? RACE_LABELS[race] : null,
      detail: detailContent(label, data.description),
    };
  });

  /** Choix ouvert : niveau atteint et rien de choisi. Rien avant le niveau 4. */
  protected readonly canChooseCadeau = computed(() => {
    const hd = this.hommeDragon();
    return !!hd && hd.derived.level >= ARTEFACT_CADEAU_LEVEL && !hd.sheetData.artefactCadeau;
  });

  /** Artefacts des trois AUTRES races (jamais celui de la race du dragon), teinte de race doublée
   *  d'un libellé de race. Même règle que le serveur (qui reste l'autorité). */
  protected readonly cadeauOptions = computed(() => {
    const race = this.hommeDragon()?.sheetData.race;
    if (!race) return [];
    return this.artefactCatalog()
      .filter((e) => {
        const r = artefactData(e).race as HommeDragonRace | undefined;
        return !!r && r !== race && !!RACE_TAGS[r];
      })
      .map((e) => {
        const data = artefactData(e);
        const artefactRace = data.race as HommeDragonRace;
        const option: ChoiceCardOption = {
          key: e.key,
          label: data.label?.trim() || e.key,
          detail: data.description?.trim() || undefined,
        };
        return { option, race: artefactRace, tag: RACE_TAGS[artefactRace] };
      });
  });

  protected readonly selectedCadeauKey = signal<string | null>(null);
  /** Étape de confirmation explicite (« Ce choix est définitif ») avant l'envoi. */
  protected readonly confirmingCadeau = signal(false);
  protected readonly choosingCadeau = signal(false);
  protected readonly cadeauError = signal<string | null>(null);

  protected readonly selectedCadeauLabel = computed<string>(() => {
    const key = this.selectedCadeauKey();
    if (!key) return '';
    return this.cadeauOptions().find((o) => o.option.key === key)?.option.label ?? key;
  });

  /** Question de la confirmation du cadeau (la mention « Ce choix est définitif. » est en gras
   *  dans le gabarit, ce texte la suit). */
  protected readonly cadeauConfirmText = computed<string>(() =>
    fillTone(this.theme.tone()['hd.sheet_cadeau_confirm_text'], {
      nom: this.selectedCadeauLabel(),
    }),
  );

  protected selectCadeau(key: string): void {
    this.selectedCadeauKey.set(key);
    this.cadeauError.set(null);
  }

  protected askCadeauConfirmation(): void {
    if (!this.selectedCadeauKey()) return;
    this.confirmingCadeau.set(true);
    // Le bouton « Choisir cet artefact » (focalisé) va disparaître : le focus passe au bloc de
    // confirmation une fois rendu.
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>('.homme-dragon-sheet__cadeau-confirm')
          ?.focus(),
      { injector: this.injector },
    );
  }

  protected cancelCadeauConfirmation(): void {
    this.confirmingCadeau.set(false);
    // Élément stable : le bouton « Choisir cet artefact » revient avec la grille.
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>('.homme-dragon-sheet__cadeau-next')
          ?.focus(),
      { injector: this.injector },
    );
  }

  protected async onConfirmCadeau(): Promise<void> {
    const key = this.selectedCadeauKey();
    if (!key || !this.confirmingCadeau() || this.choosingCadeau()) return;
    this.choosingCadeau.set(true);
    this.cadeauError.set(null);
    try {
      const updated = await this.hommeDragonSvc.chooseArtefactCadeau(this.hommeDragonId(), {
        key,
      });
      this.hommeDragon.set(updated);
      this.selectedCadeauKey.set(null);
      this.confirmingCadeau.set(false);
    } catch {
      this.cadeauError.set(this.theme.tone()['common.impossible_d_enregistrer_ce_choix_reessayez']);
      // Retour à la sélection : le cadeau a pu être choisi ailleurs entre-temps (la fiche se
      // rafraîchit alors d'elle-même par le signal `changed`).
      this.confirmingCadeau.set(false);
    } finally {
      this.choosingCadeau.set(false);
    }
  }

  // — Export PDF (Story 10.5, deux formats Story 33.4) —
  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);
  protected readonly exportMenuOpen = signal(false);

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);

  protected toggleExportMenu(): void {
    if (this.exportMenuOpen()) {
      this.closeExportMenu(true);
      return;
    }
    this.exportMenuOpen.set(true);
    // Le menu n'existe dans le DOM qu'après le prochain rendu : le focus va sur son premier item.
    afterNextRender(() => this.exportMenuItems()[0]?.focus(), { injector: this.injector });
  }

  protected closeExportMenu(restoreFocus = false): void {
    this.exportMenuOpen.set(false);
    if (restoreFocus) this.restoreFocusToExportTrigger();
  }

  private exportTrigger(): HTMLButtonElement | null {
    return this.host.nativeElement.querySelector<HTMLButtonElement>(
      '.homme-dragon-sheet__export-trigger',
    );
  }

  /** Après le prochain rendu (le déclencheur peut être désactivé tant que l'export court). */
  private restoreFocusToExportTrigger(): void {
    afterNextRender(() => this.exportTrigger()?.focus(), { injector: this.injector });
  }

  private exportMenuItems(): HTMLButtonElement[] {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLButtonElement>(
        '.homme-dragon-sheet__export-item',
      ),
    );
  }

  /** Clavier du menu (patron WAI-ARIA « menu button ») : Échap referme et rend le focus au
   *  déclencheur, flèches haut/bas bouclent sur les entrées, Début/Fin vont aux extrémités. */
  protected onExportMenuKeydown(event: KeyboardEvent): void {
    const items = this.exportMenuItems();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (i: number) => {
      event.preventDefault();
      items[(i + items.length) % items.length]?.focus();
    };
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.closeExportMenu(true);
        break;
      case 'ArrowDown':
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        focusAt(index - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(items.length - 1);
        break;
      case 'Tab':
        // Le focus passe au déclencheur AVANT la fermeture (l'item focalisé va disparaître du DOM) ;
        // pas de preventDefault : Tab continue depuis le déclencheur.
        this.exportTrigger()?.focus();
        this.closeExportMenu();
        break;
    }
  }

  protected async onExportPdf(format: 'editable' | '2pages'): Promise<void> {
    this.closeExportMenu();
    if (this.exporting()) return;
    this.exportError.set(null);
    this.exporting.set(true);
    try {
      const blob = await this.hommeDragonSvc.exportPdf(this.hommeDragonId(), format);
      const url = URL.createObjectURL(blob);
      const safeName = (this.hommeDragon()?.sheetData.nom || 'homme-dragon').replace(
        /[^a-z0-9-_]+/gi,
        '_',
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `homme-dragon-${safeName}-${format}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      this.exportError.set(this.theme.tone()['hd.sheet_export_error']);
    } finally {
      this.exporting.set(false);
      this.restoreFocusToExportTrigger();
    }
  }
}
