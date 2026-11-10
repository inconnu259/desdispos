import { Test } from '@nestjs/testing';

// character.service.ts importe @desdispos/game-rules (ESM, non transpilé par ts-jest par défaut) —
// mock requis même si findMine() n'exerce aucune de ces fonctions (patron déjà établi par
// characters.controller.spec.ts/character.service.spec.ts).
jest.mock('@desdispos/game-rules', () => ({
  validate: jest.fn(),
  computeDerived: jest.fn(),
  mapToPdfFields: jest.fn(),
}));

import { MyCharactersController } from './my-characters.controller';
import { CharacterService } from './character.service';

function makeCharacterService() {
  return {
    findMine: jest.fn(),
  };
}

describe('MyCharactersController (Story 29.2)', () => {
  let controller: MyCharactersController;
  let characters: ReturnType<typeof makeCharacterService>;

  beforeEach(async () => {
    characters = makeCharacterService();
    const module = await Test.createTestingModule({
      controllers: [MyCharactersController],
      providers: [{ provide: CharacterService, useValue: characters }],
    }).compile();
    controller = module.get(MyCharactersController);
  });

  it('findMine() délègue à characters.findMine() avec l’id de l’utilisateur courant', async () => {
    const list = [{ id: 'c1', partieName: 'La Forêt Noire' }];
    characters.findMine.mockResolvedValue(list);

    const result = await controller.findMine({ id: 'u1' } as any);

    expect(characters.findMine).toHaveBeenCalledWith('u1');
    expect(result).toBe(list);
  });
});
