import type { AbstractControl, FormGroup } from '@angular/forms';

/** Clés de ton du message « longueur minimale » (une par champ : le seuil est dans le texte). */
export type MinLengthToneKey = 'auth.field_pseudo_min' | 'auth.field_password_min';

/**
 * Clé de ton du message de validation à afficher sous un champ : UN SEUL à la fois (champ vide ⇒
 * « requis », sinon la première règle non respectée), ou `null` si le champ est valide.
 * Les règles elles-mêmes restent celles des `Validators` du formulaire.
 */
export function fieldErrorKey(
  control: AbstractControl,
  minLengthKey?: MinLengthToneKey,
): string | null {
  const errors = control.errors;
  if (!errors) return null;
  if (errors['required']) return 'auth.field_required';
  if (errors['email']) return 'auth.field_email_invalid';
  if (errors['minlength'] && minLengthKey) return minLengthKey;
  return null;
}

/**
 * Envoi d'un formulaire invalide : tous les messages apparaissent d'un coup et le focus va au
 * PREMIER champ invalide dans l'ordre du DOM. À appeler avant tout appel serveur ; les saisies ne
 * sont jamais effacées.
 */
export function rejectInvalidSubmit(form: FormGroup, host: HTMLElement): void {
  form.markAllAsTouched();
  const fields = host.querySelectorAll<HTMLElement>('[formControlName]');
  for (const field of Array.from(fields)) {
    const name = field.getAttribute('formControlName');
    if (name && form.get(name)?.invalid) {
      field.focus();
      return;
    }
  }
}

/**
 * Valeur de `aria-invalid` d'un champ : `'true'` quand il est invalide ET touché, sinon rien.
 * Material la supprime pour un champ vide et obligatoire (`aria-invalid` absent), ce qui rendrait
 * muet, pour un lecteur d'écran, le cas principal d'un envoi invalide (champ laissé vide).
 */
export function ariaInvalid(control: AbstractControl): 'true' | null {
  return control.touched && control.invalid ? 'true' : null;
}
