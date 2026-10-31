import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { EventsService } from '../events/events.service';
import type { BoardGamesService } from '../board-games/board-games.service';
import type { RealtimeEventsService } from '../realtime/realtime-events.service';
import { anyOf, objectLike } from '../common/test-utils/jest-typed';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    seance: { findMany: jest.Mock; updateMany: jest.Mock };
    sessionPoll: { findMany: jest.Mock; updateMany: jest.Mock };
  };
  let email: { sendMail: jest.Mock };

  const makeSeance = (
    overrides: Record<string, unknown> = {},
    partie: Record<string, unknown> = {},
  ) => ({
    id: 's1',
    startDate: new Date('2026-07-14T00:00:00.000Z'),
    startSlot: 'MORNING',
    event: {
      partie: {
        id: 'p1',
        name: 'La Nuit',
        owner: { id: 'mj1', email: 'mj@example.com' },
        memberships: [{ user: { id: 'u1', email: 'joueur@example.com' } }],
        ...partie,
      },
    },
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      seance: { findMany: jest.fn(), updateMany: jest.fn() },
      // Story 40.7 : la relance de vote — aucun sondage dû par défaut.
      sessionPoll: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
    };
    email = { sendMail: jest.fn().mockResolvedValue({ ok: true }) };
    // Story 40.3 : l'EventsService réel — `reminderRecipients` est pur (aucune lecture en base).
    service = new NotificationsService(
      prisma as unknown as PrismaService,
      email as unknown as EmailService,
      new EventsService(
        prisma as unknown as PrismaService,
        {} as unknown as RealtimeEventsService,
        {} as unknown as BoardGamesService,
      ),
    );
  });

  it('envoie un rappel à chaque destinataire (MJ + membres) puis marque le reminderSentAt de la séance', async () => {
    prisma.seance.findMany.mockResolvedValue([makeSeance()]);

    await service.sendDueReminders();

    expect(email.sendMail).toHaveBeenCalledTimes(2);
    expect(email.sendMail).toHaveBeenCalledWith(
      'session-reminder',
      'mj@example.com',
      objectLike({ partieName: 'La Nuit' }),
    );
    expect(email.sendMail).toHaveBeenCalledWith(
      'session-reminder',
      'joueur@example.com',
      objectLike({ partieName: 'La Nuit' }),
    );
    expect(prisma.seance.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.seance.updateMany).toHaveBeenCalledWith({
      where: objectLike({ id: 's1' }),
      data: objectLike({ reminderSentAt: anyOf(Date) }),
    });
  });

  describe('anti-spoil serveur — séance d’un brouillon caché', () => {
    const avecScenario = (status: string, kind: string) => {
      const s = makeSeance({}, { kind });
      return { ...s, event: { ...s.event, scenario: { status } } };
    };

    it('brouillon d’une campagne : seul le propriétaire est rappelé, la séance est quand même marquée', async () => {
      prisma.seance.findMany.mockResolvedValue([avecScenario('BROUILLON', 'CAMPAGNE_LINEAIRE')]);

      await service.sendDueReminders();

      expect(email.sendMail).toHaveBeenCalledTimes(1);
      expect(email.sendMail).toHaveBeenCalledWith(
        'session-reminder',
        'mj@example.com',
        objectLike({ partieName: 'La Nuit' }),
      );
      expect(prisma.seance.updateMany).toHaveBeenCalledTimes(1);
    });

    it('brouillon d’un ONE_SHOT (exemption) : tout le monde est rappelé', async () => {
      prisma.seance.findMany.mockResolvedValue([avecScenario('BROUILLON', 'ONE_SHOT')]);

      await service.sendDueReminders();

      expect(email.sendMail).toHaveBeenCalledTimes(2);
    });

    it.each(['A_VENIR', 'COURANT', 'PASSE'])(
      'scénario %s d’une campagne : tout le monde est rappelé',
      async (status) => {
        prisma.seance.findMany.mockResolvedValue([avecScenario(status, 'CAMPAGNE_EPISODIQUE')]);

        await service.sendDueReminders();

        expect(email.sendMail).toHaveBeenCalledTimes(2);
      },
    );

    it('brouillon caché sans propriétaire : aucun e-mail, la séance est marquée', async () => {
      const s = avecScenario('BROUILLON', 'CAMPAGNE_LINEAIRE');
      s.event.partie.owner = null as never;
      prisma.seance.findMany.mockResolvedValue([s]);

      await service.sendDueReminders();

      expect(email.sendMail).not.toHaveBeenCalled();
      expect(prisma.seance.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  it('formate la date depuis le début de la séance et pointe vers la partie', async () => {
    prisma.seance.findMany.mockResolvedValue([makeSeance({ startSlot: 'EVENING' })]);

    await service.sendDueReminders();

    const [, , data] = email.sendMail.mock.calls[0] as [
      string,
      string,
      { partieName: string; sessionDate: string; link: string },
    ];
    expect(data.partieName).toBe('La Nuit');
    expect(data.sessionDate).toBe('mardi 14 juillet (soir)');
    expect(data.link).toMatch(/\/parties\/p1$/);
  });

  it('séance sans créneau → date sans libellé de créneau', async () => {
    prisma.seance.findMany.mockResolvedValue([makeSeance({ startSlot: null })]);

    await service.sendDueReminders();

    const [, , data] = email.sendMail.mock.calls[0] as [string, string, { sessionDate: string }];
    expect(data.sessionDate).toBe('mardi 14 juillet');
  });

  it('Story 47.2 : une plage de plusieurs créneaux est écrite « du … au … » ; un créneau seul garde son texte', async () => {
    prisma.seance.findMany.mockResolvedValue([
      makeSeance({
        startDate: new Date('2026-11-14T00:00:00.000Z'),
        startSlot: 'EVENING',
        endDate: new Date('2026-11-15T00:00:00.000Z'),
        endSlot: 'AFTERNOON',
      }),
    ]);

    await service.sendDueReminders();

    const [, , data] = email.sendMail.mock.calls[0] as [string, string, { sessionDate: string }];
    expect(data.sessionDate).toBe('du samedi 14 novembre (soir) au dimanche 15 novembre (après-midi)');
  });

  it('Story 47.2 : le rappel JDR dit « le … » pour un créneau et « du … au … » pour une plage', async () => {
    prisma.seance.findMany.mockResolvedValue([makeSeance({ startSlot: 'EVENING' })]);
    await service.sendDueReminders();
    let [, , data] = email.sendMail.mock.calls[0] as [string, string, { sessionPhrase: string }];
    expect(data.sessionPhrase).toBe('le mardi 14 juillet (soir)');

    email.sendMail.mockClear();
    prisma.seance.findMany.mockResolvedValue([
      makeSeance({
        startSlot: 'EVENING',
        endDate: new Date('2026-07-15T00:00:00.000Z'),
        endSlot: 'AFTERNOON',
      }),
    ]);
    await service.sendDueReminders();
    [, , data] = email.sendMail.mock.calls[0] as [string, string, { sessionPhrase: string }];
    expect(data.sessionPhrase).toBe('du mardi 14 juillet (soir) au mercredi 15 juillet (après-midi)');
  });

  it('Story 47.2 : fin égale au début → texte d’un créneau', async () => {
    prisma.seance.findMany.mockResolvedValue([
      makeSeance({ startSlot: 'EVENING', endDate: new Date('2026-07-14T00:00:00.000Z'), endSlot: 'EVENING' }),
    ]);

    await service.sendDueReminders();

    const [, , data] = email.sendMail.mock.calls[0] as [string, string, { sessionDate: string }];
    expect(data.sessionDate).toBe('mardi 14 juillet (soir)');
  });

  describe('groupe de ralliement — rappel de la veille d’une conjonction (Story 40.3)', () => {
    const conjonction = (over: Record<string, unknown> = {}, inscrits: string[] = ['b', 'c']) => ({
      ...makeSeance(
        {
          lieu: 'Chez Léa',
          inscriptions: inscrits.map((id) => ({ user: { id, email: `${id}@example.com` } })),
          ...over,
        },
        {
          kind: 'CAMPAGNE_EPISODIQUE',
          gameSystemId: 'ralliement',
          owner: { id: 'admin', email: 'admin@example.com' },
          memberships: [
            { user: { id: 'admin', email: 'admin@example.com' } },
            { user: { id: 'a', email: 'a@example.com' } },
            { user: { id: 'b', email: 'b@example.com' } },
            { user: { id: 'c', email: 'c@example.com' } },
            { user: { id: 'd', email: 'd@example.com' } },
          ],
        },
      ),
    });
    const withHost = (seance: ReturnType<typeof conjonction>, title = 'Catane') => ({
      ...seance,
      event: { ...seance.event, title, owner: { id: 'a', email: 'a@example.com' } },
    });

    it('seuls l’hôte et les inscrits reçoivent l’e-mail neutre « conjonction-reminder », une fois chacun', async () => {
      prisma.seance.findMany.mockResolvedValue([withHost(conjonction({}, ['b', 'c', 'a']))]);

      await service.sendDueReminders();

      const sent = (email.sendMail.mock.calls as [string, string, Record<string, unknown>][]).map(
        ([template, to]) => [template, to],
      );
      expect(sent).toEqual([
        ['conjonction-reminder', 'a@example.com'],
        ['conjonction-reminder', 'b@example.com'],
        ['conjonction-reminder', 'c@example.com'],
      ]);
      expect(prisma.seance.updateMany).toHaveBeenCalledTimes(1);
    });

    it('une place seulement RÉSERVÉE ne reçoit pas le rappel (Story 40.4) — hôte et inscrits confirmés seulement', async () => {
      const u = (id: string) => ({ id, email: `${id}@example.com` });
      prisma.seance.findMany.mockResolvedValue([
        withHost(
          conjonction({
            inscriptions: [
              { status: 'CONFIRMED', user: u('b') },
              { status: 'RESERVED', user: u('c') },
            ],
          }),
        ),
      ]);

      await service.sendDueReminders();

      const recipients = (email.sendMail.mock.calls as [string, string][]).map(([, to]) => to);
      expect(recipients).toEqual(['a@example.com', 'b@example.com']);
    });

    it('le message porte le titre, la date, le lieu et le lien vers la page du groupe', async () => {
      prisma.seance.findMany.mockResolvedValue([withHost(conjonction({ startSlot: 'EVENING' }))]);

      await service.sendDueReminders();

      const [, , data] = email.sendMail.mock.calls[0] as [string, string, Record<string, string>];
      expect(data.eventTitle).toBe('Catane');
      expect(data.sessionDate).toBe('mardi 14 juillet (soir)');
      expect(data.lieu).toBe('Chez Léa');
      expect(data.link).toMatch(/\/parties\/p1$/);
      expect(data).not.toHaveProperty('partieName');
    });

    it('sans lieu : lieu nul ; hôte disparu : seuls les inscrits reçoivent le rappel', async () => {
      const seance = withHost(conjonction({ lieu: null }));
      prisma.seance.findMany.mockResolvedValue([
        { ...seance, event: { ...seance.event, owner: null } },
      ]);

      await service.sendDueReminders();

      expect(email.sendMail).toHaveBeenCalledTimes(2);
      const [, , data] = email.sendMail.mock.calls[0] as [string, string, Record<string, unknown>];
      expect(data.lieu).toBeNull();
    });

    it('un échec d’envoi est loggé, ne lève jamais, et la séance est quand même marquée', async () => {
      prisma.seance.findMany.mockResolvedValue([withHost(conjonction())]);
      email.sendMail.mockResolvedValue({ ok: false });
      const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(service.sendDueReminders()).resolves.toBeUndefined();

      expect(errorLog).toHaveBeenCalledTimes(3);
      expect(prisma.seance.updateMany).toHaveBeenCalledTimes(1);
      errorLog.mockRestore();
    });

    it('rencontre isolée de ralliement (ONE_SHOT, Story 41.2) : e-mail neutre de la conjonction, à tous les membres', async () => {
      const s = conjonction();
      prisma.seance.findMany.mockResolvedValue([
        { ...s, event: { ...s.event, partie: { ...s.event.partie, kind: 'ONE_SHOT' } } },
      ]);

      await service.sendDueReminders();

      expect(email.sendMail).toHaveBeenCalledTimes(5);
      for (const [template] of email.sendMail.mock.calls as [string][]) {
        expect(template).toBe('conjonction-reminder');
      }
    });
  });

  describe('relance de vote de la veille de l’échéance (Story 40.7)', () => {
    const u = (id: string) => ({ id, email: `${id}@example.com` });
    const expiresAt = new Date('2026-11-20T23:59:59.999Z');
    const votePoll = (
      over: Record<string, unknown> = {},
      seanceOver: Record<string, unknown> = {},
    ) => ({
      id: 'poll1',
      expiresAt,
      votes: [{ userId: 'a' }],
      seance: {
        inscriptionMax: null,
        inscriptions: [],
        event: {
          title: 'Catane',
          owner: u('a'),
          partie: {
            id: 'g1',
            kind: 'CAMPAGNE_EPISODIQUE',
            gameSystemId: 'ralliement',
            memberships: ['a', 'b', 'c'].map((id) => ({ user: u(id) })),
          },
        },
        ...seanceOver,
      },
      ...over,
    });
    const recipients = () => (email.sendMail.mock.calls as [string, string][]).map(([, to]) => to);
    beforeEach(() => {
      // Aucune séance due : seule la relance de vote est exercée.
      prisma.seance.findMany.mockResolvedValue([]);
    });

    it('interroge les sondages OUVERTS d’un groupe, sans date, jamais relancés, dont l’échéance tombe entre 24 h et 48 h', async () => {
      const avant = Date.now();
      await service.sendDueReminders();
      const apres = Date.now();

      expect(prisma.sessionPoll.findMany).toHaveBeenCalledTimes(1);
      const [args] = prisma.sessionPoll.findMany.mock.calls[0] as [
        {
          where: {
            status: string;
            relanceSentAt: null;
            expiresAt: { gt: Date; lte: Date };
            seance: {
              is: {
                startDate: null;
                event: { cancelledAt: null; partie: { gameSystemId: { in: string[] } } };
              };
            };
          };
        },
      ];
      expect(args.where.status).toBe('OPEN');
      expect(args.where.relanceSentAt).toBeNull();
      expect(args.where.seance.is.startDate).toBeNull();
      // Story 42.1 : une conjonction annulée n'est jamais relancée.
      expect(args.where.seance.is.event.cancelledAt).toBeNull();
      // Story 41.2 : tout ralliement (groupe ou soirée isolée), jamais le JDR.
      expect(args.where.seance.is.event.partie.gameSystemId.in).toEqual(['ralliement']);
      // expiresAt − 48 h ≤ maintenant < expiresAt − 24 h  ⇔  maintenant + 24 h < expiresAt ≤ maintenant + 48 h.
      const { gt, lte } = args.where.expiresAt;
      expect(gt.getTime()).toBeGreaterThanOrEqual(avant + 24 * 3_600_000);
      expect(gt.getTime()).toBeLessThanOrEqual(apres + 24 * 3_600_000);
      expect(lte.getTime()).toBeGreaterThanOrEqual(avant + 48 * 3_600_000);
      expect(lte.getTime()).toBeLessThanOrEqual(apres + 48 * 3_600_000);
    });

    it('la fenêtre épouse le jour qui précède le jour d’échéance (fin de journée UTC)', () => {
      // Échéance = fin du jour D (D 23:59:59.999). La relance part quand maintenant ∈ [D−2 23:59:59.999, D−1 23:59:59.999[.
      const fin = new Date('2026-11-20T23:59:59.999Z').getTime();
      const dansLaFenetre = (iso: string) => {
        const now = new Date(iso).getTime();
        return fin - 48 * 3_600_000 <= now && now < fin - 24 * 3_600_000;
      };
      expect(dansLaFenetre('2026-11-19T00:00:00.000Z')).toBe(true); // premier passage horaire du jour D−1
      expect(dansLaFenetre('2026-11-19T23:00:00.000Z')).toBe(true); // dernier passage horaire du jour D−1
      expect(dansLaFenetre('2026-11-18T23:00:00.000Z')).toBe(false); // l’avant-veille
      expect(dansLaFenetre('2026-11-20T00:00:00.000Z')).toBe(false); // le jour d’échéance lui-même
    });

    it('Story 47.2 : la relance dit la durée d’un rendez-vous de plusieurs créneaux, et rien pour un créneau', async () => {
      prisma.sessionPoll.findMany.mockResolvedValue([votePoll({}, { durationSlots: 3 })]);
      await service.sendDueReminders();
      let [, , data] = email.sendMail.mock.calls[0] as [string, string, Record<string, unknown>];
      expect(data.durationLabel).toBe('3 créneaux');

      email.sendMail.mockClear();
      prisma.sessionPoll.findMany.mockResolvedValue([votePoll({}, { durationSlots: 1 })]);
      await service.sendDueReminders();
      [, , data] = email.sendMail.mock.calls[0] as [string, string, Record<string, unknown>];
      expect(data.durationLabel).toBeNull();
    });

    it('relance les éligibles qui n’ont pas voté, une fois chacun, par l’e-mail neutre — puis marque le sondage', async () => {
      prisma.sessionPoll.findMany.mockResolvedValue([votePoll()]);

      await service.sendDueReminders();

      expect(recipients()).toEqual(['b@example.com', 'c@example.com']);
      const [template, , data] = email.sendMail.mock.calls[0] as [
        string,
        string,
        Record<string, unknown>,
      ];
      expect(template).toBe('conjonction-relance');
      expect(data.eventTitle).toBe('Catane');
      // Jour d'échéance en toutes lettres (jour UTC de `expiresAt`, sans créneau).
      expect(data.deadline).toBe('vendredi 20 novembre');
      expect(String(data.link)).toMatch(/\/parties\/g1\/guild-calendar\?poll=poll1$/);
      expect(prisma.sessionPoll.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.sessionPoll.updateMany).toHaveBeenCalledWith({
        where: { id: 'poll1', status: 'OPEN', relanceSentAt: null, expiresAt },
        data: { relanceSentAt: anyOf(Date) },
      });
    });

    it('tout le monde a voté : aucun e-mail, mais le sondage est marqué (une seule fois)', async () => {
      prisma.sessionPoll.findMany.mockResolvedValue([
        votePoll({ votes: [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }] }),
      ]);

      await service.sendDueReminders();

      expect(email.sendMail).not.toHaveBeenCalled();
      expect(prisma.sessionPoll.updateMany).toHaveBeenCalledTimes(1);
    });

    it('places limitées : l’hôte et les inscrits confirmés sans réponse ; une place réservée n’est pas relancée', async () => {
      prisma.sessionPoll.findMany.mockResolvedValue([
        votePoll(
          { votes: [] },
          {
            inscriptionMax: 4,
            inscriptions: [
              { status: 'CONFIRMED', user: u('b') },
              { status: 'RESERVED', user: u('c') },
            ],
          },
        ),
      ]);

      await service.sendDueReminders();

      expect(recipients()).toEqual(['a@example.com', 'b@example.com']);
    });

    it('un sondage de JDR trouvé malgré le filtre : rien envoyé, rien marqué', async () => {
      const jdr = votePoll();
      jdr.seance.event.partie.gameSystemId = 'ryuutama';
      prisma.sessionPoll.findMany.mockResolvedValue([jdr]);

      await service.sendDueReminders();

      expect(email.sendMail).not.toHaveBeenCalled();
      expect(prisma.sessionPoll.updateMany).not.toHaveBeenCalled();
    });

    it('soirée isolée (Story 41.2) : la relance part aux membres qui n’ont pas répondu', async () => {
      const isolee = votePoll();
      isolee.seance.event.partie.kind = 'ONE_SHOT';
      prisma.sessionPoll.findMany.mockResolvedValue([isolee]);

      await service.sendDueReminders();

      expect(recipients()).toEqual(['b@example.com', 'c@example.com']);
      expect(prisma.sessionPoll.updateMany).toHaveBeenCalledTimes(1);
    });

    it('un échec d’envoi est loggé, ne lève jamais, et le sondage est quand même marqué', async () => {
      prisma.sessionPoll.findMany.mockResolvedValue([votePoll()]);
      email.sendMail.mockResolvedValue({ ok: false });
      const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(service.sendDueReminders()).resolves.toBeUndefined();

      expect(errorLog).toHaveBeenCalledTimes(2);
      expect(prisma.sessionPoll.updateMany).toHaveBeenCalledTimes(1);
      errorLog.mockRestore();
    });

    it('un sondage en échec n’empêche pas le suivant ; une lecture en échec ne lève jamais', async () => {
      prisma.sessionPoll.findMany.mockResolvedValue([votePoll(), votePoll({ id: 'poll2' })]);
      prisma.sessionPoll.updateMany.mockRejectedValueOnce(new Error('boom'));
      const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(service.sendDueReminders()).resolves.toBeUndefined();
      expect(prisma.sessionPoll.updateMany).toHaveBeenCalledTimes(2);
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('poll1'), anyOf(String));

      prisma.sessionPoll.findMany.mockRejectedValue(new Error('db'));
      await expect(service.sendDueReminders()).resolves.toBeUndefined();
      errorLog.mockRestore();
    });

    it('la lecture des séances en échec n’empêche pas la relance de vote (qui part avant que l’erreur ne remonte)', async () => {
      prisma.seance.findMany.mockRejectedValue(new Error('db'));
      prisma.sessionPoll.findMany.mockResolvedValue([votePoll()]);

      await expect(service.sendDueReminders()).rejects.toThrow('db');

      expect(recipients()).toEqual(['b@example.com', 'c@example.com']);
    });

    it('les rappels de séance et la relance de vote sont indépendants : une séance due n’empêche pas la relance', async () => {
      prisma.seance.findMany.mockResolvedValue([makeSeance()]);
      prisma.sessionPoll.findMany.mockResolvedValue([votePoll()]);

      await service.sendDueReminders();

      const templates = (email.sendMail.mock.calls as [string][]).map(([t]) => t);
      expect(templates.filter((t) => t === 'session-reminder')).toHaveLength(2);
      expect(templates.filter((t) => t === 'conjonction-relance')).toHaveLength(2);
    });
  });

  it('interroge les séances datées dans la fenêtre de 24 h dont le rappel est non envoyé', async () => {
    prisma.seance.findMany.mockResolvedValue([]);

    await service.sendDueReminders();

    const [args] = prisma.seance.findMany.mock.calls[0] as [
      {
        where: {
          startDate: { gte: Date; lte: Date };
          reminderSentAt: null;
          event: { cancelledAt: null };
        };
      },
    ];
    expect(args.where.reminderSentAt).toBeNull();
    // Story 42.1 : une conjonction annulée n'est jamais rappelée.
    expect(args.where.event).toEqual({ cancelledAt: null });
    expect(args.where.startDate.lte.getTime() - args.where.startDate.gte.getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
  });

  it('aucune séance due → aucun e-mail envoyé, aucune erreur', async () => {
    prisma.seance.findMany.mockResolvedValue([]);

    await expect(service.sendDueReminders()).resolves.toBeUndefined();
    expect(email.sendMail).not.toHaveBeenCalled();
    expect(prisma.seance.updateMany).not.toHaveBeenCalled();
  });

  it("un échec d'envoi pour un destinataire n'empêche pas les autres, et la séance est quand même marquée", async () => {
    prisma.seance.findMany.mockResolvedValue([makeSeance()]);
    email.sendMail.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });

    await service.sendDueReminders();

    expect(email.sendMail).toHaveBeenCalledTimes(2);
    expect(prisma.seance.updateMany).toHaveBeenCalledWith({
      where: objectLike({ id: 's1' }),
      data: objectLike({ reminderSentAt: anyOf(Date) }),
    });
  });

  it('deux séances dues de parties différentes dans le même run → chacune traitée indépendamment', async () => {
    const seance1 = makeSeance({ id: 's1' });
    const seance2 = makeSeance({ id: 's2' }, { id: 'p2', name: 'Le Jour' });
    prisma.seance.findMany.mockResolvedValue([seance1, seance2]);
    email.sendMail
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    await service.sendDueReminders();

    expect(email.sendMail).toHaveBeenCalledTimes(4);
    expect(prisma.seance.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.seance.updateMany).toHaveBeenCalledWith({
      where: objectLike({ id: 's1' }),
      data: objectLike({ reminderSentAt: anyOf(Date) }),
    });
    expect(prisma.seance.updateMany).toHaveBeenCalledWith({
      where: objectLike({ id: 's2' }),
      data: objectLike({ reminderSentAt: anyOf(Date) }),
    });
  });

  it('deux séances dues de la même partie → un rappel par séance et par destinataire', async () => {
    prisma.seance.findMany.mockResolvedValue([
      makeSeance({ id: 's1', startSlot: 'MORNING' }),
      makeSeance({ id: 's2', startSlot: 'EVENING' }),
    ]);

    await service.sendDueReminders();

    expect(email.sendMail).toHaveBeenCalledTimes(4);
    const toJoueur = (email.sendMail.mock.calls as [string, string, { sessionDate: string }][])
      .filter(([, to]) => to === 'joueur@example.com')
      .map(([, , data]) => data.sessionDate);
    expect(toJoueur).toEqual(['mardi 14 juillet (matin)', 'mardi 14 juillet (soir)']);
    expect(prisma.seance.updateMany).toHaveBeenCalledTimes(2);
  });

  it('le MJ apparaissant aussi dans memberships ne reçoit le rappel qu’une seule fois', async () => {
    prisma.seance.findMany.mockResolvedValue([
      makeSeance({}, { memberships: [{ user: { id: 'mj1', email: 'mj@example.com' } }] }),
    ]);

    await service.sendDueReminders();

    expect(email.sendMail).toHaveBeenCalledTimes(1);
  });

  it('propriétaire absent (compte supprimé) → seuls les membres reçoivent le rappel', async () => {
    prisma.seance.findMany.mockResolvedValue([makeSeance({}, { owner: null })]);

    await service.sendDueReminders();

    expect(email.sendMail).toHaveBeenCalledTimes(1);
    expect(email.sendMail).toHaveBeenCalledWith(
      'session-reminder',
      'joueur@example.com',
      objectLike({ partieName: 'La Nuit' }),
    );
    expect(prisma.seance.updateMany).toHaveBeenCalledTimes(1);
  });

  it('le marquage est gardé par la date lue (no-op si la date a changé entre-temps)', async () => {
    const startDate = new Date('2026-07-14T00:00:00.000Z');
    prisma.seance.findMany.mockResolvedValue([makeSeance({ startDate, startSlot: 'EVENING' })]);

    await service.sendDueReminders();

    expect(prisma.seance.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', startDate, startSlot: 'EVENING' },
      data: { reminderSentAt: anyOf(Date) },
    });
  });

  it("une séance en échec n'empêche pas le traitement de la suivante", async () => {
    prisma.seance.findMany.mockResolvedValue([
      makeSeance({ id: 's1' }),
      makeSeance({ id: 's2' }, { id: 'p2', name: 'Le Jour' }),
    ]);
    prisma.seance.updateMany.mockRejectedValueOnce(new Error('base indisponible'));
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(service.sendDueReminders()).resolves.toBeUndefined();

    expect(email.sendMail).toHaveBeenCalledTimes(4);
    expect(prisma.seance.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.seance.updateMany).toHaveBeenLastCalledWith(
      objectLike({ where: objectLike({ id: 's2' }) }),
    );
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('séance s1'), anyOf(String));
    errorLog.mockRestore();
  });

  it('une exécution déjà en cours empêche un second run concurrent de démarrer', async () => {
    prisma.seance.findMany.mockResolvedValue([makeSeance()]);

    // isRunning est positionné de façon synchrone avant le premier await : ces deux appels,
    // non attendus individuellement, s'exécutent donc en chevauchement délibéré.
    const firstRun = service.sendDueReminders();
    const secondRun = service.sendDueReminders();
    await Promise.all([firstRun, secondRun]);

    expect(prisma.seance.findMany).toHaveBeenCalledTimes(1);
  });
});
