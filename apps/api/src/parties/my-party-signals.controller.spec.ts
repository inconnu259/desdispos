import { Test } from '@nestjs/testing';
import type { AuthUser } from '@desdispos/shared';
import { makeAuthUser } from '../common/test-utils/fixtures';
import { MyPartySignalsController } from './my-party-signals.controller';
import { PartySignalsService } from './party-signals.service';

describe('MyPartySignalsController', () => {
  let controller: MyPartySignalsController;
  let signals: { getSignals: jest.Mock };

  const user: AuthUser = makeAuthUser();

  beforeEach(async () => {
    signals = { getSignals: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [MyPartySignalsController],
      providers: [{ provide: PartySignalsService, useValue: signals }],
    }).compile();
    controller = module.get(MyPartySignalsController);
  });

  it('getMine() route user.id vers PartySignalsService.getSignals', async () => {
    await controller.getMine(user);
    expect(signals.getSignals).toHaveBeenCalledWith('u1');
  });
});
