import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { Register } from './register';
import { AuthService } from '../../../core/auth/auth.service';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

async function createFixture(token: string | null) {
  const auth = {
    register: vi.fn().mockResolvedValue(undefined),
    login: vi.fn().mockResolvedValue(undefined),
  };
  await TestBed.configureTestingModule({
    imports: [Register],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) },
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(Register);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  fixture.detectChanges();
  const component = fixture.componentInstance as any;
  return { fixture, component, auth, navigate, el: fixture.nativeElement as HTMLElement };
}

describe('Register — inscription sur invitation (Story 34.2, non-régression)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('avec un jeton : le bouton est actif et l’inscription aboutit (register puis login)', async () => {
    const { fixture, component, auth, navigate, el } = await createFixture('jeton-valide');
    component.form.setValue({ email: 'a@b.c', pseudo: 'alice', password: 'motdepasse1' });
    fixture.detectChanges();

    const submit = el.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    expect(el.querySelector('p.error')).toBeNull();

    await component.submit();

    expect(auth.register).toHaveBeenCalledWith('a@b.c', 'alice', 'motdepasse1', 'jeton-valide');
    expect(auth.login).toHaveBeenCalledWith('a@b.c', 'motdepasse1');
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('sans jeton : message d’invitation inchangé, bouton désactivé, aucune inscription', async () => {
    const { fixture, component, auth, el } = await createFixture(null);
    component.form.setValue({ email: 'a@b.c', pseudo: 'alice', password: 'motdepasse1' });
    fixture.detectChanges();

    expect(el.querySelector('p.error')?.textContent).toContain(
      GRIMOIRE_TONE['auth.register_invite_only'].split('.')[0] + '.',
    );
    expect((el.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);

    await component.submit();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('le champ de mot de passe est révélable, la valeur et l’autocomplete sont conservés', async () => {
    const { fixture, component, el } = await createFixture('jeton-valide');
    component.form.setValue({ email: 'a@b.c', pseudo: 'alice', password: 'motdepasse1' });
    const input = el.querySelector('input[formControlName="password"]') as HTMLInputElement;
    const button = el.querySelector('app-password-toggle button') as HTMLButtonElement;

    expect(input.type).toBe('password');
    button.click();
    fixture.detectChanges();

    expect(input.type).toBe('text');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(input.getAttribute('autocomplete')).toBe('new-password');
    expect(component.form.getRawValue().password).toBe('motdepasse1');
    expect(button.type).toBe('button');
  });

  it('le lien « J’ai déjà un compte » vers /login est conservé', async () => {
    const { el } = await createFixture('jeton-valide');
    const link = Array.from(el.querySelectorAll('a')).find((a) =>
      a.textContent?.includes(GRIMOIRE_TONE['common.j_ai_deja_un_compte']),
    );
    expect(link?.getAttribute('href')).toBe('/login');
  });
});

describe('Register — structure et validation écrite (Story 34.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const tone = TONE_MAP['grimoire-emeraude'];

  it('un seul h1 dans un <main> ; aide « 8+ caractères » hors du libellé ; une action principale', async () => {
    const { el } = await createFixture('jeton-valide');

    const h1s = el.querySelectorAll('h1');
    expect(h1s.length).toBe(1);
    expect(el.querySelector('main')?.getAttribute('aria-labelledby')).toBe(h1s[0].id);
    // Bande de marque (story 34.4) : <header> frère de <main>, placé avant lui.
    expect(el.querySelector('main header.band')).toBeNull();
    expect(el.querySelector('app-auth-band + main')).not.toBeNull();
    const labels = Array.from(el.querySelectorAll('mat-label')).map((l) => l.textContent?.trim());
    expect(labels).toEqual([
      GRIMOIRE_TONE['common.email'],
      GRIMOIRE_TONE['auth.register_pseudo_label'],
      GRIMOIRE_TONE['common.mot_de_passe'],
    ]);
    expect(el.querySelector('mat-hint')?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['common.8_caracteres'],
    );
    expect(el.querySelectorAll('.auth-primary').length).toBe(1);
    expect(el.querySelector('.auth-secondary-actions a')?.getAttribute('href')).toBe('/login');
  });

  it('le message d’invitation présent au chargement est du texte simple, sans role="alert"', async () => {
    const { el } = await createFixture(null);
    expect(el.querySelector('p.error')).not.toBeNull();
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('envoi invalide : un message par règle, focus sur le premier champ invalide, aucun appel', async () => {
    const { fixture, component, auth, el } = await createFixture('jeton-valide');
    component.form.setValue({ email: 'pas-un-email', pseudo: 'ab', password: 'court' });

    await component.submit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(auth.register).not.toHaveBeenCalled();
    expect(auth.login).not.toHaveBeenCalled();
    const messages = Array.from(el.querySelectorAll('mat-error')).map((e) => e.textContent?.trim());
    expect(messages).toEqual([
      tone['auth.field_email_invalid'],
      tone['auth.field_pseudo_min'],
      tone['auth.field_password_min'],
    ]);
    // Le message remplace l'aide tant que la règle n'est pas respectée.
    expect(el.querySelector('mat-hint')).toBeNull();
    expect(document.activeElement).toBe(el.querySelector('input[formControlName="email"]'));
    expect(component.form.getRawValue()).toEqual({
      email: 'pas-un-email',
      pseudo: 'ab',
      password: 'court',
    });
  });

  it('champs vides : le message « requis » prime sur la règle de longueur', async () => {
    const { fixture, component, el } = await createFixture('jeton-valide');

    await component.submit();
    fixture.detectChanges();

    const messages = Array.from(el.querySelectorAll('mat-error')).map((e) => e.textContent?.trim());
    expect(messages).toEqual(Array(3).fill(tone['auth.field_required']));
  });

  it('seul le mot de passe est trop court : le focus va au mot de passe', async () => {
    const { fixture, component, el } = await createFixture('jeton-valide');
    component.form.setValue({ email: 'a@b.c', pseudo: 'alice', password: 'court' });

    await component.submit();
    fixture.detectChanges();

    expect(document.activeElement).toBe(el.querySelector('input[formControlName="password"]'));
  });

  it('une erreur après action porte role="alert"', async () => {
    const { fixture, component, auth, el } = await createFixture('jeton-valide');
    auth.register.mockRejectedValueOnce(new Error('409'));
    component.form.setValue({ email: 'a@b.c', pseudo: 'alice', password: 'motdepasse1' });

    await component.submit();
    fixture.detectChanges();

    expect(el.querySelector('p.error[role="alert"]')).not.toBeNull();
    expect(el.querySelectorAll('mat-error').length).toBe(0);
  });
});

describe('Register — aria-invalid après saisie puis effacement (Story 34.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('valeur valide saisie puis effacée, champ quitté : aria-invalid="true" et message « requis »', async () => {
    const { fixture, el } = await createFixture('jeton-valide');
    const input = el.querySelector('input[formControlName="pseudo"]') as HTMLInputElement;

    input.focus();
    input.value = 'alice';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).not.toBe('true');

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(input.getAttribute('aria-invalid')).toBe('true');
    const message = input.closest('mat-form-field')?.querySelector('mat-error');
    expect(message?.textContent?.trim()).toBe(TONE_MAP['grimoire-emeraude']['auth.field_required']);
  });
});
