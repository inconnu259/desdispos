import type { OrganizerCan } from '@master-jdr/shared';
import type { PartieRole } from '@master-jdr/shared';
import { PermissionService } from '../permissions/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { MyOpenPollsService } from './my-open-polls.service';
import type { OpenPollContext, OpenPollContextPort } from './ports/open-poll-context.port';
import type { RendezVousDurationPort } from './ports/rendez-vous-duration.port';

// Story 44.2 — `GET /me/open-polls` : la forme servie, les ayants droit de chaque famille, l'anonymat
// et le nombre FIXE de lectures. Les refus contre la vraie base sont dans les tests e2e.

const ME = 'moi';
const CAN: OrganizerCan = { propose: true, edit: true, choose: true, extend: false };

const jdr = {
  id: 'pJ',
  name: 'La Tour',
  kind: 'CAMPAGNE_LINEAIRE',
  gameSystemId: 'ryuutama',
  ownerId: 'mj',
};
const groupe = {
  id: 'pG',
  name: 'Les amis',
  kind: 'CAMPAGNE_EPISODIQUE',
  gameSystemId: 'ralliement',
  ownerId: 'admin',
};

function option(id: string, date: string, votes: { userId: string; answer: string }[] = []) {
  return { id, date: new Date(`${date}T00:00:00Z`), slot: 'EVENING', votes };
}

function pollRow(
  id: string,
  partie: typeof jdr,
  options: ReturnType<typeof option>[],
  scenarioStatus: string | null = 'COURANT',
) {
  return {
    id,
    expiresAt: new Date('2026-12-01T23:59:59.999Z'),
    partie,
    options,
    seance: { event: { scenario: scenarioStatus ? { status: scenarioStatus } : null } },
  };
}

function context(over: Partial<OpenPollContext> = {}): OpenPollContext {
  return {
    seanceId: 's1',
    title: 'Séance 1',
    status: 'EN_COURS',
    can: CAN,
    groupVoterIds: null,
    ...over,
  };
}

function build(
  polls: unknown[],
  contexts: Record<string, OpenPollContext>,
  memberships: { partieId: string; userId: string }[] = [],
  roles: Record<string, PartieRole> = {},
  durations: Record<string, number> = {},
) {
  const prisma = {
    sessionPoll: { findMany: jest.fn().mockResolvedValue(polls) },
    membership: { findMany: jest.fn().mockResolvedValue(memberships) },
  };
  const port = {
    contextOf: jest.fn().mockResolvedValue(new Map(Object.entries(contexts))),
  } satisfies OpenPollContextPort;
  // Le rôle sur chaque partie vient du service de permission, en lot (par défaut : joueur partout).
  const permissions = {
    rolesOf: jest.fn((_userId: string, ids: string[]) =>
      Promise.resolve(new Map(ids.map((id) => [id, roles[id] ?? 'player']))),
    ),
  };
  // Story 47.4 : la durée de chaque rendez-vous vient du port de `events/` (1 sans séance).
  const duration = {
    setDurationInTx: jest.fn(),
    durationsOf: jest.fn((ids: readonly string[]) =>
      Promise.resolve(new Map(ids.map((id) => [id, durations[id] ?? 1]))),
    ),
  } satisfies RendezVousDurationPort;
  const service = new MyOpenPollsService(
    prisma as unknown as PrismaService,
    permissions as unknown as PermissionService,
    port,
    duration,
  );
  return { service, prisma, port, permissions, duration };
}

describe('MyOpenPollsService (Story 44.2)', () => {
  it('Story 47.4 : la durée du rendez-vous vient du port, en une lecture pour tous les sondages', async () => {
    const { service, duration } = build(
      [pollRow('p1', jdr, [option('o1', '2026-11-20', [])])],
      { p1: context() },
      [],
      {},
      { p1: 6 },
    );

    const [entry] = await service.list(ME);

    expect(entry.durationSlots).toBe(6);
    expect(duration.durationsOf).toHaveBeenCalledTimes(1);
    expect(duration.durationsOf).toHaveBeenCalledWith(['p1']);
  });

  it('JDR : forme servie, effectif = MJ + membres, ma réponse et les compteurs par option', async () => {
    const { service } = build(
      [
        pollRow('p1', jdr, [
          option('o1', '2026-11-20', [
            { userId: ME, answer: 'YES' },
            { userId: 'mj', answer: 'NO' },
            { userId: 'autre', answer: 'MAYBE' },
          ]),
          option('o2', '2026-11-21', [{ userId: 'mj', answer: 'YES' }]),
        ]),
      ],
      { p1: context() },
      [
        { partieId: 'pJ', userId: ME },
        { partieId: 'pJ', userId: 'autre' },
      ],
    );

    const [entry] = await service.list(ME);

    expect(entry).toEqual({
      pollId: 'p1',
      partieId: 'pJ',
      partieName: 'La Tour',
      family: 'jdr',
      kind: 'CAMPAGNE_LINEAIRE',
      seanceId: 's1',
      title: 'Séance 1',
      expiresAt: '2026-12-01T23:59:59.999Z',
      durationSlots: 1,
      options: [
        {
          optionId: 'o1',
          date: '2026-11-20',
          slot: 'EVENING',
          yes: 1,
          maybe: 1,
          no: 1,
          myAnswer: 'YES',
        },
        {
          optionId: 'o2',
          date: '2026-11-21',
          slot: 'EVENING',
          yes: 1,
          maybe: 0,
          no: 0,
          myAnswer: null,
        },
      ],
      // Le MJ + deux membres. Seul le MJ a répondu à TOUTES les options ; moi, pas à o2.
      eligibleCount: 3,
      answeredCount: 1,
      me: { eligible: true, answered: false },
      can: CAN,
    });
  });

  it('groupe : les ayants droit sont ceux de la conjonction ; une réponse suffit', async () => {
    const { service } = build(
      [
        pollRow('p2', groupe, [
          option('o1', '2026-11-20', [{ userId: ME, answer: 'YES' }]),
          option('o2', '2026-11-21'),
        ]),
      ],
      { p2: context({ groupVoterIds: ['hote', ME, 'x'] }) },
      [{ partieId: 'pG', userId: 'quelquun-dautre' }],
    );

    const [entry] = await service.list(ME);

    expect(entry.family).toBe('ralliement');
    expect(entry.eligibleCount).toBe(3);
    expect(entry.answeredCount).toBe(1);
    expect(entry.me).toEqual({ eligible: true, answered: true });
  });

  it('groupe : non votant (places limitées) → listé mais me.eligible = false', async () => {
    const { service } = build([pollRow('p2', groupe, [option('o1', '2026-11-20')])], {
      p2: context({ groupVoterIds: ['hote'] }),
    });

    const [entry] = await service.list(ME);

    expect(entry.me).toEqual({ eligible: false, answered: false });
    expect(entry.eligibleCount).toBe(1);
  });

  it('une partie terminée ou annulée, ou un sondage sans séance, n’est pas servi', async () => {
    const { service } = build(
      [
        pollRow('fini', jdr, [option('o1', '2026-11-20')]),
        pollRow('annule', groupe, [option('o2', '2026-11-20')]),
        pollRow('orphelin', jdr, [option('o3', '2026-11-20')]),
        pollRow('ok', jdr, [option('o4', '2026-11-20')]),
      ],
      {
        fini: context({ status: 'TERMINEE' }),
        annule: context({ status: 'ANNULEE' }),
        ok: context({ status: 'A_VENIR' }),
      },
    );

    expect((await service.list(ME)).map((e) => e.pollId)).toEqual(['ok']);
  });

  it('aucun identifiant de votant ne figure dans la réponse', async () => {
    const { service } = build(
      [
        pollRow('p1', jdr, [
          option('o1', '2026-11-20', [{ userId: 'secret-user', answer: 'YES' }]),
        ]),
      ],
      { p1: context() },
      [{ partieId: 'pJ', userId: 'secret-membre' }],
    );

    const json = JSON.stringify(await service.list(ME));

    expect(json).not.toContain('secret-user');
    expect(json).not.toContain('secret-membre');
  });

  it('la requête ne lit que MES parties actives non masquées', async () => {
    const { service, prisma } = build([], {});

    await service.list(ME);

    expect(prisma.sessionPoll.findMany).toHaveBeenCalledTimes(1);
    const where = (prisma.sessionPoll.findMany.mock.calls[0] as [{ where: object }])[0].where;
    expect(where).toEqual({
      status: 'OPEN',
      partie: {
        closedAt: null,
        hiddenBy: { none: { userId: ME } },
        OR: [{ ownerId: ME }, { memberships: { some: { userId: ME } } }],
      },
    });
  });

  it('anti-spoil : le vote d’un brouillon caché n’existe pas pour un joueur, il existe pour le MJ (rôle décidé par PermissionService)', async () => {
    const polls = [
      pollRow('brouillon', jdr, [option('o1', '2026-11-20')], 'BROUILLON'),
      pollRow('courant', jdr, [option('o2', '2026-11-20')], 'COURANT'),
      pollRow(
        'isole',
        { ...jdr, id: 'pI', kind: 'ONE_SHOT' },
        [option('o3', '2026-11-20')],
        'BROUILLON',
      ),
    ];
    const contexts = { brouillon: context(), courant: context(), isole: context() };

    const player = build(polls, contexts, [], {});
    expect((await player.service.list(ME)).map((e) => e.pollId)).toEqual(['courant', 'isole']);
    expect(player.permissions.rolesOf).toHaveBeenCalledTimes(1);

    const gm = build(polls, contexts, [], { pJ: 'mj', pI: 'mj' });
    expect((await gm.service.list(ME)).map((e) => e.pollId)).toEqual([
      'brouillon',
      'courant',
      'isole',
    ]);
  });

  it('aucune lecture de plus quand il n’y a aucun sondage (ni contexte, ni membres)', async () => {
    const { service, prisma, port } = build([], {});
    expect(await service.list(ME)).toEqual([]);
    expect(port.contextOf).not.toHaveBeenCalled();
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
  });

  it('nombre de lectures FIXE : trois sondages sur trois parties, une lecture de sondages, une de membres, un contexte', async () => {
    const autre = { ...jdr, id: 'pK', ownerId: 'mj2' };
    const encore = { ...jdr, id: 'pL', ownerId: 'mj3' };
    const { service, prisma, port } = build(
      [
        pollRow('a', jdr, [option('o1', '2026-11-20')]),
        pollRow('b', autre, [option('o2', '2026-11-20')]),
        pollRow('c', encore, [option('o3', '2026-11-20')]),
      ],
      { a: context(), b: context(), c: context() },
    );

    expect(await service.list(ME)).toHaveLength(3);

    expect(prisma.sessionPoll.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.membership.findMany).toHaveBeenCalledTimes(1);
    expect(port.contextOf).toHaveBeenCalledTimes(1);
    expect(port.contextOf).toHaveBeenCalledWith(ME, ['a', 'b', 'c']);
  });
});
