import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ResetPassword } from './reset-password';
import { AuthService } from '../../../core/auth/auth.service';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

async function createFixture(token: string | null) {
  const auth = { resetPassword: vi.fn().mockResolvedValue(undefined) };
  const paramMap = convertToParamMap(token ? { token } : {});
  await TestBed.configureTestingModule({
    imports: [ResetPassword],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap }, paramMap: of(paramMap) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ResetPassword);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('ResetPassword — champ révélable (Story 34.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('le nouveau mot de passe est révélable puis re-masquable, autocomplete conservé', async () => {
    const { fixture, el } = await createFixture('jeton-valide');
    const input = el.querySelector('input[formControlName="newPassword"]') as HTMLInputElement;
    const button = el.querySelector('app-password-toggle button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.type).toBe('button');

    expect(input.type).toBe('password');
    button.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(input.getAttribute('autocomplete')).toBe('new-password');

    button.click();
    fixture.detectChanges();
    expect(input.type).toBe('password');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(input.getAttribute('autocomplete')).toBe('new-password');
  });

  it('sans jeton : lien invalide affiché et bouton de soumission désactivé', async () => {
    const { el } = await createFixture(null);
    expect(el.querySelector('p.error')?.textContent).toContain('Lien invalide');
    expect((el.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ResetPassword — structure et validation écrite (Story 34.3)', () => {
  const tone = TONE_MAP['grimoire-emeraude'];

  beforeEach(() => localStorage.setItem('jdr-theme', 'grimoire-emeraude'));
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('un seul h1 dans un <main> ; libellé sans consigne, aide « 8+ caractères » en mat-hint', async () => {
    const { el } = await createFixture('jeton-valide');

    const h1s = el.querySelectorAll('h1');
    expect(h1s.length).toBe(1);
    expect(el.querySelector('main')?.getAttribute('aria-labelledby')).toBe(h1s[0].id);
    // Bande de marque (story 34.4) : <header> frère de <main>, placé avant lui.
    expect(el.querySelector('main header.band')).toBeNull();
    expect(el.querySelector('app-auth-band + main')).not.toBeNull();
    expect(el.querySelector('mat-label')?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['common.nouveau_mot_de_passe'],
    );
    expect(el.querySelector('mat-hint')?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['common.8_caracteres'],
    );
    expect(el.querySelectorAll('.auth-primary').length).toBe(1);
  });

  it('« Lien invalide. » présent au chargement : texte simple sans role="alert" ; « Refaire une demande » en secondaire', async () => {
    const { el } = await createFixture(null);

    expect(el.querySelector('p.error')?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['common.lien_invalide'],
    );
    expect(el.querySelector('[role="alert"]')).toBeNull();
    const links = Array.from(el.querySelectorAll('.auth-secondary-actions a')).map((a) => [
      a.textContent?.trim(),
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      [GRIMOIRE_TONE['auth.reset_redo_link'], '/forgot-password'],
      [GRIMOIRE_TONE['common.retour_a_la_connexion'], '/login'],
    ]);
  });

  it('avec un jeton valide, « Refaire une demande » n’est pas proposé', async () => {
    const { el } = await createFixture('jeton-valide');
    const labels = Array.from(el.querySelectorAll('.auth-secondary-actions a')).map((a) =>
      a.textContent?.trim(),
    );
    expect(labels).toEqual([GRIMOIRE_TONE['common.retour_a_la_connexion']]);
  });

  it('envoi invalide : aucun appel serveur, message « 8 caractères minimum », focus, saisie conservée', async () => {
    const { fixture, el } = await createFixture('jeton-valide');
    const component = fixture.componentInstance as any;
    component.form.setValue({ newPassword: 'court' });

    await component.submit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe(
      tone['auth.field_password_min'],
    );
    expect(el.querySelector('mat-hint')).toBeNull();
    const input = el.querySelector('input[formControlName="newPassword"]') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.value).toBe('court');
  });

  it('champ vide : message « requis »', async () => {
    const { fixture, el } = await createFixture('jeton-valide');
    const component = fixture.componentInstance as any;

    await component.submit();
    fixture.detectChanges();

    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe(tone['auth.field_required']);
  });
});

describe('ResetPassword — erreur après action (Story 34.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('échec : message role="alert" et « Refaire une demande » proposé en action secondaire', async () => {
    const { fixture, el } = await createFixture('jeton-valide');
    const auth = TestBed.inject(AuthService) as unknown as {
      resetPassword: ReturnType<typeof vi.fn>;
    };
    auth.resetPassword.mockRejectedValueOnce(new Error('400'));
    const component = fixture.componentInstance as any;
    component.form.setValue({ newPassword: 'motdepasse1' });

    await component.submit();
    fixture.detectChanges();

    expect(el.querySelector('p.error[role="alert"]')?.textContent).toContain(
      'Lien invalide ou expiré',
    );
    const labels = Array.from(el.querySelectorAll('.auth-secondary-actions a')).map((a) =>
      a.textContent?.trim(),
    );
    expect(labels).toEqual([
      GRIMOIRE_TONE['auth.reset_redo_link'],
      GRIMOIRE_TONE['common.retour_a_la_connexion'],
    ]);
  });
});
