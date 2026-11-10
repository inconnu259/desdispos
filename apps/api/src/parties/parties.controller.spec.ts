import { Test } from '@nestjs/testing';

// PartiesController -> create-partie.dto.ts/update-partie.dto.ts -> import RUNTIME (pas `import
// type`) de GAME_SYSTEMS depuis @master-jdr/shared (ESM, non transformé par ts-jest) — même piège
// déjà documenté pour THEMES (account.controller.spec.ts) et @master-jdr/game-rules (mémoire projet).
jest.mock('@master-jdr/shared', () => ({
  // Réduit à ce que lisent les DTO (`id`, et `name` pour la lisibilité) — pas la forme complète
  // du registre (Story 37.5).
  GAME_SYSTEMS: [
    { id: 'draconis', name: 'Draconis' },
    { id: 'conte-de-minuit', name: 'Conte de Minuit' },
    { id: 'ryuutama', name: 'Ryuutama' },
    { id: 'esteren', name: 'Esteren' },
    { id: 'ralliement', name: 'Ralliement' },
  ],
}));

import type { AuthUser } from '@master-jdr/shared';
import { makeAuthUser } from '../common/test-utils/fixtures';
import { PartiesController } from './parties.controller';
import { PartiesService } from './parties.service';

// Story 29.6 : premier fichier de tests pour ce contrôleur (n'existait pas jusqu'ici) — mêmes
// conventions que `scenarios.controller.spec.ts` (instanciation directe via Test.createTestingModule,
// pas de montage HTTP/guards). Couvre l'ensemble des routes existantes, pas seulement close/reopen.
function makePartiesService() {
  return {
    create: jest.fn(),
    listForUser: jest.fn(),
    findOneDto: jest.fn(),
    listMembers: jest.fn(),
    getAvailableSlots: jest.fn(),
    getHeatmap: jest.fn(),
    removeMember: jest.fn(),
    leave: jest.fn(),
    update: jest.fn(),
    convertKind: jest.fn(),
    close: jest.fn(),
    reopen: jest.fn(),
    remove: jest.fn(),
    setVisibilityLocks: jest.fn(),
    getVisibilityLocks: jest.fn(),
  };
}

describe('PartiesController', () => {
  let controller: PartiesController;
  let parties: ReturnType<typeof makePartiesService>;

  const user: AuthUser = makeAuthUser({
    id: 'mj1',
    email: 'mj@test.fr',
    pseudo: 'MJ',
    displayName: 'MJ',
  });

  beforeEach(async () => {
    parties = makePartiesService();
    const module = await Test.createTestingModule({
      controllers: [PartiesController],
      providers: [{ provide: PartiesService, useValue: parties }],
    }).compile();
    controller = module.get(PartiesController);
  });

  it('create() route user/dto vers PartiesService.create', async () => {
    const dto = {
      name: 'La Nuit',
      kind: 'ONE_SHOT' as const,
      gameSystemId: 'draconis',
    };
    await controller.create(user, dto);
    expect(parties.create).toHaveBeenCalledWith('mj1', dto);
  });

  it('list() sans role route vers PartiesService.listForUser sans filtre : toutes les parties avec leur rôle (Story 37.7)', async () => {
    await controller.list(user, undefined);
    expect(parties.listForUser).toHaveBeenCalledWith('mj1', undefined);
  });

  it("list() role: 'mj' route vers PartiesService.listForUser avec le filtre mj", async () => {
    await controller.list(user, 'mj');
    expect(parties.listForUser).toHaveBeenCalledWith('mj1', 'mj');
  });

  it("list() toute autre valeur de role garde son sens historique ('mj')", async () => {
    await controller.list(user, 'n-importe-quoi');
    expect(parties.listForUser).toHaveBeenCalledWith('mj1', 'mj');
  });

  it("list() route role: 'player' vers PartiesService.listForUser", async () => {
    await controller.list(user, 'player');
    expect(parties.listForUser).toHaveBeenCalledWith('mj1', 'player');
  });

  it('get() route id/user vers PartiesService.findOneDto', async () => {
    await controller.get(user, 'p1');
    expect(parties.findOneDto).toHaveBeenCalledWith('p1', 'mj1');
  });

  it('members() route id/user vers PartiesService.listMembers', async () => {
    await controller.members(user, 'p1');
    expect(parties.listMembers).toHaveBeenCalledWith('p1', 'mj1');
  });

  it('removeMember() route id/user/targetUserId vers PartiesService.removeMember', async () => {
    await controller.removeMember(user, 'p1', 'u2');
    expect(parties.removeMember).toHaveBeenCalledWith('p1', 'mj1', 'u2');
  });

  it('leave() route id/user vers PartiesService.leave, motif LEFT sans confirmation (Story 39.5)', async () => {
    await controller.leave(user, 'p1', undefined);
    expect(parties.leave).toHaveBeenCalledWith('p1', 'mj1', {
      type: 'LEFT',
      deleteIfLastAdmin: false,
    });
  });

  it('leave() : seule la valeur exacte « true » confirme la suppression du groupe (Story 39.5)', async () => {
    await controller.leave(user, 'p1', 'true');
    expect(parties.leave).toHaveBeenLastCalledWith('p1', 'mj1', {
      type: 'LEFT',
      deleteIfLastAdmin: true,
    });
    for (const valeur of ['1', 'TRUE', 'yes', '']) {
      await controller.leave(user, 'p1', valeur);
      expect(parties.leave).toHaveBeenLastCalledWith('p1', 'mj1', {
        type: 'LEFT',
        deleteIfLastAdmin: false,
      });
    }
  });

  it('la route members/me est déclarée avant members/:userId (sinon « me » serait un identifiant)', () => {
    const methods = Object.getOwnPropertyNames(PartiesController.prototype);
    expect(methods.indexOf('leave')).toBeGreaterThanOrEqual(0);
    expect(methods.indexOf('leave')).toBeLessThan(methods.indexOf('removeMember'));
  });

  it('update() route id/user/dto vers PartiesService.update', async () => {
    const dto = { name: 'Nouveau nom' };
    await controller.update(user, 'p1', dto);
    expect(parties.update).toHaveBeenCalledWith('p1', 'mj1', dto);
  });

  it('convertKind() route id/user/dto vers PartiesService.convertKind (Story 29.14)', async () => {
    await controller.convertKind(user, 'p1', { kind: 'ONE_SHOT' });
    expect(parties.convertKind).toHaveBeenCalledWith('p1', 'mj1', {
      kind: 'ONE_SHOT',
    });
  });

  it('convertKind() transmet courantScenarioId quand il est fourni', async () => {
    await controller.convertKind(user, 'p1', {
      kind: 'CAMPAGNE_LINEAIRE',
      courantScenarioId: 'sc-garde',
    });
    expect(parties.convertKind).toHaveBeenCalledWith('p1', 'mj1', {
      kind: 'CAMPAGNE_LINEAIRE',
      courantScenarioId: 'sc-garde',
    });
  });

  it('close() route id/user vers PartiesService.close', async () => {
    await controller.close(user, 'p1');
    expect(parties.close).toHaveBeenCalledWith('p1', 'mj1');
  });

  it('reopen() route id/user vers PartiesService.reopen', async () => {
    await controller.reopen(user, 'p1');
    expect(parties.reopen).toHaveBeenCalledWith('p1', 'mj1');
  });

  it('remove() route id/user vers PartiesService.remove', async () => {
    await controller.remove(user, 'p1');
    expect(parties.remove).toHaveBeenCalledWith('p1', 'mj1');
  });

  it('setVisibilityLocks() route id/user/dto vers PartiesService.setVisibilityLocks (Story 31.6)', async () => {
    const dto = { paths: [{ fieldKey: 'classId' }, { fieldKey: 'attributes', subField: 'AGI' }] };
    await controller.setVisibilityLocks(user, 'p1', dto);
    expect(parties.setVisibilityLocks).toHaveBeenCalledWith('p1', 'mj1', dto);
  });

  it('getVisibilityLocks() route id/user vers PartiesService.getVisibilityLocks (Story 31.7)', async () => {
    await controller.getVisibilityLocks(user, 'p1');
    expect(parties.getVisibilityLocks).toHaveBeenCalledWith('p1', 'mj1');
  });
});
