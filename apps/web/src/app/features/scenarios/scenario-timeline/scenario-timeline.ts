import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import type { CharacterDto, PartieKind, ScenarioDto, SeanceDto } from '@master-jdr/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { ScenariosService, matchesPartie } from '../../../core/scenarios/scenarios.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import {
  scenarioState,
  seanceState,
  type StatusBadgeState,
} from '../../../core/status/status-derivation';
import { toDateKey } from '../../calendar/day-detail.utils';
import { StatusBadge } from '../../../shared/status-badge/status-badge';
import { ScenarioStatusBadge } from '../scenario-status-badge/scenario-status-badge';
import {
  ScenarioReadDialog,
  type ScenarioReadDialogData,
} from '../scenario-read-dialog/scenario-read-dialog';

export interface TimelineNode {
  key: string;
  scenarios: ScenarioDto[];
}

const DESKTOP_QUERY = '(min-width: 768px)';
/** Distance de souris (px) au-delà de laquelle un mouseup ne doit plus ouvrir le dialogue (glisser, pas cliquer). */
const CLICK_VS_DRAG_THRESHOLD = 4;

function createdAtMs(s: ScenarioDto): number {
  return new Date(s.createdAt).getTime();
}

/**
 * Date EFFECTIVE d'une séance, ou `null` — **exactement** la cascade de `SeanceList.resolvedDate()`
 * (story 32.3 : la racine du DTO s'intercale entre le vote et l'inscription).
 *
 * 🚨 Une seule cascade pour toute l'app : si la chronologie résolvait la date autrement que la
 * liste des séances, les deux surfaces se contrediraient sur la même séance.
 */
function seanceIso(seance: SeanceDto): string | null {
  return seance.poll?.chosenDate ?? seance.dateValidee ?? seance.inscription?.dateValidee ?? null;
}

/** Les dates effectives d'un nœud, triées croissant. Tableau vide = nœud non planifié. */
function nodeDates(node: TimelineNode): string[] {
  return node.scenarios
    .flatMap((s) => s.seances)
    .map(seanceIso)
    .filter((iso): iso is string => iso !== null)
    .sort();
}

/**
 * Ordre des nœuds : par **première date effective**, les nœuds non planifiés en fin de ligne.
 *
 * 🚨 Trier sur `createdAt` seul (comportement d'avant la story 32.4) ment dès qu'un MJ crée ses
 * scénarios dans le désordre : la chronologie affichait alors un ordre de saisie, pas un ordre de
 * jeu.
 *
 * 🚨 Un `createdAt` n'est PAS comparable à une date de séance : un scénario non planifié créé
 * aujourd'hui se serait rangé avant tout ce qui est daté dans le futur. Les non planifiés sont donc
 * relégués en bloc après les datés, et départagés entre eux par `createdAt`.
 */
function compareNodes(a: TimelineNode, b: TimelineNode): number {
  const dateA = nodeDates(a)[0];
  const dateB = nodeDates(b)[0];
  if (dateA && dateB) return new Date(dateA).getTime() - new Date(dateB).getTime();
  if (dateA) return -1;
  if (dateB) return 1;
  return createdAtMs(a.scenarios[0]) - createdAtMs(b.scenarios[0]);
}

/** L'état d'un nœud = celui de son scénario représentatif (un nœud COURANT empilé n'agrège que
 *  des COURANT, cf. `buildNodes`). Dérivé par `scenarioState()`, jamais redéfini ici. */
function nodeState(node: TimelineNode): StatusBadgeState {
  return scenarioState(node.scenarios[0].status);
}

/**
 * Classe de la pastille ancrée sur la ligne.
 *
 * 🚨 Le brouillon reçoit une classe de FORME (contour tireté), jamais une cinquième teinte — même
 * arbitrage que `StatusBadge.cssClass()`, et pour la même raison : ne pas émettre la classe de
 * teinte est plus sûr que la surcharger ensuite.
 */
function nodeDotClass(node: TimelineNode): string {
  const state = nodeState(node);
  return state.draft ? 'node__dot--draft' : `node__dot--${state.tone}`;
}

/** « 12 juin », « 3 juil. » — factuel, jamais thématisé (`theme.tone()` ne sert qu'aux libellés
 *  d'état). Même mise en forme que la liste des séances : `Intl` fr-FR, fuseau UTC. */
function formatDayMonth(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

/**
 * La plage de dates d'un nœud, formulée selon son état :
 * - `PASSE` : « 12 juin — 3 juil. », ou la date seule quand les séances tombent le même jour ;
 * - `COURANT` : « depuis le 24 juil. » — la campagne y est, elle n'en est pas encore sortie ;
 * - `A_VENIR` / `BROUILLON` : « à partir du 2 sept. » — rien n'a commencé.
 *
 * 🚨 « Depuis » suppose un jour DÉJÀ VÉCU. Un scénario ouvert avant sa première séance (cas
 * courant : le MJ le passe en COURANT en préparant la suite) aurait annoncé « depuis » une date qui
 * n'a pas eu lieu. Quand la première date effective est encore à venir, c'est « à partir du ».
 *
 * Sans aucune date exploitable : « Non planifié » — dégradation honnête, jamais une date inventée.
 *
 * @param todayKey le jour courant en `YYYY-MM-DD` — injecté, jamais lu de l'horloge ici (fonction
 *   pure, et une seule source de « aujourd'hui » par écran, comme dans `seanceState()`).
 * @param tone le registre de ton du thème actif — injecté lui aussi, pour que la fonction reste pure
 *   (les formulations « depuis le », « à partir du », « Non planifié » viennent du registre).
 */
function nodeDateLabel(node: TimelineNode, todayKey: string, tone: Record<string, string>): string {
  const dates = nodeDates(node);
  if (dates.length === 0) return tone['scenarios.timeline_not_planned'];
  const first = dates[0];
  const last = dates[dates.length - 1];
  const started = first.substring(0, 10) <= todayKey;
  switch (node.scenarios[0].status) {
    case 'COURANT':
      return fillTone(
        started ? tone['scenarios.timeline_since'] : tone['scenarios.timeline_from'],
        { date: formatDayMonth(first) },
      );
    case 'A_VENIR':
    case 'BROUILLON':
      return fillTone(tone['scenarios.timeline_from'], { date: formatDayMonth(first) });
    case 'PASSE':
      return first.substring(0, 10) === last.substring(0, 10)
        ? formatDayMonth(first)
        : `${formatDayMonth(first)} — ${formatDayMonth(last)}`;
  }
}

/**
 * Regroupe les scénarios visibles en nœuds triés chronologiquement. `includeBrouillon` (vue MJ
 * uniquement, AD-6 : jamais pour un joueur) garde les BROUILLON, chacun son propre nœud (jamais
 * fusionné avec le groupe COURANT). Tous les scénarios COURANT simultanés (épisodique) sont
 * fusionnés en un seul nœud empilé (AC5).
 *
 * 🚨 **Seul point de masquage anti-spoil de toute la surface** (AD-6). Le compteur d'en-tête se
 * dérive des nœuds RENDUS (`visibleCount`), jamais de la liste brute : aucun chemin ne peut donc
 * afficher à un joueur un total qui trahirait l'existence d'un brouillon.
 */
function buildNodes(scenarios: ScenarioDto[], includeBrouillon: boolean): TimelineNode[] {
  const visible = includeBrouillon ? scenarios : scenarios.filter((s) => s.status !== 'BROUILLON');
  const sorted = [...visible].sort((a, b) => createdAtMs(a) - createdAtMs(b));

  const nodes: TimelineNode[] = [];
  const courantGroup: ScenarioDto[] = [];
  for (const s of sorted) {
    if (s.status === 'COURANT') {
      courantGroup.push(s);
    } else {
      nodes.push({ key: s.id, scenarios: [s] });
    }
  }
  if (courantGroup.length > 0) {
    nodes.push({ key: `courant-${courantGroup[0].id}`, scenarios: courantGroup });
  }
  // Story 32.4 : la ligne raconte le JEU, pas la saisie — tri par première date effective, non
  // planifiés en fin. Le pré-tri ci-dessus reste, il fixe l'ordre d'empilement des COURANT.
  nodes.sort(compareNodes);
  return nodes;
}

@Component({
  selector: 'app-scenario-timeline',
  imports: [ScenarioStatusBadge, StatusBadge, MatButtonModule, NgTemplateOutlet],
  templateUrl: './scenario-timeline.html',
  styleUrl: './scenario-timeline.scss',
})
export class ScenarioTimeline {
  private readonly scenariosService = inject(ScenariosService);
  private readonly dialog = inject(MatDialog);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly theme = inject(ThemeToneService);

  readonly partieId = input.required<string>();
  /** Vue MJ : affiche aussi les BROUILLON (jamais pour un joueur, AD-6), stylés distinctement. */
  readonly isMj = input(false);
  readonly partieKind = input.required<PartieKind>();
  readonly characters = input<CharacterDto[]>([]);

  protected readonly isDesktop = toSignal(
    this.breakpointObserver.observe(DESKTOP_QUERY).pipe(map((r) => r.matches)),
    { initialValue: this.breakpointObserver.isMatched(DESKTOP_QUERY) },
  );

  private readonly scenarios = signal<ScenarioDto[]>([]);
  protected readonly loadError = signal<string | null>(null);
  /**
   * Passe à `true` dès que le PREMIER `listAll()` a tranché (réussite ou échec).
   *
   * 🚨 Sans ce drapeau, `scenarios` partant à `[]`, l'état vide et le compteur affirmaient
   * « Aucun scénario pour l'instant. » / « 0 scénario » à chaque ouverture de l'onglet, le temps de
   * la requête — une affirmation fausse, là où la piste était simplement muette avant la story.
   */
  protected readonly loaded = signal(false);

  protected readonly nodes = computed(() => buildNodes(this.scenarios(), this.isMj()));

  /**
   * Le compteur d'en-tête — DÉRIVÉ des nœuds rendus, jamais recompté sur la liste brute.
   *
   * 🚨 C'est ce qui rend l'écart MJ/joueur automatique : un joueur n'a aucun nœud brouillon, donc
   * aucun brouillon dans son total. Recompter ailleurs rouvrirait la fuite que `buildNodes` ferme.
   */
  protected readonly visibleCount = computed(() =>
    this.nodes().reduce((total, node) => total + node.scenarios.length, 0),
  );

  protected readonly countLabel = computed(() => {
    const n = this.visibleCount();
    const key = n > 1 ? 'scenarios.timeline_count_many' : 'scenarios.timeline_count_one';
    return fillTone(this.theme.tone()[key], { n });
  });

  protected readonly track = viewChild<ElementRef<HTMLElement>>('track');
  protected readonly fadeStart = signal(false);
  protected readonly fadeEnd = signal(false);
  protected readonly dragging = signal(false);
  private dragStartX = 0;
  private dragStartScrollLeft = 0;
  private dragMoved = false;
  private anchoredOnce = false;
  // Incrémenté à chaque appel de loadScenarios() — permet d'ignorer une réponse HTTP obsolète qui
  // résoudrait après une réponse plus récente (deux changed() rapprochés, ex. deux champs modifiés
  // coup sur coup), pour ne jamais laisser une réponse périmée écraser un état plus à jour.
  private loadGeneration = 0;
  // Garde anti-démontage (AC3) : évite une écriture sur `scenarios`/`loadError` si la réponse HTTP
  // résout après que le composant a été détruit (ex. navigation rapide hors de la page).
  private destroyed = false;

  private readonly currentUserId = computed(() => this.auth.currentUser()?.id);

  /**
   * Jour courant figé à la CONSTRUCTION, une seule fois pour toute la chronologie — même patron que
   * `SeanceList.todayKey` / `CalendarView.todayKey`. Si chaque badge relisait l'horloge, deux
   * séances rendues de part et d'autre de minuit ne compareraient plus au même « aujourd'hui ».
   */
  private readonly todayKey = toDateKey(new Date());

  /** Classe de pastille — helper PUR, aucune lecture d'état (testable sans TestBed, même partage
   *  des rôles que `status-derivation.ts` / `StatusBadge`). */
  protected readonly nodeDotClass = nodeDotClass;

  /** Seule la date du jour vient du composant : le calcul du libellé, lui, reste pur. */
  protected nodeDateLabel(node: TimelineNode): string {
    return nodeDateLabel(node, this.todayKey, this.theme.tone());
  }

  /** « Séance N » — l'index est 0-based côté gabarit, le libellé est 1-based. */
  protected seanceLabel(index: number): string {
    return fillTone(this.theme.tone()['common.seance_n'], { n: index + 1 });
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });

    // Recharge au montage ET à chaque mutation notifiée par ScenariosService (create/update/open
    // déclenchés depuis un autre onglet Angular Material de la même page, ex. ScenarioList — pas
    // un onglet navigateur, qu'un simple signal ne peut pas synchroniser) — évite d'exiger un F5
    // pour voir un scénario nouvellement créé ou ouvert aux joueurs apparaître ici. Story 17.3 (AC1) :
    // ignore les mutations notifiées pour une autre Partie — ne recharge que si la Partie affichée
    // change (montage, réutilisation du composant) ou si la mutation concerne CETTE Partie.
    let lastPartieId: string | undefined;
    effect(() => {
      const partieId = this.partieId();
      const change = this.scenariosService.changed();
      const partieIdChanged = partieId !== lastPartieId;
      lastPartieId = partieId;
      if (!partieIdChanged && change !== null && !matchesPartie(change, partieId)) {
        return;
      }
      untracked(() => this.loadScenarios(partieId));
    });

    // S'exécute après chaque rendu où track()/nodes()/isDesktop() changent — couvre le cas où les
    // données arrivent après le premier rendu (chargement asynchrone).
    effect(() => {
      const trackEl = this.track()?.nativeElement;
      const nodeList = this.nodes();
      if (!trackEl || !this.isDesktop() || nodeList.length === 0) return;

      // Initialise les fondus dès que le contenu est disponible, pas seulement au premier scroll.
      queueMicrotask(() => this.updateFades());

      // Ancrage sur le COURANT une seule fois (AC6 : "à son premier affichage") — un recalcul
      // ultérieur de nodes()/isDesktop() ne doit pas re-tirer le scroll de l'utilisateur.
      if (this.anchoredOnce) return;
      const courantIndex = nodeList.findIndex((n) =>
        n.scenarios.some((s) => s.status === 'COURANT'),
      );
      if (courantIndex === -1) return;

      queueMicrotask(() => {
        const nodeEl = trackEl.querySelectorAll<HTMLElement>('.node')[courantIndex];
        nodeEl?.scrollIntoView({ inline: 'center', behavior: 'auto' });
        this.anchoredOnce = true;
      });
    });
  }

  private async loadScenarios(partieId: string): Promise<void> {
    const generation = ++this.loadGeneration;
    try {
      const scenarios = await this.scenariosService.listAll(partieId);
      if (this.destroyed || generation !== this.loadGeneration) return; // réponse obsolète, une requête plus récente est en vol
      this.scenarios.set(scenarios);
      this.loadError.set(null);
      this.loaded.set(true);
    } catch {
      if (this.destroyed || generation !== this.loadGeneration) return;
      this.loadError.set(this.theme.tone()['scenarios.timeline_load_error']);
      this.loaded.set(true);
    }
  }

  // Bug fix : un premier chargement transitoirement en échec (réseau, montée en charge) ne se
  // réparait auparavant que via un événement SSE fortuit (reconnexion native EventSource, ~3s+) —
  // affordance manuelle immédiate plutôt que d'attendre.
  protected retry(): void {
    void this.loadScenarios(this.partieId());
  }

  protected openDetail(scenario: ScenarioDto): void {
    if (this.dragMoved) {
      this.dragMoved = false;
      return;
    }
    // MJ + BROUILLON/A_VENIR/COURANT : direction la fiche d'édition (comme depuis ScenarioList),
    // jamais le dialogue anti-spoil lecture seule — le MJ est l'auteur du scénario, il n'a rien à se
    // cacher à lui-même ; A_VENIR porte le CTA « Marquer comme Courant » (Story 7.6, AC8), COURANT
    // porte le CTA « Clôturer le scénario » (Story 7.7, AC6). PASSE reste ouvert via
    // ScenarioReadDialog même pour le MJ (pas de vue MJ dédiée pour ce statut, contenu déjà complet).
    if (
      this.isMj() &&
      (scenario.status === 'BROUILLON' ||
        scenario.status === 'A_VENIR' ||
        scenario.status === 'COURANT')
    ) {
      void this.router.navigate(['/parties', this.partieId(), 'scenarios', scenario.id], {
        state: { scenario },
      });
      return;
    }
    this.dialog.open<ScenarioReadDialog, ScenarioReadDialogData, void>(ScenarioReadDialog, {
      data: {
        scenario,
        partieKind: this.partieKind(),
        characters: this.characters(),
        isMj: this.isMj(),
      },
    });
  }

  /**
   * L'état affiché d'une séance — dérivé, jamais servi (AD-20 : aucun champ `status` sur
   * `SeanceDto`), et identique à celui que `SeanceList` montre pour la même séance.
   */
  protected seanceBadge(seance: SeanceDto): StatusBadgeState {
    return seanceState(seance, this.currentUserId(), this.todayKey);
  }

  // Story 8.7, AC7 : date résolue d'une séance affichée sur la carte du scénario — même source
  // que SeanceList (poll.chosenDate ?? dateValidee racine ?? inscription.dateValidee).
  protected seanceDateLabel(seance: SeanceDto): string {
    const iso = seanceIso(seance);
    if (!iso) return this.theme.tone()['common.date_a_definir'];
    // Story 47.3 : une plage de plusieurs jours s'écrit « 6 nov. → 8 nov. » (un seul jour : inchangé).
    if (seance.endDate && seance.endDate.substring(0, 10) > iso.substring(0, 10)) {
      return `${formatDayMonth(iso)} → ${formatDayMonth(seance.endDate)}`;
    }
    return formatDayMonth(iso);
  }

  protected onCardKeydown(event: KeyboardEvent, scenario: ScenarioDto): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.openDetail(scenario);
  }

  protected onNodeFocus(index: number): void {
    const trackEl = this.track()?.nativeElement;
    if (!trackEl) return;
    const nodeEl = trackEl.querySelectorAll<HTMLElement>('.node')[index];
    nodeEl?.scrollIntoView({ inline: 'center', behavior: this.scrollBehavior() });
  }

  /**
   * `prefers-reduced-motion` : le CSS coupe ses propres transitions, mais un `scrollIntoView`
   * lancé depuis le TS ne passe par aucune feuille de style — il faut le lui demander ici.
   * La garde `typeof` couvre les environnements sans `matchMedia` (rendu serveur, jsdom ancien).
   */
  private scrollBehavior(): ScrollBehavior {
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return reduced ? 'auto' : 'smooth';
  }

  protected onWheel(event: WheelEvent): void {
    const trackEl = this.track()?.nativeElement;
    if (!trackEl) return;
    event.preventDefault();
    // Un swipe trackpad horizontal fournit deltaX (deltaY≈0) ; une molette verticale classique
    // fournit deltaY — on privilégie deltaX quand il est présent pour ne pas casser le geste natif.
    trackEl.scrollLeft += event.deltaX !== 0 ? event.deltaX : event.deltaY;
    this.updateFades();
  }

  protected onScroll(): void {
    this.updateFades();
  }

  private updateFades(): void {
    const trackEl = this.track()?.nativeElement;
    if (!trackEl) return;
    this.fadeStart.set(trackEl.scrollLeft > 0);
    this.fadeEnd.set(trackEl.scrollLeft < trackEl.scrollWidth - trackEl.clientWidth);
  }

  protected onMouseDown(event: MouseEvent): void {
    const trackEl = this.track()?.nativeElement;
    if (!trackEl) return;
    event.preventDefault(); // évite la sélection de texte native pendant le glisser-déposer
    this.dragging.set(true);
    this.dragMoved = false;
    this.dragStartX = event.clientX;
    this.dragStartScrollLeft = trackEl.scrollLeft;
  }

  protected onMouseMove(event: MouseEvent): void {
    if (!this.dragging()) return;
    const trackEl = this.track()?.nativeElement;
    if (!trackEl) return;
    const delta = event.clientX - this.dragStartX;
    if (Math.abs(delta) > CLICK_VS_DRAG_THRESHOLD) this.dragMoved = true;
    trackEl.scrollLeft = this.dragStartScrollLeft - delta;
    this.updateFades();
  }

  // Écoute au niveau document (pas seulement sur .track) : relâcher le bouton ou continuer à
  // déplacer la souris hors des limites du composant ne doit jamais laisser `dragging` bloqué.
  @HostListener('document:mouseup')
  protected onDocumentMouseUp(): void {
    this.dragging.set(false);
  }

  @HostListener('document:mousemove', ['$event'])
  protected onDocumentMouseMove(event: MouseEvent): void {
    this.onMouseMove(event);
  }
}
