import request from 'supertest';
import { Harness, body, isoDay, type TestUser } from './harness';

// Story 52.4 (AD-5) — `GET /me/availability-reminder` contre la vraie base : une seule règle serveur, la même sur
// tous les appareils. Vrai pour un membre d'une partie active qui n'a rien déclaré pour les 28 jours à venir ; faux
// dès qu'une de SES déclarations recouvre la fenêtre, une fois la préférence décochée, ou sans partie active.

type ReminderLike = { show: boolean };
type AuthLike = { availabilityReminder: boolean };
type CreatedLike = { created: { id: string }[] };

describe('Rappel des dispos — GET /me/availability-reminder (Story 52.4)', () => {
  let h: Harness;
  let mj: TestUser;
  let member: TestUser;
  let other: TestUser;
  let loner: TestUser;
  let partieId: string;

  const reminder = async (who: TestUser) =>
    body<ReminderLike>(await who.agent.get('/me/availability-reminder').expect(200)).show;

  /** Une déclaration ponctuelle `daysFromNow` jours à partir d'aujourd'hui (UTC), valable longtemps. */
  async function declare(who: TestUser, daysFromNow: number): Promise<string> {
    const day = isoDay(daysFromNow);
    const res = await who.agent
      .post('/availability')
      .send({
        kind: 'UNAVAILABLE',
        recurKind: 'PUNCTUAL',
        slot: 'EVENING',
        startDate: day,
        endDate: day,
        expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      })
      .expect(201);
    return body<CreatedLike>(res).created[0].id;
  }

  beforeAll(async () => {
    h = await Harness.start();
    [mj, member, other, loner] = await Promise.all([
      h.createUser('rd-mj'),
      h.createUser('rd-membre'),
      h.createUser('rd-autre'),
      h.createUser('rd-seul'),
    ]);
    ({ id: partieId } = await h.createPartie(mj, 'CAMPAGNE_LINEAIRE', 'rd-jdr'));
    await h.addMember(partieId, member);
    await h.addMember(partieId, other);
  });

  afterAll(async () => {
    await h?.close();
  });

  // Le garde `AuthenticatedGuard` de tout le dépôt répond 403 (et non 401) sans session.
  it('sans session : refusé (403)', async () => {
    await request(h.app.getHttpServer()).get('/me/availability-reminder').expect(403);
  });

  it('vrai pour un membre d’une partie active, et pour son MJ, sans déclaration', async () => {
    expect(await reminder(member)).toBe(true);
    expect(await reminder(mj)).toBe(true);
  });

  it('faux sans partie active', async () => {
    expect(await reminder(loner)).toBe(false);
  });

  it('faux après une déclaration dans la fenêtre, de nouveau vrai après sa suppression', async () => {
    const id = await declare(member, 5);
    expect(await reminder(member)).toBe(false);

    await member.agent.delete(`/availability/${id}`).expect(200);
    expect(await reminder(member)).toBe(true);
  });

  it('une déclaration au-delà des 28 jours ne suffit pas', async () => {
    const id = await declare(member, 40);
    expect(await reminder(member)).toBe(true);
    await member.agent.delete(`/availability/${id}`).expect(200);
  });

  it('les déclarations d’un autre utilisateur n’y changent rien', async () => {
    const id = await declare(other, 3);
    expect(await reminder(other)).toBe(false);
    expect(await reminder(member)).toBe(true);
    await other.agent.delete(`/availability/${id}`).expect(200);
  });

  it('faux après PATCH /me/preferences { availabilityReminder: false }, avec l’AuthUser à jour', async () => {
    const res = await member.agent
      .patch('/me/preferences')
      .send({ availabilityReminder: false })
      .expect(200);
    expect(body<AuthLike>(res).availabilityReminder).toBe(false);
    expect(await reminder(member)).toBe(false);

    const back = await member.agent
      .patch('/me/preferences')
      .send({ availabilityReminder: true })
      .expect(200);
    expect(body<AuthLike>(back).availabilityReminder).toBe(true);
    expect(await reminder(member)).toBe(true);
  });

  it('une valeur non booléenne est refusée en 400', async () => {
    await member.agent.patch('/me/preferences').send({ availabilityReminder: 'oui' }).expect(400);
    await member.agent.patch('/me/preferences').send({ availabilityReminder: null }).expect(400);
  });

  it('GET /me/party-signals est identique, rappel actif ou non', async () => {
    const withReminder = body<unknown>(await member.agent.get('/me/party-signals').expect(200));
    await member.agent.patch('/me/preferences').send({ availabilityReminder: false }).expect(200);
    const without = body<unknown>(await member.agent.get('/me/party-signals').expect(200));
    expect(without).toEqual(withReminder);
    await member.agent.patch('/me/preferences').send({ availabilityReminder: true }).expect(200);
  });
});
