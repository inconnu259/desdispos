import type { PermissionService } from '../permissions/permission.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { EventsService } from './events.service';
import { OpenPollContextService } from './open-poll-context.service';

// Story 44.2 — contexte des sondages ouverts lu par le calendrier personnel et la Destinée : les votants
// éligibles d'un événement de ralliement. Régression corrigée : les membres n'étaient lus que pour un GROUPE,
// si bien qu'une soirée isolée n'avait que son hôte pour votant (« 3 sur 1 », invités « non votants »).

const HOST = 'host';
const CAN = { propose: true, edit: true, choose: true, extend: false };

type Partie = { id: string; kind: string; gameSystemId: string; closedAt: null };

function seance(pollId: string, partie: Partie, inscriptionMax: number | null, inscriptions = []) {
  return {
    id: `s-${pollId}`,
    pollId,
    inscriptionMax,
    inscriptions,
    event: { title: `Événement ${pollId}`, ownerId: HOST, partie },
  };
}

function build(seances: unknown[], memberships: { partieId: string; userId: string }[]) {
  const membershipFindMany = jest.fn().mockResolvedValue(memberships);
  const prisma = {
    seance: { findMany: jest.fn().mockResolvedValue(seances) },
    membership: { findMany: membershipFindMany },
  };
  const events = { progressByPartieIds: jest.fn().mockResolvedValue(() => 'none') };
  const permissions = {
    organizerCan: jest.fn((_u: string, targets: unknown[]) =>
      Promise.resolve(targets.map(() => CAN)),
    ),
  };
  const service = new OpenPollContextService(
    prisma as unknown as PrismaService,
    events as unknown as EventsService,
    permissions as unknown as PermissionService,
  );
  return { service, membershipFindMany };
}

const soiree: Partie = { id: 'pS', kind: 'ONE_SHOT', gameSystemId: 'ralliement', closedAt: null };
const groupe: Partie = {
  id: 'pG',
  kind: 'CAMPAGNE_EPISODIQUE',
  gameSystemId: 'ralliement',
  closedAt: null,
};
const jdr: Partie = {
  id: 'pJ',
  kind: 'CAMPAGNE_LINEAIRE',
  gameSystemId: 'ryuutama',
  closedAt: null,
};

describe('OpenPollContextService.contextOf — votants des événements de ralliement', () => {
  it('soirée isolée : tous ses membres votent, hôte compris (pas seulement l’hôte)', async () => {
    const { service, membershipFindMany } = build(
      [seance('a', soiree, null)],
      [
        { partieId: 'pS', userId: HOST },
        { partieId: 'pS', userId: 'bob' },
        { partieId: 'pS', userId: 'gaspard' },
      ],
    );

    const ctx = await service.contextOf('gaspard', ['a']);

    expect(ctx.get('a')?.groupVoterIds).toEqual([HOST, 'bob', 'gaspard']);
    expect(membershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { partieId: { in: ['pS'] } } }),
    );
  });

  it('groupe « tous les membres » : tous les membres votent', async () => {
    const { service } = build(
      [seance('b', groupe, null)],
      [
        { partieId: 'pG', userId: HOST },
        { partieId: 'pG', userId: 'alice' },
      ],
    );

    const ctx = await service.contextOf(HOST, ['b']);

    expect(ctx.get('b')?.groupVoterIds).toEqual([HOST, 'alice']);
  });

  it('groupe à places limitées : l’hôte + les confirmés, sans lire les membres', async () => {
    const { service, membershipFindMany } = build(
      [
        seance('c', groupe, 4, [
          { userId: 'alice', status: 'CONFIRMED' },
          { userId: 'diane', status: 'RESERVED' },
        ] as never),
      ],
      [],
    );

    const ctx = await service.contextOf(HOST, ['c']);

    expect(ctx.get('c')?.groupVoterIds).toEqual([HOST, 'alice']);
    expect(membershipFindMany).not.toHaveBeenCalled();
  });

  it('JDR : pas de votants de ralliement, aucune lecture des membres', async () => {
    const { service, membershipFindMany } = build([seance('d', jdr, null)], []);

    const ctx = await service.contextOf(HOST, ['d']);

    expect(ctx.get('d')?.groupVoterIds).toBeNull();
    expect(membershipFindMany).not.toHaveBeenCalled();
  });
});
