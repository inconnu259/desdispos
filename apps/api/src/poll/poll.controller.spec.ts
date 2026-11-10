import { Test } from '@nestjs/testing';
import type { AuthUser } from '@master-jdr/shared';

import { PollController } from './poll.controller';
import { PollService } from './poll.service';

function makePollService() {
  return {
    findOpen: jest.fn(),
    castVote: jest.fn(),
    withdrawVote: jest.fn(),
    choose: jest.fn(),
    extend: jest.fn(),
    close: jest.fn(),
    setOptions: jest.fn(),
  };
}

describe('PollController', () => {
  let controller: PollController;
  let poll: ReturnType<typeof makePollService>;
  const user: AuthUser = { id: 'mj1' } as AuthUser;

  beforeEach(async () => {
    poll = makePollService();
    const module = await Test.createTestingModule({
      controllers: [PollController],
      providers: [{ provide: PollService, useValue: poll }],
    }).compile();
    controller = module.get(PollController);
  });

  it('choose() délègue TOUT à PollService.choose() : le contrôleur ne recalcule plus rien (Story 37.8, AD-15)', async () => {
    await controller.choose('p1', 'poll1', user, { optionId: 'opt1' });

    expect(poll.choose).toHaveBeenCalledTimes(1);
    expect(poll.choose).toHaveBeenCalledWith('p1', 'poll1', 'mj1', {
      optionId: 'opt1',
    });
  });

  it('choose() : si PollService.choose() échoue, l’erreur remonte telle quelle', async () => {
    poll.choose.mockRejectedValue(new Error('poll fermé'));

    await expect(controller.choose('p1', 'poll1', user, { optionId: 'opt1' })).rejects.toThrow(
      'poll fermé',
    );
  });

  it('extend() route vers PollService.extend() (Story 40.7)', async () => {
    await controller.extend('p1', 'poll1', user, { expiresAt: '2026-11-20' });
    expect(poll.extend).toHaveBeenCalledWith('p1', 'poll1', 'mj1', { expiresAt: '2026-11-20' });
  });

  it('findOpen() route vers PollService.findOpen()', async () => {
    await controller.findOpen('p1', user);
    expect(poll.findOpen).toHaveBeenCalledWith('p1', 'mj1');
  });

  it('castVote() route vers PollService.castVote()', async () => {
    await controller.castVote('p1', 'poll1', user, {
      optionId: 'opt1',
      answer: 'YES',
    });
    expect(poll.castVote).toHaveBeenCalledWith('p1', 'poll1', 'mj1', {
      optionId: 'opt1',
      answer: 'YES',
    });
  });

  it('withdrawVote() route vers PollService.withdrawVote() (Story 30.1)', async () => {
    await controller.withdrawVote('p1', 'poll1', 'opt1', user);
    expect(poll.withdrawVote).toHaveBeenCalledWith('p1', 'poll1', 'opt1', 'mj1');
  });

  it('close() route vers PollService.close()', async () => {
    await controller.close('p1', 'poll1', user);
    expect(poll.close).toHaveBeenCalledWith('p1', 'poll1', 'mj1');
  });

  it('setOptions() route vers PollService.setOptions() (Story 36.10, D-16)', async () => {
    const dto = {
      options: [
        { date: '2026-08-01', slot: 'MORNING' as const },
        { date: '2026-08-03', slot: 'EVENING' as const },
      ],
    };
    await controller.setOptions('p1', 'poll1', user, dto);
    expect(poll.setOptions).toHaveBeenCalledWith('p1', 'poll1', 'mj1', dto);
  });
});
