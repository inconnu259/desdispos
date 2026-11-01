import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi } from 'vitest';
import type {
  AuthUser,
  PartieDto,
  PartieRole,
  PartySignalsDto,
  SessionPollDto,
  Theme,
} from '@master-jdr/shared';
import { Dashboard } from './dashboard';
import { MyPartiesService } from '../../core/my-parties/my-parties.service';
import { InvitationsService } from '../../core/invitations/invitations.service';
import { OpenPollsService } from '../../core/poll/open-polls.service';
import { PartySignalsService } from '../../core/parties/party-signals.service';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import { AuthService } from '../../core/auth/auth.service';
import { AccountService } from '../../core/account/account.service';
import { RealtimeService, userTopic } from '../../core/realtime/realtime.service';
import { ContextualNavService } from '../../core/navigation/contextual-nav.service';
import { TONE_MAP } from '../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function makeParty(
  id: string,
  role: PartieRole = 'player',
  status: PartieDto['status'] = 'EN_COURS',
  isFavorite = false,
  coverImageVersion: string | null = null,
): PartieDto {
  return {
    id,
    name: `Party ${id}`,
    kind: 'ONE_SHOT',
    gameSystemId: 'draconis',
    description: null,
    ownerId: 'mj-1',
    ownerPseudo: 'mj-pseudo',
    ownerDisplayName: 'MJ Nom',
    createdAt: '',
    nextSessionDate: null,
    nextSessionSlot: null,
    role,
    status,
    isFavorite,
    coverImageVersion,
  };
}

function makePoll(partieId: string): SessionPollDto {
  return {
    id: `poll-${partieId}`,
    partieId,
    status: 'OPEN',
    scenarioRef: null,
    expiresAt: null,
    chosenDate: null,
    chosenSlot: null,
    // Story 36.6 — effectif de la troupe (MJ + membres).
    membersCount: 4,
    durationSlots: 1,
    options: [],
  };
}

function makeInvitationsService(
  overrides: Partial<{ changed: ReturnType<typeof signal<number>> }> = {},
) {
  return {
    listReceived: vi.fn().mockResolvedValue([]),
    accept: vi.fn(),
    decline: vi.fn(),
    // Story 21.1 (Task 4) : Dashboard réagit désormais à ce signal (effect() du constructeur).
    changed: signal(0),
    ...overrides,
  };
}

function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'u1',
    email: 'u1@test.fr',
    pseudo: 'u1',
    displayName: 'U1',
    role: 'USER',
    createdAt: '2026-01-01T00:00:00.000Z',
    theme: 'grimoire-emeraude',
    hideFinishedParties: false,
    partiesSort: 'urgence',
    partiesViewMode: 'medium',
    charactersViewMode: 'medium',
    charactersSort: 'partie',
    defaultCalendarLayers: [],
    ...overrides,
  };
}

function makeAccountService() {
  return {
    updatePreferences: vi.fn().mockResolvedValue(undefined),
    addFavorite: vi.fn().mockResolvedValue({ ok: true }),
    removeFavorite: vi.fn().mockResolvedValue({ ok: true }),
  };
}

async function createFixture(
  openPolls: Map<string, SessionPollDto>,
  invitationsSvc = makeInvitationsService(),
  allParties: PartieDto[] = [makeParty('p1', 'player'), makeParty('p2', 'player')],
  partySignals = new Map<string, PartySignalsDto>(),
  authUserOverrides: Partial<AuthUser> = {},
  accountSvc = makeAccountService(),
) {
  // Story 21.1 (Task 4) : Dashboard ouvre désormais sa propre connexion RealtimeService — mock
  // direct, jsdom n'implémente pas EventSource.
  const realtimeSvc = { connect: vi.fn(), disconnect: vi.fn() };
  const authSvc = { currentUser: signal(makeAuthUser(authUserOverrides)) };
  const myPartiesSvc = {
    allParties: signal(allParties),
    refreshAll: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
  };
  // Story 42.5 : la confirmation « Retirer de ma liste » (défaut : « Renoncer »).
  const dialog = { open: vi.fn().mockReturnValue({ afterClosed: () => of(false) }) };
  await TestBed.configureTestingModule({
    imports: [Dashboard],
    providers: [
      provideRouter([]),
      provideAnimationsAsync(),
      { provide: MyPartiesService, useValue: myPartiesSvc },
      { provide: MatDialog, useValue: dialog },
      { provide: InvitationsService, useValue: invitationsSvc },
      { provide: OpenPollsService, useValue: { openPolls: signal(openPolls) } },
      { provide: PartySignalsService, useValue: { signals: signal(partySignals) } },
      {
        provide: ThemeToneService,
        // `activeTheme` est requis depuis la Story 29.10 : `PartyBanner` le lit pour choisir le
        // style de la composition. Un mock qui ne porterait que `tone` casserait tout l'écran.
        useValue: {
          tone: signal(TONE_MAP['grimoire-emeraude']),
          activeTheme: signal<Theme>('grimoire-emeraude'),
        },
      },
      { provide: AuthService, useValue: authSvc },
      { provide: AccountService, useValue: accountSvc },
      { provide: RealtimeService, useValue: realtimeSvc },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(Dashboard);
  fixture.detectChanges();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, invitationsSvc, realtimeSvc, authSvc, myPartiesSvc, accountSvc, dialog };
}

describe('Dashboard — liste unifiée (Story 29.1, AC1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affiche toutes les parties (MJ et joueur confondues) dans une seule grille', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeParty('p-mj', 'mj'),
      makeParty('p-player', 'player'),
    ]);
    const tiles = fixture.nativeElement.querySelectorAll('.tile');
    // 1 tuile de partie MJ + 1 tuile de partie joueur (aucune invitation ici).
    expect(tiles.length).toBe(2);
  });

  it('le sous-titre de tuile affiche le libellé du registre du type de partie, jamais l’énumération brute', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      { ...makeParty('p-lin'), kind: 'CAMPAGNE_LINEAIRE' },
      { ...makeParty('p-epi'), kind: 'CAMPAGNE_EPISODIQUE' },
    ]);
    const subtitles = Array.from(
      fixture.nativeElement.querySelectorAll('.tile mat-card-subtitle'),
    ).map((el) => (el as HTMLElement).textContent ?? '');
    expect(subtitles).toHaveLength(2);
    expect(subtitles[0]).toContain(GRIMOIRE_TONE['partie.kind_CAMPAGNE_LINEAIRE']);
    expect(subtitles[1]).toContain(GRIMOIRE_TONE['partie.kind_CAMPAGNE_EPISODIQUE']);
    for (const text of subtitles) expect(text).not.toContain('CAMPAGNE_');
  });

  it('état vide : aucune carte, message affiché, quand allParties() est vide', async () => {
    const { fixture } = await createFixture(new Map(), undefined, []);
    expect(fixture.nativeElement.querySelector('.tile')).toBeNull();
    expect(fixture.nativeElement.querySelector('.empty')).not.toBeNull();
  });
});

describe('Dashboard — indicateur de rôle non chromatique (Story 29.1, AC2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('une carte de partie MJ affiche le libellé de rôle MJ (icône + texte)', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [makeParty('p-mj', 'mj')]);
    const indicator = fixture.nativeElement.querySelector('.role-indicator');
    expect(indicator).not.toBeNull();
    expect(indicator.querySelector('app-icon')).not.toBeNull();
    expect(indicator.textContent).toContain('Maître'); // dashboard.role_mj, thème grimoire-emeraude
  });

  it('une carte de partie joueur affiche le libellé de rôle joueur (icône + texte)', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeParty('p-player', 'player'),
    ]);
    const indicator = fixture.nativeElement.querySelector('.role-indicator');
    expect(indicator).not.toBeNull();
    expect(indicator.textContent).toContain('Héros'); // dashboard.role_player, thème grimoire-emeraude
  });

  it("l'indicateur porte un aria-label explicite (jamais la couleur seule)", async () => {
    const { fixture } = await createFixture(new Map(), undefined, [makeParty('p-mj', 'mj')]);
    const indicator = fixture.nativeElement.querySelector('.role-indicator');
    expect(indicator.getAttribute('aria-label')).toBeTruthy();
  });
});

describe('Dashboard — aucun bouton de création (Story 38.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  // Le bouton de création vit dans l'en-tête global (Shell), pour tout utilisateur : la page
  // Parties ne le porte plus, que l'on y soit MJ, joueur ou nouvel inscrit.
  it('aucun lien vers /parties/new dans le Dashboard, avec ou sans partie de MJ', async () => {
    for (const parties of [[], [makeParty('p-mj', 'mj')], [makeParty('p-pl', 'player')]]) {
      const { fixture } = await createFixture(new Map(), undefined, parties);
      expect(fixture.nativeElement.querySelector('a[routerLink="/parties/new"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('.head')).toBeNull();
      TestBed.resetTestingModule();
    }
  });
});

describe('Dashboard — badge de vote en attente (Story 29.1 : limité aux cartes joueur)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("affiche le badge sur la carte d'une partie JOUEUR présente dans OpenPollsService.openPolls", async () => {
    const { fixture } = await createFixture(new Map([['p1', makePoll('p1')]]), undefined, [
      makeParty('p1', 'player'),
    ]);
    const badges = fixture.nativeElement.querySelectorAll('.poll-badge');
    expect(badges.length).toBe(1);
  });

  it("n'affiche jamais le badge sur une carte MJ, même si openPolls la contient (revue de code)", async () => {
    const { fixture } = await createFixture(new Map([['p-mj', makePoll('p-mj')]]), undefined, [
      makeParty('p-mj', 'mj'),
    ]);
    const badges = fixture.nativeElement.querySelectorAll('.poll-badge');
    expect(badges.length).toBe(0);
  });

  it("n'affiche aucun badge si openPolls est vide", async () => {
    const { fixture } = await createFixture(new Map());
    const badges = fixture.nativeElement.querySelectorAll('.poll-badge');
    expect(badges.length).toBe(0);
  });
});

describe('Dashboard — invitations toujours visibles, sans condition de rôle (Story 29.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('une invitation en attente est visible même si l’utilisateur est déjà MJ de parties', async () => {
    const invitationsSvc = makeInvitationsService();
    invitationsSvc.listReceived.mockResolvedValue([
      {
        id: 'inv1',
        partie: { id: 'p-new', name: 'Nouvelle Campagne', gameSystemId: 'ryuutama' },
        inviterPseudo: 'MJ',
        status: 'PENDING' as const,
        createdAt: '2026-07-22T00:00:00.000Z',
      },
    ]);
    const { fixture } = await createFixture(new Map(), invitationsSvc, [makeParty('p-mj', 'mj')]);
    expect(fixture.nativeElement.textContent).toContain('Nouvelle Campagne');
  });
});

describe('Dashboard — carte d’invitation à un groupe (Story 39.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affiche le mot du thème pour le ralliement, jamais le nom d’un système de JDR', async () => {
    const invitationsSvc = makeInvitationsService();
    invitationsSvc.listReceived.mockResolvedValue([
      {
        id: 'inv-g',
        partie: { id: 'g1', name: 'Les Fidèles', gameSystemId: 'ralliement' },
        inviterPseudo: 'Marc',
        status: 'PENDING' as const,
        createdAt: '2026-10-11T00:00:00.000Z',
      },
      {
        id: 'inv-q',
        partie: { id: 'q1', name: 'La Quête', gameSystemId: 'ryuutama' },
        inviterPseudo: 'Léa',
        status: 'PENDING' as const,
        createdAt: '2026-10-11T00:00:00.000Z',
      },
    ]);
    const { fixture } = await createFixture(new Map(), invitationsSvc);
    const cards = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('mat-card.tile'),
    );
    const subtitle = (card: Element) =>
      (card.querySelector('mat-card-subtitle')?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const mode = TONE_MAP['grimoire-emeraude']['partie.mode_ralliement'];
    expect(subtitle(cards[0])).toContain(mode);
    expect(subtitle(cards[0])).not.toContain('Ryuutama');
    expect(subtitle(cards[1])).toContain('Ryuutama');
  });
});

describe('Dashboard — pastille « Invitation à accepter » (Story 41.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('une invitation à une rencontre de ralliement porte la pastille écrite, une quête non ; Accepter et Refuser restent', async () => {
    const invitationsSvc = makeInvitationsService();
    invitationsSvc.listReceived.mockResolvedValue([
      {
        id: 'inv-s',
        partie: { id: 's1', name: 'Marathon Pandémie', gameSystemId: 'ralliement' },
        inviterPseudo: 'Marc',
        status: 'PENDING' as const,
        createdAt: '2026-10-11T00:00:00.000Z',
      },
      {
        id: 'inv-q',
        partie: { id: 'q1', name: 'La Quête', gameSystemId: 'ryuutama' },
        inviterPseudo: 'Léa',
        status: 'PENDING' as const,
        createdAt: '2026-10-11T00:00:00.000Z',
      },
    ]);
    const { fixture } = await createFixture(new Map(), invitationsSvc);
    const cards = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('mat-card.tile'),
    );
    const chip = TONE_MAP['grimoire-emeraude']['dashboard.invitation_pending_chip'];
    expect(cards[0].querySelector('.invitation-chip app-status-badge')?.textContent).toContain(
      chip,
    );
    expect(cards[1].querySelector('.invitation-chip')).toBeNull();
    for (const card of cards.slice(0, 2)) {
      expect(card.querySelectorAll('mat-card-actions button')).toHaveLength(2);
    }
  });
});

describe('Dashboard — accept() rafraîchit la liste des parties (Story 38.5 : refreshAll)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('accept() appelle myPartiesSvc.refreshAll()', async () => {
    const invitationsSvc = makeInvitationsService();
    invitationsSvc.listReceived.mockResolvedValue([
      {
        id: 'inv1',
        partie: { id: 'p-new', name: 'Nouvelle Campagne', gameSystemId: 'ryuutama' },
        inviterPseudo: 'MJ',
        status: 'PENDING' as const,
        createdAt: '2026-07-22T00:00:00.000Z',
      },
    ]);
    const { fixture } = await createFixture(new Map(), invitationsSvc);
    const comp = fixture.componentInstance as any;
    const myParties = TestBed.inject(MyPartiesService) as unknown as {
      refreshAll: ReturnType<typeof vi.fn>;
    };

    await comp.accept(comp.received()[0]);

    expect(myParties.refreshAll).toHaveBeenCalledTimes(1);
  });
});

describe('Dashboard — câblage temps réel (Story 21.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('connect() est appelé avec userTopic(currentUserId) au montage (AC1)', async () => {
    const { realtimeSvc } = await createFixture(new Map());
    expect(realtimeSvc.connect).toHaveBeenCalledWith(userTopic('u1'));
  });

  it('disconnect() est appelé à la destruction du composant', async () => {
    const { fixture, realtimeSvc } = await createFixture(new Map());
    fixture.destroy();
    expect(realtimeSvc.disconnect).toHaveBeenCalledTimes(1);
    expect(realtimeSvc.disconnect).toHaveBeenCalledWith(userTopic('u1'));
  });

  it('une notification InvitationsService.changed() recharge les invitations reçues (AC2)', async () => {
    const invitationsSvc = makeInvitationsService();
    const { fixture } = await createFixture(new Map(), invitationsSvc);
    const comp = fixture.componentInstance as any;
    const updated = [
      {
        id: 'inv1',
        partie: { id: 'p1', name: 'Ma Campagne', gameSystemId: 'ryuutama' },
        inviterPseudo: 'MJ',
        status: 'PENDING' as const,
        createdAt: '2026-07-22T00:00:00.000Z',
      },
    ];
    invitationsSvc.listReceived.mockResolvedValue(updated);

    invitationsSvc.changed.update((v) => v + 1);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(comp.received()).toEqual(updated);
  });

  it('garde firstRun : un changed() déjà non-nul au montage ne déclenche PAS de refetch redondant', async () => {
    // InvitationsService est providedIn:'root' — son signal _changed peut déjà porter une valeur
    // non-nulle AVANT le montage (mutation locale antérieure dans la même session). Sans le garde
    // firstRun, ce cas déclencherait un refetch en plus de celui déjà fait par ngOnInit(). Dashboard
    // ne rend aucun enfant réagissant lui aussi à InvitationsService.changed — un compte exact de 1
    // est donc fiable ici.
    const invitationsSvc = makeInvitationsService({ changed: signal(1) });
    await createFixture(new Map(), invitationsSvc);

    expect(invitationsSvc.listReceived.mock.calls.length).toBe(1);
  });
});

describe('Dashboard — traitement « en retrait » des parties terminées (Story 29.6, AC5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('une partie TERMINEE porte la classe tile--closed et un libellé/icône non chromatique', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'player', 'TERMINEE'),
    ]);
    const tile = fixture.nativeElement.querySelector('.tile');
    expect(tile.classList.contains('tile--closed')).toBe(true);
    const indicator = fixture.nativeElement.querySelector('.status-indicator');
    expect(indicator).not.toBeNull();
    expect(indicator.querySelector('app-icon')).not.toBeNull();
    expect(indicator.textContent).toContain(
      TONE_MAP['grimoire-emeraude']['dashboard.status_closed_badge'],
    );
  });

  it('une partie EN_COURS/A_VENIR ne porte ni la classe tile--closed ni le badge « terminée »', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'player', 'EN_COURS'),
      makeParty('p2', 'player', 'A_VENIR'),
    ]);
    const tiles = fixture.nativeElement.querySelectorAll('.tile');
    tiles.forEach((tile: Element) => expect(tile.classList.contains('tile--closed')).toBe(false));
    // Ces tuiles portent tout de même leur propre .status-indicator (AC9/P-1, revue de code) —
    // seul le libellé « terminée » (dashboard.status_closed_badge) doit être absent.
    const indicators = fixture.nativeElement.querySelectorAll('.status-indicator');
    indicators.forEach((indicator: Element) =>
      expect(indicator.textContent).not.toContain(
        TONE_MAP['grimoire-emeraude']['dashboard.status_closed_badge'],
      ),
    );
  });
});

describe('Dashboard — rencontre isolée annulée (Story 42.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('une partie ANNULEE porte tile--cancelled, le mot « Annulée » et un pictogramme, reste cliquable ; jamais « terminée »', async () => {
    const signals = new Map([
      [
        'p1',
        {
          role: 'player' as const,
          status: 'ANNULEE' as const,
          signals: ['PARTIE_ANNULEE'] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'ANNULEE')],
      signals as any,
    );
    const tile = fixture.nativeElement.querySelector('.tile') as HTMLElement;
    expect(tile.classList.contains('tile--cancelled')).toBe(true);
    expect(tile.classList.contains('tile--closed')).toBe(false);
    const indicator = fixture.nativeElement.querySelector('.status-indicator--cancelled');
    expect(indicator).not.toBeNull();
    expect(indicator.querySelector('app-icon')).not.toBeNull();
    expect(indicator.textContent).toContain(
      TONE_MAP['grimoire-emeraude']['dashboard.status_cancelled_badge'],
    );
    expect(indicator.textContent).not.toContain(
      TONE_MAP['grimoire-emeraude']['dashboard.status_closed_badge'],
    );
    // Le signal PARTIE_ANNULEE est redondant avec l'état écrit : jamais rendu en badge.
    expect(fixture.nativeElement.querySelector('.signal-badge')).toBeNull();
  });

  it('une partie ANNULEE est rangée avec les terminées, pas dans « ce qui t’attend »', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'player', 'ANNULEE'),
      makeParty('p2', 'player', 'A_VENIR'),
    ]);
    const tiles = Array.from(fixture.nativeElement.querySelectorAll('.tile')) as HTMLElement[];
    expect(tiles.filter((t) => t.classList.contains('tile--cancelled'))).toHaveLength(1);
  });
});

describe('Dashboard — bandeau contextuel (Story 29.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("ngOnInit() renseigne ContextualNavService avec le titre de l'écran", async () => {
    await createFixture(new Map());

    const contextualNav = TestBed.inject(ContextualNavService);
    expect(contextualNav.title()).toBe(TONE_MAP['grimoire-emeraude']['nav.my_games']);
  });
});

describe('Dashboard — badges de signal (Story 29.7, AC3/AC9)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('une partie avec 3 signaux → 2 badges visibles + compteur "+1"', async () => {
    const signals = new Map([
      [
        'p1',
        {
          role: 'player' as const,
          status: 'EN_COURS' as const,
          signals: [
            'PERSONNAGE_A_CREER',
            'VOTE_EN_COURS_SANS_REPONSE',
            'PROCHAINE_SEANCE_CONNUE',
          ] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      signals as any,
    );
    const badges = fixture.nativeElement.querySelectorAll('.signal-badge:not(.signal-badge--more)');
    expect(badges.length).toBe(2);
    const more = fixture.nativeElement.querySelector('.signal-badge--more');
    expect(more).not.toBeNull();
    expect(more.textContent).toContain('+1');
  });

  it('un badge de signal porte toujours une icône ET un libellé (jamais la couleur seule)', async () => {
    const signals = new Map([
      [
        'p1',
        {
          role: 'mj' as const,
          status: 'EN_COURS' as const,
          signals: ['AUCUN_MEMBRE_INVITE'] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'mj', 'EN_COURS')],
      signals as any,
    );
    const badge = fixture.nativeElement.querySelector('.signal-badge');
    expect(badge).not.toBeNull();
    expect(badge.querySelector('app-icon')).not.toBeNull();
    expect(badge.textContent.trim().length).toBeGreaterThan(0);
  });

  it('aucun signal → aucun badge affiché', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      new Map(),
    );
    expect(fixture.nativeElement.querySelector('.signal-badge')).toBeNull();
  });

  it('PROCHAINE_SEANCE_CONNUE affiche la date réelle (nextSessionDate/nextSessionSlot), pas un libellé générique (bug fix, revue utilisateur)', async () => {
    const party = {
      ...makeParty('p1', 'player', 'EN_COURS'),
      nextSessionDate: '2026-08-12T00:00:00.000Z',
      nextSessionSlot: 'EVENING' as const,
    };
    const signals = new Map([
      [
        'p1',
        {
          role: 'player' as const,
          status: 'EN_COURS' as const,
          signals: ['PROCHAINE_SEANCE_CONNUE'] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(new Map(), undefined, [party], signals as any);
    const badge = fixture.nativeElement.querySelector('.signal-badge');
    expect(badge.textContent).toContain('12 août');
    expect(badge.textContent).toContain('Soir');
  });

  it('Story 47.2 : PROCHAINE_SEANCE_CONNUE écrit la plage « début → fin » d’un rendez-vous de plusieurs créneaux', async () => {
    const party = {
      ...makeParty('p1', 'player', 'EN_COURS'),
      nextSessionDate: '2026-11-14T00:00:00.000Z',
      nextSessionSlot: 'EVENING' as const,
      nextSessionEndDate: '2026-11-15T00:00:00.000Z',
      nextSessionEndSlot: 'AFTERNOON' as const,
    };
    const signals = new Map([
      [
        'p1',
        {
          role: 'player' as const,
          status: 'EN_COURS' as const,
          signals: ['PROCHAINE_SEANCE_CONNUE'] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(new Map(), undefined, [party], signals as any);
    const badge = fixture.nativeElement.querySelector('.signal-badge');
    expect(badge.textContent).toContain('14 novembre, Soir → 15 novembre, Après-midi');
  });

  it('Story 47.2 : une fin égale au début garde le libellé d’un créneau', async () => {
    const party = {
      ...makeParty('p1', 'player', 'EN_COURS'),
      nextSessionDate: '2026-08-12T00:00:00.000Z',
      nextSessionSlot: 'EVENING' as const,
      nextSessionEndDate: '2026-08-12T00:00:00.000Z',
      nextSessionEndSlot: 'EVENING' as const,
    };
    const signals = new Map([
      [
        'p1',
        {
          role: 'player' as const,
          status: 'EN_COURS' as const,
          signals: ['PROCHAINE_SEANCE_CONNUE'] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(new Map(), undefined, [party], signals as any);
    expect(fixture.nativeElement.querySelector('.signal-badge').textContent).not.toContain('→');
  });

  it('PARTIE_TERMINEE n’est jamais rendu en badge (doublon avec .status-indicator, revue de code)', async () => {
    const signals = new Map([
      [
        'p1',
        {
          role: 'player' as const,
          status: 'TERMINEE' as const,
          signals: ['PARTIE_TERMINEE', 'RAPPORT_FIN_MANQUANT'] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'TERMINEE')],
      signals as any,
    );
    const badges = fixture.nativeElement.querySelectorAll('.signal-badge:not(.signal-badge--more)');
    expect(badges.length).toBe(1);
    expect(badges[0].textContent).not.toContain(
      TONE_MAP['grimoire-emeraude']['partie.signal_partie_terminee'],
    );
    // .status-indicator porte déjà l'information « terminée » — pas de doublon.
    expect(fixture.nativeElement.querySelector('.status-indicator')).not.toBeNull();
  });

  it('un badge informatif (PROCHAINE_SEANCE_CONNUE) porte une teinte distincte des badges actionnables (revue de code)', async () => {
    const signals = new Map([
      [
        'p1',
        {
          role: 'player' as const,
          status: 'EN_COURS' as const,
          signals: ['PERSONNAGE_A_CREER', 'PROCHAINE_SEANCE_CONNUE'] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      signals as any,
    );
    const badges = fixture.nativeElement.querySelectorAll('.signal-badge:not(.signal-badge--more)');
    expect(badges.length).toBe(2);
    const actionable = Array.from(badges as unknown as Element[]).find(
      (b) => !b.classList.contains('signal-badge--soon'),
    );
    const informational = Array.from(badges as unknown as Element[]).find((b) =>
      b.classList.contains('signal-badge--soon'),
    );
    expect(actionable).not.toBeUndefined();
    expect(informational).not.toBeUndefined();
    expect(informational!.textContent).toContain(
      GRIMOIRE_TONE['partie.signal_prochaine_seance_connue'],
    );
  });
});

describe('Dashboard — teinte des cartes selon le statut (bug fix, revue utilisateur : StateRail, DESIGN.md §7.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('une partie EN_COURS sans signal actionnable porte la classe tile--live', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      new Map(),
    );
    const tile = fixture.nativeElement.querySelector('.tile');
    expect(tile.classList.contains('tile--live')).toBe(true);
  });

  it('une partie A_VENIR sans signal actionnable porte la classe tile--soon', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'A_VENIR')],
      new Map(),
    );
    const tile = fixture.nativeElement.querySelector('.tile');
    expect(tile.classList.contains('tile--soon')).toBe(true);
  });

  it('une partie avec un signal actionnable porte tile--awaiting, jamais tile--live/tile--soon', async () => {
    const signals = new Map([
      [
        'p1',
        {
          role: 'mj' as const,
          status: 'EN_COURS' as const,
          signals: ['AUCUN_MEMBRE_INVITE'] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'mj', 'EN_COURS')],
      signals as any,
    );
    const tile = fixture.nativeElement.querySelector('.tile');
    expect(tile.classList.contains('tile--awaiting')).toBe(true);
    expect(tile.classList.contains('tile--live')).toBe(false);
  });

  it('une partie EN_COURS sans aucun signal affiche quand même un libellé non chromatique (AC9/P-1, revue de code)', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      new Map(),
    );
    const tile = fixture.nativeElement.querySelector('.tile');
    expect(tile.classList.contains('tile--live')).toBe(true);
    const indicator = tile.querySelector('.status-indicator');
    expect(indicator).not.toBeNull();
    expect(indicator.querySelector('app-icon')).not.toBeNull();
    expect(indicator.textContent).toContain(
      TONE_MAP['grimoire-emeraude']['dashboard.section_ongoing'],
    );
  });

  it('une partie A_VENIR sans aucun signal affiche quand même un libellé non chromatique (AC9/P-1, revue de code)', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'A_VENIR')],
      new Map(),
    );
    const tile = fixture.nativeElement.querySelector('.tile');
    expect(tile.classList.contains('tile--soon')).toBe(true);
    const indicator = tile.querySelector('.status-indicator');
    expect(indicator).not.toBeNull();
    expect(indicator.textContent).toContain(
      TONE_MAP['grimoire-emeraude']['dashboard.section_upcoming'],
    );
  });

  it('un signal « en retard » (RAPPORT_FIN_MANQUANT) porte tile--soon, jamais tile--awaiting (AC8, revue de code)', async () => {
    const signals = new Map([
      [
        'p1',
        {
          role: 'mj' as const,
          status: 'EN_COURS' as const,
          signals: ['RAPPORT_FIN_MANQUANT'] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'mj', 'EN_COURS')],
      signals as any,
    );
    const tile = fixture.nativeElement.querySelector('.tile');
    expect(tile.classList.contains('tile--soon')).toBe(true);
    expect(tile.classList.contains('tile--awaiting')).toBe(false);
  });
});

describe('Dashboard — quatre intertitres (Story 29.7, AC10)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('regroupe les parties en ce qui t’attend / en cours / à venir / terminées', async () => {
    const signals = new Map([
      [
        'p-awaiting',
        {
          role: 'mj' as const,
          status: 'EN_COURS' as const,
          signals: ['AUCUN_MEMBRE_INVITE'] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [
        makeParty('p-awaiting', 'mj', 'EN_COURS'),
        makeParty('p-ongoing', 'player', 'EN_COURS'),
        makeParty('p-upcoming', 'player', 'A_VENIR'),
        makeParty('p-finished', 'player', 'TERMINEE'),
      ],
      signals as any,
    );
    const headings: string[] = [];
    fixture.nativeElement
      .querySelectorAll('h2')
      .forEach((h: Element) => headings.push(h.textContent ?? ''));
    expect(headings).toContain(TONE_MAP['grimoire-emeraude']['dashboard.section_awaiting']);
    expect(headings).toContain(TONE_MAP['grimoire-emeraude']['dashboard.section_ongoing']);
    expect(headings).toContain(TONE_MAP['grimoire-emeraude']['dashboard.section_upcoming']);
    expect(headings).toContain(TONE_MAP['grimoire-emeraude']['dashboard.section_finished']);
    expect(fixture.nativeElement.querySelectorAll('.tile').length).toBe(4);
  });

  it('une section vide ne rend aucun intertitre', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      new Map(),
    );
    const headings: string[] = [];
    fixture.nativeElement
      .querySelectorAll('h2')
      .forEach((h: Element) => headings.push(h.textContent ?? ''));
    expect(headings).not.toContain(TONE_MAP['grimoire-emeraude']['dashboard.section_awaiting']);
    expect(headings).not.toContain(TONE_MAP['grimoire-emeraude']['dashboard.section_upcoming']);
    expect(headings).not.toContain(TONE_MAP['grimoire-emeraude']['dashboard.section_finished']);
  });
});

describe('Dashboard — filtres rôle/statut (Story 29.8, AC2/AC5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('filtre par rôle : réduit la liste affichée sans appel réseau supplémentaire', async () => {
    const { fixture, myPartiesSvc } = await createFixture(new Map(), undefined, [
      makeParty('p-mj', 'mj'),
      makeParty('p-player', 'player'),
    ]);
    expect(fixture.nativeElement.querySelectorAll('.tile').length).toBe(2);

    const comp = fixture.componentInstance as any;
    comp.roleFilter.set('mj');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.tile').length).toBe(1);
    expect(myPartiesSvc.refreshAll).not.toHaveBeenCalled();
  });

  it('filtre par statut : réduit la liste affichée', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'player', 'EN_COURS'),
      makeParty('p2', 'player', 'A_VENIR'),
    ]);
    expect(fixture.nativeElement.querySelectorAll('.tile').length).toBe(2);

    const comp = fixture.componentInstance as any;
    comp.statusFilter.set('A_VENIR');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.tile').length).toBe(1);
  });

  it('les sélecteurs de filtre se limitent au rôle, au genre et au statut (AC5) — aucun select de date/nom/type', async () => {
    const { fixture } = await createFixture(new Map());
    const selects = fixture.nativeElement.querySelectorAll('select');
    // 4 <select> attendus : rôle, genre (Story 38.5), statut, tri (le tri N'EST PAS un filtre — AC5).
    expect(selects.length).toBe(4);
  });
});

// Repli/révélation par icône (comportement générique) : couvert par `list-control-bar.spec.ts`
// (Story 29.9) — plus dupliqué ici. Ce fichier ne vérifie que le câblage `Dashboard` ↔
// `ListControlBar` (cf. describe ci-dessous).
describe('Dashboard — câblage vers ListControlBar (Story 29.9)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('les filtres rôle/statut/masquage sont bien projetés dans ListControlBar', async () => {
    const { fixture } = await createFixture(new Map());
    const bar = fixture.nativeElement.querySelector('app-list-control-bar');
    expect(bar.querySelectorAll('select').length).toBeGreaterThanOrEqual(2);
    expect(bar.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it("bascule de mode d'affichage appelle AccountService.updatePreferences({ partiesViewMode }) et change la classe CSS de la grille", async () => {
    const { fixture, accountSvc } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'player', 'A_VENIR'),
    ]);
    accountSvc.updatePreferences.mockResolvedValue({});

    const modeButtons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('.list-control-bar__mode');
    modeButtons[2].click(); // 'compact'
    fixture.detectChanges();
    await fixture.whenStable();

    expect(accountSvc.updatePreferences).toHaveBeenCalledWith({ partiesViewMode: 'compact' });
    expect(fixture.nativeElement.querySelector('.grid--compact')).not.toBeNull();
  });
});

// DESIGN.md §4.1 + §7.7 « ne pas » : le mode liste a son PROPRE rendu — une ligne, pas une carte
// rétrécie. C'est l'écart avec la maquette (direction B de `directions-liste-parties.html`) relevé
// après la première implémentation de 29.9, qui ne faisait varier que la densité de la carte.
describe('Dashboard — mode liste : gabarit ligne (Story 29.9, AC1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('mode compact → des lignes .row, aucune carte .tile', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      new Map(),
      { partiesViewMode: 'compact' },
    );

    expect(fixture.nativeElement.querySelectorAll('.row').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.tile')).toBeNull();
  });

  it('mode moyen → des cartes .tile, aucune ligne .row', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      new Map(),
      { partiesViewMode: 'medium' },
    );

    expect(fixture.nativeElement.querySelector('.tile')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.row')).toBeNull();
  });

  it('la pastille n’est jamais seule : la sous-ligne porte rôle + libellé du signal dominant (P-1)', async () => {
    const signals = new Map([
      [
        'p1',
        {
          role: 'player' as const,
          status: 'EN_COURS' as const,
          signals: ['PERSONNAGE_A_CREER'] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      signals as any,
      { partiesViewMode: 'compact' },
    );

    const tone = TONE_MAP['grimoire-emeraude'];
    const sub = fixture.nativeElement.querySelector('.row__sub');
    expect(sub.textContent).toContain(tone['dashboard.role_player']);
    expect(sub.textContent).toContain(tone['partie.signal_personnage_a_creer']);
  });

  it('sans aucun signal, la sous-ligne retombe sur le libellé de teinte — jamais vide', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      new Map(),
      { partiesViewMode: 'compact' },
    );

    const sub = fixture.nativeElement.querySelector('.row__sub');
    expect(sub.textContent).toContain(TONE_MAP['grimoire-emeraude']['dashboard.section_ongoing']);
  });

  it('un seul compteur (§4.1 bis), jamais les badges détaillés, et il porte un aria-label', async () => {
    const signals = new Map([
      [
        'p1',
        {
          role: 'player' as const,
          status: 'EN_COURS' as const,
          signals: [
            'PERSONNAGE_A_CREER',
            'VOTE_EN_COURS_SANS_REPONSE',
            'AUCUN_SCENARIO_EN_COURS',
          ] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      signals as any,
      { partiesViewMode: 'compact' },
    );

    const counts = fixture.nativeElement.querySelectorAll('.row__count');
    expect(counts.length).toBe(1);
    expect(counts[0].textContent.trim()).toBe('3');
    expect(counts[0].getAttribute('aria-label')).toContain('3');
    expect(fixture.nativeElement.querySelector('.signal-badge')).toBeNull();
  });

  it('l’étoile de favori reste actionnable en mode liste', async () => {
    const { fixture, accountSvc } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      new Map(),
      { partiesViewMode: 'compact' },
    );

    fixture.nativeElement.querySelector('.row .favorite-btn').click();
    await fixture.whenStable();

    expect(accountSvc.addFavorite).toHaveBeenCalledWith('p1');
  });
});

// AD-19 : les trois modes rendent leur bannière via le MÊME composant. `Dashboard` ne fait que
// lui passer le mode courant — il ne connaît ni la graine, ni les dimensions, ni le monogramme.
describe('Dashboard — câblage de la bannière générative (Story 29.10, AC3/AC4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const PARTIES = [makeParty('p1', 'player', 'EN_COURS'), makeParty('p2', 'mj', 'A_VENIR')];

  it('mode grand → une bannière par tuile, en mode "large"', async () => {
    const { fixture } = await createFixture(new Map(), undefined, PARTIES, new Map(), {
      partiesViewMode: 'large',
    });

    const banners = fixture.nativeElement.querySelectorAll('app-party-banner');
    expect(banners.length).toBe(2);
    for (const banner of banners) {
      expect(banner.classList.contains('party-banner-host--large')).toBe(true);
    }
  });

  it('mode moyen → une vignette carrée par tuile, dans l’en-tête', async () => {
    const { fixture } = await createFixture(new Map(), undefined, PARTIES, new Map(), {
      partiesViewMode: 'medium',
    });

    const banners = fixture.nativeElement.querySelectorAll('app-party-banner');
    expect(banners.length).toBe(2);
    for (const banner of banners) {
      expect(banner.classList.contains('party-banner-host--medium')).toBe(true);
      expect(banner.closest('.tile__head')).not.toBeNull();
    }
  });

  it('mode liste → une vignette par ligne, entre la pastille d’état et le texte', async () => {
    const { fixture } = await createFixture(new Map(), undefined, PARTIES, new Map(), {
      partiesViewMode: 'compact',
    });

    const banners = fixture.nativeElement.querySelectorAll('app-party-banner');
    expect(banners.length).toBe(2);

    const row = fixture.nativeElement.querySelector('.row');
    const children = Array.from(row.children) as Element[];
    const dotIndex = children.findIndex((el) => el.classList.contains('row__dot'));
    // La bannière est enveloppée avec son badge de système (Story 38.5) : le bloc `.row__vignette`.
    const bannerIndex = children.findIndex((el) => el.classList.contains('row__vignette'));
    expect(children[bannerIndex].querySelector('app-party-banner')).not.toBeNull();
    const textIndex = children.findIndex((el) => el.classList.contains('row__txt'));
    expect(dotIndex).toBeLessThan(bannerIndex);
    expect(bannerIndex).toBeLessThan(textIndex);
  });

  it('le monogramme rendu en mode liste vient du nom de la partie', async () => {
    const partie = { ...makeParty('p1', 'player', 'EN_COURS'), name: 'Les Cendres de Kavaan' };
    const { fixture } = await createFixture(new Map(), undefined, [partie], new Map(), {
      partiesViewMode: 'compact',
    });

    expect(fixture.nativeElement.querySelector('.party-banner__monogram').textContent.trim()).toBe(
      'CK',
    );
  });

  it('deux parties différentes → deux compositions différentes ; la même partie → la même', async () => {
    const { fixture } = await createFixture(new Map(), undefined, PARTIES, new Map(), {
      partiesViewMode: 'large',
    });

    const svgs = Array.from(
      fixture.nativeElement.querySelectorAll('app-party-banner svg'),
    ) as SVGElement[];
    // Les identifiants de défs sont scopés par instance : on les neutralise, ils DOIVENT différer.
    const strip = (svg: SVGElement) => svg.innerHTML.replace(/pb\d+/g, 'pbX');
    expect(strip(svgs[0])).not.toBe(strip(svgs[1]));
  });

  it('Story 29.12 : coverImageVersion est transmis à app-party-banner, qui rend l’image plutôt que la composition', async () => {
    const withCover = {
      ...makeParty('p1', 'player', 'EN_COURS'),
      coverImageVersion: '99999999-9999-9999-9999-999999999999',
    };
    const { fixture } = await createFixture(new Map(), undefined, [withCover], new Map(), {
      partiesViewMode: 'large',
    });

    expect(fixture.nativeElement.querySelector('app-party-banner img.party-banner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-party-banner svg.party-banner')).toBeNull();
  });

  it('non-régression 29.9 : le placeholder de bannière a disparu, la ligne garde ses éléments', async () => {
    const { fixture } = await createFixture(new Map(), undefined, PARTIES, new Map(), {
      partiesViewMode: 'compact',
    });

    // Le pseudo-élément `.grid--large .tile::before` n'est plus la bannière : plus aucune `.tile`
    // en mode liste, et les éléments de ligne de la Story 29.9 sont intacts.
    expect(fixture.nativeElement.querySelector('.tile')).toBeNull();
    expect(fixture.nativeElement.querySelector('.row__dot')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.row__sub')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.row .favorite-btn')).not.toBeNull();
  });

  it('les cartes d’invitation reçue ne portent aucune bannière', async () => {
    const invitationsSvc = makeInvitationsService();
    invitationsSvc.listReceived = vi.fn().mockResolvedValue([
      {
        id: 'inv1',
        inviterPseudo: 'mj',
        partie: { id: 'px', name: 'Invitée', gameSystemId: 'draconis' },
      },
    ]);
    const { fixture } = await createFixture(new Map(), invitationsSvc, [], new Map(), {
      partiesViewMode: 'large',
    });

    const invitationCard = fixture.nativeElement.querySelector('mat-card.tile');
    expect(invitationCard).not.toBeNull();
    expect(invitationCard.querySelector('app-party-banner')).toBeNull();
  });
});

// DESIGN.md §7.4 : le compte à rebours DOUBLE le badge de séance, et n'apparaît que sur UN SEUL
// élément à la fois — la prochaine séance.
//
// Trois conditions cumulatives, toutes issues d'un contrat resserré en revue :
//  · mode GRAND uniquement — `.signal-badges` est partagé avec le mode moyen, où AC2 interdit
//    toute animation, et le compte à rebours en porte ;
//  · le badge `PROCHAINE_SEANCE_CONNUE` doit être RÉELLEMENT visible — `visibleSignals` est
//    plafonné à deux, et sans cette garde le compte à rebours deviendrait le seul porteur de
//    l'information, ce qu'AC5 interdit ;
//  · la séance la plus proche à venir, et elle seule.
describe('Dashboard — compte à rebours de séance (Story 29.11, AC4/AC5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function inDays(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString();
  }

  function partyWithSession(id: string, days: number | null): PartieDto {
    return {
      ...makeParty(id, 'player', 'EN_COURS'),
      nextSessionDate: days === null ? null : inDays(days),
    };
  }

  /** Signaux portant le badge de séance — condition nécessaire à l'affichage du compte à rebours. */
  function sessionSignals(...ids: string[]) {
    return new Map(
      ids.map((id) => [
        id,
        {
          role: 'player' as const,
          status: 'EN_COURS' as const,
          signals: ['PROCHAINE_SEANCE_CONNUE'] as const,
        },
      ]),
    );
  }

  async function renderLarge(parties: PartieDto[], signalled: string[]) {
    return createFixture(new Map(), undefined, parties, sessionSignals(...signalled) as any, {
      partiesViewMode: 'large',
    });
  }

  it('séance dans trois jours, badge visible, mode grand → compte à rebours rendu', async () => {
    const { fixture } = await renderLarge([partyWithSession('p1', 3)], ['p1']);
    expect(fixture.nativeElement.querySelector('app-party-countdown')).not.toBeNull();
  });

  it('séance dans dix jours → aucun compte à rebours (au-delà de la fenêtre de sept jours)', async () => {
    const { fixture } = await renderLarge([partyWithSession('p1', 10)], ['p1']);
    expect(fixture.nativeElement.querySelector('app-party-countdown')).toBeNull();
  });

  it('aucune date → aucun compte à rebours, aucune erreur', async () => {
    const { fixture } = await renderLarge([partyWithSession('p1', null)], ['p1']);
    expect(fixture.nativeElement.querySelector('app-party-countdown')).toBeNull();
  });

  it('AC5 : sans badge de séance visible, aucun compte à rebours — il ne peut rien doubler', async () => {
    // Même partie, même date : seul le badge manque. Sans cette garde, le compte à rebours serait
    // le seul porteur de l'information de séance.
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [partyWithSession('p1', 3)],
      new Map(),
      { partiesViewMode: 'large' },
    );
    expect(fixture.nativeElement.querySelector('app-party-countdown')).toBeNull();
  });

  it('AC2 : aucun compte à rebours en mode moyen ni en mode liste — il porte de l’animation', async () => {
    for (const mode of ['medium', 'compact'] as const) {
      const { fixture } = await createFixture(
        new Map(),
        undefined,
        [partyWithSession('p1', 3)],
        sessionSignals('p1') as any,
        { partiesViewMode: mode },
      );
      expect(fixture.nativeElement.querySelector('app-party-countdown')).toBeNull();
      TestBed.resetTestingModule();
    }
  });

  it('trois parties éligibles → UN SEUL compte à rebours, celui de la séance la plus proche', async () => {
    const { fixture } = await renderLarge(
      [partyWithSession('loin', 6), partyWithSession('proche', 1), partyWithSession('milieu', 4)],
      ['loin', 'proche', 'milieu'],
    );

    const countdowns = fixture.nativeElement.querySelectorAll('app-party-countdown');
    expect(countdowns.length).toBe(1);
    expect(countdowns[0].closest('mat-card').textContent).toContain('Party proche');
  });

  it('une séance PASSÉE ne confisque pas le compte à rebours de la vraie prochaine', async () => {
    // `nextSessionDate` n'est jamais purgé après coup (item différé, revue 29.7) : sans garde, une
    // date passée gagnerait toujours la comparaison sur l'horodatage le plus ancien.
    const { fixture } = await renderLarge(
      [partyWithSession('passee', -3), partyWithSession('avenir', 2)],
      ['passee', 'avenir'],
    );

    const countdowns = fixture.nativeElement.querySelectorAll('app-party-countdown');
    expect(countdowns.length).toBe(1);
    expect(countdowns[0].closest('mat-card').textContent).toContain('Party avenir');
  });

  it('AC5 : le badge de séance reste rendu à côté, libellé inchangé', async () => {
    const { fixture } = await renderLarge([partyWithSession('p1', 2)], ['p1']);

    expect(fixture.nativeElement.querySelector('app-party-countdown')).not.toBeNull();
    const badge = fixture.nativeElement.querySelector('.signal-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent.trim().length).toBeGreaterThan(0);
  });

  it('le compte à rebours est décoratif : aucun texte ajouté à la carte', async () => {
    const { fixture } = await renderLarge([partyWithSession('p1', 2)], ['p1']);
    const countdown = fixture.nativeElement.querySelector('app-party-countdown');
    expect(countdown.textContent.trim()).toBe('');
    expect(countdown.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('Dashboard — tri (Story 29.8, AC3/AC4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("changer le tri appelle AccountService.updatePreferences({ partiesSort }) et réordonne l'affichage", async () => {
    const { fixture, accountSvc } = await createFixture(new Map(), undefined, [
      makeParty('zebre', 'player', 'A_VENIR'),
      makeParty('abbaye', 'player', 'A_VENIR'),
    ]);
    const comp = fixture.componentInstance as any;
    // Deux parties A_VENIR nommées 'Party zebre'/'Party abbaye' — noms générés par makeParty().
    comp.onSortChange('nom');
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(accountSvc.updatePreferences).toHaveBeenCalledWith({ partiesSort: 'nom' });
    const titles = Array.from(fixture.nativeElement.querySelectorAll('mat-card-title')).map(
      (el: any) => el.textContent.trim(),
    );
    // Tri alphabétique : "Party abbaye" avant "Party zebre".
    expect(titles[0]).toContain('Party abbaye');
  });

  it("tri 'urgence' (défaut) : les 4 intertitres restent affichés", async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'player', 'EN_COURS'),
    ]);
    expect(fixture.nativeElement.textContent).toContain(
      TONE_MAP['grimoire-emeraude']['dashboard.section_ongoing'],
    );
  });

  it("tri différent de 'urgence' : les 4 intertitres disparaissent au profit d'une liste plate", async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      new Map(),
      { partiesSort: 'nom' },
    );
    const headings: string[] = [];
    fixture.nativeElement
      .querySelectorAll('h2')
      .forEach((h: Element) => headings.push(h.textContent ?? ''));
    expect(headings).not.toContain(TONE_MAP['grimoire-emeraude']['dashboard.section_ongoing']);
    expect(fixture.nativeElement.querySelectorAll('.tile').length).toBe(1);
  });

  it("échec serveur (Review Findings) : onSortChange() restaure l'ancien critère plutôt que de laisser l'UI mentir", async () => {
    const failingAccountSvc = {
      updatePreferences: vi.fn().mockRejectedValue(new Error('boom')),
      addFavorite: vi.fn(),
      removeFavorite: vi.fn(),
    };
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      new Map(),
      { partiesSort: 'urgence' },
      failingAccountSvc as any,
    );
    const comp = fixture.componentInstance as any;

    comp.onSortChange('nom');
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(comp.partiesSort()).toBe('urgence');
  });
});

describe('Dashboard — masquage des parties terminées (Story 29.8, AC6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('hideFinishedParties actif : les parties TERMINEE sont absentes par défaut', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS'), makeParty('p2', 'player', 'TERMINEE')],
      new Map(),
      { hideFinishedParties: true },
    );
    expect(fixture.nativeElement.querySelectorAll('.tile').length).toBe(1);
  });

  it('le bouton de révélation fait réapparaître les terminées sans nouvel appel serveur (AC6, dernière clause)', async () => {
    const { fixture, accountSvc } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS'), makeParty('p2', 'player', 'TERMINEE')],
      new Map(),
      { hideFinishedParties: true },
    );
    expect(fixture.nativeElement.querySelectorAll('.tile').length).toBe(1);

    const revealBtn = fixture.nativeElement.querySelector('.controls-bar__reveal');
    expect(revealBtn).not.toBeNull();
    revealBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.tile').length).toBe(2);
    expect(accountSvc.updatePreferences).not.toHaveBeenCalled();
  });

  it('hideFinishedParties inactif : aucun bouton de révélation, les terminées sont déjà visibles', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'TERMINEE')],
      new Map(),
      { hideFinishedParties: false },
    );
    expect(fixture.nativeElement.querySelector('.controls-bar__reveal')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.tile').length).toBe(1);
  });

  it('cocher la case appelle AccountService.updatePreferences({ hideFinishedParties: true })', async () => {
    const { fixture, accountSvc } = await createFixture(new Map());
    const comp = fixture.componentInstance as any;

    comp.onHideFinishedChange(true);
    fixture.detectChanges();

    expect(accountSvc.updatePreferences).toHaveBeenCalledWith({ hideFinishedParties: true });
  });

  it("échec serveur (Review Findings) : onHideFinishedChange() restaure l'ancienne préférence", async () => {
    const failingAccountSvc = {
      updatePreferences: vi.fn().mockRejectedValue(new Error('boom')),
      addFavorite: vi.fn(),
      removeFavorite: vi.fn(),
    };
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      new Map(),
      { hideFinishedParties: false },
      failingAccountSvc as any,
    );
    const comp = fixture.componentInstance as any;

    comp.onHideFinishedChange(true);
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(comp.hideFinishedParties()).toBe(false);
  });

  it('le bouton de révélation ne tient pas compte des parties terminées hors du filtre de rôle actif (Review Findings)', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p-mj', 'mj', 'EN_COURS'), makeParty('p-player-terminee', 'player', 'TERMINEE')],
      new Map(),
      { hideFinishedParties: true },
    );
    const comp = fixture.componentInstance as any;
    comp.roleFilter.set('mj');
    fixture.detectChanges();

    expect(comp.hasHiddenFinished()).toBe(false);
    expect(fixture.nativeElement.querySelector('.controls-bar__reveal')).toBeNull();
  });
});

describe('Dashboard — favoris (Story 29.8, AC1, FR-11)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("clic sur l'étoile d'une partie MJ non favorite appelle addFavorite et recharge la liste (refreshAll)", async () => {
    const { fixture, accountSvc, myPartiesSvc } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'mj', 'EN_COURS', false),
    ]);
    const star = fixture.nativeElement.querySelector('.favorite-btn');
    expect(star).not.toBeNull();
    star.click();
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(accountSvc.addFavorite).toHaveBeenCalledWith('p1');
    expect(myPartiesSvc.refreshAll).toHaveBeenCalledTimes(1);
  });

  it("clic sur l'étoile d'une partie joueur déjà favorite appelle removeFavorite et recharge la liste (refreshAll)", async () => {
    const { fixture, accountSvc, myPartiesSvc } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'player', 'EN_COURS', true),
    ]);
    const star = fixture.nativeElement.querySelector('.favorite-btn');
    star.click();
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(accountSvc.removeFavorite).toHaveBeenCalledWith('p1');
    expect(myPartiesSvc.refreshAll).toHaveBeenCalledTimes(1);
  });

  it("l'étoile porte un aria-label explicite, jamais la couleur/l'icône seule", async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'player', 'EN_COURS', true),
    ]);
    const star = fixture.nativeElement.querySelector('.favorite-btn');
    expect(star.getAttribute('aria-label')).toBeTruthy();
    expect(star.classList.contains('favorite-btn--active')).toBe(true);
  });

  it('une partie favorite apparaît en tête de son groupe après rechargement (AC1)', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeParty('p-a', 'player', 'A_VENIR', false),
      makeParty('p-b', 'player', 'A_VENIR', true),
    ]);
    const titles = Array.from(fixture.nativeElement.querySelectorAll('mat-card-title')).map(
      (el: any) => el.textContent,
    );
    // p-b (favorite) doit précéder p-a, alors qu'elle est arrivée en 2e position dans allParties().
    const idxA = titles.findIndex((t: string) => t.includes('Party p-a'));
    const idxB = titles.findIndex((t: string) => t.includes('Party p-b'));
    expect(idxB).toBeLessThan(idxA);
  });

  it('garde anti-double-clic (Review Findings) : un second clic pendant que la requête est en vol est ignoré', async () => {
    let resolveAdd!: () => void;
    const pendingAdd = new Promise<{ ok: true }>((resolve) => {
      resolveAdd = () => resolve({ ok: true });
    });
    const accountSvc = {
      updatePreferences: vi.fn().mockResolvedValue(undefined),
      addFavorite: vi.fn().mockReturnValue(pendingAdd),
      removeFavorite: vi.fn(),
    };
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS', false)],
      new Map(),
      {},
      accountSvc as any,
    );
    const star = fixture.nativeElement.querySelector('.favorite-btn');

    star.click();
    fixture.detectChanges();
    star.click(); // second clic pendant que la première requête est encore en vol
    fixture.detectChanges();

    expect(accountSvc.addFavorite).toHaveBeenCalledTimes(1);
    expect(star.disabled).toBe(true);

    resolveAdd();
    await pendingAdd;
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(star.disabled).toBe(false);
  });
});

// ── Story 38.5 : reconnaître ses ralliements dans la liste ───────────────────────────────────────
function makeRalliement(
  id: string,
  role: PartieRole = 'admin',
  kind: PartieDto['kind'] = 'ONE_SHOT',
): PartieDto {
  return { ...makeParty(id, role), gameSystemId: 'ralliement', kind };
}

function makeQuete(id: string, role: PartieRole = 'mj', status: PartieDto['status'] = 'EN_COURS') {
  return { ...makeParty(id, role, status), gameSystemId: 'ryuutama' };
}

const textOf = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Le mot du rôle seul (sans le nom de l'icône Material qui le précède). */
const roleWord = (indicator: Element | null): string =>
  textOf(indicator?.querySelector('span') ?? null);

/** Le nom d'une tuile, sans le texte de l'icône d'étoile qui le suit. */
const titleOf = (title: Element): string => (title.firstChild?.textContent ?? '').trim();

/** La tuile (carte) d'une partie de test, retrouvée par son nom « Party <id> ». */
function tileOf(root: HTMLElement, id: string): HTMLElement {
  const tiles = Array.from(root.querySelectorAll('.tile')) as HTMLElement[];
  return tiles.find((t) => titleOf(t.querySelector('mat-card-title')!) === `Party ${id}`)!;
}

describe('Dashboard — pastille, badge, sous-titre et rôle des ralliements (Story 38.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const MIXED = [
    makeQuete('q', 'mj'),
    makeRalliement('iso', 'admin', 'ONE_SHOT'),
    makeRalliement('grp', 'member', 'CAMPAGNE_EPISODIQUE'),
  ];

  it('liste mixte : une tuile par partie, pastilles Ryuutama / Ralliement / Ralliement, rôles Maître / Hôte / Membre', async () => {
    const { fixture } = await createFixture(new Map(), undefined, MIXED);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.tile')).toHaveLength(3);
    expect(textOf(tileOf(root, 'q').querySelector('.system-chip'))).toBe('Ryuutama');
    expect(textOf(tileOf(root, 'iso').querySelector('.system-chip'))).toBe('Ralliement');
    expect(textOf(tileOf(root, 'grp').querySelector('.system-chip'))).toBe('Ralliement');
    expect(roleWord(tileOf(root, 'q').querySelector('.role-indicator'))).toBe('Maître');
    expect(roleWord(tileOf(root, 'iso').querySelector('.role-indicator'))).toBe('Hôte');
    expect(roleWord(tileOf(root, 'grp').querySelector('.role-indicator'))).toBe('Membre');
  });

  it('la pastille vient APRÈS l’indicateur de rôle, est un simple texte non interactif', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [makeQuete('q')]);
    const subtitle = fixture.nativeElement.querySelector('mat-card-subtitle') as HTMLElement;
    const role = subtitle.querySelector('.role-indicator') as HTMLElement;
    const chip = subtitle.querySelector('.system-chip') as HTMLElement;
    expect(role.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chip.tagName.toLowerCase()).toBe('span');
    expect(chip.getAttribute('tabindex')).toBeNull();
    expect(chip.getAttribute('role')).toBeNull();
    expect(chip.closest('button, a')).toBeNull();
  });

  it('badges : R1 (carte, dé) pour Ryuutama, L1 pour les deux ralliements', async () => {
    const { fixture } = await createFixture(new Map(), undefined, MIXED);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('app-system-badge')).toHaveLength(3);
    expect(tileOf(root, 'q').querySelector('app-system-badge rect.die')).not.toBeNull();
    expect(tileOf(root, 'iso').querySelector('app-system-badge rect.die')).toBeNull();
    expect(tileOf(root, 'iso').querySelector('app-system-badge svg')).not.toBeNull();
    expect(tileOf(root, 'grp').querySelector('app-system-badge svg')).not.toBeNull();
  });

  it('Draconis : pastille « Draconis », aucun badge', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [makeParty('d', 'mj')]);
    expect(textOf(fixture.nativeElement.querySelector('.system-chip'))).toBe('Draconis');
    expect(fixture.nativeElement.querySelector('app-system-badge')).toBeNull();
  });

  it('mode moyen : le badge n’est jamais dans app-party-banner, il est posé sur la vignette', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [makeQuete('q')]);
    const badge = fixture.nativeElement.querySelector('app-system-badge') as HTMLElement;
    expect(badge.closest('app-party-banner')).toBeNull();
    const wrapper = badge.parentElement as HTMLElement;
    expect(wrapper.classList.contains('tile__vignette')).toBe(true);
    expect(wrapper.querySelector('app-party-banner')).not.toBeNull();
    expect(badge.classList.contains('system-badge')).toBe(true);
    expect(badge.classList.contains('system-badge--inset')).toBe(false);
  });

  it('mode grand : le badge se pose DANS le coin de la bannière (écart unique au contrat), hors du composant bannière', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeRalliement('r')],
      new Map(),
      { partiesViewMode: 'large' },
    );
    const badge = fixture.nativeElement.querySelector('app-system-badge') as HTMLElement;
    expect(badge.closest('app-party-banner')).toBeNull();
    expect(badge.classList.contains('system-badge--inset')).toBe(true);
    expect((badge.parentElement as HTMLElement).classList.contains('tile__banner')).toBe(true);
  });

  it('mode liste : le badge est rattaché à la vignette de la ligne, et la pastille suit la sous-ligne', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeRalliement('r')],
      new Map(),
      { partiesViewMode: 'compact' },
    );
    const badge = fixture.nativeElement.querySelector('app-system-badge') as HTMLElement;
    expect(badge.closest('app-party-banner')).toBeNull();
    expect((badge.parentElement as HTMLElement).classList.contains('row__vignette')).toBe(true);
    const sub = fixture.nativeElement.querySelector('.row__subline') as HTMLElement;
    expect(textOf(sub.querySelector('.system-chip'))).toBe('Ralliement');
    // Le résumé de la ligne porte le mot de rôle du ralliement (Hôte), plus « Joueur »/« MJ ».
    expect(textOf(sub.querySelector('.row__sub'))).toContain('Hôte');
  });

  it('sous-titre : la seule nature — « Chronique » pour une quête, la nature du ralliement sinon, jamais le nom du système', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      { ...makeQuete('q'), kind: 'CAMPAGNE_EPISODIQUE' },
      makeRalliement('grp', 'admin', 'CAMPAGNE_EPISODIQUE'),
      makeRalliement('iso', 'admin', 'ONE_SHOT'),
    ]);
    const root = fixture.nativeElement as HTMLElement;
    const subtitleText = (id: string) => {
      const clone = tileOf(root, id)
        .querySelector('mat-card-subtitle')!
        .cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('.role-indicator, .status-indicator, .system-chip')
        .forEach((n) => n.remove());
      return textOf(clone);
    };
    expect(subtitleText('q')).toBe(GRIMOIRE_TONE['partie.kind_CAMPAGNE_EPISODIQUE']);
    expect(subtitleText('grp')).toBe(GRIMOIRE_TONE['partie.ralliement_kind_CAMPAGNE_EPISODIQUE']);
    expect(subtitleText('grp')).toBe('La convergence des Sortilèges');
    expect(subtitleText('iso')).toBe(GRIMOIRE_TONE['partie.ralliement_kind_ONE_SHOT']);
    for (const id of ['q', 'grp', 'iso']) {
      expect(subtitleText(id)).not.toContain('Ryuutama');
      expect(subtitleText(id)).not.toContain('Ralliement');
    }
  });

  it('libellés de rôle : ONE_SHOT Hôte / Invité, groupe Admin / Membre ; JDR inchangé (Maître / Héros)', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeRalliement('a', 'admin', 'ONE_SHOT'),
      makeRalliement('b', 'member', 'ONE_SHOT'),
      makeRalliement('c', 'admin', 'CAMPAGNE_EPISODIQUE'),
      makeRalliement('d', 'member', 'CAMPAGNE_EPISODIQUE'),
      makeQuete('e', 'mj'),
      makeQuete('f', 'player'),
    ]);
    const root = fixture.nativeElement as HTMLElement;
    const roleOf = (id: string) => {
      const indicator = tileOf(root, id).querySelector('.role-indicator') as HTMLElement;
      return {
        word: roleWord(indicator),
        icon: indicator.querySelector('app-icon')?.getAttribute('data-icon'),
        aria: indicator.getAttribute('aria-label'),
      };
    };
    expect(roleOf('a')).toMatchObject({ word: 'Hôte', icon: 'role-hote' });
    expect(roleOf('b')).toMatchObject({ word: 'Invité', icon: 'role-joueur' });
    expect(roleOf('c')).toMatchObject({ word: 'Admin', icon: 'role-admin' });
    expect(roleOf('d')).toMatchObject({ word: 'Membre', icon: 'role-joueur' });
    expect(roleOf('e')).toMatchObject({ word: 'Maître', icon: 'role-mj' });
    expect(roleOf('f')).toMatchObject({ word: 'Héros', icon: 'role-joueur' });
    expect(roleOf('a').aria).toBe(`${GRIMOIRE_TONE['dashboard.role_prefix']} Hôte`);
  });
});

describe('Dashboard — filtres Genre / Rang et regroupement par type (Story 38.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const MIXED = [
    makeQuete('q', 'mj'),
    makeQuete('p', 'player'),
    makeRalliement('iso', 'admin', 'ONE_SHOT'),
    makeRalliement('grp', 'member', 'CAMPAGNE_EPISODIQUE'),
  ];
  const names = (root: HTMLElement) =>
    (Array.from(root.querySelectorAll('.tile mat-card-title')) as HTMLElement[]).map((t) =>
      titleOf(t).replace('Party ', ''),
    );
  const selectLabelled = (root: HTMLElement, label: string) => {
    const selects = Array.from(
      root.querySelectorAll('app-list-control-bar select'),
    ) as HTMLSelectElement[];
    return selects.find((s) => s.closest('label')?.textContent?.includes(label))!;
  };

  it('Genre : le select propose Tous / Quêtes / Ralliements, et « Ralliements » ne garde que les ralliements', async () => {
    const { fixture } = await createFixture(new Map(), undefined, MIXED);
    const root = fixture.nativeElement as HTMLElement;
    const genre = selectLabelled(root, 'Genre');
    expect(Array.from(genre.options).map((o) => o.textContent?.trim())).toEqual([
      'Tous',
      'Quêtes',
      'Ralliements',
    ]);
    const comp = fixture.componentInstance as any;
    comp.genreFilter.set('ralliement');
    fixture.detectChanges();
    expect(names(root).sort()).toEqual(['grp', 'iso']);
    comp.genreFilter.set('quete');
    fixture.detectChanges();
    expect(names(root).sort()).toEqual(['p', 'q']);
  });

  it('Rang : Tous, Maître, Héros, Admin, Membre — « Membre » ne garde que les lignes member', async () => {
    const { fixture } = await createFixture(new Map(), undefined, MIXED);
    const root = fixture.nativeElement as HTMLElement;
    // Le libellé « Rang » se retrouve aussi dans « Ranger par » : on repère le select par ses valeurs.
    const rang = (
      Array.from(root.querySelectorAll('app-list-control-bar select')) as HTMLSelectElement[]
    ).find((s) => Array.from(s.options).some((o) => o.value === 'member'))!;
    expect(Array.from(rang.options).map((o) => o.value)).toEqual([
      'all',
      'mj',
      'player',
      'admin',
      'member',
    ]);
    expect(Array.from(rang.options).map((o) => o.textContent?.trim())).toEqual([
      GRIMOIRE_TONE['dashboard.filter_role_all'],
      'Maître',
      'Héros',
      'Admin',
      'Membre',
    ]);
    const comp = fixture.componentInstance as any;
    comp.roleFilter.set('member');
    fixture.detectChanges();
    expect(names(root)).toEqual(['grp']);
    comp.roleFilter.set('admin');
    fixture.detectChanges();
    expect(names(root)).toEqual(['iso']);
  });

  it('Genre et Rang comptent comme un écart au défaut ; le réglage par défaut les remet à Tous', async () => {
    const { fixture } = await createFixture(new Map(), undefined, MIXED);
    const comp = fixture.componentInstance as any;
    expect(comp.hasDeviatedFromDefault()).toBe(false);
    comp.genreFilter.set('ralliement');
    expect(comp.hasDeviatedFromDefault()).toBe(true);
    comp.onResetRequested();
    expect(comp.genreFilter()).toBe('all');
    comp.roleFilter.set('member');
    expect(comp.hasDeviatedFromDefault()).toBe(true);
    comp.onResetRequested();
    expect(comp.roleFilter()).toBe('all');
    expect(comp.hasDeviatedFromDefault()).toBe(false);
  });

  it('« Grouper par type » : décochée par défaut, jamais comptée comme un écart au défaut', async () => {
    const { fixture } = await createFixture(new Map(), undefined, MIXED);
    const comp = fixture.componentInstance as any;
    expect(comp.groupByType()).toBe(false);
    const boxes = Array.from(
      fixture.nativeElement.querySelectorAll('app-list-control-bar input[type="checkbox"]'),
    ) as HTMLInputElement[];
    const box = boxes.find((b) => b.closest('label')?.textContent?.includes('Grouper par type'))!;
    expect(box.checked).toBe(false);
    comp.groupByType.set(true);
    expect(comp.hasDeviatedFromDefault()).toBe(false);
  });

  it('regroupement actif : deux sections « Quêtes » puis « Ralliements », sans intertitres d’urgence', async () => {
    const { fixture } = await createFixture(new Map(), undefined, MIXED);
    (fixture.componentInstance as any).groupByType.set(true);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const headings = (Array.from(root.querySelectorAll('h2')) as HTMLElement[]).map(textOf);
    expect(headings).toEqual(['Quêtes', 'Ralliements']);
    const grids = Array.from(root.querySelectorAll('.grid')) as HTMLElement[];
    expect(grids).toHaveLength(2);
    expect(grids[0].querySelectorAll('.tile')).toHaveLength(2);
    expect(grids[1].querySelectorAll('.tile')).toHaveLength(2);
    expect(textOf(grids[0])).toContain('Party q');
    expect(textOf(grids[1])).toContain('Party iso');
    for (const key of [
      'dashboard.section_awaiting',
      'dashboard.section_ongoing',
      'dashboard.section_upcoming',
    ]) {
      expect(headings).not.toContain(GRIMOIRE_TONE[key]);
    }
  });

  it('regroupement actif : une section vide est omise', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeRalliement('iso'),
      makeRalliement('grp', 'member', 'CAMPAGNE_EPISODIQUE'),
    ]);
    (fixture.componentInstance as any).groupByType.set(true);
    fixture.detectChanges();
    const headings = (
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('h2')) as HTMLElement[]
    ).map(textOf);
    expect(headings).toEqual(['Ralliements']);
  });

  it('chaque section suit le tri choisi (par nom ici)', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [
        { ...makeQuete('z'), name: 'Zeta' },
        { ...makeQuete('a'), name: 'Alpha' },
        { ...makeRalliement('r2'), name: 'Gamma' },
        { ...makeRalliement('r1'), name: 'Beta' },
      ],
      new Map(),
      { partiesSort: 'nom' },
    );
    (fixture.componentInstance as any).groupByType.set(true);
    fixture.detectChanges();
    const grids = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.grid'),
    ) as HTMLElement[];
    const order = (grid: HTMLElement) =>
      (Array.from(grid.querySelectorAll('mat-card-title')) as HTMLElement[]).map(titleOf);
    expect(order(grids[0])).toEqual(['Alpha', 'Zeta']);
    expect(order(grids[1])).toEqual(['Beta', 'Gamma']);
  });

  it('décocher le regroupement rend la liste d’avant (intertitres d’urgence)', async () => {
    const { fixture } = await createFixture(new Map(), undefined, MIXED);
    const comp = fixture.componentInstance as any;
    comp.groupByType.set(true);
    fixture.detectChanges();
    comp.groupByType.set(false);
    fixture.detectChanges();
    const headings = (
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('h2')) as HTMLElement[]
    ).map(textOf);
    expect(headings).toContain(GRIMOIRE_TONE['dashboard.section_ongoing']);
    expect(headings).not.toContain('Quêtes');
  });

  it('le bouton de révélation des terminées respecte le filtre de genre', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeQuete('q', 'mj', 'TERMINEE'), makeRalliement('r')],
      new Map(),
      { hideFinishedParties: true },
    );
    const comp = fixture.componentInstance as any;
    expect(comp.hasHiddenFinished()).toBe(true);
    comp.genreFilter.set('ralliement');
    expect(comp.hasHiddenFinished()).toBe(false);
  });
});

describe('Dashboard — retirer de sa liste (Story 42.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const CONFIRM =
    'Retirer « Party p1 » de votre liste ? Elle disparaîtra définitivement pour vous seul ; les autres participants la conservent.';
  const buttons = (fixture: { nativeElement: HTMLElement }) =>
    Array.from(fixture.nativeElement.querySelectorAll('.hide-btn')) as HTMLButtonElement[];

  it('le bouton n’existe que sur une partie terminée ou annulée, avec un nom accessible', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'player', 'TERMINEE'),
      makeParty('p2', 'player', 'ANNULEE'),
      makeParty('p3', 'player', 'EN_COURS'),
      makeParty('p4', 'player', 'A_VENIR'),
    ]);

    const found = buttons(fixture);
    expect(found).toHaveLength(2);
    expect(found.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Retirer de ma liste : Party p1',
      'Retirer de ma liste : Party p2',
    ]);
  });

  it.each(['large', 'medium', 'compact'] as const)(
    'mode %s : le bouton est offert, le clic n’ouvre pas la partie',
    async (mode) => {
      const { fixture } = await createFixture(
        new Map(),
        undefined,
        [makeParty('p1', 'player', 'TERMINEE')],
        new Map(),
        { partiesViewMode: mode },
      );
      expect(buttons(fixture)).toHaveLength(1);
    },
  );

  it('confirmer : la phrase du contrat, le bouton « Retirer », puis le retrait et la relecture', async () => {
    const { fixture, myPartiesSvc, dialog } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'player', 'TERMINEE'),
    ]);
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    buttons(fixture)[0].click();
    await fixture.whenStable();

    const data = dialog.open.mock.calls[0][1].data;
    expect(data.message).toBe(CONFIRM);
    expect(data.confirmLabel).toBe('Retirer');
    expect(data.destructive).toBeUndefined();
    expect(myPartiesSvc.hide).toHaveBeenCalledWith('p1');
  });

  it('« Renoncer » : rien n’est envoyé', async () => {
    const { fixture, myPartiesSvc, dialog } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'player', 'ANNULEE'),
    ]);
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    buttons(fixture)[0].click();
    await fixture.whenStable();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(myPartiesSvc.hide).not.toHaveBeenCalled();
  });

  it('un refus du serveur laisse la tuile et le bouton en place', async () => {
    const { fixture, myPartiesSvc, dialog } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'player', 'TERMINEE'),
    ]);
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    myPartiesSvc.hide.mockRejectedValue(new Error('400'));

    buttons(fixture)[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.tile')).toHaveLength(1);
    expect(buttons(fixture)[0].disabled).toBe(false);
  });
});

describe('Dashboard — filtrer et masquer les annulées (Story 42.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const parties = () => [
    makeRalliement('r'),
    makeParty('c', 'player', 'ANNULEE'),
    makeParty('f', 'player', 'TERMINEE'),
    makeQuete('q', 'mj', 'EN_COURS'),
  ];
  it('le filtre « Phase » propose « Annulée » et ne montre alors que les annulées', async () => {
    const { fixture } = await createFixture(new Map(), undefined, parties());
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('select option[value="ANNULEE"]'),
    ) as HTMLOptionElement[];
    expect(options).toHaveLength(1);
    expect(options[0].textContent?.trim()).toBe(
      TONE_MAP['grimoire-emeraude']['dashboard.status_cancelled_badge'],
    );

    const comp = fixture.componentInstance as any;
    comp.statusFilter.set('ANNULEE');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.tile')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.tile--cancelled')).not.toBeNull();
  });

  it('la case de masquage cache aussi les annulées, et le bouton de révélation les rend', async () => {
    const { fixture } = await createFixture(new Map(), undefined, parties(), new Map(), {
      hideFinishedParties: true,
    });
    expect(fixture.nativeElement.querySelector('.tile--cancelled')).toBeNull();
    expect(fixture.nativeElement.querySelector('.tile--closed')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.tile')).toHaveLength(2);

    fixture.nativeElement.querySelector('.controls-bar__reveal').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tile--cancelled')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.tile')).toHaveLength(4);
  });

  it('seules des annulées sont masquées : le bouton de révélation existe quand même', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('c', 'player', 'ANNULEE'), makeParty('e', 'player', 'EN_COURS')],
      new Map(),
      { hideFinishedParties: true },
    );
    expect((fixture.componentInstance as any).hasHiddenFinished()).toBe(true);
    expect(fixture.nativeElement.querySelector('.controls-bar__reveal')).not.toBeNull();
  });

  it('sans la préférence, les annulées restent visibles', async () => {
    const { fixture } = await createFixture(new Map(), undefined, parties(), new Map(), {
      hideFinishedParties: false,
    });
    expect(fixture.nativeElement.querySelectorAll('.tile')).toHaveLength(4);
    expect(fixture.nativeElement.querySelector('.controls-bar__reveal')).toBeNull();
  });

  it('le filtre de genre s’applique aux annulées comme aux autres', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [{ ...makeRalliement('c'), status: 'ANNULEE' as const }, makeQuete('q', 'mj', 'EN_COURS')],
      new Map(),
      { hideFinishedParties: true },
    );
    const comp = fixture.componentInstance as any;
    // « c » est un ralliement annulé ; sous le genre « quête », rien n'est caché donc rien à révéler.
    comp.genreFilter.set('quete');
    expect(comp.hasHiddenFinished()).toBe(false);
  });

  it.each(['grimoire-emeraude', 'foret-ancienne', 'atelier-cuivre'] as const)(
    'thème %s : le libellé de la case et celui du bouton disent « annulé » (UX-DR14)',
    (theme) => {
      const tone = TONE_MAP[theme];
      expect(tone['dashboard.hide_finished_label']).toMatch(/annulé/);
      expect(tone['dashboard.show_finished_btn']).toMatch(/annulé/);
    },
  );
});

describe('Dashboard — favori d’un ralliement (Story 38.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('un admin de ralliement peut mettre en favori : même rechargement unique, aucune branche sur le rôle', async () => {
    const { fixture, accountSvc, myPartiesSvc } = await createFixture(new Map(), undefined, [
      makeRalliement('r', 'admin'),
    ]);
    (fixture.nativeElement.querySelector('.favorite-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    expect(accountSvc.addFavorite).toHaveBeenCalledWith('r');
    expect(myPartiesSvc.refreshAll).toHaveBeenCalledTimes(1);
  });
});

describe('Dashboard — signal « place réservée » d’un groupe (Story 40.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const reserved = (): Map<string, PartySignalsDto> =>
    new Map([
      ['grp', { role: 'player', status: 'EN_COURS', signals: ['RESERVATION_A_CONFIRMER'] }] as [
        string,
        PartySignalsDto,
      ],
    ]);
  const groupe = () => ({
    ...makeRalliement('grp', 'member', 'CAMPAGNE_EPISODIQUE'),
    status: 'EN_COURS' as const,
  });

  it('un groupe avec une place réservée porte le badge du thème, en tête de « ce qui t’attend »', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [groupe(), makeRalliement('calme', 'member', 'CAMPAGNE_EPISODIQUE')],
      reserved(),
    );
    const root = fixture.nativeElement as HTMLElement;
    const tile = tileOf(root, 'grp');
    expect(textOf(tile)).toContain(GRIMOIRE_TONE['partie.signal_reservation_a_confirmer']);
    // Un badge de signal écrit en toutes lettres (le libellé), teinte « à faire » comme le vote.
    const badge = tile.querySelector('.signal-badge');
    expect(textOf(badge)).toContain(GRIMOIRE_TONE['partie.signal_reservation_a_confirmer']);
    expect(badge?.classList).not.toContain('signal-badge--soon');
    expect(tileOf(root, 'calme').textContent).not.toContain(
      GRIMOIRE_TONE['partie.signal_reservation_a_confirmer'],
    );
  });

  it('mode liste : la sous-ligne porte rôle + libellé du signal (jamais la pastille seule)', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [groupe()], reserved(), {
      partiesViewMode: 'compact',
    });
    const sub = fixture.nativeElement.querySelector('.row__sub');
    expect(sub.textContent).toContain(GRIMOIRE_TONE['partie.signal_reservation_a_confirmer']);
  });
});

// ── Story 51.2 : icônes propres à chaque thème (tableau de bord) ─────────────────────────────────
describe('Dashboard — icônes du jeu de thème (Story 51.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const iconsOf = (root: ParentNode | null): (string | null)[] =>
    Array.from(root?.querySelectorAll('app-icon') ?? []).map((i) => i.getAttribute('data-icon'));

  /** Les tracés rendus d'une icône, pour constater qu'un même nom change de dessin selon le thème. */
  const drawingOf = (el: Element | null): string =>
    Array.from(el?.querySelectorAll('svg > *') ?? [])
      .map((n) => n.outerHTML)
      .join('');

  const pendingInvitation = () => {
    const invitationsSvc = makeInvitationsService();
    invitationsSvc.listReceived.mockResolvedValue([
      {
        id: 'inv',
        partie: { id: 'q1', name: 'La Quête', gameSystemId: 'ryuutama' },
        inviterPseudo: 'Léa',
        status: 'PENDING' as const,
        createdAt: '2026-10-11T00:00:00.000Z',
      },
    ]);
    return invitationsSvc;
  };

  it('favori : favori-pose si favorite, favori-vide sinon, nom du bouton inchangé', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeParty('on', 'player', 'EN_COURS', true),
      makeParty('off', 'player', 'EN_COURS', false),
    ]);
    const root = fixture.nativeElement as HTMLElement;
    const btn = (id: string) => tileOf(root, id).querySelector('.favorite-btn') as HTMLElement;
    expect(btn('on').querySelector('app-icon')?.getAttribute('data-icon')).toBe('favori-pose');
    expect(btn('off').querySelector('app-icon')?.getAttribute('data-icon')).toBe('favori-vide');
    expect(btn('on').getAttribute('aria-label')).toBeTruthy();
    expect(btn('on').getAttribute('aria-label')).not.toBe(btn('off').getAttribute('aria-label'));
    // L'icône reste décorative : le nom du bouton n'est jamais donné deux fois.
    expect(btn('on').querySelector('app-icon svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(btn('on').querySelector('[aria-label], [role="img"]')).toBeNull();
  });

  it('mode liste : favori et « retirer de ma liste » portent favori-* et masquer', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'TERMINEE', true)],
      new Map(),
      { partiesViewMode: 'compact' },
    );
    const row = fixture.nativeElement.querySelector('.row') as HTMLElement;
    expect(iconsOf(row.querySelector('.favorite-btn:not(.hide-btn)'))).toEqual(['favori-pose']);
    expect(iconsOf(row.querySelector('.hide-btn'))).toEqual(['masquer']);
  });

  it('carte : « retirer de ma liste » (terminée) porte masquer', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeParty('p1', 'player', 'TERMINEE'),
    ]);
    expect(iconsOf(fixture.nativeElement.querySelector('.hide-btn'))).toEqual(['masquer']);
  });

  it('rôle : MJ, admin de groupe, hôte de soirée isolée et joueur/membre ont chacun leur icône', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeQuete('mj', 'mj'),
      makeRalliement('adm', 'admin', 'CAMPAGNE_EPISODIQUE'),
      makeRalliement('hote', 'admin', 'ONE_SHOT'),
      makeQuete('joueur', 'player'),
      makeRalliement('membre', 'member', 'CAMPAGNE_EPISODIQUE'),
    ]);
    const root = fixture.nativeElement as HTMLElement;
    const roleIcon = (id: string) =>
      tileOf(root, id).querySelector('.role-indicator app-icon')?.getAttribute('data-icon');
    expect(roleIcon('mj')).toBe('role-mj');
    expect(roleIcon('adm')).toBe('role-admin');
    expect(roleIcon('hote')).toBe('role-hote');
    expect(roleIcon('joueur')).toBe('role-joueur');
    expect(roleIcon('membre')).toBe('role-joueur');
  });

  it('états écrits : terminée -> etat-terminee, annulée -> etat-annulee, à côté du mot', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [
      makeParty('fin', 'player', 'TERMINEE'),
      makeParty('ann', 'player', 'ANNULEE'),
    ]);
    const root = fixture.nativeElement as HTMLElement;
    const statusIcon = (id: string) =>
      tileOf(root, id).querySelector('.status-indicator app-icon')?.getAttribute('data-icon');
    expect(statusIcon('fin')).toBe('etat-terminee');
    expect(statusIcon('ann')).toBe('etat-annulee');
    expect(textOf(tileOf(root, 'fin').querySelector('.status-indicator'))).toContain(
      GRIMOIRE_TONE['dashboard.status_closed_badge'],
    );
    expect(textOf(tileOf(root, 'ann').querySelector('.status-indicator'))).toContain(
      GRIMOIRE_TONE['dashboard.status_cancelled_badge'],
    );
  });

  it('badge de signal : icône signal', async () => {
    const signals = new Map([
      [
        'p1',
        {
          partieId: 'p1',
          status: 'EN_COURS' as const,
          signals: ['AUCUN_MEMBRE_INVITE'] as const,
        },
      ],
    ]);
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'mj', 'EN_COURS')],
      signals as any,
    );
    expect(iconsOf(fixture.nativeElement.querySelector('.signal-badge'))).toEqual(['signal']);
  });

  it('tintIcon : un sens, une icône ; « todo » n’a aucune icône (jamais de repli)', async () => {
    const { fixture } = await createFixture(new Map(), undefined, []);
    const comp = fixture.componentInstance as unknown as { tintIcon(t: string): string | null };
    expect(comp.tintIcon('live')).toBe('etat-en-cours');
    expect(comp.tintIcon('soon')).toBe('etat-a-venir');
    expect(comp.tintIcon('done')).toBe('etat-terminee');
    expect(comp.tintIcon('cancelled')).toBe('etat-annulee');
    expect(comp.tintIcon('todo')).toBeNull();
  });

  it('partie en cours sans signal : le libellé de teinte est accompagné de etat-en-cours', async () => {
    const { fixture } = await createFixture(
      new Map(),
      undefined,
      [makeParty('p1', 'player', 'EN_COURS')],
      new Map(),
    );
    const indicator = fixture.nativeElement.querySelector('.tile .status-indicator');
    expect(iconsOf(indicator)).toEqual(['etat-en-cours']);
    expect(textOf(indicator)).toContain(GRIMOIRE_TONE['dashboard.section_ongoing']);
  });

  it('invitations : accepter -> valider, refuser -> fermer', async () => {
    const { fixture } = await createFixture(new Map(), pendingInvitation());
    const buttons = fixture.nativeElement.querySelectorAll('mat-card-actions button');
    expect(iconsOf(buttons[0])).toEqual(['valider']);
    expect(iconsOf(buttons[1])).toEqual(['fermer']);
  });

  it('barre des listes : filtres, rechercher et modes de vue portent leurs utilitaires', async () => {
    const { fixture } = await createFixture(new Map(), undefined, [makeParty('p1', 'player')]);
    const bar = fixture.nativeElement.querySelector('app-list-control-bar') as HTMLElement;
    expect(iconsOf(bar.querySelector('.list-control-bar__toggle'))).toEqual(['filtres']);
    expect(iconsOf(bar.querySelector('.list-control-bar__modes'))).toEqual([
      'vue-large',
      'vue-moyenne',
      'vue-compacte',
    ]);
  });

  it('changement de thème : les icônes de sens changent de dessin sur place, pas les utilitaires', async () => {
    const { fixture } = await createFixture(new Map(), pendingInvitation(), [
      makeParty('p1', 'player', 'TERMINEE', true),
    ]);
    const root = fixture.nativeElement as HTMLElement;
    const snapshot = () => ({
      role: drawingOf(root.querySelector('.role-indicator app-icon')),
      closed: drawingOf(root.querySelector('.status-indicator app-icon')),
      favorite: drawingOf(root.querySelector('.tile .favorite-btn app-icon')),
      valider: drawingOf(root.querySelector('mat-card-actions button app-icon')),
      filtres: drawingOf(root.querySelector('.list-control-bar__toggle app-icon')),
    });
    const before = snapshot();
    expect(before.role).not.toBe('');
    expect(before.valider).not.toBe('');

    const theme = TestBed.inject(ThemeToneService) as unknown as {
      activeTheme: ReturnType<typeof signal<Theme>>;
    };
    theme.activeTheme.set('foret-ancienne');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const after = snapshot();

    expect(after.role).not.toBe(before.role);
    expect(after.closed).not.toBe(before.closed);
    expect(after.favorite).not.toBe(before.favorite);
    expect(after.valider).toBe(before.valider);
    expect(after.filtres).toBe(before.filtres);
  });
});
