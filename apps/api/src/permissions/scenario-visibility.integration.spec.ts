import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { PartieKind, ScenarioStatus } from '@master-jdr/shared';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import {
  HIDDEN_DRAFT_POLL_WHERE,
  HIDDEN_DRAFT_SCENARIO_WHERE,
  HIDDEN_DRAFT_SEANCE_WHERE,
  RELEASED_ANNOUNCEMENT_WHERE,
  VISIBLE_POLL_WHERE,
  VISIBLE_SCENARIO_WHERE,
  VISIBLE_SEANCE_WHERE,
} from './scenario-visibility';

// Test d'intégration réel contre Postgres : les fragments Prisma passent par `NOT` sur des relations
// optionnelles (un vote sans séance, un événement sans scénario) dont la sémantique SQL (`NOT IN`
// et valeurs nulles) ne se voit dans aucun test unitaire à Prisma mocké.
@Module({ imports: [PrismaModule] })
class TestAppModule {}

describe('scenario-visibility — fragments Prisma (intégration réelle via Postgres)', () => {
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;
  let prisma: PrismaService;

  const suffix = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const partieIds: string[] = [];
  let ownerId: string;

  /** Partie → événement → scénario (statut donné, ou aucun) → séance → vote (ou séance sans vote). */
  async function monde(
    label: string,
    kind: PartieKind,
    status: ScenarioStatus | null,
    options: { withPoll?: boolean; withSeance?: boolean } = {},
  ) {
    const partie = await prisma.partie.create({
      data: { name: `${label}-${suffix}`, kind, gameSystemId: 'ryuutama', ownerId },
    });
    partieIds.push(partie.id);
    const event = await prisma.event.create({
      data: { partieId: partie.id, title: `${label}-${suffix}`, ownerId },
    });
    if (status !== null) await prisma.scenario.create({ data: { id: event.id, status } });
    const poll =
      options.withPoll === false
        ? null
        : await prisma.sessionPoll.create({ data: { partieId: partie.id, createdById: ownerId } });
    const seance =
      options.withSeance === false
        ? null
        : await prisma.seance.create({ data: { eventId: event.id, pollId: poll?.id ?? null } });
    return { partie, event, poll, seance };
  }

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(TestAppModule, { logger: false });
    prisma = app.get(PrismaService);
    const owner = await prisma.user.create({
      data: {
        email: `vis-${suffix}@test.local`,
        pseudo: `vis-${suffix}`,
        displayName: `vis-${suffix}`,
        passwordHash: 'x',
      },
    });
    ownerId = owner.id;
    userIds.push(owner.id);
  });

  afterAll(async () => {
    await prisma.partie.deleteMany({ where: { id: { in: partieIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('VISIBLE_POLL_WHERE : vote sans séance conservé, vote d’un brouillon caché écarté, brouillon de ONE_SHOT et scénario ouvert conservés', async () => {
    const sansSeance = await monde('sans-seance', 'CAMPAGNE_LINEAIRE', null, {
      withSeance: false,
    });
    const brouillonCache = await monde('brouillon', 'CAMPAGNE_LINEAIRE', 'BROUILLON');
    const brouillonEpisodique = await monde('brouillon-epi', 'CAMPAGNE_EPISODIQUE', 'BROUILLON');
    const oneShot = await monde('one-shot', 'ONE_SHOT', 'BROUILLON');
    const ouvert = await monde('ouvert', 'CAMPAGNE_LINEAIRE', 'A_VENIR');
    const courant = await monde('courant', 'CAMPAGNE_LINEAIRE', 'COURANT');
    const sansScenario = await monde('sans-scenario', 'CAMPAGNE_LINEAIRE', null);
    const all = [
      sansSeance,
      brouillonCache,
      brouillonEpisodique,
      oneShot,
      ouvert,
      courant,
      sansScenario,
    ];
    const ids = all.map((w) => w.poll!.id);

    const visibles = await prisma.sessionPoll.findMany({
      where: { AND: [{ id: { in: ids } }, VISIBLE_POLL_WHERE] },
      select: { id: true },
    });
    const cachés = await prisma.sessionPoll.findMany({
      where: { AND: [{ id: { in: ids } }, HIDDEN_DRAFT_POLL_WHERE] },
      select: { id: true },
    });

    expect(visibles.map((p) => p.id).sort()).toEqual(
      [sansSeance, oneShot, ouvert, courant, sansScenario].map((w) => w.poll!.id).sort(),
    );
    expect(cachés.map((p) => p.id).sort()).toEqual(
      [brouillonCache, brouillonEpisodique].map((w) => w.poll!.id).sort(),
    );
  });

  it('VISIBLE_SEANCE_WHERE / HIDDEN_DRAFT_SEANCE_WHERE : séances d’un brouillon caché écartées, événement sans scénario conservé', async () => {
    const brouillonCache = await monde('s-brouillon', 'CAMPAGNE_LINEAIRE', 'BROUILLON', {
      withPoll: false,
    });
    const oneShot = await monde('s-one-shot', 'ONE_SHOT', 'BROUILLON', { withPoll: false });
    const ouvert = await monde('s-ouvert', 'CAMPAGNE_LINEAIRE', 'A_VENIR', { withPoll: false });
    const sansScenario = await monde('s-sans-scenario', 'CAMPAGNE_LINEAIRE', null, {
      withPoll: false,
    });
    const ids = [brouillonCache, oneShot, ouvert, sansScenario].map((w) => w.seance!.id);

    const visibles = await prisma.seance.findMany({
      where: { AND: [{ id: { in: ids } }, VISIBLE_SEANCE_WHERE] },
      select: { id: true },
    });
    const cachées = await prisma.seance.findMany({
      where: { AND: [{ id: { in: ids } }, HIDDEN_DRAFT_SEANCE_WHERE] },
      select: { id: true },
    });

    expect(visibles.map((s) => s.id).sort()).toEqual(
      [oneShot, ouvert, sansScenario].map((w) => w.seance!.id).sort(),
    );
    expect(cachées.map((s) => s.id)).toEqual([brouillonCache.seance!.id]);
  });

  it('VISIBLE_SCENARIO_WHERE : seul le brouillon d’une partie non ONE_SHOT est écarté', async () => {
    const brouillonCache = await monde('c-brouillon', 'CAMPAGNE_EPISODIQUE', 'BROUILLON', {
      withPoll: false,
      withSeance: false,
    });
    const oneShot = await monde('c-one-shot', 'ONE_SHOT', 'BROUILLON', {
      withPoll: false,
      withSeance: false,
    });
    const ouvert = await monde('c-ouvert', 'CAMPAGNE_LINEAIRE', 'A_VENIR', {
      withPoll: false,
      withSeance: false,
    });
    const ids = [brouillonCache, oneShot, ouvert].map((w) => w.event.id);

    const visibles = await prisma.scenario.findMany({
      where: { AND: [{ id: { in: ids } }, VISIBLE_SCENARIO_WHERE] },
      select: { id: true },
    });
    const cachés = await prisma.scenario.findMany({
      where: { AND: [{ id: { in: ids } }, HIDDEN_DRAFT_SCENARIO_WHERE] },
      select: { id: true },
    });

    expect(visibles.map((s) => s.id).sort()).toEqual(
      [oneShot, ouvert].map((w) => w.event.id).sort(),
    );
    expect(cachés.map((s) => s.id)).toEqual([brouillonCache.event.id]);
  });

  it('RELEASED_ANNOUNCEMENT_WHERE : annonce de toute la partie ou d’un scénario COURANT/PASSE seulement', async () => {
    const brouillon = await monde('a-brouillon', 'CAMPAGNE_LINEAIRE', 'BROUILLON', {
      withPoll: false,
      withSeance: false,
    });
    const aVenir = await monde('a-avenir', 'CAMPAGNE_LINEAIRE', 'A_VENIR', {
      withPoll: false,
      withSeance: false,
    });
    const courant = await monde('a-courant', 'CAMPAGNE_LINEAIRE', 'COURANT', {
      withPoll: false,
      withSeance: false,
    });
    const passe = await monde('a-passe', 'CAMPAGNE_LINEAIRE', 'PASSE', {
      withPoll: false,
      withSeance: false,
    });
    const annonce = (partieId: string, scenarioId: string | null) =>
      prisma.announcement.create({ data: { partieId, scenarioId, text: `ann-${suffix}` } });
    const generale = await annonce(courant.partie.id, null);
    const rows = {
      brouillon: await annonce(brouillon.partie.id, brouillon.event.id),
      aVenir: await annonce(aVenir.partie.id, aVenir.event.id),
      courant: await annonce(courant.partie.id, courant.event.id),
      passe: await annonce(passe.partie.id, passe.event.id),
    };
    const ids = [generale.id, ...Object.values(rows).map((a) => a.id)];

    const visibles = await prisma.announcement.findMany({
      where: { AND: [{ id: { in: ids } }, RELEASED_ANNOUNCEMENT_WHERE] },
      select: { id: true },
    });

    expect(visibles.map((a) => a.id).sort()).toEqual(
      [generale.id, rows.courant.id, rows.passe.id].sort(),
    );
  });
});
