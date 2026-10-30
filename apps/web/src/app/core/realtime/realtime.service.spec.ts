import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { API_BASE } from '../api-base';
import { PartiesService } from '../parties/parties.service';
import { ScenariosService } from '../scenarios/scenarios.service';
import { CharacterService } from '../characters/character.service';
import { HommeDragonService } from '../homme-dragon/homme-dragon.service';
import { InvitationsService } from '../invitations/invitations.service';
import { DatableSeancesService } from '../poll/datable-seances.service';
import { OpenPollsService } from '../poll/open-polls.service';
import { MyPartiesService } from '../my-parties/my-parties.service';
import { AvailabilityService } from '../availability/availability.service';
import { CharacterRolesService } from '../character-roles/character-roles.service';
import { PartySignalsService } from '../parties/party-signals.service';
import { BoardGamesService } from '../board-games/board-games.service';
import { RealtimeService, matchingHandlers, partieTopic, userTopic } from './realtime.service';

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

describe('partieTopic', () => {
  it("construit le topic au format 'partie:{id}'", () => {
    expect(partieTopic('p1')).toBe('partie:p1');
  });
});

describe('userTopic', () => {
  it("construit le topic au format 'user:{id}'", () => {
    expect(userTopic('u1')).toBe('user:u1');
  });
});

describe('matchingHandlers', () => {
  it('retourne les handlers dont le préfixe matche le topic', () => {
    const notifyChanged = () => {};
    const handlers = [{ prefix: 'partie:', notifyChanged }];

    expect(matchingHandlers(handlers, 'partie:p1')).toEqual(handlers);
  });

  it('ignore les handlers dont le préfixe ne matche pas', () => {
    const handlers = [{ prefix: 'partie:', notifyChanged: () => {} }];

    expect(matchingHandlers(handlers, 'user:u1')).toEqual([]);
  });
});

describe('RealtimeService', () => {
  let service: RealtimeService;
  let originalEventSource: unknown;
  let partiesSvc: {
    notifyChanged: ReturnType<typeof vi.fn>;
    changed: ReturnType<typeof signal<number>>;
  };
  let scenariosSvc: {
    notifyRealtimeChanged: ReturnType<typeof vi.fn>;
    changed: ReturnType<typeof signal<{ partieId: string } | null>>;
  };
  let charactersSvc: {
    notifyChanged: ReturnType<typeof vi.fn>;
    changed: ReturnType<typeof signal<number>>;
  };
  let hommeDragonSvc: {
    notifyChanged: ReturnType<typeof vi.fn>;
    changed: ReturnType<typeof signal<number>>;
  };
  let invitationsSvc: {
    notifyChanged: ReturnType<typeof vi.fn>;
    changed: ReturnType<typeof signal<number>>;
  };
  let openPollsSvc: { notifyChanged: ReturnType<typeof vi.fn> };
  let datableSeancesSvc: { notifyChanged: ReturnType<typeof vi.fn> };
  let myPartiesSvc: { notifyChanged: ReturnType<typeof vi.fn> };
  let availabilitySvc: { notifyChanged: ReturnType<typeof vi.fn> };
  let characterRolesSvc: { notifyChanged: ReturnType<typeof vi.fn> };
  let partySignalsSvc: { notifyChanged: ReturnType<typeof vi.fn> };
  let boardGamesSvc: { notifyChanged: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    originalEventSource = (globalThis as any).EventSource;
    FakeEventSource.instances = [];
    (globalThis as any).EventSource = FakeEventSource;
    partiesSvc = { notifyChanged: vi.fn(), changed: signal(0) };
    // Story 19.1 (Task 2) : RealtimeService injecte désormais aussi ScenariosService (deuxième
    // entrée dans handlers, même préfixe 'partie:'). Mock direct, comme PartiesService.
    scenariosSvc = { notifyRealtimeChanged: vi.fn(), changed: signal(null) };
    // Story 20.1 (Task 2) : RealtimeService injecte désormais aussi CharacterService (troisième
    // entrée dans handlers, même préfixe 'partie:'). Mock direct, comme PartiesService.
    charactersSvc = { notifyChanged: vi.fn(), changed: signal(0) };
    // Story 20.2 (Task 2) : RealtimeService injecte désormais aussi HommeDragonService (quatrième
    // entrée dans handlers, même préfixe 'partie:'). Mock direct, comme PartiesService.
    hommeDragonSvc = { notifyChanged: vi.fn(), changed: signal(0) };
    // Story 21.1 (Task 3) : RealtimeService injecte désormais aussi InvitationsService (cinquième
    // entrée dans handlers, PREMIÈRE au préfixe 'user:'). Mock direct, comme PartiesService.
    invitationsSvc = { notifyChanged: vi.fn(), changed: signal(0) };
    // Story 22.1 : RealtimeService injecte désormais aussi OpenPollsService (sixième entrée,
    // préfixe 'partie:'). Mock direct.
    openPollsSvc = { notifyChanged: vi.fn() };
    datableSeancesSvc = { notifyChanged: vi.fn() };
    // Bug fix post-22.1 : ModeService (renommé MyPartiesService, Story 29.1) rebranché sur le
    // préfixe 'user:' (ne représente que l'appartenance, jamais déclenché par une mutation
    // partie-scopée générique).
    myPartiesSvc = { notifyChanged: vi.fn() };
    // Bug fix (calendrier MJ jamais notifié) : AvailabilityService ajoutée au préfixe 'partie:'.
    availabilitySvc = { notifyChanged: vi.fn() };
    // Story 27.3 : CharacterRolesService ajoutée au préfixe 'partie:'.
    characterRolesSvc = { notifyChanged: vi.fn() };
    // Story 29.7 : PartySignalsService ajoutée au préfixe 'user:' SEUL (AD-3/AD-14).
    partySignalsSvc = { notifyChanged: vi.fn() };
    // Story 48.1 : BoardGamesService ajoutée au préfixe 'user:' SEUL.
    boardGamesSvc = { notifyChanged: vi.fn() };
    // RealtimeService injecte désormais PartiesService (Story 18.3, Task 4) — PartiesService
    // injecte lui-même HttpClient, jamais fourni par ce module de test isolé. Mock direct : ce
    // test ne porte pas sur les appels HTTP de PartiesService.
    TestBed.configureTestingModule({
      providers: [
        { provide: PartiesService, useValue: partiesSvc },
        { provide: ScenariosService, useValue: scenariosSvc },
        { provide: CharacterService, useValue: charactersSvc },
        { provide: HommeDragonService, useValue: hommeDragonSvc },
        { provide: InvitationsService, useValue: invitationsSvc },
        { provide: OpenPollsService, useValue: openPollsSvc },
        { provide: DatableSeancesService, useValue: datableSeancesSvc },
        { provide: MyPartiesService, useValue: myPartiesSvc },
        { provide: AvailabilityService, useValue: availabilitySvc },
        { provide: CharacterRolesService, useValue: characterRolesSvc },
        { provide: PartySignalsService, useValue: partySignalsSvc },
        { provide: BoardGamesService, useValue: boardGamesSvc },
      ],
    });
    service = TestBed.inject(RealtimeService);
  });

  afterEach(() => {
    (globalThis as any).EventSource = originalEventSource;
  });

  it('connect() construit un EventSource avec la bonne URL et withCredentials: true (AC2)', () => {
    service.connect(partieTopic('p1'));

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe(`${API_BASE}/parties/p1/events`);
    expect(FakeEventSource.instances[0].init).toEqual({ withCredentials: true });
  });

  it("n'enregistre aucun listener 'error' — reconnexion native silencieuse (AC3)", () => {
    service.connect(partieTopic('p1'));

    expect(FakeEventSource.instances[0].listeners.get('error')).toBeUndefined();
  });

  it("'open' déclenche notifyChanged() sur le handler mappé au préfixe du topic (AC4, Story 18.3)", () => {
    service.connect(partieTopic('p1'));

    FakeEventSource.instances[0].emit('open');

    expect(partiesSvc.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it("'message' déclenche le même mécanisme de notification que 'open' (AC4)", () => {
    service.connect(partieTopic('p1'));

    FakeEventSource.instances[0].emit('message');

    expect(partiesSvc.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it("'open' déclenche AUSSI notifyRealtimeChanged() sur ScenariosService — deux handlers au même préfixe (Story 19.1, AC1)", () => {
    service.connect(partieTopic('p1'));

    FakeEventSource.instances[0].emit('open');

    expect(partiesSvc.notifyChanged).toHaveBeenCalledTimes(1);
    expect(scenariosSvc.notifyRealtimeChanged).toHaveBeenCalledTimes(1);
  });

  it("'open' déclenche AUSSI notifyChanged() sur CharacterService — trois handlers au même préfixe (Story 20.1, AC1)", () => {
    service.connect(partieTopic('p1'));

    FakeEventSource.instances[0].emit('open');

    expect(partiesSvc.notifyChanged).toHaveBeenCalledTimes(1);
    expect(scenariosSvc.notifyRealtimeChanged).toHaveBeenCalledTimes(1);
    expect(charactersSvc.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it("un topic 'partie:' ne déclenche JAMAIS HommeDragonService (AD-23) : la fiche n'écoute que 'user:'", () => {
    service.connect(partieTopic('p1'));

    FakeEventSource.instances[0].emit('open');
    FakeEventSource.instances[0].emit('message');

    expect(partiesSvc.notifyChanged).toHaveBeenCalledTimes(2);
    expect(hommeDragonSvc.notifyChanged).not.toHaveBeenCalled();
  });

  it("un topic 'user:' déclenche HommeDragonService.notifyChanged() — niveau et historique suivent un scénario clos (AD-23)", () => {
    service.connect(userTopic('u1'));

    FakeEventSource.instances[0].emit('open');
    expect(hommeDragonSvc.notifyChanged).toHaveBeenCalledTimes(1);

    FakeEventSource.instances[0].emit('message');
    expect(hommeDragonSvc.notifyChanged).toHaveBeenCalledTimes(2);
  });

  it("'open' déclenche AUSSI notifyChanged() sur AvailabilityService — quatre handlers au même préfixe 'partie:' (Story 22.1, AC1 ; bug fix calendrier)", () => {
    service.connect(partieTopic('p1'));

    FakeEventSource.instances[0].emit('open');

    expect(partiesSvc.notifyChanged).toHaveBeenCalledTimes(1);
    expect(scenariosSvc.notifyRealtimeChanged).toHaveBeenCalledTimes(1);
    expect(charactersSvc.notifyChanged).toHaveBeenCalledTimes(1);
    expect(availabilitySvc.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it("Story 44.2 : mes sondages ouverts se relisent sur 'user:' (une liste pour toutes mes parties), jamais sur 'partie:'", () => {
    service.connect(partieTopic('p1'));
    FakeEventSource.instances[0].emit('open');
    expect(openPollsSvc.notifyChanged).not.toHaveBeenCalled();
    service.disconnect(partieTopic('p1'));

    service.connect(userTopic('u1'));
    FakeEventSource.instances[1].emit('open');
    expect(openPollsSvc.notifyChanged).toHaveBeenCalledTimes(1);
    FakeEventSource.instances[1].emit('message');
    expect(openPollsSvc.notifyChanged).toHaveBeenCalledTimes(2);
  });

  it("Story 45.1 : mes rendez-vous à dater se relisent sur 'user:', jamais sur 'partie:'", () => {
    service.connect(partieTopic('p1'));
    FakeEventSource.instances[0].emit('open');
    expect(datableSeancesSvc.notifyChanged).not.toHaveBeenCalled();
    service.disconnect(partieTopic('p1'));

    service.connect(userTopic('u1'));
    FakeEventSource.instances[1].emit('open');
    expect(datableSeancesSvc.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it("un topic 'partie:' ne déclenche PAS notifyChanged() sur MyPartiesService (bug fix : préfixe rebranché sur 'user:')", () => {
    service.connect(partieTopic('p1'));

    FakeEventSource.instances[0].emit('open');

    expect(myPartiesSvc.notifyChanged).not.toHaveBeenCalled();
  });

  it("'open' sur un topic 'user:' déclenche notifyChanged() sur MyPartiesService (bug fix)", () => {
    service.connect(userTopic('u1'));

    FakeEventSource.instances[0].emit('open');

    expect(myPartiesSvc.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it("un topic 'user:' ne déclenche PAS notifyChanged() de PartiesService (préfixe non mappé)", () => {
    service.connect(userTopic('u1'));

    FakeEventSource.instances[0].emit('open');

    expect(partiesSvc.notifyChanged).not.toHaveBeenCalled();
  });

  it("'open' sur un topic 'user:' déclenche notifyChanged() sur InvitationsService (AC1, Story 21.1)", () => {
    service.connect(userTopic('u1'));

    FakeEventSource.instances[0].emit('open');

    expect(invitationsSvc.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it("un topic 'partie:' ne déclenche PAS notifyChanged() sur InvitationsService (préfixe différent, Story 21.1)", () => {
    service.connect(partieTopic('p1'));

    FakeEventSource.instances[0].emit('open');

    expect(partiesSvc.notifyChanged).toHaveBeenCalledTimes(1);
    expect(invitationsSvc.notifyChanged).not.toHaveBeenCalled();
  });

  it("'open' sur un topic 'user:' déclenche notifyChanged() sur PartySignalsService (Story 29.7, AC6)", () => {
    service.connect(userTopic('u1'));

    FakeEventSource.instances[0].emit('open');

    expect(partySignalsSvc.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it("un topic 'partie:' ne déclenche PAS notifyChanged() sur PartySignalsService (préfixe 'user:' seul, AD-14)", () => {
    service.connect(partieTopic('p1'));

    FakeEventSource.instances[0].emit('open');

    expect(partySignalsSvc.notifyChanged).not.toHaveBeenCalled();
  });

  it("Story 48.1 : ma Ludothèque se relit sur 'user:' (autres onglets de la même personne)", () => {
    service.connect(userTopic('u1'));
    FakeEventSource.instances[0].emit('open');
    expect(boardGamesSvc.notifyChanged).toHaveBeenCalledTimes(1);
    FakeEventSource.instances[0].emit('message');
    expect(boardGamesSvc.notifyChanged).toHaveBeenCalledTimes(2);
  });

  it("Story 48.3 : la feuille d'une Ludothèque se relit AUSSI sur 'partie:' (l'écriture d'un jeu émet pour chaque partie de ralliement)", () => {
    service.connect(partieTopic('p1'));
    FakeEventSource.instances[0].emit('open');
    expect(boardGamesSvc.notifyChanged).toHaveBeenCalledTimes(1);
    FakeEventSource.instances[0].emit('message');
    expect(boardGamesSvc.notifyChanged).toHaveBeenCalledTimes(2);
  });

  it("'open' déclenche AUSSI notifyChanged() sur CharacterRolesService — préfixe 'partie:' (Story 27.3, AC3)", () => {
    service.connect(partieTopic('p1'));

    FakeEventSource.instances[0].emit('open');

    expect(characterRolesSvc.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it("'open' sur un topic 'user:' déclenche AUSSI notifyRealtimeChanged() sur ScenariosService (deferred-work, SSE calendrier personnel) — même méthode que le préfixe 'partie:' ci-dessus, réutilisée telle quelle", () => {
    service.connect(userTopic('u1'));

    FakeEventSource.instances[0].emit('open');

    expect(scenariosSvc.notifyRealtimeChanged).toHaveBeenCalledTimes(1);
  });

  it('disconnect() ferme la connexion EventSource sous-jacente (AC5)', () => {
    service.connect(partieTopic('p1'));

    service.disconnect(partieTopic('p1'));

    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it('disconnect() sur un topic jamais connecté → no-op silencieux', () => {
    expect(() => service.disconnect(partieTopic('inconnu'))).not.toThrow();
  });

  it('deux connect() sur le même topic ouvrent deux EventSource indépendants (AD-6, anti-dédup)', () => {
    service.connect(partieTopic('p1'));
    service.connect(partieTopic('p1'));

    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('deux disconnect() successifs sur le même topic ferment les deux connexions indépendamment (AD-6)', () => {
    service.connect(partieTopic('p1'));
    service.connect(partieTopic('p1'));

    service.disconnect(partieTopic('p1'));
    service.disconnect(partieTopic('p1'));

    expect(FakeEventSource.instances[0].closed).toBe(true);
    expect(FakeEventSource.instances[1].closed).toBe(true);
  });
});
