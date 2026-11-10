import { onSiteNameKeys } from './on-site-name-keys';

describe('onSiteNameKeys (Story 49.5)', () => {
  const hostGames = [
    { id: 'g1', nameKey: 'azul' },
    { id: 'g2', nameKey: 'go' },
  ];

  it('les jeux de l’hôte sont sur place', () => {
    expect([...onSiteNameKeys({ hostGames, excludedIds: [], bringNameKeys: [] })]).toEqual([
      'azul',
      'go',
    ]);
  });

  it('un jeu écarté pour la soirée n’est plus sur place', () => {
    const keys = onSiteNameKeys({ hostGames, excludedIds: ['g2'], bringNameKeys: [] });
    expect([...keys]).toEqual(['azul']);
  });

  it('un jeu apporté est sur place, même sans jeu de l’hôte', () => {
    const keys = onSiteNameKeys({ hostGames: [], excludedIds: [], bringNameKeys: ['catane'] });
    expect([...keys]).toEqual(['catane']);
  });

  it('un nom tenu par une autre source reste sur place quand le jeu de l’hôte est écarté', () => {
    const keys = onSiteNameKeys({ hostGames, excludedIds: ['g1'], bringNameKeys: ['azul'] });
    expect(keys.has('azul')).toBe(true);
    expect(keys.size).toBe(2);
  });

  it('aucune source : ensemble vide', () => {
    expect(onSiteNameKeys({ hostGames: [], excludedIds: [], bringNameKeys: [] }).size).toBe(0);
  });
});
