import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { vi } from 'vitest';
import { PageTitleStrategy } from './page-title.strategy';

@Component({ template: '' })
class Dummy {}

describe('PageTitleStrategy — titre d’onglet par écran (Story 34.3)', () => {
  const announce = vi.fn().mockResolvedValue(undefined);

  function setup() {
    announce.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', title: 'Connexion', component: Dummy },
          { path: 'register', title: 'Créer un compte', component: Dummy },
          { path: 'app', component: Dummy },
        ]),
        { provide: TitleStrategy, useExisting: PageTitleStrategy },
        { provide: LiveAnnouncer, useValue: { announce } },
      ],
    });
    return TestBed.inject(Router);
  }

  afterEach(() => {
    document.title = '';
    TestBed.resetTestingModule();
  });

  it('une route titrée donne « Dés Dispos – <page> » et l’annonce au lecteur d’écran', async () => {
    const router = setup();

    await router.navigateByUrl('/login');

    expect(document.title).toBe('Dés Dispos – Connexion');
    expect(announce).toHaveBeenCalledWith('Dés Dispos – Connexion');
  });

  it('chaque changement d’écran met à jour le titre et l’annonce', async () => {
    const router = setup();

    await router.navigateByUrl('/login');
    await router.navigateByUrl('/register');

    expect(document.title).toBe('Dés Dispos – Créer un compte');
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith('Dés Dispos – Créer un compte');
  });

  it('une route sans titre retombe sur « Dés Dispos », sans annonce', async () => {
    const router = setup();
    await router.navigateByUrl('/login');
    announce.mockClear();

    await router.navigateByUrl('/app');

    expect(document.title).toBe('Dés Dispos');
    expect(announce).not.toHaveBeenCalled();
  });
});
