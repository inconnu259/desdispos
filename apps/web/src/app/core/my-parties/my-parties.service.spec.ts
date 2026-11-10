import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MyPartiesService } from './my-parties.service';
import { PartiesService } from '../parties/parties.service';

describe('MyPartiesService', () => {
  let service: MyPartiesService;
  let result: unknown[];
  let partiesMock: { list: ReturnType<typeof vi.fn>; hide: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    result = [];
    partiesMock = {
      list: vi.fn(() => Promise.resolve(result)),
      hide: vi.fn().mockResolvedValue({ ok: true }),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: PartiesService, useValue: partiesMock }],
    });
    service = TestBed.inject(MyPartiesService);
  });

  it("nettoie la clé localStorage orpheline 'master-jdr.mode' de l'ancien ModeService (revue de code)", () => {
    localStorage.setItem('master-jdr.mode', 'mj');
    TestBed.resetTestingModule();
    const mock = { list: vi.fn().mockResolvedValue([]) };
    TestBed.configureTestingModule({
      providers: [{ provide: PartiesService, useValue: mock }],
    });
    TestBed.inject(MyPartiesService);

    expect(localStorage.getItem('master-jdr.mode')).toBeNull();
  });

  it('Story 42.5 : hide() retire la partie côté serveur PUIS relit la liste ; un refus remonte et ne relit rien', async () => {
    result = [{ id: 'p2', role: 'mj' }];
    await service.hide('p1');
    expect(partiesMock.hide).toHaveBeenCalledWith('p1');
    expect(partiesMock.list).toHaveBeenCalledTimes(1);
    expect(service.allParties().map((p) => p.id)).toEqual(['p2']);

    partiesMock.list.mockClear();
    partiesMock.hide.mockRejectedValue(new Error('400'));
    await expect(service.hide('p1')).rejects.toThrow('400');
    expect(partiesMock.list).not.toHaveBeenCalled();
  });

  it('hasMjParties devient true après refresh avec des parties', async () => {
    result = [{ id: 'p1', role: 'mj' }];
    await service.refreshAll();
    expect(service.hasMjParties()).toBe(true);
  });

  describe('une seule lecture, tous rôles confondus (Story 38.5)', () => {
    it('refreshAll() appelle list() sans rôle, une seule fois', async () => {
      await service.refreshAll();
      expect(partiesMock.list).toHaveBeenCalledTimes(1);
      expect(partiesMock.list).toHaveBeenCalledWith();
    });

    it('allParties() est la liste complète, ralliements compris, dans l’ordre du serveur', async () => {
      result = [
        { id: 'p-mj', role: 'mj' },
        { id: 'p-admin', role: 'admin' },
        { id: 'p-player', role: 'player' },
        { id: 'p-member', role: 'member' },
      ];
      await service.refreshAll();
      expect(service.allParties().map((p) => p.id)).toEqual([
        'p-mj',
        'p-admin',
        'p-player',
        'p-member',
      ]);
    });

    it('mjParties() et playerParties() sont des filtres calculés sur role mj / player (ni admin ni member)', async () => {
      result = [
        { id: 'p-mj', role: 'mj' },
        { id: 'p-admin', role: 'admin' },
        { id: 'p-player', role: 'player' },
        { id: 'p-member', role: 'member' },
      ];
      await service.refreshAll();
      expect(service.mjParties().map((p) => p.id)).toEqual(['p-mj']);
      expect(service.playerParties().map((p) => p.id)).toEqual(['p-player']);
    });

    it('refreshMjParties() et refreshPlayerParties() sont de simples alias : un seul appel réseau chacun', async () => {
      await service.refreshMjParties();
      expect(partiesMock.list).toHaveBeenCalledTimes(1);
      await service.refreshPlayerParties();
      expect(partiesMock.list).toHaveBeenCalledTimes(2);
      expect(partiesMock.list).toHaveBeenLastCalledWith();
    });

    it('notifyChanged() (Story 22.1, AC2/AC3) recharge la liste, en un seul appel', async () => {
      result = [
        { id: 'p-mj', role: 'mj' },
        { id: 'p-player', role: 'player' },
      ];

      service.notifyChanged();
      // notifyChanged() appelle une méthode async fire-and-forget (void) — flush des microtasks.
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      expect(partiesMock.list).toHaveBeenCalledTimes(1);
      expect(service.mjParties()).toEqual([{ id: 'p-mj', role: 'mj' }]);
      expect(service.playerParties()).toEqual([{ id: 'p-player', role: 'player' }]);
    });

    it('reflète un changement ultérieur (dérivé, pas figé)', async () => {
      await service.refreshAll();
      expect(service.allParties()).toEqual([]);

      result = [{ id: 'p-mj', role: 'mj' }];
      await service.refreshAll();
      expect(service.allParties()).toEqual([{ id: 'p-mj', role: 'mj' }]);
      expect(service.mjParties()).toEqual([{ id: 'p-mj', role: 'mj' }]);
    });
  });

  describe('bug fix critique : garde de concurrence + jamais de vidage sur échec transitoire', () => {
    it('refreshAll() : un échec réseau conserve le dernier état connu bon (jamais de .set([]))', async () => {
      result = [{ id: 'p-mj', role: 'mj' }];
      await service.refreshAll();
      expect(service.allParties()).toEqual([{ id: 'p-mj', role: 'mj' }]);

      partiesMock.list.mockRejectedValueOnce(new Error('network down'));
      await service.refreshAll();

      expect(service.allParties()).toEqual([{ id: 'p-mj', role: 'mj' }]);
      expect(service.mjParties()).toEqual([{ id: 'p-mj', role: 'mj' }]);
    });

    it("refreshAll() : une réponse obsolète (résolue en désordre) n'écrase jamais un état plus frais", async () => {
      let resolveFirst!: (v: unknown[]) => void;
      let resolveSecond!: (v: unknown[]) => void;
      partiesMock.list
        .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
        .mockImplementationOnce(() => new Promise((r) => (resolveSecond = r)));

      const first = service.refreshAll(); // plus ancien, plus lent
      const second = service.refreshAll(); // plus récent, plus rapide

      // Le plus récent résout EN PREMIER (ex. le plus ancien a été ralenti par le réseau).
      resolveSecond([{ id: 'fresh', role: 'player' }]);
      await second;
      expect(service.playerParties()).toEqual([{ id: 'fresh', role: 'player' }]);

      // Le plus ancien résout ensuite — ne doit PAS écraser l'état plus frais déjà posé.
      resolveFirst([{ id: 'stale', role: 'player' }]);
      await first;
      expect(service.playerParties()).toEqual([{ id: 'fresh', role: 'player' }]);
    });
  });
});
