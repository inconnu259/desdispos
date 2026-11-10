import { NotificationsService } from '../../src/notifications/notifications.service';
import { Harness, body, isoDay, type TestUser } from './harness';

// Test de caractérisation (Story 37.1) : fige le rappel de la veille, sur des données construites
// par les routes HTTP. Seules ces attentes-ci peuvent changer dans l'épic 37, en 37.9 (rappel par
// séance) — mêmes e-mail et destinataires attendus pour une partie à une seule prochaine séance.

type ScenarioDtoLike = {
  id: string;
  seances: { id: string; poll?: { id: string; options: { id: string; date: string }[] } }[];
};

/** Crée une partie ONE_SHOT, y ajoute `members`, et date son unique séance au jour `day`. */
async function partieDatee(
  h: Harness,
  mj: TestUser,
  members: TestUser[],
  label: string,
  day: string,
  slot: string,
): Promise<{ id: string; name: string }> {
  const { id, name } = await h.createPartie(mj, 'ONE_SHOT', label);
  for (const member of members) await h.addMember(id, member);

  const scenariosRes = await mj.agent.get(`/parties/${id}/scenarios`).expect(200);
  const seanceId = body<ScenarioDtoLike[]>(scenariosRes)[0].seances[0].id;
  const pollRes = await mj.agent
    .post(`/scenarios/seances/${seanceId}/poll`)
    .send({
      options: [
        { date: day, slot },
        { date: isoDay(30), slot },
      ],
    })
    .expect(201);
  const poll = body<ScenarioDtoLike>(pollRes).seances[0].poll!;
  const option = poll.options.find((o) => o.date.startsWith(day))!;
  await mj.agent
    .patch(`/parties/${id}/poll/${poll.id}/choose`)
    .send({ optionId: option.id })
    .expect(200);
  return { id, name };
}

describe('Caractérisation JDR — rappel de la veille (Story 37.1)', () => {
  let h: Harness;
  let notifications: NotificationsService;

  beforeAll(async () => {
    h = await Harness.start();
    notifications = h.app.get(NotificationsService);
  });

  afterAll(async () => {
    await h?.close();
  });

  it('fige : une séance dans les 24 h déclenche un unique `session-reminder` au MJ et aux membres, puis plus rien', async () => {
    const mj = await h.createUser('mj');
    const joueur = await h.createUser('joueur');
    const autreJoueur = await h.createUser('joueur');
    const etranger = await h.createUser('etranger');
    const ours = new Set([mj.email, joueur.email, autreJoueur.email, etranger.email]);

    // Demain à minuit UTC tombe toujours dans les 24 h à venir.
    // Le MJ est aussi membre (Membership) de la partie due : il ne doit recevoir qu'un seul rappel.
    const due = await partieDatee(
      h,
      mj,
      [mj, joueur, autreJoueur],
      'rappel-du',
      isoDay(1),
      'EVENING',
    );
    // Séance dans 5 jours : hors fenêtre, aucun rappel.
    await partieDatee(h, mj, [joueur], 'rappel-pas-encore', isoDay(5), 'EVENING');

    h.email.calls = [];
    await notifications.sendDueReminders();

    const firstRun = h.email.calls.filter((c) => ours.has(c.to));
    expect(firstRun.map((c) => c.to).sort()).toEqual(
      [mj.email, joueur.email, autreJoueur.email].sort(),
    );
    expect(
      firstRun.filter((c) => c.to === mj.email && c.template === 'session-reminder'),
    ).toHaveLength(1);
    for (const call of firstRun) {
      expect(call.template).toBe('session-reminder');
      expect(call.data.partieName).toBe(due.name);
      expect(String(call.data.link)).toContain(`/parties/${due.id}`);
      expect(String(call.data.sessionDate)).toContain('(soir)');
    }

    h.email.calls = [];
    await notifications.sendDueReminders();
    expect(h.email.calls.filter((c) => ours.has(c.to))).toEqual([]);
  });

  it('rappelle chaque membre une fois par séance pour une campagne épisodique à deux séances dans les 24 h (Story 37.9)', async () => {
    const mj = await h.createUser('mj');
    const joueur = await h.createUser('joueur');
    const nonInscrit = await h.createUser('joueur');
    const ours = new Set([mj.email, joueur.email, nonInscrit.email]);

    const { id, name } = await h.createPartie(mj, 'CAMPAGNE_EPISODIQUE', 'rappel-episodique');
    await h.addMember(id, joueur);
    await h.addMember(id, nonInscrit);

    // Deux scénarios, donc deux séances, datés demain à minuit UTC (dans les 24 h) sur des créneaux
    // différents. Une troisième séance, dans 5 jours, reste hors fenêtre.
    for (const [title, day, slot] of [
      ['Épisode matin', isoDay(1), 'MORNING'],
      ['Épisode soir', isoDay(1), 'EVENING'],
      ['Épisode lointain', isoDay(5), 'EVENING'],
    ] as const) {
      const res = await mj.agent.post(`/parties/${id}/scenarios`).send({ title }).expect(201);
      const scenarioId = body<ScenarioDtoLike>(res).id;
      const seanceId = body<ScenarioDtoLike>(res).seances[0].id;
      // Anti-spoil serveur : la séance d'un brouillon n'est rappelée qu'au propriétaire — le
      // scénario est ouvert pour que les membres soient rappelés comme avant.
      await mj.agent.patch(`/scenarios/${scenarioId}/open`).expect(200);
      const pollRes = await mj.agent
        .post(`/scenarios/seances/${seanceId}/poll`)
        .send({
          options: [
            { date: day, slot },
            { date: isoDay(30), slot },
          ],
        })
        .expect(201);
      const seance = body<{ seances: ScenarioDtoLike['seances'] }>(pollRes).seances.find(
        (se) => se.id === seanceId,
      );
      const poll = seance!.poll!;
      const option = poll.options.find((o) => o.date.startsWith(day))!;
      await mj.agent
        .patch(`/parties/${id}/poll/${poll.id}/choose`)
        .send({ optionId: option.id })
        .expect(200);
    }

    h.email.calls = [];
    await notifications.sendDueReminders();

    const firstRun = h.email.calls.filter((c) => ours.has(c.to));
    // Chaque destinataire (MJ, deux membres dont un jamais inscrit) reçoit un rappel par séance
    // proche, soit deux.
    for (const to of ours) {
      const received = firstRun.filter((c) => c.to === to);
      expect(received).toHaveLength(2);
      expect(received.map((c) => String(c.data.sessionDate)).sort()).toEqual([
        expect.stringContaining('(matin)'),
        expect.stringContaining('(soir)'),
      ]);
      for (const call of received) {
        expect(call.template).toBe('session-reminder');
        expect(call.data.partieName).toBe(name);
      }
    }

    // Second passage : les deux séances sont marquées, la troisième n'est pas encore due.
    h.email.calls = [];
    await notifications.sendDueReminders();
    expect(h.email.calls.filter((c) => ours.has(c.to))).toEqual([]);
  });
});
