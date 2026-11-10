import { Directive, ElementRef, afterEveryRender, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { ariaInvalid } from './auth-form';

/**
 * Pose `aria-invalid="true"` sur un champ invalide ET touché, après le rendu.
 *
 * Material (`MatInput`) lie lui-même `aria-invalid` et le retire pour un champ vide et obligatoire :
 * un `[attr.aria-invalid]` du gabarit perd alors contre cette liaison dès qu'une valeur valide est
 * effacée. Écrire l'attribut après chaque rendu rend l'état « invalide » indépendant de l'ordre
 * des liaisons ; quand le champ est valide, la valeur de Material est laissée telle quelle.
 */
@Directive({ selector: 'input[appAuthAriaInvalid]' })
export class AuthAriaInvalid {
  constructor() {
    const control = inject(NgControl);
    const input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
    afterEveryRender(() => {
      if (control.control && ariaInvalid(control.control) === 'true') {
        input.setAttribute('aria-invalid', 'true');
      }
    });
  }
}
