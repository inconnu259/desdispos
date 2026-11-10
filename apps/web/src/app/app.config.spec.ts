import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { vi } from 'vitest';
import { appConfig } from './app.config';
import { THEMES, TONE_MAP } from './core/theme/tones';

// Câblage RÉEL de l'application (story 34.3) : aucun autre test ne voit la disparition de
// l'initialiseur de thème, de la stratégie de titre ou d'une propriété `title` de route.
describe('appConfig — câblage du thème de la visite et des titres d’onglet (Story 34.3)', () => {
  const announce = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    announce.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.className = '';
    document.title = '';
    TestBed.resetTestingModule();
  });

  function setup() {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, { provide: LiveAnnouncer, useValue: { announce } }],
    });
  }

  it('les initialiseurs d’application posent un thème sur <body>, sans appel manuel, sans rien écrire', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    setup();

    await TestBed.inject(ApplicationInitStatus).donePromise;

    const classes = Array.from(document.body.classList).filter((c) => c.startsWith('theme-'));
    expect(classes).toEqual([`theme-${THEMES[THEMES.length - 1]}`]);
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem('jdr-theme')).toBeNull();
  });

  // Story 35.3 : les titres d'onglet portent la voix du thème actif — le thème est donc fixé (cache
  // local) et le texte attendu lu dans le registre de CE thème.
  const TITLES: [string, string][] = [
    ['/login', 'common.connexion'],
    ['/register', 'common.creer_un_compte'],
    ['/forgot-password', 'common.mot_de_passe_oublie'],
    ['/reset-password/x', 'common.nouveau_mot_de_passe'],
    ['/confirm-email-change/x', 'route.title_confirm_email_change'],
    ['/rollback-email-change/x', 'route.title_rollback_email_change'],
    ['/join/x', 'common.rejoindre'],
  ];

  for (const theme of THEMES) {
    for (const [url, key] of TITLES) {
      it(`${theme} : ${url} donne le titre « ${key} » du thème et l’annonce`, async () => {
        localStorage.setItem('jdr-theme', theme);
        setup();
        await TestBed.inject(ApplicationInitStatus).donePromise;

        await TestBed.inject(Router).navigateByUrl(url);

        // Une clé absente ferait « undefined » des deux côtés de la comparaison : on garde donc un
        // garde-fou explicite sur le texte résolu.
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBeTruthy();
        const title = `Dés Dispos – ${TONE_MAP[theme][key]}`;
        expect(document.title).not.toContain('undefined');
        expect(title).not.toContain('undefined');
        expect(document.title).toBe(title);
        expect(announce).toHaveBeenCalledWith(title);
      });
    }
  }
});
