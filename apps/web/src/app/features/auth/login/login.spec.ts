import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { afterEach, vi } from 'vitest';
import { Login } from './login';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

const THEME = 'grimoire-emeraude';
const tone = TONE_MAP[THEME];

function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, statusText: 'x' });
}

async function createFixture(login: ReturnType<typeof vi.fn>) {
  await TestBed.configureTestingModule({
    imports: [Login],
    providers: [provideRouter([]), { provide: AuthService, useValue: { login } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(Login);
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  fixture.detectChanges();
  const component = fixture.componentInstance as any;
  component.form.setValue({ identifier: 'alice', password: 'secret' });
  return { fixture, component, navigate };
}

describe('Login — messages d’erreur véridiques (Story 34.1)', () => {
  beforeEach(() => localStorage.setItem('jdr-theme', THEME));
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  const cases: [string, unknown, string][] = [
    [
      'identifiants invalides (401 par défaut)',
      httpError(401, { statusCode: 401, message: 'Unauthorized' }),
      'auth.login_invalid',
    ],
    [
      'compte à réinitialiser (401 avec message personnalisé)',
      httpError(401, {
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Une réinitialisation de mot de passe est requise avant de vous reconnecter.',
      }),
      'auth.login_reset_required',
    ],
    ['401 sans corps', httpError(401), 'auth.login_invalid'],
    ['401 avec corps chaîne Unauthorized', httpError(401, 'Unauthorized'), 'auth.login_invalid'],
    [
      '401 avec corps chaîne HTML (proxy/WAF)',
      httpError(401, '<html>401 Authorization Required</html>'),
      'auth.login_invalid',
    ],
    ['401 avec message blanc', httpError(401, { message: '  ' }), 'auth.login_invalid'],
    ['401 avec message tableau', httpError(401, { message: ['x'] }), 'auth.login_invalid'],
    [
      '401 avec message Unauthorized en casse/espaces différents',
      httpError(401, { message: 'unauthorized ' }),
      'auth.login_invalid',
    ],
    ['limite de tentatives (429)', httpError(429), 'auth.login_throttled'],
    ['serveur injoignable (statut 0)', httpError(0), 'auth.login_unavailable'],
    ['passerelle 502', httpError(502), 'auth.login_unavailable'],
    ['passerelle 503', httpError(503), 'auth.login_unavailable'],
    ['passerelle 504', httpError(504), 'auth.login_unavailable'],
    ['erreur serveur 500', httpError(500, { message: 'secret interne' }), 'auth.login_unexpected'],
    ['autre 5xx (501)', httpError(501), 'auth.login_unexpected'],
    ['autre 4xx (400)', httpError(400, { message: ['détail'] }), 'auth.login_unexpected'],
    ['erreur non HTTP', new Error('boom interne'), 'auth.login_unexpected'],
  ];

  for (const [label, err, key] of cases) {
    it(`${label} → ${key}, formulaire conservé, loading retombé`, async () => {
      const login = vi.fn().mockRejectedValue(err);
      const { fixture, component, navigate } = await createFixture(login);

      await component.submit();
      fixture.detectChanges();

      expect(component.error()).toBe(tone[key]);
      expect(component.loading()).toBe(false);
      expect(component.form.getRawValue()).toEqual({ identifier: 'alice', password: 'secret' });
      expect(navigate).not.toHaveBeenCalled();
      const alert = fixture.nativeElement.querySelector('p.error[role="alert"]');
      expect(alert?.textContent.trim()).toBe(tone[key]);
      expect(fixture.nativeElement.querySelectorAll('p.error').length).toBe(1);
    });
  }

  it('n’expose jamais le message, le statut ni le corps renvoyé par le serveur', async () => {
    const login = vi
      .fn()
      .mockRejectedValue(httpError(500, { message: 'secret interne', statusCode: 500 }));
    const { fixture, component } = await createFixture(login);

    await component.submit();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('secret interne');
    expect(text).not.toContain('500');
    expect(text).not.toContain('Http failure');
  });

  it('lit le texte dans le registre du thème actif', async () => {
    const login = vi.fn().mockRejectedValue(httpError(0));
    const { component } = await createFixture(login);
    TestBed.inject(ThemeToneService).setTheme('foret-ancienne');

    await component.submit();

    expect(component.error()).toBe(TONE_MAP['foret-ancienne']['auth.login_unavailable']);
  });

  it('efface le message précédent dès la nouvelle soumission, avant l’appel', async () => {
    let errorDuringCall: string | null = 'non évalué';
    const login = vi.fn();
    const { component } = await createFixture(login);
    login.mockRejectedValueOnce(httpError(0));
    await component.submit();
    expect(component.error()).toBe(tone['auth.login_unavailable']);

    login.mockImplementationOnce(async () => {
      errorDuringCall = component.error();
    });
    await component.submit();

    expect(errorDuringCall).toBeNull();
  });

  it('échec puis succès : le message disparaît et on navigue vers /', async () => {
    const login = vi.fn();
    const { fixture, component, navigate } = await createFixture(login);
    login.mockRejectedValueOnce(httpError(429));
    await component.submit();
    expect(component.error()).toBe(tone['auth.login_throttled']);

    login.mockResolvedValueOnce(undefined);
    await component.submit();
    fixture.detectChanges();

    expect(component.error()).toBeNull();
    expect(fixture.nativeElement.querySelector('p.error')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/']);
    expect(component.loading()).toBe(false);
  });
});

describe('Login — lien mort retiré et mot de passe révélable (Story 34.2)', () => {
  beforeEach(() => localStorage.setItem('jdr-theme', THEME));
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('aucun lien vers /register ni « Créer un compte » ; « Mot de passe oublié ? » reste', async () => {
    const { fixture } = await createFixture(vi.fn());
    const el = fixture.nativeElement as HTMLElement;

    const hrefs = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs.some((h) => h?.includes('register'))).toBe(false);
    expect(el.textContent).not.toContain(GRIMOIRE_TONE['common.creer_un_compte']);
    const forgot = Array.from(el.querySelectorAll('a')).find((a) =>
      a.textContent?.includes(GRIMOIRE_TONE['auth.login_forgot_link']),
    );
    expect(forgot?.getAttribute('href')).toBe('/forgot-password');
  });

  it('le champ de mot de passe est révélable puis re-masquable, valeur conservée', async () => {
    const { fixture, component } = await createFixture(vi.fn());
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input[formControlName="password"]') as HTMLInputElement;
    const button = el.querySelector('app-password-toggle button') as HTMLButtonElement;
    fixture.detectChanges();

    expect(input.type).toBe('password');
    button.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(component.form.getRawValue().password).toBe('secret');
    expect(input.getAttribute('autocomplete')).toBe('current-password');

    button.click();
    fixture.detectChanges();
    expect(input.type).toBe('password');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('seul le champ de mot de passe porte un bouton de révélation', async () => {
    const { fixture } = await createFixture(vi.fn());
    expect(fixture.nativeElement.querySelectorAll('app-password-toggle').length).toBe(1);
  });

  it('ne révèle jamais le mot de passe automatiquement (ni après erreur)', async () => {
    const { fixture, component } = await createFixture(
      vi.fn().mockRejectedValue(httpError(401, { message: 'Unauthorized' })),
    );
    await component.submit();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      'input[formControlName="password"]',
    ) as HTMLInputElement;
    expect(input.type).toBe('password');
  });
});

describe('Login — structure, validation écrite et orientation (Story 34.3)', () => {
  beforeEach(() => localStorage.setItem('jdr-theme', THEME));
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('un seul h1 « Connexion », dans un <main> relié au titre', async () => {
    const { fixture } = await createFixture(vi.fn());
    const el = fixture.nativeElement as HTMLElement;

    const h1s = el.querySelectorAll('h1');
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent?.trim()).toBe(GRIMOIRE_TONE['common.connexion']);
    const main = el.querySelector('main')!;
    expect(main.getAttribute('aria-labelledby')).toBe(h1s[0].id);
    // Bande de marque (story 34.4) : <header> frère de <main>, placé avant lui.
    expect(el.querySelector('main header.band')).toBeNull();
    expect(el.querySelector('app-auth-band + main')).not.toBeNull();
    expect(main.contains(el.querySelector('mat-card'))).toBe(true);
  });

  it('une seule action principale, hors de la rangée des actions secondaires', async () => {
    const { fixture } = await createFixture(vi.fn());
    const el = fixture.nativeElement as HTMLElement;

    const primary = el.querySelectorAll('.auth-primary');
    expect(primary.length).toBe(1);
    expect(primary[0].getAttribute('type')).toBe('submit');
    const row = el.querySelector('.auth-secondary-actions')!;
    expect(row.contains(primary[0])).toBe(false);
    expect(row.querySelectorAll('a.auth-secondary-link').length).toBe(1);
  });

  it('ligne d’orientation : texte du ton, sous la rangée d’actions, jamais un lien', async () => {
    const { fixture } = await createFixture(vi.fn());
    const el = fixture.nativeElement as HTMLElement;

    const line = el.querySelector('.auth-orientation')!;
    expect(line.textContent?.trim()).toBe(tone['auth.login_invite_only']);
    expect(line.querySelector('a, button')).toBeNull();
    const row = el.querySelector('.auth-secondary-actions')!;
    expect(row.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('envoi invalide : aucun appel serveur, messages écrits, focus sur le premier champ invalide', async () => {
    const login = vi.fn();
    const { fixture, component, navigate } = await createFixture(login);
    component.form.setValue({ identifier: '', password: '' });

    await component.submit();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(login).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    const messages = Array.from(el.querySelectorAll('mat-error')).map((e) => e.textContent?.trim());
    expect(messages).toEqual([tone['auth.field_required'], tone['auth.field_required']]);
    const identifier = el.querySelector('input[formControlName="identifier"]') as HTMLInputElement;
    expect(document.activeElement).toBe(identifier);
    expect(identifier.getAttribute('aria-invalid')).toBe('true');
    expect(identifier.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('seul le mot de passe est vide : le focus va au mot de passe, l’identifiant est conservé', async () => {
    const { fixture, component } = await createFixture(vi.fn());
    component.form.setValue({ identifier: 'alice', password: '' });

    await component.submit();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(document.activeElement).toBe(el.querySelector('input[formControlName="password"]'));
    expect(component.form.getRawValue().identifier).toBe('alice');
  });
});

describe('Login — confirmation d’un compte effacé (Story 43.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(query: Record<string, string>): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { login: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('arrivée après l’effacement (?compte=efface) : le message themé est écrit, en zone de statut', async () => {
    const el = await render({ compte: 'efface' });
    const notice = el.querySelector('[role="status"]');
    expect(notice?.textContent).toContain(TONE_MAP['grimoire-emeraude']['auth.account_deleted']);
  });

  it('arrivée ordinaire : aucun message', async () => {
    const el = await render({});
    expect(el.querySelector('[role="status"]')).toBeNull();
  });

  it('une autre valeur du paramètre n’affiche rien', async () => {
    const el = await render({ compte: 'autre' });
    expect(el.querySelector('[role="status"]')).toBeNull();
  });
});
