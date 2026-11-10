import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { AuthUser } from '@desdispos/shared';
import { AuthService } from './auth.service';
import { ThemeToneService } from '../theme/theme-tone.service';
import { API_BASE as API } from '../api-base';

describe('AuthService (front)', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const user: AuthUser = {
    id: 'u1',
    email: 'a@b.c',
    pseudo: 'alice',
    displayName: 'alice',
    role: 'USER',
    createdAt: '2026-01-01T00:00:00.000Z',
    // Non-null : les tests existants empruntent la branche « applique, pas de requête réseau » de
    // syncTheme() — les cas theme: null (push-once) sont testés séparément avec leur propre fixture.
    theme: 'grimoire-emeraude',
    hideFinishedParties: false,
    availabilityReminder: true,
    partiesSort: 'urgence',
    partiesViewMode: 'medium',
    charactersViewMode: 'medium',
    charactersSort: 'partie',
    defaultCalendarLayers: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('login met currentUser et envoie le cookie (withCredentials)', async () => {
    const p = service.login('a@b.c', 'pw');
    const req = http.expectOne(`${API}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ identifier: 'a@b.c', password: 'pw' });
    req.flush(user);
    await p;
    expect(service.currentUser()).toEqual(user);
  });

  it('logout vide currentUser', async () => {
    service.currentUser.set(user);
    const p = service.logout();
    http.expectOne(`${API}/auth/logout`).flush({ ok: true });
    await p;
    expect(service.currentUser()).toBeNull();
  });

  it('loadSession est dédupliqué (un seul /auth/me malgré 2 appels)', async () => {
    const p1 = service.loadSession();
    const p2 = service.loadSession();
    const reqs = http.match(`${API}/auth/me`);
    expect(reqs.length).toBe(1);
    reqs[0].flush(user);
    await Promise.all([p1, p2]);
    expect(service.currentUser()).toEqual(user);
    expect(service.initialized()).toBe(true);
  });

  it('requestPasswordReset envoie la demande avec le cookie (withCredentials)', async () => {
    const p = service.requestPasswordReset('a@b.c');
    const req = http.expectOne(`${API}/auth/forgot-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ email: 'a@b.c' });
    req.flush({ ok: true });
    await p;
  });

  it('resetPassword envoie le token et le nouveau mot de passe avec le cookie (withCredentials)', async () => {
    const p = service.resetPassword('tok', 'newpassword123');
    const req = http.expectOne(`${API}/auth/reset-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ token: 'tok', newPassword: 'newpassword123' });
    req.flush({});
    await p;
  });

  it('confirmEmailChange envoie le token avec le cookie (withCredentials)', async () => {
    const p = service.confirmEmailChange('tok1.secret');
    const req = http.expectOne(`${API}/auth/confirm-email-change`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ token: 'tok1.secret' });
    req.flush({ ok: true });
    await p;
  });

  it('rollbackEmailChange envoie le token avec le cookie (withCredentials)', async () => {
    const p = service.rollbackEmailChange('rb1.secret');
    const req = http.expectOne(`${API}/auth/rollback-email-change`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ token: 'rb1.secret' });
    req.flush({ ok: true });
    await p;
  });
});

// Decrit séparément (pas nichée dans le describe ci-dessus) : ThemeToneService lit `localStorage`
// une seule fois, à la construction (déclenchée par l'injection d'AuthService) — chaque test doit
// poser `localStorage` AVANT de configurer/injecter son propre TestBed, ce qu'un `beforeEach`
// partagé (qui injecte systématiquement avant le corps du test) empêcherait.
describe('AuthService (front) — synchronisation du thème (AC1, AC2, AC4)', () => {
  const user: AuthUser = {
    id: 'u1',
    email: 'a@b.c',
    pseudo: 'alice',
    displayName: 'alice',
    role: 'USER',
    createdAt: '2026-01-01T00:00:00.000Z',
    theme: 'grimoire-emeraude',
    hideFinishedParties: false,
    availabilityReminder: true,
    partiesSort: 'urgence',
    partiesViewMode: 'medium',
    charactersViewMode: 'medium',
    charactersSort: 'partie',
    defaultCalendarLayers: [],
  };

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  function freshService(): { service: AuthService; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return {
      service: TestBed.inject(AuthService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('login avec un compte portant un thème → ThemeToneService applique ce thème, écrase le local (AC2/AC4)', async () => {
    localStorage.setItem('jdr-theme', 'atelier-cuivre');
    const { service: svc, http: httpCtrl } = freshService();

    const p = svc.login('a@b.c', 'pw');
    httpCtrl.expectOne(`${API}/auth/login`).flush({ ...user, theme: 'foret-ancienne' });
    await p;

    expect(localStorage.getItem('jdr-theme')).toBe('foret-ancienne');
    httpCtrl.verify();
  });

  it('login avec un compte jamais configuré (theme: null) → pousse le thème local une seule fois (AC1)', async () => {
    localStorage.setItem('jdr-theme', 'foret-ancienne');
    const { service: svc, http: httpCtrl } = freshService();

    const p = svc.login('a@b.c', 'pw');
    httpCtrl.expectOne(`${API}/auth/login`).flush({ ...user, theme: null });
    // `syncTheme()` déclenche le PATCH /me/theme après résolution du POST /auth/login — laisser la
    // microtâche s'écouler avant de chercher la seconde requête (piège zoneless déjà documenté).
    await Promise.resolve();

    const pushReq = httpCtrl.expectOne(`${API}/me/theme`);
    expect(pushReq.request.method).toBe('PATCH');
    expect(pushReq.request.body).toEqual({ theme: 'foret-ancienne' });
    pushReq.flush({ ...user, theme: 'foret-ancienne' });

    await p;
    expect(svc.currentUser()?.theme).toBe('foret-ancienne');
    // Le thème local n'a pas changé : il a été poussé tel quel, jamais réappliqué.
    expect(localStorage.getItem('jdr-theme')).toBe('foret-ancienne');
    httpCtrl.verify();
  });

  it('échec du push-once (theme: null) → non-bloquant, currentUser reste utilisable', async () => {
    localStorage.setItem('jdr-theme', 'grimoire-emeraude');
    const { service: svc, http: httpCtrl } = freshService();

    const p = svc.login('a@b.c', 'pw');
    httpCtrl.expectOne(`${API}/auth/login`).flush({ ...user, theme: null });
    await Promise.resolve();
    httpCtrl
      .expectOne(`${API}/me/theme`)
      .flush('erreur', { status: 500, statusText: 'Server Error' });
    await p;

    expect(svc.currentUser()?.theme).toBeNull();
    httpCtrl.verify();
  });

  it("Revue de code : un theme de compte hors de THEMES (valeur héritée/invalide) n'est jamais appliqué, localStorage inchangé", async () => {
    localStorage.setItem('jdr-theme', 'grimoire-emeraude');
    const { service: svc, http: httpCtrl } = freshService();

    const p = svc.login('a@b.c', 'pw');
    httpCtrl.expectOne(`${API}/auth/login`).flush({ ...user, theme: 'theme-disparu' as any });
    await p;

    // Ni appliqué (localStorage inchangé), ni de plantage.
    expect(localStorage.getItem('jdr-theme')).toBe('grimoire-emeraude');
    httpCtrl.verify();
  });

  it('Revue de code : un changement de thème local pendant le push-once en vol ne se fait pas écraser par la réponse périmée', async () => {
    localStorage.setItem('jdr-theme', 'grimoire-emeraude');
    const { service: svc, http: httpCtrl } = freshService();

    const p = svc.login('a@b.c', 'pw');
    httpCtrl.expectOne(`${API}/auth/login`).flush({ ...user, theme: null });
    await Promise.resolve();

    const pushReq = httpCtrl.expectOne(`${API}/me/theme`);
    expect(pushReq.request.body).toEqual({ theme: 'grimoire-emeraude' });

    // Pendant que le push est en vol, l'utilisateur sélectionne un autre thème ailleurs (ex.
    // ThemeSelector, qui appelle themeSvc.setTheme() directement) — le local avance avant que la
    // réponse (périmée) n'arrive. Écrire localStorage seul ne suffirait pas : activeTheme() est un
    // signal qui ne se met à jour que via setTheme(), jamais en lisant localStorage a posteriori.
    TestBed.inject(ThemeToneService).setTheme('atelier-cuivre');

    // Réponse tardive du push-once, avec l'ancienne valeur poussée au moment de l'appel.
    pushReq.flush({ ...user, theme: 'grimoire-emeraude' });
    await p;

    // currentUser n'a pas été écrasé par la réponse périmée : sans la garde, ce serait
    // 'grimoire-emeraude' (la valeur poussée avant le changement local) — reste tel qu'avant
    // (null, posé par login() avant syncTheme()) plutôt que d'adopter une valeur périmée.
    expect(svc.currentUser()?.theme).toBeNull();
    httpCtrl.verify();
  });
});
