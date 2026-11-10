import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { AuthUser, CalendarLayerKey } from '@desdispos/shared';
import { AuthService } from '../../core/auth/auth.service';
import {
  CalendarSessionLayersService,
  calendarSessionKey,
} from './calendar-session-layers.service';

function makeAuthService() {
  return { currentUser: signal<Partial<AuthUser> | null>({ id: 'u1' }) };
}

function create(auth = makeAuthService()) {
  TestBed.configureTestingModule({
    providers: [{ provide: AuthService, useValue: auth }],
  });
  return { svc: TestBed.inject(CalendarSessionLayersService), auth };
}

describe('calendarSessionKey', () => {
  it("distingue le calendrier personnel d'un calendrier de partie", () => {
    expect(calendarSessionKey(null)).toBe('personal');
    expect(calendarSessionKey('abc')).toBe('partie:abc');
  });

  it('donne deux clés différentes à deux parties différentes (AC10)', () => {
    expect(calendarSessionKey('a')).not.toBe(calendarSessionKey('b'));
  });
});

describe('CalendarSessionLayersService', () => {
  afterEach(() => TestBed.resetTestingModule());

  const LAYERS: CalendarLayerKey[] = ['mes-disponibilites', 'votes-en-cours'];

  it('rend null pour un calendrier jamais visité — le défaut de compte s’applique', () => {
    const { svc } = create();
    expect(svc.read('personal')).toBeNull();
  });

  it('relit ce qui a été écrit pour le MÊME calendrier (AC9)', () => {
    const { svc } = create();
    svc.write('personal', LAYERS);
    expect(svc.read('personal')).toEqual(LAYERS);
  });

  it("l'ouverture d'un AUTRE calendrier ne voit pas la mémoire du premier (AC10)", () => {
    const { svc } = create();
    svc.write('partie:a', LAYERS);
    expect(svc.read('partie:b')).toBeNull();
    expect(svc.read('personal')).toBeNull();
  });

  it('copie en écriture et en lecture — un appelant ne peut pas muter la mémoire par sa référence', () => {
    const { svc } = create();
    const source: CalendarLayerKey[] = ['mes-seances'];
    svc.write('personal', source);
    source.push('votes-en-cours');
    expect(svc.read('personal')).toEqual(['mes-seances']);

    const read = svc.read('personal')!;
    read.push('votes-en-cours');
    expect(svc.read('personal')).toEqual(['mes-seances']);
  });

  it('la déconnexion vide la mémoire de TOUS les calendriers (AC10)', () => {
    const { svc, auth } = create();
    svc.write('personal', LAYERS);
    svc.write('partie:a', LAYERS);

    auth.currentUser.set(null);
    TestBed.tick();

    expect(svc.read('personal')).toBeNull();
    expect(svc.read('partie:a')).toBeNull();
  });

  it('une reconnexion repart d’une mémoire vide, jamais de celle du compte précédent', () => {
    const { svc, auth } = create();
    svc.write('personal', LAYERS);

    auth.currentUser.set(null);
    TestBed.tick();
    auth.currentUser.set({ id: 'u2' });
    TestBed.tick();

    expect(svc.read('personal')).toBeNull();
  });

  /**
   * AC10 / AC11 — la garantie « un rechargement repart du défaut » n'est pas un comportement
   * codé : elle découle de l'absence de tout stockage. Ce test verrouille cette absence, qui est
   * la seule chose qu'un test puisse voir (jsdom ne recharge rien).
   *
   * 🚨 `sessionStorage` SURVIT à un rechargement dans le même onglet : l'employer ici rendrait
   * l'AC10 faux en production tout en laissant cette suite verte.
   */
  it("n'écrit dans aucun stockage web — ni localStorage, ni sessionStorage (AC11)", () => {
    const { svc } = create();
    const localSpy = vi.spyOn(Storage.prototype, 'setItem');

    svc.write('personal', LAYERS);
    svc.write('partie:a', LAYERS);
    svc.read('personal');

    expect(localSpy).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    localSpy.mockRestore();
  });
});
