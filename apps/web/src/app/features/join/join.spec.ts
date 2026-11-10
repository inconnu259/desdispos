import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Join } from './join';
import { AuthService } from '../../core/auth/auth.service';
import { JoinService } from '../../core/join/join.service';
import { MyPartiesService } from '../../core/my-parties/my-parties.service';
import { TONE_MAP } from '../../core/theme/tones';
import { fillTone } from '../../core/theme/tone-format';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

// Story 34.2 : le lien « Créer un compte » de la page de connexion est retiré, celui du parcours
// « rejoindre par lien » (avec son jeton) doit rester.
describe('Join — lien « Créer un compte » conservé (Story 34.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('visiteur non connecté, lien valide → lien vers /register avec le jeton', async () => {
    await TestBed.configureTestingModule({
      imports: [Join],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ token: 'abc123' }) } },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal(null),
            loadSession: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: JoinService,
          useValue: {
            preview: vi.fn().mockResolvedValue({
              valid: true,
              partieName: 'Partie test',
              gameSystemId: 'ryuutama',
            }),
          },
        },
        { provide: MyPartiesService, useValue: {} },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Join);
    fixture.detectChanges();
    // ngOnInit est asynchrone (loadSession puis preview) : on laisse les promesses se résoudre.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    fixture.detectChanges();

    const link = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).find(
      (a) => a.textContent?.includes(GRIMOIRE_TONE['common.creer_un_compte']),
    );
    expect(link).toBeTruthy();
    const href = link!.getAttribute('href')!;
    expect(href).toContain('/register');
    expect(href).toContain('token=abc123');
  });
});

// Story 34.3 — « rejoindre » adopte la mise en page des écrans d'authentification.
describe('Join — structure, états et annonces (Story 34.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(options: {
    preview: unknown | Error;
    user?: { displayName: string } | null;
    join?: ReturnType<typeof vi.fn>;
  }) {
    await TestBed.configureTestingModule({
      imports: [Join],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ token: 'abc123' }) } },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal(options.user ?? null),
            loadSession: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: JoinService,
          useValue: {
            preview:
              options.preview instanceof Error
                ? vi.fn().mockRejectedValue(options.preview)
                : vi.fn().mockResolvedValue(options.preview),
            join: options.join ?? vi.fn(),
          },
        },
        { provide: MyPartiesService, useValue: { refreshAll: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Join);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el };
  }

  async function settle(fixture: { detectChanges(): void }) {
    for (let i = 0; i < 10; i++) await Promise.resolve();
    fixture.detectChanges();
  }

  const validPreview = { valid: true, partieName: 'Le Convoi du Nord', gameSystemId: 'ryuutama' };

  it('chargement : « Chargement… » dans un conteneur role="status" persistant, sans h1 ni action', async () => {
    const { fixture, el } = await setup({ preview: validPreview });
    const status = el.querySelector('[role="status"]') as HTMLElement;

    expect(status.textContent).toContain(GRIMOIRE_TONE['common.chargement']);
    expect(el.querySelector('h1')).toBeNull();
    expect(el.querySelector('.auth-primary')).toBeNull();

    await settle(fixture);

    // Le conteneur est resté le même élément (annonce non perdue) et s'est vidé.
    expect(el.querySelector('[role="status"]')).toBe(status);
    expect(status.textContent?.trim()).toBe('');
  });

  it('visiteur, lien valide : un h1 dans un <main>, « Créer un compte » principal, « J’ai déjà un compte » secondaire', async () => {
    const { fixture, el } = await setup({ preview: validPreview });
    await settle(fixture);

    const h1s = el.querySelectorAll('h1');
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent?.trim()).toBe(
      fillTone(GRIMOIRE_TONE['join.title'], { name: 'Le Convoi du Nord' }),
    );
    expect(el.querySelector('main')?.getAttribute('aria-labelledby')).toBe(h1s[0].id);
    // Bande de marque (story 34.4) : <header> frère de <main>, placé avant lui.
    expect(el.querySelector('main header.band')).toBeNull();
    expect(el.querySelector('app-auth-band + main')).not.toBeNull();
    const primary = el.querySelectorAll('.auth-primary');
    expect(primary.length).toBe(1);
    expect(primary[0].textContent?.trim()).toBe(GRIMOIRE_TONE['common.creer_un_compte']);
    expect(primary[0].getAttribute('href')).toContain('token=abc123');
    const secondary = el.querySelectorAll('.auth-secondary-actions a');
    expect(secondary.length).toBe(1);
    expect(secondary[0].textContent?.trim()).toBe(GRIMOIRE_TONE['common.j_ai_deja_un_compte']);
    expect(secondary[0].getAttribute('href')).toBe('/login');
  });

  it('connecté : « Rejoindre » seul, sans rangée d’actions secondaires', async () => {
    const { fixture, el } = await setup({
      preview: validPreview,
      user: { displayName: 'Inès' },
    });
    await settle(fixture);

    const primary = el.querySelectorAll('.auth-primary');
    expect(primary.length).toBe(1);
    expect(primary[0].textContent?.trim()).toBe(GRIMOIRE_TONE['common.rejoindre']);
    expect(el.querySelector('.auth-secondary-actions')).toBeNull();
  });

  it('connecté, échec de join() : message role="alert" sous le texte', async () => {
    const { fixture, el } = await setup({
      preview: validPreview,
      user: { displayName: 'Inès' },
      join: vi.fn().mockRejectedValue(new Error('409')),
    });
    await settle(fixture);

    (el.querySelector('.auth-primary') as HTMLButtonElement).click();
    await settle(fixture);

    expect(el.querySelector('p.error[role="alert"]')?.textContent).toContain(
      'Impossible de rejoindre',
    );
  });

  it('connecté, join() réussi : recharge la liste des parties (refreshAll, Story 38.5) avant de naviguer', async () => {
    const { fixture, el } = await setup({
      preview: validPreview,
      user: { displayName: 'Inès' },
      join: vi.fn().mockResolvedValue({ partieId: 'p9' }),
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await settle(fixture);

    (el.querySelector('.auth-primary') as HTMLButtonElement).click();
    await settle(fixture);

    const myParties = TestBed.inject(MyPartiesService) as unknown as {
      refreshAll: ReturnType<typeof vi.fn>;
    };
    expect(myParties.refreshAll).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/parties', 'p9']);
  });

  it('lien expiré : raison en texte simple sans role="alert", aucune action', async () => {
    const { fixture, el } = await setup({
      preview: { ...validPreview, valid: false, reason: 'Lien expiré.' },
    });
    await settle(fixture);

    expect(el.querySelector('p.error')?.textContent?.trim()).toBe('Lien expiré.');
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelector('.auth-primary')).toBeNull();
    expect(el.querySelector('.auth-secondary-actions')).toBeNull();
    expect(el.querySelectorAll('h1').length).toBe(1);
  });

  it('lien introuvable : h1 « Lien introuvable » et message, aucune action', async () => {
    const { fixture, el } = await setup({ preview: new Error('404') });
    await settle(fixture);

    expect(el.querySelector('h1')?.textContent?.trim()).toBe(GRIMOIRE_TONE['join.not_found_title']);
    expect(el.textContent).toContain(GRIMOIRE_TONE['join.not_found_text']);
    expect(el.querySelector('.auth-primary')).toBeNull();
    expect(el.querySelector('main')?.getAttribute('aria-labelledby')).toBe(
      el.querySelector('h1')?.id,
    );
  });
});

// Story 39.3 — l'écran d'un lien d'invitation vers un groupe n'emploie aucun mot de JDR.
describe('Join — lien d’invitation vers un groupe (Story 39.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(gameSystemId: string, user: { displayName: string } | null) {
    await TestBed.configureTestingModule({
      imports: [Join],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ token: 'abc123' }) } },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal(user),
            loadSession: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: JoinService,
          useValue: {
            preview: vi
              .fn()
              .mockResolvedValue({ valid: true, partieName: 'Les Fidèles', gameSystemId }),
            join: vi.fn().mockRejectedValue(new Error('409')),
          },
        },
        { provide: MyPartiesService, useValue: { refreshAll: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Join);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('visiteur : titre, consigne et sous-titre du groupe, sans mot de JDR', async () => {
    const { el } = await setup('ralliement', null);
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(
      fillTone(GRIMOIRE_TONE['join.ralliement_title'], { name: 'Les Fidèles' }),
    );
    expect(el.textContent).toContain(GRIMOIRE_TONE['join.ralliement_login_or_register']);
    expect(el.querySelector('mat-card-subtitle')?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['partie.mode_ralliement'],
    );
    expect(el.textContent).not.toContain('grimoire «');
    expect(el.textContent).not.toContain('Ryuutama');
  });

  it('connecté : bouton « Rejoindre le groupe » du thème, erreur de jonction du groupe, titre d’onglet', async () => {
    const { fixture, el } = await setup('ralliement', { displayName: 'Inès' });
    const bouton = el.querySelector('.auth-primary') as HTMLButtonElement;
    expect(bouton.textContent?.trim()).toBe(GRIMOIRE_TONE['join.ralliement_join_btn']);
    expect(document.title).toBe(`Dés Dispos – ${GRIMOIRE_TONE['join.ralliement_join_btn']}`);

    bouton.click();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    fixture.detectChanges();
    expect(el.querySelector('p.error[role="alert"]')?.textContent).toContain(
      GRIMOIRE_TONE['join.ralliement_join_error'],
    );
  });

  it('témoin : une invitation de JDR garde ses textes', async () => {
    const { el } = await setup('ryuutama', { displayName: 'Inès' });
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(
      fillTone(GRIMOIRE_TONE['join.title'], { name: 'Les Fidèles' }),
    );
    expect(el.querySelector('.auth-primary')?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['common.rejoindre'],
    );
  });
});
