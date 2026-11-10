import { Component, computed, input } from '@angular/core';
import { badgeOf, type GameSystemBadge } from '@master-jdr/shared';

/** Glyphe à afficher pour un système : R1 (Ryuutama), L1 (famille ralliement) ou aucun. */
export type SystemBadgeGlyph = GameSystemBadge;

/** Quel glyphe pour ce système ? Lu dans le registre `GAME_SYSTEMS` (champ `badge`) : Ryuutama R1,
 *  ralliement L1 ; les autres systèmes (Draconis…) n'ont pas de badge, ils gardent la seule
 *  pastille texte. Système inconnu → `null`. */
export function systemBadgeGlyph(systemId: string): SystemBadgeGlyph | null {
  return badgeOf(systemId);
}

/**
 * Badge rond du système d'une partie (story 38.5, UX-DR14) : R1 (carte pliée, trajet pointillé et
 * dé) pour Ryuutama, L1 (feu de camp, flamme sur deux bûches) pour un ralliement. Un autre système
 * (Draconis) n'affiche rien : sa pastille texte suffit.
 *
 * Géométrie reprise de `badge-R1-ryuutama-carte-trajet-de.svg` et `badge-L1-ralliement-feu-de-camp.svg`
 * (passe UX `ux-jdr-master-2026-10-08`, viewBox 32). Le carré du dé de R1, `#0d0a14` en dur dans la
 * maquette, suit ici le fond primaire du thème (`--jdr-bg`). Aucun `mask`, `clipPath` ni `id` :
 * plusieurs instances cohabitent sans collision.
 *
 * Rond de 26 px, glyphe de 19 px (jamais en dessous), fond `--jdr-bg`, bord `rgba(255,255,255,.28)`.
 * Une seule couleur de trait, `currentColor`. Purement décoratif (`aria-hidden`) : le système est
 * déjà nommé en toutes lettres par la pastille texte voisine. Le positionnement (coin bas-droit de
 * la vignette, décalage -6/-6) appartient au parent.
 */
@Component({
  selector: 'app-system-badge',
  template: `
    @switch (glyph()) {
      @case ('R1') {
        <svg
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M3 7 L11 5 L21 8 L29 6 V25 L21 27 L11 24 L3 26 Z" stroke-width="2" />
          <path d="M11 5 V24 M21 8 V27" stroke-width="1.3" />
          <rect class="die" x="5" y="16.5" width="7" height="7" rx="1.6" stroke-width="1.7" />
          <circle cx="8.5" cy="20" r=".95" fill="currentColor" stroke="none" />
          <path
            d="M12.5 19 C15 15.5 17 21 19.5 16 S23.5 13 25 11.6"
            stroke-width="1.8"
            stroke-dasharray="2 2.4"
          />
          <path d="M24.2 8.6 l3.4 3.4 M27.6 8.6 l-3.4 3.4" stroke-width="1.9" />
        </svg>
      }
      @case ('L1') {
        <svg
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M16 3.5 C19.5 8.5 22.5 10.5 22.5 15.5 C22.5 19.7 19.7 22 16 22 C12.3 22 9.5 19.7 9.5 15.5 C9.5 12.5 11.5 11.5 12.7 8.8 C13.7 10.8 15 11 16 3.5 Z"
            stroke-width="2"
          />
          <path
            d="M16 14.5 C17.4 16.3 18.4 17.2 18.4 18.6 C18.4 19.9 17.4 20.7 16 20.7 C14.6 20.7 13.6 19.9 13.6 18.6 C13.6 17.2 15 16.2 16 14.5 Z"
            fill="currentColor"
            stroke="none"
          />
          <path d="M6 28.5 L26 23.5 M6 23.5 L26 28.5" stroke-width="2.6" />
        </svg>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: var(--system-badge-size, 26px);
      height: var(--system-badge-size, 26px);
      border-radius: 50%;
      background: var(--jdr-bg, #0d0a14);
      border: 1px solid rgba(255, 255, 255, 0.28);
      color: var(--jdr-text, #e8e0f0);
    }
    :host([hidden]) {
      display: none;
    }
    svg {
      display: block;
      width: var(--system-badge-glyph, 19px);
      height: var(--system-badge-glyph, 19px);
    }
    /* Le dé de R1 (carré arrondi) prend le fond primaire du thème, pas un violet en dur. */
    .die {
      fill: var(--jdr-bg, #0d0a14);
    }
  `,
  host: {
    '[hidden]': '!glyph()',
  },
})
export class SystemBadge {
  /** Identifiant du système de la partie (`ryuutama`, `draconis`, `ralliement`…). */
  readonly systemId = input.required<string>();
  protected readonly glyph = computed(() => systemBadgeGlyph(this.systemId()));
}
