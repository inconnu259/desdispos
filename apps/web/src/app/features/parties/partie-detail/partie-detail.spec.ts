import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PartieDetail } from './partie-detail';
import { ActivatedRoute } from '@angular/router';
import { provideRouter, Router } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal, type WritableSignal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { vi } from 'vitest';
import type {
  AnnouncementDto,
  BoardGameDto,
  EventBoardGamesDto,
  CharacterDto,
  CharacterGroupRoleDto,
  EventCardDto,
  InviteLinkDto,
  PartieDto,
  PartieMemberDto,
  SessionPollDto,
} from '@master-jdr/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { CharacterService } from '../../../core/characters/character.service';
import { makeAnnouncementDto } from '../../../core/announcements/announcement-dto.fixture';
import { makeCharacterDto } from '../../../core/characters/character-dto.fixture';
import { PartiesService } from '../../../core/parties/parties.service';
import { MyPartiesService } from '../../../core/my-parties/my-parties.service';
import { AvailabilityService } from '../../../core/availability/availability.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
import { AnnouncementsService } from '../../../core/announcements/announcements.service';
import { UnseenAnnouncementsService } from '../../../core/announcements/unseen-announcements.service';
import { HommeDragonService } from '../../../core/homme-dragon/homme-dragon.service';
import { CharacterRolesService } from '../../../core/character-roles/character-roles.service';
import { BoardGamesService } from '../../../core/board-games/board-games.service';
import { MatDialog } from '@angular/material/dialog';
import { MatTabGroup } from '@angular/material/tabs';
import { TONE_MAP, THEMES, type Theme } from '../../../core/theme/tones';
import { NON_JDR_BANNED_WORDS } from '../../../core/theme/non-jdr-words.fixture';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { fillTone } from '../../../core/theme/tone-format';
import { EventsApiService } from '../../events/events-api.service';
import { ConjonctionDraftService } from '../../events/conjonction-draft.service';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

// Story 18.3 : PartieDetail injecte désormais RealtimeService (providedIn: 'root', non fourni par
// aucune des configurations TestBed de ce fichier — Angular l'auto-construit réellement partout).
// jsdom (^28.0.0) n'implémente pas EventSource (piège déjà documenté Story 18.2) — stub global
// plutôt qu'un mock RealtimeService par configuration : le comportement SSE réel n'est pas la
// préoccupation des tests existants de ce fichier, seul le describe dédié plus bas l'exerce.
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, (() => void)[]>();
  closed = false;
  constructor(
    public readonly url: string,
    public readonly init?: EventSourceInit,
  ) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: () => void): void {
    (this.listeners.get(type) ?? this.listeners.set(type, []).get(type)!).push(cb);
  }
  close(): void {
    this.closed = true;
  }
  emit(type: string): void {
    (this.listeners.get(type) ?? []).forEach((cb) => cb());
  }
}

let originalEventSource: unknown;
beforeEach(() => {
  originalEventSource = (globalThis as any).EventSource;
  FakeEventSource.instances = [];
  (globalThis as any).EventSource = FakeEventSource;
});
afterEach(() => {
  (globalThis as any).EventSource = originalEventSource;
});

/** Story 8.8 (revue de code) : `activePolls` est désormais chargé via `ScenariosService.listAll()`
 *  (plus `PollService.getCurrentPoll()`, un seul poll par Partie) — enveloppe chaque poll fourni
 *  dans un scénario/séance synthétique minimal pour alimenter le mock `listAll`. */
function wrapPollsAsScenarios(polls: SessionPollDto[]): any[] {
  return polls.map((poll, i) => ({
    id: `s-${poll.id}`,
    partieId: poll.partieId,
    title: `Scénario ${i + 1}`,
    description: null,
    status: 'COURANT',
    dureeHeures: null,
    dureeSeances: null,
    resumeFin: null,
    createdAt: '',
    closedAt: null,
    seances: [
      {
        id: `seance-${poll.id}`,
        scenarioId: `s-${poll.id}`,
        compteRendu: null,
        createdAt: '',
        poll,
      },
    ],
  }));
}

function makeScenariosService(polls: SessionPollDto[] = []) {
  return {
    listDrafts: vi.fn().mockResolvedValue([]),
    listAll: vi.fn().mockResolvedValue(wrapPollsAsScenarios(polls)),
    changed: signal(0),
    // Story 19.1 (Task 2) : RealtimeService injecte désormais aussi ScenariosService — nécessaire
    // pour que la connexion SSE réelle (stub EventSource global, cf. haut de fichier) ne lève pas.
    notifyRealtimeChanged: vi.fn(),
  };
}

/** jsdom n'implémente pas de vraie détection de largeur — desktop=true par défaut pour préserver
 *  le comportement historique des tests existants (onglet "Détails" actif par défaut) ; les tests
 *  ciblant spécifiquement le comportement mobile passent `desktop: false`. */
function makeBreakpointObserver(desktop: boolean) {
  return {
    observe: () => of({ matches: desktop, breakpoints: {} }),
    isMatched: () => desktop,
  };
}

const MJ_ID = 'mj-1';
const PLAYER_ID = 'player-1';

function makePartie(overrides: Partial<PartieDto> = {}): PartieDto {
  return {
    id: 'party-1',
    name: 'Test Party',
    kind: 'ONE_SHOT',
    gameSystemId: 'draconis',
    description: null,
    ownerId: MJ_ID,
    ownerPseudo: 'mj-pseudo',
    ownerDisplayName: 'MJ Nom',
    createdAt: new Date().toISOString(),
    nextSessionDate: null,
    nextSessionSlot: null,
    role: 'mj',
    status: 'EN_COURS',
    isFavorite: false,
    coverImageVersion: null,
    ...overrides,
  };
}

function makeToneService(theme: Theme = 'grimoire-emeraude') {
  // `activeTheme` : `<app-icon>` (icônes « de sens », story 51.3) lit le thème actif.
  return { tone: signal(TONE_MAP[theme]), activeTheme: signal<Theme>(theme) };
}

function makeAuthService(userId: string, displayName = 'Test') {
  return {
    currentUser: signal({
      id: userId,
      pseudo: 'Test',
      displayName,
      email: 'test@test.com',
      role: 'USER',
      createdAt: '',
    }),
  };
}

function makePartiesService(
  partie: PartieDto,
  members: PartieMemberDto[] = [],
  links: InviteLinkDto[] = [],
) {
  // Story 18.3 (AD-4) : contrat notifyChanged()/changed, consommé par l'effect() de PartieDetail.
  // notifyChanged() incrémente réellement le signal (comme l'implémentation réelle), pour que
  // l'effect() du composant sous test réagisse — pas un simple espion sans effet.
  const changed = signal(0);
  return {
    get: vi.fn().mockResolvedValue(partie),
    members: vi.fn().mockResolvedValue(members),
    inviteLinks: vi.fn().mockResolvedValue(links),
    searchUsers: vi.fn().mockResolvedValue([]),
    inviteUser: vi.fn(),
    inviteByEmail: vi.fn(),
    removeMember: vi.fn(),
    setMemberRole: vi.fn().mockResolvedValue({ ok: true, deleted: false }),
    leave: vi.fn().mockResolvedValue({ ok: true, deleted: false }),
    createInviteLink: vi.fn(),
    revokeInviteLink: vi.fn(),
    remove: vi.fn(),
    close: vi.fn().mockResolvedValue({ ...partie, status: 'TERMINEE' }),
    reopen: vi.fn().mockResolvedValue({ ...partie, status: 'EN_COURS' }),
    listXpDistributions: vi.fn().mockResolvedValue([]),
    createXpDistribution: vi.fn(),
    changed,
    notifyChanged: vi.fn(() => changed.update((v) => v + 1)),
  };
}

interface CreateFixtureOptions {
  members?: PartieMemberDto[];
  poll?: SessionPollDto | null;
  polls?: SessionPollDto[];
  characters?: CharacterDto[];
  /** Revue de code (Story 29.15) : permet de maintenir `listByPartie` en attente (non résolue) pour
   *  observer l'état du composant pendant le chargement — sinon `characters` prend la valeur de
   *  `characters ?? []` de façon synchrone-microtask comme tous les autres tests de ce fichier. */
  charactersPromise?: Promise<CharacterDto[]>;
  links?: InviteLinkDto[];
  announcements?: AnnouncementDto[];
  unseenAnnouncementIds?: string[];
  markAnnouncementRead?: ReturnType<typeof vi.fn>;
  characterRoles?: CharacterGroupRoleDto[];
  noopAnimations?: boolean;
  desktop?: boolean;
  displayName?: string;
  announcementIdQueryParam?: string;
  /** Story 38.4 : thème du registre de textes (Grimoire par défaut). */
  theme?: Theme;
  /** Story 40.1 : conjonctions servies par `GET /parties/:id/events/list` (vide par défaut). */
  events?: EventCardDto[];
  /** Story 49.1 : jeux sur place servis par `GET /events/:id/board-games` (aucun, 1 participant par défaut). */
  eventBoardGames?: EventBoardGamesDto;
}

async function createFixture(
  partie: PartieDto,
  currentUserId: string,
  options: CreateFixtureOptions = {},
): Promise<{ fixture: ComponentFixture<PartieDetail>; el: HTMLElement }> {
  await TestBed.configureTestingModule({
    imports: [PartieDetail],
    providers: [
      provideRouter([]),
      // MatTabGroup anime le changement d'onglet via le Web Animations API, non fiable en jsdom —
      // les tests qui doivent naviguer entre onglets utilisent le mode noop pour un rendu synchrone.
      options.noopAnimations ? provideNoopAnimations() : provideAnimationsAsync(),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: { get: () => partie.id },
            queryParamMap: { get: () => options.announcementIdQueryParam ?? null },
          },
        },
      },
      { provide: AuthService, useValue: makeAuthService(currentUserId, options.displayName) },
      {
        provide: PartiesService,
        useValue: makePartiesService(partie, options.members ?? [], options.links ?? []),
      },
      { provide: BreakpointObserver, useValue: makeBreakpointObserver(options.desktop ?? true) },
      {
        provide: MyPartiesService,
        useValue: {
          refreshAll: vi.fn(),
          playerParties: signal([]),
          allParties: signal([]),
          loaded: signal(true),
        },
      },
      { provide: AvailabilityService, useValue: { notifyChanged: vi.fn() } },
      {
        provide: CharacterService,
        useValue: {
          listByPartie: vi
            .fn()
            .mockImplementation(
              () => options.charactersPromise ?? Promise.resolve(options.characters ?? []),
            ),
          getGameSystemContent: vi.fn().mockResolvedValue({
            class: [{ key: 'menestrel', data: { label: 'Ménestrel' } }],
          }),
          getGameSystemAsset: vi
            .fn()
            .mockResolvedValue(new Blob(['%PDF-1.6'], { type: 'application/pdf' })),
          // Bug fix (temps réel) : PartieDetail réagit désormais à ce signal (roster).
          changed: signal(0),
        },
      },
      { provide: ThemeToneService, useValue: makeToneService(options.theme) },
      {
        provide: ScenariosService,
        useValue: makeScenariosService(options.polls ?? (options.poll ? [options.poll] : [])),
      },
      {
        provide: AnnouncementsService,
        useValue: {
          create: vi.fn(),
          listAll: vi.fn().mockResolvedValue(options.announcements ?? []),
          // Bug fix (temps réel) : PartieDetail réagit désormais à ce signal (annonces).
          changed: signal(0),
        },
      },
      {
        provide: UnseenAnnouncementsService,
        useValue: {
          unseenAnnouncements: signal(
            (options.announcements ?? []).filter((a) =>
              (options.unseenAnnouncementIds ?? []).includes(a.id),
            ),
          ),
          markRead: options.markAnnouncementRead ?? vi.fn().mockResolvedValue(undefined),
        },
      },
      {
        provide: HommeDragonService,
        useValue: {
          findOne: vi.fn().mockResolvedValue(null),
          // Story 33.8 : l'onglet est un panneau d'aventure (lien fiche / associer / dissocier).
          findForPartie: vi.fn().mockResolvedValue(null),
          listMine: vi.fn().mockResolvedValue([]),
          link: vi.fn(),
          unlink: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          // Story 20.2 (Task 3) : composants Homme Dragon (rendus transitivement) réagissent à ce signal.
          changed: signal(0),
        },
      },
      {
        provide: CharacterRolesService,
        useValue: {
          listForPartie: vi.fn().mockResolvedValue(options.characterRoles ?? []),
          // Story 27.3 : PartieDetail réagit désormais à ce signal (badges de rôle).
          changed: signal(0),
        },
      },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      // Story 48.3 : la feuille d'une Ludothèque (ouverte par le nom d'un membre) lit celle de la personne.
      {
        provide: BoardGamesService,
        useValue: {
          // Story 49.2 : ma Ludothèque, lue par l'onglet des jeux sur place d'un participant autre que l'hôte.
          list: vi.fn().mockResolvedValue([]),
          listOf: vi.fn().mockResolvedValue({
            owner: { userId: 'member-2', pseudo: 'membre', displayName: 'Membre Deux' },
            games: [],
          }),
          // Story 50.1 : les jeux du groupe, lus à l'ouverture de leur onglet.
          listOfGroup: vi.fn().mockResolvedValue({ games: [] }),
          changed: signal(0),
        },
      },
      // Story 40.1 : l'onglet des conjonctions d'un groupe lit sa liste (aucun HttpClient en test).
      {
        provide: EventsApiService,
        useValue: {
          list: vi.fn().mockResolvedValue(options.events ?? []),
          // Story 50.2 : le Compteur d'hôte, lu par la section « Qui reçoit » de « Détails » d'un groupe.
          hostCounts: vi.fn().mockResolvedValue({ members: [] }),
          create: vi.fn(),
          update: vi.fn(),
          // Story 40.3 : s'inscrire à une conjonction et s'en désinscrire.
          inscrire: vi.fn(),
          desinscrire: vi.fn(),
          // Story 40.4 : accepter / réserver / retirer une place réservée.
          accepter: vi.fn(),
          reserver: vi.fn(),
          retirerReservation: vi.fn(),
          // Story 42.1 : annuler une conjonction.
          cancel: vi.fn(),
          // Story 49.1 : les jeux sur place d'une soirée (onglet posé après « Conjonction · Invités »).
          boardGames: vi
            .fn()
            .mockResolvedValue(options.eventBoardGames ?? { games: [], brings: [], participantsCount: 1, envies: [] }),
        },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(PartieDetail);
  fixture.detectChanges();
  // ngOnInit enchaîne plusieurs await (partie, membres, poll actif, characterRoles depuis la Story
  // 27.3...) — whenStable() ne garantit pas toujours le drainage complet de chaînes de promesses
  // simples (mocks) en environnement zoneless. On vide explicitement la file de microtasks à
  // plusieurs reprises pour laisser chaque await se résoudre.
  for (let i = 0; i < 15; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement };
}

describe('PartieDetail — widget de planification', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("affiche l'état vide quand nextSessionDate est null", async () => {
    const { el } = await createFixture(
      makePartie({ nextSessionDate: null, nextSessionSlot: null }),
      MJ_ID,
    );

    const section = el.querySelector('.scheduling-widget');
    expect(section).toBeTruthy();
    expect(section!.querySelector('.next-session-date')).toBeFalsy();
    const muted = section!.querySelector('.muted');
    expect(muted).toBeTruthy();
    expect(muted!.textContent).toContain('oracle');
  });

  it('affiche la date + slot formatés quand nextSessionDate est renseigné', async () => {
    const { el } = await createFixture(
      makePartie({ nextSessionDate: '2026-08-15T00:00:00.000Z', nextSessionSlot: 'EVENING' }),
      MJ_ID,
    );

    const section = el.querySelector('.scheduling-widget');
    expect(section).toBeTruthy();
    const dateEl = section!.querySelector('.next-session-date');
    expect(dateEl).toBeTruthy();
    const text = dateEl!.textContent ?? '';
    expect(text).toContain('août');
    expect(text).toContain('Soir');
    expect(text).toContain('15');
  });

  it('affiche le bouton cta.find_date pour le MJ mais pas pour un joueur', async () => {
    const partie = makePartie({ ownerId: MJ_ID });

    // MJ voit le bouton
    const { el: elMj } = await createFixture(partie, MJ_ID);
    const sectionMj = elMj.querySelector('.scheduling-widget');
    expect(sectionMj!.querySelector('a[mat-flat-button]')).toBeTruthy();
    TestBed.resetTestingModule();

    // Joueur ne voit pas le bouton
    const { el: elPlayer } = await createFixture(partie, PLAYER_ID);
    const sectionPlayer = elPlayer.querySelector('.scheduling-widget');
    expect(sectionPlayer!.querySelector('a[mat-flat-button]')).toBeFalsy();
  });

  // ─── Story 32.3 — le widget porte désormais un badge d'état ──────────────
  //
  // ⚠️ Le badge RÉSUME, il ne remplace rien : la ligne de date et la ligne de statut du vote
  // restent exactement là où la story 32.2 les avait posées (vérifié explicitement ci-dessous).
  function isoInDays(days: number): string {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString();
  }

  function widgetBadge(el: HTMLElement): string {
    return (el.querySelector('.scheduling-widget .status-badge')?.textContent ?? '').trim();
  }

  it('aucune séance à venir → badge « À planifier », sans effacer l’état vide existant', async () => {
    const { el } = await createFixture(
      makePartie({ nextSessionDate: null, nextSessionSlot: null }),
      MJ_ID,
    );
    expect(widgetBadge(el)).toBe('À planifier');
    expect(el.querySelector('.scheduling-widget .muted')).toBeTruthy();
  });

  it('séance à venir (> 7 j) → badge « Programmée », la ligne de date reste affichée', async () => {
    const { el } = await createFixture(
      makePartie({ nextSessionDate: isoInDays(10), nextSessionSlot: 'EVENING' }),
      MJ_ID,
    );
    expect(widgetBadge(el)).toBe('Programmée');
    expect(el.querySelector('.scheduling-widget .next-session-date')).toBeTruthy();
  });

  it('Story 47.2 : une plage commencée hier et finissant demain reste la prochaine séance, écrite « début → fin »', async () => {
    const { el } = await createFixture(
      makePartie({
        nextSessionDate: isoInDays(-1),
        nextSessionSlot: 'EVENING',
        nextSessionEndDate: isoInDays(1),
        nextSessionEndSlot: 'AFTERNOON',
      }),
      MJ_ID,
    );
    expect(widgetBadge(el)).not.toBe('À planifier');
    expect(widgetBadge(el)).not.toBe('À débriefer');
    const text = el.querySelector('.scheduling-widget .next-session-date')?.textContent ?? '';
    expect(text).toContain('→');
    expect(text).toContain('Après-midi');
  });

  it('Story 47.2 : une plage finie hier est passée comme une date passée', async () => {
    const { el } = await createFixture(
      makePartie({
        nextSessionDate: isoInDays(-3),
        nextSessionSlot: 'EVENING',
        nextSessionEndDate: isoInDays(-1),
        nextSessionEndSlot: 'AFTERNOON',
      }),
      MJ_ID,
    );
    expect(widgetBadge(el)).toBe('À planifier');
  });

  it('🚨 une date déjà passée ne fait jamais apparaître « À débriefer » ici (widget « Prochaine séance »)', async () => {
    const { el } = await createFixture(
      makePartie({ nextSessionDate: isoInDays(-10), nextSessionSlot: 'EVENING' }),
      MJ_ID,
    );
    expect(widgetBadge(el)).toBe('À planifier');
  });
});

// ─── Statut du vote (Story 3.5) ───────────────────────────────────────────

describe('PartieDetail — statut du vote', () => {
  afterEach(() => TestBed.resetTestingModule());

  const members: PartieMemberDto[] = [
    {
      role: 'MEMBER',
      userId: 'u1',
      pseudo: 'Alice',
      displayName: 'Alice au pays',
      email: 'alice@test.com',
      joinedAt: '',
    },
    {
      role: 'MEMBER',
      userId: 'u2',
      pseudo: 'Bob',
      displayName: 'Bobby',
      email: 'bob@test.com',
      joinedAt: '',
    },
  ];

  function makePoll(votesOnOpt: string[]): SessionPollDto {
    return {
      id: 'poll1',
      partieId: 'party-1',
      status: 'OPEN',
      scenarioRef: null,
      expiresAt: null,
      chosenDate: null,
      chosenSlot: null,
      // Story 36.6 — effectif de la troupe (MJ + membres).
      membersCount: 4,
      durationSlots: 1,
      options: [
        {
          id: 'opt1',
          date: '2026-08-01T00:00:00.000Z',
          slot: 'MORNING',
          votes: votesOnOpt.map((userId) => ({
            userId,
            pseudo: userId,
            displayName: userId,
            answer: 'YES' as const,
          })),
        },
      ],
    };
  }

  it('affiche la ligne de statut X/Y quand un poll OPEN existe — Y = poll.membersCount (MJ compris, deferred-work 2026-08-24)', async () => {
    const { el } = await createFixture(makePartie(), MJ_ID, { members, poll: makePoll(['u1']) });
    const line = el.querySelector('.poll-status-line');
    expect(line).toBeTruthy();
    // `members` ne porte que 2 entrées (le MJ n'a jamais de ligne Membership), mais
    // `makePoll().membersCount` vaut 4 (MJ compris, valeur serveur) — le Y affiché suit
    // membersCount, pas members().length, sous peine de reproduire le bug à deux dénominateurs
    // que la 36.6 a déjà corrigé côté calendrier (panneau `poll-status`).
    expect(line!.textContent).toContain('1/4');
  });

  it("n'affiche pas la ligne de statut si aucun poll OPEN n'existe", async () => {
    const { el } = await createFixture(makePartie(), MJ_ID, { members, poll: null });
    expect(el.querySelector('.poll-status-line')).toBeFalsy();
  });

  it('le lien joueur utilise poll.vote_pending quand un poll est actif', async () => {
    const partie = makePartie({ ownerId: MJ_ID });
    const { el } = await createFixture(partie, PLAYER_ID, { members, poll: makePoll(['u1']) });
    const link = el.querySelector('.scheduling-widget a[mat-stroked-button]');
    expect(link).toBeTruthy();
    expect(link!.textContent).toContain('Vote de date en cours');
  });

  it('44.7 : le lien joueur arrive en Destinée sur le vote s’il est seul, ouvre la liste s’il y en a plusieurs', async () => {
    const one = await createFixture(makePartie({ ownerId: MJ_ID }), PLAYER_ID, {
      members,
      poll: makePoll(['u1']),
    });
    const href = (el: HTMLElement) =>
      el.querySelector('.scheduling-widget a[mat-stroked-button]')!.getAttribute('href');
    expect(href(one.el)).toBe(`/parties/party-1/guild-calendar?poll=${makePoll(['u1']).id}`);
    TestBed.resetTestingModule();

    const poll1 = { ...makePoll(['u1']), id: 'poll1', partieId: 'party-1' };
    const poll2 = { ...makePoll([]), id: 'poll2', partieId: 'party-1' };
    const many = await createFixture(makePartie({ ownerId: MJ_ID }), PLAYER_ID, {
      members,
      polls: [poll1, poll2],
    });
    expect(href(many.el)).toBe('/parties/party-1/guild-calendar?pollList=');
    TestBed.resetTestingModule();

    const none = await createFixture(makePartie({ ownerId: MJ_ID }), PLAYER_ID, {
      members,
      poll: null,
    });
    expect(href(none.el)).toBe('/parties/party-1/guild-calendar');
  });

  it('plusieurs votes OPEN en parallèle → message agrégé "N votes de date en cours" (Story 8.8, revue de code)', async () => {
    const poll1 = { ...makePoll(['u1']), id: 'poll1', partieId: 'party-1' };
    const poll2 = { ...makePoll([]), id: 'poll2', partieId: 'party-1' };
    const { el } = await createFixture(makePartie(), MJ_ID, { members, polls: [poll1, poll2] });

    const line = el.querySelector('.poll-status-line');
    expect(line).toBeTruthy();
    expect(line!.textContent).toContain('2 votes de date en cours');
  });

  // ─── Story 32.3 — le badge du widget suit le vote, et suit le LECTEUR ────
  function widgetBadge(el: HTMLElement): string {
    return (el.querySelector('.scheduling-widget .status-badge')?.textContent ?? '').trim();
  }

  it('vote ouvert auquel je n’ai pas répondu → « Réponds au vote »', async () => {
    // `makePoll([])` : personne n'a voté, donc le lecteur non plus.
    const { el } = await createFixture(makePartie(), 'u1', { members, poll: makePoll([]) });
    expect(widgetBadge(el)).toBe('Réponds au vote');
  });

  it('vote ouvert auquel j’ai répondu → « Vote en cours », libellé distinct du précédent', async () => {
    const { el } = await createFixture(makePartie(), 'u1', { members, poll: makePoll(['u1']) });
    expect(widgetBadge(el)).toBe('Vote en cours');
  });

  it('🚨 plusieurs votes : c’est celui qui attend MA réponse qui gagne le badge', async () => {
    // `poll1` est déjà répondu, `poll2` ne l'est pas : prendre le premier venu masquerait
    // l'appel à l'action — exactement ce que la story cherche à rendre visible.
    const poll1 = { ...makePoll(['u1']), id: 'poll1', partieId: 'party-1' };
    const poll2 = { ...makePoll([]), id: 'poll2', partieId: 'party-1' };
    const { el } = await createFixture(makePartie(), 'u1', { members, polls: [poll1, poll2] });
    expect(widgetBadge(el)).toBe('Réponds au vote');
  });

  it('🚨 date confirmée → « Programmée », même si un vote ouvert court sur une AUTRE séance', async () => {
    // `activePolls()` est scopé à la PARTIE : sans cette garde, le widget annoncerait
    // « Réponds au vote » juste au-dessus de la date confirmée d'une tout autre séance.
    const future = new Date();
    future.setUTCHours(0, 0, 0, 0);
    future.setUTCDate(future.getUTCDate() + 10);
    const { el } = await createFixture(
      makePartie({ nextSessionDate: future.toISOString(), nextSessionSlot: 'EVENING' }),
      'u1',
      { members, poll: makePoll([]) },
    );
    expect(widgetBadge(el)).toBe('Programmée');
  });
});

// ─── Chargement des personnages (Story 4.2, consommé par le roster + l'onglet "Ma fiche" depuis 6.1) ───

describe('PartieDetail — chargement des personnages', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('charge les personnages de la partie via CharacterService.listByPartie', async () => {
    const { fixture } = await createFixture(makePartie(), MJ_ID, { characters: [] });

    const characterSvc = TestBed.inject(CharacterService) as unknown as {
      listByPartie: ReturnType<typeof vi.fn>;
    };
    expect(characterSvc.listByPartie).toHaveBeenCalledWith('party-1');
    expect(
      (fixture.componentInstance as unknown as { characters: () => unknown[] }).characters(),
    ).toEqual([]);
  });

  it('expose les personnages chargés sur le signal characters()', async () => {
    const character: CharacterDto = makeCharacterDto({
      userId: PLAYER_ID,
      partieId: 'party-1',
    });
    const { fixture } = await createFixture(makePartie(), MJ_ID, { characters: [character] });

    expect(
      (fixture.componentInstance as unknown as { characters: () => unknown[] }).characters(),
    ).toEqual([character]);
  });

  it("un personnage créé par un AUTRE joueur n'empêche pas l'utilisateur courant de créer le sien", async () => {
    const otherPlayerCharacter: CharacterDto = makeCharacterDto({
      userId: 'some-other-player',
      partieId: 'party-1',
      ownerPseudo: 'bob',
    });
    const { fixture } = await createFixture(makePartie(), PLAYER_ID, {
      characters: [otherPlayerCharacter],
    });

    // Le joueur courant (PLAYER_ID) n'a pas de personnage à lui, même si un autre joueur a déjà
    // créé le sien sur cette partie — myCharacters() doit rester vide pour PLAYER_ID.
    const comp = fixture.componentInstance as unknown as { myCharacters: () => unknown[] };
    expect(comp.myCharacters()).toEqual([]);
  });

  it('classLabel() résout le label de classe depuis le contenu chargé (pas la clé brute)', async () => {
    const character: CharacterDto = makeCharacterDto({
      userId: PLAYER_ID,
      partieId: 'party-1',
      sheetData: { classId: 'menestrel', narrative: { name: 'Fenn' } },
    });
    const { fixture } = await createFixture(makePartie(), MJ_ID, { characters: [character] });

    const comp = fixture.componentInstance as unknown as {
      classLabel: (c: CharacterDto) => string;
    };
    expect(comp.classLabel(character)).toBe('Ménestrel');
  });

  it('openCharacterSheet() navigue vers /parties/:id/characters/:characterId', async () => {
    const { fixture } = await createFixture(makePartie(), MJ_ID, { characters: [] });

    const router = TestBed.inject((await import('@angular/router')).Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    const comp = fixture.componentInstance as unknown as {
      openCharacterSheet: (partieId: string, characterId: string) => void;
    };
    comp.openCharacterSheet('party-1', 'c1');

    expect(navigateSpy).toHaveBeenCalledWith(['/parties', 'party-1', 'characters', 'c1']);
  });
});

// ─── Onglet « Fiches » générique : tous les personnages, le sien en tête (spec
//     fiches-personnages-partie-et-retour) ──────────────────────────────────

describe('PartieDetail — onglet « Fiches » générique (spec fiches-personnages-partie-et-retour)', () => {
  afterEach(() => TestBed.resetTestingModule());

  /** Sélectionne l'onglet « Fiches » (rendu en index 1 pour tout joueur non-MJ) — même patron que
   *  les tests d'atterrissage ci-dessus (Story 29.15). */
  function clickFichesTab(el: HTMLElement, fixture: ComponentFixture<PartieDetail>): void {
    const tab = Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).find(
      (t) => t.textContent?.trim() === GRIMOIRE_TONE['character.party_sheets_tab_label'],
    );
    tab?.click();
    fixture.detectChanges();
  }

  /** `.character-summary-card__name` porte aussi le badge de niveau imbriqué — on le retire avant
   *  de lire le texte pour ne pas dépendre du whitespace exact entre les deux noeuds. */
  function cardName(nameEl: Element): string {
    const clone = nameEl.cloneNode(true) as HTMLElement;
    clone.querySelector('.character-summary-card__level')?.remove();
    return clone.textContent?.trim() ?? '';
  }

  it('le libellé de l’onglet est désormais « Fiches » (plus « Ma fiche »)', async () => {
    const { el } = await createFixture(makePartie({ gameSystemId: 'ryuutama' }), PLAYER_ID, {
      desktop: true,
      noopAnimations: true,
    });

    const tabLabels = Array.from(el.querySelectorAll('div[role="tab"]')).map((t) =>
      t.textContent?.trim(),
    );
    expect(tabLabels).toContain(GRIMOIRE_TONE['character.party_sheets_tab_label']);
    expect(tabLabels).not.toContain('Ma fiche');
  });

  it('liste tous les personnages de la partie, le sien en tête, avec le niveau visible sur chacun (AC1)', async () => {
    const mine = makeCharacterDto({
      id: 'mine',
      userId: PLAYER_ID,
      partieId: 'party-1',
      level: 3,
      sheetData: { narrative: { name: 'Fenn' } },
    });
    const other1 = makeCharacterDto({
      id: 'other1',
      userId: 'other-1',
      partieId: 'party-1',
      level: 2,
      sheetData: { narrative: { name: 'Bram' } },
    });
    const other2 = makeCharacterDto({
      id: 'other2',
      userId: 'other-2',
      partieId: 'party-1',
      level: 5,
      sheetData: { narrative: { name: 'Iris' } },
    });

    // Ordre de chargement volontairement différent de l'ordre attendu à l'écran : la partition
    // « soi d'abord » doit reposer sur charactersSelfFirst(), pas sur l'ordre de characters().
    const { fixture, el } = await createFixture(
      makePartie({ gameSystemId: 'ryuutama' }),
      PLAYER_ID,
      { desktop: true, noopAnimations: true, characters: [other1, mine, other2] },
    );

    clickFichesTab(el, fixture);
    await fixture.whenStable();
    fixture.detectChanges();

    const names = Array.from(
      el.querySelectorAll(
        '.party-sheets-tab app-character-summary-card .character-summary-card__name',
      ),
    ).map(cardName);
    expect(names).toEqual(['Fenn', 'Bram', 'Iris']);

    const levels = Array.from(
      el.querySelectorAll(
        '.party-sheets-tab app-character-summary-card .character-summary-card__level',
      ),
    ).map((n) => n.textContent?.trim());
    expect(levels).toEqual(['Niv. 3', 'Niv. 2', 'Niv. 5']);
  });

  it('joueur sans personnage personnel, d’autres joueurs en ont → message + CTA de création ET la liste des autres personnages en dessous (I/O Matrix, cas 2)', async () => {
    const other1 = makeCharacterDto({
      id: 'other1',
      userId: 'other-1',
      partieId: 'party-1',
      level: 1,
      sheetData: { narrative: { name: 'Bram' } },
    });
    const other2 = makeCharacterDto({
      id: 'other2',
      userId: 'other-2',
      partieId: 'party-1',
      level: 4,
      sheetData: { narrative: { name: 'Iris' } },
    });
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', status: 'EN_COURS' });

    const { fixture, el } = await createFixture(partie, PLAYER_ID, {
      desktop: true,
      noopAnimations: true,
      characters: [other1, other2],
    });

    // Atterrissage automatique sur « Fiches » (canCreateCharacter() = true, Story 29.15) — pas de
    // clic explicite nécessaire, mais on le fait quand même pour ne pas dépendre de ce détail.
    clickFichesTab(el, fixture);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.party-sheets-tab .muted')?.textContent?.trim()).toBeTruthy();
    expect(el.querySelector('.party-sheets-tab a[mat-flat-button]')).toBeTruthy();

    const names = Array.from(
      el.querySelectorAll(
        '.party-sheets-tab app-character-summary-card .character-summary-card__name',
      ),
    ).map(cardName);
    expect(names).toEqual(['Bram', 'Iris']);
  });

  it('joueur sans personnage personnel, personne d’autre n’en a → message + CTA seulement, aucune carte (I/O Matrix, cas 3)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', status: 'EN_COURS' });

    const { fixture, el } = await createFixture(partie, PLAYER_ID, {
      desktop: true,
      noopAnimations: true,
      characters: [],
    });

    clickFichesTab(el, fixture);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.party-sheets-tab .muted')?.textContent?.trim()).toBeTruthy();
    expect(el.querySelector('.party-sheets-tab app-character-summary-card')).toBeNull();
  });

  it('passe [showOwnerInfo]="true" à app-character-summary-card sur cette liste — exception délibérée et scopée à cet onglet « Fiches » (retour utilisateur : le nom du joueur propriétaire clarifie la liste quand plusieurs compagnons sont affichés) ; la règle générale « jamais pour un joueur » de showOwnerInfo reste inchangée ailleurs (roster, MyCharacters…)', async () => {
    const mine = makeCharacterDto({
      id: 'mine',
      userId: PLAYER_ID,
      partieId: 'party-1',
      sheetData: { narrative: { name: 'Fenn' } },
    });
    const { fixture, el } = await createFixture(
      makePartie({ gameSystemId: 'ryuutama' }),
      PLAYER_ID,
      { desktop: true, noopAnimations: true, characters: [mine] },
    );

    clickFichesTab(el, fixture);
    await fixture.whenStable();
    fixture.detectChanges();

    const card = fixture.debugElement.query(By.css('.party-sheets-tab app-character-summary-card'))
      ?.componentInstance as { showOwnerInfo: () => boolean } | undefined;
    expect(card?.showOwnerInfo()).toBe(true);
  });
});

// ─── Nouvelle disposition de la page Partie (Story 6.1) ───────────────────

describe('PartieDetail — roster (Story 6.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const members: PartieMemberDto[] = [
    {
      role: 'MEMBER',
      userId: MJ_ID,
      pseudo: 'Sylas',
      displayName: 'Sylas',
      email: 'sylas@test.com',
      joinedAt: '',
    },
    {
      role: 'MEMBER',
      userId: PLAYER_ID,
      pseudo: 'Alice',
      displayName: 'Alice au pays',
      email: 'alice@test.com',
      joinedAt: '',
    },
  ];

  it('desktop → affiche app-roster-rail, pas app-roster-strip', async () => {
    const { el } = await createFixture(makePartie(), MJ_ID, { members, desktop: true });
    expect(el.querySelector('app-roster-rail')).not.toBeNull();
    expect(el.querySelector('app-roster-strip')).toBeNull();
  });

  it('mobile + MJ → affiche app-roster-strip, pas app-roster-rail', async () => {
    const { el } = await createFixture(makePartie(), MJ_ID, { members, desktop: false });
    expect(el.querySelector('app-roster-strip')).not.toBeNull();
    expect(el.querySelector('app-roster-rail')).toBeNull();
  });

  it('mobile + joueur (non-MJ) → affiche aussi app-roster-strip, pas app-roster-rail (Story 31.5 : roster mobile ouvert à tout membre)', async () => {
    const { el } = await createFixture(makePartie(), PLAYER_ID, { members, desktop: false });
    expect(el.querySelector('app-roster-strip')).not.toBeNull();
    expect(el.querySelector('app-roster-rail')).toBeNull();
  });

  it('mobile + joueur (non-MJ) → le slot "+ Inviter" du roster-strip est désactivé (hasFreeSlot=false, réservé au MJ)', async () => {
    const { fixture } = await createFixture(makePartie(), PLAYER_ID, { members, desktop: false });

    const rosterStrip = fixture.debugElement.query(By.css('app-roster-strip'))
      ?.componentInstance as { hasFreeSlot: () => boolean } | undefined;

    expect(rosterStrip?.hasFreeSlot()).toBe(false);
  });

  it("mobile + joueur sans personnage sur un système avec module → l'onglet Ma fiche est sélectionné par défaut (Story 29.15)", async () => {
    const { el } = await createFixture(makePartie({ gameSystemId: 'ryuutama' }), PLAYER_ID, {
      members,
      desktop: false,
      noopAnimations: true,
    });
    expect(el.querySelector('app-roster-rail')).toBeNull();

    const activeTab = el.querySelector('div[role="tab"][aria-selected="true"]');
    expect(activeTab?.textContent?.trim()).toBe(GRIMOIRE_TONE['character.party_sheets_tab_label']);
  });

  it('desktop + joueur → l\'onglet "Ma fiche" est désormais rendu aussi sur desktop (Story 29.15, unification desktop/mobile)', async () => {
    const { el } = await createFixture(makePartie(), PLAYER_ID, { members, desktop: true });
    const tabLabels = Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).map((t) =>
      t.textContent?.trim(),
    );
    expect(tabLabels).toContain(GRIMOIRE_TONE['character.party_sheets_tab_label']);
  });

  it('desktop + joueur sans personnage, système sans module → clic sur sa propre ligne du roster ne navigue plus (Story 29.15, revue de code : slot gardé par canCreateCharacter(), plus de cul-de-sac)', async () => {
    const partie = makePartie({ gameSystemId: 'draconis' });
    const { el } = await createFixture(partie, PLAYER_ID, { members, desktop: true });
    const router = TestBed.inject((await import('@angular/router')).Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    // Le slot reste visible (initiale/avatar + aria-label roster.create_slot_label) — seule la
    // navigation est gardée.
    const ownItem: HTMLElement = el.querySelector(`[data-user-id="${PLAYER_ID}"]`)!;
    expect(ownItem).not.toBeNull();
    ownItem.click();

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('desktop + joueur sans personnage, système avec module, partie non clôturée → clic sur sa propre ligne du roster navigue vers la création de personnage (canCreateCharacter() vrai)', async () => {
    const partie = makePartie({ gameSystemId: 'ryuutama' });
    const { el } = await createFixture(partie, PLAYER_ID, { members, desktop: true });
    const router = TestBed.inject((await import('@angular/router')).Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    const ownItem: HTMLElement = el.querySelector(`[data-user-id="${PLAYER_ID}"]`)!;
    ownItem.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/parties', 'party-1', 'characters', 'new'], {
      queryParams: { gameSystemId: 'ryuutama' },
    });
  });

  it('joueur ayant déjà un personnage sur cette partie → pas de flicker vers « Ma fiche » pendant le chargement de characters() (Story 29.15, revue de code : charactersLoaded)', async () => {
    let resolveCharacters!: (chars: CharacterDto[]) => void;
    const charactersPromise = new Promise<CharacterDto[]>((resolve) => {
      resolveCharacters = resolve;
    });
    const partie = makePartie({ gameSystemId: 'ryuutama' });
    const existingCharacter = makeCharacterDto({
      id: 'char-1',
      userId: PLAYER_ID,
      partieId: partie.id,
    });

    const { fixture, el } = await createFixture(partie, PLAYER_ID, {
      members,
      desktop: true,
      noopAnimations: true,
      charactersPromise,
    });

    // Pendant le chargement (characters() encore [], charactersLoaded() encore false) : ne doit
    // jamais atterrir sur « Ma fiche » ni afficher le CTA de création — c'est précisément le
    // flicker corrigé.
    let activeTab = el.querySelector('div[role="tab"][aria-selected="true"]');
    expect(activeTab?.textContent?.trim()).toBe('Détails');
    expect(el.querySelector('a[href*="characters/new"]')).toBeNull();

    resolveCharacters([existingCharacter]);
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Une fois characters() chargé et révélant le personnage existant : reste sur « Détails »,
    // aucune bascule n'a jamais eu lieu (stabilité).
    activeTab = el.querySelector('div[role="tab"][aria-selected="true"]');
    expect(activeTab?.textContent?.trim()).toBe('Détails');
    expect(el.querySelector('a[href*="characters/new"]')).toBeNull();
  });

  it("joueur sans personnage, système avec module → une fois atterri sur « Ma fiche » après le chargement de characters(), n'en bascule plus (Story 29.15, revue de code)", async () => {
    let resolveCharacters!: (chars: CharacterDto[]) => void;
    const charactersPromise = new Promise<CharacterDto[]>((resolve) => {
      resolveCharacters = resolve;
    });
    const partie = makePartie({ gameSystemId: 'ryuutama' });

    const { fixture, el } = await createFixture(partie, PLAYER_ID, {
      members,
      desktop: true,
      noopAnimations: true,
      charactersPromise,
    });

    // Pendant le chargement : jamais « Ma fiche » par défaut avant que characters() ne soit connu.
    let activeTab = el.querySelector('div[role="tab"][aria-selected="true"]');
    expect(activeTab?.textContent?.trim()).toBe('Détails');

    resolveCharacters([]);
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // characters() révèle qu'il n'a aucun personnage sur cette partie : atterrit désormais sur
    // « Ma fiche ».
    activeTab = el.querySelector('div[role="tab"][aria-selected="true"]');
    expect(activeTab?.textContent?.trim()).toBe(GRIMOIRE_TONE['character.party_sheets_tab_label']);

    // Un rendu supplémentaire (ex. re-détection de changements) ne doit jamais le faire basculer
    // ailleurs une fois genuinely atterri sur « Ma fiche ».
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    activeTab = el.querySelector('div[role="tab"][aria-selected="true"]');
    expect(activeTab?.textContent?.trim()).toBe(GRIMOIRE_TONE['character.party_sheets_tab_label']);
  });

  it("conserve la sélection manuelle d'onglet à travers un redimensionnement (Story 29.15 : « Ma fiche » se rend aussi sur desktop, ne disparaît plus)", async () => {
    const breakpoint$ = new BehaviorSubject({ matches: false, breakpoints: {} });
    const dynamicBreakpointObserver = {
      observe: () => breakpoint$.asObservable(),
      isMatched: () => breakpoint$.value.matches,
    };

    await TestBed.configureTestingModule({
      imports: [PartieDetail],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'party-1' },
              queryParamMap: { get: () => null },
            },
          },
        },
        { provide: AuthService, useValue: makeAuthService(PLAYER_ID) },
        { provide: PartiesService, useValue: makePartiesService(makePartie(), members, []) },
        { provide: BreakpointObserver, useValue: dynamicBreakpointObserver },
        {
          provide: MyPartiesService,
          useValue: {
          refreshAll: vi.fn(),
          playerParties: signal([]),
          allParties: signal([]),
          loaded: signal(true),
        },
        },
        { provide: AvailabilityService, useValue: { notifyChanged: vi.fn() } },
        {
          provide: CharacterService,
          useValue: {
            listByPartie: vi.fn().mockResolvedValue([]),
            getGameSystemContent: vi.fn().mockResolvedValue(null),
            changed: signal(0),
          },
        },
        { provide: ThemeToneService, useValue: makeToneService() },
        { provide: ScenariosService, useValue: makeScenariosService() },
        {
          provide: AnnouncementsService,
          useValue: { create: vi.fn(), listAll: vi.fn().mockResolvedValue([]), changed: signal(0) },
        },
        {
          provide: CharacterRolesService,
          useValue: { listForPartie: vi.fn().mockResolvedValue([]), changed: signal(0) },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PartieDetail);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();

    // Joueur mobile : sélection manuelle explicite de l'onglet "Ma fiche" (index 1).
    const comp = fixture.componentInstance as unknown as {
      onTabIndexChange: (i: number) => void;
      selectedTabIndex: () => number;
    };
    comp.onTabIndexChange(1);
    expect(comp.selectedTabIndex()).toBe(1);

    // Redimensionnement vers desktop : `tabSetKey` ne dépend plus que de `isMj()` (Story 29.15,
    // l'onglet "Ma fiche" se rend désormais pour tout joueur non-MJ, desktop compris) — le rôle ne
    // change pas, donc `manualTabIndex` n'est jamais réinitialisé (AC4 : la bascule manuelle reste
    // prioritaire sur le calcul par défaut pour la visite en cours).
    breakpoint$.next({ matches: true, breakpoints: {} });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.selectedTabIndex()).toBe(1); // la sélection manuelle survit au redimensionnement
  });
});

// ─── Un bouton clair pour créer son personnage depuis la partie (Story 29.15) ─

describe('PartieDetail — canCreateCharacter / atterrissage sur « Ma fiche » (Story 29.15)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('desktop, joueur sans personnage, système avec module, partie ouverte → atterrit sur "Ma fiche", bouton visible immédiatement (AC1)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', status: 'EN_COURS' });
    const { fixture, el } = await createFixture(partie, PLAYER_ID, {
      desktop: true,
      noopAnimations: true,
    });

    const comp = fixture.componentInstance as unknown as { selectedTabIndex: () => number };
    expect(comp.selectedTabIndex()).toBe(1);
    const activeTab = el.querySelector('div[role="tab"][aria-selected="true"]');
    expect(activeTab?.textContent?.trim()).toBe(GRIMOIRE_TONE['character.party_sheets_tab_label']);
    expect(el.querySelector('.party-sheets-tab a[mat-flat-button]')).toBeTruthy();
  });

  it('mobile, même joueur → atterrissage identique aux deux gabarits (AC2)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', status: 'EN_COURS' });
    const { fixture, el } = await createFixture(partie, PLAYER_ID, {
      desktop: false,
      noopAnimations: true,
    });

    const comp = fixture.componentInstance as unknown as { selectedTabIndex: () => number };
    expect(comp.selectedTabIndex()).toBe(1);
    expect(el.querySelector('.party-sheets-tab a[mat-flat-button]')).toBeTruthy();
  });

  it('le bouton de création est un vrai lien <a> — atteignable au clavier (AC3)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', status: 'EN_COURS' });
    const { el } = await createFixture(partie, PLAYER_ID, { desktop: true, noopAnimations: true });

    const cta = el.querySelector<HTMLAnchorElement>('.party-sheets-tab a[mat-flat-button]');
    expect(cta).toBeTruthy();
    expect(cta!.tagName).toBe('A');
  });

  it('joueur ayant déjà un personnage sur cette partie → onglet par défaut "Détails", pas de bouton de création dans "Ma fiche"', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', status: 'EN_COURS' });
    const character = makeCharacterDto({ userId: PLAYER_ID, partieId: 'party-1' });
    const { fixture, el } = await createFixture(partie, PLAYER_ID, {
      desktop: true,
      noopAnimations: true,
      characters: [character],
    });

    const comp = fixture.componentInstance as unknown as { selectedTabIndex: () => number };
    expect(comp.selectedTabIndex()).toBe(0);

    const maFicheTab = Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).find(
      (t) => t.textContent?.trim() === GRIMOIRE_TONE['character.party_sheets_tab_label'],
    );
    maFicheTab?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.party-sheets-tab a[mat-flat-button]')).toBeFalsy();
  });

  it('système sans module → onglet par défaut "Détails" ; bouton absent de "Ma fiche" même sans personnage (gating corrigé)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'draconis', status: 'EN_COURS' });
    const { fixture, el } = await createFixture(partie, PLAYER_ID, {
      desktop: true,
      noopAnimations: true,
    });

    const comp = fixture.componentInstance as unknown as { selectedTabIndex: () => number };
    expect(comp.selectedTabIndex()).toBe(0);

    const maFicheTab = Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).find(
      (t) => t.textContent?.trim() === GRIMOIRE_TONE['character.party_sheets_tab_label'],
    );
    maFicheTab?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.party-sheets-tab a[mat-flat-button]')).toBeFalsy();
    expect(el.querySelector('.party-sheets-tab .muted')?.textContent?.trim()).toBeTruthy();
  });

  it('partie terminée → onglet par défaut "Détails" ; bouton absent de "Ma fiche" même sans personnage (gating corrigé)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', status: 'TERMINEE' });
    const { fixture, el } = await createFixture(partie, PLAYER_ID, {
      desktop: true,
      noopAnimations: true,
    });

    const comp = fixture.componentInstance as unknown as { selectedTabIndex: () => number };
    expect(comp.selectedTabIndex()).toBe(0);

    const maFicheTab = Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).find(
      (t) => t.textContent?.trim() === GRIMOIRE_TONE['character.party_sheets_tab_label'],
    );
    maFicheTab?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.party-sheets-tab a[mat-flat-button]')).toBeFalsy();
  });

  it('le MJ reste sur "Détails" par défaut, même sur un système avec module et une partie ouverte (inchangé)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', status: 'EN_COURS' });
    const { fixture } = await createFixture(partie, MJ_ID, { desktop: true, noopAnimations: true });

    const comp = fixture.componentInstance as unknown as { selectedTabIndex: () => number };
    expect(comp.selectedTabIndex()).toBe(0);
  });

  it("slot d'initiale du roster desktop (isSelf sans personnage) : aria-label/tooltip thématisé depuis roster.create_slot_label", async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', status: 'EN_COURS' });
    const members: PartieMemberDto[] = [
      {
        role: 'MEMBER',
        userId: MJ_ID,
        pseudo: 'Sylas',
        displayName: 'Sylas',
        email: 'sylas@test.com',
        joinedAt: '',
      },
      {
        role: 'MEMBER',
        userId: PLAYER_ID,
        pseudo: 'Alice',
        displayName: 'Alice au pays',
        email: 'alice@test.com',
        joinedAt: '',
      },
    ];
    const { el } = await createFixture(partie, PLAYER_ID, { members, desktop: true });

    const slot = el.querySelector<HTMLElement>(`[data-user-id="${PLAYER_ID}"]`);
    expect(slot).toBeTruthy();
    const expected = TONE_MAP['grimoire-emeraude']['roster.create_slot_label'];
    expect(slot!.getAttribute('aria-label')).toBe(`Alice au pays — ${expected}`);
    expect(slot!.getAttribute('title')).toBe(`Alice au pays — ${expected}`);
  });

  it("système sans module → slot roster de l'utilisateur courant non actionnable (tabindex -1, aria-label générique, pas le libellé de création) (bmad-review, 2026-09-21)", async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'draconis', status: 'EN_COURS' });
    const members: PartieMemberDto[] = [
      {
        role: 'MEMBER',
        userId: MJ_ID,
        pseudo: 'Sylas',
        displayName: 'Sylas',
        email: 'sylas@test.com',
        joinedAt: '',
      },
      {
        role: 'MEMBER',
        userId: PLAYER_ID,
        pseudo: 'Alice',
        displayName: 'Alice au pays',
        email: 'alice@test.com',
        joinedAt: '',
      },
    ];
    const { el } = await createFixture(partie, PLAYER_ID, { members, desktop: true });

    const slot = el.querySelector<HTMLElement>(`[data-user-id="${PLAYER_ID}"]`);
    expect(slot).toBeTruthy();
    expect(slot!.getAttribute('tabindex')).toBe('-1');
    expect(slot!.getAttribute('aria-label')).toBe(
      fillTone(GRIMOIRE_TONE['parties.roster_aria_no_character'], { name: 'Alice au pays' }),
    );
    expect(slot!.querySelector('.roster-rail__create-badge')).toBeNull();
  });

  it("échec réseau de listByPartie() → charactersLoaded() devient quand même true, canCreateCharacter()/l'atterrissage se résolvent normalement (bmad-review, 2026-09-21)", async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', status: 'EN_COURS' });
    const { fixture, el } = await createFixture(partie, PLAYER_ID, {
      desktop: true,
      noopAnimations: true,
      charactersPromise: Promise.reject(new Error('network down')),
    });

    const comp = fixture.componentInstance as unknown as {
      selectedTabIndex: () => number;
      charactersLoaded: () => boolean;
    };
    expect(comp.charactersLoaded()).toBe(true);
    expect(comp.selectedTabIndex()).toBe(1);
    const activeTab = el.querySelector('div[role="tab"][aria-selected="true"]');
    expect(activeTab?.textContent?.trim()).toBe(GRIMOIRE_TONE['character.party_sheets_tab_label']);
    expect(el.querySelector('.party-sheets-tab a[mat-flat-button]')).toBeTruthy();
  });

  it("navigation manuelle vers « Ma fiche » pendant le chargement de characters() → indicateur de chargement, jamais le message vide ni le bouton, indiscernables de l'état « on ne peut jamais créer ici » (bmad-review, 2026-09-21)", async () => {
    let resolveCharacters!: (chars: CharacterDto[]) => void;
    const charactersPromise = new Promise<CharacterDto[]>((resolve) => {
      resolveCharacters = resolve;
    });
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', status: 'EN_COURS' });
    const { fixture, el } = await createFixture(partie, PLAYER_ID, {
      desktop: true,
      noopAnimations: true,
      charactersPromise,
    });

    // MatTabGroup ne rend le corps que de l'onglet actif (cf. Implementation Notes de la story
    // 29.15) — pendant le chargement, l'atterrissage par défaut reste « Détails », donc le corps de
    // « Ma fiche » n'existe pas encore tant que rien ne le sélectionne. On reproduit ici exactement
    // le cas visé (navigation manuelle du joueur avant la fin du chargement), pas l'atterrissage
    // automatique (déjà couvert par les tests de flicker ci-dessus).
    const maFicheTab = Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).find(
      (t) => t.textContent?.trim() === GRIMOIRE_TONE['character.party_sheets_tab_label'],
    );
    maFicheTab?.click();
    fixture.detectChanges();

    expect(el.querySelector('.party-sheets-tab mat-progress-spinner')).toBeTruthy();
    expect(el.querySelector('.party-sheets-tab .muted')).toBeNull();
    expect(el.querySelector('.party-sheets-tab a[mat-flat-button]')).toBeNull();

    resolveCharacters([]);
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.party-sheets-tab mat-progress-spinner')).toBeNull();
    expect(el.querySelector('.party-sheets-tab a[mat-flat-button]')).toBeTruthy();
  });

  it("un personnage créé ailleurs et rechargé via le signal temps réel ne fait plus basculer l'onglet hors de « Ma fiche » une fois l'atterrissage stabilisé (bmad-review, 2026-09-21 : gel tabSettled)", async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', status: 'EN_COURS' });
    const changed = signal(0);
    const newCharacter = makeCharacterDto({ id: 'char-x', userId: PLAYER_ID, partieId: partie.id });
    let callCount = 0;
    const listByPartie = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(callCount === 1 ? [] : [newCharacter]);
    });

    await TestBed.configureTestingModule({
      imports: [PartieDetail],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => partie.id },
              queryParamMap: { get: () => null },
            },
          },
        },
        { provide: AuthService, useValue: makeAuthService(PLAYER_ID) },
        { provide: PartiesService, useValue: makePartiesService(partie, [], []) },
        { provide: BreakpointObserver, useValue: makeBreakpointObserver(true) },
        {
          provide: MyPartiesService,
          useValue: {
          refreshAll: vi.fn(),
          playerParties: signal([]),
          allParties: signal([]),
          loaded: signal(true),
        },
        },
        { provide: AvailabilityService, useValue: { notifyChanged: vi.fn() } },
        {
          provide: CharacterService,
          useValue: {
            listByPartie,
            getGameSystemContent: vi.fn().mockResolvedValue(null),
            changed,
          },
        },
        { provide: ThemeToneService, useValue: makeToneService() },
        { provide: ScenariosService, useValue: makeScenariosService() },
        {
          provide: AnnouncementsService,
          useValue: { create: vi.fn(), listAll: vi.fn().mockResolvedValue([]), changed: signal(0) },
        },
        {
          provide: UnseenAnnouncementsService,
          useValue: { unseenAnnouncements: signal([]), markRead: vi.fn() },
        },
        {
          provide: HommeDragonService,
          useValue: {
            findOne: vi.fn().mockResolvedValue(null),
            // Story 33.8 : l'onglet est un panneau d'aventure (lien fiche / associer / dissocier).
            findForPartie: vi.fn().mockResolvedValue(null),
            listMine: vi.fn().mockResolvedValue([]),
            link: vi.fn(),
            unlink: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            changed: signal(0),
          },
        },
        {
          provide: CharacterRolesService,
          useValue: { listForPartie: vi.fn().mockResolvedValue([]), changed: signal(0) },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PartieDetail);
    fixture.detectChanges();
    for (let i = 0; i < 15; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    let activeTab = el.querySelector('div[role="tab"][aria-selected="true"]');
    expect(activeTab?.textContent?.trim()).toBe(GRIMOIRE_TONE['character.party_sheets_tab_label']);

    // Signal temps réel : characterSvc.changed() déclenche reloadCharacters(), qui révèle
    // désormais un personnage — canCreateCharacter() bascule à `false`, mais l'onglet ne doit
    // plus bouger (déjà stabilisé une fois, cf. l'effet `tabSettled` de partie-detail.ts).
    changed.update((v) => v + 1);
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    activeTab = el.querySelector('div[role="tab"][aria-selected="true"]');
    expect(activeTab?.textContent?.trim()).toBe(GRIMOIRE_TONE['character.party_sheets_tab_label']);
  });
});

// ─── Onglet Invitations & liens révoqués (Story 6.1) ──────────────────────

describe('PartieDetail — invitations', () => {
  afterEach(() => TestBed.resetTestingModule());

  const links: InviteLinkDto[] = [
    {
      id: 'l1',
      token: 'active-token',
      maxUses: 1,
      usesCount: 0,
      expiresAt: '2099-01-01',
      revoked: false,
      createdAt: '',
    },
    {
      id: 'l2',
      token: 'revoked-token',
      maxUses: 1,
      usesCount: 0,
      expiresAt: '2099-01-01',
      revoked: true,
      createdAt: '',
    },
  ];

  it("un lien révoqué ne s'affiche plus dans l'onglet Invitations (AC6)", async () => {
    const { fixture, el } = await createFixture(makePartie(), MJ_ID, {
      links,
      noopAnimations: true,
    });

    const tabLabels = el.querySelectorAll<HTMLElement>('div[role="tab"]');
    const invitationsTab = Array.from(tabLabels).find((t) =>
      t.textContent?.includes(GRIMOIRE_TONE['partie.invitations_tab_label']),
    );
    invitationsTab?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = el.textContent ?? '';
    expect(text).toContain('active-token');
    expect(text).not.toContain('revoked-token');
  });

  it("un joueur (non-MJ) n'a pas d'onglet Invitations", async () => {
    const { el } = await createFixture(makePartie(), PLAYER_ID, { links });
    const tabLabels = Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).map((t) =>
      t.textContent?.trim(),
    );
    expect(tabLabels).not.toContain('Invitations');
  });

  it('le MJ peut retirer un membre depuis la liste "Membres actuels" de l\'onglet Invitations', async () => {
    const members: PartieMemberDto[] = [
      {
        role: 'MEMBER',
        userId: MJ_ID,
        pseudo: 'Sylas',
        displayName: 'Sylas',
        email: 'sylas@test.com',
        joinedAt: '',
      },
      {
        role: 'MEMBER',
        userId: PLAYER_ID,
        pseudo: 'Alice',
        displayName: 'Alice au pays',
        email: 'alice@test.com',
        joinedAt: '',
      },
    ];
    const { fixture, el } = await createFixture(makePartie(), MJ_ID, {
      members,
      noopAnimations: true,
    });

    const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    const tabLabels = el.querySelectorAll<HTMLElement>('div[role="tab"]');
    const invitationsTab = Array.from(tabLabels).find((t) =>
      t.textContent?.includes(GRIMOIRE_TONE['partie.invitations_tab_label']),
    );
    invitationsTab?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Alice');

    const removeButtons = Array.from(el.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Retirer'),
    );
    expect(removeButtons.length).toBe(1); // seule Alice est retirable, le MJ (Sylas) est exclu de la liste
    removeButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();

    const parties = TestBed.inject(PartiesService) as unknown as {
      removeMember: ReturnType<typeof vi.fn>;
    };
    expect(parties.removeMember).toHaveBeenCalledWith('party-1', PLAYER_ID);
  });
});

describe('PartieDetail — autocomplétion des invitations (Story 32.1)', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  /** Même discipline de vidage de microtâches que `createFixture()` (ngOnInit enchaîne plusieurs
   *  `await` sur des mocks) — nécessaire ici aussi pour laisser l'`effect()` de debounce et la
   *  promesse de `runSearch()` (mock résolu) se propager jusqu'aux signaux `results`/`search`. */
  async function flush(fixture: ComponentFixture<PartieDetail>): Promise<void> {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it("sous le seuil minimal (1 caractère) : aucune requête HTTP n'est émise, results vidé", async () => {
    const { fixture } = await createFixture(makePartie(), MJ_ID);
    vi.useFakeTimers();
    const parties = TestBed.inject(PartiesService) as unknown as {
      searchUsers: ReturnType<typeof vi.fn>;
    };
    parties.searchUsers.mockClear();

    fixture.componentInstance['search'].set('a');
    await flush(fixture);
    vi.advanceTimersByTime(1000);
    await flush(fixture);

    expect(parties.searchUsers).not.toHaveBeenCalled();
    expect(fixture.componentInstance['results']()).toEqual([]);
  });

  it('au-dessus du seuil (2 caractères) : la recherche se déclenche automatiquement 500 ms après la frappe', async () => {
    const { fixture } = await createFixture(makePartie(), MJ_ID);
    vi.useFakeTimers();
    const parties = TestBed.inject(PartiesService) as unknown as {
      searchUsers: ReturnType<typeof vi.fn>;
    };
    parties.searchUsers.mockClear();
    parties.searchUsers.mockResolvedValue([{ id: 'u9', pseudo: 'Zed' }]);

    fixture.componentInstance['search'].set('ze');
    await flush(fixture);
    expect(parties.searchUsers).not.toHaveBeenCalled(); // pas encore écoulé les 500 ms

    vi.advanceTimersByTime(499);
    await flush(fixture);
    expect(parties.searchUsers).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await flush(fixture);

    expect(parties.searchUsers).toHaveBeenCalledWith('ze');
    expect(fixture.componentInstance['results']()).toEqual([{ id: 'u9', pseudo: 'Zed' }]);
  });

  it("une nouvelle frappe avant l'expiration du délai réarme le debounce (un seul appel, avec la dernière valeur)", async () => {
    const { fixture } = await createFixture(makePartie(), MJ_ID);
    vi.useFakeTimers();
    const parties = TestBed.inject(PartiesService) as unknown as {
      searchUsers: ReturnType<typeof vi.fn>;
    };
    parties.searchUsers.mockClear();

    fixture.componentInstance['search'].set('al');
    await flush(fixture);
    vi.advanceTimersByTime(300);
    await flush(fixture);
    fixture.componentInstance['search'].set('ali');
    await flush(fixture);
    vi.advanceTimersByTime(500);
    await flush(fixture);

    expect(parties.searchUsers).toHaveBeenCalledTimes(1);
    expect(parties.searchUsers).toHaveBeenCalledWith('ali');
  });

  it("déclenchement manuel (runSearch(), bouton/(keyup.enter)) avec une saisie d'1 caractère : aucun appel réseau, results vidé", async () => {
    const { fixture } = await createFixture(makePartie(), MJ_ID);
    vi.useFakeTimers();
    const parties = TestBed.inject(PartiesService) as unknown as {
      searchUsers: ReturnType<typeof vi.fn>;
    };
    parties.searchUsers.mockClear();

    fixture.componentInstance['search'].set('a');
    await flush(fixture);
    await fixture.componentInstance['runSearch']();
    await flush(fixture);

    expect(parties.searchUsers).not.toHaveBeenCalled();
    expect(fixture.componentInstance['results']()).toEqual([]);
  });

  it('un déclenchement manuel annule le minuteur de debounce en attente (pas de second appel redondant ~500 ms plus tard)', async () => {
    const { fixture } = await createFixture(makePartie(), MJ_ID);
    vi.useFakeTimers();
    const parties = TestBed.inject(PartiesService) as unknown as {
      searchUsers: ReturnType<typeof vi.fn>;
    };
    parties.searchUsers.mockClear();
    parties.searchUsers.mockResolvedValue([]);

    fixture.componentInstance['search'].set('al');
    await flush(fixture);
    await fixture.componentInstance['runSearch']();
    await flush(fixture);
    expect(parties.searchUsers).toHaveBeenCalledTimes(1);

    // Le minuteur programmé par l'effect() de debounce doit avoir été annulé par runSearch() —
    // sans ce nettoyage, un second appel redondant partait ~500 ms plus tard.
    vi.advanceTimersByTime(500);
    await flush(fixture);

    expect(parties.searchUsers).toHaveBeenCalledTimes(1);
  });

  it('une réponse plus ancienne ne doit jamais écraser des résultats plus récents (Story 32.1, revue de code)', async () => {
    const { fixture } = await createFixture(makePartie(), MJ_ID);
    vi.useFakeTimers();
    const parties = TestBed.inject(PartiesService) as unknown as {
      searchUsers: ReturnType<typeof vi.fn>;
    };
    parties.searchUsers.mockClear();

    let resolveStale!: (v: { id: string; pseudo: string }[]) => void;
    const stale = new Promise<{ id: string; pseudo: string }[]>((res) => {
      resolveStale = res;
    });
    parties.searchUsers.mockImplementationOnce(() => stale);

    fixture.componentInstance['search'].set('al');
    await flush(fixture);
    vi.advanceTimersByTime(500);
    await flush(fixture);
    expect(parties.searchUsers).toHaveBeenCalledWith('al');

    // Avant que la réponse (périmée) de 'al' ne résolve, l'utilisateur tape 'ali' et déclenche
    // manuellement une recherche fraîche, qui résout immédiatement.
    parties.searchUsers.mockResolvedValueOnce([{ id: 'fresh', pseudo: 'Alice' }]);
    fixture.componentInstance['search'].set('ali');
    await flush(fixture);
    await fixture.componentInstance['runSearch']();
    await flush(fixture);
    expect(fixture.componentInstance['results']()).toEqual([{ id: 'fresh', pseudo: 'Alice' }]);

    // La réponse périmée ('al') résout après coup : elle ne doit jamais écraser les résultats frais.
    resolveStale([{ id: 'stale', pseudo: 'Alan' }]);
    await flush(fixture);

    expect(fixture.componentInstance['results']()).toEqual([{ id: 'fresh', pseudo: 'Alice' }]);
  });
});

describe('PartieDetail — invitation par e-mail', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('succès : affiche la confirmation et vide le champ', async () => {
    const { fixture } = await createFixture(makePartie({ ownerId: MJ_ID }), MJ_ID);
    const parties = TestBed.inject(PartiesService) as unknown as {
      inviteByEmail: ReturnType<typeof vi.fn>;
    };
    parties.inviteByEmail.mockResolvedValue({ ok: true });

    const component = fixture.componentInstance as unknown as {
      inviteEmail: { set: (v: string) => void; (): string };
      inviteEmailError: () => string | null;
      notice: () => string | null;
      inviteByEmail: () => Promise<void>;
    };
    component.inviteEmail.set('ami@example.com');
    await component.inviteByEmail();
    fixture.detectChanges();

    expect(parties.inviteByEmail).toHaveBeenCalledWith('party-1', 'ami@example.com');
    expect(component.notice()).toContain('ami@example.com');
    expect(component.inviteEmail()).toBe('');
    expect(component.inviteEmailError()).toBeNull();
  });

  it('échec ({ ok: false }) : affiche un message d’erreur explicite, ne vide pas le champ', async () => {
    const { fixture } = await createFixture(makePartie({ ownerId: MJ_ID }), MJ_ID);
    const parties = TestBed.inject(PartiesService) as unknown as {
      inviteByEmail: ReturnType<typeof vi.fn>;
    };
    parties.inviteByEmail.mockResolvedValue({ ok: false });

    const component = fixture.componentInstance as unknown as {
      inviteEmail: { set: (v: string) => void; (): string };
      inviteEmailError: () => string | null;
      inviteByEmail: () => Promise<void>;
    };
    component.inviteEmail.set('ami@example.com');
    await component.inviteByEmail();
    fixture.detectChanges();

    expect(component.inviteEmailError()).toBeTruthy();
    expect(component.inviteEmail()).toBe('ami@example.com');
  });

  it('ignore un second appel concurrent tant que le premier est en cours (anti double-soumission)', async () => {
    const { fixture } = await createFixture(makePartie({ ownerId: MJ_ID }), MJ_ID);
    const parties = TestBed.inject(PartiesService) as unknown as {
      inviteByEmail: ReturnType<typeof vi.fn>;
    };
    let resolveFirst!: (v: { ok: boolean }) => void;
    parties.inviteByEmail.mockReturnValue(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );

    const component = fixture.componentInstance as unknown as {
      inviteEmail: { set: (v: string) => void; (): string };
      inviteByEmail: () => Promise<void>;
    };
    component.inviteEmail.set('ami@example.com');
    const firstCall = component.inviteByEmail();
    const secondCall = component.inviteByEmail(); // déclenché pendant que le premier est en vol

    resolveFirst({ ok: true });
    await firstCall;
    await secondCall;

    expect(parties.inviteByEmail).toHaveBeenCalledTimes(1);
  });
});

// ─── Distribution d'XP (Story 6.2) ────────────────────────────────────────

describe('PartieDetail — distribution d’XP', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('bouton "Distribuer de l’XP" visible pour le MJ uniquement', async () => {
    const partie = makePartie({ ownerId: MJ_ID });

    const { el: elMj } = await createFixture(partie, MJ_ID);
    const buttons = Array.from(elMj.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('XP'),
    );
    expect(buttons.length).toBeGreaterThan(0);
    TestBed.resetTestingModule();

    const { el: elPlayer } = await createFixture(partie, PLAYER_ID);
    const playerButtons = Array.from(elPlayer.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('XP'),
    );
    expect(playerButtons.length).toBe(0);
  });

  it('section historique chargée seulement pour le MJ', async () => {
    const partie = makePartie({ ownerId: MJ_ID });
    await createFixture(partie, MJ_ID);
    const parties = TestBed.inject(PartiesService) as unknown as {
      listXpDistributions: ReturnType<typeof vi.fn>;
    };
    expect(parties.listXpDistributions).toHaveBeenCalledWith('party-1');
    TestBed.resetTestingModule();

    await createFixture(partie, PLAYER_ID);
    const partiesPlayer = TestBed.inject(PartiesService) as unknown as {
      listXpDistributions: ReturnType<typeof vi.fn>;
    };
    expect(partiesPlayer.listXpDistributions).not.toHaveBeenCalled();
  });

  it('après distributed(), characters()/xpDistributions() sont rechargés', async () => {
    const partie = makePartie({ ownerId: MJ_ID });
    const { fixture } = await createFixture(partie, MJ_ID, {
      characters: [makeCharacterDto({ id: 'c1' })],
    });
    const characters = TestBed.inject(CharacterService) as unknown as {
      listByPartie: ReturnType<typeof vi.fn>;
    };
    const parties = TestBed.inject(PartiesService) as unknown as {
      listXpDistributions: ReturnType<typeof vi.fn>;
    };
    characters.listByPartie.mockClear();
    parties.listXpDistributions.mockClear();

    const component = fixture.componentInstance as unknown as {
      onXpDistributed: () => Promise<void>;
    };
    await component.onXpDistributed();

    expect(characters.listByPartie).toHaveBeenCalledWith('party-1');
    expect(parties.listXpDistributions).toHaveBeenCalledWith('party-1');
  });
});

describe('PartieDetail — publication d’annonce (Story 9.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('bouton de publication d’annonce visible pour le MJ, absent pour un joueur (AC6)', async () => {
    const partie = makePartie({ ownerId: MJ_ID });

    const { el: elMj } = await createFixture(partie, MJ_ID);
    expect(elMj.querySelector('.announcement-section')).toBeTruthy();
    TestBed.resetTestingModule();

    const { el: elPlayer } = await createFixture(partie, PLAYER_ID);
    expect(elPlayer.querySelector('.announcement-section')).toBeFalsy();
  });

  it('le panel reste ouvert après publication (revue de code : le MJ voit la confirmation avant de fermer lui-même)', async () => {
    const partie = makePartie({ ownerId: MJ_ID });
    const { fixture } = await createFixture(partie, MJ_ID);

    const component = fixture.componentInstance as unknown as {
      showAnnouncementForm: WritableSignal<boolean>;
    };
    component.showAnnouncementForm.set(true);
    fixture.detectChanges();

    expect(component.showAnnouncementForm()).toBe(true);
  });
});

describe('PartieDetail — consultation des annonces « toute la campagne » (Story 9.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC1 : affiche les annonces scenarioId: null, triées (ordre déjà renvoyé par le backend)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const announcements = [
      makeAnnouncementDto({ id: 'ann-recent', text: 'La plus récente' }),
      makeAnnouncementDto({ id: 'ann-ancien', text: 'La plus ancienne' }),
    ];

    const { el } = await createFixture(partie, MJ_ID, { announcements });

    const feed = el.querySelector('.announcements-feed');
    expect(feed).toBeTruthy();
    expect(feed!.textContent).toContain('La plus récente');
    expect(feed!.textContent).toContain('La plus ancienne');
  });

  it("une annonce scopée à un scénario n'apparaît jamais dans ce flux (filtrée côté client)", async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const announcements = [
      makeAnnouncementDto({ id: 'ann-campagne', text: 'Annonce campagne', scenarioId: null }),
      makeAnnouncementDto({ id: 'ann-scenario', text: 'Annonce scénario', scenarioId: 's1' }),
    ];

    const { el } = await createFixture(partie, MJ_ID, { announcements });

    const feed = el.querySelector('.announcements-feed');
    expect(feed!.textContent).toContain('Annonce campagne');
    expect(feed!.textContent).not.toContain('Annonce scénario');
  });

  it('libellé « Ce one-shot » pour une Partie ONE_SHOT, « Toute la campagne » sinon', async () => {
    const oneShot = makePartie({ ownerId: MJ_ID, kind: 'ONE_SHOT' });
    const { el: elOneShot } = await createFixture(oneShot, MJ_ID, {
      announcements: [makeAnnouncementDto()],
    });
    expect(elOneShot.querySelector('.announcements-feed')!.textContent).toContain('Cette quête');
    TestBed.resetTestingModule();

    const campagne = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const { el: elCampagne } = await createFixture(campagne, MJ_ID, {
      announcements: [makeAnnouncementDto()],
    });
    expect(elCampagne.querySelector('.announcements-feed')!.textContent).toContain(
      GRIMOIRE_TONE['announcement.scope_campaign_label'],
    );
  });

  it('visible pour un joueur, pas seulement le MJ', async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const { el } = await createFixture(partie, PLAYER_ID, {
      announcements: [makeAnnouncementDto({ text: 'Visible du joueur' })],
    });

    expect(el.querySelector('.announcements-feed')!.textContent).toContain('Visible du joueur');
  });

  it('publication réussie recharge la liste (announcementsSvc.listAll rappelé)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const { fixture } = await createFixture(partie, MJ_ID);
    const announcementsSvc = TestBed.inject(AnnouncementsService) as unknown as {
      listAll: ReturnType<typeof vi.fn>;
    };
    const callsBefore = announcementsSvc.listAll.mock.calls.length;

    const component = fixture.componentInstance as unknown as {
      onAnnouncementPublished: () => Promise<void>;
    };
    await component.onAnnouncementPublished();

    expect(announcementsSvc.listAll.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

describe('PartieDetail — marquage « vue » des annonces de campagne sur clic explicite (Story 29.13, révision)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("une annonce non vue affichée n'appelle jamais markRead() tant qu'elle n'est pas cliquée", async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const announcements = [makeAnnouncementDto({ id: 'ann-non-vue', text: 'Non vue' })];
    const markAnnouncementRead = vi.fn().mockResolvedValue(undefined);

    await createFixture(partie, MJ_ID, {
      announcements,
      unseenAnnouncementIds: ['ann-non-vue'],
      markAnnouncementRead,
    });

    expect(markAnnouncementRead).not.toHaveBeenCalled();
  });

  it('un clic sur une annonce non vue déclenche markRead() avec le bon id', async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const announcements = [makeAnnouncementDto({ id: 'ann-non-vue', text: 'Non vue' })];
    const markAnnouncementRead = vi.fn().mockResolvedValue(undefined);

    const { fixture, el } = await createFixture(partie, MJ_ID, {
      announcements,
      unseenAnnouncementIds: ['ann-non-vue'],
      markAnnouncementRead,
    });

    el.querySelector('app-annonce-card article')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(markAnnouncementRead).toHaveBeenCalledWith('ann-non-vue');
  });

  it('un clic sur une annonce déjà vue (absente des non-vues) ne déclenche aucun appel', async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const announcements = [makeAnnouncementDto({ id: 'ann-deja-vue', text: 'Déjà vue' })];
    const markAnnouncementRead = vi.fn().mockResolvedValue(undefined);

    const { fixture, el } = await createFixture(partie, MJ_ID, {
      announcements,
      unseenAnnouncementIds: [],
      markAnnouncementRead,
    });

    el.querySelector('app-annonce-card article')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(markAnnouncementRead).not.toHaveBeenCalled();
  });
});

describe('PartieDetail — arrivée depuis le bandeau du Shell (Story 29.13, révision du 2026-08-13)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('force l\'onglet "Détails" même quand un autre onglet serait sélectionné par défaut (joueur mobile)', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    // gameSystemId: 'ryuutama' (avec module) — sans forçage, ce joueur sans personnage atterrit
    // sur "Ma fiche" (index 1, Story 29.15) ; le test vérifie que le forçage du bandeau l'emporte.
    const partie = makePartie({
      ownerId: MJ_ID,
      kind: 'CAMPAGNE_LINEAIRE',
      gameSystemId: 'ryuutama',
    });
    const announcements = [makeAnnouncementDto({ id: 'ann-cible', scenarioId: null })];

    const { fixture } = await createFixture(partie, 'player-1', {
      announcements,
      unseenAnnouncementIds: ['ann-cible'],
      announcementIdQueryParam: 'ann-cible',
      desktop: false,
      noopAnimations: true,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.componentInstance as any).selectedTabIndex()).toBe(0);
  });

  it("fait défiler jusqu'à l'AnnonceCard visée et la met en évidence", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const announcements = [makeAnnouncementDto({ id: 'ann-cible', scenarioId: null })];

    const { fixture, el } = await createFixture(partie, MJ_ID, {
      announcements,
      unseenAnnouncementIds: ['ann-cible'],
      announcementIdQueryParam: 'ann-cible',
      noopAnimations: true,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    // scrollToAnnouncement() retente via requestAnimationFrame jusqu'à trouver l'élément.
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => requestAnimationFrame(r));
    }

    const target = el.querySelector('#announcement-ann-cible');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(target?.classList.contains('annonce-card--highlight')).toBe(true);
  });

  it("n'interfère pas quand aucun announcementId n'est présent dans l'URL", async () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });

    await createFixture(partie, MJ_ID, { noopAnimations: true });

    expect(scrollSpy).not.toHaveBeenCalled();
  });
});

describe('PartieDetail — onglet Scénario(s) (Story 7.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('Partie ONE_SHOT + MJ → onglet "Scénario" (singulier), app-scenario-one-shot-tab, jamais app-scenario-list', async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'ONE_SHOT' });
    const { fixture, el } = await createFixture(partie, MJ_ID, { noopAnimations: true });

    const tabLabels = el.querySelectorAll<HTMLElement>('div[role="tab"]');
    const scenarioTab = Array.from(tabLabels).find(
      (t) => t.textContent?.trim() === GRIMOIRE_TONE['parties.detail_tab_scenario'],
    );
    expect(scenarioTab).toBeTruthy();
    scenarioTab?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('app-scenario-one-shot-tab')).toBeTruthy();
    expect(el.querySelector('app-scenario-list')).toBeNull();
  });

  it('Partie CAMPAGNE_LINEAIRE + MJ → onglet "Scénarios" (pluriel), app-scenario-list, jamais app-scenario-one-shot-tab', async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const { fixture, el } = await createFixture(partie, MJ_ID, { noopAnimations: true });

    const tabLabels = el.querySelectorAll<HTMLElement>('div[role="tab"]');
    const scenarioTab = Array.from(tabLabels).find(
      (t) => t.textContent?.trim() === GRIMOIRE_TONE['parties.detail_tab_scenarios'],
    );
    expect(scenarioTab).toBeTruthy();
    scenarioTab?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('app-scenario-list')).toBeTruthy();
    expect(el.querySelector('app-scenario-one-shot-tab')).toBeNull();
  });

  it('joueur (non-MJ) → aucun des deux onglets Scénario(s), quel que soit le kind', async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const { el } = await createFixture(partie, PLAYER_ID);
    expect(el.querySelector('app-scenario-list')).toBeNull();
    expect(el.querySelector('app-scenario-one-shot-tab')).toBeNull();
  });
});

describe('PartieDetail — onglet Chronologie (Story 7.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('Partie CAMPAGNE_LINEAIRE + MJ → onglet "Chronologie" présent, app-scenario-timeline rendu au clic', async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const { fixture, el } = await createFixture(partie, MJ_ID, { noopAnimations: true });

    const tabLabels = el.querySelectorAll<HTMLElement>('div[role="tab"]');
    const chronoTab = Array.from(tabLabels).find((t) => t.textContent?.trim() === 'Chronologie');
    expect(chronoTab).toBeTruthy();
    chronoTab?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('app-scenario-timeline')).toBeTruthy();
  });

  it('Partie CAMPAGNE_LINEAIRE + joueur (non-MJ) → onglet "Chronologie" présent (visible à tout membre)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const { el } = await createFixture(partie, PLAYER_ID, { noopAnimations: true });

    const tabLabels = el.querySelectorAll<HTMLElement>('div[role="tab"]');
    const chronoTab = Array.from(tabLabels).find((t) => t.textContent?.trim() === 'Chronologie');
    expect(chronoTab).toBeTruthy();
  });

  it('Partie ONE_SHOT → onglet "Chronologie" absent (un ONE_SHOT n’a pas de timeline)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'ONE_SHOT' });
    const { el } = await createFixture(partie, MJ_ID);
    const tabLabels = Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).map((t) =>
      t.textContent?.trim(),
    );
    expect(tabLabels).not.toContain('Chronologie');
  });
});

describe('PartieDetail — onglet Homme Dragon (Story 10.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('MJ + Partie Ryuutama → onglet "Homme Dragon" présent, panneau d\'aventure rendu au clic (Story 33.8)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { fixture, el } = await createFixture(partie, MJ_ID, { noopAnimations: true });

    const tabLabels = el.querySelectorAll<HTMLElement>('div[role="tab"]');
    const hdTab = Array.from(tabLabels).find((t) => t.textContent?.trim() === 'Homme Dragon');
    expect(hdTab).toBeTruthy();
    hdTab?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // L'onglet n'embarque plus la fiche : c'est le panneau d'AVENTURE (lien, créer, associer).
    expect(el.querySelector('app-homme-dragon-aventure-panel')).toBeTruthy();
    expect(el.querySelector('app-homme-dragon-sheet')).toBeNull();
  });

  it('joueur (non-MJ) → onglet "Homme Dragon" absent, même sur une Partie Ryuutama (AC3)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { el } = await createFixture(partie, PLAYER_ID);
    const tabLabels = Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).map((t) =>
      t.textContent?.trim(),
    );
    expect(tabLabels).not.toContain('Homme Dragon');
  });

  it('Partie non-Ryuutama → onglet "Homme Dragon" absent, même pour le MJ (AD-1/AD-5)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'draconis' });
    const { el } = await createFixture(partie, MJ_ID);
    const tabLabels = Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).map((t) =>
      t.textContent?.trim(),
    );
    expect(tabLabels).not.toContain('Homme Dragon');
  });
});

describe('PartieDetail — fiches de référence (Story 12.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  // Story 29.15 : un joueur sans personnage sur un système avec module atterrit désormais sur
  // "Ma fiche" par défaut (même sur desktop) — les fiches de référence vivent dans "Détails", donc
  // chaque test de ce describe navigue explicitement vers cet onglet avant d'y chercher du contenu
  // (MatTabGroup ne rend le corps que de l'onglet actif/adjacent).
  async function goToDetailsTab(
    fixture: ComponentFixture<PartieDetail>,
    el: HTMLElement,
  ): Promise<void> {
    const detailsTab = Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).find(
      (t) => t.textContent?.trim() === 'Détails',
    );
    detailsTab?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('Partie Ryuutama → section "Fiches de référence" présente, visible à tout membre (pas seulement au MJ)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { fixture, el } = await createFixture(partie, PLAYER_ID, { noopAnimations: true });
    await goToDetailsTab(fixture, el);
    expect(el.querySelector('.reference-sheets')).toBeTruthy();
  });

  it('Partie non-Ryuutama → section "Fiches de référence" absente', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'draconis' });
    const { el } = await createFixture(partie, PLAYER_ID);
    expect(el.querySelector('.reference-sheets')).toBeNull();
  });

  it('clic sur "Journal" → appelle getGameSystemAsset(partieId, gameSystemId, "journal") et déclenche un téléchargement', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { fixture, el } = await createFixture(partie, PLAYER_ID, { noopAnimations: true });
    await goToDetailsTab(fixture, el);
    const characterSvc = TestBed.inject(CharacterService) as any;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);

    const buttons = el.querySelectorAll<HTMLButtonElement>('.reference-sheets__links button');
    buttons[0].click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(characterSvc.getGameSystemAsset).toHaveBeenCalledWith(partie.id, 'ryuutama', 'journal');
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('clic sur "Carte" → appelle getGameSystemAsset(partieId, gameSystemId, "carte")', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { fixture, el } = await createFixture(partie, PLAYER_ID, { noopAnimations: true });
    await goToDetailsTab(fixture, el);
    const characterSvc = TestBed.inject(CharacterService) as any;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);

    const buttons = el.querySelectorAll<HTMLButtonElement>('.reference-sheets__links button');
    buttons[1].click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(characterSvc.getGameSystemAsset).toHaveBeenCalledWith(partie.id, 'ryuutama', 'carte');
  });

  it("échec du téléchargement → message d'erreur affiché, pas de plantage", async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { fixture, el } = await createFixture(partie, PLAYER_ID, { noopAnimations: true });
    await goToDetailsTab(fixture, el);
    const characterSvc = TestBed.inject(CharacterService) as any;
    characterSvc.getGameSystemAsset.mockRejectedValueOnce(new Error('network down'));

    const buttons = el.querySelectorAll<HTMLButtonElement>('.reference-sheets__links button');
    buttons[0].click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(el.querySelector('.reference-sheets__error')).toBeTruthy();
  });

  it('les 2 boutons sont désactivés pendant un téléchargement en cours (revue de code : garde anti-double-clic)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { fixture, el } = await createFixture(partie, PLAYER_ID, { noopAnimations: true });
    await goToDetailsTab(fixture, el);
    const characterSvc = TestBed.inject(CharacterService) as any;
    let resolveDownload: (blob: Blob) => void;
    characterSvc.getGameSystemAsset.mockReturnValueOnce(
      new Promise<Blob>((resolve) => {
        resolveDownload = resolve;
      }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);

    const buttons = el.querySelectorAll<HTMLButtonElement>('.reference-sheets__links button');
    buttons[0].click();
    await Promise.resolve();
    fixture.detectChanges();

    const refreshedButtons = el.querySelectorAll<HTMLButtonElement>(
      '.reference-sheets__links button',
    );
    expect(refreshedButtons[0].disabled).toBe(true);
    expect(refreshedButtons[1].disabled).toBe(true);

    resolveDownload!(new Blob(['%PDF-1.6'], { type: 'application/pdf' }));
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  });
});

describe('PartieDetail — fiches de préparation MJ-only (Story 12.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('MJ + Partie Ryuutama → section "Fiches de préparation" présente avec les 8 liens', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { el } = await createFixture(partie, MJ_ID);
    const section = el.querySelector('.prep-sheets');
    expect(section).toBeTruthy();
    expect(section?.querySelectorAll('.prep-sheets__links button').length).toBe(8);
  });

  it('joueur (non-MJ) → section "Fiches de préparation" absente, même sur une Partie Ryuutama (AC2)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { el } = await createFixture(partie, PLAYER_ID);
    expect(el.querySelector('.prep-sheets')).toBeNull();
  });

  it('MJ + Partie non-Ryuutama → section "Fiches de préparation" absente', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'draconis' });
    const { el } = await createFixture(partie, MJ_ID);
    expect(el.querySelector('.prep-sheets')).toBeNull();
  });

  it.each([
    ['monde', 0],
    ['monstre', 1],
    ['ville', 2],
    ['objectif-chasse', 3],
    ['objectif-quete', 4],
    ['objectif-voyage', 5],
    ['oeuf-de-bataille', 6],
    ['structure', 7],
  ])(
    'clic sur le lien #%s (index %i) → appelle getGameSystemAsset(partieId, "ryuutama", "%s")',
    async (key, index) => {
      const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
      const { fixture, el } = await createFixture(partie, MJ_ID);
      const characterSvc = TestBed.inject(CharacterService) as any;
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);

      const buttons = el.querySelectorAll<HTMLButtonElement>('.prep-sheets__links button');
      buttons[index as number].click();
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();

      expect(characterSvc.getGameSystemAsset).toHaveBeenCalledWith(partie.id, 'ryuutama', key);
    },
  );
});

describe('PartieDetail — rechargement sur signal temps réel (Story 18.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('la Partie éditée ailleurs (ex. gameSystemId) apparaît sans F5 quand un événement temps réel est reçu (AC1)', async () => {
    const initial = makePartie({ ownerId: MJ_ID, gameSystemId: 'draconis' });
    const updated = { ...initial, gameSystemId: 'ryuutama' };
    const changed = signal(0);
    const partiesSvc = {
      get: vi.fn().mockResolvedValueOnce(initial).mockResolvedValue(updated),
      members: vi.fn().mockResolvedValue([]),
      inviteLinks: vi.fn().mockResolvedValue([]),
      searchUsers: vi.fn().mockResolvedValue([]),
      inviteUser: vi.fn(),
      inviteByEmail: vi.fn(),
      removeMember: vi.fn(),
      createInviteLink: vi.fn(),
      revokeInviteLink: vi.fn(),
      remove: vi.fn(),
      listXpDistributions: vi.fn().mockResolvedValue([]),
      createXpDistribution: vi.fn(),
      changed,
      notifyChanged: vi.fn(() => changed.update((v) => v + 1)),
    };

    await TestBed.configureTestingModule({
      imports: [PartieDetail],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => initial.id },
              queryParamMap: { get: () => null },
            },
          },
        },
        { provide: AuthService, useValue: makeAuthService(MJ_ID) },
        { provide: PartiesService, useValue: partiesSvc },
        { provide: BreakpointObserver, useValue: makeBreakpointObserver(true) },
        {
          provide: MyPartiesService,
          useValue: {
          refreshAll: vi.fn(),
          playerParties: signal([]),
          allParties: signal([]),
          loaded: signal(true),
        },
        },
        { provide: AvailabilityService, useValue: { notifyChanged: vi.fn() } },
        {
          provide: CharacterService,
          useValue: {
            listByPartie: vi.fn().mockResolvedValue([]),
            getGameSystemContent: vi.fn().mockResolvedValue({}),
            changed: signal(0),
          },
        },
        { provide: ThemeToneService, useValue: makeToneService() },
        { provide: ScenariosService, useValue: makeScenariosService([]) },
        {
          provide: AnnouncementsService,
          useValue: { create: vi.fn(), listAll: vi.fn().mockResolvedValue([]), changed: signal(0) },
        },
        {
          provide: HommeDragonService,
          useValue: {
            findOne: vi.fn().mockResolvedValue(null),
            // Story 33.8 : l'onglet est un panneau d'aventure (lien fiche / associer / dissocier).
            findForPartie: vi.fn().mockResolvedValue(null),
            listMine: vi.fn().mockResolvedValue([]),
            link: vi.fn(),
            unlink: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            // Story 20.2 (Task 3) : composants Homme Dragon (rendus transitivement) réagissent à ce signal.
            changed: signal(0),
          },
        },
        {
          provide: CharacterRolesService,
          useValue: { listForPartie: vi.fn().mockResolvedValue([]), changed: signal(0) },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PartieDetail);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(
      Array.from(el.querySelectorAll('div[role="tab"]')).map((t) => t.textContent?.trim()),
    ).not.toContain('Homme Dragon');

    // Revue de code Story 18.3 : déclenche un vrai événement SSE (pas un appel direct à
    // notifyChanged()) — exerce la chaîne complète EventSource -> RealtimeService.onSignal ->
    // matchingHandlers -> PartiesService.notifyChanged() -> effect() de PartieDetail, jamais
    // couverte de bout en bout auparavant (chaque maillon n'était testé qu'isolément).
    const es = FakeEventSource.instances.find((i) => i.url.includes(initial.id));
    expect(es).toBeDefined();
    es!.emit('message');
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();

    expect(partiesSvc.get).toHaveBeenCalledTimes(2);
    expect(
      Array.from(el.querySelectorAll('div[role="tab"]')).map((t) => t.textContent?.trim()),
    ).toContain('Homme Dragon');
  });

  it('AC2 : le patch visibilitychange est retiré — un dispatch manuel ne déclenche plus aucun rechargement', async () => {
    const initial = makePartie({ ownerId: MJ_ID, gameSystemId: 'draconis' });
    const { fixture, el } = await createFixture(initial, MJ_ID);
    const partiesSvcSpy = TestBed.inject(PartiesService) as unknown as {
      get: ReturnType<typeof vi.fn>;
    };
    const callsBefore = partiesSvcSpy.get.mock.calls.length;

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();

    expect(partiesSvcSpy.get.mock.calls.length).toBe(callsBefore);
    expect(el).toBeTruthy();
  });

  it('bug fix : un CharacterService.changed() (personnage créé par un joueur) recharge le roster sans reload', async () => {
    const initial = makePartie({ ownerId: MJ_ID });
    const { fixture } = await createFixture(initial, MJ_ID);
    const characterSvc = TestBed.inject(CharacterService) as unknown as {
      listByPartie: ReturnType<typeof vi.fn>;
      changed: WritableSignal<number>;
    };
    const newCharacter = makeCharacterDto({ id: 'c1', userId: PLAYER_ID });
    characterSvc.listByPartie.mockResolvedValue([newCharacter]);
    const callsBefore = characterSvc.listByPartie.mock.calls.length;

    characterSvc.changed.set(1);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(characterSvc.listByPartie.mock.calls.length).toBe(callsBefore + 1);
  });

  it('bug fix (revue de code) : un échec réseau transitoire du rechargement de roster ne vide pas la liste affichée', async () => {
    const initial = makePartie({ ownerId: MJ_ID });
    const { fixture } = await createFixture(initial, MJ_ID);
    const characterSvc = TestBed.inject(CharacterService) as unknown as {
      listByPartie: ReturnType<typeof vi.fn>;
      changed: WritableSignal<number>;
    };
    const existing = makeCharacterDto({ id: 'c1', userId: PLAYER_ID });
    characterSvc.listByPartie.mockResolvedValueOnce([existing]);

    characterSvc.changed.set(1);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    const comp = fixture.componentInstance as unknown as { characters: () => unknown[] };
    expect(comp.characters()).toEqual([existing]);

    characterSvc.listByPartie.mockRejectedValueOnce(new Error('réseau'));
    characterSvc.changed.set(2);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(comp.characters()).toEqual([existing]);
  });

  it('charge les rôles de groupe assignés via CharacterRolesService.listForPartie (Story 27.3, AC1)', async () => {
    const partie = makePartie({ ownerId: MJ_ID });
    await createFixture(partie, MJ_ID);

    const characterRolesSvc = TestBed.inject(CharacterRolesService) as unknown as {
      listForPartie: ReturnType<typeof vi.fn>;
    };
    expect(characterRolesSvc.listForPartie).toHaveBeenCalledWith('party-1');
  });

  it('un CharacterRolesService.changed() (rôle assigné/retiré par le MJ) recharge characterRoles (Story 27.3, AC3)', async () => {
    const initial = makePartie({ ownerId: MJ_ID });
    const { fixture } = await createFixture(initial, MJ_ID);
    const characterRolesSvc = TestBed.inject(CharacterRolesService) as unknown as {
      listForPartie: ReturnType<typeof vi.fn>;
      changed: WritableSignal<number>;
    };
    const role: CharacterGroupRoleDto = {
      id: 'role1',
      characterId: 'c1',
      partieId: 'party-1',
      roleKey: 'cartographe',
      assignedAt: '2026-01-01T00:00:00.000Z',
    };
    characterRolesSvc.listForPartie.mockResolvedValue([role]);
    const callsBefore = characterRolesSvc.listForPartie.mock.calls.length;

    characterRolesSvc.changed.set(1);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(characterRolesSvc.listForPartie.mock.calls.length).toBe(callsBefore + 1);
    const comp = fixture.componentInstance as unknown as { characterRoles: () => unknown[] };
    expect(comp.characterRoles()).toEqual([role]);
  });

  it('garde firstRun : un CharacterService.changed() déjà non-nul au montage ne déclenche PAS de refetch redondant', async () => {
    const initial = makePartie({ ownerId: MJ_ID });
    await TestBed.configureTestingModule({
      imports: [PartieDetail],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => initial.id },
              queryParamMap: { get: () => null },
            },
          },
        },
        { provide: AuthService, useValue: makeAuthService(MJ_ID) },
        { provide: PartiesService, useValue: makePartiesService(initial) },
        { provide: BreakpointObserver, useValue: makeBreakpointObserver(true) },
        {
          provide: MyPartiesService,
          useValue: {
          refreshAll: vi.fn(),
          playerParties: signal([]),
          allParties: signal([]),
          loaded: signal(true),
        },
        },
        { provide: AvailabilityService, useValue: { notifyChanged: vi.fn() } },
        {
          provide: CharacterService,
          useValue: {
            listByPartie: vi.fn().mockResolvedValue([]),
            getGameSystemContent: vi.fn().mockResolvedValue({}),
            changed: signal(1),
          },
        },
        { provide: ThemeToneService, useValue: makeToneService() },
        { provide: ScenariosService, useValue: makeScenariosService() },
        {
          provide: AnnouncementsService,
          useValue: { create: vi.fn(), listAll: vi.fn().mockResolvedValue([]), changed: signal(0) },
        },
        {
          provide: CharacterRolesService,
          useValue: { listForPartie: vi.fn().mockResolvedValue([]), changed: signal(0) },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PartieDetail);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();

    const characterSvc = TestBed.inject(CharacterService) as unknown as {
      listByPartie: ReturnType<typeof vi.fn>;
    };
    expect(characterSvc.listByPartie.mock.calls.length).toBe(1);
  });

  it('bug fix : un PartiesService.changed() (invitation acceptée par un joueur) recharge la liste des membres sans reload', async () => {
    const initial = makePartie({ ownerId: MJ_ID });
    const { fixture } = await createFixture(initial, MJ_ID);
    const partiesSvc = TestBed.inject(PartiesService) as unknown as {
      members: ReturnType<typeof vi.fn>;
      notifyChanged: () => void;
    };
    const callsBefore = partiesSvc.members.mock.calls.length;

    partiesSvc.notifyChanged();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
    fixture.detectChanges();

    expect(partiesSvc.members.mock.calls.length).toBe(callsBefore + 1);
  });
});

// ─── Alerte d'homonymie (Story 28.3, AC1/AC2) ─────────────────────────────

describe("PartieDetail — alerte d'homonymie", () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  it('deux membres avec le même displayName → avertissement visible (AC1)', async () => {
    const members: PartieMemberDto[] = [
      {
        role: 'MEMBER',
        userId: PLAYER_ID,
        pseudo: 'Alice',
        displayName: 'Même Nom',
        email: 'a@test.com',
        joinedAt: '',
      },
      {
        role: 'MEMBER',
        userId: 'other',
        pseudo: 'Bob',
        displayName: 'Même Nom',
        email: 'b@test.com',
        joinedAt: '',
      },
    ];
    const { el } = await createFixture(makePartie(), PLAYER_ID, {
      members,
      displayName: 'Même Nom',
    });
    expect(el.querySelector('.homonymy-warning')).toBeTruthy();
  });

  it("Revue de code : le bandeau porte role=alert et aria-live=polite (annoncé aux lecteurs d'écran)", async () => {
    const members: PartieMemberDto[] = [
      {
        role: 'MEMBER',
        userId: PLAYER_ID,
        pseudo: 'Alice',
        displayName: 'Même Nom',
        email: 'a@test.com',
        joinedAt: '',
      },
      {
        role: 'MEMBER',
        userId: 'other',
        pseudo: 'Bob',
        displayName: 'Même Nom',
        email: 'b@test.com',
        joinedAt: '',
      },
    ];
    const { el } = await createFixture(makePartie(), PLAYER_ID, {
      members,
      displayName: 'Même Nom',
    });
    const banner = el.querySelector('.homonymy-warning');
    expect(banner?.getAttribute('role')).toBe('alert');
    expect(banner?.getAttribute('aria-live')).toBe('polite');
  });

  it('le displayName du joueur courant identique à celui du MJ (absent de members()) → avertissement visible (AC1)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, ownerDisplayName: 'Même Nom' });
    const members: PartieMemberDto[] = [
      {
        role: 'MEMBER',
        userId: PLAYER_ID,
        pseudo: 'Alice',
        displayName: 'Même Nom',
        email: 'a@test.com',
        joinedAt: '',
      },
    ];
    const { el } = await createFixture(partie, PLAYER_ID, {
      members,
      displayName: 'Même Nom',
    });
    expect(el.querySelector('.homonymy-warning')).toBeTruthy();
  });

  it('aucun homonyme → aucun avertissement', async () => {
    const members: PartieMemberDto[] = [
      {
        role: 'MEMBER',
        userId: PLAYER_ID,
        pseudo: 'Alice',
        displayName: 'Alice',
        email: 'a@test.com',
        joinedAt: '',
      },
      {
        role: 'MEMBER',
        userId: 'other',
        pseudo: 'Bob',
        displayName: 'Bob',
        email: 'b@test.com',
        joinedAt: '',
      },
    ];
    const { el } = await createFixture(makePartie(), PLAYER_ID, {
      members,
      displayName: 'Alice',
    });
    expect(el.querySelector('.homonymy-warning')).toBeFalsy();
  });

  it('clic "Ignorer" → l\'avertissement disparaît et sessionStorage est écrit avec la bonne clé (AC2)', async () => {
    const members: PartieMemberDto[] = [
      {
        role: 'MEMBER',
        userId: PLAYER_ID,
        pseudo: 'Alice',
        displayName: 'Même Nom',
        email: 'a@test.com',
        joinedAt: '',
      },
      {
        role: 'MEMBER',
        userId: 'other',
        pseudo: 'Bob',
        displayName: 'Même Nom',
        email: 'b@test.com',
        joinedAt: '',
      },
    ];
    const { fixture, el } = await createFixture(makePartie(), PLAYER_ID, {
      members,
      displayName: 'Même Nom',
    });
    expect(el.querySelector('.homonymy-warning')).toBeTruthy();

    const dismissBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.closest('.homonymy-warning'),
    ) as HTMLButtonElement;
    dismissBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.homonymy-warning')).toBeFalsy();
    expect(sessionStorage.getItem(`homonymy-dismissed:party-1:${PLAYER_ID}`)).toBe('1');
  });

  it("rechargement avec la clé déjà en sessionStorage → avertissement absent même si l'homonymie existe (AC2)", async () => {
    sessionStorage.setItem(`homonymy-dismissed:party-1:${PLAYER_ID}`, '1');
    const members: PartieMemberDto[] = [
      {
        role: 'MEMBER',
        userId: PLAYER_ID,
        pseudo: 'Alice',
        displayName: 'Même Nom',
        email: 'a@test.com',
        joinedAt: '',
      },
      {
        role: 'MEMBER',
        userId: 'other',
        pseudo: 'Bob',
        displayName: 'Même Nom',
        email: 'b@test.com',
        joinedAt: '',
      },
    ];
    const { el } = await createFixture(makePartie(), PLAYER_ID, {
      members,
      displayName: 'Même Nom',
    });
    expect(el.querySelector('.homonymy-warning')).toBeFalsy();
  });
});

// ─── Pseudo en complément dans les écrans sans personnage (Story 28.3, AC3) ────

describe('PartieDetail — pseudo en complément (gestion des membres)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('gestion des membres (onglet Invitations) : membres homonymes → pseudo affiché', async () => {
    // Revue de code : le MJ n'apparaît jamais dans `members()` — seuls des joueurs réels ici.
    const members: PartieMemberDto[] = [
      {
        role: 'MEMBER',
        userId: PLAYER_ID,
        pseudo: 'Alice',
        displayName: 'Même Nom',
        email: 'alice@test.com',
        joinedAt: '',
      },
      {
        role: 'MEMBER',
        userId: 'p2',
        pseudo: 'Bob',
        displayName: 'Même Nom',
        email: 'bob@test.com',
        joinedAt: '',
      },
    ];
    const { fixture, el } = await createFixture(makePartie(), MJ_ID, {
      members,
      noopAnimations: true,
    });

    const tabLabels = el.querySelectorAll<HTMLElement>('div[role="tab"]');
    const invitationsTab = Array.from(tabLabels).find((t) =>
      t.textContent?.includes(GRIMOIRE_TONE['partie.invitations_tab_label']),
    );
    invitationsTab?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const pseudos = el.querySelectorAll('.invite .identity-label__pseudo');
    expect(pseudos.length).toBe(2);
  });

  it("Revue de code (2026-08-06) : le badge « MJ » est toujours affiché sur l'auteur d'une annonce campagne", async () => {
    const partie = makePartie({ ownerId: MJ_ID, kind: 'CAMPAGNE_LINEAIRE' });
    const { el } = await createFixture(partie, PLAYER_ID, {
      announcements: [makeAnnouncementDto({ scenarioId: null, authorDisplayName: 'MJ Nom' })],
    });

    const badge = el.querySelector('.announcements-feed .annonce-card__mj-badge');
    expect(badge).toBeTruthy();
    expect(badge!.textContent?.trim()).toBe('MJ');
  });
});

describe('PartieDetail — bandeau contextuel (Story 29.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('le sous-titre porte le système de jeu et le type de partie (correction post-test)', async () => {
    const partie = makePartie({
      ownerId: MJ_ID,
      name: 'Les Cendres de Kavaan',
      gameSystemId: 'draconis',
      kind: 'ONE_SHOT',
    });
    await createFixture(partie, MJ_ID);

    const contextualNav = TestBed.inject(ContextualNavService);
    expect(contextualNav.title()).toBe('Les Cendres de Kavaan');
    expect(contextualNav.subtitle()).toBe(`Draconis · ${GRIMOIRE_TONE['partie.kind_ONE_SHOT']}`);
  });

  it('le sous-titre est identique pour le MJ et pour un joueur (plus de rôle dans le bandeau)', async () => {
    const partie = makePartie({
      ownerId: MJ_ID,
      name: 'Les Cendres de Kavaan',
      gameSystemId: 'draconis',
      kind: 'ONE_SHOT',
    });
    await createFixture(partie, PLAYER_ID);

    const contextualNav = TestBed.inject(ContextualNavService);
    expect(contextualNav.title()).toBe('Les Cendres de Kavaan');
    expect(contextualNav.subtitle()).toBe(`Draconis · ${GRIMOIRE_TONE['partie.kind_ONE_SHOT']}`);
  });
});

// ─── Clôture explicite d'une partie (Story 29.6) ──────────────────────────

describe('PartieDetail — clôture explicite (Story 29.6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('le MJ voit le bouton "Clôturer" quand status !== TERMINEE, jamais "Rouvrir"', async () => {
    const partie = makePartie({ ownerId: MJ_ID, status: 'EN_COURS' });
    const { el } = await createFixture(partie, MJ_ID);
    const actions = el.querySelector('mat-card-actions');
    expect(actions!.textContent).toContain('Clore le grimoire');
    expect(actions!.textContent).not.toContain('Rouvrir le grimoire');
  });

  it('le MJ voit le bouton "Rouvrir" quand status === TERMINEE, jamais "Clôturer"', async () => {
    const partie = makePartie({ ownerId: MJ_ID, status: 'TERMINEE' });
    const { el } = await createFixture(partie, MJ_ID);
    const actions = el.querySelector('mat-card-actions');
    expect(actions!.textContent).toContain('Rouvrir le grimoire');
    expect(actions!.textContent).not.toContain('Clore le grimoire');
  });

  it('un joueur ne voit ni le bouton "Clôturer" ni "Rouvrir" (actions MJ-only)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, status: 'EN_COURS' });
    const { el } = await createFixture(partie, PLAYER_ID);
    const actions = el.querySelector('mat-card-actions');
    expect(actions?.textContent ?? '').not.toContain('Clore le grimoire');
    expect(actions?.textContent ?? '').not.toContain('Rouvrir le grimoire');
  });

  it('clic sur "Clôturer" appelle PartiesService.close et met à jour partie() avec la réponse', async () => {
    const partie = makePartie({ ownerId: MJ_ID, status: 'EN_COURS' });
    const { fixture, el } = await createFixture(partie, MJ_ID);
    const parties = TestBed.inject(PartiesService) as unknown as {
      close: ReturnType<typeof vi.fn>;
    };

    const buttons = Array.from(el.querySelectorAll('mat-card-actions button'));
    const closeBtn = buttons.find((b) => b.textContent?.includes('Clore le grimoire')) as
      HTMLButtonElement | undefined;
    expect(closeBtn).toBeTruthy();
    closeBtn!.click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(parties.close).toHaveBeenCalledWith('party-1');
    const component = fixture.componentInstance;
    expect((component as unknown as { partie: () => { status: string } }).partie().status).toBe(
      'TERMINEE',
    );
  });

  it('clic sur "Rouvrir" appelle PartiesService.reopen et met à jour partie() avec la réponse', async () => {
    const partie = makePartie({ ownerId: MJ_ID, status: 'TERMINEE' });
    const { fixture, el } = await createFixture(partie, MJ_ID);
    const parties = TestBed.inject(PartiesService) as unknown as {
      reopen: ReturnType<typeof vi.fn>;
    };

    const buttons = Array.from(el.querySelectorAll('mat-card-actions button'));
    const reopenBtn = buttons.find((b) => b.textContent?.includes('Rouvrir le grimoire')) as
      HTMLButtonElement | undefined;
    expect(reopenBtn).toBeTruthy();
    reopenBtn!.click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(parties.reopen).toHaveBeenCalledWith('party-1');
    const component = fixture.componentInstance;
    expect((component as unknown as { partie: () => { status: string } }).partie().status).toBe(
      'EN_COURS',
    );
  });

  it('le bandeau "partie terminée" est visible pour un joueur (pas seulement le MJ) quand status === TERMINEE', async () => {
    const partie = makePartie({ ownerId: MJ_ID, status: 'TERMINEE' });
    const { el } = await createFixture(partie, PLAYER_ID);
    expect(el.querySelector('.closed-banner')).toBeTruthy();
  });

  it('le bandeau "partie terminée" est absent quand status !== TERMINEE', async () => {
    const partie = makePartie({ ownerId: MJ_ID, status: 'EN_COURS' });
    const { el } = await createFixture(partie, MJ_ID);
    expect(el.querySelector('.closed-banner')).toBeFalsy();
  });
});

// ─── Story 32.2 : regroupement de l'onglet Détails en trois zones (Action/Consultation/Référence) ───

describe('PartieDetail — zones de l’onglet Détails (Story 32.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const ZONE_ACTION = '.details-zone--action';
  const ZONE_CONSULTATION = '.details-zone--consultation';
  const ZONE_REFERENCE = '.details-zone--reference';

  it('les trois titres de zone (Action/Consultation/Référence) sont rendus, thématisés via theme.tone()', async () => {
    const { el } = await createFixture(
      makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' }),
      MJ_ID,
    );

    const tone = TONE_MAP['grimoire-emeraude'];
    expect(el.querySelector(`${ZONE_ACTION} .details-zone__title`)?.textContent?.trim()).toBe(
      tone['partie.details_zone_action'],
    );
    expect(el.querySelector(`${ZONE_CONSULTATION} .details-zone__title`)?.textContent?.trim()).toBe(
      tone['partie.details_zone_consultation'],
    );
    expect(el.querySelector(`${ZONE_REFERENCE} .details-zone__title`)?.textContent?.trim()).toBe(
      tone['partie.details_zone_reference'],
    );
  });

  // Revue de code (Story 32.2) : l'ordre des zones est posé une fois pour toutes par le template
  // (aucune logique ne le fait dépendre d'isDesktop()) — un seul test paramétré sur desktop/mobile
  // documente que ce même ordre statique tient dans les deux gabarits, sans prétendre vérifier une
  // garantie mobile-spécifique qui n'existe pas dans le code (AC3 porte sur le CSS, pas sur l'ordre
  // DOM, qui est identique quel que soit isDesktop()).
  it.each([true, false])(
    'la zone Action précède la zone Consultation, elle-même avant la zone Référence, dans le flux du DOM (desktop=%s)',
    async (desktop) => {
      const { el } = await createFixture(
        makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' }),
        MJ_ID,
        {
          desktop,
        },
      );

      const zones = Array.from(el.querySelectorAll('.details-zone'));
      expect(zones.length).toBe(3);
      const classNames = zones.map((z) => z.className);
      const actionIndex = classNames.findIndex((c) => c.includes('details-zone--action'));
      const consultationIndex = classNames.findIndex((c) =>
        c.includes('details-zone--consultation'),
      );
      const referenceIndex = classNames.findIndex((c) => c.includes('details-zone--reference'));

      expect(actionIndex).toBe(0);
      expect(actionIndex).toBeLessThan(consultationIndex);
      expect(consultationIndex).toBeLessThan(referenceIndex);
    },
  );

  it('MJ, système Ryuutama : la zone Action porte le widget séance, la distribution d’XP et la publication d’annonce', async () => {
    const { el } = await createFixture(
      makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' }),
      MJ_ID,
    );

    const action = el.querySelector(ZONE_ACTION)!;
    expect(action.querySelector('.scheduling-widget')).toBeTruthy();
    expect(action.querySelector('.xp-section')).toBeTruthy();
    expect(action.querySelector('.announcement-section')).toBeTruthy();
    // L'historique d'XP n'est plus dans la zone Action (extrait vers Consultation).
    expect(action.querySelector('app-xp-history')).toBeNull();
  });

  it('MJ, système Ryuutama : la zone Consultation porte le fil d’annonces et l’historique d’XP (extrait de la zone Action)', async () => {
    const announcements = [makeAnnouncementDto({ id: 'ann-1', scenarioId: null })];
    const { el } = await createFixture(
      makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', kind: 'CAMPAGNE_LINEAIRE' }),
      MJ_ID,
      { announcements },
    );

    const consultation = el.querySelector(ZONE_CONSULTATION)!;
    expect(consultation.querySelector('.announcements-feed')).toBeTruthy();
    expect(consultation.querySelector('app-xp-history')).toBeTruthy();
  });

  it('MJ, système Ryuutama : la zone Référence porte la description, les fiches de référence et les fiches de préparation', async () => {
    const { el } = await createFixture(
      makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', description: 'Un récit à découvrir' }),
      MJ_ID,
    );

    const reference = el.querySelector(ZONE_REFERENCE)!;
    expect(reference.textContent).toContain('Un récit à découvrir');
    expect(reference.querySelector('.reference-sheets')).toBeTruthy();
    expect(reference.querySelector('.prep-sheets')).toBeTruthy();
  });

  it('Joueur (non-MJ) : la zone Action est réduite au widget séance, aucun bloc MJ-only dans Consultation/Référence', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { el } = await createFixture(partie, PLAYER_ID);

    const action = el.querySelector(ZONE_ACTION)!;
    expect(action.querySelector('.scheduling-widget')).toBeTruthy();
    expect(action.querySelector('.xp-section')).toBeNull();
    expect(action.querySelector('.announcement-section')).toBeNull();

    // Revue de code (Story 32.2) : sans annonce de campagne ni bandeau transitoire, un joueur non-MJ
    // n'a aucun contenu de zone Consultation (isMj() faux ⇒ pas d'historique d'XP non plus) — la
    // zone entière est absente (hasConsultationContent()), pas seulement vide de bloc MJ-only.
    expect(el.querySelector(ZONE_CONSULTATION)).toBeNull();

    const reference = el.querySelector(ZONE_REFERENCE)!;
    // Les fiches de référence Ryuutama restent visibles au joueur (pas MJ-only) ; seules les fiches
    // de préparation sont MJ-only.
    expect(reference.querySelector('.reference-sheets')).toBeTruthy();
    expect(reference.querySelector('.prep-sheets')).toBeNull();
  });

  it('Système non-Ryuutama : les fiches de référence/préparation sont absentes de la zone Référence, les zones Action/Consultation restent intactes', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'draconis' });
    const { el } = await createFixture(partie, MJ_ID);

    const reference = el.querySelector(ZONE_REFERENCE)!;
    expect(reference.querySelector('.reference-sheets')).toBeNull();
    expect(reference.querySelector('.prep-sheets')).toBeNull();

    const action = el.querySelector(ZONE_ACTION)!;
    expect(action.querySelector('.scheduling-widget')).toBeTruthy();
    expect(action.querySelector('.xp-section')).toBeTruthy();
    expect(action.querySelector('.announcement-section')).toBeTruthy();
  });

  it('Vote de date en cours : le lien de vote reste dans le widget séance de la zone Action, inchangé', async () => {
    const partie = makePartie({ ownerId: MJ_ID });
    const poll: SessionPollDto = {
      id: 'poll1',
      partieId: 'party-1',
      status: 'OPEN',
      scenarioRef: null,
      expiresAt: null,
      chosenDate: null,
      chosenSlot: null,
      membersCount: 2,
      durationSlots: 1,
      options: [
        {
          id: 'opt1',
          date: '2026-08-01T00:00:00.000Z',
          slot: 'MORNING',
          votes: [],
        },
      ],
    };
    const { el } = await createFixture(partie, PLAYER_ID, { poll });

    const link = el.querySelector(`${ZONE_ACTION} .scheduling-widget a[mat-stroked-button]`);
    expect(link).toBeTruthy();
    expect(link!.textContent).toContain('Vote de date en cours');
  });
});

// ─── Retouche UX de PartieDetail (scroll, aération, fiches de téléchargement, 2026-09-23) ────────

describe('PartieDetail — défilement de page unique (dynamicHeight)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("mat-tab-group porte dynamicHeight (API publique Material) -- l'overflow interne par défaut du corps d'onglet est neutralisé, la molette défile toute la page", async () => {
    const { fixture } = await createFixture(makePartie({ ownerId: MJ_ID }), MJ_ID);

    const tabGroup = fixture.debugElement.query(By.directive(MatTabGroup))?.componentInstance as
      MatTabGroup | undefined;
    expect(tabGroup).toBeTruthy();
    expect(tabGroup!.dynamicHeight).toBe(true);
  });
});

describe('PartieDetail — grimoires de référence/préparation repliés par défaut (retouche UX 2026-09-23)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('à l’affichage initial de l’onglet Détails, les deux grimoires (référence, préparation MJ) sont repliés', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { el } = await createFixture(partie, MJ_ID);

    const referenceDetails = el.querySelector<HTMLDetailsElement>(
      '.reference-sheets details.download-sheet',
    );
    const prepDetails = el.querySelector<HTMLDetailsElement>('.prep-sheets details.download-sheet');
    expect(referenceDetails).toBeTruthy();
    expect(prepDetails).toBeTruthy();
    expect(referenceDetails!.open).toBe(false);
    expect(prepDetails!.open).toBe(false);
  });

  it('un joueur (non-MJ) voit aussi le grimoire de référence replié par défaut (les fiches de préparation restent MJ-only, inchangé)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { el } = await createFixture(partie, PLAYER_ID);

    const referenceDetails = el.querySelector<HTMLDetailsElement>(
      '.reference-sheets details.download-sheet',
    );
    expect(referenceDetails).toBeTruthy();
    expect(referenceDetails!.open).toBe(false);
    expect(el.querySelector('.prep-sheets')).toBeNull();
  });

  it('clic sur le résumé « Grimoires de référence » déplie la fiche -- les puces (icône+libellé) deviennent visibles', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { fixture, el } = await createFixture(partie, MJ_ID);

    const details = el.querySelector<HTMLDetailsElement>(
      '.reference-sheets details.download-sheet',
    )!;
    const summary = details.querySelector<HTMLElement>('summary')!;
    expect(details.open).toBe(false);

    summary.click();
    fixture.detectChanges();

    expect(details.open).toBe(true);
    const chips = details.querySelectorAll('.reference-sheets__links .dl-chip');
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toContain(
      TONE_MAP['grimoire-emeraude']['partie.asset_journal_cta'],
    );
  });

  it('clic sur le résumé « Grimoires de préparation (MJ) » déplie la fiche -- les 8 puces deviennent visibles', async () => {
    const partie = makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' });
    const { fixture, el } = await createFixture(partie, MJ_ID);

    const details = el.querySelector<HTMLDetailsElement>('.prep-sheets details.download-sheet')!;
    const summary = details.querySelector<HTMLElement>('summary')!;
    expect(details.open).toBe(false);

    summary.click();
    fixture.detectChanges();

    expect(details.open).toBe(true);
    expect(details.querySelectorAll('.prep-sheets__links .dl-chip').length).toBe(8);
  });
});

describe('PartieDetail — barre d’icônes partagée (retouche UX 2026-09-23)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('MJ : les déclencheurs "Distribuer de l’XP" et "Proclamer une annonce" partagent la même barre d’icônes', async () => {
    const { el } = await createFixture(makePartie({ ownerId: MJ_ID }), MJ_ID);

    const bar = el.querySelector('.details-zone--action .icon-bar');
    expect(bar).toBeTruthy();
    expect(bar!.querySelector('.xp-section button')).toBeTruthy();
    expect(bar!.querySelector('.announcement-section button')).toBeTruthy();
  });

  it('le pied de carte (Retranscrire/Sceller/Clore/Supprimer) est une barre d’icônes -- "Supprimer" porte la classe de couleur destructrice', async () => {
    const { el } = await createFixture(makePartie({ ownerId: MJ_ID, status: 'EN_COURS' }), MJ_ID);

    const actions = el.querySelector('mat-card-actions.icon-bar');
    expect(actions).toBeTruthy();

    // Vérification visuelle réelle (bmad-build, 2026-09-23) : `color="warn"` sur `mat-button` n'a
    // aucun effet en theming M3 (documenté par Angular Material — « supported in M2 themes only »).
    // La classe `icon-bar__btn--danger` référence directement `--mat-sys-error` (patron déjà en
    // place ailleurs dans ce composant, `.notice.error`) ; c'est elle que ce test vérifie, pas
    // l'attribut `color` désormais retiré du bouton.
    const deleteButton = Array.from(el.querySelectorAll('mat-card-actions.icon-bar button')).find(
      (b) => b.textContent?.includes(TONE_MAP['grimoire-emeraude']['partie.delete_btn']),
    );
    expect(deleteButton).toBeTruthy();
    expect(deleteButton!.classList.contains('icon-bar__btn--danger')).toBe(true);
  });

  it('suppression confirmée : supprime la partie puis recharge la liste des parties (refreshAll, Story 38.5)', async () => {
    const partie = makePartie({ ownerId: MJ_ID, status: 'EN_COURS' });
    const { fixture } = await createFixture(partie, MJ_ID);
    const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    const parties = TestBed.inject(PartiesService) as unknown as {
      remove: ReturnType<typeof vi.fn>;
    };
    const myParties = TestBed.inject(MyPartiesService) as unknown as {
      refreshAll: ReturnType<typeof vi.fn>;
    };

    await fixture.componentInstance.confirmDelete(partie);

    expect(parties.remove).toHaveBeenCalledWith(partie.id);
    expect(myParties.refreshAll).toHaveBeenCalledTimes(1);
  });

  it('suppression annulée : ni suppression ni rechargement', async () => {
    const partie = makePartie({ ownerId: MJ_ID, status: 'EN_COURS' });
    const { fixture } = await createFixture(partie, MJ_ID);
    const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });
    const myParties = TestBed.inject(MyPartiesService) as unknown as {
      refreshAll: ReturnType<typeof vi.fn>;
    };

    await fixture.componentInstance.confirmDelete(partie);

    expect(myParties.refreshAll).not.toHaveBeenCalled();
  });
});

describe('PartieDetail — patron de carte à liseré, revue de code (retouche UX 2026-09-23)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('MJ, système Ryuutama : app-xp-history et chaque app-annonce-card reçoivent les classes de carte de la zone Consultation', async () => {
    const announcements = [makeAnnouncementDto({ id: 'ann-1', scenarioId: null })];
    const { el } = await createFixture(
      makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama', kind: 'CAMPAGNE_LINEAIRE' }),
      MJ_ID,
      { announcements },
    );

    const xpHistory = el.querySelector('app-xp-history');
    expect(xpHistory).toBeTruthy();
    expect(xpHistory!.classList.contains('zone-card')).toBe(true);
    expect(xpHistory!.classList.contains('zone-card--consultation')).toBe(true);

    const annonceCard = el.querySelector('app-annonce-card');
    expect(annonceCard).toBeTruthy();
    expect(annonceCard!.classList.contains('zone-card')).toBe(true);
    expect(annonceCard!.classList.contains('zone-card--consultation')).toBe(true);
    expect(annonceCard!.classList.contains('zone-card--flush')).toBe(true);
  });

  it('la description de la partie (zone Référence) reçoit le même patron de carte à liseré que les deux autres zones', async () => {
    const { el } = await createFixture(
      makePartie({ ownerId: MJ_ID, description: 'Un récit à découvrir' }),
      MJ_ID,
    );

    const reference = el.querySelector('.details-zone--reference .zone-card--reference');
    expect(reference).toBeTruthy();
    expect(reference!.textContent).toContain('Un récit à découvrir');
  });
});

describe('PartieDetail — ralliement, garde minimale (Story 38.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const ralliement = (over: Partial<PartieDto> = {}) =>
    makePartie({
      gameSystemId: 'ralliement',
      kind: 'CAMPAGNE_EPISODIQUE',
      role: 'admin',
      ...over,
    });

  it('un ralliement fraîchement créé ne déclenche aucune lecture liée à une capacité JDR', async () => {
    const { el } = await createFixture(ralliement(), MJ_ID);

    const characterSvc = TestBed.inject(CharacterService) as unknown as {
      listByPartie: ReturnType<typeof vi.fn>;
      getGameSystemContent: ReturnType<typeof vi.fn>;
    };
    const scenariosSvc = TestBed.inject(ScenariosService) as unknown as {
      listAll: ReturnType<typeof vi.fn>;
    };
    const announcementsSvc = TestBed.inject(AnnouncementsService) as unknown as {
      listAll: ReturnType<typeof vi.fn>;
    };
    const rolesSvc = TestBed.inject(CharacterRolesService) as unknown as {
      listForPartie: ReturnType<typeof vi.fn>;
    };
    const partiesSvc = TestBed.inject(PartiesService) as unknown as {
      inviteLinks: ReturnType<typeof vi.fn>;
      listXpDistributions: ReturnType<typeof vi.fn>;
    };
    expect(characterSvc.listByPartie).not.toHaveBeenCalled();
    expect(characterSvc.getGameSystemContent).not.toHaveBeenCalled();
    expect(scenariosSvc.listAll).not.toHaveBeenCalled();
    expect(announcementsSvc.listAll).not.toHaveBeenCalled();
    expect(rolesSvc.listForPartie).not.toHaveBeenCalled();
    // Son créateur y est admin, jamais MJ : pas d'historique d'XP. Groupe (Story 39.3) : l'admin
    // charge les liens d'invitation de « Missives ».
    expect(partiesSvc.inviteLinks).toHaveBeenCalledWith('party-1');
    expect(partiesSvc.listXpDistributions).not.toHaveBeenCalled();
    expect(el.querySelector('app-scenario-timeline')).toBeNull();
    expect(el.querySelector('app-scenario-list')).toBeNull();
  });

  it('l’admin d’une rencontre isolée garde l’accès à la modification et peut la clore (Story 41.4), sans suppression', async () => {
    const { el } = await createFixture(ralliement({ kind: 'ONE_SHOT' }), MJ_ID);
    const links = Array.from(el.querySelectorAll('.icon-bar a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/parties/party-1/edit']);
    // Story 41.4 : « Clore » seulement — ni « Brûler » ni « Quitter l'office » (annuler : epic 42).
    expect(Array.from(el.querySelectorAll('.icon-bar button')).map((b) => (b.textContent ?? '').trim())).toEqual([
      expect.stringContaining(TONE_MAP['grimoire-emeraude']['partie.close_btn']),
    ]);
  });

  /** Fait émettre les signaux temps réel des services de domaine, puis laisse les effets s'exécuter. */
  async function bumpRealtime(fixture: ComponentFixture<PartieDetail>) {
    const bump = (token: unknown, value: unknown) =>
      (TestBed.inject(token as never) as { changed: WritableSignal<unknown> }).changed.set(value);
    bump(CharacterService, 1);
    bump(AnnouncementsService, 1);
    bump(CharacterRolesService, 1);
    bump(ScenariosService, { partieId: 'party-1' });
    for (let i = 0; i < 15; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    await fixture.whenStable();
  }

  const readCounts = () => {
    const characterSvc = TestBed.inject(CharacterService) as unknown as {
      listByPartie: ReturnType<typeof vi.fn>;
    };
    const announcementsSvc = TestBed.inject(AnnouncementsService) as unknown as {
      listAll: ReturnType<typeof vi.fn>;
    };
    const rolesSvc = TestBed.inject(CharacterRolesService) as unknown as {
      listForPartie: ReturnType<typeof vi.fn>;
    };
    const scenariosSvc = TestBed.inject(ScenariosService) as unknown as {
      listAll: ReturnType<typeof vi.fn>;
    };
    return {
      characters: characterSvc.listByPartie.mock.calls.length,
      announcements: announcementsSvc.listAll.mock.calls.length,
      roles: rolesSvc.listForPartie.mock.calls.length,
      scenarios: scenariosSvc.listAll.mock.calls.length,
    };
  };

  it('ralliement : les signaux temps réel ne rechargent ni personnages, ni annonces, ni rôles, ni scénarios (votes actifs compris)', async () => {
    const { fixture } = await createFixture(ralliement(), MJ_ID);
    expect(readCounts()).toEqual({ characters: 0, announcements: 0, roles: 0, scenarios: 0 });

    await bumpRealtime(fixture);

    expect(readCounts()).toEqual({ characters: 0, announcements: 0, roles: 0, scenarios: 0 });
  });

  it('témoin : sur une quête, les mêmes signaux déclenchent bien ces rechargements', async () => {
    const { fixture } = await createFixture(makePartie(), MJ_ID);
    const before = readCounts();

    await bumpRealtime(fixture);

    const after = readCounts();
    expect(after.characters).toBeGreaterThan(before.characters);
    expect(after.announcements).toBeGreaterThan(before.announcements);
    expect(after.roles).toBeGreaterThan(before.roles);
    expect(after.scenarios).toBeGreaterThan(before.scenarios);
  });

  it('une quête garde son comportement : lectures JDR effectuées', async () => {
    await createFixture(makePartie(), MJ_ID);
    const characterSvc = TestBed.inject(CharacterService) as unknown as {
      listByPartie: ReturnType<typeof vi.fn>;
    };
    expect(characterSvc.listByPartie).toHaveBeenCalledWith('party-1');
  });
});

// ─── Page d'un ralliement selon sa famille (Story 38.4) ────────────────────────────────────

describe('PartieDetail — page d’un ralliement selon sa famille (Story 38.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const OTHER_ID = 'member-2';
  // Story 39.1 : un groupe (CAMPAGNE_EPISODIQUE) s'ouvre sur ses conjonctions (describe dédié plus
  // bas). Story 41.1 ⚠️ : la rencontre isolée (ONE_SHOT, fixture par défaut ci-dessous) perd « Détails »
  // au profit du détail en ligne de son événement ; les cas qui parlent de « Détails » prennent un groupe.
  const ralliement = (over: Partial<PartieDto> = {}) =>
    makePartie({
      gameSystemId: 'ralliement',
      kind: 'ONE_SHOT',
      role: 'admin',
      description: 'Un soir de partage',
      ...over,
    });
  const members: PartieMemberDto[] = [
    {
      role: 'MEMBER',
      userId: MJ_ID,
      pseudo: 'createur',
      displayName: 'Créateur',
      joinedAt: '2026-10-01T00:00:00Z',
    },
    {
      role: 'MEMBER',
      userId: OTHER_ID,
      pseudo: 'membre',
      displayName: 'Membre Deux',
      joinedAt: '2026-10-02T00:00:00Z',
    },
  ];
  const tabLabels = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).map((t) =>
      (t.textContent ?? '').trim(),
    );
  /** Mots interdits hors JDR (UX-DR17), quel que soit le thème — constante partagée avec le registre. */
  const BANNED = NON_JDR_BANNED_WORDS;
  const openMissives = (el: HTMLElement, fixture: ComponentFixture<PartieDetail>) => {
    el.querySelectorAll<HTMLElement>('div[role="tab"]')[1].click();
    fixture.detectChanges();
  };

  it.each([
    ['admin', MJ_ID, 'admin'],
    ['membre', OTHER_ID, 'member'],
  ] as const)('%s : quatre onglets : Conjonctions, Reliques, Détails puis Missives', async (_nom, userId, role) => {
    // Story 41.1 ⚠️ : la soirée isolée (ONE_SHOT) a ses propres onglets (describe dédié plus bas) ;
    // « Détails puis Missives » est ici celui d'un groupe, après ses Conjonctions.
    const { el } = await createFixture(ralliement({ role, kind: 'CAMPAGNE_EPISODIQUE' }), userId, {
      members,
    });
    const tone = TONE_MAP['grimoire-emeraude'];
    expect(tabLabels(el)).toEqual([
      tone['partie.ralliement_conjonctions_tab'],
      tone['event_games.tab'],
      tone['parties.detail_tab_details'],
      tone['partie.invitations_tab_label'],
    ]);
  });

  it('Détails : la description seule, ni widget de séance, ni calendrier, ni vote, ni XP', async () => {
    const { fixture, el } = await createFixture(
      ralliement({ kind: 'CAMPAGNE_EPISODIQUE' }),
      MJ_ID,
      { members, noopAnimations: true },
    );
    el.querySelectorAll<HTMLElement>('div[role="tab"]')[2].click();
    fixture.detectChanges();
    expect(
      el.querySelector('.details-zone--reference .zone-card--reference')?.textContent,
    ).toContain('Un soir de partage');
    expect(el.querySelector('.scheduling-widget')).toBeNull();
    expect(el.querySelector('.details-zone--action')).toBeNull();
    expect(el.querySelector('.details-zone--consultation')).toBeNull();
    expect(el.querySelector('.xp-section')).toBeNull();
    expect(el.querySelector('.announcement-section')).toBeNull();
    expect(el.querySelector('app-status-badge')).toBeNull();
    expect(el.querySelector('a[href$="/guild-calendar"], a[href$="/calendar"]')).toBeNull();
    const tone = TONE_MAP['grimoire-emeraude'];
    for (const key of [
      'partie.scheduling_title',
      'partie.no_session',
      'cta.guild_calendar',
      'poll.vote_pending',
    ]) {
      expect(el.textContent).not.toContain(tone[key]);
    }
  });

  it('l’admin garde le seul lien Modifier au pied de carte ; un membre n’en a aucun', async () => {
    const admin = await createFixture(ralliement(), MJ_ID, { members });
    expect(
      Array.from(admin.el.querySelectorAll('.icon-bar a')).map((a) => a.getAttribute('href')),
    ).toEqual(['/parties/party-1/edit']);
    TestBed.resetTestingModule();

    const member = await createFixture(ralliement({ role: 'member' }), OTHER_ID, { members });
    expect(member.el.querySelector('.icon-bar a')).toBeNull();
    expect(member.el.querySelector('.icon-bar button')).toBeNull();
  });

  // Story 41.3 : l'hôte (administrateur) d'une soirée a des outils d'invitation (describe dédié) ; seul un invité
  // lit la liste sans aucune gestion.
  it.each([['membre', OTHER_ID, 'member']] as const)(
    '%s : Missives liste chaque membre une fois (créateur compris), sans aucune gestion',
    async (_nom, userId, role) => {
      const { fixture, el } = await createFixture(ralliement({ role }), userId, {
        members,
        noopAnimations: true,
      });
      openMissives(el, fixture);

      const rows = Array.from(el.querySelectorAll('.ralliement-members .result-row')).map((r) =>
        (r.textContent ?? '').trim(),
      );
      expect(rows).toEqual(['Créateur', 'Membre Deux']);
      const panel = el.querySelector('.ralliement-members') as HTMLElement;
      const tone = TONE_MAP['grimoire-emeraude'];
      expect(panel.querySelector('h3')?.textContent).toContain(tone['partie.members_title']);
      // Story 48.3 : seul le nom d'un AUTRE membre est un bouton (sa Ludothèque) — aucune gestion.
      expect(panel.querySelector('button:not(.library-open)')).toBeNull();
      expect(panel.querySelector('input')).toBeNull();
      expect(panel.querySelector('mat-form-field')).toBeNull();
      expect(panel.querySelector('.link-row')).toBeNull();
      expect(panel.textContent).not.toContain(tone['partie.remove_member_btn']);
    },
  );

  it('Missives : deux membres homonymes sont départagés par leur pseudo', async () => {
    const homonymes: PartieMemberDto[] = [
      {
        role: 'MEMBER',
        userId: MJ_ID,
        pseudo: 'alice',
        displayName: 'Même Nom',
        joinedAt: '2026-10-01T00:00:00Z',
      },
      {
        role: 'MEMBER',
        userId: OTHER_ID,
        pseudo: 'bob',
        displayName: 'Même Nom',
        joinedAt: '2026-10-02T00:00:00Z',
      },
    ];
    const { fixture, el } = await createFixture(ralliement(), MJ_ID, {
      members: homonymes,
      noopAnimations: true,
    });
    openMissives(el, fixture);

    const rows = Array.from(el.querySelectorAll('.ralliement-members .result-row')).map((r) =>
      (r.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('(alice)');
    expect(rows[1]).toContain('(bob)');
  });

  // ─── ⚠️ Story 48.3 : le nom d'un autre membre ouvre sa Ludothèque ────────────────────────────

  describe('Ludothèque d’une personne (Story 48.3)', () => {
    const openTab = (el: HTMLElement, fixture: ComponentFixture<PartieDetail>, label: string) => {
      const tab = Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).find(
        (t) => (t.textContent ?? '').trim() === label,
      );
      tab?.click();
      fixture.detectChanges();
    };
    const buttons = (el: HTMLElement) =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('.ralliement-members .library-open'));
    const flush = async (fixture: ComponentFixture<PartieDetail>) => {
      for (let i = 0; i < 8; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }
    };

    afterEach(() => document.body.querySelectorAll('app-library-sheet').forEach((n) => n.remove()));

    it('groupe, Missives : le nom de l’autre membre est un bouton de thème ; la ligne de la personne connectée reste inerte', async () => {
      const { fixture, el } = await createFixture(
        ralliement({ kind: 'CAMPAGNE_EPISODIQUE' }),
        MJ_ID,
        { members, noopAnimations: true },
      );
      openTab(el, fixture, TONE_MAP['grimoire-emeraude']['partie.invitations_tab_label']);

      const found = buttons(el);
      expect(found).toHaveLength(1);
      expect(found[0].getAttribute('type')).toBe('button');
      expect(found[0].getAttribute('aria-label')).toBe('Voir le cabinet de Membre Deux');
      expect(found[0].textContent).toContain('Membre Deux');
      // Sa propre ligne : aucun bouton, le nom reste du texte.
      const rows = Array.from(el.querySelectorAll('.ralliement-members .result-row'));
      expect(rows[0].textContent).toContain('Créateur');
      expect(rows[0].querySelector('.library-open')).toBeNull();
    });

    it.each([
      ['grimoire-emeraude', 'Voir le cabinet de Membre Deux'],
      ['foret-ancienne', 'Voir le coffre de Membre Deux'],
      ['atelier-cuivre', 'Voir le râtelier de Membre Deux'],
    ] as const)('%s : nom accessible « %s »', async (theme, expected) => {
      const { fixture, el } = await createFixture(
        ralliement({ kind: 'CAMPAGNE_EPISODIQUE' }),
        MJ_ID,
        { members, noopAnimations: true, theme },
      );
      openTab(el, fixture, TONE_MAP[theme]['partie.invitations_tab_label']);

      expect(buttons(el)[0].getAttribute('aria-label')).toBe(expected);
    });

    it('le toucher ouvre la feuille de cette personne ; la fermer rend le focus au nom touché', async () => {
      const { fixture, el } = await createFixture(
        ralliement({ kind: 'CAMPAGNE_EPISODIQUE' }),
        MJ_ID,
        { members, noopAnimations: true },
      );
      openTab(el, fixture, TONE_MAP['grimoire-emeraude']['partie.invitations_tab_label']);
      const trigger = buttons(el)[0];

      trigger.click();
      await flush(fixture);

      const boardGames = TestBed.inject(BoardGamesService) as unknown as {
        listOf: ReturnType<typeof vi.fn>;
      };
      expect(boardGames.listOf).toHaveBeenCalledWith(OTHER_ID);
      expect(document.body.querySelector('app-library-sheet .library-sheet')).not.toBeNull();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await flush(fixture);

      expect(document.body.querySelector('app-library-sheet')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it('rencontre isolée, Invités : un invité touche le nom de l’hôte (même bouton)', async () => {
      const { fixture, el } = await createFixture(ralliement({ role: 'member' }), OTHER_ID, {
        members,
        noopAnimations: true,
      });
      openMissives(el, fixture);

      const found = buttons(el);
      expect(found.map((b) => b.getAttribute('aria-label'))).toEqual([
        'Voir le cabinet de Créateur',
      ]);
    });

    it('rencontre isolée, Invitations (côté hôte) : le nom d’un invité est un bouton, pas le sien', async () => {
      const { fixture, el } = await createFixture(ralliement(), MJ_ID, {
        members,
        noopAnimations: true,
      });
      openMissives(el, fixture);

      expect(buttons(el).map((b) => b.getAttribute('aria-label'))).toEqual([
        'Voir le cabinet de Membre Deux',
      ]);
    });

    it('deux homonymes : le nom accessible porte le pseudo qui les départage', async () => {
      const homonymes: PartieMemberDto[] = [
        { ...members[0], pseudo: 'alice', displayName: 'Même Nom' },
        { ...members[1], pseudo: 'bob', displayName: 'Même Nom' },
      ];
      const { fixture, el } = await createFixture(ralliement(), MJ_ID, {
        members: homonymes,
        noopAnimations: true,
      });
      openMissives(el, fixture);

      expect(buttons(el)[0].getAttribute('aria-label')).toBe('Voir le cabinet de Même Nom (bob)');
    });

    it('une partie de JDR : aucun nom ne devient un bouton, aucune feuille', async () => {
      const { fixture, el } = await createFixture(makePartie({ ownerId: MJ_ID }), MJ_ID, {
        members,
        noopAnimations: true,
      });
      openMissives(el, fixture);

      expect(el.querySelector('.library-open')).toBeNull();
      expect(el.querySelector('app-library-sheet')).toBeNull();
      expect(document.body.querySelector('app-library-sheet')).toBeNull();
    });
  });

  it.each(THEMES)(
    'thème %s : les textes partagés rendus par la page d’un ralliement n’emploient aucun mot interdit',
    (theme) => {
      for (const key of [
        'partie.members_title',
        'partie.invitations_tab_label',
        'parties.detail_tab_details',
        'partie.edit_btn',
        'partie.no_members',
        'identity.homonymy_change_cta',
        'identity.homonymy_ignore_cta',
      ]) {
        expect(BANNED.test(TONE_MAP[theme][key]), `${theme} / ${key}`).toBe(false);
      }
    },
  );

  it('ni lien d’invitation chargé, ni recherche : un invité n’a aucune gestion des membres', async () => {
    // Story 41.3 : l'hôte (administrateur) d'une soirée invite ; seul un invité n'a aucune gestion.
    await createFixture(ralliement({ role: 'member' }), OTHER_ID, { members });
    const partiesSvc = TestBed.inject(PartiesService) as unknown as {
      inviteLinks: ReturnType<typeof vi.fn>;
      searchUsers: ReturnType<typeof vi.fn>;
    };
    expect(partiesSvc.inviteLinks).not.toHaveBeenCalled();
    expect(partiesSvc.searchUsers).not.toHaveBeenCalled();
  });

  it.each(THEMES)(
    'thème %s : sous-titre « <préfixe du thème> · <type> » et aucun mot de JDR dans la page',
    async (theme) => {
      const tone = TONE_MAP[theme];
      for (const kind of ['ONE_SHOT', 'CAMPAGNE_EPISODIQUE'] as const) {
        const { fixture, el } = await createFixture(ralliement({ kind }), MJ_ID, {
          members,
          theme,
          noopAnimations: true,
        });
        expect(TestBed.inject(ContextualNavService).subtitle()).toBe(
          `${tone['partie.mode_ralliement']} · ${tone[`partie.ralliement_kind_${kind}`]}`,
        );
        // Onglet d'ouverture (Détails, ou Conjonctions pour un groupe), puis Missives : balayés. Story 50.1 :
        // un groupe a aussi « Reliques » (2ᵉ onglet), balayé avant Missives (4ᵉ).
        expect(BANNED.test(el.textContent ?? ''), `${theme}/${kind} ouverture`).toBe(false);
        if (kind === 'CAMPAGNE_EPISODIQUE') {
          el.querySelectorAll<HTMLElement>('div[role="tab"]')[1].click();
          fixture.detectChanges();
          expect(BANNED.test(el.textContent ?? ''), `${theme}/${kind} jeux du groupe`).toBe(false);
        }
        el.querySelectorAll<HTMLElement>('div[role="tab"]')[
          kind === 'CAMPAGNE_EPISODIQUE' ? 3 : 1
        ].click();
        fixture.detectChanges();
        expect(BANNED.test(el.textContent ?? ''), `${theme}/${kind} Missives`).toBe(false);
        TestBed.resetTestingModule();
      }
    },
  );

  it.each(THEMES)(
    'thème %s : description vide, homonymie et clôture parlent le langage du ralliement',
    async (theme) => {
      const tone = TONE_MAP[theme];
      const { fixture, el } = await createFixture(
        ralliement({ description: null, status: 'TERMINEE', kind: 'CAMPAGNE_EPISODIQUE' }),
        MJ_ID,
        {
          members: [
            members[0],
            {
              role: 'MEMBER',
              userId: OTHER_ID,
              pseudo: 'autre',
              displayName: 'Test',
              joinedAt: '2026-10-02T00:00:00Z',
            },
          ],
          theme,
          displayName: 'Test',
          noopAnimations: true,
        },
      );
      expect(el.querySelector('.homonymy-warning')?.textContent).toContain(
        tone['identity.ralliement_homonymy_warning'],
      );
      // Story 41.1 : la description se lit dans « Détails », second onglet d'un groupe.
      el.querySelectorAll<HTMLElement>('div[role="tab"]')[2].click();
      fixture.detectChanges();
      expect(el.textContent).toContain(tone['partie.ralliement_no_description']);
      expect(el.querySelector('.closed-banner')?.textContent).toContain(
        tone['partie.ralliement_status_closed_label'],
      );
      expect(BANNED.test(el.textContent ?? '')).toBe(false);
    },
  );

  it('témoin JDR : une quête Ryuutama garde ses cinq onglets, son widget de séance et son sous-titre', async () => {
    const { el } = await createFixture(
      makePartie({ gameSystemId: 'ryuutama', kind: 'CAMPAGNE_EPISODIQUE', ownerId: MJ_ID }),
      MJ_ID,
    );
    const tone = TONE_MAP['grimoire-emeraude'];
    expect(tabLabels(el)).toEqual([
      tone['parties.detail_tab_details'],
      tone['partie.invitations_tab_label'],
      'Homme Dragon',
      tone['parties.detail_tab_scenarios'],
      tone['parties.detail_tab_timeline'],
    ]);
    expect(el.querySelector('.scheduling-widget')).not.toBeNull();
    expect(TestBed.inject(ContextualNavService).subtitle()).toBe(
      `Ryuutama · ${tone['partie.kind_CAMPAGNE_EPISODIQUE']}`,
    );
  });
});

// ─── Un groupe s'ouvre sur ses conjonctions (Story 39.1) ───────────────────────────────────

describe('PartieDetail — un groupe s’ouvre sur ses conjonctions (Story 39.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const OTHER_ID = 'member-2';
  const groupe = (over: Partial<PartieDto> = {}) =>
    makePartie({
      gameSystemId: 'ralliement',
      kind: 'CAMPAGNE_EPISODIQUE',
      role: 'admin',
      description: 'Une bande de voyageurs',
      ...over,
    });
  const members: PartieMemberDto[] = [
    {
      role: 'ADMIN',
      userId: MJ_ID,
      pseudo: 'createur',
      displayName: 'Créateur',
      joinedAt: '2026-10-01T00:00:00Z',
    },
    {
      role: 'MEMBER',
      userId: OTHER_ID,
      pseudo: 'membre',
      displayName: 'Membre',
      joinedAt: '2026-10-02T00:00:00Z',
    },
  ];
  const tabs = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]'));
  const tabLabels = (el: HTMLElement) => tabs(el).map((t) => (t.textContent ?? '').trim());
  const openTab = (el: HTMLElement, fixture: ComponentFixture<PartieDetail>, index: number) => {
    tabs(el)[index].click();
    fixture.detectChanges();
  };
  const settleTabs = async (fixture: ComponentFixture<PartieDetail>) => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  };
  /** Libellé d'une action du pied de carte (une `<app-icon>` n'a aucun texte). */
  const label = (node: Element) => (node.textContent ?? '').trim();
  const footerButtons = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('mat-card-actions button')).map(label);

  it.each(THEMES)(
    'thème %s : un membre voit Conjonctions (ouvert), Reliques, Détails, Missives, avec les mots du thème',
    async (theme) => {
      const tone = TONE_MAP[theme];
      const { el } = await createFixture(groupe({ role: 'member' }), OTHER_ID, {
        members,
        theme,
      });
      expect(tabLabels(el)).toEqual([
        tone['partie.ralliement_conjonctions_tab'],
        tone['event_games.tab'],
        tone['parties.detail_tab_details'],
        tone['partie.invitations_tab_label'],
      ]);
      expect(tabs(el)[0].getAttribute('aria-selected')).toBe('true');
    },
  );

  it('Reliques (Story 50.1) : le 4ᵉ onglet du groupe ne lit les jeux qu’à son ouverture, pour tout membre', async () => {
    const { fixture, el } = await createFixture(groupe({ role: 'member' }), OTHER_ID, {
      members,
      noopAnimations: true,
    });
    const boardGames = TestBed.inject(BoardGamesService) as unknown as {
      listOfGroup: ReturnType<typeof vi.fn>;
    };
    expect(tabLabels(el)[1]).toBe(TONE_MAP['grimoire-emeraude']['event_games.tab']);
    expect(el.querySelector('app-group-games-tab')).toBeNull();
    expect(boardGames.listOfGroup).not.toHaveBeenCalled();

    openTab(el, fixture, 1);
    await settleTabs(fixture);

    expect(el.querySelector('app-group-games-tab')).not.toBeNull();
    expect(boardGames.listOfGroup).toHaveBeenCalledWith('party-1');
  });

  it('Qui reçoit (Story 50.2) : « Détails » d’un groupe ouvre sa section au-dessus de la description, pour tout membre', async () => {
    const { fixture, el } = await createFixture(groupe({ role: 'member' }), OTHER_ID, {
      members,
      noopAnimations: true,
    });
    const events = TestBed.inject(EventsApiService) as unknown as {
      hostCounts: ReturnType<typeof vi.fn>;
    };
    events.hostCounts.mockResolvedValue({
      members: [{ userId: MJ_ID, pseudo: 'createur', displayName: 'Créateur', count: 2 }],
    });

    openTab(el, fixture, 2);
    await settleTabs(fixture);

    expect(events.hostCounts).toHaveBeenCalledWith('party-1');
    const section = el.querySelector('app-host-bars');
    expect(section?.textContent).toContain(TONE_MAP['grimoire-emeraude']['host_counts.title']);
    const reference = el.querySelector('.details-zone--reference') as HTMLElement;
    expect(
      (section as HTMLElement).compareDocumentPosition(reference) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('Qui reçoit (Story 50.2) : une rencontre isolée n’a pas la section', async () => {
    const { fixture, el } = await createFixture(
      groupe({ kind: 'ONE_SHOT', role: 'member' }),
      OTHER_ID,
      { members, noopAnimations: true },
    );
    const events = TestBed.inject(EventsApiService) as unknown as {
      hostCounts: ReturnType<typeof vi.fn>;
    };

    for (let i = 0; i < tabs(el).length; i++) {
      openTab(el, fixture, i);
      await settleTabs(fixture);
    }

    expect(el.querySelector('app-host-bars')).toBeNull();
    expect(events.hostCounts).not.toHaveBeenCalled();
  });

  it('Reliques (Story 50.1) : une rencontre isolée n’a pas l’onglet des jeux du groupe', async () => {
    const { fixture, el } = await createFixture(
      groupe({ kind: 'ONE_SHOT', role: 'member' }),
      OTHER_ID,
      { members, noopAnimations: true },
    );
    const boardGames = TestBed.inject(BoardGamesService) as unknown as {
      listOfGroup: ReturnType<typeof vi.fn>;
    };

    for (let i = 0; i < tabs(el).length; i++) {
      openTab(el, fixture, i);
      await settleTabs(fixture);
    }

    expect(el.querySelector('app-group-games-tab')).toBeNull();
    expect(boardGames.listOfGroup).not.toHaveBeenCalled();
  });

  it.each([
    ['admin', MJ_ID, 'admin'],
    ['membre', OTHER_ID, 'member'],
  ] as const)(
    '%s : Conjonctions affiche « À venir » puis « Passées » et l’état vide',
    async (_nom, userId, role) => {
      const { el } = await createFixture(groupe({ role }), userId, { members });
      const tone = TONE_MAP['grimoire-emeraude'];
      const titres = Array.from(el.querySelectorAll('.conjonctions h3')).map((h) =>
        (h.textContent ?? '').trim(),
      );
      expect(titres).toEqual([
        tone['partie.ralliement_conjonctions_upcoming'],
        tone['partie.ralliement_conjonctions_past'],
      ]);
      expect(el.querySelector('.conjonctions__section--upcoming')?.textContent).toContain(
        tone['partie.ralliement_conjonctions_upcoming_empty'],
      );
      expect(el.querySelector('.conjonctions__section--past')?.textContent).toContain(
        tone['partie.ralliement_conjonctions_past_empty'],
      );
      expect(el.querySelector('.conjonctions__empty')?.textContent?.trim()).toBe(
        'Aucune conjonction pour l’instant',
      );
      // ⚠️ Story 40.1 : l'en-tête porte « + Nouvelle conjonction » pour tout membre ; sans
      // conjonction, aucune carte (le seul bouton est celui de l'en-tête).
      const buttons = Array.from(el.querySelectorAll('.conjonctions button'));
      expect(buttons.map((b) => (b.textContent ?? '').trim())).toEqual([
        tone['partie.ralliement_event_new_btn'],
      ]);
      expect(el.querySelector('.conjonctions app-event-card')).toBeNull();
      // ⚠️ Story 40.5b : l'en-tête porte aussi le lien écrit « Calendrier du groupe » vers la page du
      // groupe (auparavant « un groupe n'a aucun lien de calendrier », Story 39.1) — le seul lien de
      // l'onglet, jamais une icône seule.
      const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('.conjonctions a'));
      expect(links.map((a) => (a.textContent ?? '').trim())).toEqual([
        tone['partie.ralliement_calendar_link'],
      ]);
      expect(links[0].getAttribute('href')).toBe('/parties/party-1/guild-calendar');
    },
  );

  it('Détails : la description, aucune carte de conjonction, aucun « Sceller des secrets »', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, { members, noopAnimations: true });
    openTab(el, fixture, 2);

    expect(
      el.querySelector('.details-zone--reference .zone-card--reference')?.textContent,
    ).toContain('Une bande de voyageurs');
    expect(el.querySelector('.conjonctions')).toBeNull();
    expect(el.querySelector('a[href$="/visibility"]')).toBeNull();
    expect(el.textContent).not.toContain(TONE_MAP['grimoire-emeraude']['partie.visibility_btn']);
  });

  it('Missives : la liste des membres reste accessible en quatrième position', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, { members, noopAnimations: true });
    openTab(el, fixture, 3);
    const rows = Array.from(el.querySelectorAll('.ralliement-members .result-row')).map((r) =>
      (r.textContent ?? '').trim(),
    );
    // L'admin (Story 39.3) peut retirer le membre, jamais le créateur ; Story 39.4 : le créateur
    // porte le badge « Admin » et « Quitter l'office », le membre « Nommer admin ».
    const tone = TONE_MAP['grimoire-emeraude'];
    expect(rows).toEqual([expect.stringContaining('Créateur'), expect.stringContaining('Membre')]);
    expect(rows[0]).toContain(tone['partie.ralliement_admin_badge']);
    expect(rows[0]).toContain(tone['partie.ralliement_step_down_btn']);
    expect(rows[1]).toContain(tone['partie.ralliement_appoint_btn']);
  });

  it('admin : pied de carte Retranscrire, Clore, Quitter l’office, Brûler — sans Sceller des secrets', async () => {
    const { el } = await createFixture(groupe(), MJ_ID, { members });
    const tone = TONE_MAP['grimoire-emeraude'];
    const actions = el.querySelector('mat-card-actions') as HTMLElement;
    expect(Array.from(actions.querySelectorAll('a')).map(label)).toEqual([tone['partie.edit_btn']]);
    expect(footerButtons(el)).toEqual([
      tone['partie.close_btn'],
      tone['partie.ralliement_step_down_btn'],
      tone['partie.delete_btn'],
    ]);
    expect(actions.textContent).not.toContain(tone['partie.visibility_btn']);
    const brule = Array.from(actions.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(tone['partie.delete_btn']),
    );
    expect(brule!.classList.contains('icon-bar__btn--danger')).toBe(true);
  });

  it('admin, groupe terminé : « Rouvrir » remplace « Clore »', async () => {
    const { el } = await createFixture(groupe({ status: 'TERMINEE' }), MJ_ID, { members });
    const tone = TONE_MAP['grimoire-emeraude'];
    expect(footerButtons(el)).toEqual([
      tone['partie.reopen_btn'],
      tone['partie.ralliement_step_down_btn'],
      tone['partie.delete_btn'],
    ]);
  });

  it('membre : « Quitter le groupe » seul au pied de carte (Story 39.5), sans teinte destructrice', async () => {
    const { el } = await createFixture(groupe({ role: 'member' }), OTHER_ID, { members });
    const tone = TONE_MAP['grimoire-emeraude'];
    expect(el.querySelector('mat-card-actions a')).toBeNull();
    expect(footerButtons(el)).toEqual([tone['partie.ralliement_leave_btn']]);
    const bouton = el.querySelector('mat-card-actions button') as HTMLElement;
    expect(bouton.classList.contains('icon-bar__btn--danger')).toBe(false);
  });

  it('clore puis rouvrir passent par PartiesService et mettent la page à jour', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, { members });
    const parties = TestBed.inject(PartiesService) as unknown as {
      close: ReturnType<typeof vi.fn>;
      reopen: ReturnType<typeof vi.fn>;
    };
    const tone = TONE_MAP['grimoire-emeraude'];
    const click = async (label: string) => {
      const bouton = Array.from(el.querySelectorAll('mat-card-actions button')).find((b) =>
        b.textContent?.includes(label),
      ) as HTMLButtonElement;
      bouton.click();
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }
    };

    await click(tone['partie.close_btn']);
    expect(parties.close).toHaveBeenCalledWith('party-1');
    expect(el.querySelector('.closed-banner')?.textContent).toContain(
      tone['partie.ralliement_status_closed_label'],
    );

    await click(tone['partie.reopen_btn']);
    expect(parties.reopen).toHaveBeenCalledWith('party-1');
    expect(el.querySelector('.closed-banner')).toBeNull();
  });

  it('brûler : confirmation, suppression, rechargement de la liste', async () => {
    const partie = groupe();
    const { fixture } = await createFixture(partie, MJ_ID, { members });
    const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    const parties = TestBed.inject(PartiesService) as unknown as {
      remove: ReturnType<typeof vi.fn>;
    };
    const myParties = TestBed.inject(MyPartiesService) as unknown as {
      refreshAll: ReturnType<typeof vi.fn>;
    };

    await fixture.componentInstance.confirmDelete(partie);

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(parties.remove).toHaveBeenCalledWith(partie.id);
    expect(myParties.refreshAll).toHaveBeenCalledTimes(1);
  });

  it.each(THEMES)('thème %s : l’onglet Conjonctions n’emploie aucun mot de JDR', async (theme) => {
    const { el } = await createFixture(groupe(), MJ_ID, { members, theme });
    expect(NON_JDR_BANNED_WORDS.test(el.textContent ?? '')).toBe(false);
  });

  it('rencontre isolée : le détail en ligne (ouvert) puis Invitations, sans Détails ni conjonctions', async () => {
    // Story 41.1 ⚠️ : la rencontre isolée n'ouvre plus sur « Détails » + « Missives ».
    const { el } = await createFixture(groupe({ kind: 'ONE_SHOT' }), MJ_ID, { members });
    const tone = TONE_MAP['grimoire-emeraude'];
    // Story 49.1 : une soirée à venir gagne un troisième onglet (les jeux sur place), sans compte avant sa lecture.
    expect(tabLabels(el)).toEqual([
      tone['partie.ralliement_soiree_tab'],
      tone['partie.ralliement_soiree_invitations_tab'],
      tone['event_games.tab'],
    ]);
    expect(tabs(el)[0].getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('.conjonctions')).toBeNull();
    // Story 41.4 : l'hôte de la soirée ne voit que « Clore » au pied de la page (jamais « Brûler »).
    expect(footerButtons(el)).toEqual([TONE_MAP['grimoire-emeraude']['partie.close_btn']]);
  });

  it('témoin JDR : les onglets d’une quête ne contiennent pas de Conjonctions', async () => {
    const { el } = await createFixture(
      makePartie({ gameSystemId: 'ryuutama', kind: 'CAMPAGNE_EPISODIQUE', ownerId: MJ_ID }),
      MJ_ID,
    );
    const tone = TONE_MAP['grimoire-emeraude'];
    expect(tabLabels(el)).not.toContain(tone['partie.ralliement_conjonctions_tab']);
    expect(tabLabels(el)[0]).toBe(tone['parties.detail_tab_details']);
  });
});

// ─── Inviter quelqu'un dans un groupe (Story 39.3) ─────────────────────────────────────────

describe('PartieDetail — Missives d’un groupe : invitation et retrait (Story 39.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const OTHER_ID = 'member-2';
  const groupe = (over: Partial<PartieDto> = {}) =>
    makePartie({
      gameSystemId: 'ralliement',
      kind: 'CAMPAGNE_EPISODIQUE',
      role: 'admin',
      ...over,
    });
  const members: PartieMemberDto[] = [
    {
      role: 'ADMIN',
      userId: MJ_ID,
      pseudo: 'createur',
      displayName: 'Créateur',
      joinedAt: '2026-10-01T00:00:00Z',
    },
    {
      role: 'MEMBER',
      userId: OTHER_ID,
      pseudo: 'membre',
      displayName: 'Membre',
      joinedAt: '2026-10-02T00:00:00Z',
    },
  ];
  const openMissives = (el: HTMLElement, fixture: ComponentFixture<PartieDetail>) => {
    el.querySelectorAll<HTMLElement>('div[role="tab"]')[3].click();
    fixture.detectChanges();
  };
  const panel = (el: HTMLElement) => el.querySelector('.ralliement-members') as HTMLElement;
  const services = () =>
    TestBed.inject(PartiesService) as unknown as {
      inviteLinks: ReturnType<typeof vi.fn>;
      searchUsers: ReturnType<typeof vi.fn>;
      inviteUser: ReturnType<typeof vi.fn>;
      inviteByEmail: ReturnType<typeof vi.fn>;
      removeMember: ReturnType<typeof vi.fn>;
      createInviteLink: ReturnType<typeof vi.fn>;
    };

  it.each(THEMES)(
    'thème %s : l’admin voit recherche, e-mail, liens et « Retirer » sur le seul membre, avec les mots du groupe',
    async (theme) => {
      const { fixture, el } = await createFixture(groupe(), MJ_ID, {
        members,
        theme,
        noopAnimations: true,
      });
      openMissives(el, fixture);
      const tone = TONE_MAP[theme];

      const titres = Array.from(panel(el).querySelectorAll('h3')).map((h) =>
        (h.textContent ?? '').trim(),
      );
      expect(titres).toEqual([
        tone['partie.members_title'],
        tone['partie.ralliement_invite_title'],
        tone['partie.ralliement_links_title'],
      ]);
      expect(panel(el).querySelectorAll('input')).toHaveLength(2);
      expect(panel(el).textContent).toContain(tone['partie.ralliement_search_label']);
      expect(panel(el).textContent).toContain(tone['partie.ralliement_invite_by_email_label']);
      expect(panel(el).textContent).toContain(tone['partie.ralliement_generate_link']);
      // « Retirer » : sur le membre seulement, jamais sur le créateur (et soi-même). Le créateur
      // n'a que « Quitter l'office » (Story 39.4), jamais « Retirer ».
      const lignes = Array.from(panel(el).querySelectorAll('.result-row'));
      expect(lignes).toHaveLength(2);
      expect(lignes[0].textContent).not.toContain(tone['partie.remove_member_btn']);
      expect(lignes[0].querySelectorAll('button')).toHaveLength(1);
      expect(lignes[1].textContent).toContain(tone['partie.remove_member_btn']);
      // Aucun mot de JDR, ni libellé de la variante quête.
      expect(NON_JDR_BANNED_WORDS.test(el.textContent ?? '')).toBe(false);
      expect(panel(el).textContent).not.toContain(tone['partie.invite_title']);
      expect(panel(el).textContent).not.toContain(tone['partie.links_title']);
    },
  );

  it('l’admin charge les liens d’invitation du groupe', async () => {
    await createFixture(groupe(), MJ_ID, { members });
    expect(services().inviteLinks).toHaveBeenCalledWith('party-1');
  });

  it('un membre garde la seule liste : ni champ, ni bouton, ni lien chargé', async () => {
    const { fixture, el } = await createFixture(groupe({ role: 'member' }), OTHER_ID, {
      members,
      noopAnimations: true,
    });
    openMissives(el, fixture);
    expect(panel(el).querySelector('button:not(.library-open)')).toBeNull();
    expect(panel(el).querySelector('input')).toBeNull();
    expect(panel(el).querySelector('.link-row')).toBeNull();
    expect(services().inviteLinks).not.toHaveBeenCalled();
  });

  it('une rencontre isolée : l’hôte a l’interface d’invitation (Story 41.3), un invité n’en a aucune', async () => {
    const host = await createFixture(groupe({ kind: 'ONE_SHOT' }), MJ_ID, {
      members,
      noopAnimations: true,
    });
    host.el.querySelectorAll<HTMLElement>('div[role="tab"]')[1].click();
    host.fixture.detectChanges();
    expect(panel(host.el).querySelector('input')).not.toBeNull();
    expect(services().inviteLinks).toHaveBeenCalled();
    TestBed.resetTestingModule();

    const guest = await createFixture(groupe({ kind: 'ONE_SHOT', role: 'member' }), OTHER_ID, {
      members,
      noopAnimations: true,
    });
    guest.el.querySelectorAll<HTMLElement>('div[role="tab"]')[1].click();
    guest.fixture.detectChanges();
    expect(panel(guest.el).querySelector('button:not(.library-open)')).toBeNull();
    expect(panel(guest.el).querySelector('input')).toBeNull();
    expect(services().inviteLinks).not.toHaveBeenCalled();
  });

  it('invite par pseudo, par e-mail et par lien via PartiesService', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    const svc = services();
    svc.inviteByEmail.mockResolvedValue({ ok: true });
    const comp = fixture.componentInstance;

    await comp.invite({ id: 'u9', pseudo: 'ami' });
    expect(svc.inviteUser).toHaveBeenCalledWith('party-1', 'u9');

    comp['inviteEmail'].set('ami@example.com');
    await comp.inviteByEmail();
    expect(svc.inviteByEmail).toHaveBeenCalledWith('party-1', 'ami@example.com');

    await comp.createLink();
    expect(svc.createInviteLink).toHaveBeenCalledWith('party-1', {});
  });

  it('retirer un membre : confirmation du groupe puis retrait', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    await fixture.componentInstance.removeMember(members[1]);

    const tone = TONE_MAP['grimoire-emeraude'];
    expect(dialog.open.mock.calls[0][1].data.message).toBe(
      tone['partie.ralliement_remove_member_confirm']
        .replace('{name}', 'Membre')
        .replace('{partie}', 'Test Party'),
    );
    expect(services().removeMember).toHaveBeenCalledWith('party-1', OTHER_ID);
  });

  it('un refus du serveur (409) est affiché sans exception', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    services().removeMember.mockRejectedValue({ error: { message: 'Refus du serveur' } });

    await fixture.componentInstance.removeMember(members[1]);

    expect(fixture.componentInstance['notice']()).toBe('Refus du serveur');
  });

  it.each([
    ['erreur réseau sans message', { status: 0 }],
    ['message en tableau', { error: { message: ['a', 'b'] } }],
    ['réponse 404 sans message textuel', { status: 404, error: {} }],
  ])(
    'échec sans message textuel (%s) : repli sur le libellé du thème, liste rechargée, ancien refus effacé',
    async (_cas, erreur) => {
      const { fixture } = await createFixture(groupe(), MJ_ID, { members });
      const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
      dialog.open.mockReturnValue({ afterClosed: () => of(true) });
      const svc = services();
      const loaded = (
        TestBed.inject(PartiesService) as unknown as { members: ReturnType<typeof vi.fn> }
      ).members;
      const comp = fixture.componentInstance;

      // Un refus précédent (409) est affiché ; la tentative suivante l'efface puis le remplace.
      svc.removeMember.mockRejectedValueOnce({ error: { message: 'Refus du serveur' } });
      await comp.removeMember(members[1]);
      expect(comp['notice']()).toBe('Refus du serveur');

      const avant = loaded.mock.calls.length;
      svc.removeMember.mockRejectedValueOnce(erreur);
      await comp.removeMember(members[1]);

      expect(comp['notice']()).toBe(
        TONE_MAP['grimoire-emeraude']['partie.ralliement_remove_member_error'],
      );
      expect(loaded.mock.calls.length).toBeGreaterThan(avant);
    },
  );

  it('un retrait réussi efface le refus précédent', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    const comp = fixture.componentInstance;

    services().removeMember.mockRejectedValueOnce({ error: { message: 'Refus du serveur' } });
    await comp.removeMember(members[1]);
    services().removeMember.mockResolvedValueOnce({ ok: true });
    await comp.removeMember(members[1]);

    expect(comp['notice']()).toBeNull();
  });
});

// ─── Nommer des admins et quitter l'office (Story 39.4) ─────────────────────────────────────

describe('PartieDetail — admins d’un groupe : nommer et quitter l’office (Story 39.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const OTHER_ID = 'member-2';
  const THIRD_ID = 'member-3';
  const groupe = (over: Partial<PartieDto> = {}) =>
    makePartie({
      gameSystemId: 'ralliement',
      kind: 'CAMPAGNE_EPISODIQUE',
      role: 'admin',
      ...over,
    });
  const member = (
    userId: string,
    displayName: string,
    role: 'ADMIN' | 'MEMBER',
  ): PartieMemberDto => ({
    userId,
    pseudo: displayName.toLowerCase(),
    displayName,
    role,
    joinedAt: '2026-10-01T00:00:00Z',
  });
  /** Créateur (soi) admin, un second admin, un membre ordinaire. */
  const members = [
    member(MJ_ID, 'Créateur', 'ADMIN'),
    member(OTHER_ID, 'Seconde', 'ADMIN'),
    member(THIRD_ID, 'Membre', 'MEMBER'),
  ];
  const seul = [member(MJ_ID, 'Créateur', 'ADMIN'), member(THIRD_ID, 'Membre', 'MEMBER')];

  const openMissives = (el: HTMLElement, fixture: ComponentFixture<PartieDetail>) => {
    el.querySelectorAll<HTMLElement>('div[role="tab"]')[3].click();
    fixture.detectChanges();
  };
  const rows = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.ralliement-members .result-row')) as HTMLElement[];
  const services = () =>
    TestBed.inject(PartiesService) as unknown as {
      get: ReturnType<typeof vi.fn>;
      members: ReturnType<typeof vi.fn>;
      setMemberRole: ReturnType<typeof vi.fn>;
      removeMember: ReturnType<typeof vi.fn>;
    };
  const dialogOpen = () =>
    (TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> }).open;
  const myParties = () =>
    TestBed.inject(MyPartiesService) as unknown as { refreshAll: ReturnType<typeof vi.fn> };
  const confirm = (answer: boolean) =>
    dialogOpen().mockReturnValue({ afterClosed: () => of(answer) });

  it.each(THEMES)(
    'thème %s : badge Admin (pictogramme + mot) sur chaque admin, « Nommer admin » sur le membre, « Retirer » jamais sur un admin',
    async (theme) => {
      const { fixture, el } = await createFixture(groupe(), MJ_ID, {
        members,
        theme,
        noopAnimations: true,
      });
      openMissives(el, fixture);
      const tone = TONE_MAP[theme];
      const [moi, seconde, membre] = rows(el);

      for (const admin of [moi, seconde]) {
        const badge = admin.querySelector('.admin-badge') as HTMLElement;
        expect(badge.textContent).toContain(tone['partie.ralliement_admin_badge']);
        expect(badge.querySelector('app-icon')?.getAttribute('data-icon')).toBe('role-admin');
        expect(badge.querySelector('mat-icon')).toBeNull();
        expect(admin.textContent).not.toContain(tone['partie.remove_member_btn']);
        expect(admin.textContent).not.toContain(tone['partie.ralliement_appoint_btn']);
      }
      // « Quitter l'office » sur SA ligne seulement.
      expect(moi.textContent).toContain(tone['partie.ralliement_step_down_btn']);
      expect(seconde.textContent).not.toContain(tone['partie.ralliement_step_down_btn']);
      // Le membre ordinaire : pas de badge, « Nommer admin » et « Retirer ».
      expect(membre.querySelector('.admin-badge')).toBeNull();
      expect(membre.textContent).toContain(tone['partie.ralliement_appoint_btn']);
      expect(membre.textContent).toContain(tone['partie.remove_member_btn']);
      expect(NON_JDR_BANNED_WORDS.test(el.textContent ?? '')).toBe(false);
    },
  );

  it('un membre ordinaire voit les badges mais aucune action', async () => {
    const { fixture, el } = await createFixture(groupe({ role: 'member' }), THIRD_ID, {
      members,
      noopAnimations: true,
    });
    openMissives(el, fixture);
    expect(el.querySelectorAll('.ralliement-members .admin-badge')).toHaveLength(2);
    expect(el.querySelector('.ralliement-members button:not(.library-open)')).toBeNull();
  });

  it('une rencontre isolée n’affiche ni badge ni action de rôle', async () => {
    const { fixture, el } = await createFixture(groupe({ kind: 'ONE_SHOT' }), MJ_ID, {
      members,
      noopAnimations: true,
    });
    el.querySelectorAll<HTMLElement>('div[role="tab"]')[1].click();
    fixture.detectChanges();
    expect(el.querySelector('.ralliement-members .admin-badge')).toBeNull();
    // Story 41.3 : l'hôte invite et retire, mais ne nomme ni ne quitte l'office (un seul administrateur).
    const tone = TONE_MAP['grimoire-emeraude'];
    expect(el.textContent).not.toContain(tone['partie.ralliement_appoint_btn']);
    expect(el.textContent).not.toContain(tone['partie.ralliement_step_down_btn']);
  });

  it('nommer : confirmation « Nommer … » puis appel ADMIN, liste rechargée', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    confirm(true);
    const avant = services().members.mock.calls.length;

    await fixture.componentInstance.appointAdmin(members[2]);

    const tone = TONE_MAP['grimoire-emeraude'];
    const data = dialogOpen().mock.calls[0][1].data;
    expect(data.message).toBe(
      tone['partie.ralliement_appoint_confirm']
        .replace('{name}', 'Membre')
        .replace('{partie}', 'Test Party'),
    );
    expect(data.confirmLabel).toBe(tone['partie.ralliement_appoint_btn']);
    expect(data.destructive).toBeUndefined();
    expect(services().setMemberRole).toHaveBeenCalledWith('party-1', THIRD_ID, { role: 'ADMIN' });
    expect(services().members.mock.calls.length).toBeGreaterThan(avant);
  });

  it('nommer : « Renoncer » n’appelle rien', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    confirm(false);
    await fixture.componentInstance.appointAdmin(members[2]);
    expect(services().setMemberRole).not.toHaveBeenCalled();
  });

  it('nommer : un refus du serveur est affiché, la liste rechargée', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    confirm(true);
    services().setMemberRole.mockRejectedValueOnce({ error: { message: 'Refus du serveur' } });
    const avant = services().members.mock.calls.length;

    await fixture.componentInstance.appointAdmin(members[2]);

    expect(fixture.componentInstance['notice']()).toBe('Refus du serveur');
    expect(services().members.mock.calls.length).toBeGreaterThan(avant);
  });

  it('nommer : sans message textuel, repli sur le libellé du thème', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    confirm(true);
    services().setMemberRole.mockRejectedValueOnce({ status: 0 });
    await fixture.componentInstance.appointAdmin(members[2]);
    expect(fixture.componentInstance['notice']()).toBe(
      TONE_MAP['grimoire-emeraude']['partie.ralliement_role_error'],
    );
  });

  it('quitter l’office alors qu’un autre admin reste : confirmation courte (non rouge), partie rechargée, pas de suppression', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    confirm(true);
    const avant = services().get.mock.calls.length;

    await fixture.componentInstance.stepDownFromOffice();

    const tone = TONE_MAP['grimoire-emeraude'];
    const data = dialogOpen().mock.calls[0][1].data;
    expect(data.message).toBe(
      tone['partie.ralliement_step_down_confirm'].replace('{partie}', 'Test Party'),
    );
    expect(data.confirmLabel).toBe(tone['partie.ralliement_step_down_btn']);
    expect(data.destructive).toBeUndefined();
    // Le drapeau de suppression n'est jamais envoyé quand un autre admin reste.
    expect(services().setMemberRole).toHaveBeenCalledWith('party-1', MJ_ID, { role: 'MEMBER' });
    expect(services().get.mock.calls.length).toBeGreaterThan(avant);
    expect(myParties().refreshAll).not.toHaveBeenCalled();
  });

  it('dernier admin : confirmation ROUGE annonçant la suppression, puis deleteIfLastAdmin et retour à l’accueil', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members: seul });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    confirm(true);
    services().setMemberRole.mockResolvedValueOnce({ ok: true, deleted: true });

    await fixture.componentInstance.stepDownFromOffice();

    const tone = TONE_MAP['grimoire-emeraude'];
    const data = dialogOpen().mock.calls[0][1].data;
    expect(data.destructive).toBe(true);
    expect(data.confirmLabel).toBe(tone['partie.ralliement_last_admin_btn']);
    expect(data.message).toBe(
      tone['partie.ralliement_last_admin_confirm']
        .replace('{partie}', 'Test Party')
        .replace('{members}', '2')
        .replace('{conjonctions}', '0'),
    );
    expect(services().setMemberRole).toHaveBeenCalledWith('party-1', MJ_ID, {
      role: 'MEMBER',
      deleteIfLastAdmin: true,
    });
    expect(myParties().refreshAll).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it.each(THEMES)(
    'thème %s : la confirmation du dernier admin cite les membres, les conjonctions, conseille de nommer un autre admin et n’emploie aucun mot de JDR',
    (theme) => {
      const texte = TONE_MAP[theme]['partie.ralliement_last_admin_confirm'];
      expect(texte).toContain('{members}');
      expect(texte).toContain('{conjonctions}');
      expect(texte).toContain('{partie}');
      expect(texte).toMatch(/Nomm(ez|e) d’abord un autre administrateur/);
      expect(NON_JDR_BANNED_WORDS.test(texte)).toBe(false);
    },
  );

  it('dernier admin, « Renoncer » : rien n’est envoyé', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members: seul });
    confirm(false);
    await fixture.componentInstance.stepDownFromOffice();
    expect(services().setMemberRole).not.toHaveBeenCalled();
    expect(myParties().refreshAll).not.toHaveBeenCalled();
  });

  it('écran périmé : la page croyait être le dernier admin mais le serveur ne supprime pas (deleted: false) → pas de départ, partie rechargée', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members: seul });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    confirm(true);
    services().setMemberRole.mockResolvedValueOnce({ ok: true, deleted: false });
    const avant = services().get.mock.calls.length;

    await fixture.componentInstance.stepDownFromOffice();

    expect(navigate).not.toHaveBeenCalled();
    expect(services().get.mock.calls.length).toBeGreaterThan(avant);
  });

  it('quitter l’office : un refus du serveur est affiché, partie et liste rechargées', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    confirm(true);
    services().setMemberRole.mockRejectedValueOnce({ error: { message: 'Refus du serveur' } });
    const avant = services().get.mock.calls.length;

    await fixture.componentInstance.stepDownFromOffice();

    expect(fixture.componentInstance['notice']()).toBe('Refus du serveur');
    expect(services().get.mock.calls.length).toBeGreaterThan(avant);
    expect(myParties().refreshAll).not.toHaveBeenCalled();
  });

  /** Clique le bouton d'une ligne de Missives portant ce libellé, puis laisse les promesses se résoudre. */
  const clickRowButton = async (
    fixture: ComponentFixture<PartieDetail>,
    row: HTMLElement,
    label: string,
  ) => {
    const bouton = Array.from(row.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(label),
    ) as HTMLButtonElement;
    bouton.click();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  };

  it('le bouton « Nommer admin » de la ligne du membre nomme CE membre', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, { members, noopAnimations: true });
    openMissives(el, fixture);
    confirm(true);
    const [, , membre] = rows(el);

    await clickRowButton(
      fixture,
      membre,
      TONE_MAP['grimoire-emeraude']['partie.ralliement_appoint_btn'],
    );

    expect(services().setMemberRole).toHaveBeenCalledTimes(1);
    expect(services().setMemberRole).toHaveBeenCalledWith('party-1', THIRD_ID, { role: 'ADMIN' });
  });

  it('le bouton « Quitter l’office » de sa propre ligne quitte l’office de SOI', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, { members, noopAnimations: true });
    openMissives(el, fixture);
    confirm(true);
    const [moi] = rows(el);

    await clickRowButton(
      fixture,
      moi,
      TONE_MAP['grimoire-emeraude']['partie.ralliement_step_down_btn'],
    );

    expect(services().setMemberRole).toHaveBeenCalledTimes(1);
    expect(services().setMemberRole).toHaveBeenCalledWith('party-1', MJ_ID, { role: 'MEMBER' });
  });

  it('un refus de « Quitter l’office » lancé depuis le pied de page reste visible hors de Missives', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, { members });
    confirm(true);
    services().setMemberRole.mockRejectedValueOnce({ error: { message: 'Refus du serveur' } });
    const bouton = Array.from(el.querySelectorAll('mat-card-actions button')).find((b) =>
      b.textContent?.includes(TONE_MAP['grimoire-emeraude']['partie.ralliement_step_down_btn']),
    ) as HTMLButtonElement;
    bouton.click();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    // L'onglet ouvert est « Conjonctions » : l'avis est hors de l'onglet Missives.
    expect(el.querySelector('p.notice')?.textContent).toContain('Refus du serveur');
  });

  it('quitter l’office relit la liste avant de choisir la confirmation (liste périmée → dernier admin)', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    confirm(false);
    // L'écran croit à deux administrateurs ; le serveur n'en renvoie plus qu'un.
    services().members.mockResolvedValueOnce(seul);

    await fixture.componentInstance.stepDownFromOffice();

    expect(dialogOpen().mock.calls[0][1].data.destructive).toBe(true);
  });

  it('le bouton « Quitter l’office » du pied de carte lance la même procédure', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, { members });
    confirm(true);
    const bouton = Array.from(el.querySelectorAll('mat-card-actions button')).find((b) =>
      b.textContent?.includes(TONE_MAP['grimoire-emeraude']['partie.ralliement_step_down_btn']),
    ) as HTMLButtonElement;
    bouton.click();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    expect(services().setMemberRole).toHaveBeenCalledWith('party-1', MJ_ID, { role: 'MEMBER' });
  });

  it('un membre ordinaire n’a pas « Quitter l’office » au pied de carte', async () => {
    const { el } = await createFixture(groupe({ role: 'member' }), THIRD_ID, { members });
    const actions = el.querySelector('mat-card-actions') as HTMLElement;
    expect(actions.textContent).not.toContain(
      TONE_MAP['grimoire-emeraude']['partie.ralliement_step_down_btn'],
    );
  });

  it('une quête : aucun rôle de groupe, pas de badge, « Retirer » inchangé', async () => {
    const { fixture, el } = await createFixture(
      makePartie({ gameSystemId: 'ryuutama', kind: 'CAMPAGNE_EPISODIQUE', ownerId: MJ_ID }),
      MJ_ID,
      { members: [member(THIRD_ID, 'Membre', 'MEMBER')], noopAnimations: true },
    );
    const text = el.textContent ?? '';
    expect(text).not.toContain(TONE_MAP['grimoire-emeraude']['partie.ralliement_appoint_btn']);
    expect(text).not.toContain(TONE_MAP['grimoire-emeraude']['partie.ralliement_step_down_btn']);
    expect(fixture.componentInstance['isGroupAdmin']()).toBe(false);
  });

  it('« Brûler » ouvre une confirmation ROUGE (variante irréversible)', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    confirm(false);
    await fixture.componentInstance.confirmDelete(groupe());
    expect(dialogOpen().mock.calls[0][1].data.destructive).toBe(true);
  });
});

// ─── Quitter un groupe ou en retirer un membre (Story 39.5) ─────────────────────────────────

describe('PartieDetail — quitter un groupe, retirer le créateur (Story 39.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const ADMIN_ID = 'admin-2';
  const groupe = (over: Partial<PartieDto> = {}) =>
    makePartie({
      gameSystemId: 'ralliement',
      kind: 'CAMPAGNE_EPISODIQUE',
      role: 'member',
      ...over,
    });
  const member = (
    userId: string,
    displayName: string,
    role: 'ADMIN' | 'MEMBER',
  ): PartieMemberDto => ({
    userId,
    pseudo: displayName.toLowerCase(),
    displayName,
    role,
    joinedAt: '2026-10-01T00:00:00Z',
  });
  /** Le créateur (`ownerId` = MJ_ID) a quitté l'office : simple membre ; un autre admin reste. */
  const members = [member(MJ_ID, 'Créateur', 'MEMBER'), member(ADMIN_ID, 'Admin', 'ADMIN')];

  const services = () =>
    TestBed.inject(PartiesService) as unknown as {
      get: ReturnType<typeof vi.fn>;
      leave: ReturnType<typeof vi.fn>;
    };
  const dialogOpen = () =>
    (TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> }).open;
  const myParties = () =>
    TestBed.inject(MyPartiesService) as unknown as { refreshAll: ReturnType<typeof vi.fn> };
  const confirm = (answer: boolean) =>
    dialogOpen().mockReturnValue({ afterClosed: () => of(answer) });
  const footerButton = (el: HTMLElement, text: string) =>
    Array.from(el.querySelectorAll('mat-card-actions button')).find((b) =>
      b.textContent?.includes(text),
    ) as HTMLButtonElement | undefined;
  const settle = async (fixture: ComponentFixture<PartieDetail>) => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  };

  it.each(THEMES)(
    'thème %s : le membre voit « Quitter le groupe » au pied de carte, sans mot de JDR',
    async (theme) => {
      const { el } = await createFixture(groupe(), MJ_ID, { members, theme });
      const tone = TONE_MAP[theme];
      const bouton = footerButton(el, tone['partie.ralliement_leave_btn']);
      expect(bouton).toBeTruthy();
      expect(bouton!.classList.contains('icon-bar__btn--danger')).toBe(false);
      expect(
        NON_JDR_BANNED_WORDS.test(el.querySelector('mat-card-actions')?.textContent ?? ''),
      ).toBe(false);
    },
  );

  it('quitter : confirmation du contrat (non rouge), départ, liste d’accueil rafraîchie, retour à l’accueil', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, { members });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    confirm(true);
    const tone = TONE_MAP['grimoire-emeraude'];

    footerButton(el, tone['partie.ralliement_leave_btn'])!.click();
    await settle(fixture);

    const data = dialogOpen().mock.calls[0][1].data;
    expect(data.message).toBe(
      'Quitter « Test Party » ? Vous n’en ferez plus partie ; un administrateur devra vous inviter à nouveau pour revenir.',
    );
    expect(data.confirmLabel).toBe('Quitter le groupe');
    expect(data.destructive).toBeUndefined();
    expect(services().leave).toHaveBeenCalledWith('party-1');
    expect(myParties().refreshAll).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('quitter, « Renoncer » : rien n’est envoyé', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    confirm(false);
    await fixture.componentInstance.leaveGroup();
    expect(services().leave).not.toHaveBeenCalled();
    expect(myParties().refreshAll).not.toHaveBeenCalled();
  });

  it('quitter : un refus du serveur s’affiche dans l’avis du groupe, la page reste et se relit', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, { members });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    confirm(true);
    services().leave.mockRejectedValueOnce({ error: { message: 'Refus du serveur' } });
    const avant = services().get.mock.calls.length;

    footerButton(el, TONE_MAP['grimoire-emeraude']['partie.ralliement_leave_btn'])!.click();
    await settle(fixture);

    expect(el.querySelector('p.notice')?.textContent).toContain('Refus du serveur');
    expect(navigate).not.toHaveBeenCalled();
    expect(myParties().refreshAll).not.toHaveBeenCalled();
    expect(services().get.mock.calls.length).toBeGreaterThan(avant);
  });

  it('quitter : sans message textuel, repli sur le libellé du thème', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, { members });
    confirm(true);
    services().leave.mockRejectedValueOnce({ status: 0 });
    await fixture.componentInstance.leaveGroup();
    expect(fixture.componentInstance['notice']()).toBe(
      TONE_MAP['grimoire-emeraude']['partie.ralliement_leave_error'],
    );
  });

  it('un administrateur n’a pas « Quitter le groupe » (il quitte d’abord l’office)', async () => {
    const { fixture, el } = await createFixture(groupe({ role: 'admin' }), ADMIN_ID, { members });
    expect(footerButton(el, TONE_MAP['grimoire-emeraude']['partie.ralliement_leave_btn'])).toBe(
      undefined,
    );
    confirm(true);
    await fixture.componentInstance.leaveGroup();
    expect(services().leave).not.toHaveBeenCalled();
  });

  it('une rencontre isolée n’a pas « Quitter le groupe », même pour un membre', async () => {
    const { el } = await createFixture(groupe({ kind: 'ONE_SHOT' }), MJ_ID, { members });
    expect(el.querySelector('mat-card-actions button')).toBeNull();
  });

  it('« Retirer » est offert sur le créateur redevenu simple membre : le rôle décide, pas ownerId', async () => {
    const { fixture, el } = await createFixture(groupe({ role: 'admin' }), ADMIN_ID, {
      members,
      noopAnimations: true,
    });
    el.querySelectorAll<HTMLElement>('div[role="tab"]')[3].click();
    fixture.detectChanges();
    const tone = TONE_MAP['grimoire-emeraude'];
    const [createur, moi] = Array.from(
      el.querySelectorAll('.ralliement-members .result-row'),
    ) as HTMLElement[];
    expect(createur.textContent).toContain(tone['partie.remove_member_btn']);
    // Jamais sur soi-même, ni sur un administrateur.
    expect(moi.textContent).not.toContain(tone['partie.remove_member_btn']);
  });
});

// ─── Conjonctions d'un groupe : cartes, création, temps réel (Story 40.1) ────────────────────

describe('PartieDetail — les conjonctions d’un groupe (Story 40.1)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());
  });

  const OTHER_ID = 'member-2';
  const groupe = (over: Partial<PartieDto> = {}) =>
    makePartie({ gameSystemId: 'ralliement', kind: 'CAMPAGNE_EPISODIQUE', role: 'admin', ...over });
  const members: PartieMemberDto[] = [
    {
      role: 'ADMIN',
      userId: MJ_ID,
      pseudo: 'createur',
      displayName: 'Créateur',
      joinedAt: '2026-10-01T00:00:00Z',
    },
  ];
  /** Clé de jour locale décalée de `days` jours (même convention que l'écran). */
  const dayKey = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${j}`;
  };
  const card = (id: string, days: number, over: Partial<EventCardDto> = {}): EventCardDto => ({
    id,
    title: `Conjonction ${id}`,
    hostId: OTHER_ID,
    hostDisplayName: 'Léa',
    seance: {
      endDate: dayKey(days),
      endSlot: 'EVENING',
      durationSlots: 1,
      id: `s-${id}`,
      date: dayKey(days),
      slot: 'EVENING',
      lieu: 'Lyon 3e',
      heureRdv: null,
      notePratique: null,
      capacity: null,
      placesTaken: 1,
    },
    participants: [],
    myInscription: null,
    cancelled: false,
    can: { propose: false, edit: false, choose: false, extend: false },
    poll: null,
    ...over,
  });
  const api = () =>
    TestBed.inject(EventsApiService) as unknown as {
      list: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  const settle = async (fixture: ComponentFixture<PartieDetail>) => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  };
  const titlesIn = (el: HTMLElement, section: string) =>
    Array.from(el.querySelectorAll(`.conjonctions__section--${section} app-event-card h4`)).map(
      (h) => (h.textContent ?? '').trim(),
    );

  it('cartes rangées : « À venir » (date croissante) puis « Passées » (la plus récente d’abord), état vide retiré', async () => {
    const { el } = await createFixture(groupe(), MJ_ID, {
      members,
      events: [card('passee-ancienne', -9), card('loin', 20), card('proche', 3), card('hier', -1)],
    });

    expect(titlesIn(el, 'upcoming')).toEqual(['Conjonction proche', 'Conjonction loin']);
    expect(titlesIn(el, 'past')).toEqual(['Conjonction hier', 'Conjonction passee-ancienne']);
    expect(el.querySelector('.conjonctions__empty')).toBeNull();
    expect(api().list).toHaveBeenCalledWith('party-1');
  });

  it('carte : titre, badge écrit, date en gras, hôte, lieu, « Ma situation » ; lieu vide = ligne omise', async () => {
    const tone = TONE_MAP['grimoire-emeraude'];
    const { el } = await createFixture(groupe(), MJ_ID, {
      members,
      events: [
        card('a', 3),
        card('b', 30, { seance: { ...card('b', 30).seance!, lieu: null } }),
        card('c', -2),
      ],
    });
    const cards = Array.from(el.querySelectorAll<HTMLElement>('app-event-card'));
    const [proche, loin, passee] = cards;

    expect(proche.querySelector('.status-badge')?.textContent?.trim()).toBe('Dans 3 jours');
    expect(proche.querySelector('.event-card__host')?.textContent?.trim()).toBe('Hôte : Léa');
    expect(proche.querySelector('.event-card__place')?.textContent?.trim()).toBe('Lyon 3e');
    expect(proche.querySelector('.event-card__date')?.textContent).toMatch(/ · soir$/);
    expect(proche.querySelector('.event-card__chip')?.textContent?.trim()).toBe(
      tone['partie.ralliement_event_chip_not_registered'],
    );
    expect(proche.querySelector('.event-card__chip--dotted')).not.toBeNull();
    expect(loin.querySelector('.status-badge')?.textContent?.trim()).toBe(
      tone['status.scenario_a_venir'],
    );
    expect(loin.querySelector('.event-card__place')).toBeNull();
    expect(passee.querySelector('.status-badge')?.textContent?.trim()).toBe(
      tone['status.scenario_passe'],
    );
    // Aucun mot de JDR sur une carte.
    for (const c of cards) expect(NON_JDR_BANNED_WORDS.test(c.textContent ?? '')).toBe(false);
  });

  it('l’hôte lit « Je participe » (« J’y étais » une fois passée)', async () => {
    const tone = TONE_MAP['grimoire-emeraude'];
    const { el } = await createFixture(groupe({ role: 'member' }), OTHER_ID, {
      members,
      events: [card('futur', 2), card('passe', -2)],
    });
    const chips = Array.from(el.querySelectorAll('.event-card__chip')).map((c) =>
      (c.textContent ?? '').trim(),
    );
    expect(chips).toEqual([
      tone['partie.ralliement_event_chip_participating'],
      tone['partie.ralliement_event_chip_was_there'],
    ]);
  });

  it('temps réel : un signal de la partie recharge la liste, la nouvelle carte apparaît sans rechargement', async () => {
    const { fixture, el } = await createFixture(groupe({ role: 'member' }), OTHER_ID, { members });
    expect(el.querySelector('app-event-card')).toBeNull();

    api().list.mockResolvedValue([card('nouvelle', 4)]);
    TestBed.inject(PartiesService).notifyChanged();
    await settle(fixture);

    expect(titlesIn(el, 'upcoming')).toEqual(['Conjonction nouvelle']);
    expect(el.querySelector('.conjonctions__empty')).toBeNull();
  });

  it('temps réel : un échec transitoire ne vide jamais la liste affichée', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, {
      members,
      events: [card('reste', 4)],
    });
    api().list.mockRejectedValue(new Error('réseau'));
    TestBed.inject(PartiesService).notifyChanged();
    await settle(fixture);

    expect(titlesIn(el, 'upcoming')).toEqual(['Conjonction reste']);
    const tone = TONE_MAP['grimoire-emeraude'];
    expect(el.querySelector('.conjonctions__error')?.textContent?.trim()).toBe(
      tone['partie.ralliement_event_list_error'],
    );
  });

  it('dernier administrateur depuis un autre onglet : le nombre est relu au moment de l’avertissement, jamais une valeur périmée', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, {
      members,
      noopAnimations: true,
    });
    // L'onglet des conjonctions est quitté (son contenu est détruit) avant toute nouvelle conjonction.
    el.querySelectorAll<HTMLElement>('div[role="tab"]')[3].click();
    await settle(fixture);
    api().list.mockResolvedValue([card('a', 3), card('b', 6), card('c', -5)]);
    const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    await fixture.componentInstance.stepDownFromOffice();

    expect(dialog.open.mock.calls[0][1].data.message).toBe(
      fillTone(TONE_MAP['grimoire-emeraude']['partie.ralliement_last_admin_confirm'], {
        partie: 'Test Party',
        members: 1,
        conjonctions: 3,
      }),
    );
  });

  it('dernier administrateur : la relecture échoue → repli sur la dernière valeur connue', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, {
      members,
      events: [card('a', 3), card('b', 6)],
    });
    api().list.mockRejectedValue(new Error('réseau'));
    const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    await fixture.componentInstance.stepDownFromOffice();

    expect(dialog.open.mock.calls[0][1].data.message).toContain('conjonctions : 2');
  });

  it('dernier administrateur : l’avertissement cite le nombre RÉEL de conjonctions (passées comprises)', async () => {
    const { fixture } = await createFixture(groupe(), MJ_ID, {
      members,
      events: [card('a', 3), card('b', -5)],
    });
    const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    await fixture.componentInstance.stepDownFromOffice();

    const tone = TONE_MAP['grimoire-emeraude'];
    expect(dialog.open.mock.calls[0][1].data.message).toBe(
      fillTone(tone['partie.ralliement_last_admin_confirm'], {
        partie: 'Test Party',
        members: 1,
        conjonctions: 2,
      }),
    );
  });

  it('création réussie : la fenêtre se referme, la carte apparaît dans « À venir » et la liste est relue', async () => {
    const { fixture, el } = await createFixture(groupe({ role: 'member' }), OTHER_ID, { members });
    el.querySelector<HTMLButtonElement>('.conjonctions__new')!.click();
    await settle(fixture);
    const type = async (sel: string, value: string) => {
      const input = document.body.querySelector<HTMLInputElement>(sel)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await settle(fixture);
    };
    await type('.ec__name', 'Conjonction nouvelle');
    await type('.ec__day', dayKey(4));
    api().create.mockResolvedValue(card('nouvelle', 4));
    api().list.mockResolvedValue([card('nouvelle', 4)]);
    const listCalls = api().list.mock.calls.length;

    document.body.querySelector<HTMLButtonElement>('.ec__submit')!.click();
    await settle(fixture);

    expect(api().create).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('app-detail-surface')).toBeNull();
    expect(titlesIn(el, 'upcoming')).toEqual(['Conjonction nouvelle']);
    expect(api().list.mock.calls.length).toBeGreaterThan(listCalls);
  });

  it('« + Nouvelle conjonction » ouvre la fenêtre de création ; « Renoncer » la referme sans rien envoyer', async () => {
    const { fixture, el } = await createFixture(groupe({ role: 'member' }), OTHER_ID, { members });
    el.querySelector<HTMLButtonElement>('.conjonctions__new')!.click();
    await settle(fixture);

    const surface = document.body.querySelector('app-detail-surface .detail-surface-panel');
    expect(surface?.classList).toContain('detail-surface-panel--wide');
    expect(surface?.getAttribute('aria-label')).toBe(
      TONE_MAP['grimoire-emeraude']['partie.ralliement_event_create_title'],
    );

    document.body.querySelector<HTMLButtonElement>('.ec__cancel')!.click();
    await settle(fixture);
    expect(document.body.querySelector('app-detail-surface')).toBeNull();
    expect(api().create).not.toHaveBeenCalled();
  });
});

// ─── Fenêtre d'une conjonction : consulter, modifier, fermer (Story 40.2) ────────────────────

describe('PartieDetail — la fenêtre d’une conjonction (Story 40.2)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());
    vi.restoreAllMocks();
  });

  const HOST_ID = 'member-host';
  const GUEST_ID = 'member-guest';
  const tone = TONE_MAP['grimoire-emeraude'];
  const groupe = (over: Partial<PartieDto> = {}) =>
    makePartie({
      gameSystemId: 'ralliement',
      kind: 'CAMPAGNE_EPISODIQUE',
      role: 'member',
      ...over,
    });
  const dayKey = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${j}`;
  };
  const card = (id: string, days: number, over: Partial<EventCardDto> = {}): EventCardDto => ({
    id,
    title: `Conjonction ${id}`,
    hostId: HOST_ID,
    hostDisplayName: 'Hélène Hôte',
    seance: {
      endDate: dayKey(days),
      endSlot: 'EVENING',
      durationSlots: 1,
      id: `s-${id}`,
      date: dayKey(days),
      slot: 'EVENING',
      lieu: 'Lyon 3e',
      heureRdv: '20:30',
      notePratique: 'Apportez un jeu',
      capacity: 8,
      placesTaken: 3,
    },
    participants: [
      {
        userId: HOST_ID,
        displayName: 'Hélène Hôte',
        isHost: true,
        isAdmin: false,
        status: 'CONFIRMED',
      },
      {
        userId: 'a1',
        displayName: 'Alice Admin',
        isHost: false,
        isAdmin: true,
        status: 'CONFIRMED',
      },
      {
        userId: GUEST_ID,
        displayName: 'Gaël Invité',
        isHost: false,
        isAdmin: false,
        status: 'CONFIRMED',
      },
    ],
    myInscription: null,
    cancelled: false,
    can: { propose: false, edit: false, choose: false, extend: false },
    poll: null,
    ...over,
  });
  const api = () =>
    TestBed.inject(EventsApiService) as unknown as {
      list: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      inscrire: ReturnType<typeof vi.fn>;
      desinscrire: ReturnType<typeof vi.fn>;
      accepter: ReturnType<typeof vi.fn>;
      reserver: ReturnType<typeof vi.fn>;
      retirerReservation: ReturnType<typeof vi.fn>;
    };
  const settle = async (fixture: ComponentFixture<PartieDetail>) => {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  };
  const q = <T extends Element>(sel: string) => document.body.querySelector<T>(sel);
  const cardEl = (el: HTMLElement, id: string) =>
    el.querySelector<HTMLElement>(`button[data-event-id="${id}"]`)!;
  const open = async (fixture: ComponentFixture<PartieDetail>, el: HTMLElement, id: string) => {
    cardEl(el, id).click();
    await settle(fixture);
  };

  it('le titre de la carte est un bouton natif nommé par le titre ; la carte reste un article lu en entier, sans gestionnaire de clavier', async () => {
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
      members: [],
      events: [card('a', 3)],
    });
    const button = cardEl(el, 'a');
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.textContent?.trim()).toBe('Conjonction a');
    // La carte n'est plus un rôle « bouton » : date, badge et chip restent exposés aux lecteurs d'écran.
    const article = button.closest('article')!;
    expect(article.getAttribute('role')).toBeNull();
    expect(article.getAttribute('tabindex')).toBeNull();
    expect(article.getAttribute('aria-label')).toBeNull();
    expect(article.querySelector('.event-card__date')).not.toBeNull();
    expect(article.querySelector('.status-badge')).not.toBeNull();
    expect(article.querySelector('.event-card__chip')).not.toBeNull();

    // Entrée (à l'appui) et Espace (au relâchement) sont l'activation NATIVE du bouton : un « clic »
    // ouvre la fenêtre ; aucune touche n'est interceptée par la carte.
    const keydown = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    button.dispatchEvent(keydown);
    expect(keydown.defaultPrevented).toBe(false);
    expect(q('app-event-dialog')).toBeNull();
    button.click();
    await settle(fixture);
    const panel = q('.detail-surface-panel');
    expect(panel?.getAttribute('aria-label')).toBe('Conjonction a');
    expect(panel?.classList).toContain('detail-surface-panel--wide');
  });

  it('ordre du contrat : titre + badge → situation → fiche → participants → pied', async () => {
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
      members: [],
      events: [card('a', 3)],
    });
    await open(fixture, el, 'a');

    const order = [
      '.ed__title',
      '.ed__badge',
      '.ed__situation',
      '.ed__sheet',
      '.ed__participants',
      '.ed__footer',
    ];
    const nodes = order.map((sel) => q(sel)!);
    for (let i = 1; i < nodes.length; i++) {
      expect(
        nodes[i - 1].compareDocumentPosition(nodes[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
        order[i],
      ).toBeTruthy();
    }
    expect(q('.ed__title')?.textContent?.trim()).toBe('Conjonction a');
    expect(q('.ed__badge')?.textContent?.trim()).toBe('Dans 3 jours');
    // Panneau de situation : ma situation, puis date, heure et lieu en grand ; ni vote ni inscription.
    expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
      tone['partie.ralliement_event_situation_registered'],
    );
    expect(q('.ed__big--date')?.textContent).toMatch(/ · soir$/);
    expect(q('.ed__big--time')?.textContent?.trim()).toBe('Rendez-vous à 20:30');
    expect(q('.ed__big--place')?.textContent?.trim()).toBe('Lyon 3e');
    expect(q('.ed__situation button')).toBeNull();
    // Le focus entre dans la fenêtre.
    expect(q('.detail-surface-panel')!.contains(document.activeElement)).toBe(true);
  });

  it('un membre qui n’est pas inscrit lit « Pas inscrit·e » dans le panneau, avec « S’inscrire » (Story 40.3) mais sans bouton de vote ni de désinscription', async () => {
    const { fixture, el } = await createFixture(groupe(), 'autre-membre', {
      members: [],
      events: [card('a', 3)],
    });
    await open(fixture, el, 'a');
    expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
      tone['partie.ralliement_event_situation_none'],
    );
    // Le seul bouton du panneau est « S'inscrire » (aucun vote dans la fenêtre).
    expect(
      Array.from(document.body.querySelectorAll('.ed__situation button')).map((b) =>
        b.textContent?.trim(),
      ),
    ).toEqual([tone['partie.ralliement_event_signup_btn']]);
    expect(q('.ed__actions button:not(.ed__close)')).toBeNull();
  });

  it('fiche : date, hôte, lieu, heure, « 8 places · 3 inscrits · 5 libres », infos pratiques', async () => {
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
      members: [],
      events: [card('a', 3)],
    });
    await open(fixture, el, 'a');

    const rows = Array.from(document.body.querySelectorAll('.ed__row')).map((r) => [
      r.querySelector('dt')?.textContent?.trim(),
      r.querySelector('dd')?.textContent?.trim(),
    ]);
    expect(rows.map((r) => r[0])).toEqual([
      tone['partie.ralliement_event_sheet_date'],
      tone['partie.ralliement_event_sheet_host'],
      tone['partie.ralliement_event_sheet_place'],
      tone['partie.ralliement_event_sheet_time'],
      tone['partie.ralliement_event_sheet_participation'],
      tone['partie.ralliement_event_sheet_note'],
    ]);
    expect(rows[1][1]).toBe('Hélène Hôte');
    expect(rows[3][1]).toBe('20:30');
    expect(rows[4][1]).toBe('8 places · 3 inscrits · 5 libres');
    expect(rows[5][1]).toBe('Apportez un jeu');
  });

  it('« Tous les membres » sans limite ; lieu, heure et infos vides : lignes omises', async () => {
    const base = card('a', 3);
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
      members: [],
      events: [
        {
          ...base,
          seance: {
            ...base.seance!,
            capacity: null,
            lieu: null,
            heureRdv: null,
            notePratique: null,
          },
        },
      ],
    });
    await open(fixture, el, 'a');

    expect(q('.ed__row--participation dd')?.textContent?.trim()).toBe('Tous les membres');
    for (const row of ['place', 'time', 'note']) expect(q(`.ed__row--${row}`)).toBeNull();
    expect(q('.ed__big--time')).toBeNull();
    expect(q('.ed__big--place')).toBeNull();
  });

  it('participants : avatar 26 px + nom, la personne connectée cerclée et « vous » écrit, écu 14 px ET mot « Admin »', async () => {
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
      members: [],
      events: [card('a', 3)],
    });
    await open(fixture, el, 'a');

    const chips = Array.from(document.body.querySelectorAll('app-participant-chip'));
    expect(chips.map((c) => c.querySelector('.pc__name')?.textContent?.trim())).toEqual([
      'Hélène Hôte',
      'Alice Admin',
      'Gaël Invité',
    ]);
    expect(chips[0].querySelector('.pc__avatar')?.textContent?.trim()).toBe('HH');
    // L'administrateur : écu de 14 px à l'angle ET le mot « Admin », jamais le pictogramme seul.
    // Story 51.4 : l'écu dessiné à la main devient l'icône `role-admin` du jeu (14 px, décorative).
    const shield = chips[1].querySelector('app-icon.pc__shield');
    expect(shield?.getAttribute('data-icon')).toBe('role-admin');
    expect(shield?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(chips[1].querySelector('.pc__tag--admin')?.textContent?.trim()).toBe(
      tone['partie.ralliement_admin_badge'],
    );
    // Les autres n'ont ni écu ni mot « Admin ».
    for (const c of [chips[0], chips[2]]) {
      expect(c.querySelector('app-icon')).toBeNull();
      expect(c.querySelector('.pc__tag--admin')).toBeNull();
    }
    // La personne connectée (Gaël) : filet d'accent ET « (vous) » écrit.
    expect(chips[2].querySelector('.pc--self')).not.toBeNull();
    expect(chips[2].querySelector('.pc__tag--self')?.textContent?.trim()).toBe(
      `(${tone['partie.ralliement_event_participant_self']})`,
    );
    expect(chips[0].querySelector('.pc--self')).toBeNull();
    expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
      tone['partie.ralliement_event_situation_registered'],
    );
  });

  it('« Refermer » ferme la fenêtre, rend le focus à la carte et laisse la liste intacte', async () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
      members: [],
      events: [card('a', 3), card('b', 6)],
    });
    const before = Array.from(el.querySelectorAll('app-event-card'));
    await open(fixture, el, 'b');
    expect(q('app-event-dialog')).not.toBeNull();

    q<HTMLButtonElement>('.ed__close')!.click();
    await settle(fixture);

    expect(q('app-event-dialog')).toBeNull();
    expect(document.activeElement).toBe(cardEl(el, 'b'));
    // Les mêmes éléments de la liste : rien n'a été re-rendu (filtres et défilement préservés).
    expect(Array.from(el.querySelectorAll('app-event-card'))).toEqual(before);
    // L'entrée d'historique ajoutée à l'ouverture est retirée.
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('Échap ferme la fenêtre et rend le focus à la carte', async () => {
    vi.spyOn(history, 'back').mockImplementation(() => undefined);
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
      members: [],
      events: [card('a', 3)],
    });
    await open(fixture, el, 'a');

    q('.detail-surface-panel')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await settle(fixture);

    expect(q('app-event-dialog')).toBeNull();
    expect(document.activeElement).toBe(cardEl(el, 'a'));
  });

  it('le bouton retour du navigateur ferme la fenêtre (entrée d’historique propre) et rend le focus', async () => {
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
      members: [],
      events: [card('a', 3)],
    });
    const pushState = vi.spyOn(history, 'pushState');
    await open(fixture, el, 'a');
    // Une entrée de plus, même URL ; l'état du routeur existant est conservé.
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(pushState.mock.calls[0][2]).toBeUndefined();
    expect((history.state as Record<string, unknown>)['conjonctionDialog']).toBe('a');
    expect(q('app-event-dialog')).not.toBeNull();

    // « Retour » : le navigateur revient à l'entrée précédente, sans le marqueur de la fenêtre.
    history.replaceState({}, '');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await settle(fixture);

    expect(q('app-event-dialog')).toBeNull();
    expect(document.activeElement).toBe(cardEl(el, 'a'));
  });

  it('temps réel : la fenêtre ouverte suit la liste vivante (participants, lieu) sans rechargement', async () => {
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
      members: [],
      events: [card('a', 3)],
    });
    await open(fixture, el, 'a');
    expect(document.body.querySelectorAll('app-participant-chip').length).toBe(3);

    const base = card('a', 3);
    api().list.mockResolvedValue([
      {
        ...base,
        title: 'Conjonction a (renommée)',
        seance: { ...base.seance!, lieu: 'Paris 11e', placesTaken: 4 },
        participants: [
          ...base.participants,
          {
            userId: 'n1',
            displayName: 'Nina Nouvelle',
            isHost: false,
            isAdmin: false,
            status: 'CONFIRMED' as const,
          },
        ],
      },
    ]);
    TestBed.inject(PartiesService).notifyChanged();
    await settle(fixture);

    expect(document.body.querySelectorAll('app-participant-chip').length).toBe(4);
    expect(q('.ed__title')?.textContent?.trim()).toBe('Conjonction a (renommée)');
    expect(q('.ed__row--place dd')?.textContent?.trim()).toBe('Paris 11e');
    expect(q('.ed__row--participation dd')?.textContent?.trim()).toBe(
      '8 places · 4 inscrits · 4 libres',
    );
  });

  it('la conjonction ouverte disparaît de la liste : la fenêtre se referme', async () => {
    vi.spyOn(history, 'back').mockImplementation(() => undefined);
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
      members: [],
      events: [card('a', 3), card('b', 5)],
    });
    await open(fixture, el, 'a');

    api().list.mockResolvedValue([card('b', 5)]);
    TestBed.inject(PartiesService).notifyChanged();
    await settle(fixture);

    expect(q('app-event-dialog')).toBeNull();
  });

  describe('pied : « Modifier » pour l’hôte seul, tant que la conjonction n’est pas passée', () => {
    it('un autre membre n’a que « Refermer »', async () => {
      const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
        members: [],
        events: [card('a', 3)],
      });
      await open(fixture, el, 'a');
      expect(q('.ed__edit')).toBeNull();
      expect(q('.ed__close')?.textContent?.trim()).toBe(tone['partie.ralliement_event_close_btn']);
    });

    it('l’hôte voit « Modifier » puis « Refermer » ; plus de « Modifier » une fois passée', async () => {
      const { fixture, el } = await createFixture(groupe(), HOST_ID, {
        members: [],
        events: [card('a', 3), card('p', -3)],
      });
      await open(fixture, el, 'a');
      const labels = Array.from(document.body.querySelectorAll('.ed__actions button')).map((b) =>
        b.textContent?.trim(),
      );
      // Story 42.1 (⚠️ attente modifiée) : l'hôte voit aussi « Annuler la conjonction », en premier.
      expect(labels).toEqual([
        tone['partie.ralliement_event_cancel_event_btn'],
        tone['partie.ralliement_event_edit_btn'],
        tone['partie.ralliement_event_close_btn'],
      ]);
      expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_situation_host'],
      );
      q<HTMLButtonElement>('.ed__close')!.click();
      await settle(fixture);

      await open(fixture, el, 'p');
      expect(q('.ed__edit')).toBeNull();
      expect(q('.ed__close')).not.toBeNull();
      expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_situation_host_past'],
      );
    });
  });

  describe('mode édition', () => {
    const type = async (fixture: ComponentFixture<PartieDetail>, sel: string, value: string) => {
      const input = q<HTMLInputElement | HTMLTextAreaElement>(sel)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await settle(fixture);
    };

    it('« Modifier » bascule la même fenêtre : champs préremplis, pied « Renoncer » · « Enregistrer »', async () => {
      const { fixture, el } = await createFixture(groupe(), HOST_ID, {
        members: [],
        events: [card('a', 3)],
      });
      await open(fixture, el, 'a');
      q<HTMLButtonElement>('.ed__edit')!.click();
      await settle(fixture);

      expect(q('app-detail-surface')).not.toBeNull();
      expect(q('.detail-surface-panel')?.getAttribute('aria-label')).toBe(
        tone['partie.ralliement_event_edit_title'],
      );
      expect(q<HTMLInputElement>('.ec__name')!.value).toBe('Conjonction a');
      expect(q<HTMLInputElement>('.ec__day')!.value).toBe(dayKey(3));
      expect(q<HTMLInputElement>('.ec__place')!.value).toBe('Lyon 3e');
      expect(q<HTMLInputElement>('.ec__time')!.value).toBe('20:30');
      expect(q<HTMLInputElement>('.ec__places-count')!.value).toBe('8');
      expect(q('.ed__situation')).toBeNull();
      const labels = Array.from(document.body.querySelectorAll('.ed__actions button')).map((b) =>
        b.textContent?.trim(),
      );
      expect(labels).toEqual([
        tone['partie.ralliement_event_cancel_btn'],
        tone['partie.ralliement_event_save_btn'],
      ]);

      // « Renoncer » revient à la fiche, rien n'est envoyé.
      q<HTMLButtonElement>('.ed__cancel')!.click();
      await settle(fixture);
      expect(q('.ed__situation')).not.toBeNull();
      expect(api().update).not.toHaveBeenCalled();
    });

    it('« Enregistrer » envoie le remplacement complet, revient à la fiche mise à jour et relit la liste', async () => {
      const { fixture, el } = await createFixture(groupe(), HOST_ID, {
        members: [],
        events: [card('a', 3)],
      });
      await open(fixture, el, 'a');
      q<HTMLButtonElement>('.ed__edit')!.click();
      await settle(fixture);
      await type(fixture, '.ec__name', '  Soirée renommée ');
      await type(fixture, '.ec__place', '');

      const base = card('a', 3);
      const updated: EventCardDto = {
        ...base,
        title: 'Soirée renommée',
        seance: { ...base.seance!, lieu: null },
      };
      api().update.mockResolvedValue(updated);
      api().list.mockResolvedValue([updated]);
      const listCalls = api().list.mock.calls.length;
      q<HTMLButtonElement>('.ed__save')!.click();
      await settle(fixture);

      expect(api().update).toHaveBeenCalledWith('party-1', 'a', {
        title: 'Soirée renommée',
        date: dayKey(3),
        slot: 'EVENING',
        lieu: null,
        heureRdv: '20:30',
        notePratique: 'Apportez un jeu',
        capacity: 8,
      });
      expect(q('.ed__situation')).not.toBeNull();
      expect(q('.ed__title')?.textContent?.trim()).toBe('Soirée renommée');
      expect(q('.ed__row--place')).toBeNull();
      expect(api().list.mock.calls.length).toBeGreaterThan(listCalls);
      expect(titleOfCard(el, 'a')).toBe('Soirée renommée');
    });

    it('refus du serveur : message français dans la fenêtre, on reste en édition ; repli du thème sans texte', async () => {
      const { fixture, el } = await createFixture(groupe(), HOST_ID, {
        members: [],
        events: [card('a', 3)],
      });
      await open(fixture, el, 'a');
      q<HTMLButtonElement>('.ed__edit')!.click();
      await settle(fixture);

      api().update.mockRejectedValueOnce({
        error: {
          message:
            'Le nombre de places ne peut pas être inférieur au nombre de participants actuels (3)',
        },
      });
      q<HTMLButtonElement>('.ed__save')!.click();
      await settle(fixture);
      expect(q('.ed__error')?.textContent?.trim()).toContain('participants actuels (3)');
      expect(q('.ec__name')).not.toBeNull();

      api().update.mockRejectedValueOnce({ status: 0 });
      q<HTMLButtonElement>('.ed__save')!.click();
      await settle(fixture);
      expect(q('.ed__error')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_update_error'],
      );
    });

    it('« Enregistrer » reste désactivé sans nom', async () => {
      const { fixture, el } = await createFixture(groupe(), HOST_ID, {
        members: [],
        events: [card('a', 3)],
      });
      await open(fixture, el, 'a');
      q<HTMLButtonElement>('.ed__edit')!.click();
      await settle(fixture);
      await type(fixture, '.ec__name', '   ');
      expect(q<HTMLButtonElement>('.ed__save')!.disabled).toBe(true);
    });
  });

  // ─── Story 40.3 : s'inscrire à une conjonction et s'en désinscrire ───────────────────────────────

  describe('inscription et désinscription (Story 40.3)', () => {
    const NEWCOMER = 'autre-membre';
    const SIGNUP = '.ed__signup';
    const UNSUBSCRIBE = '.ed__unsubscribe';
    const participant = (userId: string, name: string): EventCardDto['participants'][number] => ({
      userId,
      displayName: name,
      isHost: false,
      isAdmin: false,
      status: 'CONFIRMED',
    });
    /** La carte après l'inscription de NEWCOMER (réponse du serveur). */
    const withNewcomer = (id: string, days: number, over: Partial<EventCardDto> = {}) => {
      const base = card(id, days, over);
      return {
        ...base,
        seance: { ...base.seance!, placesTaken: base.seance!.placesTaken + 1 },
        participants: [...base.participants, participant(NEWCOMER, 'Nora Nouvelle')],
      };
    };
    const buttonLabels = (selector: string) =>
      Array.from(document.body.querySelectorAll(selector)).map((b) => b.textContent?.trim());

    it('« S’inscrire » : un appel, la fenêtre et la liste reflètent le nouvel inscrit, le bouton laisse place à « Me désinscrire »', async () => {
      const { fixture, el } = await createFixture(groupe(), NEWCOMER, {
        members: [],
        events: [card('a', 3)],
      });
      await open(fixture, el, 'a');
      expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_situation_none'],
      );
      expect(q('.event-card__chip--dotted')).not.toBeNull();

      const updated = withNewcomer('a', 3);
      api().inscrire.mockResolvedValue(updated);
      api().list.mockResolvedValue([updated]);
      q<HTMLButtonElement>(SIGNUP)!.click();
      await settle(fixture);

      expect(api().inscrire).toHaveBeenCalledTimes(1);
      expect(api().inscrire).toHaveBeenCalledWith('s-a');
      // Participants, ligne de participation, texte de situation et chip suivent la carte.
      expect(document.body.querySelectorAll('app-participant-chip').length).toBe(4);
      expect(q('.ed__row--participation dd')?.textContent?.trim()).toBe(
        '8 places · 4 inscrits · 4 libres',
      );
      expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_situation_registered'],
      );
      expect(q(SIGNUP)).toBeNull();
      expect(buttonLabels('.ed__actions button')).toEqual([
        tone['partie.ralliement_event_unsubscribe_btn'],
        tone['partie.ralliement_event_close_btn'],
      ]);
      expect(
        cardEl(el, 'a').closest('article')!.querySelector('.event-card__chip')?.textContent?.trim(),
      ).toBe(tone['partie.ralliement_event_chip_participating']);
      expect(q('.event-card__chip--dotted')).toBeNull();
    });

    it('« Me désinscrire » : un appel, le participant disparaît, « S’inscrire » revient', async () => {
      const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
        members: [],
        events: [card('a', 3)],
      });
      await open(fixture, el, 'a');
      expect(buttonLabels('.ed__actions button')).toEqual([
        tone['partie.ralliement_event_unsubscribe_btn'],
        tone['partie.ralliement_event_close_btn'],
      ]);

      const base = card('a', 3);
      const updated = {
        ...base,
        participants: base.participants.filter((p) => p.userId !== GUEST_ID),
      };
      api().desinscrire.mockResolvedValue(updated);
      api().list.mockResolvedValue([updated]);
      q<HTMLButtonElement>(UNSUBSCRIBE)!.click();
      await settle(fixture);

      expect(api().desinscrire).toHaveBeenCalledWith('s-a');
      expect(document.body.querySelectorAll('app-participant-chip').length).toBe(2);
      expect(q(UNSUBSCRIBE)).toBeNull();
      expect(q(SIGNUP)).not.toBeNull();
      expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_situation_none'],
      );
    });

    it('l’hôte ne voit ni « S’inscrire » ni « Me désinscrire » : il garde « Modifier »', async () => {
      const { fixture, el } = await createFixture(groupe(), HOST_ID, {
        members: [],
        events: [card('a', 3)],
      });
      await open(fixture, el, 'a');
      expect(q(SIGNUP)).toBeNull();
      expect(q(UNSUBSCRIBE)).toBeNull();
      // Story 42.1 (⚠️ attente modifiée) : « Annuler la conjonction » précède « Modifier » pour l'hôte.
      expect(buttonLabels('.ed__actions button')).toEqual([
        tone['partie.ralliement_event_cancel_event_btn'],
        tone['partie.ralliement_event_edit_btn'],
        tone['partie.ralliement_event_close_btn'],
      ]);
    });

    it('une conjonction passée : aucun bouton d’inscription ni de désinscription', async () => {
      for (const viewer of [NEWCOMER, GUEST_ID]) {
        const { fixture, el } = await createFixture(groupe(), viewer, {
          members: [],
          events: [card('p', -3)],
        });
        await open(fixture, el, 'p');
        expect(q(SIGNUP), viewer).toBeNull();
        expect(q(UNSUBSCRIBE), viewer).toBeNull();
        q<HTMLButtonElement>('.ed__close')!.click();
        await settle(fixture);
        TestBed.resetTestingModule();
        document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());
      }
    });

    describe('complet', () => {
      const fullCard = (id: string, over: Partial<EventCardDto> = {}) => {
        const base = card(id, 3, over);
        return { ...base, seance: { ...base.seance!, capacity: 3 } };
      };

      it('non inscrit : badge « Complet » grisé sur la carte et dans la fenêtre, « Complet » écrit à la place de « S’inscrire »', async () => {
        const { fixture, el } = await createFixture(groupe(), NEWCOMER, {
          members: [],
          events: [fullCard('a')],
        });
        const badge = cardEl(el, 'a').closest('article')!.querySelector('.status-badge');
        expect(badge?.textContent?.trim()).toBe(tone['partie.ralliement_event_badge_full']);
        expect(badge?.classList).toContain('status-badge--done');

        await open(fixture, el, 'a');
        expect(q('.ed__badge')?.textContent?.trim()).toBe(
          tone['partie.ralliement_event_badge_full'],
        );
        expect(q(SIGNUP)).toBeNull();
        expect(q('.ed__full')?.textContent?.trim()).toBe(
          tone['partie.ralliement_event_situation_full'],
        );
      });

      it('inscrit ou hôte : badge normal, jamais « Complet »', async () => {
        for (const viewer of [GUEST_ID, HOST_ID]) {
          const { fixture, el } = await createFixture(groupe(), viewer, {
            members: [],
            events: [fullCard('a')],
          });
          const badge = cardEl(el, 'a').closest('article')!.querySelector('.status-badge');
          expect(badge?.textContent?.trim(), viewer).toBe('Dans 3 jours');
          await open(fixture, el, 'a');
          expect(q('.ed__full'), viewer).toBeNull();
          q<HTMLButtonElement>('.ed__close')!.click();
          await settle(fixture);
          TestBed.resetTestingModule();
          document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());
        }
      });

      it('en direct : la dernière place prise par un autre membre fait apparaître « Complet » dans la fenêtre ouverte', async () => {
        const base = card('a', 3);
        const open7 = {
          ...base,
          participants: base.participants.slice(0, 2),
          seance: { ...base.seance!, capacity: 3, placesTaken: 2 },
        };
        const { fixture, el } = await createFixture(groupe(), NEWCOMER, {
          members: [],
          events: [open7],
        });
        await open(fixture, el, 'a');
        expect(q(SIGNUP)).not.toBeNull();
        expect(q('.ed__full')).toBeNull();

        api().list.mockResolvedValue([fullCard('a')]);
        TestBed.inject(PartiesService).notifyChanged();
        await settle(fixture);

        expect(q(SIGNUP)).toBeNull();
        expect(q('.ed__full')).not.toBeNull();
        expect(q('.ed__badge')?.textContent?.trim()).toBe(
          tone['partie.ralliement_event_badge_full'],
        );
      });

      it('course perdue : le serveur répond « complet », le message s’affiche dans la fenêtre et le bouton redevient actif', async () => {
        const { fixture, el } = await createFixture(groupe(), NEWCOMER, {
          members: [],
          events: [card('a', 3)],
        });
        await open(fixture, el, 'a');

        api().inscrire.mockRejectedValue({
          status: 409,
          error: { message: 'Cette conjonction est complète : plus aucune place disponible' },
        });
        q<HTMLButtonElement>(SIGNUP)!.click();
        await settle(fixture);

        expect(q('.ed__error')?.textContent?.trim()).toBe(
          'Cette conjonction est complète : plus aucune place disponible',
        );
        expect(q<HTMLButtonElement>(SIGNUP)!.disabled).toBe(false);
        expect(q('app-event-dialog')).not.toBeNull();
      });
    });

    it('refus sans texte (réseau) : repli du thème pour l’inscription et pour la désinscription', async () => {
      const first = await createFixture(groupe(), NEWCOMER, {
        members: [],
        events: [card('a', 3)],
      });
      await open(first.fixture, first.el, 'a');
      api().inscrire.mockRejectedValue({ status: 0 });
      q<HTMLButtonElement>(SIGNUP)!.click();
      await settle(first.fixture);
      expect(q('.ed__error')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_signup_error'],
      );
      TestBed.resetTestingModule();
      document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());

      const second = await createFixture(groupe(), GUEST_ID, {
        members: [],
        events: [card('a', 3)],
      });
      await open(second.fixture, second.el, 'a');
      api().desinscrire.mockRejectedValue({ status: 0 });
      q<HTMLButtonElement>(UNSUBSCRIBE)!.click();
      await settle(second.fixture);
      expect(q('.ed__error')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_unsubscribe_error'],
      );
    });

    it('garde anti double clic : le bouton est désactivé et occupé pendant l’appel, un seul appel part', async () => {
      const { fixture, el } = await createFixture(groupe(), NEWCOMER, {
        members: [],
        events: [card('a', 3)],
      });
      await open(fixture, el, 'a');

      let release!: (value: EventCardDto) => void;
      api().inscrire.mockReturnValue(
        new Promise<EventCardDto>((resolve) => {
          release = resolve;
        }),
      );
      const button = q<HTMLButtonElement>(SIGNUP)!;
      button.click();
      await settle(fixture);
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-busy')).toBe('true');
      button.click();
      button.click();
      await settle(fixture);
      expect(api().inscrire).toHaveBeenCalledTimes(1);

      const updated = withNewcomer('a', 3);
      api().list.mockResolvedValue([updated]);
      release(updated);
      await settle(fixture);
      expect(q(SIGNUP)).toBeNull();
    });

    it('en direct : l’inscription d’un autre membre met à jour la fenêtre ouverte (liste, ligne de participation)', async () => {
      const { fixture, el } = await createFixture(groupe(), NEWCOMER, {
        members: [],
        events: [card('a', 3)],
      });
      await open(fixture, el, 'a');
      expect(document.body.querySelectorAll('app-participant-chip').length).toBe(3);

      const base = card('a', 3);
      api().list.mockResolvedValue([
        {
          ...base,
          seance: { ...base.seance!, placesTaken: 4 },
          participants: [...base.participants, participant('n9', 'Noé Neuf')],
        },
      ]);
      TestBed.inject(PartiesService).notifyChanged();
      await settle(fixture);

      expect(document.body.querySelectorAll('app-participant-chip').length).toBe(4);
      expect(q('.ed__row--participation dd')?.textContent?.trim()).toBe(
        '8 places · 4 inscrits · 4 libres',
      );
      // Toujours non inscrit : « S'inscrire » reste proposé.
      expect(q(SIGNUP)).not.toBeNull();
    });

    it('aucun mot de JDR dans les libellés d’inscription, de désinscription et de complet', async () => {
      const { fixture, el } = await createFixture(groupe(), NEWCOMER, {
        members: [],
        events: [
          card('a', 3),
          (() => {
            const base = card('b', 4);
            return { ...base, seance: { ...base.seance!, capacity: 3 } };
          })(),
        ],
      });
      await open(fixture, el, 'a');
      expect(NON_JDR_BANNED_WORDS.test(q('app-event-dialog')?.textContent ?? '')).toBe(false);
      expect(NON_JDR_BANNED_WORDS.test(el.textContent ?? '')).toBe(false);
    });
  });

  // ─── Story 40.4 : réserver une place à des membres ─────────────────────────────────────────────────

  describe('places réservées (Story 40.4)', () => {
    const RESA_ID = 'membre-reserve';
    const OUTSIDER_ID = 'membre-sans-place';
    const ACCEPT = '.ed__accept';
    const DECLINE = '.ed__decline';
    const UNRESERVE = '.ed__unreserve';
    const buttonLabels = (selector: string) =>
      Array.from(document.body.querySelectorAll(selector)).map((b) => b.textContent?.trim());
    const member = (userId: string, displayName: string): PartieMemberDto => ({
      userId,
      pseudo: displayName.toLowerCase(),
      displayName,
      role: 'MEMBER',
      joinedAt: '2026-01-01T00:00:00.000Z',
    });
    const MEMBERS: PartieMemberDto[] = [
      member(HOST_ID, 'Hélène Hôte'),
      member('a1', 'Alice Admin'),
      member(GUEST_ID, 'Gaël Invité'),
      member(RESA_ID, 'Sam Réservé'),
      member('cand-1', 'Camille'),
      member('cand-2', 'Dylan'),
    ];
    /** La conjonction vue de l'hôte : une place réservée à RESA_ID figure dans les participants. */
    const hostView = (id: string, days: number, over: Partial<EventCardDto> = {}) => {
      const base = card(id, days, over);
      return {
        ...base,
        seance: { ...base.seance!, placesTaken: 4 },
        participants: [
          ...base.participants,
          {
            userId: RESA_ID,
            displayName: 'Sam Réservé',
            isHost: false,
            isAdmin: false,
            status: 'RESERVED' as const,
          },
        ],
      };
    };
    /** La même conjonction vue de la personne réservée : sa place n'est pas listée, elle lit myInscription. */
    const reservedView = (id: string, days: number, over: Partial<EventCardDto> = {}) => {
      const base = card(id, days, over);
      return {
        ...base,
        seance: { ...base.seance!, placesTaken: 4 },
        myInscription: 'RESERVED' as const,
        cancelled: false,
      };
    };

    it('la personne réservée lit « Place réservée » (carte et fenêtre), « Accepter » / « Décliner », ni « S’inscrire » ni « Complet »', async () => {
      const { fixture, el } = await createFixture(groupe(), RESA_ID, {
        members: [],
        events: [
          reservedView('a', 3, {
            seance: { ...card('a', 3).seance!, capacity: 4, placesTaken: 4 },
          }),
        ],
      });
      const chip = cardEl(el, 'a').closest('article')!.querySelector('.event-card__chip')!;
      expect(chip.textContent?.trim()).toBe(tone['partie.ralliement_event_chip_reserved']);
      expect(chip.classList).not.toContain('event-card__chip--dotted');
      // La conjonction est pleine, mais cette place est la sienne : ni badge « Complet » ni bouton.
      expect(
        cardEl(el, 'a').closest('article')!.querySelector('.status-badge')?.textContent?.trim(),
      ).toBe('Dans 3 jours');

      await open(fixture, el, 'a');
      expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_situation_reserved'],
      );
      expect(buttonLabels('.ed__respond button')).toEqual([
        tone['partie.ralliement_event_accept_btn'],
        tone['partie.ralliement_event_decline_btn'],
      ]);
      expect(q('.ed__signup')).toBeNull();
      expect(q('.ed__full')).toBeNull();
      expect(q('.ed__unsubscribe')).toBeNull();
      // Sa place n'est pas listée parmi les participants ; aucun sélecteur de réservation.
      expect(document.body.querySelectorAll('app-participant-chip').length).toBe(3);
      expect(q('.ed__reserve')).toBeNull();
      expect(NON_JDR_BANNED_WORDS.test(q('app-event-dialog')?.textContent ?? '')).toBe(false);
    });

    it('« Accepter » : un appel, la carte à jour remplace l’ancienne (chip « Je participe », boutons retirés)', async () => {
      const { fixture, el } = await createFixture(groupe(), RESA_ID, {
        members: [],
        events: [reservedView('a', 3)],
      });
      await open(fixture, el, 'a');

      const base = card('a', 3);
      const accepted = {
        ...base,
        seance: { ...base.seance!, placesTaken: 4 },
        participants: [
          ...base.participants,
          {
            userId: RESA_ID,
            displayName: 'Sam Réservé',
            isHost: false,
            isAdmin: false,
            status: 'CONFIRMED' as const,
          },
        ],
        myInscription: 'CONFIRMED' as const,
        cancelled: false,
      };
      api().accepter.mockResolvedValue(accepted);
      api().list.mockResolvedValue([accepted]);
      q<HTMLButtonElement>(ACCEPT)!.click();
      await settle(fixture);

      expect(api().accepter).toHaveBeenCalledTimes(1);
      expect(api().accepter).toHaveBeenCalledWith('s-a');
      expect(q(ACCEPT)).toBeNull();
      expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_situation_registered'],
      );
      expect(document.body.querySelectorAll('app-participant-chip').length).toBe(4);
      expect(
        cardEl(el, 'a').closest('article')!.querySelector('.event-card__chip')?.textContent?.trim(),
      ).toBe(tone['partie.ralliement_event_chip_participating']);
      // Il peut désormais se désinscrire.
      expect(q('.ed__unsubscribe')).not.toBeNull();
    });

    it('« Décliner » : la désinscription est appelée, la place est rendue (chip « Pas inscrit·e »)', async () => {
      const { fixture, el } = await createFixture(groupe(), RESA_ID, {
        members: [],
        events: [reservedView('a', 3)],
      });
      await open(fixture, el, 'a');

      const freed = card('a', 3);
      api().desinscrire.mockResolvedValue(freed);
      api().list.mockResolvedValue([freed]);
      q<HTMLButtonElement>(DECLINE)!.click();
      await settle(fixture);

      expect(api().desinscrire).toHaveBeenCalledTimes(1);
      expect(api().desinscrire).toHaveBeenCalledWith('s-a');
      expect(api().accepter).not.toHaveBeenCalled();
      expect(q(DECLINE)).toBeNull();
      expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_situation_none'],
      );
      expect(q('.event-card__chip--dotted')).not.toBeNull();
    });

    it('double clic sur « Accepter » : un seul appel (garde en vol) ; le refus du serveur s’affiche dans la fenêtre et les boutons redeviennent actifs', async () => {
      const { fixture, el } = await createFixture(groupe(), RESA_ID, {
        members: [],
        events: [reservedView('a', 3)],
      });
      await open(fixture, el, 'a');
      let reject!: (e: unknown) => void;
      api().accepter.mockReturnValue(new Promise((_, r) => (reject = r)));

      q<HTMLButtonElement>(ACCEPT)!.click();
      await settle(fixture);
      expect(q<HTMLButtonElement>(ACCEPT)!.disabled).toBe(true);
      expect(q<HTMLButtonElement>(DECLINE)!.disabled).toBe(true);
      q<HTMLButtonElement>(ACCEPT)!.click();
      await settle(fixture);
      expect(api().accepter).toHaveBeenCalledTimes(1);

      reject({
        status: 400,
        error: {
          message: 'Cette conjonction est passée : les inscriptions ne peuvent plus changer',
        },
      });
      await settle(fixture);
      expect(q('.ed__error')?.textContent?.trim()).toBe(
        'Cette conjonction est passée : les inscriptions ne peuvent plus changer',
      );
      expect(q<HTMLButtonElement>(ACCEPT)!.disabled).toBe(false);
    });

    it('une conjonction passée : la place réservée n’offre plus de réponse, la chip dit « Pas inscrit·e »', async () => {
      const { fixture, el } = await createFixture(groupe(), RESA_ID, {
        members: [],
        events: [reservedView('a', -2)],
      });
      expect(
        cardEl(el, 'a').closest('article')!.querySelector('.event-card__chip')?.textContent?.trim(),
      ).toBe(tone['partie.ralliement_event_chip_not_registered']);
      await open(fixture, el, 'a');
      expect(q(ACCEPT)).toBeNull();
      expect(q('.ed__situation-text')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_situation_reserved_past'],
      );
    });

    it('l’hôte voit la réservation en attente : pastille pointillée, texte « invité·e, n’a pas encore accepté », action « Retirer la réservation »', async () => {
      const { fixture, el } = await createFixture(groupe(), HOST_ID, {
        members: MEMBERS,
        events: [hostView('a', 3)],
      });
      await open(fixture, el, 'a');

      const pending = document.body.querySelector('.pc--pending')!;
      expect(pending).not.toBeNull();
      expect(pending.textContent).toContain('Sam Réservé — invité·e, n’a pas encore accepté');
      expect(pending.querySelector('.pc__avatar--faded')).not.toBeNull();
      // L'hôte compte quatre participants dont la réservation en attente ; « inscrits » n'en fait pas partie.
      expect(document.body.querySelectorAll('app-participant-chip').length).toBe(4);
      expect(q('.ed__row--participation dd')?.textContent?.trim()).toBe(
        '8 places · 3 inscrits · 4 libres',
      );
      expect(buttonLabels(UNRESERVE)).toEqual([tone['partie.ralliement_event_unreserve_btn']]);
      expect(q<HTMLButtonElement>(UNRESERVE)!.getAttribute('aria-label')).toBe(
        'Retirer la réservation de Sam Réservé',
      );
    });

    it('l’hôte retire la réservation : un appel, la carte à jour remplace l’ancienne', async () => {
      const { fixture, el } = await createFixture(groupe(), HOST_ID, {
        members: MEMBERS,
        events: [hostView('a', 3)],
      });
      await open(fixture, el, 'a');

      const freed = card('a', 3);
      api().retirerReservation.mockResolvedValue(freed);
      api().list.mockResolvedValue([freed]);
      q<HTMLButtonElement>(UNRESERVE)!.click();
      await settle(fixture);

      expect(api().retirerReservation).toHaveBeenCalledTimes(1);
      expect(api().retirerReservation).toHaveBeenCalledWith('s-a', RESA_ID);
      expect(q('.pc--pending')).toBeNull();
      expect(q(UNRESERVE)).toBeNull();
      expect(document.body.querySelectorAll('app-participant-chip').length).toBe(3);
    });

    it('l’hôte réserve : le sélecteur propose les membres sans place (ni l’hôte ni les participants), un clic appelle le serveur et met la carte à jour', async () => {
      const { fixture, el } = await createFixture(groupe(), HOST_ID, {
        members: MEMBERS,
        events: [hostView('a', 3, { seance: { ...hostView('a', 3).seance!, placesTaken: 4 } })],
      });
      await open(fixture, el, 'a');

      expect(q('.ed__reserve .ed__section-title')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_reserve_label'],
      );
      expect(buttonLabels('.ed__candidate')).toEqual(['Camille', 'Dylan']);
      expect(q('.ed__reserve .ed__hint')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_reserve_hint'],
      );
      expect(q<HTMLButtonElement>('.ed__candidate')!.getAttribute('aria-label')).toBe(
        'Réserver une place à Camille',
      );

      const base = hostView('a', 3);
      const reserved = {
        ...base,
        seance: { ...base.seance!, placesTaken: 5 },
        participants: [
          ...base.participants,
          {
            userId: 'cand-1',
            displayName: 'Camille',
            isHost: false,
            isAdmin: false,
            status: 'RESERVED' as const,
          },
        ],
      };
      api().reserver.mockResolvedValue(reserved);
      api().list.mockResolvedValue([reserved]);
      q<HTMLButtonElement>('.ed__candidate')!.click();
      await settle(fixture);

      expect(api().reserver).toHaveBeenCalledTimes(1);
      expect(api().reserver).toHaveBeenCalledWith('s-a', 'cand-1');
      expect(buttonLabels('.ed__candidate')).toEqual(['Dylan']);
      expect(document.body.querySelectorAll('.pc--pending').length).toBe(2);
    });

    it('refus du serveur à la réservation (complet) : message français dans la fenêtre, le sélecteur reste utilisable', async () => {
      const { fixture, el } = await createFixture(groupe(), HOST_ID, {
        members: MEMBERS,
        events: [hostView('a', 3)],
      });
      await open(fixture, el, 'a');
      api().reserver.mockRejectedValue({
        status: 409,
        error: { message: 'Cette conjonction est complète : plus aucune place disponible' },
      });

      q<HTMLButtonElement>('.ed__candidate')!.click();
      await settle(fixture);

      expect(q('.ed__error')?.textContent?.trim()).toBe(
        'Cette conjonction est complète : plus aucune place disponible',
      );
      expect(q<HTMLButtonElement>('.ed__candidate')!.disabled).toBe(false);
    });

    it('conjonction pleine : les pastilles de réservation sont désactivées ; « Tous les membres », passée ou autre membre : aucun sélecteur', async () => {
      const full = hostView('a', 3, {});
      const fullCard = { ...full, seance: { ...full.seance!, capacity: 4, placesTaken: 4 } };
      const { fixture, el } = await createFixture(groupe(), HOST_ID, {
        members: MEMBERS,
        events: [
          fullCard,
          { ...card('b', 4), seance: { ...card('b', 4).seance!, capacity: null } },
          hostView('c', -2),
        ],
      });
      await open(fixture, el, 'a');
      expect(
        Array.from(document.body.querySelectorAll<HTMLButtonElement>('.ed__candidate')).every(
          (b) => b.disabled,
        ),
      ).toBe(true);
      q<HTMLButtonElement>('.ed__close')!.click();
      await settle(fixture);

      await open(fixture, el, 'b');
      expect(q('.ed__reserve')).toBeNull();
      q<HTMLButtonElement>('.ed__close')!.click();
      await settle(fixture);

      await open(fixture, el, 'c');
      expect(q('.ed__reserve')).toBeNull();
      expect(q(UNRESERVE)).toBeNull();
    });

    it('un autre membre ne voit ni la réservation, ni le sélecteur ; « Complet » vient de « placesTaken », sans révéler qui tient la place', async () => {
      const base = card('a', 3);
      const memberView = {
        ...base,
        seance: { ...base.seance!, capacity: 4, placesTaken: 4 },
        participants: base.participants.slice(0, 3),
      };
      const { fixture, el } = await createFixture(groupe(), OUTSIDER_ID, {
        members: MEMBERS,
        events: [{ ...memberView, participants: base.participants.slice(0, 3) }],
      });
      expect(
        cardEl(el, 'a').closest('article')!.querySelector('.status-badge')?.textContent?.trim(),
      ).toBe(tone['partie.ralliement_event_badge_full']);
      await open(fixture, el, 'a');
      expect(q('.ed__full')).not.toBeNull();
      expect(q('.ed__signup')).toBeNull();
      expect(q('.pc--pending')).toBeNull();
      expect(q('.ed__reserve')).toBeNull();
      expect(document.body.textContent).not.toContain('Sam Réservé');
      expect(q('.ed__row--participation dd')?.textContent?.trim()).toBe(
        '4 places · 3 inscrits · 0 libre',
      );
    });
  });

  it('aucun mot de JDR dans la fenêtre', async () => {
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
      members: [],
      events: [card('a', 3)],
    });
    await open(fixture, el, 'a');
    expect(NON_JDR_BANNED_WORDS.test(q('app-event-dialog')?.textContent ?? '')).toBe(false);
  });

  const titleOfCard = (el: HTMLElement, id: string) => cardEl(el, id).textContent?.trim();
});

// ─── Calendrier du groupe : entrées, aller-retour de la création (Story 40.5b) ────────────────

describe('PartieDetail — du groupe vers son calendrier (Story 40.5b)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());
    vi.restoreAllMocks();
  });

  const HOST_ID = 'member-host';
  const GUEST_ID = 'member-guest';
  const tone = TONE_MAP['grimoire-emeraude'];
  const groupe = (over: Partial<PartieDto> = {}) =>
    makePartie({
      gameSystemId: 'ralliement',
      kind: 'CAMPAGNE_EPISODIQUE',
      role: 'member',
      ...over,
    });
  const pollCard = (over: Partial<EventCardDto> = {}): EventCardDto => ({
    id: 'a',
    title: 'Soirée plateaux',
    hostId: HOST_ID,
    hostDisplayName: 'Hélène Hôte',
    seance: {
      endDate: null,
      endSlot: null,
      durationSlots: 1,
      id: 's-a',
      date: null,
      slot: null,
      lieu: null,
      heureRdv: null,
      notePratique: null,
      capacity: null,
      placesTaken: 1,
    },
    participants: [
      {
        userId: HOST_ID,
        displayName: 'Hélène Hôte',
        isHost: true,
        isAdmin: false,
        status: 'CONFIRMED',
      },
    ],
    myInscription: null,
    cancelled: false,
    can: { propose: false, edit: false, choose: false, extend: false },
    poll: {
      id: 'p-a',
      expiresAt: '2099-12-30T23:59:59.999Z',
      status: 'OPEN',
      eligibleVoterIds: [HOST_ID, GUEST_ID],
      durationSlots: 1,
      options: [
        { id: 'o1', date: '2099-12-24', slot: 'EVENING', availableCount: 2 },
        { id: 'o2', date: '2099-12-25', slot: 'MORNING', availableCount: 1 },
      ],
      votes: [],
    },
    ...over,
  });
  const settle = async (fixture: ComponentFixture<PartieDetail>) => {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  };
  const q = <T extends Element>(sel: string) => document.body.querySelector<T>(sel);
  const open = async (fixture: ComponentFixture<PartieDetail>, el: HTMLElement) => {
    el.querySelector<HTMLElement>('button[data-event-id="a"]')!.click();
    await settle(fixture);
  };

  it('le lien « Calendrier du groupe » est écrit, focalisable et mène à la page du groupe, sans carte ni icône seule', async () => {
    const { el } = await createFixture(groupe(), GUEST_ID, { members: [], events: [pollCard()] });
    const link = el.querySelector<HTMLAnchorElement>('.conjonctions__header a')!;
    expect(link.textContent?.trim()).toBe('Calendrier du groupe');
    expect(link.getAttribute('href')).toBe('/parties/party-1/guild-calendar');
    expect(link.tabIndex).toBeGreaterThanOrEqual(0);
    link.focus();
    expect(document.activeElement).toBe(link);
  });

  it('« Voter dans le calendrier » : la fenêtre remplace son entrée d’historique par la page du groupe', async () => {
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
      members: [],
      events: [pollCard()],
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await open(fixture, el);

    const button = q<HTMLButtonElement>('.ed__poll-vote')!;
    expect(button.textContent?.trim()).toBe('Voter dans le calendrier');
    expect(q('.ed__poll-compose')).toBeNull();
    button.click();
    await settle(fixture);

    // `replaceUrl` : le retour arrière ramène à la liste, sans entrée de fenêtre fantôme derrière.
    // Story 44.7 : « Voter dans le calendrier » arrive en Destinée sur SON vote.
    expect(navigate).toHaveBeenCalledWith('/parties/party-1/guild-calendar?poll=p-a', {
      replaceUrl: true,
    });
  });

  it('« Composer les créneaux » : réservé à l’hôte, mène à la page du groupe sans viser de vote', async () => {
    const { fixture, el } = await createFixture(groupe(), HOST_ID, {
      members: [],
      events: [pollCard()],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await open(fixture, el);

    const button = q<HTMLButtonElement>('.ed__poll-compose')!;
    expect(button.textContent?.trim()).toBe('Composer les créneaux');
    expect(q('.ed__poll-vote')).toBeNull();
    button.click();
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith('/parties/party-1/guild-calendar', {
      replaceUrl: true,
    });
  });

  it('aller-retour de la création : le brouillon part, revient avec ses créneaux, et la fenêtre se rouvre', async () => {
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, { members: [] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    el.querySelector<HTMLButtonElement>('.conjonctions__new')!.click();
    await settle(fixture);

    // Mode sondage, nom, lieu, échéance : tout ce que la fenêtre contient part avec la personne.
    const toggles = Array.from(
      document.body.querySelectorAll<HTMLElement>('.ec__date-mode mat-button-toggle button'),
    );
    toggles[1].click();
    await settle(fixture);
    const type = async (sel: string, value: string) => {
      const input = q<HTMLInputElement>(sel)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await settle(fixture);
    };
    await type('.ec__name', 'Brunch du dimanche');
    await type('.ec__place', 'Parc');
    await type('.ec__poll-deadline', '2099-12-20');

    const pick = q<HTMLButtonElement>('.ec__poll-calendar-btn')!;
    expect(pick.textContent?.trim()).toBe('Choisir les créneaux dans le calendrier');
    pick.click();
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith(['/parties', 'party-1', 'guild-calendar']);

    // Le calendrier du groupe reprend le brouillon (aucun appel au serveur), puis le rend avec ses créneaux.
    const drafts = TestBed.inject(ConjonctionDraftService);
    const taken = drafts.takeComposeRequest('party-1');
    expect(taken?.title).toBe('Brunch du dimanche');
    expect(taken?.lieu).toBe('Parc');
    expect(taken?.pollDeadline).toBe('2099-12-20');
    const api = TestBed.inject(EventsApiService) as unknown as {
      create: ReturnType<typeof vi.fn>;
    };
    expect(api.create).not.toHaveBeenCalled();
    drafts.finishCompose('party-1', [
      { date: '2099-12-24', slot: 'EVENING' },
      { date: '2099-12-26', slot: 'MORNING' },
    ]);

    // La page du groupe est remontée (le calendrier l'a remplacée) : la fenêtre rouvre avec le brouillon.
    fixture.destroy();
    document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());
    const back = TestBed.createComponent(PartieDetail);
    back.detectChanges();
    await settle(back);

    expect(q('app-event-create')).not.toBeNull();
    expect(q<HTMLInputElement>('.ec__name')!.value).toBe('Brunch du dimanche');
    expect(q<HTMLInputElement>('.ec__place')!.value).toBe('Parc');
    expect(q<HTMLInputElement>('.ec__poll-deadline')!.value).toBe('2099-12-20');
    expect(q('.ec__poll-summary')?.textContent?.trim()).toMatch(/^2 créneaux · .+→.+/);
    expect(document.body.querySelectorAll('.ec__chip--slot').length).toBe(2);

    // « Renoncer » abandonne le brouillon : une nouvelle visite ne rouvre rien.
    q<HTMLButtonElement>('.ec__cancel')!.click();
    await settle(back);
    expect(q('app-event-create')).toBeNull();
    expect(drafts.takeReopen('party-1')).toBeNull();
  });

  it('sans aller-retour en cours, la page du groupe n’ouvre pas la fenêtre de création', async () => {
    const { el } = await createFixture(groupe(), GUEST_ID, { members: [] });
    expect(q('app-event-create')).toBeNull();
    expect(el.querySelector('.conjonctions')).not.toBeNull();
  });

  it('aucun mot de JDR dans le lien, les boutons du sondage et la fenêtre de création', async () => {
    const { fixture, el } = await createFixture(groupe(), HOST_ID, {
      members: [],
      events: [pollCard()],
    });
    expect(
      NON_JDR_BANNED_WORDS.test(el.querySelector('.conjonctions__header')?.textContent ?? ''),
    ).toBe(false);
    await open(fixture, el);
    expect(NON_JDR_BANNED_WORDS.test(q('app-event-dialog')?.textContent ?? '')).toBe(false);
    expect(tone['partie.ralliement_calendar_link']).toBe('Calendrier du groupe');
  });
});

// ─── Une soirée isolée sur une seule page (Story 41.1) ──────────────────────────────────────

describe('PartieDetail — une soirée isolée sur une seule page (Story 41.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const OTHER_ID = 'member-2';
  const soiree = (over: Partial<PartieDto> = {}) =>
    makePartie({
      gameSystemId: 'ralliement',
      kind: 'ONE_SHOT',
      role: 'admin',
      ownerId: MJ_ID,
      ...over,
    });
  const members: PartieMemberDto[] = [
    {
      role: 'ADMIN',
      userId: MJ_ID,
      pseudo: 'createur',
      displayName: 'Créateur',
      joinedAt: '2026-10-01T00:00:00Z',
    },
    {
      role: 'MEMBER',
      userId: OTHER_ID,
      pseudo: 'invite',
      displayName: 'Invité Deux',
      joinedAt: '2026-10-02T00:00:00Z',
    },
  ];
  /** L'unique événement de la soirée : non daté par défaut (état à la création), hôte = le créateur. */
  const event = (over: Partial<EventCardDto> = {}): EventCardDto => ({
    id: 'e-1',
    title: 'Marathon Pandémie',
    hostId: MJ_ID,
    hostDisplayName: 'Créateur',
    seance: {
      endDate: null,
      endSlot: null,
      durationSlots: 1,
      id: 's-1',
      date: null,
      slot: null,
      lieu: null,
      heureRdv: null,
      notePratique: null,
      capacity: null,
      placesTaken: 1,
    },
    participants: [
      { userId: MJ_ID, displayName: 'Créateur', isHost: true, isAdmin: true, status: 'CONFIRMED' },
      {
        userId: OTHER_ID,
        displayName: 'Invité Deux',
        isHost: false,
        isAdmin: false,
        status: 'CONFIRMED',
      },
    ],
    myInscription: null,
    cancelled: false,
    can: { propose: false, edit: false, choose: false, extend: false },
    poll: null,
    ...over,
  });
  const tabs = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]'));
  const tabLabels = (el: HTMLElement) => tabs(el).map((t) => (t.textContent ?? '').trim());
  const settle = async (fixture: ComponentFixture<PartieDetail>) => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  };
  const api = () =>
    TestBed.inject(EventsApiService) as unknown as { list: ReturnType<typeof vi.fn> };

  it.each(THEMES)(
    'thème %s : l’hôte voit le nom du thème au singulier puis Invitations, sans Détails',
    async (theme) => {
      const tone = TONE_MAP[theme];
      const { el } = await createFixture(soiree(), MJ_ID, { members, theme, events: [event()] });
      expect(tabLabels(el)).toEqual([
        tone['partie.ralliement_soiree_tab'],
        tone['partie.ralliement_soiree_invitations_tab'],
        // Story 49.1 : le troisième onglet, au mot du thème et suivi du compte de jeux sur place.
        `${tone['event_games.tab']} · 0`,
      ]);
      expect(tabLabels(el)).not.toContain(tone['parties.detail_tab_details']);
      expect(tabs(el)[0].getAttribute('aria-selected')).toBe('true');
    },
  );

  it('un invité voit le premier onglet puis Invités', async () => {
    const { el } = await createFixture(soiree({ role: 'member' }), OTHER_ID, {
      members,
      events: [event()],
    });
    const tone = TONE_MAP['grimoire-emeraude'];
    expect(tabLabels(el)).toEqual([
      tone['partie.ralliement_soiree_tab'],
      tone['partie.ralliement_soiree_guests_tab'],
      `${tone['event_games.tab']} · 0`,
    ]);
  });

  it('le détail de l’événement s’affiche en ligne : titre, badge, situation, fiche — sans carte ni fenêtre', async () => {
    const { fixture, el } = await createFixture(soiree(), MJ_ID, { members, events: [event()] });
    await settle(fixture);
    const inline = el.querySelector('app-event-dialog .ed--inline');
    expect(inline).not.toBeNull();
    expect(inline?.querySelector('.ed__title')?.textContent?.trim()).toBe('Marathon Pandémie');
    expect(inline?.querySelector('app-status-badge')).not.toBeNull();
    expect(inline?.querySelector('.ed__situation')).not.toBeNull();
    expect(inline?.querySelector('.ed__sheet')).not.toBeNull();
    expect(el.querySelector('app-event-card')).toBeNull();
    expect(el.querySelector('app-detail-surface')).toBeNull();
    expect(el.querySelector('.conjonctions')).toBeNull();
  });

  it('la fiche dit « Sur invitation · pas de limite » et ne propose ni inscription, ni réservation, ni pied', async () => {
    const { fixture, el } = await createFixture(soiree({ role: 'member' }), OTHER_ID, {
      members,
      events: [event({ participants: [] })],
    });
    await settle(fixture);
    const tone = TONE_MAP['grimoire-emeraude'];
    expect(el.querySelector('.ed__row--participation')?.textContent).toContain(
      tone['partie.ralliement_soiree_participation'],
    );
    for (const sel of [
      '.ed__signup',
      '.ed__full',
      '.ed__respond',
      '.ed__unsubscribe',
      '.ed__reserve',
      '.ed__edit',
      '.ed__close',
      '.ed__footer',
    ]) {
      expect(el.querySelector(sel), sel).toBeNull();
    }
  });

  it('les participants sont absents du premier onglet et listés dans le second', async () => {
    const { fixture, el } = await createFixture(soiree({ role: 'member' }), OTHER_ID, {
      members,
      events: [event()],
      noopAnimations: true,
    });
    await settle(fixture);
    expect(el.querySelector('.ed__participants')).toBeNull();
    expect(el.querySelector('app-participant-chip')).toBeNull();

    tabs(el)[1].click();
    fixture.detectChanges();
    const rows = Array.from(el.querySelectorAll('.ralliement-members .result-row')).map((r) =>
      (r.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Créateur');
    expect(rows[1]).toContain('Invité Deux');
    // Pas d'outil d'invitation avant la Story 41.3 : ni recherche, ni lien.
    expect(el.querySelector('.ralliement-members input')).toBeNull();
  });

  it('la description de la soirée se lit sous le titre ; sans description, rien n’est rendu', async () => {
    const withText = await createFixture(soiree({ description: 'Apportez vos jeux' }), MJ_ID, {
      members,
      events: [event()],
    });
    await settle(withText.fixture);
    expect(withText.el.querySelector('.ed__description')?.textContent?.trim()).toBe(
      'Apportez vos jeux',
    );
    TestBed.resetTestingModule();

    const without = await createFixture(soiree({ description: null }), MJ_ID, {
      members,
      events: [event()],
    });
    await settle(without.fixture);
    expect(without.el.querySelector('.ed__description')).toBeNull();
  });

  it('une date fixée, un lieu et une heure se lisent dans la fiche', async () => {
    const dated = event({
      seance: {
        endDate: '2099-12-20',
        endSlot: 'EVENING',
        durationSlots: 1,
        id: 's-1',
        date: '2099-12-20',
        slot: 'EVENING',
        lieu: 'Chez Léa',
        heureRdv: '19:30',
        notePratique: 'Apporter un plat',
        capacity: null,
        placesTaken: 1,
      },
    });
    const { fixture, el } = await createFixture(soiree(), MJ_ID, { members, events: [dated] });
    await settle(fixture);
    expect(el.querySelector('.ed__row--place')?.textContent).toContain('Chez Léa');
    expect(el.querySelector('.ed__row--time')?.textContent).toContain('19:30');
    expect(el.querySelector('.ed__row--note')?.textContent).toContain('Apporter un plat');
    expect(el.querySelector('.ed__row--date')?.textContent).toContain('soir');
  });

  it('suit le temps réel : un signal relit l’événement et le détail se met à jour', async () => {
    const { fixture, el } = await createFixture(soiree(), MJ_ID, { members, events: [event()] });
    await settle(fixture);
    expect(el.querySelector('.ed__title')?.textContent?.trim()).toBe('Marathon Pandémie');
    // Deux lecteurs de la liste : l'onglet de la soirée et — Story 49.1 — l'onglet des jeux sur place.
    expect(api().list).toHaveBeenCalledTimes(2);

    api().list.mockResolvedValue([event({ title: 'Marathon Pandémie II' })]);
    TestBed.inject(PartiesService).notifyChanged();
    await settle(fixture);
    expect(api().list).toHaveBeenCalledTimes(4);
    expect(el.querySelector('.ed__title')?.textContent?.trim()).toBe('Marathon Pandémie II');
  });

  it('un échec de relecture garde le dernier état connu et écrit l’erreur', async () => {
    const { fixture, el } = await createFixture(soiree(), MJ_ID, { members, events: [event()] });
    await settle(fixture);
    api().list.mockRejectedValue(new Error('réseau'));
    TestBed.inject(PartiesService).notifyChanged();
    await settle(fixture);
    expect(el.querySelector('.ed__title')?.textContent?.trim()).toBe('Marathon Pandémie');
    expect(el.querySelector('.soiree__error')?.textContent).toContain(
      TONE_MAP['grimoire-emeraude']['partie.ralliement_event_list_error'],
    );
  });

  it.each(THEMES)('thème %s : aucun mot de JDR dans la page d’une soirée isolée', async (theme) => {
    const { fixture, el } = await createFixture(soiree(), MJ_ID, {
      members,
      theme,
      events: [event()],
      noopAnimations: true,
    });
    await settle(fixture);
    expect(NON_JDR_BANNED_WORDS.test(el.textContent ?? '')).toBe(false);
    tabs(el)[1].click();
    fixture.detectChanges();
    expect(NON_JDR_BANNED_WORDS.test(el.textContent ?? '')).toBe(false);
  });

  describe('l’hôte invite (Story 41.3)', () => {
    const clickSecondTab = (el: HTMLElement, fixture: ComponentFixture<PartieDetail>) => {
      tabs(el)[1].click();
      fixture.detectChanges();
    };

    it('onglet Invitations de l’hôte : invités (membres autres que lui) avec « Retirer », outils d’invitation, aucune action de groupe', async () => {
      const { fixture, el } = await createFixture(soiree(), MJ_ID, {
        members,
        events: [event()],
        noopAnimations: true,
      });
      await settle(fixture);
      clickSecondTab(el, fixture);

      const rows = Array.from(el.querySelectorAll('.ralliement-members .result-row')).map((r) =>
        (r.textContent ?? '').replace(/\s+/g, ' ').trim(),
      );
      expect(rows[0]).toContain('Créateur');
      expect(rows[1]).toContain('Invité Deux');
      const tone = TONE_MAP['grimoire-emeraude'];
      // « Retirer » sur l'invité seulement ; ni « Nommer admin », ni « Quitter l'office », ni badge.
      const removeButtons = Array.from(
        el.querySelectorAll('.ralliement-members .result-row button'),
      ).filter((b) => (b.textContent ?? '').includes(tone['partie.remove_member_btn']));
      expect(removeButtons).toHaveLength(1);
      expect(el.querySelector('.admin-badge')).toBeNull();
      expect(el.textContent).not.toContain(tone['partie.ralliement_appoint_btn']);
      expect(el.textContent).not.toContain(tone['partie.ralliement_step_down_btn']);
      // Outils : recherche par pseudo, e-mail, lien.
      expect(el.querySelector('.ralliement-members input')).not.toBeNull();
      expect(el.querySelector('.ralliement-members .search-row')).not.toBeNull();
      expect(el.querySelector('.soiree-guests-empty')).toBeNull();
    });

    it('sans invité : « Aucun invité pour l’instant » ; un invité n’a ni outils, ni « Retirer »', async () => {
      const alone: PartieMemberDto[] = [members[0]];
      const host = await createFixture(soiree(), MJ_ID, {
        members: alone,
        events: [event()],
        noopAnimations: true,
      });
      await settle(host.fixture);
      clickSecondTab(host.el, host.fixture);
      expect(host.el.querySelector('.soiree-guests-empty')?.textContent?.trim()).toBe(
        TONE_MAP['grimoire-emeraude']['partie.ralliement_soiree_guests_empty'],
      );
      TestBed.resetTestingModule();

      const guest = await createFixture(soiree({ role: 'member' }), OTHER_ID, {
        members,
        events: [event()],
        noopAnimations: true,
      });
      await settle(guest.fixture);
      clickSecondTab(guest.el, guest.fixture);
      expect(guest.el.querySelector('.ralliement-members input')).toBeNull();
      expect(guest.el.querySelector('.ralliement-members button:not(.library-open)')).toBeNull();
      expect(guest.el.querySelector('.soiree-guests-empty')).toBeNull();
    });
  });

  // ⚠️ Story 49.1 : le troisième onglet d'une soirée à venir — les jeux sur place de l'hôte.
  describe('onglet des jeux sur place (Story 49.1)', () => {
    const game = (name: string, min: number | null, max: number | null): BoardGameDto => ({
      id: `id-${name}`,
      name,
      nameKey: name.toLowerCase(),
      minPlayers: min,
      maxPlayers: max,
      durationMin: null,
      createdAt: '2026-10-29T10:00:00.000Z',
    });
    const served = {
      games: [game('Azul', 2, 4), game('Codenames', 4, 8), game('Skull', null, null)],
      brings: [],
      participantsCount: 4,
      envies: [],
    };

    it.each(THEMES)(
      'thème %s : le troisième onglet porte le mot du thème et le nombre de jeux sur place, pour l’hôte comme pour un invité',
      async (theme) => {
        const tone = TONE_MAP[theme];
        const host = await createFixture(soiree(), MJ_ID, {
          members,
          theme,
          events: [event()],
          eventBoardGames: served,
        });
        await settle(host.fixture);
        expect(tabLabels(host.el)).toEqual([
          tone['partie.ralliement_soiree_tab'],
          tone['partie.ralliement_soiree_invitations_tab'],
          `${tone['event_games.tab']} · 3`,
        ]);
        TestBed.resetTestingModule();

        const guest = await createFixture(soiree({ role: 'member' }), OTHER_ID, {
          members,
          theme,
          events: [event()],
          eventBoardGames: served,
        });
        await settle(guest.fixture);
        expect(tabLabels(guest.el)).toEqual([
          tone['partie.ralliement_soiree_tab'],
          tone['partie.ralliement_soiree_guests_tab'],
          `${tone['event_games.tab']} · 3`,
        ]);
      },
    );

    it('l’onglet lit l’événement de la soirée, puis ses jeux ; sa section dit « Chez » l’hôte, ses pastilles suivent N', async () => {
      const { fixture, el } = await createFixture(soiree({ role: 'member' }), OTHER_ID, {
        members,
        events: [event()],
        eventBoardGames: served,
        noopAnimations: true,
      });
      await settle(fixture);
      tabs(el)[2].click();
      await settle(fixture);

      const events = TestBed.inject(EventsApiService) as unknown as {
        boardGames: ReturnType<typeof vi.fn>;
      };
      expect(events.boardGames).toHaveBeenCalledWith('e-1');
      const text = (el.querySelector('app-event-games-tab')?.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      expect(text).toContain('3 jeux sur place · 2 jouables à 4');
      expect(text).toContain('Chez Créateur');
      expect(text).toContain('Azul');
      expect(el.querySelectorAll('app-game-row .gr__fit')).toHaveLength(2);
    });

    it('bibliothèque vide de l’hôte : un invité (`contributor` vrai) voit la ligne du thème ET le lien discret vers « mon cabinet »', async () => {
      const { fixture, el } = await createFixture(soiree({ role: 'member' }), OTHER_ID, {
        members,
        events: [event()],
        eventBoardGames: { games: [], brings: [], participantsCount: 2, envies: [] },
        noopAnimations: true,
      });
      await settle(fixture);
      tabs(el)[2].click();
      await settle(fixture);

      const tab = el.querySelector('app-event-games-tab')!;
      expect(tab.textContent).toContain(TONE_MAP['grimoire-emeraude']['event_games.empty']);
      const link = tab.querySelector<HTMLAnchorElement>('.egt__link')!;
      expect(link.textContent?.trim()).toBe(TONE_MAP['grimoire-emeraude']['event_games.fill_link']);
      expect(link.getAttribute('href')).toBe('/profile/board-games');
    });

    it('l’hôte, qui lit la page, voit « Chez moi » (jamais « Chez {son nom} ») ; un invité voit « Chez Créateur »', async () => {
      const host = await createFixture(soiree(), MJ_ID, {
        members,
        events: [event()],
        eventBoardGames: served,
        noopAnimations: true,
      });
      await settle(host.fixture);
      tabs(host.el)[2].click();
      await settle(host.fixture);
      const hostText = (host.el.querySelector('app-event-games-tab')?.textContent ?? '').replace(
        /\s+/g,
        ' ',
      );
      expect(hostText).toContain('Chez moi');
      expect(hostText).not.toContain('Chez Créateur');
      TestBed.resetTestingModule();

      const guest = await createFixture(soiree({ role: 'member' }), OTHER_ID, {
        members,
        events: [event()],
        eventBoardGames: served,
        noopAnimations: true,
      });
      await settle(guest.fixture);
      tabs(guest.el)[2].click();
      await settle(guest.fixture);
      const guestText = guest.el.querySelector('app-event-games-tab')?.textContent ?? '';
      expect(guestText).toContain('Chez Créateur');
      expect(guestText).not.toContain('Chez moi');
    });

    it.each([
      ['terminée', 'TERMINEE'],
      ['annulée', 'ANNULEE'],
    ] as const)('soirée %s : aucun onglet des jeux', async (_label, status) => {
      const { fixture, el } = await createFixture(soiree({ status }), MJ_ID, {
        members,
        events: [event({ cancelled: status === 'ANNULEE' })],
        eventBoardGames: served,
      });
      await settle(fixture);
      const tone = TONE_MAP['grimoire-emeraude'];
      expect(tabLabels(el)).toEqual([
        tone['partie.ralliement_soiree_tab'],
        tone['partie.ralliement_soiree_invitations_tab'],
      ]);
      expect(el.querySelector('app-event-games-tab')).toBeNull();
    });

    it('un groupe n’a pas cet onglet à la page (il est dans la fenêtre d’une conjonction)', async () => {
      const { fixture, el } = await createFixture(
        makePartie({ gameSystemId: 'ralliement', kind: 'CAMPAGNE_EPISODIQUE', role: 'admin' }),
        MJ_ID,
        { members, events: [event()], eventBoardGames: served },
      );
      await settle(fixture);
      expect(el.querySelector('app-event-games-tab')).toBeNull();
    });
  });

  describe('soirée terminée (Story 41.4)', () => {
    const finished = (over: Partial<PartieDto> = {}) => soiree({ status: 'TERMINEE', ...over });
    const clickSecondTab = (el: HTMLElement, fixture: ComponentFixture<PartieDetail>) => {
      tabs(el)[1].click();
      fixture.detectChanges();
    };

    it('bandeau « terminée » propre à la rencontre (jamais « dissous »), pas de « Modifier » dans le détail', async () => {
      const { fixture, el } = await createFixture(finished(), MJ_ID, {
        members,
        events: [event()],
      });
      await settle(fixture);
      const tone = TONE_MAP['grimoire-emeraude'];
      expect(el.querySelector('.closed-banner')?.textContent).toContain(
        tone['partie.ralliement_soiree_status_closed_label'],
      );
      expect(el.querySelector('.closed-banner')?.textContent).not.toContain(
        tone['partie.ralliement_status_closed_label'],
      );
      expect(el.querySelector('.ed__edit')).toBeNull();
    });

    it('l’hôte n’a plus d’outils d’invitation ni de « Retirer » ; la liste des invités reste lisible', async () => {
      const { fixture, el } = await createFixture(finished(), MJ_ID, {
        members,
        events: [event()],
        noopAnimations: true,
      });
      await settle(fixture);
      clickSecondTab(el, fixture);

      expect(el.querySelector('.ralliement-members input')).toBeNull();
      expect(el.querySelector('.ralliement-members .search-row')).toBeNull();
      const rows = Array.from(el.querySelectorAll('.ralliement-members .result-row'));
      expect(rows).toHaveLength(2);
      expect(
        el.querySelector('.ralliement-members .result-row button:not(.library-open)'),
      ).toBeNull();
    });

    it('« Rouvrir » remplace « Clore » ; l’action relit la partie et rend ses outils', async () => {
      const { fixture, el } = await createFixture(finished(), MJ_ID, {
        members,
        events: [event()],
      });
      await settle(fixture);
      const tone = TONE_MAP['grimoire-emeraude'];
      const labels = Array.from(el.querySelectorAll('.icon-bar button')).map((b) =>
        (b.textContent ?? '').trim(),
      );
      expect(labels).toEqual([expect.stringContaining(tone['partie.reopen_btn'])]);
    });

    it('la pastille « Ma situation » dit « J’y étais » pour un membre d’une soirée passée, « Je participe » avant', async () => {
      const past = event();
      past.seance!.date = '2020-01-01';
      past.seance!.slot = 'EVENING';
      const old = await createFixture(finished({ role: 'member' }), OTHER_ID, {
        members,
        events: [past],
      });
      await settle(old.fixture);
      const tone = TONE_MAP['grimoire-emeraude'];
      expect(old.el.querySelector('.ed__chip')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_chip_was_there'],
      );
      TestBed.resetTestingModule();

      const upcoming = await createFixture(soiree({ role: 'member' }), OTHER_ID, {
        members,
        events: [event({ participants: [] })],
      });
      await settle(upcoming.fixture);
      expect(upcoming.el.querySelector('.ed__chip')?.textContent?.trim()).toBe(
        tone['partie.ralliement_event_chip_participating'],
      );
    });

    it('une soirée à venir offre « Clore » à l’hôte, rien à un invité', async () => {
      const host = await createFixture(soiree(), MJ_ID, { members, events: [event()] });
      expect(
        Array.from(host.el.querySelectorAll('.icon-bar button')).map((b) => (b.textContent ?? '').trim()),
      ).toEqual([expect.stringContaining(TONE_MAP['grimoire-emeraude']['partie.close_btn'])]);
      TestBed.resetTestingModule();

      const guest = await createFixture(soiree({ role: 'member' }), OTHER_ID, {
        members,
        events: [event()],
      });
      expect(guest.el.querySelector('.icon-bar button')).toBeNull();
    });
  });

  // Story 42.2 : une soirée annulée est figée, son état est écrit, et seul l'hôte d'une soirée ouverte l'annule.
  describe('soirée annulée (Story 42.2)', () => {
    const cancelled = (over: Partial<PartieDto> = {}) => soiree({ status: 'ANNULEE', ...over });

    it('bandeau « annulée » propre à la rencontre (jamais « terminée »), détail annulé sans aucune action', async () => {
      const { fixture, el } = await createFixture(cancelled(), MJ_ID, {
        members,
        events: [event({ cancelled: true })],
      });
      await settle(fixture);
      const tone = TONE_MAP['grimoire-emeraude'];
      const banner = el.querySelector('.closed-banner');
      expect(banner?.textContent).toContain(tone['partie.ralliement_soiree_status_cancelled_label']);
      expect(banner?.classList).toContain('closed-banner--cancelled');
      expect(banner?.textContent).not.toContain(tone['partie.ralliement_soiree_status_closed_label']);
      expect(el.querySelector('.ed__badge')?.textContent?.trim()).toBe('Annulée');
      expect(el.querySelector('.ed__cancelled')).not.toBeNull();
      expect(el.querySelector('.ed__edit')).toBeNull();
      expect(el.querySelector('.ed__cancel-event')).toBeNull();
    });

    it('ni « Clore », ni « Rouvrir », ni « Modifier » dans la barre d’actions de l’hôte', async () => {
      const { fixture, el } = await createFixture(cancelled(), MJ_ID, {
        members,
        events: [event({ cancelled: true })],
      });
      await settle(fixture);

      expect(el.querySelector('.icon-bar button')).toBeNull();
      expect(el.querySelector('.icon-bar a')).toBeNull();
    });

    it('l’hôte d’une soirée à venir voit « Annuler la conjonction » dans le détail en ligne ; un invité non', async () => {
      const host = await createFixture(soiree(), MJ_ID, { members, events: [event()] });
      await settle(host.fixture);
      expect(host.el.querySelector('.ed__cancel-event')?.textContent?.trim()).toBe(
        TONE_MAP['grimoire-emeraude']['partie.ralliement_event_cancel_event_btn'],
      );
      TestBed.resetTestingModule();

      const guest = await createFixture(soiree({ role: 'member' }), OTHER_ID, {
        members,
        events: [event()],
      });
      await settle(guest.fixture);
      expect(guest.el.querySelector('.ed__cancel-event')).toBeNull();
    });

    it('une soirée terminée (figée) n’offre plus l’annulation, même à l’hôte', async () => {
      const { fixture, el } = await createFixture(soiree({ status: 'TERMINEE' }), MJ_ID, {
        members,
        events: [event()],
      });
      await settle(fixture);

      expect(el.querySelector('.ed__cancel-event')).toBeNull();
    });
  });

  it('témoins : un groupe garde ses Conjonctions, une quête garde ses onglets', async () => {
    const tone = TONE_MAP['grimoire-emeraude'];
    const group = await createFixture(
      makePartie({ gameSystemId: 'ralliement', kind: 'CAMPAGNE_EPISODIQUE', role: 'admin' }),
      MJ_ID,
      { members },
    );
    expect(tabLabels(group.el)[0]).toBe(tone['partie.ralliement_conjonctions_tab']);
    expect(group.el.querySelector('app-soiree-tab')).toBeNull();
    TestBed.resetTestingModule();

    const quete = await createFixture(
      makePartie({ gameSystemId: 'ryuutama', kind: 'ONE_SHOT', ownerId: MJ_ID }),
      MJ_ID,
    );
    expect(tabLabels(quete.el)[0]).toBe(tone['parties.detail_tab_details']);
    expect(quete.el.querySelector('app-soiree-tab')).toBeNull();
  });
});

// ─── Annuler une conjonction (Story 42.1) ──────────────────────────────────────────────────────

describe('PartieDetail — annuler une conjonction (Story 42.1)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.querySelectorAll('app-detail-surface').forEach((n) => n.remove());
    vi.restoreAllMocks();
  });

  const HOST_ID = 'member-host';
  const GUEST_ID = 'member-guest';
  const ADMIN_ID = 'admin-user';
  const tone = TONE_MAP['grimoire-emeraude'];
  const groupe = (over: Partial<PartieDto> = {}) =>
    makePartie({
      gameSystemId: 'ralliement',
      kind: 'CAMPAGNE_EPISODIQUE',
      role: 'member',
      ...over,
    });
  const dayKey = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${j}`;
  };
  const card = (id: string, days: number, over: Partial<EventCardDto> = {}): EventCardDto => ({
    id,
    title: `Conjonction ${id}`,
    hostId: HOST_ID,
    hostDisplayName: 'Hélène Hôte',
    seance: {
      endDate: dayKey(days),
      endSlot: 'EVENING',
      durationSlots: 1,
      id: `s-${id}`,
      date: dayKey(days),
      slot: 'EVENING',
      lieu: 'Lyon 3e',
      heureRdv: null,
      notePratique: null,
      capacity: 8,
      placesTaken: 2,
    },
    participants: [
      {
        userId: HOST_ID,
        displayName: 'Hélène Hôte',
        isHost: true,
        isAdmin: false,
        status: 'CONFIRMED',
      },
      {
        userId: GUEST_ID,
        displayName: 'Gaël Invité',
        isHost: false,
        isAdmin: false,
        status: 'CONFIRMED',
      },
    ],
    myInscription: null,
    cancelled: false,
    can: { propose: false, edit: false, choose: false, extend: false },
    poll: null,
    ...over,
  });
  const api = () =>
    TestBed.inject(EventsApiService) as unknown as {
      list: ReturnType<typeof vi.fn>;
      cancel: ReturnType<typeof vi.fn>;
    };
  const dialogOpen = () =>
    (TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> }).open;
  const settle = async (fixture: ComponentFixture<PartieDetail>) => {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  };
  const q = <T extends Element>(sel: string) => document.body.querySelector<T>(sel);
  const open = async (fixture: ComponentFixture<PartieDetail>, el: HTMLElement, id: string) => {
    el.querySelector<HTMLElement>(`button[data-event-id="${id}"]`)!.click();
    await settle(fixture);
  };
  const labels = () =>
    Array.from(document.body.querySelectorAll('.ed__actions button')).map((b) =>
      b.textContent?.trim(),
    );

  it('l’hôte voit « Annuler la conjonction » avant la date ; un administrateur qui n’est pas l’hôte aussi, sans « Modifier »', async () => {
    const host = await createFixture(groupe(), HOST_ID, { members: [], events: [card('a', 3)] });
    await open(host.fixture, host.el, 'a');
    expect(q('.ed__cancel-event')?.textContent?.trim()).toBe('Annuler la conjonction');
    expect(q('.ed__edit')).not.toBeNull();
    q<HTMLButtonElement>('.ed__close')!.click();
    await settle(host.fixture);
    TestBed.resetTestingModule();

    const admin = await createFixture(groupe({ role: 'admin' }), ADMIN_ID, {
      members: [],
      events: [card('a', 3)],
    });
    await open(admin.fixture, admin.el, 'a');
    expect(q('.ed__cancel-event')?.textContent?.trim()).toBe('Annuler la conjonction');
    expect(q('.ed__edit')).toBeNull();
  });

  it('un simple membre, ou une conjonction passée : pas de « Annuler la conjonction »', async () => {
    const guest = await createFixture(groupe(), GUEST_ID, { members: [], events: [card('a', 3)] });
    await open(guest.fixture, guest.el, 'a');
    expect(q('.ed__cancel-event')).toBeNull();
    q<HTMLButtonElement>('.ed__close')!.click();
    await settle(guest.fixture);
    TestBed.resetTestingModule();

    const host = await createFixture(groupe(), HOST_ID, { members: [], events: [card('p', -3)] });
    await open(host.fixture, host.el, 'p');
    expect(q('.ed__cancel-event')).toBeNull();
  });

  it('« Annuler la conjonction » : confirmation « Votre accord » avec le nom ; confirmer appelle le serveur, la carte passe « Annulée » aussitôt', async () => {
    const { fixture, el } = await createFixture(groupe(), HOST_ID, {
      members: [],
      events: [card('a', 3)],
    });
    await open(fixture, el, 'a');
    const done = { ...card('a', 3), cancelled: true };
    api().cancel.mockResolvedValue(done);
    api().list.mockResolvedValue([done]);
    // La fenêtre rend sa réponse APRÈS l'appel du serveur, comme en vrai (fermeture sur succès).
    const closed = new Subject<boolean>();
    dialogOpen().mockReturnValue({ afterClosed: () => closed });

    q<HTMLButtonElement>('.ed__cancel-event')!.click();
    await settle(fixture);

    const data = dialogOpen().mock.calls[0][1].data;
    expect(data.title).toBe('Conjonction a');
    await data.confirm();
    closed.next(true);
    await settle(fixture);
    expect(api().cancel).toHaveBeenCalledWith('party-1', 'a');
    // La fenêtre reste ouverte et dit l'état, sans plus aucune action.
    expect(q('.ed__badge')?.textContent?.trim()).toBe('Annulée');
    expect(q('.ed__cancelled')?.textContent?.trim()).toBe(
      tone['partie.ralliement_event_cancelled_text'],
    );
    expect(labels()).toEqual([tone['partie.ralliement_event_close_btn']]);
  });

  it('« Renoncer » : rien n’est envoyé, la conjonction reste telle quelle', async () => {
    const { fixture, el } = await createFixture(groupe(), HOST_ID, {
      members: [],
      events: [card('a', 3)],
    });
    await open(fixture, el, 'a');
    dialogOpen().mockReturnValue({ afterClosed: () => of(false) });

    q<HTMLButtonElement>('.ed__cancel-event')!.click();
    await settle(fixture);

    expect(api().cancel).not.toHaveBeenCalled();
    expect(q('.ed__cancelled')).toBeNull();
  });

  it('carte annulée : estompée, badge « Annulée » écrit, sans « Ma situation », et toujours cliquable', async () => {
    const { fixture, el } = await createFixture(groupe(), GUEST_ID, {
      members: [],
      events: [card('a', 3, { cancelled: true }), card('b', 4)],
    });

    const articles = Array.from(el.querySelectorAll('article.event-card'));
    const [cancelled, normal] = articles;
    expect(cancelled.classList).toContain('event-card--cancelled');
    expect(cancelled.querySelector('.status-badge')?.textContent?.trim()).toBe('Annulée');
    expect(cancelled.querySelector('.status-badge')?.classList).toContain(
      'status-badge--cancelled',
    );
    expect(cancelled.querySelector('.event-card__situation')).toBeNull();
    expect(normal.classList).not.toContain('event-card--cancelled');
    expect(normal.querySelector('.event-card__situation')).not.toBeNull();

    // Elle reste dans sa section et reste cliquable : la fenêtre s'ouvre, dit « Annulée », sans action.
    await open(fixture, el, 'a');
    expect(q('.ed__title')?.textContent?.trim()).toBe('Conjonction a');
    expect(q('.ed__badge')?.textContent?.trim()).toBe('Annulée');
    expect(q('.ed__cancelled')).not.toBeNull();
    expect(q('.ed__signup')).toBeNull();
    expect(q('.ed__cancel-event')).toBeNull();
    expect(q('.ed__edit')).toBeNull();
    expect(labels()).toEqual([tone['partie.ralliement_event_close_btn']]);
  });

  it('même l’hôte et l’administrateur n’ont plus aucune action sur une conjonction annulée', async () => {
    const host = await createFixture(groupe(), HOST_ID, {
      members: [],
      events: [card('a', 3, { cancelled: true })],
    });
    await open(host.fixture, host.el, 'a');
    expect(labels()).toEqual([tone['partie.ralliement_event_close_btn']]);
    q<HTMLButtonElement>('.ed__close')!.click();
    await settle(host.fixture);
    TestBed.resetTestingModule();

    const admin = await createFixture(groupe({ role: 'admin' }), ADMIN_ID, {
      members: [],
      events: [card('a', 3, { cancelled: true })],
    });
    await open(admin.fixture, admin.el, 'a');
    expect(labels()).toEqual([tone['partie.ralliement_event_close_btn']]);
  });
});

// ─── Icônes de la page d'une partie : états, actions, ressources (story 51.3) ─────────────────

describe('PartieDetail — icônes du jeu : états, actions et ressources (story 51.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const tone = TONE_MAP['grimoire-emeraude'];
  const iconOf = (node: Element | null | undefined) =>
    node?.querySelector('app-icon')?.getAttribute('data-icon') ?? null;
  /** Nom d'icône de chaque action du pied de carte, par libellé (liens « Modifier »/« Visibilité » compris). */
  const footerIcons = (el: HTMLElement) => {
    const result: Record<string, string | null> = {};
    const actions = el.querySelectorAll('mat-card-actions a, mat-card-actions button');
    for (const node of Array.from(actions)) {
      result[(node.textContent ?? '').trim()] = iconOf(node);
    }
    return result;
  };
  const groupe = (over: Partial<PartieDto> = {}) =>
    makePartie({
      gameSystemId: 'ralliement',
      kind: 'CAMPAGNE_EPISODIQUE',
      role: 'admin',
      ownerId: MJ_ID,
      ...over,
    });
  const soiree = (over: Partial<PartieDto> = {}) => groupe({ kind: 'ONE_SHOT', ...over });

  it('pied de carte du MJ : Modifier, Visibilité, Clore, Supprimer', async () => {
    const { el } = await createFixture(makePartie({ ownerId: MJ_ID, status: 'EN_COURS' }), MJ_ID);
    expect(footerIcons(el)).toEqual({
      [tone['partie.edit_btn']]: 'modifier',
      [tone['partie.visibility_btn']]: 'cadenas-ferme',
      [tone['partie.close_btn']]: 'etat-terminee',
      [tone['partie.delete_btn']]: 'supprimer',
    });
  });

  it('pied de carte du MJ, partie terminée : Rouvrir remplace Clore', async () => {
    const { el } = await createFixture(makePartie({ ownerId: MJ_ID, status: 'TERMINEE' }), MJ_ID);
    expect(footerIcons(el)).toEqual({
      [tone['partie.edit_btn']]: 'modifier',
      [tone['partie.visibility_btn']]: 'cadenas-ferme',
      [tone['partie.reopen_btn']]: 'rouvrir',
      [tone['partie.delete_btn']]: 'supprimer',
    });
  });

  it.each([
    ['EN_COURS', 'close_btn', 'etat-terminee'],
    ['TERMINEE', 'reopen_btn', 'rouvrir'],
  ] as const)(
    'pied de carte de l’admin d’un groupe (%s) : Modifier, %s, Supprimer',
    async (status, key, icon) => {
      const { el } = await createFixture(groupe({ status }), MJ_ID);
      const icons = footerIcons(el);
      expect(icons[tone['partie.edit_btn']]).toBe('modifier');
      expect(icons[tone[`partie.${key}`]]).toBe(icon);
      expect(icons[tone['partie.delete_btn']]).toBe('supprimer');
      // Story 51.4 : « Quitter l'office » a son icône propre (distincte de « Quitter le groupe »).
      expect(icons[tone['partie.ralliement_step_down_btn']]).toBe('quitter-office');
    },
  );

  it.each([
    ['EN_COURS', 'close_btn', 'etat-terminee'],
    ['TERMINEE', 'reopen_btn', 'rouvrir'],
  ] as const)(
    'pied de carte de l’hôte d’une soirée (%s) : %s, jamais Supprimer',
    async (status, key, icon) => {
      const { el } = await createFixture(soiree({ status }), MJ_ID);
      const icons = footerIcons(el);
      expect(icons[tone[`partie.${key}`]]).toBe(icon);
      expect(icons[tone['partie.delete_btn']]).toBeUndefined();
      if (status === 'EN_COURS') expect(icons[tone['partie.edit_btn']]).toBe('modifier');
    },
  );

  it('bandeaux : « terminée » et « annulée » ont chacune leur icône, à côté du mot', async () => {
    const closed = await createFixture(makePartie({ ownerId: MJ_ID, status: 'TERMINEE' }), MJ_ID);
    expect(iconOf(closed.el.querySelector('.closed-banner'))).toBe('etat-terminee');
    expect(closed.el.querySelector('.closed-banner')?.textContent?.trim()).toBe(
      tone['partie.status_closed_label'],
    );
    TestBed.resetTestingModule();

    const cancelled = await createFixture(soiree({ status: 'ANNULEE' }), MJ_ID);
    const banner = cancelled.el.querySelector('.closed-banner--cancelled');
    expect(iconOf(banner)).toBe('etat-annulee');
    expect(banner?.textContent?.trim()).toBe(
      tone['partie.ralliement_soiree_status_cancelled_label'],
    );
  });

  it('actions du MJ : « Distribuer l’XP » et « Proclamer une annonce »', async () => {
    const { el } = await createFixture(makePartie({ ownerId: MJ_ID }), MJ_ID);
    expect(iconOf(el.querySelector('.xp-section button'))).toBe('distribuer-xp');
    expect(iconOf(el.querySelector('.announcement-section button'))).toBe('proclamer');
  });

  it('les dix boutons de téléchargement portent la même icône « telecharger »', async () => {
    const { el } = await createFixture(
      makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' }),
      MJ_ID,
    );
    const buttons = Array.from(
      el.querySelectorAll('.reference-sheets__links button, .prep-sheets__links button'),
    );
    expect(buttons).toHaveLength(10);
    expect(buttons.map((b) => iconOf(b))).toEqual(Array(10).fill('telecharger'));
  });

  it('les deux feuilles repliables ont le chevron « deplier »', async () => {
    const { el } = await createFixture(
      makePartie({ ownerId: MJ_ID, gameSystemId: 'ryuutama' }),
      MJ_ID,
    );
    const chevrons = Array.from(el.querySelectorAll('summary app-icon.download-sheet__chevron'));
    expect(chevrons.map((c) => c.getAttribute('data-icon'))).toEqual(['deplier', 'deplier']);
  });

  it('avertissement d’homonymie : icône « information »', async () => {
    const members: PartieMemberDto[] = [
      {
        role: 'MEMBER',
        userId: PLAYER_ID,
        pseudo: 'Alice',
        displayName: 'Même Nom',
        email: 'a@test.com',
        joinedAt: '',
      },
      {
        role: 'MEMBER',
        userId: 'other',
        pseudo: 'Bob',
        displayName: 'Même Nom',
        email: 'b@test.com',
        joinedAt: '',
      },
    ];
    const { el } = await createFixture(makePartie(), PLAYER_ID, {
      members,
      displayName: 'Même Nom',
    });
    expect(iconOf(el.querySelector('.homonymy-warning'))).toBe('information');
  });
});

// ─── Icônes de la page d'une partie : membres, invitations et gouvernance (story 51.4) ────────

describe('PartieDetail — icônes du jeu : membres, invitations et gouvernance (story 51.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const OTHER_ID = 'member-2';
  const THIRD_ID = 'member-3';
  const tone = TONE_MAP['grimoire-emeraude'];
  const groupe = (over: Partial<PartieDto> = {}) =>
    makePartie({
      gameSystemId: 'ralliement',
      kind: 'CAMPAGNE_EPISODIQUE',
      role: 'admin',
      ...over,
    });
  const member = (
    userId: string,
    displayName: string,
    role: 'ADMIN' | 'MEMBER',
  ): PartieMemberDto => ({
    userId,
    pseudo: displayName.toLowerCase(),
    displayName,
    role,
    joinedAt: '2026-10-01T00:00:00Z',
  });
  /** Créateur (soi) admin, un second admin, un membre ordinaire. */
  const members = [
    member(MJ_ID, 'Créateur', 'ADMIN'),
    member(OTHER_ID, 'Seconde', 'ADMIN'),
    member(THIRD_ID, 'Membre', 'MEMBER'),
  ];
  const links: InviteLinkDto[] = [
    {
      id: 'l1',
      token: 'active-token',
      maxUses: 1,
      usesCount: 0,
      expiresAt: '2099-01-01',
      revoked: false,
      createdAt: '',
    },
  ];
  const EMOJI = /[⚔🌿⚙]/u;
  const iconsOf = (node: Element | null | undefined) =>
    Array.from(node?.querySelectorAll('app-icon') ?? []).map((i) => i.getAttribute('data-icon'));
  const settle = async (fixture: ComponentFixture<PartieDetail>) => {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  };
  const openMissives = (el: HTMLElement, fixture: ComponentFixture<PartieDetail>) => {
    el.querySelectorAll<HTMLElement>('div[role="tab"]')[3].click();
    fixture.detectChanges();
  };
  /** Onglet des invitations d'une quête (le MJ y retire un joueur et invite). */
  const openQuestInvitations = (el: HTMLElement, fixture: ComponentFixture<PartieDetail>) => {
    const tab = Array.from(el.querySelectorAll<HTMLElement>('div[role="tab"]')).find((t) =>
      t.textContent?.includes(tone['partie.invitations_tab_label']),
    );
    tab?.click();
    fixture.detectChanges();
  };
  const rows = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.ralliement-members .result-row')) as HTMLElement[];

  it.each(THEMES)(
    'thème %s : le titre de la liste des membres porte l’icône « membres » et aucun emoji',
    async (theme) => {
      const { fixture, el } = await createFixture(groupe(), MJ_ID, {
        members,
        theme,
        noopAnimations: true,
      });
      openMissives(el, fixture);
      const titre = el.querySelector('.ralliement-members h3.members-title') as HTMLElement;
      const mot = TONE_MAP[theme]['partie.members_title'];

      expect(EMOJI.test(mot)).toBe(false);
      expect(titre.textContent?.trim()).toBe(mot);
      expect(iconsOf(titre)).toEqual(['membres']);
      // Décorative : le mot est écrit à côté.
      expect(titre.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    },
  );

  it('les titres des trois thèmes : « Compagnons », « Habitants », « Équipage »', () => {
    expect(TONE_MAP['grimoire-emeraude']['partie.members_title']).toBe('Compagnons');
    expect(TONE_MAP['foret-ancienne']['partie.members_title']).toBe('Habitants');
    expect(TONE_MAP['atelier-cuivre']['partie.members_title']).toBe('Équipage');
  });

  it('quête : le titre des membres (onglet des invitations du MJ) porte aussi l’icône', async () => {
    const { fixture, el } = await createFixture(makePartie({ ownerId: MJ_ID }), MJ_ID, {
      members,
      noopAnimations: true,
    });
    openQuestInvitations(el, fixture);
    const titre = el.querySelector('.invite h3.members-title') as HTMLElement;
    expect(iconsOf(titre)).toEqual(['membres']);
  });

  it('quête : « Retirer » un joueur porte l’icône « retirer-membre »', async () => {
    const { fixture, el } = await createFixture(makePartie({ ownerId: MJ_ID }), MJ_ID, {
      members,
      noopAnimations: true,
    });
    openQuestInvitations(el, fixture);
    const boutons = Array.from(el.querySelectorAll('.invite .result-row button'));
    expect(boutons.length).toBeGreaterThan(0);
    for (const bouton of boutons) expect(iconsOf(bouton)).toEqual(['retirer-membre']);
  });

  it('gouvernance : une icône par geste, le badge Admin n’est plus un bouclier', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, { members, noopAnimations: true });
    openMissives(el, fixture);
    const [moi, seconde, membre] = rows(el);

    // Soi : badge Admin, puis « Quitter l'office ».
    expect(iconsOf(moi.querySelector('.admin-badge'))).toEqual(['role-admin']);
    // Story 51.7 : chaque ligne porte en tête l'icône de l'identité du joueur (silhouette, via roleIconName).
    expect(iconsOf(moi)).toEqual(['role-joueur', 'role-admin', 'quitter-office']);
    // Le second admin : badge seul.
    expect(iconsOf(seconde)).toEqual(['role-joueur', 'role-admin']);
    // Le membre : « Nommer admin » puis « Retirer ».
    expect(iconsOf(membre)).toEqual(['role-joueur', 'nommer-admin', 'retirer-membre']);
    // Chaque bouton de gestion ne porte qu'une icône, décorative, à côté de son libellé écrit.
    const boutons = rows(el).flatMap((row) =>
      Array.from(row.querySelectorAll('button:not(.library-open)')),
    );
    expect(boutons).toHaveLength(3);
    for (const bouton of boutons) {
      expect(bouton.querySelectorAll('app-icon')).toHaveLength(1);
      expect(bouton.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
    expect(el.querySelector('.ralliement-members mat-icon')).toBeNull();
  });

  it('pied de carte : « Quitter l’office » (admin) et « Quitter le groupe » (membre) ont chacun leur icône', async () => {
    const admin = await createFixture(groupe(), MJ_ID, { members });
    const stepDown = Array.from(admin.el.querySelectorAll('mat-card-actions button')).find((b) =>
      b.textContent?.includes(tone['partie.ralliement_step_down_btn']),
    );
    expect(iconsOf(stepDown)).toEqual(['quitter-office']);
    TestBed.resetTestingModule();

    const simple = await createFixture(groupe({ role: 'member' }), THIRD_ID, { members });
    const leave = Array.from(simple.el.querySelectorAll('mat-card-actions button')).find((b) =>
      b.textContent?.includes(tone['partie.ralliement_leave_btn']),
    );
    expect(iconsOf(leave)).toEqual(['quitter-groupe']);
  });

  it('panneau d’invitations : recherche, invitation, e-mail, lien, copie et révocation', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, {
      members,
      links,
      noopAnimations: true,
    });
    openMissives(el, fixture);
    await settle(fixture);
    fixture.componentInstance['results'].set([{ id: 'u9', pseudo: 'Zed' }]);
    fixture.detectChanges();

    const searchButtons = Array.from(el.querySelectorAll('.search-row button'));
    expect(searchButtons.map((b) => iconsOf(b))).toEqual([['rechercher'], ['email']]);
    // « Inviter » sur un résultat de recherche.
    // (la ligne du résultat suit les trois lignes de membres)
    const resultRow = rows(el)[3];
    expect(iconsOf(resultRow.querySelector('button'))).toEqual(['inviter']);
    // Générer un lien.
    const generer = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(tone['partie.ralliement_generate_link']),
    );
    expect(iconsOf(generer)).toEqual(['lien']);
    // Copier / révoquer : icône SEULE dans un bouton qui porte l'aria-label, donc décorative.
    const [copier, revoquer] = Array.from(el.querySelectorAll('.link-row button'));
    expect(iconsOf(copier)).toEqual(['copier']);
    expect(copier.getAttribute('aria-label')).toBe(tone['common.copier']);
    expect(iconsOf(revoquer)).toEqual(['lien-revoque']);
    expect(revoquer.getAttribute('aria-label')).toBe(tone['common.revoquer']);
    for (const b of [copier, revoquer]) {
      expect(b.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(b.querySelector('svg')?.hasAttribute('aria-label')).toBe(false);
    }
    expect(el.querySelector('.invite mat-icon')).toBeNull();
  });

  it('changer de thème : les icônes « de sens » changent sur place, les utilitaires non', async () => {
    const { fixture, el } = await createFixture(groupe(), MJ_ID, {
      members,
      links,
      noopAnimations: true,
    });
    openMissives(el, fixture);
    await settle(fixture);
    const drawing = (name: string) =>
      el.querySelector(`.ralliement-members app-icon[data-icon="${name}"] svg`)?.innerHTML;
    const themed = ['role-admin', 'quitter-office', 'nommer-admin', 'retirer-membre', 'membres'];
    const utility = ['email', 'lien', 'copier', 'rechercher'];
    const before = Object.fromEntries([...themed, ...utility].map((n) => [n, drawing(n)]));
    for (const name of [...themed, ...utility]) expect(before[name], name).toBeTruthy();

    const theme = TestBed.inject(ThemeToneService) as unknown as {
      activeTheme: { set: (t: Theme) => void };
    };
    theme.activeTheme.set('foret-ancienne');
    fixture.detectChanges();

    for (const name of themed) expect(drawing(name), name).not.toBe(before[name]);
    for (const name of utility) expect(drawing(name), name).toBe(before[name]);
  });
});
