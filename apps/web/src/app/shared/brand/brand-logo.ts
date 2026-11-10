import { Component } from '@angular/core';

/**
 * Pictogramme « Dés Dispos » (d20 coché, story 34.4), repris de `logo/logo-picto.svg` de la passe UX
 * (`ux-jdr-master-2026-10-05`). Source unique du dessin dans l'interface Angular ; seule exception,
 * `public/favicon.svg` (statique, couleurs fixes, hors thème) répète les mêmes tracés et doit être
 * tenu à jour À LA MAIN en cas de modification du dessin.
 *
 * Inliné, jamais en `<img>` : une seule couleur, `currentColor` (la couleur de texte du contexte,
 * donc recolorée par le thème). La coche est évidée par `evenodd`, sans masque ni `id`, donc sans
 * collision possible entre plusieurs instances. Décoratif (`aria-hidden`) : le nom « Dés Dispos »
 * est toujours écrit à côté, en texte, ou porté par le nom accessible du lien qui l'entoure.
 *
 * Taille : variable CSS `--brand-logo-size` posée par le parent (défaut 46 px, taille de la bande).
 */
@Component({
  selector: 'app-brand-logo',
  template: `
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="3.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M32 2.5 L57.55 17.25 V46.75 L32 61.5 L6.45 46.75 V17.25 Z"
      />
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M32 13 V2.5 M32 13 L57.55 17.25 M32 13 L6.45 17.25 M48.45 41.5 L57.55 17.25 M48.45 41.5 L57.55 46.75 M48.45 41.5 L32 61.5 M15.55 41.5 L32 61.5 M15.55 41.5 L6.45 46.75 M15.55 41.5 L6.45 17.25"
      />
      <path
        fill="currentColor"
        fill-rule="evenodd"
        d="M32.87 12.5 L49.32 41 A1 1 0 0 1 48.45 42.5 L15.55 42.5 A1 1 0 0 1 14.68 41 L31.13 12.5 A1 1 0 0 1 32.87 12.5 Z M24.52 35.48 L29.02 39.98 A2.1 2.1 0 0 0 32.12 39.84 L39.82 30.54 A2.1 2.1 0 0 0 36.58 27.86 L30.35 35.38 L27.48 32.52 A2.1 2.1 0 0 0 24.52 35.48 Z"
      />
    </svg>
  `,
  styles: `
    :host {
      display: block;
      flex: none;
      width: var(--brand-logo-size, 46px);
      height: var(--brand-logo-size, 46px);
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class BrandLogo {}
