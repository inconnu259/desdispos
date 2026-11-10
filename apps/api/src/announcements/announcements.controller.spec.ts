import { Test } from '@nestjs/testing';

// ScenariosService (import réel pour servir de jeton DI, transitif via AnnouncementsService)
// importe CharacterService -> @desdispos/game-rules (ESM, non transformé par ts-jest) — même
// mock que scenarios.service.spec.ts pour éviter "Unexpected token export" au chargement.
jest.mock('@desdispos/game-rules', () => ({
  validate: jest.fn(),
  computeDerived: jest.fn(),
  pendingLevels: jest.fn(),
  LEVEL_TABLE: [],
}));

import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

function makeAnnouncementsService() {
  return {
    create: jest.fn(),
    findAll: jest.fn(),
  };
}

describe('AnnouncementsController', () => {
  let controller: AnnouncementsController;
  let announcements: ReturnType<typeof makeAnnouncementsService>;

  beforeEach(async () => {
    announcements = makeAnnouncementsService();
    const module = await Test.createTestingModule({
      controllers: [AnnouncementsController],
      providers: [{ provide: AnnouncementsService, useValue: announcements }],
    }).compile();
    controller = module.get(AnnouncementsController);
  });

  it('create() délègue à AnnouncementsService.create() avec partieId/user.id/dto', async () => {
    const dto = { text: 'Une annonce', scenarioId: 's1' };
    announcements.create.mockResolvedValue({
      id: 'ann1',
      partieId: 'p1',
      scenarioId: 's1',
      text: 'Une annonce',
      createdAt: '2026-07-15T00:00:00.000Z',
    });

    const result = await controller.create('p1', { id: 'mj1' } as any, dto);

    expect(announcements.create).toHaveBeenCalledWith('p1', 'mj1', dto);
    expect(result.id).toBe('ann1');
  });

  it('findAll() délègue à AnnouncementsService.findAll() avec partieId/user.id', async () => {
    announcements.findAll.mockResolvedValue([
      {
        id: 'ann1',
        partieId: 'p1',
        scenarioId: null,
        text: 'Une annonce',
        createdAt: '2026-07-15T00:00:00.000Z',
      },
    ]);

    const result = await controller.findAll('p1', { id: 'u1' } as any);

    expect(announcements.findAll).toHaveBeenCalledWith('p1', 'u1');
    expect(result).toHaveLength(1);
  });
});
