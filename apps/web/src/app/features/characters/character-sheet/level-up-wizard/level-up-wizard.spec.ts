import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import type { CharacterDto } from '@desdispos/shared';
import { LevelUpWizard, type LevelUpWizardData } from './level-up-wizard';
import { CharacterService } from '../../../../core/characters/character.service';

function makeCharacter(overrides: Partial<CharacterDto> = {}): CharacterDto {
  return {
    id: 'char1',
    userId: 'u1',
    partieId: 'p1',
    gameSystemId: 'ryuutama',
    sheetData: { attributes: { AGI: 4, ESP: 6, INT: 6, VIG: 8 } },
    derived: { PV: 16, PE: 12, Condition: 14, Initiative: 10, Encombrement: 11 },
    portraitUrl: null,
    portraitCropData: null,
    pdfPortraitCropData: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ownerPseudo: 'alice',
    ownerDisplayName: 'Alice au pays',
    ownerIsMj: false,
    viewerIsMj: false,
    xp: 100,
    level: 2,
    journalAutoAssociate: false,
    ...overrides,
  };
}

async function createComponent(
  character: CharacterDto,
  levelUpImpl: (id: string, dto: unknown) => Promise<CharacterDto>,
) {
  const dialogRef = { close: vi.fn() };
  const characterSvc = { levelUp: vi.fn(levelUpImpl) };
  const data: LevelUpWizardData = { character, content: null };
  await TestBed.configureTestingModule({
    imports: [LevelUpWizard],
    providers: [
      { provide: CharacterService, useValue: characterSvc },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(LevelUpWizard);
  fixture.detectChanges();
  return { fixture, dialogRef, characterSvc };
}

describe('LevelUpWizard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('stepper PV/PE empêche de dépasser 3 au total', async () => {
    const { fixture } = await createComponent(makeCharacter(), () =>
      Promise.resolve(makeCharacter()),
    );
    const comp = fixture.componentInstance as any;

    comp.incrementPv();
    comp.incrementPv();
    comp.incrementPv();
    expect(comp.pvAllocated()).toBe(3);
    comp.incrementPv();
    expect(comp.pvAllocated()).toBe(3);
    comp.incrementPe();
    expect(comp.peAllocated()).toBe(0);
  });

  it('attribute-choice-grid désactive un attribut déjà à 12', async () => {
    const character = makeCharacter({
      sheetData: { attributes: { AGI: 4, ESP: 6, INT: 6, VIG: 12 } },
    });
    const { fixture } = await createComponent(character, () => Promise.resolve(character));
    const comp = fixture.componentInstance as any;

    expect(comp.isAttributeDisabled('VIG')).toBe(true);
    expect(comp.isAttributeDisabled('AGI')).toBe(false);
  });

  it('soumission appelle characterSvc.levelUp avec le payload attendu', async () => {
    const character = makeCharacter();
    const updated = makeCharacter({
      xp: 100,
      sheetData: {
        attributes: { AGI: 4, ESP: 6, INT: 6, VIG: 10 },
        levelUps: [
          {
            level: 2,
            pvAllocated: 2,
            peAllocated: 1,
            capabilities: [{ type: 'attribute', params: {} }],
          },
        ],
      },
    });
    const { fixture, characterSvc, dialogRef } = await createComponent(character, () =>
      Promise.resolve(updated),
    );
    const comp = fixture.componentInstance as any;

    comp.incrementPv();
    comp.incrementPv();
    comp.incrementPe();
    comp.selectAttribute('VIG');
    fixture.detectChanges();
    await comp.confirm();

    expect(characterSvc.levelUp).toHaveBeenCalledWith('char1', {
      pvAllocated: 2,
      peAllocated: 1,
      capabilities: [{ type: 'attribute', params: { attribute: 'VIG' } }],
    });
    expect(dialogRef.close).toHaveBeenCalledWith(updated);
  });

  it('enchaînement automatique si plusieurs niveaux en attente puis fermeture après le dernier', async () => {
    // xp=700 → niveaux 2 et 3 en attente d'un coup (seuils 100 et 600).
    const character = makeCharacter({ xp: 700, level: 1 });
    const afterLevel2 = makeCharacter({
      xp: 700,
      sheetData: {
        attributes: { AGI: 4, ESP: 6, INT: 6, VIG: 10 },
        levelUps: [
          {
            level: 2,
            pvAllocated: 2,
            peAllocated: 1,
            capabilities: [{ type: 'attribute', params: {} }],
          },
        ],
      },
    });
    const afterLevel3 = makeCharacter({
      xp: 700,
      sheetData: {
        attributes: { AGI: 4, ESP: 6, INT: 6, VIG: 10 },
        levelUps: [
          {
            level: 2,
            pvAllocated: 2,
            peAllocated: 1,
            capabilities: [{ type: 'attribute', params: {} }],
          },
          {
            level: 3,
            pvAllocated: 1,
            peAllocated: 2,
            capabilities: [{ type: 'landscape', params: {} }],
          },
        ],
      },
    });
    const levelUpImpl = vi
      .fn()
      .mockResolvedValueOnce(afterLevel2)
      .mockResolvedValueOnce(afterLevel3);
    const { fixture, characterSvc, dialogRef } = await createComponent(character, levelUpImpl);
    const comp = fixture.componentInstance as any;

    expect(comp.totalSteps).toBe(2);

    comp.incrementPv();
    comp.incrementPv();
    comp.incrementPe();
    comp.selectAttribute('VIG');
    await comp.confirm();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(comp.currentLevel()).toBe(3);

    comp.incrementPv();
    comp.incrementPe();
    comp.incrementPe();
    // Niveau 3 = capacité 'landscape' seule → sous-formulaire rendu directement, pas de sélecteur
    // de type de capacité (supprimé : les niveaux à deux capacités affichent les deux sous-formulaires).
    comp.selectContentKey('foret');
    await comp.confirm();

    expect(characterSvc.levelUp).toHaveBeenCalledTimes(2);
    expect(dialogRef.close).toHaveBeenCalledWith(afterLevel3);
  });
});
