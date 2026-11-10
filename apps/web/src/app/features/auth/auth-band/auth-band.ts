import { Component, computed, inject, signal } from '@angular/core';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import type { Theme } from '../../../core/theme/tones';
import { BrandLogo } from '../../../shared/brand/brand-logo';

/** Compteur d'instance : les `id` SVG (dégradés, motif, symboles, rouage) doivent être uniques dans
 *  le document. Des identifiants fixes feraient pointer deux bandes simultanées sur les défs de la
 *  première (même schéma que `PartyBanner`). */
let instanceCounter = 0;

type SceneKind = 'emeraude' | 'foret' | 'atelier';

/** Scène du thème actif. `Record<Theme, …>` : l'ajout ou le renommage d'un thème (épic 35) casse la
 *  compilation ici, seul endroit de la bande qui connaît les clés de thème. */
const SCENE_BY_THEME: Record<Theme, SceneKind> = {
  'grimoire-emeraude': 'emeraude',
  'foret-ancienne': 'foret',
  'atelier-cuivre': 'atelier',
};

/**
 * Bande de marque des écrans d'authentification (story 34.4, DESIGN.md §1 / §4 / §7).
 *
 * Un `<header>` frère de `<main>`, sans aucun `<h1>` : décor animé propre au thème actif (scène SVG
 * 440 × 180 + emblème en filigrane), logo « Dés Dispos », nom et accroche du thème. Scène, emblème
 * et accroche viennent du MÊME signal `ThemeToneService.activeTheme` que la classe `theme-*` de
 * `<body>` : ils ne peuvent pas diverger.
 *
 * Le décor est `aria-hidden` ; le nom et l'accroche sont du texte. Un clic ou un toucher sur le
 * fond animé fige l'animation sur place (`animation-play-state: paused`), un second la relance :
 * aucun bouton, état jamais mémorisé (la bande repart animée à chaque écran). Écarts WCAG 2.2.2
 * (partiel) et 2.1.1 acceptés et consignés (EXPERIENCE.md §11 j).
 */
@Component({
  selector: 'app-auth-band',
  imports: [BrandLogo],
  templateUrl: './auth-band.html',
  styleUrl: './auth-band.scss',
})
export class AuthBand {
  private readonly theme = inject(ThemeToneService);

  protected readonly scene = computed(() => SCENE_BY_THEME[this.theme.activeTheme()]);
  protected readonly tagline = computed(() => this.theme.tone()['auth.tagline']);

  /** Animation figée sur place par un clic sur la scène. Jamais persisté. */
  protected readonly paused = signal(false);

  private readonly uid = `ab${++instanceCounter}`;
  protected readonly ids = {
    h1: `${this.uid}-h1`,
    h2: `${this.uid}-h2`,
    tail: `${this.uid}-tail`,
    head: `${this.uid}-head`,
    mote: `${this.uid}-mote`,
    grid: `${this.uid}-grid`,
    steam: `${this.uid}-steam`,
    gear: `${this.uid}-gear`,
    emblem: `${this.uid}-emblem`,
  };
  /** Références `url(#…)` (remplissages) et `#…` (`<use>`) vers les défs ci-dessus. */
  protected readonly refs = {
    h1: `url(#${this.ids.h1})`,
    h2: `url(#${this.ids.h2})`,
    tail: `url(#${this.ids.tail})`,
    head: `url(#${this.ids.head})`,
    mote: `url(#${this.ids.mote})`,
    grid: `url(#${this.ids.grid})`,
    steam: `url(#${this.ids.steam})`,
    gear: `#${this.ids.gear}`,
    emblem: `#${this.ids.emblem}`,
  };

  /** Angles des dents : rouage de la scène d'Atelier (12 dents) et rouage-emblème (8 dents). */
  protected readonly gearTeeth = Array.from({ length: 12 }, (_, i) => i * 30);
  protected readonly emblemTeeth = Array.from({ length: 8 }, (_, i) => i * 45);

  protected togglePause(): void {
    this.paused.update((p) => !p);
  }
}
