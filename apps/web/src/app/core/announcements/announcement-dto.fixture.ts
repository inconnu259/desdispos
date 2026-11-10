import type { AnnouncementDto } from '@desdispos/shared';

/**
 * Factory de fixture partagée pour `AnnouncementDto` dans les tests — évite la duplication de
 * l'objet littéral (et la dérive des valeurs par défaut) dans chaque fichier de spec consommateur.
 */
export function makeAnnouncementDto(overrides: Partial<AnnouncementDto> = {}): AnnouncementDto {
  return {
    id: 'ann1',
    partieId: 'p1',
    scenarioId: null,
    text: 'Une annonce',
    createdAt: '2026-07-15T00:00:00.000Z',
    authorPseudo: 'le-mj',
    authorDisplayName: 'Le Grand MJ',
    ...overrides,
  };
}
