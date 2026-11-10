import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { GameSystemSchemaDto, PartieDto } from '@master-jdr/shared';
import { CharacterService } from '../../../core/characters/character.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

/** Une clé de fiche verrouillable proposée à la coche, avec ses éventuels sous-champs (`attributes`
 *  est aujourd'hui la seule clé object à en déclarer, cf. `GameSystemService.getSchema`). Dérivée
 *  entièrement de `sheetSchema` (AC1) — aucune clé écrite en dur ici. */
interface LockableSubField {
  key: string;
  label: string;
}

interface LockableField {
  key: string;
  label: string;
  subFields: LockableSubField[];
}

/**
 * Écran de configuration des cadenas de visibilité (Story 31.7) — MJ-only, atteignable depuis
 * `PartieDetail` (bouton « Confidentialité »). Patron le plus proche : `PollCreationComponent`
 * (petit composant autonome, formulaire déclaratif, sans câblage temps réel propre — cet écran
 * n'a pas besoin du sien, cf. Code Map du spec).
 *
 * Garde MJ-only : ni cet écran ni aucun `canActivate` ne la porte (aucun garde de route MJ-only
 * n'existe ailleurs dans ce routeur) — elle vient du backend (`PartiesService.getOwned()` sur le
 * GET et le PUT des cadenas). Un non-MJ atteignant l'URL directement obtient un 403/404 du GET
 * initial : `accessDenied` bascule à `true` et le formulaire n'est jamais rendu (AC3).
 */
@Component({
  selector: 'app-visibility-locks',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './visibility-locks.html',
  styleUrl: './visibility-locks.scss',
})
export class VisibilityLocks implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly partiesSvc = inject(PartiesService);
  private readonly characterSvc = inject(CharacterService);
  private readonly contextualNav = inject(ContextualNavService);
  protected readonly theme = inject(ThemeToneService);

  protected partieId = '';

  protected readonly partie = signal<PartieDto | null>(null);
  protected readonly schema = signal<GameSystemSchemaDto | null>(null);
  protected readonly lockedPaths = signal<Set<string>>(new Set());

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly accessDenied = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Dérivé de `schema().sheetSchema` — uniquement les clés `lockable: true` (AC1). L'ordre suit
   *  celui déclaré côté serveur (mêmes clés que `creationSteps`, jamais réordonné ici). */
  protected readonly lockableFields = computed<LockableField[]>(() => {
    const schema = this.schema();
    if (!schema) return [];
    return Object.entries(schema.sheetSchema)
      .filter(([, field]) => field.lockable === true)
      .map(([key, field]) => ({
        key,
        label: field.label,
        subFields: (field.lockableFields ?? []).map((subKey) => ({
          key: subKey,
          label: field.lockableFieldLabels?.[subKey] ?? subKey,
        })),
      }));
  });

  constructor() {
    effect(() => {
      const p = this.partie();
      if (!p) return;
      this.contextualNav.set({ title: this.theme.tone()['parties.locks_title'], subtitle: p.name });
    });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(this.theme.tone()['common.partie_introuvable']);
      this.loading.set(false);
      return;
    }
    this.partieId = id;

    // Chargés en parallèle via `allSettled` (pas `Promise.all`) : `getVisibilityLocks()` porte
    // SEUL la garde MJ-only (`getOwned()`) — son rejet, et lui seul, doit basculer `accessDenied`
    // (AC3). `get()` (accessible à tout membre) échouant pour une autre raison (réseau, 404) ne
    // doit jamais être confondu avec un refus d'accès : `error()` générique dans ce cas, jamais
    // `accessDenied` (revue de code).
    const [partieResult, locksResult] = await Promise.allSettled([
      this.partiesSvc.get(id),
      this.partiesSvc.getVisibilityLocks(id),
    ]);

    if (locksResult.status === 'rejected') {
      this.accessDenied.set(true);
      this.loading.set(false);
      return;
    }
    this.lockedPaths.set(
      new Set(locksResult.value.map((l) => this.pathKey(l.fieldKey, l.subField ?? undefined))),
    );

    if (partieResult.status === 'rejected') {
      this.error.set(this.theme.tone()['parties.locks_load_partie_error']);
      this.loading.set(false);
      return;
    }
    this.partie.set(partieResult.value);

    try {
      this.schema.set(await this.characterSvc.getGameSystemSchema(partieResult.value.gameSystemId));
    } catch {
      this.error.set(this.theme.tone()['parties.locks_load_schema_error']);
    } finally {
      this.loading.set(false);
    }
  }

  /** Clé de chemin locale (Set) — `:` comme séparateur (jamais `.`, réservé au format serveur) ;
   *  sûr car `fieldKey`/`subField` sont alphanumériques (`FIELD_KEY_PATTERN` côté API). */
  private pathKey(fieldKey: string, subField?: string): string {
    return subField ? `${fieldKey}:${subField}` : fieldKey;
  }

  protected isLocked(fieldKey: string, subField?: string): boolean {
    return this.lockedPaths().has(this.pathKey(fieldKey, subField));
  }

  /** Coche/décoche un chemin — la clé entière et chacun de ses sous-champs sont des chemins
   *  INDÉPENDANTS (I/O Matrix du spec) : cocher `attributes.AGI` seul n'affecte jamais l'état de
   *  la case `attributes` elle-même. */
  protected toggle(fieldKey: string, subField?: string): void {
    const key = this.pathKey(fieldKey, subField);
    const next = new Set(this.lockedPaths());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.lockedPaths.set(next);
  }

  /** Enregistrement DÉCLARATIF COMPLET (jamais un delta) — envoie l'état entier de `lockedPaths`,
   *  y compris vide (« MJ décoche tout puis enregistre » → `paths: []`, cf. I/O Matrix). */
  protected async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const paths = [...this.lockedPaths()].map((key) => {
        const [fieldKey, subField] = key.split(':');
        return subField ? { fieldKey, subField } : { fieldKey };
      });
      await this.partiesSvc.setVisibilityLocks(this.partieId, paths);
      void this.router.navigate(['/parties', this.partieId]);
    } catch {
      this.error.set(this.theme.tone()['parties.locks_save_error']);
    } finally {
      this.saving.set(false);
    }
  }

  protected cancel(): void {
    void this.router.navigate(['/parties', this.partieId]);
  }
}
