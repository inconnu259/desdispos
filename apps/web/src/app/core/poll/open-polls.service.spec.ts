import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { OpenPollEntry, PartieDto } from '@master-jdr/shared';
import { OpenPollsService } from './open-polls.service';
import { PollService } from './poll.service';
import { MyPartiesService } from '../my-parties/my-parties.service';

// Story 44.2 — `OpenPollsService` ne fait plus qu'UNE lecture, `GET /me/open-polls`, au lieu d'un appel par
// partie. `entries` porte la liste complète ; `openPolls` / `count` restent ce qu'ils étaient pour le
// tableau de bord et le shell : le vote de JDR encore à faire, par partie où je suis joueur.

function makeParty(id: string, role: PartieDto['role'] = 'player'): PartieDto {
  return {
    id,
    name: `Party ${id}`,
    kind: 'ONE_SHOT',
    gameSystemId: 'draconis',
    description: null,
    ownerId: 'mj-1',
    createdAt: '',
    nextSessionDate: null,
    nextSessionSlot: null,
    role,
    status: 'EN_COURS',
    isFavorite: false,
    coverImageVersion: null,
  } as PartieDto;
}

function makeEntry(partieId: string, over: Partial<OpenPollEntry> = {}): OpenPollEntry {
  return {
    pollId: `poll-${partieId}`,
    partieId,
    partieName: `Party ${partieId}`,
    family: 'jdr',
    kind: 'ONE_SHOT',
    seanceId: `seance-${partieId}`,
    title: 'Séance',
    expiresAt: null,
    durationSlots: 1,
    options: [
      {
        optionId: 'o1',
        date: '2026-11-01',
        slot: 'MORNING',
        yes: 0,
        maybe: 0,
        no: 0,
        myAnswer: null,
      },
    ],
    eligibleCount: 3,
    answeredCount: 0,
    me: { eligible: true, answered: false },
    can: { propose: false, edit: false, choose: false, extend: false },
    ...over,
  };
}

// Instancier le service dans un composant permet à `fixture.whenStable()` de vider la queue d'effects.
@Component({ selector: 'app-test-host', template: '', standalone: true })
class TestHost {
  readonly svc = inject(OpenPollsService);
}

async function createHarness(
  parties: PartieDto[],
  getMyOpenPolls: ReturnType<typeof vi.fn>,
  partiesLoaded = true,
) {
  const allParties = signal(parties);
  const loaded = signal(partiesLoaded);
  await TestBed.configureTestingModule({
    imports: [TestHost],
    providers: [
      {
        provide: MyPartiesService,
        useValue: {
          allParties,
          loaded,
          playerParties: () => allParties().filter((p) => p.role === 'player'),
        },
      },
      { provide: PollService, useValue: { getMyOpenPolls } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(TestHost);
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };
  await settle();
  return { svc: fixture.componentInstance.svc, allParties, loaded, settle };
}

describe('OpenPollsService (Story 44.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('une seule lecture pour toutes les parties, et count() = parties de joueur avec un vote à faire', async () => {
    const get = vi.fn().mockResolvedValue([makeEntry('p1'), makeEntry('p2')]);
    const { svc } = await createHarness([makeParty('p1'), makeParty('p2'), makeParty('p3')], get);

    expect(get).toHaveBeenCalledTimes(1);
    expect(svc.count()).toBe(2);
    expect([...svc.openPolls().keys()].sort()).toEqual(['p1', 'p2']);
  });

  it('entries() porte tout ce que le serveur sert, groupes et parties où je suis MJ compris', async () => {
    const groupe = makeEntry('g1', { family: 'ralliement' });
    const maitrise = makeEntry('m1');
    const get = vi.fn().mockResolvedValue([makeEntry('p1'), groupe, maitrise]);
    const { svc } = await createHarness(
      [makeParty('p1'), makeParty('g1', 'member'), makeParty('m1', 'mj')],
      get,
    );

    expect(svc.entries().map((e) => e.partieId)).toEqual(['p1', 'g1', 'm1']);
    // Mais le compteur et le tableau de bord ne voient que les votes de JDR de mes parties de joueur.
    expect([...svc.openPolls().keys()]).toEqual(['p1']);
  });

  it('un vote déjà répondu, ou dont je ne suis pas votant, ne compte pas', async () => {
    const get = vi
      .fn()
      .mockResolvedValue([
        makeEntry('p1', { me: { eligible: true, answered: true } }),
        makeEntry('p2', { me: { eligible: false, answered: false } }),
        makeEntry('p3'),
      ]);
    const { svc } = await createHarness([makeParty('p1'), makeParty('p2'), makeParty('p3')], get);

    expect([...svc.openPolls().keys()]).toEqual(['p3']);
  });

  it('plusieurs votes sur une partie : le premier à faire est retenu, un seul par partie', async () => {
    const get = vi
      .fn()
      .mockResolvedValue([
        makeEntry('p1', { pollId: 'fait', me: { eligible: true, answered: true } }),
        makeEntry('p1', { pollId: 'a-faire-1' }),
        makeEntry('p1', { pollId: 'a-faire-2' }),
      ]);
    const { svc } = await createHarness([makeParty('p1')], get);

    expect(svc.count()).toBe(1);
    expect(svc.openPolls().get('p1')?.pollId).toBe('a-faire-1');
  });

  it('loaded() passe à vrai dès la première lecture réussie — l’absence d’un vote fait alors autorité', async () => {
    let resolve!: (v: OpenPollEntry[]) => void;
    const get = vi.fn().mockReturnValue(new Promise<OpenPollEntry[]>((r) => (resolve = r)));
    const { svc } = await createHarness([makeParty('p1')], get);
    expect(svc.loaded()).toBe(false);

    resolve([makeEntry('p1')]);
    await Promise.resolve();
    await Promise.resolve();

    expect(svc.loaded()).toBe(true);
  });

  it('aucune partie : aucune requête, liste vide', async () => {
    const get = vi.fn();
    const { svc } = await createHarness([], get);

    expect(get).not.toHaveBeenCalled();
    expect(svc.entries()).toEqual([]);
    // Sans partie il n'y a rien à attendre : la liste vide fait déjà autorité.
    expect(svc.loaded()).toBe(true);
    expect(svc.count()).toBe(0);
  });

  it('44.7 : tant que la liste de mes parties n’est pas lue, « aucune partie » ne vaut pas « chargé »', async () => {
    const get = vi.fn().mockResolvedValue([makeEntry('p1')]);
    const { svc, allParties, loaded, settle } = await createHarness([], get, false);

    // Démarrage : la liste est vide parce qu'elle n'est pas encore là.
    expect(svc.loaded()).toBe(false);
    expect(get).not.toHaveBeenCalled();

    allParties.set([makeParty('p1')]);
    loaded.set(true);
    await settle();
    expect(get).toHaveBeenCalledTimes(1);
    expect(svc.loaded()).toBe(true);
    expect(svc.entries()[0].pollId).toBe('poll-p1');
  });

  it('44.7 : liste lue et vide → chargé, sans requête', async () => {
    const get = vi.fn();
    const { svc, loaded, settle } = await createHarness([], get, false);
    expect(svc.loaded()).toBe(false);

    loaded.set(true);
    await settle();
    expect(svc.loaded()).toBe(true);
    expect(get).not.toHaveBeenCalled();
  });

  it('notifyChanged() relit la liste (signal temps réel user:{id})', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce([makeEntry('p1')])
      .mockResolvedValueOnce([]);
    const { svc } = await createHarness([makeParty('p1')], get);
    expect(svc.count()).toBe(1);

    svc.notifyChanged();
    await Promise.resolve();
    await Promise.resolve();

    expect(get).toHaveBeenCalledTimes(2);
    expect(svc.count()).toBe(0);
  });

  it('un changement de statut ou de favori ne relance aucune lecture ; un changement d’ensemble de parties, si', async () => {
    const get = vi.fn().mockResolvedValue([]);
    const { allParties, settle } = await createHarness([makeParty('p1')], get);
    expect(get).toHaveBeenCalledTimes(1);

    allParties.set([{ ...makeParty('p1'), isFavorite: true }]);
    await settle();
    expect(get).toHaveBeenCalledTimes(1);

    allParties.set([makeParty('p1'), makeParty('p2')]);
    await settle();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('un échec transitoire garde le dernier état connu bon', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce([makeEntry('p1')])
      .mockRejectedValueOnce(new Error('réseau'));
    const { svc } = await createHarness([makeParty('p1')], get);

    svc.notifyChanged();
    await Promise.resolve();
    await Promise.resolve();

    expect(svc.count()).toBe(1);
  });

  it('une réponse obsolète n’écrase pas une réponse plus récente', async () => {
    let resolveSlow!: (v: OpenPollEntry[]) => void;
    const slow = new Promise<OpenPollEntry[]>((r) => (resolveSlow = r));
    const get = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(slow)
      .mockResolvedValueOnce([makeEntry('p1')]);
    const { svc } = await createHarness([makeParty('p1')], get);

    svc.notifyChanged(); // lente, partie la première
    svc.notifyChanged(); // rapide, partie ensuite
    await Promise.resolve();
    await Promise.resolve();
    expect(svc.count()).toBe(1);

    resolveSlow([]); // la lente arrive en dernier : ignorée
    await Promise.resolve();
    await Promise.resolve();
    expect(svc.count()).toBe(1);
  });
});
