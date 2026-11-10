import { Component } from '@angular/core';

/** Contour du corps du crayon (viewBox 32), pour vérifier la découpe du d20 autour de lui. */
export const PENCIL_POINTS: readonly (readonly [number, number])[] = [
  [19.5, 28.5],
  [20.42, 24.47],
  [26.94, 17.94],
  [30.06, 21.06],
  [23.53, 27.58],
];

/** Extrémités des arêtes du d20 arrêtées avant le crayon (chacune à 2,3 unités du crayon). */
export const D20_CUT_ENDS: readonly (readonly [number, number])[] = [
  [23.96, 17.67],
  [18.14, 24.1],
  [22.01, 19.63],
];

/**
 * Icône « créer » (story 38.1) : le d20 du logo traversé d'un crayon en bas à droite, repris de
 * `icone-B-de-crayon.svg` (passe UX `ux-jdr-master-2026-10-08`). Elle remplace le « + » générique.
 *
 * Dans la maquette, le d20 est évidé autour du crayon par un `<mask>`. Ici la découpe est faite
 * par la géométrie elle-même (aucun `mask`, `clipPath` ni `id`, donc aucune collision entre
 * plusieurs instances) : les arêtes du d20 sont arrêtées à 2,3 unités du crayon (2 de trait plus
 * 0,3 de jeu), aux points `D20_CUT_ENDS` (testés contre `PENCIL_POINTS`), et leurs extrémités sont à bout plat pour ne pas
 * déborder dans le vide. Si le dessin du crayon bouge, ces points sont à recalculer.
 *
 * Une seule couleur, `currentColor`. Décoratif (`aria-hidden`) : le nom du bouton est porté par son
 * libellé de thème (texte visible ou `aria-label`). Taille : variable CSS `--create-icon-size`
 * posée par le parent (défaut 24 px).
 */
@Component({
  selector: 'app-create-icon',
  template: `
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <!-- Contour du d20, ouvert aux deux endroits où le crayon le coupe (bouts plats). -->
      <path
        stroke-width="2"
        stroke-linecap="butt"
        d="M18.14 24.1 L14 26.5 L4.04 20.75 V9.25 L14 3.5 L23.96 9.25 L23.96 17.67"
      />
      <!-- Arêtes intérieures ; la dernière (vers le coin bas-droit) s'arrête avant le crayon. -->
      <path
        stroke-width="1.3"
        d="M14 3.5 V7.6 M14 7.6 L23.96 9.25 M14 7.6 L4.04 9.25 M20.4 18.7 L14 26.5 M7.6 18.7 L14 26.5 M7.6 18.7 L4.04 20.75 M7.6 18.7 L4.04 9.25"
      />
      <path stroke-width="1.3" stroke-linecap="butt" d="M22.01 19.63 L20.4 18.7 L23.96 9.25" />
      <!-- Facette centrale pleine. -->
      <path d="M14 7.6 L20.4 18.7 H7.6 Z" fill="currentColor" stroke="none" />
      <!-- Crayon : corps et trait de la pointe. -->
      <path stroke-width="2" d="M19.5 28.5 L20.42 24.47 L26.94 17.94 L30.06 21.06 L23.53 27.58 Z" />
      <path stroke-width="2" d="M24.96 19.92 L28.08 23.04" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
      flex: none;
      width: var(--create-icon-size, 24px);
      height: var(--create-icon-size, 24px);
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class CreateIcon {}
