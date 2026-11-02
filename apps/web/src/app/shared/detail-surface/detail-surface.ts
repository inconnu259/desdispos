import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { AppIcon } from '../../core/icons/app-icon';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import type { DetailRow } from './detail-surface-host';

/**
 * Surface de détail adaptative (Story 31.2, FR-20) — feuille montant du bas sur téléphone,
 * **fenêtre centrée modale** sur ordinateur. La bascule de présentation est purement CSS
 * (`detail-surface.scss`), au seuil unique `1024px` du reste du projet.
 *
 * ⚠️ Story 31.4 (contrat UI `ux-jdr-master-2026-08-31`, DESIGN §7.2) : sur ordinateur elle était un
 * panneau latéral NON modal (décision de la revue de la 31.2 : voile masqué, `aria-modal` et piège
 * de focus désactivés pour laisser la fiche interactive). Décision de l'utilisateur, 2026-09-20 :
 * fenêtre centrée, modale PARTOUT — voile visible, `aria-modal`, piège de focus, `Échap` et clic sur
 * le voile ferment. Conséquence : le voile recouvre les déclencheurs, il n'y a plus de
 * « remplacement en place » d'un terme par un autre (déjà vrai sur mobile).
 *
 * Composant PARTAGÉ (`apps/web/src/app/shared/`), utilisé par la fiche et l'assistant de création.
 * Rendu pur : contenu déjà résolu par l'appelant, aucune connaissance de qui l'affiche. Corps soit
 * en texte simple (`body`), soit structuré : tableau mécanique (`rows`) puis récit (`narrative`),
 * ce dernier replié par défaut sur téléphone.
 *
 * Extension rétro-compatible (Story 33.6, fenêtre de choix de la réserve de souffles) : en-tête et
 * pied PERSONNALISABLES par projection nommée (`[detail-header]`, `[detail-footer]`, activés par
 * `hasHeader`/`hasFooter`), largeur desktop par usage (`desktopWidth`), `aria-describedby`
 * optionnel. Dès qu'un slot est actif, le panneau devient une colonne : en-tête et pied restent
 * épinglés, seul le corps défile (pied avec son propre `max-height`). Sans slot, le rendu est
 * celui d'avant — seuls changent le bouton de fermeture (44 px, « Fermer la fenêtre » en desktop /
 * « Fermer la feuille » en mobile), les hauteurs en `dvh` (zone sûre incluse) et le respect de
 * `prefers-reduced-motion`.
 */
@Component({
  selector: 'app-detail-surface',
  standalone: true,
  imports: [CdkTrapFocus, AppIcon],
  templateUrl: './detail-surface.html',
  styleUrl: './detail-surface.scss',
})
export class DetailSurface {
  readonly title = input.required<string>();
  /** Corps de texte simple — ignoré quand `rows` ou `narrative` sont fournis. */
  readonly body = input<string>('');
  /** Tableau mécanique (Story 31.4) : lignes libellé / valeur, déjà filtrées par l'appelant. */
  readonly rows = input<DetailRow[]>([]);
  /** Récit d'ambiance, après le tableau. */
  readonly narrative = input<string>('');
  /** [Review][Patch] Jeton d'ouverture opaque — l'appelant incrémente une valeur à CHAQUE
   *  activation, y compris pour deux éléments dont le nom+texte seraient identiques. `title()`/
   *  `body()` seuls ne suffisent pas : deux chaînes égales ne redéclenchent pas l'effet ci-dessous
   *  (égalité de valeur des signaux), donc le focus ne rentrerait jamais dans le panneau pour ce
   *  cas précis (ex. le même talent choisi via la classe primaire ET secondaire). */
  readonly openToken = input<number>(0);
  /** Contenu PROJETÉ par l'appelant (`<ng-content>`, ex. le récapitulatif du wizard) : ni corps de
   *  texte ni repli « Aucune description disponible ». */
  readonly custom = input<boolean>(false);
  /** Story 33.6 — l'appelant projette son propre en-tête (`[detail-header]`, titre `h2` compris) à
   *  la place du titre par défaut. `title()` reste le nom accessible du dialogue. */
  readonly hasHeader = input<boolean>(false);
  /** Story 33.6 — l'appelant projette un pied épinglé (`[detail-footer]`), hors de la zone qui défile. */
  readonly hasFooter = input<boolean>(false);
  /** Story 33.6 — largeur de la fenêtre desktop en px (≥ 1024 px) ; `null` = largeur par défaut
   *  (560 px). Sans effet sur la feuille mobile. */
  readonly desktopWidth = input<number | null>(null);
  /** ⚠️ Story 40.1 — variante LARGE, rétro-compatible (désactivée par défaut, aucun autre usage ne
   *  change) : fenêtre `min(900px, 96vw)` en desktop, hauteur ≤ 94vh avec défilement interne, et
   *  plein écran sur mobile. Utilisée par la fenêtre d'une conjonction (création, puis détail en
   *  40.2). Prime sur `desktopWidth`. */
  readonly wide = input<boolean>(false);
  /** Story 33.6 — `id` de l'élément qui décrit le dialogue (`aria-describedby`), ex. un compteur. */
  readonly describedBy = input<string | null>(null);
  /** Story 33.6 — déplace l'hôte sous `<body>` après le premier rendu. Nécessaire quand la surface
   *  s'ouvre depuis un contexte d'empilement plus bas que la barre de navigation basse du shell
   *  (ex. un onglet Material, `z-index: 1`) : sans cela la barre (z-index 10) recouvre le bas de la
   *  feuille, boutons du pied compris. Désactivé par défaut : les autres usages gardent leur DOM. */
  readonly portal = input<boolean>(false);
  readonly closed = output<void>();

  protected readonly theme = inject(ThemeToneService);

  private readonly breakpointObserver = inject(BreakpointObserver);
  /** Même seuil unique que `CalendarView.DESKTOP_QUERY`/`CharacterSheet.DESKTOP_QUERY` — ne pas
   *  en introduire un second (règle établie par la story 31.1). */
  private static readonly DESKTOP_QUERY = '(min-width: 1024px)';

  /** Sert UNIQUEMENT à la divulgation du récit (mobile) : la modalité, elle, est inconditionnelle. */
  protected readonly isDesktop = toSignal(
    this.breakpointObserver.observe(DetailSurface.DESKTOP_QUERY).pipe(map((r) => r.matches)),
    { initialValue: this.breakpointObserver.isMatched(DetailSurface.DESKTOP_QUERY) },
  );

  /** Jeton d'ouverture pour lequel le récit a été déplié (mobile). Dérivé du jeton plutôt que
   *  remis à zéro par un `effect()` : le récit est ainsi replié à CHAQUE ouverture, jamais hérité
   *  du terme précédent, sans dépendre d'un effet dont le harnais zoneless ne garantit pas le
   *  re-déclenchement (cf. `detail-surface.spec.ts`). */
  private readonly narrativeOpenedFor = signal<number | null>(null);
  protected readonly narrativeOpen = computed(() => this.narrativeOpenedFor() === this.openToken());

  /** En-tête ou pied personnalisé : le panneau passe en colonne (corps seul défilant). */
  protected readonly split = computed(() => this.hasHeader() || this.hasFooter());

  /** Valeur de la variable CSS `--detail-surface-width` (lue à ≥ 1024 px uniquement). La variante
   *  large porte sa propre largeur (feuille de style) : aucune variable n'est posée. */
  protected readonly widthVar = computed(() => {
    if (this.wide()) return null;
    const width = this.desktopWidth();
    return width ? `${width}px` : null;
  });

  /** Même vocabulaire que la forme : fenêtre centrée en desktop, feuille basse en mobile. */
  protected readonly closeLabel = computed(
    () =>
      this.theme.tone()[
        this.isDesktop() ? 'shared.detail_close_window' : 'shared.detail_close_sheet'
      ],
  );

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  /**
   * 🚨 Trouvé à la vérification visuelle (31.2) : `cdkTrapFocusAutoCapture` ne capture le focus
   * qu'au MONTAGE du composant. Le focus est donc piloté ici, à CHAQUE ouverture (`openToken`), et
   * `cdkTrapFocusAutoCapture` est absent du template (gardé : `cdkTrapFocus`, pour le piège Tab).
   */
  private readonly focusOnContentChange = effect(() => {
    this.openToken();
    this.closeButton()?.nativeElement.focus();
  });

  constructor() {
    afterNextRender(() => {
      const host = this.host.nativeElement;
      if (!this.portal() || host.parentElement === document.body) return;
      document.body.appendChild(host);
      // Un nœud déplacé perd le focus : on le rend à la fenêtre (bouton de fermeture).
      this.closeButton()?.nativeElement.focus();
    });
    // L'hôte déplacé n'est plus un descendant du composant parent : Angular ne le retirerait pas.
    inject(DestroyRef).onDestroy(() => {
      if (this.portal()) this.host.nativeElement.remove();
    });
  }

  /** Le tableau existe : le récit peut se replier derrière lui. Sans tableau, le récit est le seul
   *  contenu — le cacher derrière un bouton ne laisserait qu'un panneau vide. */
  protected hasRows(): boolean {
    return this.rows().length > 0;
  }

  protected isStructured(): boolean {
    return this.hasRows() || !!this.narrative();
  }

  protected toggleNarrative(): void {
    this.narrativeOpenedFor.set(this.narrativeOpen() ? null : this.openToken());
  }

  protected close(): void {
    this.closed.emit();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.close();
    }
  }
}
