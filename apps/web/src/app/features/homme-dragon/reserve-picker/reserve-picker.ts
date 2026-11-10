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
import type { ContentEntryDto, HommeDragonRace } from '@master-jdr/shared';
import {
  RESERVE_REASON_AUTRE_RACE_NIVEAU,
  RESERVE_REASON_QUOTA_AUTRE_RACE,
  reserveCapacity,
  reservePlacements,
  reserveSouffleKind,
  type ReserveCatalogs,
  type ReservePlacement,
} from '@master-jdr/game-rules';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { DetailSurface } from '../../../shared/detail-surface/detail-surface';
import { RACES, RACE_LABELS, RACE_TAGS } from '../homme-dragon-races';
import {
  emplacements,
  souffleView,
  type SouffleView,
} from '../reserve-section/reserve-souffle.util';

let nextInstance = 0;

/** Ligne de souffle de la fenêtre : vue du catalogue + faisabilité du placement dans CET emplacement. */
interface PickerRow extends SouffleView {
  placement: ReservePlacement;
  /** Repère « Déjà dans l'emplacement N » (souffle commun / de la race : non bloquant). */
  mark: string | null;
  /** `id`s des éléments qui composent le nom accessible : nom + coût + repère + raison. */
  labelledBy: string;
}

interface PickerSection {
  id: string;
  /** Sous-titre de race (`h4`) — seulement dans « Autres races ». */
  race: HommeDragonRace | null;
  rows: PickerRow[];
}

interface PickerCategory {
  id: string;
  title: string;
  /** Gemme de race de l'en-tête (catégorie « Votre race »). */
  race: HommeDragonRace | null;
  /** Raison écrite du repli : rien n'est choisissable ici (même vocabulaire que sur les lignes). */
  why: string | null;
  /** Information (et non raison) d'une catégorie choisissable : « 0 / 1 souffle autorisé ». */
  info: string | null;
  choosable: boolean;
  count: number;
  sections: PickerSection[];
}

interface PickerGroup {
  id: string;
  title: string;
  categories: PickerCategory[];
}

const FAMILLES: { famille: string; title: string }[] = [
  { famille: 'destin', title: 'Destin' },
  { famille: 'pnj', title: 'PNJ' },
  { famille: 'temps', title: 'Souffles du temps' },
];

const data = (e: ContentEntryDto) => (e.data ?? {}) as { race?: string; famille?: string };

/**
 * Fenêtre de choix d'un souffle pour UN emplacement de la réserve (Story 33.6). Réutilise
 * `DetailSurface` étendu (en-tête = titre + compteur, pied épinglé = zone de détail + boutons).
 *
 * Aucun souffle n'est masqué : ceux qui ne peuvent pas être placés sont grisés (`aria-disabled`,
 * jamais `disabled` : ils restent focalisables et consultables) avec leur raison écrite. Les règles
 * viennent de `@master-jdr/game-rules` (`reservePlacements`), les mêmes que celles du serveur, qui
 * reste l'autorité. Une ligne = un `<button>` natif ; Entrée/Espace = consulter (et non placer) ;
 * « Mettre dans l'emplacement N » place le souffle consulté.
 */
@Component({
  selector: 'app-reserve-picker',
  imports: [AppIcon, DetailSurface],
  templateUrl: './reserve-picker.html',
  styleUrl: './reserve-picker.scss',
})
export class ReservePicker {
  /** Numéro d'emplacement visé (1-based). */
  readonly slot = input.required<number>();
  readonly reserve = input.required<(string | null)[]>();
  readonly level = input.required<number>();
  readonly race = input.required<HommeDragonRace>();
  readonly souffleCatalog = input<ContentEntryDto[]>([]);
  readonly ritualCatalog = input<ContentEntryDto[]>([]);
  /** Clé du souffle à mettre dans l'emplacement. */
  readonly chosen = output<string>();
  /** « Annuler », Échap ou ✕ : rien n'est modifié. */
  readonly closed = output<void>();

  protected readonly theme = inject(ThemeToneService);
  protected readonly uid = `rp-${nextInstance++}`;
  protected readonly raceTags = RACE_TAGS;
  protected readonly raceLabels = RACE_LABELS;

  protected readonly title = computed(() =>
    fillTone(this.theme.tone()['hd.reserve_pick_for_slot'], { n: this.slot() }),
  );
  /** Nom accessible de la zone de description du souffle consulté. */
  protected descriptionAria(nom: string): string {
    return fillTone(this.theme.tone()['hd.picker_description_aria'], { nom });
  }
  /** Libellé du bouton qui place le souffle consulté dans l'emplacement visé. */
  protected readonly placeLabel = computed(() =>
    fillTone(this.theme.tone()['hd.picker_place_btn'], { n: this.slot() }),
  );
  private readonly capacity = computed(() => reserveCapacity(this.level()));

  /** Emplacements remplis parmi ceux qui existent. */
  private readonly filled = computed(
    () =>
      this.reserve()
        .slice(0, this.capacity())
        .filter((k) => !!k).length,
  );
  protected readonly counterText = computed(
    () => `${this.filled()} / ${emplacements(this.capacity())}`,
  );
  protected readonly segments = computed(() =>
    Array.from({ length: this.capacity() }, (_, i) => i < this.filled()),
  );

  private readonly catalogs = computed<ReserveCatalogs>(() => ({
    souffles: this.souffleCatalog(),
    rituels: this.ritualCatalog(),
  }));

  private readonly placements = computed(() =>
    reservePlacements(
      [...this.souffleCatalog(), ...this.ritualCatalog()].map((e) => e.key),
      this.slot() - 1,
      this.reserve(),
      this.level(),
      this.race(),
      this.catalogs(),
    ),
  );

  private row(entry: ContentEntryDto): PickerRow {
    const view = souffleView(entry.key, this.souffleCatalog(), this.ritualCatalog());
    const placement = this.placements()[entry.key];
    const id = `${this.uid}-${entry.key}`;
    const mark =
      placement.placeable && placement.placedIn.length > 0
        ? this.dejaDans(placement.placedIn)
        : null;
    const ids = [`${id}-n`];
    if (view.cost) ids.push(`${id}-c`);
    if (mark) ids.push(`${id}-m`);
    if (placement.reason) ids.push(`${id}-w`);
    return { ...view, placement, mark, labelledBy: ids.join(' ') };
  }

  private dejaDans(slots: number[]): string {
    return slots.length === 1
      ? `Déjà dans l'emplacement ${slots[0]}`
      : `Déjà dans les emplacements ${slots.join(', ')}`;
  }

  private category(
    id: string,
    title: string,
    race: HommeDragonRace | null,
    sections: PickerSection[],
    why: string | null,
    info: string | null = null,
  ): PickerCategory {
    const rows = sections.flatMap((s) => s.rows);
    const choosable = rows.some((r) => r.placement.placeable);
    return {
      id,
      title,
      race,
      choosable,
      why: choosable ? null : (why ?? rows[0]?.placement.reason ?? null),
      info: choosable ? info : null,
      count: rows.length,
      sections,
    };
  }

  /** Souffles de l'autre race déjà placés AILLEURS que dans l'emplacement visé. */
  private readonly otherRacePlaced = computed(() => {
    const slotIndex = this.slot() - 1;
    const reserve = this.reserve();
    for (let i = 0; i < reserve.length; i++) {
      const key = reserve[i];
      if (!key || i === slotIndex) continue;
      if (reserveSouffleKind(key, this.race(), this.catalogs()) === 'autre-race') {
        return { key, slot: i + 1 };
      }
    }
    return null;
  });

  /** Nombre de souffles d'une autre race dans la réserve (information « 0 / 1 souffle autorisé »). */
  private readonly otherRaceCount = computed(
    () =>
      this.reserve().filter(
        (k) => !!k && reserveSouffleKind(k, this.race(), this.catalogs()) === 'autre-race',
      ).length,
  );

  protected readonly groups = computed<PickerGroup[]>(() => {
    const souffles = this.souffleCatalog();
    const race = this.race();
    const rowsOf = (entries: ContentEntryDto[]) => entries.map((e) => this.row(e));

    const communs: PickerCategory[] = FAMILLES.map((f) => {
      const entries = souffles.filter((e) => !data(e).race && data(e).famille === f.famille);
      return this.category(
        `famille-${f.famille}`,
        f.title,
        null,
        [{ id: 'all', race: null, rows: rowsOf(entries) }],
        null,
      );
    }).filter((c) => c.count > 0);

    const own = souffles.filter((e) => data(e).race === race);
    const proper =
      own.length > 0
        ? [
            this.category(
              'race',
              `Souffles du ${RACE_LABELS[race]}`,
              race,
              [{ id: 'all', race: null, rows: rowsOf(own) }],
              null,
            ),
          ]
        : [];

    const others: PickerCategory[] = [];
    const otherSections = RACES.filter((r) => r !== race)
      .map((r) => ({
        id: r,
        race: r as HommeDragonRace | null,
        rows: rowsOf(souffles.filter((e) => data(e).race === r)),
      }))
      .filter((s) => s.rows.length > 0);
    if (otherSections.length > 0) {
      others.push(
        this.category(
          'autres-races',
          'Autres races',
          null,
          otherSections,
          this.level() < 3 ? RESERVE_REASON_AUTRE_RACE_NIVEAU : RESERVE_REASON_QUOTA_AUTRE_RACE,
          `${this.otherRaceCount()} / 1 souffle autorisé`,
        ),
      );
    }
    const rituals = this.ritualCatalog();
    if (rituals.length > 0) {
      others.push(
        this.category(
          'rituels',
          'Rituels',
          null,
          [{ id: 'all', race: null, rows: rowsOf(rituals) }],
          null,
        ),
      );
    }

    return [
      { id: 'communs', title: 'Souffles communs', categories: communs },
      { id: 'race', title: 'Votre race', categories: proper },
      { id: 'autres', title: 'Autres races et rituels', categories: others },
    ].filter((g) => g.categories.length > 0);
  });

  /** Règle d'aide sous l'en-tête (planche P3 / P4). */
  protected readonly rule = computed(() => {
    if (this.level() < 3) return "les souffles d'une autre race s'ouvrent au niveau 3.";
    const placed = this.otherRacePlaced();
    if (!placed) return "un seul souffle d'une autre race au plus.";
    const v = souffleView(placed.key, this.souffleCatalog(), this.ritualCatalog());
    const raceLabel = v.tag?.race ? ` (${RACE_LABELS[v.tag.race]})` : '';
    return `un seul souffle d'une autre race au plus — ${v.label}${raceLabel} l'occupe déjà.`;
  });

  // — Catégories repliables : dépliées par défaut, sauf celles où rien n'est choisissable —
  private initialOpen: Record<string, boolean> | null = null;
  private readonly manual = signal<Record<string, boolean>>({});

  protected isOpen(cat: PickerCategory): boolean {
    // Défauts figés à la première lecture : un `changed` reçu pendant la consultation ne replie
    // ni ne déplie une catégorie que le MJ est en train de lire.
    this.initialOpen ??= Object.fromEntries(
      this.groups()
        .flatMap((g) => g.categories)
        .map((c) => [c.id, c.choosable]),
    );
    return this.manual()[cat.id] ?? this.initialOpen[cat.id] ?? cat.choosable;
  }

  protected toggle(cat: PickerCategory): void {
    const open = this.isOpen(cat);
    this.manual.update((m) => ({ ...m, [cat.id]: !open }));
  }

  // — Souffle consulté —
  protected readonly selectedKey = signal<string | null>(null);

  protected readonly selected = computed<PickerRow | null>(() => {
    const key = this.selectedKey();
    if (!key) return null;
    return (
      this.groups()
        .flatMap((g) => g.categories)
        .flatMap((c) => c.sections)
        .flatMap((s) => s.rows)
        .find((r) => r.key === key) ?? null
    );
  });

  protected consult(key: string): void {
    this.selectedKey.set(key);
  }

  /** L'emplacement visé peut disparaître (niveau recalculé ailleurs) : placement alors impossible. */
  protected readonly slotExists = computed(() => this.slot() <= this.capacity());

  protected readonly placeable = computed(() => {
    const s = this.selected();
    return !!s && s.placement.placeable && this.slotExists();
  });

  /** Raison écrite pour laquelle « Mettre dans l'emplacement N » est inactif (`null` si actif). */
  protected readonly blockedReason = computed<string | null>(() => {
    const s = this.selected();
    if (!s) return this.theme.tone()['hd.picker_choose_hint'];
    if (!this.slotExists()) return this.theme.tone()['hd.picker_slot_gone'];
    return s.placement.reason;
  });

  /** Note de la zone de détail pour un souffle placeable déjà présent ailleurs. */
  protected readonly note = computed<string | null>(() => {
    const s = this.selected();
    return s?.mark ? `${s.mark} : un même souffle peut occuper plusieurs emplacements.` : null;
  });

  // — Annonce d'un placement devenu invalide pendant la consultation (mise à jour reçue) —
  protected readonly announcement = signal('');
  private lastPlaceable: { key: string; ok: boolean } | null = null;

  constructor() {
    effect(() => {
      const key = this.selectedKey();
      const ok = this.placeable();
      const reason = this.blockedReason();
      untracked(() => {
        const previous = this.lastPlaceable;
        if (key && previous?.key === key && previous.ok && !ok && reason) {
          this.announcement.set(
            fillTone(this.theme.tone()['hd.picker_blocked_announce'], {
              n: this.slot(),
              raison: reason,
            }),
          );
        }
        this.lastPlaceable = key ? { key, ok } : null;
      });
    });
  }

  /** « Mettre dans l'emplacement N » : sans effet tant que le souffle consulté n'est pas placeable. */
  protected place(): void {
    const s = this.selected();
    if (!s || !this.placeable()) return;
    this.chosen.emit(s.key);
  }
}
