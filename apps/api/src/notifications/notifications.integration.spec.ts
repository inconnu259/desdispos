import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { BoardGamesService } from '../board-games/board-games.service';
import { EventsService } from '../events/events.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { NotificationsService } from './notifications.service';

// Test d'intégration réel contre Postgres : notifications.service.spec.ts mocke entièrement
// `prisma.seance.findMany`, donc la forme réelle du `where` (fenêtre 24h + `reminderSentAt: null`)
// et le snapshot des memberships au moment du job (AC2, AC5) n'étaient vérifiés que par lecture
// du code. Ce test exécute la vraie requête Prisma contre la DB du docker-compose ; seul
// EmailService est remplacé par un espion pour éviter un envoi réseau réel.
class FakeEmailService {
  calls: { template: string; to: string; data: Record<string, unknown> }[] = [];
  sendMail(template: string, to: string, data: Record<string, unknown>): Promise<{ ok: boolean }> {
    this.calls.push({ template, to, data });
    return Promise.resolve({ ok: true });
  }
}

@Module({
  imports: [PrismaModule],
  providers: [
    NotificationsService,
    { provide: EmailService, useClass: FakeEmailService },
    // Story 40.3 : seul décideur des destinataires ; le temps réel n'est jamais atteint par un rappel.
    EventsService,
    // Story 49.5 : `EventsService` en dépend pour les jeux sur place — jamais atteint par un rappel.
    { provide: BoardGamesService, useValue: {} },
    { provide: RealtimeEventsService, useValue: { emit: () => undefined } },
  ],
})
class TestAppModule {}

describe('NotificationsService (intégration réelle via Postgres)', () => {
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;
  let prisma: PrismaService;
  let service: NotificationsService;
  let fakeEmail: FakeEmailService;

  const suffix = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const partieIds: string[] = [];

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(TestAppModule, {
      logger: false,
    });
    prisma = app.get(PrismaService);
    service = app.get(NotificationsService);
    fakeEmail = app.get(EmailService);
  });

  afterAll(async () => {
    await prisma.partie.deleteMany({ where: { id: { in: partieIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    // PrismaService n'implémente pas OnModuleDestroy : app.close() seul ne ferme pas le pool
    // de connexions pg sous-jacent (adapter driver), ce qui laisse un handle actif et empêche
    // Jest de sortir proprement.
    await prisma.$disconnect();
    await app.close();
  });

  it('AC2 + AC5 : ne rappelle que les séances dues, avec les membres réels au moment du job', async () => {
    const mj = await prisma.user.create({
      data: {
        email: `mj-${suffix}@test.local`,
        pseudo: `mj-${suffix}`,
        displayName: `mj-${suffix}`,
        passwordHash: 'x',
      },
    });
    const player = await prisma.user.create({
      data: {
        email: `player-${suffix}@test.local`,
        pseudo: `player-${suffix}`,
        displayName: `player-${suffix}`,
        passwordHash: 'x',
      },
    });
    userIds.push(mj.id, player.id);

    const now = new Date();
    const in12h = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Une partie, un événement et une séance datée (la séance porte la date et le rappel).
    const partieAvecSeance = async (
      name: string,
      startDate: Date | null,
      startSlot?: 'EVENING',
    ) => {
      const partie = await prisma.partie.create({
        data: {
          name,
          kind: 'ONE_SHOT',
          gameSystemId: 'ryuutama',
          ownerId: mj.id,
          nextSessionDate: startDate,
          nextSessionSlot: startSlot ?? null,
        },
      });
      partieIds.push(partie.id);
      const event = await prisma.event.create({
        data: { partieId: partie.id, title: name, ownerId: mj.id },
      });
      const seance = await prisma.seance.create({
        data: {
          eventId: event.id,
          startDate,
          startSlot: startSlot ?? null,
          endDate: startDate,
          endSlot: startSlot ?? null,
        },
      });
      return { partie, seance };
    };

    const due = await partieAvecSeance(`Due-${suffix}`, in12h, 'EVENING');
    const notYetDue = await partieAvecSeance(`NotYet-${suffix}`, in48h);
    const noDate = await partieAvecSeance(`NoDate-${suffix}`, null);

    await prisma.membership.create({
      data: { userId: player.id, partieId: due.partie.id },
    });

    await service.sendDueReminders();

    const recipients = fakeEmail.calls.map((c) => c.to).sort();
    expect(recipients).toEqual([mj.email, player.email].sort());

    const [refreshedDue, refreshedNotYet, refreshedNoDate] = await Promise.all([
      prisma.seance.findUniqueOrThrow({ where: { id: due.seance.id } }),
      prisma.seance.findUniqueOrThrow({ where: { id: notYetDue.seance.id } }),
      prisma.seance.findUniqueOrThrow({ where: { id: noDate.seance.id } }),
    ]);
    expect(refreshedDue.reminderSentAt).not.toBeNull();
    expect(refreshedNotYet.reminderSentAt).toBeNull();
    expect(refreshedNoDate.reminderSentAt).toBeNull();
  });

  it('anti-spoil serveur : brouillon de campagne → propriétaire seul ; brouillon de ONE_SHOT et scénario ouvert → tout le monde', async () => {
    const [mj, player] = await Promise.all(
      ['spoil-mj', 'spoil-player'].map((label) =>
        prisma.user.create({
          data: {
            email: `${label}-${suffix}@test.local`,
            pseudo: `${label}-${suffix}`,
            displayName: `${label}-${suffix}`,
            passwordHash: 'x',
          },
        }),
      ),
    );
    userIds.push(mj.id, player.id);
    const in12h = new Date(Date.now() + 12 * 60 * 60 * 1000);

    // Partie + événement + scénario (statut donné) + séance due dans 12 h + un membre.
    const partieDue = async (
      name: string,
      kind: 'ONE_SHOT' | 'CAMPAGNE_LINEAIRE',
      status: 'BROUILLON' | 'A_VENIR',
    ) => {
      const partie = await prisma.partie.create({
        data: { name, kind, gameSystemId: 'ryuutama', ownerId: mj.id },
      });
      partieIds.push(partie.id);
      const event = await prisma.event.create({
        data: { partieId: partie.id, title: name, ownerId: mj.id },
      });
      await prisma.scenario.create({ data: { id: event.id, status } });
      const seance = await prisma.seance.create({
        data: { eventId: event.id, startDate: in12h, endDate: in12h },
      });
      await prisma.membership.create({ data: { userId: player.id, partieId: partie.id } });
      return seance;
    };

    const brouillon = await partieDue(`SpoilBrouillon-${suffix}`, 'CAMPAGNE_LINEAIRE', 'BROUILLON');
    const oneShot = await partieDue(`SpoilOneShot-${suffix}`, 'ONE_SHOT', 'BROUILLON');
    const ouvert = await partieDue(`SpoilOuvert-${suffix}`, 'CAMPAGNE_LINEAIRE', 'A_VENIR');

    fakeEmail.calls = [];
    await service.sendDueReminders();

    const destinatairesDe = (prefix: string) =>
      fakeEmail.calls
        .filter((c) => String(c.data.partieName).startsWith(`${prefix}-${suffix}`))
        .map((c) => c.to)
        .sort();
    expect(destinatairesDe('SpoilBrouillon')).toEqual([mj.email]);
    expect(destinatairesDe('SpoilOneShot')).toEqual([mj.email, player.email].sort());
    expect(destinatairesDe('SpoilOuvert')).toEqual([mj.email, player.email].sort());

    // La séance du brouillon est marquée envoyée : elle ne sera pas rappelée une seconde fois
    // (le propriétaire seul a été prévenu), les trois le sont.
    for (const s of [brouillon, oneShot, ouvert]) {
      const refreshed = await prisma.seance.findUniqueOrThrow({ where: { id: s.id } });
      expect(refreshed.reminderSentAt).not.toBeNull();
    }
  });

  it('groupe de ralliement (Story 40.3) : seuls l’hôte et les inscrits reçoivent « conjonction-reminder », une fois ; le JDR garde « session-reminder »', async () => {
    const [admin, host, inscrit, absent] = await Promise.all(
      ['grp-admin', 'grp-host', 'grp-inscrit', 'grp-absent'].map((label) =>
        prisma.user.create({
          data: {
            email: `${label}-${suffix}@test.local`,
            pseudo: `${label}-${suffix}`,
            displayName: `${label}-${suffix}`,
            passwordHash: 'x',
          },
        }),
      ),
    );
    userIds.push(admin.id, host.id, inscrit.id, absent.id);
    const in12h = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const groupe = await prisma.partie.create({
      data: {
        name: `Groupe-${suffix}`,
        kind: 'CAMPAGNE_EPISODIQUE',
        gameSystemId: 'ralliement',
        ownerId: admin.id,
      },
    });
    partieIds.push(groupe.id);
    for (const u of [admin, host, inscrit, absent]) {
      await prisma.membership.create({
        data: { userId: u.id, partieId: groupe.id, role: u.id === admin.id ? 'ADMIN' : 'MEMBER' },
      });
    }
    const event = await prisma.event.create({
      data: { partieId: groupe.id, title: `Catane-${suffix}`, ownerId: host.id },
    });
    const seance = await prisma.seance.create({
      data: {
        eventId: event.id,
        startDate: in12h,
        startSlot: 'EVENING',
        endDate: in12h,
        endSlot: 'EVENING',
        lieu: 'Chez Léa',
      },
    });
    await prisma.inscription.create({ data: { seanceId: seance.id, userId: inscrit.id } });

    fakeEmail.calls = [];
    await service.sendDueReminders();
    const sent = fakeEmail.calls.filter((c) => c.data.eventTitle === `Catane-${suffix}`);
    expect(sent.map((c) => c.to).sort()).toEqual([host.email, inscrit.email].sort());
    expect(sent.every((c) => c.template === 'conjonction-reminder')).toBe(true);
    expect(sent[0].data.lieu).toBe('Chez Léa');
    expect(
      (await prisma.seance.findUniqueOrThrow({ where: { id: seance.id } })).reminderSentAt,
    ).not.toBeNull();

    // Une seconde passe ne renvoie rien : le rappel est marqué envoyé.
    fakeEmail.calls = [];
    await service.sendDueReminders();
    expect(fakeEmail.calls.filter((c) => c.data.eventTitle === `Catane-${suffix}`)).toEqual([]);
  });

  it('relance de vote (Story 40.7) : la veille de l’échéance, aux seuls éligibles sans réponse, une fois ; ni hors fenêtre, ni date fixée, ni sondage fermé', async () => {
    const [admin, host, inscrit, absent] = await Promise.all(
      ['rel-admin', 'rel-host', 'rel-inscrit', 'rel-absent'].map((label) =>
        prisma.user.create({
          data: {
            email: `${label}-${suffix}@test.local`,
            pseudo: `${label}-${suffix}`,
            displayName: `${label}-${suffix}`,
            passwordHash: 'x',
          },
        }),
      ),
    );
    userIds.push(admin.id, host.id, inscrit.id, absent.id);
    const groupe = await prisma.partie.create({
      data: {
        name: `Relance-${suffix}`,
        kind: 'CAMPAGNE_EPISODIQUE',
        gameSystemId: 'ralliement',
        ownerId: admin.id,
      },
    });
    partieIds.push(groupe.id);
    for (const u of [admin, host, inscrit, absent]) {
      await prisma.membership.create({
        data: { userId: u.id, partieId: groupe.id, role: u.id === admin.id ? 'ADMIN' : 'MEMBER' },
      });
    }
    const day = new Date(Date.now() + 5 * 86_400_000);
    // Une conjonction à sondage : `expiresAt` en heures à partir de maintenant, séance datée ou non.
    const conjonction = async (
      title: string,
      expiresInHours: number,
      over: { dated?: boolean; status?: 'OPEN' | 'CLOSED' } = {},
    ) => {
      const poll = await prisma.sessionPoll.create({
        data: {
          partieId: groupe.id,
          createdById: host.id,
          status: over.status ?? 'OPEN',
          expiresAt: new Date(Date.now() + expiresInHours * 3_600_000),
          options: { create: [{ date: day, slot: 'EVENING' }] },
        },
        include: { options: true },
      });
      const event = await prisma.event.create({
        data: { partieId: groupe.id, title, ownerId: host.id },
      });
      await prisma.seance.create({
        data: {
          eventId: event.id,
          pollId: poll.id,
          startDate: over.dated ? day : null,
          startSlot: over.dated ? 'EVENING' : null,
        },
      });
      return poll;
    };
    const due = await conjonction(`Veille-${suffix}`, 36);
    const tropTot = await conjonction(`TropTot-${suffix}`, 72);
    const tropTard = await conjonction(`TropTard-${suffix}`, 12);
    const datee = await conjonction(`Datee-${suffix}`, 36, { dated: true });
    const fermee = await conjonction(`Fermee-${suffix}`, 36, { status: 'CLOSED' });
    // L'administrateur et l'hôte ont déjà répondu à la conjonction due.
    for (const voter of [admin, host]) {
      await prisma.pollVote.create({
        data: { pollId: due.id, optionId: due.options[0].id, userId: voter.id, answer: 'YES' },
      });
    }

    fakeEmail.calls = [];
    await service.sendDueReminders();

    const sent = fakeEmail.calls.filter((c) => c.template === 'conjonction-relance');
    const forTitle = (title: string) => sent.filter((c) => c.data.eventTitle === title);
    expect(
      forTitle(`Veille-${suffix}`)
        .map((c) => c.to)
        .sort(),
    ).toEqual([inscrit.email, absent.email].sort());
    expect(String(forTitle(`Veille-${suffix}`)[0].data.link)).toMatch(
      new RegExp(`/parties/${groupe.id}/guild-calendar\\?poll=[^&]+$`),
    );
    for (const title of ['TropTot', 'TropTard', 'Datee', 'Fermee']) {
      expect(forTitle(`${title}-${suffix}`)).toEqual([]);
    }
    const marked = async (id: string) =>
      (await prisma.sessionPoll.findUniqueOrThrow({ where: { id } })).relanceSentAt;
    expect(await marked(due.id)).not.toBeNull();
    for (const p of [tropTot, tropTard, datee, fermee]) expect(await marked(p.id)).toBeNull();

    // Une seconde passe ne renvoie rien : la relance est « une fois ».
    fakeEmail.calls = [];
    await service.sendDueReminders();
    expect(fakeEmail.calls.filter((c) => c.template === 'conjonction-relance')).toEqual([]);

    // Prolonger le vote remet la marque à vide (PollService) : la veille de la nouvelle échéance, on relance.
    await prisma.sessionPoll.update({
      where: { id: due.id },
      data: { expiresAt: new Date(Date.now() + 40 * 3_600_000), relanceSentAt: null },
    });
    await service.sendDueReminders();
    expect(
      fakeEmail.calls
        .filter(
          (c) => c.template === 'conjonction-relance' && c.data.eventTitle === `Veille-${suffix}`,
        )
        .map((c) => c.to)
        .sort(),
    ).toEqual([inscrit.email, absent.email].sort());
  });
});
