import type { CharacterDto } from '@desdispos/shared';

/**
 * Factory de fixture partagée pour `CharacterDto` dans les tests — évite que chaque story
 * ajoutant un champ au DTO (`ownerPseudo`/`ownerIsMj`, `pdfPortraitCropData`, etc.) nécessite
 * l'édition manuelle de chaque fichier de spec construisant un `CharacterDto` littéral, sans
 * garde-fou du compilateur pour s'assurer qu'aucun n'a été oublié.
 */
export function makeCharacterDto(overrides: Partial<CharacterDto> = {}): CharacterDto {
  return {
    id: 'char1',
    userId: 'u1',
    partieId: 'p1',
    gameSystemId: 'ryuutama',
    sheetData: {},
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
    xp: 0,
    level: 1,
    journalAutoAssociate: false,
    ...overrides,
  };
}
