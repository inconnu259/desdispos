import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ForgotPassword } from './forgot-password';
import { AuthService } from '../../../core/auth/auth.service';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

async function createFixture(requestPasswordReset = vi.fn().mockResolvedValue(undefined)) {
  await TestBed.configureTestingModule({
    imports: [ForgotPassword],
    providers: [provideRouter([]), { provide: AuthService, useValue: { requestPasswordReset } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(ForgotPassword);
  fixture.detectChanges();
  const component = fixture.componentInstance as any;
  return { fixture, component, requestPasswordReset, el: fixture.nativeElement as HTMLElement };
}

// Story 34.3 — le mot de passe oublié n'avait aucune spec.
describe('ForgotPassword — structure, validation écrite et annonces (Story 34.3)', () => {
  const tone = TONE_MAP['grimoire-emeraude'];

  beforeEach(() => localStorage.setItem('jdr-theme', 'grimoire-emeraude'));
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('un seul h1 dans un <main>, une action principale, « Retour à la connexion » en secondaire', async () => {
    const { el } = await createFixture();

    const h1s = el.querySelectorAll('h1');
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent?.trim()).toBe(GRIMOIRE_TONE['common.mot_de_passe_oublie']);
    expect(el.querySelector('main')?.getAttribute('aria-labelledby')).toBe(h1s[0].id);
    // Bande de marque (story 34.4) : <header> frère de <main>, placé avant lui.
    expect(el.querySelector('main header.band')).toBeNull();
    expect(el.querySelector('app-auth-band + main')).not.toBeNull();
    const primary = el.querySelectorAll('.auth-primary');
    expect(primary.length).toBe(1);
    expect(primary[0].textContent?.trim()).toBe(GRIMOIRE_TONE['auth.forgot_submit']);
    const link = el.querySelector('.auth-secondary-actions a');
    expect(link?.textContent?.trim()).toBe(GRIMOIRE_TONE['common.retour_a_la_connexion']);
    expect(link?.getAttribute('href')).toBe('/login');
  });

  it('le conteneur role="status" existe avant l’envoi, vide', async () => {
    const { el } = await createFixture();
    const status = el.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.textContent?.trim()).toBe('');
  });

  it('envoi invalide : aucun appel serveur, message écrit, focus sur le champ, saisie conservée', async () => {
    const { fixture, component, requestPasswordReset, el } = await createFixture();
    component.form.setValue({ email: 'pas-un-email' });

    await component.submit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe(
      tone['auth.field_email_invalid'],
    );
    const input = el.querySelector('input[formControlName="email"]') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.value).toBe('pas-un-email');
  });

  it('champ vide : message « requis »', async () => {
    const { fixture, component, el } = await createFixture();

    await component.submit();
    fixture.detectChanges();

    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe(tone['auth.field_required']);
  });

  it('envoi réussi : message dans le conteneur role="status", focus déplacé, formulaire retiré', async () => {
    const { fixture, component, requestPasswordReset, el } = await createFixture();
    const status = el.querySelector('[role="status"]') as HTMLElement;
    component.form.setValue({ email: 'a@b.c' });

    await component.submit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(requestPasswordReset).toHaveBeenCalledWith('a@b.c');
    expect(el.querySelector('[role="status"]')).toBe(status);
    expect(status.textContent).toContain(GRIMOIRE_TONE['auth.forgot_sent']);
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('.auth-primary')).toBeNull();
    expect(status.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(status);
  });

  it('erreur après action : message sous le champ avec role="alert"', async () => {
    const { fixture, component, el } = await createFixture(
      vi.fn().mockRejectedValue(new Error('500')),
    );
    component.form.setValue({ email: 'a@b.c' });

    await component.submit();
    fixture.detectChanges();

    const alert = el.querySelector('p.error[role="alert"]');
    expect(alert?.textContent).toContain(GRIMOIRE_TONE['auth.forgot_error']);
  });
});
