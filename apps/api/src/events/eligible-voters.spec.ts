import { eligibleVoters } from './eligible-voters';

describe('eligibleVoters (Story 40.5)', () => {
  const inscriptions = [
    { userId: 'a', status: 'CONFIRMED' as const },
    { userId: 'b', status: 'RESERVED' as const },
    { userId: 'c', status: 'CONFIRMED' as const },
  ];

  it('« Tous les membres » : les membres du groupe, hôte compris et en premier, sans doublon', () => {
    expect(
      eligibleVoters({
        hostId: 'host',
        inscriptionMax: null,
        inscriptions,
        memberIds: ['a', 'host', 'z'],
      }),
    ).toEqual(['host', 'a', 'z']);
  });

  it('places limitées : l’hôte + les inscrits confirmés, jamais une place seulement réservée', () => {
    expect(
      eligibleVoters({ hostId: 'host', inscriptionMax: 4, inscriptions, memberIds: ['a', 'z'] }),
    ).toEqual(['host', 'a', 'c']);
  });

  it('places limitées : un membre non inscrit n’est pas éligible', () => {
    expect(
      eligibleVoters({ hostId: 'host', inscriptionMax: 4, inscriptions: [], memberIds: ['z'] }),
    ).toEqual(['host']);
  });

  it('hôte absent (compte supprimé) : les seuls autres votants', () => {
    expect(
      eligibleVoters({ hostId: null, inscriptionMax: 4, inscriptions, memberIds: [] }),
    ).toEqual(['a', 'c']);
  });
});
