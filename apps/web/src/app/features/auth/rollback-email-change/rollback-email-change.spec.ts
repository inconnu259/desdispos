import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { RollbackEmailChange } from './rollback-email-change';
import { AuthService } from '../../../core/auth/auth.service';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function createFixture(token: string, rollbackEmailChange: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    imports: [RollbackEmailChange],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ token })),
          snapshot: { paramMap: convertToParamMap({ token }) },
        },
      },
      { provide: AuthService, useValue: { rollbackEmailChange } },
    ],
  });
  const fixture = TestBed.createComponent(RollbackEmailChange);
  fixture.detectChanges();
  return fixture;
}

describe('RollbackEmailChange', () => {
  it('lit le token depuis la route', () => {
    const fixture = createFixture('rb1.secret', vi.fn());
    const component = fixture.componentInstance as any;
    expect(component.token()).toBe('rb1.secret');
  });

  it('rollback() réussi → restored() à true, aucune redirection immédiate (revue de code)', async () => {
    const rollbackEmailChange = vi.fn().mockResolvedValue(undefined);
    const fixture = createFixture('rb1.secret', rollbackEmailChange);
    const component = fixture.componentInstance as any;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    await component.rollback();

    expect(rollbackEmailChange).toHaveBeenCalledWith('rb1.secret');
    expect(component.restored()).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('continueToPasswordReset() → redirige vers /forgot-password', () => {
    const fixture = createFixture('rb1.secret', vi.fn());
    const component = fixture.componentInstance as any;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.continueToPasswordReset();

    expect(navigateSpy).toHaveBeenCalledWith(['/forgot-password']);
  });

  it('token invalide/expiré → message générique, aucune redirection', async () => {
    const rollbackEmailChange = vi.fn().mockRejectedValue(new Error('400'));
    const fixture = createFixture('bad.token', rollbackEmailChange);
    const component = fixture.componentInstance as any;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    await component.rollback();

    expect(component.error()).toBeTruthy();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

describe('RollbackEmailChange — structure et annonces (Story 34.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('un seul h1 dans un <main>, avertissement conservé, une action principale', () => {
    const fixture = createFixture('rb1.secret', vi.fn());
    const el = fixture.nativeElement as HTMLElement;

    const h1s = el.querySelectorAll('h1');
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent?.trim()).toBe(GRIMOIRE_TONE['auth.rollback_email_title']);
    expect(el.querySelector('main')?.getAttribute('aria-labelledby')).toBe(h1s[0].id);
    // Bande de marque (story 34.4) : <header> frère de <main>, placé avant lui.
    expect(el.querySelector('main header.band')).toBeNull();
    expect(el.querySelector('app-auth-band + main')).not.toBeNull();
    expect(el.textContent).toContain(GRIMOIRE_TONE['auth.rollback_warning']);
    expect(el.querySelectorAll('.auth-primary').length).toBe(1);
    expect(el.querySelector('.auth-secondary-actions a')?.getAttribute('href')).toBe('/login');
  });

  it('« Lien invalide. » présent au chargement : texte simple sans role="alert"', () => {
    const fixture = createFixture('', vi.fn());
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('p.error')?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['common.lien_invalide'],
    );
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect((el.querySelector('.auth-primary') as HTMLButtonElement).disabled).toBe(true);
  });

  it('réussite : message dans le conteneur role="status" persistant, focus déplacé, nouvelle action principale', async () => {
    const fixture = createFixture('rb1.secret', vi.fn().mockResolvedValue(undefined));
    const el = fixture.nativeElement as HTMLElement;
    const status = el.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent?.trim()).toBe('');

    await (fixture.componentInstance as any).rollback();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.querySelector('[role="status"]')).toBe(status);
    expect(status.textContent).toContain(GRIMOIRE_TONE['auth.rollback_done']);
    expect(document.activeElement).toBe(status);
    const primary = el.querySelectorAll('.auth-primary');
    expect(primary.length).toBe(1);
    expect(primary[0].textContent?.trim()).toBe(GRIMOIRE_TONE['auth.rollback_continue_btn']);
  });

  it('échec après action : message avec role="alert"', async () => {
    const fixture = createFixture('bad.token', vi.fn().mockRejectedValue(new Error('400')));
    const el = fixture.nativeElement as HTMLElement;

    await (fixture.componentInstance as any).rollback();
    fixture.detectChanges();

    expect(el.querySelector('p.error[role="alert"]')?.textContent).toContain(
      'Lien invalide ou expiré',
    );
  });
});
