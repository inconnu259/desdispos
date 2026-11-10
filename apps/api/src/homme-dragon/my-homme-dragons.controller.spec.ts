// L'import de HommeDragonModule charge game-rules (ESM, non transformé par ts-jest) — même
// neutralisation que homme-dragon.controller.spec.ts.
jest.mock('@master-jdr/game-rules', () => ({
  validateHommeDragon: jest.fn(),
}));

import { Test } from '@nestjs/testing';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { MyHommeDragonsController } from './my-homme-dragons.controller';
import { HommeDragonService } from './homme-dragon.service';
import { HommeDragonModule } from './homme-dragon.module';

describe('MyHommeDragonsController', () => {
  let controller: MyHommeDragonsController;
  const service = { findMine: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [MyHommeDragonsController],
      providers: [{ provide: HommeDragonService, useValue: service }],
    })
      .overrideGuard(AuthenticatedGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(MyHommeDragonsController);
  });

  it('câblage : chemin me/homme-dragons, AuthenticatedGuard, contrôleur déclaré dans HommeDragonModule', () => {
    expect(Reflect.getMetadata('path', MyHommeDragonsController)).toBe('me/homme-dragons');
    expect(Reflect.getMetadata('__guards__', MyHommeDragonsController)).toContain(
      AuthenticatedGuard,
    );
    expect(Reflect.getMetadata('controllers', HommeDragonModule)).toContain(
      MyHommeDragonsController,
    );
  });

  it("GET délègue à findMine() avec l'identifiant de l'appelant uniquement", async () => {
    service.findMine.mockResolvedValue([{ id: 'hd1' }]);

    const result = await controller.findMine({ id: 'u1' } as never);

    expect(service.findMine).toHaveBeenCalledWith('u1');
    expect(result).toEqual([{ id: 'hd1' }]);
  });
});
