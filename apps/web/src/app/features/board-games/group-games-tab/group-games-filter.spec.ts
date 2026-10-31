import type { GroupBoardGameDto } from '@master-jdr/shared';
import { countGroupOwners, filterGroupGames, matchesGroupFit } from './group-games-filter';

function game(
  name: string,
  nameKey: string,
  minPlayers: number | null,
  maxPlayers: number | null,
  owners: string[] = ['u1'],
): GroupBoardGameDto {
  return {
    nameKey,
    name,
    minPlayers,
    maxPlayers,
    durationMin: null,
    owners: owners.map((userId) => ({ userId, pseudo: userId, displayName: userId })),
  };
}

describe('matchesGroupFit (Story 50.1)', () => {
  it('2, 4 et 6 : jouable à ce nombre de joueurs, bornes comprises', () => {
    const azul = game('Azul', 'azul', 2, 4);
    expect(matchesGroupFit(azul, 2)).toBe(true);
    expect(matchesGroupFit(azul, 4)).toBe(true);
    expect(matchesGroupFit(azul, 6)).toBe(false);
  });

  it('8+ : les deux bornes renseignées et un maximum d’au moins 8', () => {
    expect(matchesGroupFit(game('Skull', 'skull', 2, 10), 8)).toBe(true);
    expect(matchesGroupFit(game('Azul', 'azul', 2, 8), 8)).toBe(true);
    expect(matchesGroupFit(game('Azul', 'azul', 2, 7), 8)).toBe(false);
    expect(matchesGroupFit(game('Cartes', 'cartes', 9, 12), 8)).toBe(true);
  });

  it.each([2, 4, 6, 8] as const)(
    'un jeu sans nombre de joueurs, ou avec une seule borne, n’est retenu par aucune puce (essai %s)',
    (choice) => {
      expect(matchesGroupFit(game('X', 'x', null, null), choice)).toBe(false);
      expect(matchesGroupFit(game('X', 'x', 2, null), choice)).toBe(false);
      expect(matchesGroupFit(game('X', 'x', null, 12), choice)).toBe(false);
    },
  );
});

describe('filterGroupGames (Story 50.1)', () => {
  const games = [
    game('Azul', 'azul', 2, 4),
    game('Café Crème', 'cafe creme', 3, 6),
    game('Skull', 'skull', 3, 10),
    game('Sans nombre', 'sans nombre', null, null),
  ];

  it('sans recherche ni puce : la liste telle quelle', () => {
    expect(filterGroupGames(games, '', null)).toBe(games);
    expect(filterGroupGames(games, '   ', null)).toBe(games);
  });

  it('recherche : casse et accents ignorés, sur une partie du nom', () => {
    expect(filterGroupGames(games, 'CAFÉ', null).map((g) => g.nameKey)).toEqual(['cafe creme']);
    expect(filterGroupGames(games, 'ul', null).map((g) => g.nameKey)).toEqual(['azul', 'skull']);
    expect(filterGroupGames(games, 'introuvable', null)).toEqual([]);
  });

  it('puce : ne garde que les jeux jouables à ce nombre', () => {
    expect(filterGroupGames(games, '', 4).map((g) => g.nameKey)).toEqual([
      'azul',
      'cafe creme',
      'skull',
    ]);
    expect(filterGroupGames(games, '', 8).map((g) => g.nameKey)).toEqual(['skull']);
  });

  it('recherche et puce se cumulent', () => {
    expect(filterGroupGames(games, 'sk', 4).map((g) => g.nameKey)).toEqual(['skull']);
    expect(filterGroupGames(games, 'azul', 8)).toEqual([]);
  });
});

describe('countGroupOwners (Story 50.1)', () => {
  it('compte les personnes distinctes qui possèdent au moins un jeu listé', () => {
    const games = [
      game('Azul', 'azul', 2, 4, ['u1', 'u2']),
      game('Skull', 'skull', 3, 6, ['u2', 'u3']),
    ];
    expect(countGroupOwners(games)).toBe(3);
    expect(countGroupOwners([])).toBe(0);
  });
});
