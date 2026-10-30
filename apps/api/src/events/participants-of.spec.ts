import { participantsOf } from './participants-of';

describe('participantsOf (Story 49.1)', () => {
  const inscriptions = [
    { userId: 'a', status: 'CONFIRMED' as const },
    { userId: 'b', status: 'RESERVED' as const },
    { userId: 'c', status: 'CONFIRMED' as const },
  ];

  it('conjonction de groupe : l’hôte d’abord, puis les inscrits confirmés ; une place réservée ne compte jamais', () => {
    expect(
      participantsOf({ isolated: false, hostId: 'host', inscriptions, memberIds: ['x', 'y'] }),
    ).toEqual(['host', 'a', 'c']);
  });

  it('conjonction de groupe : les membres du groupe ne comptent pas, même sans limite de places', () => {
    expect(
      participantsOf({ isolated: false, hostId: 'host', inscriptions: [], memberIds: ['x', 'y'] }),
    ).toEqual(['host']);
  });

  it('conjonction de groupe : sans hôte (compte supprimé), les seuls inscrits confirmés', () => {
    expect(participantsOf({ isolated: false, hostId: null, inscriptions, memberIds: [] })).toEqual([
      'a',
      'c',
    ]);
  });

  it('conjonction de groupe : un hôte aussi inscrit n’est compté qu’une fois', () => {
    expect(
      participantsOf({
        isolated: false,
        hostId: 'a',
        inscriptions,
        memberIds: [],
      }),
    ).toEqual(['a', 'c']);
  });

  it('rencontre isolée : les membres de la partie, dédoublonnés, sans lire les inscriptions', () => {
    expect(
      participantsOf({
        isolated: true,
        hostId: 'host',
        inscriptions,
        memberIds: ['host', 'm1', 'm2', 'm1'],
      }),
    ).toEqual(['host', 'm1', 'm2']);
  });
});
