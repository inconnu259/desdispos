import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import type { ListViewMode } from '@master-jdr/shared';
import { API_BASE } from '../../core/api-base';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import {
  BANNER_VIEWBOX_HEIGHT,
  BANNER_VIEWBOX_WIDTH,
  bannerParams,
  partyMonogram,
  type BannerTint,
  type EmeraudeBanner,
  type ForestMobileParams,
  type ForetBanner,
  type GearTechnique,
  type SteampunkBanner,
} from '../../core/parties/party-banner.util';

/** Compteur d'instance : les identifiants SVG (`<use href>`, `<pattern>`, dégradés, filtres)
 *  doivent être uniques dans le document, or une liste rend jusqu'à une douzaine de bannières
 *  simultanées. Des identifiants fixes feraient pointer toutes les instances sur les défs de la
 *  première. */
let instanceCounter = 0;

/** Une volute de vapeur. Dérivée arithmétiquement du manomètre, **jamais tirée** : ajouter un
 *  tirage décalerait le flux PRNG et changerait toutes les bannières (AC2 de la Story 29.10). */
interface SteamPuff {
  x: number;
  y: number;
  r: number;
  delaySeconds: number;
}

/**
 * Rendu de la bannière générative d'une partie (Stories 29.10 et 29.11).
 *
 * **Purement présentationnel et purement dérivé** : il n'appelle aucun service de données et ne
 * tire rien lui-même — tous les paramètres viennent de `bannerParams()`, le point de dérivation
 * unique d'AD-19. C'est ce qui garantit que la grande carte, la vignette moyenne et la vignette
 * de liste ne peuvent pas diverger.
 *
 * **Décoratif** : `aria-hidden` sur la racine. Le nom de la partie est déjà affiché en toutes
 * lettres à côté dans les trois modes — la bannière n'ajoute aucune information, elle ne doit
 * donc pas en annoncer.
 *
 * **Animation (Story 29.11)** : les paramètres d'animation déjà tirés par 29.10 sont transmis au
 * CSS par des propriétés personnalisées (`--pb-speed`, `--pb-delay`, `--pb-drift`, `--pb-travel`).
 * Le déclenchement, lui, est entièrement porté par la feuille de style, scopé sous
 * `:host(.party-banner-host--large)` — les modes moyen et liste n'animent rien (AC2) **sans que
 * le balisage diffère**, ce qui préserve l'égalité stricte des compositions grand/moyen (AC3).
 */
@Component({
  selector: 'app-party-banner',
  standalone: true,
  templateUrl: './party-banner.html',
  styleUrl: './party-banner.scss',
  host: {
    '[class.party-banner-host--large]': "mode() === 'large'",
    '[class.party-banner-host--medium]': "mode() === 'medium'",
    '[class.party-banner-host--compact]': "mode() === 'compact'",
  },
})
export class PartyBanner {
  private readonly theme = inject(ThemeToneService);

  readonly partieId = input.required<string>();
  /** Sert **uniquement** au monogramme. Il n'entre pas dans la graine : renommer une partie ne
   *  change pas sa composition (AC2 de la Story 29.10). */
  readonly partieName = input.required<string>();
  readonly mode = input.required<ListViewMode>();
  /** Jeton de version de la couverture (Story 29.12, AD-19) — `null` = pas d'image, la bannière
   *  générée s'affiche. Non-null : l'image l'emporte dans les trois modes, **sans rendre la
   *  composition du tout** (AC2 seconde clause — une composition rendue puis masquée laisserait
   *  ses animations tourner sous l'image). */
  readonly coverImageVersion = input<string | null>(null);

  /** Repli si le fichier a disparu du disque (base/disque désynchronisés) — CAP-20 : aucune
   *  partie n'est jamais nue. Réinitialisé à chaque changement de couverture (nouvelle image
   *  déposée, ou instance réutilisée pour une autre partie dans une liste virtualisée). */
  protected readonly coverImageFailed = signal(false);

  constructor() {
    effect(() => {
      this.coverImageVersion(); // dépendance : tout changement de version retente le chargement
      untracked(() => this.coverImageFailed.set(false));
    });
  }

  protected readonly showCoverImage = computed(
    () => this.coverImageVersion() !== null && !this.coverImageFailed(),
  );

  protected readonly coverImageSrc = computed(() => {
    const version = this.coverImageVersion();
    if (version === null) return '';
    return `${API_BASE}/parties/${this.partieId()}/cover?mode=${this.mode()}&v=${version}`;
  });

  protected onCoverImageError(): void {
    this.coverImageFailed.set(true);
  }

  protected readonly viewBoxWidth = BANNER_VIEWBOX_WIDTH;
  protected readonly viewBoxHeight = BANNER_VIEWBOX_HEIGHT;
  protected readonly viewBox = `0 0 ${BANNER_VIEWBOX_WIDTH} ${BANNER_VIEWBOX_HEIGHT}`;

  private readonly uid = `pb${++instanceCounter}`;
  protected readonly backgroundId = `${this.uid}-bg`;
  protected readonly gridId = `${this.uid}-grid`;
  protected readonly haloGradientId = `${this.uid}-halo`;
  protected readonly tailGradientId = `${this.uid}-tail`;
  protected readonly headGradientId = `${this.uid}-head`;
  protected readonly steamGradientId = `${this.uid}-steam`;
  protected readonly softenId = `${this.uid}-soften`;

  /** Un seul appel de dérivation par instance, mémorisé. **Jamais depuis le template** : un appel
   *  de fonction dans un binding se réévalue à chaque cycle de détection, × 12 lignes en mode
   *  liste. */
  protected readonly params = computed(() =>
    bannerParams(this.partieId(), this.theme.activeTheme()),
  );

  /** Vues typées : `@switch` sur un champ ne restreint pas le type dans un template Angular.
   *  Trois signaux dédiés donnent au template un objet déjà discriminé. */
  protected readonly emeraude = computed<EmeraudeBanner | null>(() => {
    const p = this.params();
    return p.theme === 'grimoire-emeraude' ? p : null;
  });
  protected readonly foret = computed<ForetBanner | null>(() => {
    const p = this.params();
    return p.theme === 'foret-ancienne' ? p : null;
  });
  protected readonly steampunk = computed<SteampunkBanner | null>(() => {
    const p = this.params();
    return p.theme === 'atelier-cuivre' ? p : null;
  });

  protected readonly monogram = computed(() => partyMonogram(this.partieName()));

  /** Classe de teinte plutôt que style calculé : un `[style.color]` construit par concaténation
   *  passe par le sanitizer Angular et se fait silencieusement amputer. Ici, la feuille de style
   *  résout `--jdr-accent-1`/`--jdr-accent-2` du thème actif. */
  protected tintClass(tint: BannerTint): string {
    return tint === 'accent-1' ? 'tint-1' : 'tint-2';
  }

  protected gearHref(technique: GearTechnique): string {
    return `#${this.uid}-gear-${technique}`;
  }

  protected gearId(technique: GearTechnique): string {
    return `${this.uid}-gear-${technique}`;
  }

  protected backgroundFill(): string {
    return `url(#${this.backgroundId})`;
  }
  protected gridFill(): string {
    return `url(#${this.gridId})`;
  }
  protected haloFill(): string {
    return `url(#${this.haloGradientId})`;
  }
  protected tailFill(): string {
    return `url(#${this.tailGradientId})`;
  }
  protected headFill(): string {
    return `url(#${this.headGradientId})`;
  }
  protected steamFill(): string {
    return `url(#${this.steamGradientId})`;
  }
  protected softenFilter(): string {
    return `url(#${this.softenId})`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Transmission des paramètres d'animation au CSS (Story 29.11, Task 1)
  // ───────────────────────────────────────────────────────────────────────────

  /** Une propriété personnalisée destinée à `animation-duration`/`-delay` **doit porter son
   *  unité** — `7` est invalide, `7s` ne l'est pas. */
  protected seconds(value: number): string {
    return `${value.toFixed(2)}s`;
  }

  /** Unités de l'espace de dessin. En SVG, un `px` CSS vaut une unité utilisateur : c'est ce qui
   *  permet d'animer un `translate` en restant dans le repère du `viewBox`. */
  protected units(value: number): string {
    return `${value}px`;
  }

  /** Distance de vol d'une comète, dans son repère pivoté : elle doit traverser tout le cadre
   *  puis en sortir, quelle que soit sa longueur. */
  protected travel(comet: EmeraudeBanner['comets'][number]): string {
    return `${BANNER_VIEWBOX_WIDTH + comet.length * 2}px`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Géométries
  // ───────────────────────────────────────────────────────────────────────────

  /** Repère unique de la comète : un conteneur pivoté de θ, dans lequel la queue part de l'origine
   *  et la tête est posée à son extrémité. **Un seul θ** pilote orientation, position de tête et
   *  direction de vol (DESIGN.md §8). Le sens est appliqué DANS le repère pivoté, donc toujours
   *  accordé à θ. L'animation vit sur un `<g>` INTERNE — un élément ne porte qu'une seule
   *  propriété `transform`, l'animer ici écraserait ce placement. */
  protected cometTransform(comet: EmeraudeBanner['comets'][number]): string {
    return `translate(${comet.x} ${comet.y}) rotate(${comet.angle}) scale(${comet.direction} 1)`;
  }

  /** Queue effilée : pointue à la traîne (origine), large à la tête. Un rectangle donnait une
   *  barre — c'est ce que le retour utilisateur a relevé (« tout est très géométrique strict »). */
  protected cometTailPath(comet: EmeraudeBanner['comets'][number]): string {
    const halfHeight = comet.headSize / 3;
    return `M 0 0 L ${comet.length} ${-halfHeight} L ${comet.length} ${halfHeight} Z`;
  }

  /** Goutte asymétrique — l'équivalent en tracé du `border-radius: 0 70% 0 70%` de la maquette.
   *  Deux pointes opposées, deux flancs bombés. Centrée sur l'origine : le placement et
   *  l'inclinaison sont portés par `mobileTransform()`. */
  protected leafPath(mobile: ForestMobileParams): string {
    const h = mobile.size / 2;
    return `M ${-h} ${-h} Q ${h} ${-h} ${h} ${h} Q ${-h} ${h} ${-h} ${-h} Z`;
  }

  protected mobileTransform(mobile: ForestMobileParams): string {
    return `translate(${mobile.x} ${mobile.y}) rotate(${mobile.rotation})`;
  }

  protected gearTransform(gear: SteampunkBanner['gears'][number]): string {
    return `translate(${gear.x} ${gear.y}) scale(${gear.size / 100})`;
  }

  /** Volutes de vapeur, du côté opposé au manomètre. **Dérivées, jamais tirées** : les positions
   *  viennent d'une arithmétique sur le cadre, pas du flux PRNG — y toucher changerait toutes les
   *  bannières existantes. Seule leur présence (`steam`) est tirée. */
  protected steamPuffs(p: SteampunkBanner): SteamPuff[] {
    const fromLeft = p.gauge.corner === 'right';
    const baseX = fromLeft ? 34 : BANNER_VIEWBOX_WIDTH - 34;
    const step = fromLeft ? 13 : -13;
    return [0, 1, 2].map((i) => ({
      x: baseX + step * i,
      y: BANNER_VIEWBOX_HEIGHT - 16 - i * 13,
      r: 9 + i * 3,
      delaySeconds: i * 1.6,
    }));
  }
}
