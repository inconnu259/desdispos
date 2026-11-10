import request from 'supertest';
import { AccountDeletionImpactDto } from '@master-jdr/shared';
import { Harness, TestUser, body } from './harness';

/**
 * Story 43.1 (AD-11) — GET /me/deletion-impact : ce que l'effacement du compte emporterait.
 * Lecture seule, et pour l'utilisateur connecté seul.
 */
describe('Compte — aperçu de l’effacement (Story 43.1)', () => {
  let h: Harness;
  let soleAdmin: TestUser;
  let sharedAdmin: TestUser;
  let otherAdmin: TestUser;
  let member: TestUser;
  let gm: TestUser;
  let player: TestUser;
  let bystander: TestUser;
  let soleGroupId: string;
  let soleGroupName: string;
  let sharedGroupId: string;
  let eveningId: string;
  let questId: string;
  let questName: string;

  beforeAll(async () => {
    h = await Harness.start();
    [soleAdmin, sharedAdmin, otherAdmin, member, gm, player, bystander] = await Promise.all([
      h.createUser('imp-seul'),
      h.createUser('imp-partage'),
      h.createUser('imp-autre'),
      h.createUser('imp-membre'),
      h.createUser('imp-mj'),
      h.createUser('imp-joueur'),
      h.createUser('imp-passant'),
    ]);

    // Groupe dont soleAdmin est le seul administrateur : 2 membres au total, 2 conjonctions.
    const group = await h.createPartie(soleAdmin, 'CAMPAGNE_EPISODIQUE', 'seul', 'ralliement');
    soleGroupId = group.id;
    soleGroupName = group.name;
    await h.addMember(soleGroupId, member);
    await h.prisma.event.createMany({
      data: [
        { partieId: soleGroupId, title: 'Soirée A', ownerId: soleAdmin.id },
        { partieId: soleGroupId, title: 'Soirée B', ownerId: soleAdmin.id },
      ],
    });

    // Groupe où sharedAdmin n'est qu'un administrateur parmi d'autres : il survivrait.
    ({ id: sharedGroupId } = await h.createPartie(
      sharedAdmin,
      'CAMPAGNE_EPISODIQUE',
      'partage',
      'ralliement',
    ));
    await h.addMember(sharedGroupId, otherAdmin, 'ADMIN');

    // Rencontre isolée : son créateur en est l'unique administrateur.
    ({ id: eveningId } = await h.createPartie(bystander, 'ONE_SHOT', 'soiree', 'ralliement'));

    // Quête de JDR : le MJ la possède, un joueur y a un personnage, un autre membre n'en a pas.
    const quest = await h.createPartie(gm, 'ONE_SHOT', 'quete', 'ryuutama');
    questId = quest.id;
    questName = quest.name;
    await h.addMember(questId, player);
    await h.addMember(questId, member);
    await h.prisma.character.create({
      data: {
        userId: player.id,
        partieId: questId,
        gameSystemId: 'ryuutama',
        sheetData: {},
        derived: {},
      },
    });
  });

  afterAll(async () => {
    await h?.close();
  });

  const impactOf = async (user: TestUser) =>
    body<AccountDeletionImpactDto>(await user.agent.get('/me/deletion-impact').expect(200));

  it('seul administrateur : le groupe est listé avec ses adhésions et ses conjonctions', async () => {
    const impact = await impactOf(soleAdmin);

    expect(impact.groups).toEqual([
      { id: soleGroupId, name: soleGroupName, memberCount: 2, eventCount: 2 },
    ]);
    expect(impact.jdrParties).toEqual([]);
  });

  it('administrateur parmi d’autres : le groupe survit, il n’est pas listé', async () => {
    expect(await impactOf(sharedAdmin)).toEqual({ groups: [], jdrParties: [] });
    expect(await impactOf(otherAdmin)).toEqual({ groups: [], jdrParties: [] });
  });

  it('rencontre isolée : son créateur la voit listée', async () => {
    const impact = await impactOf(bystander);

    expect(impact.groups.map((g) => g.id)).toEqual([eveningId]);
    expect(impact.groups[0]).toMatchObject({ eventCount: 1 });
  });

  it('MJ : sa partie de JDR est listée, seuls les joueurs avec personnage sont comptés', async () => {
    const impact = await impactOf(gm);

    expect(impact).toEqual({
      groups: [],
      jdrParties: [{ id: questId, name: questName, playerCount: 1 }],
    });
  });

  it('simple membre ou joueur : rien à perdre', async () => {
    expect(await impactOf(member)).toEqual({ groups: [], jdrParties: [] });
    expect(await impactOf(player)).toEqual({ groups: [], jdrParties: [] });
  });

  it('lecture seule : rien n’est écrit', async () => {
    const count = () =>
      Promise.all([
        h.prisma.partie.count({ where: { id: { in: [soleGroupId, sharedGroupId, questId] } } }),
        h.prisma.membership.count({ where: { partieId: { in: [soleGroupId, sharedGroupId] } } }),
      ]);
    const before = await count();

    await impactOf(soleAdmin);
    await impactOf(gm);

    expect(await count()).toEqual(before);
  });

  // Le garde `AuthenticatedGuard` de tout le dépôt répond 403 (et non 401) sans session.
  it('sans session : refusé (403)', async () => {
    await request(h.app.getHttpServer()).get('/me/deletion-impact').expect(403);
  });
});
