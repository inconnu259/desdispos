import { Directive, signal } from '@angular/core';

/**
 * Story 34.2 — mécanisme partagé de révélation d'un champ de mot de passe.
 *
 * Posée sur l'`<input matInput>` : seule la propriété `type` bascule entre `password` et `text`.
 * Le contrôle de formulaire, la valeur, la validité, `autocomplete` et le focus ne sont jamais
 * touchés. L'état est propre à l'instance (donc à chaque champ), non persisté, et repart masqué à
 * chaque création du champ (écran rouvert, formulaire refermé puis rouvert).
 *
 * Se couple au bouton `app-password-toggle` via une référence de gabarit :
 * `<input appPasswordReveal #pw="appPasswordReveal" />` + `<app-password-toggle matSuffix [for]="pw" />`.
 */
@Directive({
  selector: 'input[appPasswordReveal]',
  exportAs: 'appPasswordReveal',
  host: {
    // Une fois en `type="text"`, claviers et navigateurs pourraient capitaliser, corriger ou
    // vérifier l'orthographe du mot de passe : on coupe ces aides, `autocomplete` reste intact.
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    '[type]': "revealed() ? 'text' : 'password'",
  },
})
export class PasswordReveal {
  readonly revealed = signal(false);

  toggle(): void {
    this.revealed.update((v) => !v);
  }
}
