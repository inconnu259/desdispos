import type { PartieDto } from '@master-jdr/shared';
import { PartySignalsService } from './party-signals.service';
import { callArg, objectLike } from '../common/test-utils/jest-typed';
import { VISIBLE_POLL_WHERE } from '../permissions/scenario-visibility';

describe('PartySignalsService', () => {
  let service: PartySignalsService;
  let prisma: {
    character: { findMany: jest.Mock };
    partie: { findMany: jest.Mock };
    membership: { groupBy: jest.Mock };
    event: { groupBy: jest.Mock; findMany: jest.Mock };
    seance: { findMany: jest.Mock };
    sessionPoll: { findMany: jest.Mock };
    inscription: { findMany: jest.Mock };
  };
  let parties: { listForUser: jest.Mock };

  function makePartie(overrides: Partial<PartieDto> = {}): PartieDto {
    const base: PartieDto = {
      id: 'p1',
      name: 'La Nuit',
      kind: 'ONE_SHOT',
      gameSystemId: 'draconis',
      description: null,
      ownerId: 'mj1',
      createdAt: '2026-01-01T00:00:00.000Z',
      nextSessionDate: null,
      nextSessionSlot: null,
      role: 'mj',
      status: 'EN_COURS',
      isFavorite: false,
      coverImageVersion: null,
    };
    return Object.assign(base, overrides);
  }

  beforeEach(() => {
    prisma = {
      character: { findMany: jest.fn().mockResolvedValue([]) },
      // HOMME_DRAGON_A_CREER (AD-23) : parties du MJ, Ryuutama, sans Homme Dragon lié — [] par
      // défaut, c'est-à-dire aucune partie à pourvoir.
      partie: { findMany: jest.fn().mockResolvedValue([]) },
      membership: { groupBy: jest.fn().mockResolvedValue([]) },
      event: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      seance: { findMany: jest.fn().mockResolvedValue([]) },
      sessionPoll: { findMany: jest.fn().mockResolvedValue([]) },
      // Story 40.4 : places réservées à l'utilisateur ([] par défaut — aucune réservation).
      inscription: { findMany: jest.fn().mockResolvedValue([]) },
    };
    parties = { listForUser: jest.fn().mockResolvedValue([]) };
    service = new PartySignalsService(prisma as any, parties as any);
  });

  it('deferred-work (2026-08-24) : un utilisateur sans aucune Partie (ni MJ ni joueur) → objet vide, aucune erreur Prisma sur les requêtes groupées avec in: []', async () => {
    // `parties.listForUser` renvoie déjà [] par défaut (beforeEach) — simule directement le cas.
    const result = await service.getSignals('sans-partie');
    expect(result).toEqual({});
  });

  it('une partie sans aucun signal actif porte signals: [] (jamais une entrée absente, AC2)', async () => {
    // nextSessionDate null MAIS un poll OPEN existe déjà : ni PROCHAINE_SEANCE_CONNUE (pas de
    // date) ni AUCUNE_DATE_NI_VOTE (un vote est en cours) ne doivent se déclencher.
    parties.listForUser.mockImplementation((_userId: string, role: string) =>
      Promise.resolve(
        role === 'mj'
          ? [
              makePartie({
                id: 'p1',
                status: 'EN_COURS',
                nextSessionDate: null,
              }),
            ]
          : [],
      ),
    );
    prisma.partie.findMany.mockResolvedValue([]);
    prisma.membership.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.sessionPoll.findMany.mockResolvedValue([{ partieId: 'p1', options: [] }]);

    const map = await service.getSignals('u1');
    expect(map['p1']).toEqual({ role: 'mj', status: 'EN_COURS', signals: [] });
  });

  describe('RESERVATION_A_CONFIRMER (Story 40.4)', () => {
    const groupe = (over: Partial<PartieDto> = {}) =>
      makePartie({
        id: 'g1',
        name: 'Les Fidèles',
        kind: 'CAMPAGNE_EPISODIQUE',
        gameSystemId: 'ralliement',
        role: 'member',
        status: 'EN_COURS',
        ...over,
      });
    const reservedIn = (...partieIds: string[]) =>
      partieIds.map((partieId) => ({ seance: { event: { partieId } } }));

    it('une entrée pour le groupe où une place est réservée, lue en UNE requête groupée sur les inscriptions RESERVED à venir', async () => {
      prisma.inscription.findMany.mockResolvedValue(reservedIn('g1'));
      parties.listForUser.mockImplementation((_u: string, role?: string) =>
        Promise.resolve(role === undefined ? [groupe(), makePartie({ id: 'autre' })] : []),
      );
      // Milieu de journée : « à venir » démarre au DÉBUT du jour UTC courant, pas à l'instant présent.
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-10-17T15:42:09.000Z'));

      let map: Awaited<ReturnType<typeof service.getSignals>>;
      try {
        map = await service.getSignals('u1');
      } finally {
        jest.useRealTimers();
      }

      expect(map['g1']).toEqual({
        role: 'player',
        status: 'EN_COURS',
        signals: ['RESERVATION_A_CONFIRMER'],
      });
      expect(map['autre']).toBeUndefined();
      expect(prisma.inscription.findMany).toHaveBeenCalledTimes(1);
      const where = callArg<{ where: Record<string, unknown> }>(prisma.inscription.findMany).where;
      expect(where).toEqual(
        objectLike({
          userId: 'u1',
          status: 'RESERVED',
          seance: {
            OR: [
              { endDate: { gte: new Date('2026-10-17T00:00:00.000Z') } },
              { endDate: null, startDate: { gte: new Date('2026-10-17T00:00:00.000Z') } },
            ],
            event: { cancelledAt: null },
          },
        }),
      );
    });

    it('deux places réservées dans un même groupe : un seul signal ; sans réservation, ni lecture de la liste complète ni entrée', async () => {
      prisma.inscription.findMany.mockResolvedValue(reservedIn('g1', 'g1'));
      parties.listForUser.mockImplementation((_u: string, role?: string) =>
        Promise.resolve(role === undefined ? [groupe()] : []),
      );
      expect((await service.getSignals('u1'))['g1'].signals).toEqual(['RESERVATION_A_CONFIRMER']);

      prisma.inscription.findMany.mockResolvedValue([]);
      parties.listForUser.mockClear();
      expect(await service.getSignals('u1')).toEqual({});
      expect(parties.listForUser).not.toHaveBeenCalledWith('u1');
    });

    it('un groupe terminé ne porte plus de signal d’action', async () => {
      prisma.inscription.findMany.mockResolvedValue(reservedIn('g1'));
      parties.listForUser.mockImplementation((_u: string, role?: string) =>
        Promise.resolve(role === undefined ? [groupe({ status: 'TERMINEE' })] : []),
      );

      expect((await service.getSignals('u1'))['g1']).toBeUndefined();
    });
  });

  it('PERSONNAGE_A_CREER (joueur) : actif si aucun Character pour cette partie sur un système avec module', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(
        role === 'player'
          ? [makePartie({ id: 'p1', role: 'player', gameSystemId: 'ryuutama' })]
          : [],
      ),
    );
    prisma.character.findMany.mockResolvedValue([]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).toContain('PERSONNAGE_A_CREER');
  });

  it('PERSONNAGE_A_CREER : absent si un Character existe déjà pour cette partie', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(
        role === 'player'
          ? [makePartie({ id: 'p1', role: 'player', gameSystemId: 'ryuutama' })]
          : [],
      ),
    );
    prisma.character.findMany.mockResolvedValue([{ partieId: 'p1' }]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).not.toContain('PERSONNAGE_A_CREER');
  });

  it('PERSONNAGE_A_CREER : jamais émis sur un système sans module, même sans aucun Character (Story 29.15)', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(
        role === 'player'
          ? [makePartie({ id: 'p1', role: 'player', gameSystemId: 'draconis' })]
          : [],
      ),
    );
    prisma.character.findMany.mockResolvedValue([]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).not.toContain('PERSONNAGE_A_CREER');
  });

  it('PERSONNAGE_A_CREER : jamais émis sur ralliement, sans capacité `characters` (Story 37.5)', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(
        role === 'player'
          ? [makePartie({ id: 'p1', role: 'player', gameSystemId: 'ralliement' })]
          : [],
      ),
    );
    prisma.character.findMany.mockResolvedValue([]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).not.toContain('PERSONNAGE_A_CREER');
  });

  it('VOTE_EN_COURS_SANS_REPONSE (joueur) : actif si un poll OPEN a une option sans vote de cet utilisateur', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'player' ? [makePartie({ id: 'p1', role: 'player' })] : []),
    );
    prisma.character.findMany.mockResolvedValue([{ partieId: 'p1' }]);
    prisma.sessionPoll.findMany.mockResolvedValue([{ partieId: 'p1', options: [{ votes: [] }] }]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).toContain('VOTE_EN_COURS_SANS_REPONSE');
  });

  it('VOTE_EN_COURS_SANS_REPONSE : absent si toutes les options ont déjà le vote de cet utilisateur', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'player' ? [makePartie({ id: 'p1', role: 'player' })] : []),
    );
    prisma.character.findMany.mockResolvedValue([{ partieId: 'p1' }]);
    prisma.sessionPoll.findMany.mockResolvedValue([
      { partieId: 'p1', options: [{ votes: [{ userId: 'u1' }] }] },
    ]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).not.toContain('VOTE_EN_COURS_SANS_REPONSE');
  });

  it('HOMME_DRAGON_A_CREER (MJ) : actif pour une partie Ryuutama sans Homme Dragon lié', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'mj' ? [makePartie({ id: 'p1' })] : []),
    );
    prisma.membership.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.partie.findMany.mockResolvedValue([{ id: 'p1' }]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).toContain('HOMME_DRAGON_A_CREER');
  });

  it('HOMME_DRAGON_A_CREER (MJ) : absent quand la requête dédiée ne renvoie pas la partie (déjà liée, ou non Ryuutama)', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'mj' ? [makePartie({ id: 'p1' })] : []),
    );
    prisma.partie.findMany.mockResolvedValue([]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).not.toContain('HOMME_DRAGON_A_CREER');
  });

  it('HOMME_DRAGON_A_CREER : UNE requête dédiée sur Partie — parties MJ dont le système a la capacité hommeDragon, hommeDragonId nul — sans lecture des Hommes Dragons ni requête par partie (AD-23)', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(
        role === 'mj'
          ? [
              makePartie({ id: 'p1', gameSystemId: 'ryuutama' }),
              makePartie({ id: 'p2', gameSystemId: 'ryuutama' }),
              // Système sans la capacité : jamais candidat, même MJ.
              makePartie({ id: 'p3', gameSystemId: 'draconis' }),
            ]
          : [],
      ),
    );
    await service.getSignals('u1');

    expect(prisma.partie.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.partie.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1', 'p2'] }, hommeDragonId: null },
      select: { id: true },
    });
  });

  it('AUCUN_MEMBRE_INVITE (MJ) : actif si groupBy ne renvoie aucune ligne pour cette partie', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'mj' ? [makePartie({ id: 'p1' })] : []),
    );
    prisma.partie.findMany.mockResolvedValue([]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.membership.groupBy.mockResolvedValue([]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).toContain('AUCUN_MEMBRE_INVITE');
  });

  it('AUCUN_SCENARIO_EN_COURS (MJ) : actif si aucun scénario COURANT', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'mj' ? [makePartie({ id: 'p1' })] : []),
    );
    prisma.partie.findMany.mockResolvedValue([]);
    prisma.membership.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.event.groupBy.mockResolvedValue([]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).toContain('AUCUN_SCENARIO_EN_COURS');
  });

  it('AUCUNE_DATE_NI_VOTE (MJ) : actif si nextSessionDate null et aucun poll OPEN', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'mj' ? [makePartie({ id: 'p1', nextSessionDate: null })] : []),
    );
    prisma.partie.findMany.mockResolvedValue([]);
    prisma.membership.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.sessionPoll.findMany.mockResolvedValue([]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).toContain('AUCUNE_DATE_NI_VOTE');
  });

  it('AUCUNE_DATE_NI_VOTE : absent si un poll OPEN existe déjà, même sans nextSessionDate', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'mj' ? [makePartie({ id: 'p1', nextSessionDate: null })] : []),
    );
    prisma.partie.findMany.mockResolvedValue([]);
    prisma.membership.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.sessionPoll.findMany.mockResolvedValue([{ partieId: 'p1', options: [] }]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).not.toContain('AUCUNE_DATE_NI_VOTE');
  });

  it('RAPPORT_FIN_MANQUANT (MJ) : actif si un scénario PASSE a resumeFin null', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'mj' ? [makePartie({ id: 'p1' })] : []),
    );
    prisma.partie.findMany.mockResolvedValue([]);
    prisma.membership.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.event.findMany.mockResolvedValue([{ partieId: 'p1' }]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).toContain('RAPPORT_FIN_MANQUANT');
  });

  it('COMPTE_RENDU_NON_REDIGE (MJ) : actif si une séance validée a compteRendu null', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'mj' ? [makePartie({ id: 'p1' })] : []),
    );
    prisma.partie.findMany.mockResolvedValue([]);
    prisma.membership.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.seance.findMany.mockResolvedValue([{ event: { partieId: 'p1' } }]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).toContain('COMPTE_RENDU_NON_REDIGE');
  });

  it('PROCHAINE_SEANCE_CONNUE (MJ) : actif (informatif) si une séance de la partie est à venir', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'mj' ? [makePartie({ id: 'p1' })] : []),
    );
    prisma.partie.findMany.mockResolvedValue([]);
    prisma.membership.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.seance.findMany.mockResolvedValue([
      {
        compteRendu: 'ok',
        startDate: new Date('2099-01-01T00:00:00.000Z'),
        event: { partieId: 'p1' },
      },
    ]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).toContain('PROCHAINE_SEANCE_CONNUE');
    expect(map['p1'].signals).not.toContain('AUCUNE_DATE_NI_VOTE');
  });

  it('Story 47.2 : pour le MJ, une plage commencée mais pas finie compte comme une séance à venir', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'mj' ? [makePartie({ id: 'p1' })] : []),
    );
    prisma.partie.findMany.mockResolvedValue([]);
    prisma.membership.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.seance.findMany.mockResolvedValue([
      {
        compteRendu: 'ok',
        startDate: new Date('2020-01-01T00:00:00.000Z'),
        endDate: new Date('2099-01-01T00:00:00.000Z'),
        event: { partieId: 'p1' },
      },
    ]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).toContain('PROCHAINE_SEANCE_CONNUE');
    expect(map['p1'].signals).not.toContain('AUCUNE_DATE_NI_VOTE');
  });

  it('anti-spoil serveur — MJ : la date d’un brouillon caché compte (nextSessionDate l’exclut) : pas de faux « aucune date »', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      // nextSessionDate partagé = null : seule la séance d'un brouillon est datée.
      Promise.resolve(role === 'mj' ? [makePartie({ id: 'p1', nextSessionDate: null })] : []),
    );
    prisma.partie.findMany.mockResolvedValue([]);
    prisma.membership.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.seance.findMany.mockResolvedValue([
      {
        compteRendu: null,
        startDate: new Date('2099-01-01T00:00:00.000Z'),
        event: { partieId: 'p1' },
      },
    ]);

    const map = await service.getSignals('u1');

    expect(map['p1'].signals).toContain('PROCHAINE_SEANCE_CONNUE');
    expect(map['p1'].signals).not.toContain('AUCUNE_DATE_NI_VOTE');
    // Une seule requête groupée sur les séances, jamais une par partie.
    expect(prisma.seance.findMany).toHaveBeenCalledTimes(1);
  });

  it('MJ : une séance passée seule (compte rendu rédigé) ne fait pas PROCHAINE_SEANCE_CONNUE', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'mj' ? [makePartie({ id: 'p1' })] : []),
    );
    prisma.partie.findMany.mockResolvedValue([]);
    prisma.membership.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.seance.findMany.mockResolvedValue([
      {
        compteRendu: 'ok',
        startDate: new Date('2020-01-01T00:00:00.000Z'),
        event: { partieId: 'p1' },
      },
    ]);

    const map = await service.getSignals('u1');

    expect(map['p1'].signals).not.toContain('PROCHAINE_SEANCE_CONNUE');
    expect(map['p1'].signals).toContain('AUCUNE_DATE_NI_VOTE');
  });

  it('PROCHAINE_SEANCE_CONNUE (joueur) : dérivé de nextSessionDate, partagé et sans brouillons cachés', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(
        role === 'player'
          ? [
              makePartie({
                id: 'p1',
                role: 'player',
                nextSessionDate: '2099-01-01T00:00:00.000Z',
              }),
            ]
          : [],
      ),
    );
    prisma.character.findMany.mockResolvedValue([{ partieId: 'p1' }]);

    const map = await service.getSignals('u1');

    expect(map['p1'].signals).toContain('PROCHAINE_SEANCE_CONNUE');
  });

  it('deferred-work (2026-08-25) : nextSessionDate PASSÉ (jamais effacé après la date) → PROCHAINE_SEANCE_CONNUE absent, AUCUNE_DATE_NI_VOTE actif sans poll OPEN', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(
        role === 'mj'
          ? [
              makePartie({
                id: 'p1',
                nextSessionDate: '2020-01-01T00:00:00.000Z',
              }),
            ]
          : [],
      ),
    );
    prisma.partie.findMany.mockResolvedValue([]);
    prisma.membership.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 1 } }]);
    const map = await service.getSignals('u1');
    expect(map['p1'].signals).not.toContain('PROCHAINE_SEANCE_CONNUE');
    expect(map['p1'].signals).toContain('AUCUNE_DATE_NI_VOTE');
  });

  it('PARTIE_TERMINEE : seul avec les signaux de fin (AC5) — aucun signal AUCUN_MEMBRE_INVITE/AUCUN_SCENARIO_EN_COURS/etc.', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'mj' ? [makePartie({ id: 'p1', status: 'TERMINEE' })] : []),
    );
    // Conditions qui activeraient normalement HOMME_DRAGON_A_CREER/AUCUN_MEMBRE_INVITE/
    // AUCUN_SCENARIO_EN_COURS/AUCUNE_DATE_NI_VOTE si la partie n'était pas clôturée.
    prisma.partie.findMany.mockResolvedValue([{ id: 'p1' }]);
    prisma.membership.groupBy.mockResolvedValue([]);
    prisma.event.groupBy.mockResolvedValue([]);
    prisma.event.findMany.mockResolvedValue([{ partieId: 'p1' }]);
    prisma.seance.findMany.mockResolvedValue([{ event: { partieId: 'p1' } }]);

    const map = await service.getSignals('u1');
    expect(map['p1'].signals.sort()).toEqual(
      ['COMPTE_RENDU_NON_REDIGE', 'RAPPORT_FIN_MANQUANT', 'PARTIE_TERMINEE'].sort(),
    );
  });

  it('PARTIE_ANNULEE : une rencontre isolée annulée ne porte que ce signal (Story 42.2), pour son hôte comme pour un invité', async () => {
    parties.listForUser.mockImplementation((_u: string, role?: string) =>
      Promise.resolve(
        role === undefined
          ? [makePartie({ id: 'e1', role: 'admin', status: 'ANNULEE', gameSystemId: 'ralliement' })]
          : [],
      ),
    );
    // Son événement unique est annulé ; une place réservée n'y attend plus de réponse.
    prisma.event.findMany.mockResolvedValue([{ partieId: 'e1' }]);
    prisma.inscription.findMany.mockResolvedValue([{ seance: { event: { partieId: 'e1' } } }]);

    const map = await service.getSignals('u1');

    expect(map['e1'].status).toBe('ANNULEE');
    expect(map['e1'].signals).toEqual(['PARTIE_ANNULEE']);
  });

  it('PARTIE_TERMINEE (joueur) : garde explicite MJ-only — même si les requêtes groupées incluaient à tort une partie joueur, aucun signal de fin ne fuite (revue de code)', async () => {
    // Simule le scénario que la garde protège : les requêtes groupées renvoient p1 comme si elle
    // était dans le lot (elles sont normalement filtrées sur mjPartieIds) alors que l'utilisateur
    // n'a que le rôle player sur cette partie.
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(
        role === 'player' ? [makePartie({ id: 'p1', role: 'player', status: 'TERMINEE' })] : [],
      ),
    );
    prisma.event.findMany.mockResolvedValue([{ partieId: 'p1' }]);
    prisma.seance.findMany.mockResolvedValue([{ event: { partieId: 'p1' } }]);

    const map = await service.getSignals('u1');
    expect(map['p1'].signals).toEqual(['PARTIE_TERMINEE']);
  });

  it("scoping par rôle : un signal MJ n'apparaît jamais sur une partie où le rôle est player, et inversement", async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(role === 'player' ? [makePartie({ id: 'p-player', role: 'player' })] : []),
    );
    // Ne devrait jamais être consulté pour une partie player-only, mais on le renseigne quand
    // même pour vérifier qu'aucune fuite ne se produit si jamais il l'était.
    prisma.partie.findMany.mockResolvedValue([{ id: 'p-player' }]);
    prisma.membership.groupBy.mockResolvedValue([]);
    prisma.event.groupBy.mockResolvedValue([]);
    prisma.character.findMany.mockResolvedValue([{ partieId: 'p-player' }]);

    const map = await service.getSignals('u1');
    expect(map['p-player'].signals).not.toContain('HOMME_DRAGON_A_CREER');
    expect(map['p-player'].signals).not.toContain('AUCUN_MEMBRE_INVITE');
    expect(map['p-player'].signals).not.toContain('AUCUN_SCENARIO_EN_COURS');
  });

  it('lecture en lot : chaque requête groupée est appelée une seule fois pour N parties (AD-3, pas de N+1)', async () => {
    parties.listForUser.mockImplementation((_u: string, role: string) =>
      Promise.resolve(
        role === 'mj'
          ? [makePartie({ id: 'p1' }), makePartie({ id: 'p2' })]
          : [makePartie({ id: 'p3', role: 'player' }), makePartie({ id: 'p4', role: 'player' })],
      ),
    );
    await service.getSignals('u1');

    expect(prisma.character.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.partie.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.membership.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.event.groupBy).toHaveBeenCalledTimes(1);
    // Fin de rapport manquant (MJ) + rencontres isolées annulées (Story 42.2) : deux lectures groupées, jamais une par partie.
    expect(prisma.event.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.seance.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.sessionPoll.findMany).toHaveBeenCalledTimes(1);
    // Anti-spoil serveur : MJ → tous les votes ouverts ; joueur → sans le vote d'un brouillon caché
    // (fragment partagé), dans la MÊME requête groupée.
    expect(prisma.sessionPoll.findMany).toHaveBeenCalledWith(
      objectLike({
        where: {
          status: 'OPEN',
          OR: [
            { partieId: { in: ['p1', 'p2'] } },
            { AND: [{ partieId: { in: ['p3', 'p4'] } }, VISIBLE_POLL_WHERE] },
          ],
        },
      }),
    );
  });

  // Story 38.5 : un ralliement n'a aucune capacité de JDR, donc aucun signal (ni code de couche 3).
  // Les signaux sont bâtis sur les seules listes par rôle `mj` et `player`, qui excluent les
  // ralliements (cf. `PartiesService.listForUser`) : lire la liste SANS rôle (qui les inclut)
  // ferait naître des entrées pour eux. Ce test fige le mécanisme ; le e2e `ralliement.e2e-spec.ts`
  // fige le résultat de bout en bout.
  it("n'interroge que les listes par rôle mj et player — jamais la liste sans rôle, qui inclut les ralliements (Story 38.5)", async () => {
    await service.getSignals('u');
    const roles = parties.listForUser.mock.calls.map((call) => call[1] as unknown);
    expect(roles).toHaveLength(2);
    expect(roles).toEqual(expect.arrayContaining(['mj', 'player']));
    expect(roles).not.toContain(undefined);
  });
});
