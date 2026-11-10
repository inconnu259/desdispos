import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { vi } from 'vitest';
import { TONE_MAP } from '../../core/theme/tones';
import { PasswordReveal } from './password-reveal';
import { PasswordToggle } from './password-toggle';

const THEME = 'grimoire-emeraude';

@Component({
  selector: 'app-host',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    PasswordReveal,
    PasswordToggle,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="submitted.set(submitted() + 1)">
      @if (open()) {
        <mat-form-field appearance="outline">
          <mat-label>Actuel</mat-label>
          <input
            matInput
            type="password"
            formControlName="current"
            autocomplete="current-password"
            appPasswordReveal
            #a="appPasswordReveal"
          />
          <app-password-toggle matSuffix [for]="a" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Nouveau</mat-label>
          <input
            matInput
            type="password"
            formControlName="next"
            autocomplete="new-password"
            appPasswordReveal
            #b="appPasswordReveal"
          />
          <app-password-toggle matSuffix [for]="b" />
        </mat-form-field>
      }
      <button type="submit" class="submit">Envoyer</button>
    </form>
  `,
})
class Host {
  readonly open = signal(true);
  readonly submitted = signal(0);
  readonly form = new FormBuilder().nonNullable.group({
    current: ['', Validators.required],
    next: ['', [Validators.required, Validators.minLength(8)]],
  });
}

function setup() {
  localStorage.setItem('jdr-theme', THEME);
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const inputs = () => Array.from(el.querySelectorAll('input')) as HTMLInputElement[];
  const toggles = () =>
    Array.from(el.querySelectorAll('app-password-toggle button')) as HTMLButtonElement[];
  return { fixture, el, inputs, toggles };
}

describe('PasswordReveal + PasswordToggle (Story 34.2)', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Host] }));
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('part masqué : type=password, aria-pressed=false, libellé « Afficher… », icône œil', () => {
    const { inputs, toggles, el } = setup();
    expect(inputs().map((i) => i.type)).toEqual(['password', 'password']);
    const btn = toggles()[0];
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe(TONE_MAP[THEME]['auth.password_show']);
    // Œil : contour seul, sans trait barré.
    expect(el.querySelectorAll('app-password-toggle')[0].querySelectorAll('path').length).toBe(1);
  });

  it('révéler : type=text, aria-pressed=true, libellé « Masquer… », icône œil barré', () => {
    const { fixture, inputs, toggles, el } = setup();
    toggles()[0].click();
    fixture.detectChanges();

    expect(inputs()[0].type).toBe('text');
    const btn = toggles()[0];
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe(TONE_MAP[THEME]['auth.password_hide']);
    // Œil barré : contour + trait.
    expect(el.querySelectorAll('app-password-toggle')[0].querySelectorAll('path').length).toBe(2);
  });

  it('re-masquer : retour à type=password et au libellé « Afficher… »', () => {
    const { fixture, inputs, toggles } = setup();
    toggles()[0].click();
    fixture.detectChanges();
    toggles()[0].click();
    fixture.detectChanges();

    expect(inputs()[0].type).toBe('password');
    expect(toggles()[0].getAttribute('aria-pressed')).toBe('false');
    expect(toggles()[0].getAttribute('aria-label')).toBe(TONE_MAP[THEME]['auth.password_show']);
  });

  it('coupe majuscule initiale, correction et orthographe, masqué comme révélé', () => {
    const { fixture, inputs, toggles } = setup();
    const check = () => {
      for (const field of inputs()) {
        expect(field.getAttribute('autocapitalize')).toBe('off');
        expect(field.getAttribute('autocorrect')).toBe('off');
        expect(field.getAttribute('spellcheck')).toBe('false');
      }
    };
    check();
    for (const b of toggles()) b.click();
    fixture.detectChanges();
    expect(inputs().map((i) => i.type)).toEqual(['text', 'text']);
    check();
    expect(inputs()[0].getAttribute('autocomplete')).toBe('current-password');
    expect(inputs()[1].getAttribute('autocomplete')).toBe('new-password');
  });

  it("l'icône est masquée aux technologies d'assistance", () => {
    const { el } = setup();
    expect(el.querySelector('app-password-toggle svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('story 51.7 : masqué = « oeil », révélé = « oeil-barre », aria-pressed suit l’état', () => {
    const { fixture, el, toggles } = setup();
    const iconName = () => toggles()[0].querySelector('app-icon')?.getAttribute('data-icon');
    expect(iconName()).toBe('oeil');
    expect(toggles()[0].getAttribute('aria-pressed')).toBe('false');

    toggles()[0].click();
    fixture.detectChanges();
    expect(iconName()).toBe('oeil-barre');
    expect(toggles()[0].getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('app-password-toggle .ic')).toBeNull();
  });

  it('le bouton est de type button et ne soumet jamais le formulaire', () => {
    const { fixture, toggles } = setup();
    expect(toggles()[0].type).toBe('button');
    toggles()[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.submitted()).toBe(0);
  });

  it("conserve la valeur, la validité, l'autocomplete et le contrôle du champ", () => {
    const { fixture, inputs, toggles } = setup();
    const host = fixture.componentInstance;
    const field = inputs()[1];
    field.value = 'motdepasse123';
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const validBefore = host.form.controls.next.valid;

    toggles()[1].click();
    fixture.detectChanges();

    expect(host.form.controls.next.value).toBe('motdepasse123');
    expect(host.form.controls.next.valid).toBe(validBefore);
    expect(validBefore).toBe(true);
    expect(field.value).toBe('motdepasse123');
    expect(field.getAttribute('autocomplete')).toBe('new-password');
    // Même élément DOM : le champ n'a pas été recréé (donc ni valeur ni focus perdus).
    expect(inputs()[1]).toBe(field);
  });

  it('le focus du champ est conservé à la bascule', () => {
    const { fixture, inputs } = setup();
    const field = inputs()[0];
    document.body.appendChild(fixture.nativeElement);
    field.focus();
    const directive = fixture.debugElement
      .queryAll((d) => d.name === 'input')[0]
      .injector.get(PasswordReveal);

    directive.toggle();
    fixture.detectChanges();

    expect(document.activeElement).toBe(field);
    fixture.nativeElement.remove();
  });

  it('un clic sur le bouton ne remonte pas au conteneur du champ (le focus reste au bouton)', () => {
    const { el, toggles } = setup();
    const onParent = vi.fn();
    el.querySelector('mat-form-field')!.addEventListener('click', onParent);
    toggles()[0].click();
    expect(onParent).not.toHaveBeenCalled();
  });

  it('deux champs indépendants : chaque bouton ne bascule que son propre champ', () => {
    const { fixture, inputs, toggles } = setup();
    toggles()[1].click();
    fixture.detectChanges();
    expect(inputs().map((i) => i.type)).toEqual(['password', 'text']);
    expect(toggles().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);

    toggles()[0].click();
    fixture.detectChanges();
    expect(inputs().map((i) => i.type)).toEqual(['text', 'text']);

    toggles()[1].click();
    fixture.detectChanges();
    expect(inputs().map((i) => i.type)).toEqual(['text', 'password']);
  });

  it('ordre de focus naturel : champ puis bouton, tous deux atteignables au clavier', () => {
    const { el } = setup();
    const order = Array.from(el.querySelectorAll('input, app-password-toggle button')).map((e) =>
      e.tagName.toLowerCase(),
    );
    expect(order).toEqual(['input', 'button', 'input', 'button']);
    for (const b of Array.from(el.querySelectorAll('app-password-toggle button'))) {
      expect((b as HTMLButtonElement).tabIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('champ refermé puis rouvert : à nouveau masqué', () => {
    const { fixture, inputs, toggles } = setup();
    toggles()[0].click();
    fixture.detectChanges();
    expect(inputs()[0].type).toBe('text');

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    expect(inputs().map((i) => i.type)).toEqual(['password', 'password']);
    expect(toggles().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
  });
});
