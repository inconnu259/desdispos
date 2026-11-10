import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ConfirmEmailChange } from './confirm-email-change';
import { AuthService } from '../../../core/auth/auth.service';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function createFixture(token: string, confirmEmailChange: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    imports: [ConfirmEmailChange],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ token })),
          snapshot: { paramMap: convertToParamMap({ token }) },
        },
      },
      { provide: AuthService, useValue: { confirmEmailChange } },
    ],
  });
  const fixture = TestBed.createComponent(ConfirmEmailChange);
  fixture.detectChanges();
  return fixture;
}

describe('ConfirmEmailChange', () => {
  it('lit le token depuis la route', () => {
    const fixture = createFixture('tok1.secret', vi.fn());
    const component = fixture.componentInstance as any;
    expect(component.token()).toBe('tok1.secret');
  });

  it('confirm() réussi → confirmed() à true, aucune erreur', async () => {
    const confirmEmailChange = vi.fn().mockResolvedValue(undefined);
    const fixture = createFixture('tok1.secret', confirmEmailChange);
    const component = fixture.componentInstance as any;

    await component.confirm();

    expect(confirmEmailChange).toHaveBeenCalledWith('tok1.secret');
    expect(component.confirmed()).toBe(true);
    expect(component.error()).toBeNull();
  });

  it('token invalide/expiré → message générique, confirmed() reste false', async () => {
    const confirmEmailChange = vi.fn().mockRejectedValue(new Error('400'));
    const fixture = createFixture('bad.token', confirmEmailChange);
    const component = fixture.componentInstance as any;

    await component.confirm();

    expect(component.error()).toBeTruthy();
    expect(component.confirmed()).toBe(false);
  });
});

describe('ConfirmEmailChange — structure et annonces (Story 34.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('un seul h1 dans un <main>, une action principale, « Retour à la connexion » en secondaire', () => {
    const fixture = createFixture('tok1.secret', vi.fn());
    const el = fixture.nativeElement as HTMLElement;

    const h1s = el.querySelectorAll('h1');
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent?.trim()).toBe(GRIMOIRE_TONE['auth.confirm_email_title']);
    expect(el.querySelector('main')?.getAttribute('aria-labelledby')).toBe(h1s[0].id);
    // Bande de marque (story 34.4) : <header> frère de <main>, placé avant lui.
    expect(el.querySelector('main header.band')).toBeNull();
    expect(el.querySelector('app-auth-band + main')).not.toBeNull();
    expect(el.querySelectorAll('.auth-primary').length).toBe(1);
    expect(el.querySelector('.auth-secondary-actions a')?.getAttribute('href')).toBe('/login');
  });

  it('« Lien invalide. » présent au chargement : texte simple sans role="alert", action désactivée', () => {
    const fixture = createFixture('', vi.fn());
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('p.error')?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['common.lien_invalide'],
    );
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect((el.querySelector('.auth-primary') as HTMLButtonElement).disabled).toBe(true);
  });

  it('réussite : message dans le conteneur role="status" persistant, focus déplacé, bouton retiré', async () => {
    const fixture = createFixture('tok1.secret', vi.fn().mockResolvedValue(undefined));
    const el = fixture.nativeElement as HTMLElement;
    const status = el.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent?.trim()).toBe('');

    await (fixture.componentInstance as any).confirm();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.querySelector('[role="status"]')).toBe(status);
    expect(status.textContent?.trim()).toBe(GRIMOIRE_TONE['auth.confirm_email_done']);
    expect(el.querySelector('.auth-primary')).toBeNull();
    expect(document.activeElement).toBe(status);
  });

  it('échec après action : message avec role="alert", bouton conservé', async () => {
    const fixture = createFixture('bad.token', vi.fn().mockRejectedValue(new Error('400')));
    const el = fixture.nativeElement as HTMLElement;

    await (fixture.componentInstance as any).confirm();
    fixture.detectChanges();

    expect(el.querySelector('p.error[role="alert"]')?.textContent).toContain(
      'Lien invalide ou expiré',
    );
    expect(el.querySelector('.auth-primary')).not.toBeNull();
  });
});
