import { ConjonctionDraftService, type ConjonctionDraft } from './conjonction-draft.service';

const draft = (over: Partial<ConjonctionDraft> = {}): ConjonctionDraft => ({
  partieId: 'g1',
  title: 'Brunch',
  pollOptions: [{ date: '2026-11-24', slot: 'EVENING' }],
  pollDeadline: '2026-11-20',
  lieu: 'Parc',
  heureRdv: '11:00',
  notePratique: '',
  participation: 'limited',
  places: 5,
  reserved: ['u2'],
  ...over,
});

describe('ConjonctionDraftService (Story 40.5b)', () => {
  it('le calendrier reprend le brouillon en attente, une seule fois, pour la bonne partie', () => {
    const svc = new ConjonctionDraftService();
    expect(svc.takeComposeRequest('g1')).toBeNull();

    svc.beginCompose(draft());
    expect(svc.takeComposeRequest('autre')).toBeNull();
    expect(svc.takeComposeRequest('g1')?.title).toBe('Brunch');
    // Usage unique : une simple visite ultérieure ne ré-arme rien.
    expect(svc.takeComposeRequest('g1')).toBeNull();
  });

  it('valider remplace les créneaux ; la fenêtre de création les retrouve, une seule fois', () => {
    const svc = new ConjonctionDraftService();
    svc.beginCompose(draft());
    svc.takeComposeRequest('g1');

    svc.finishCompose('g1', [
      { date: '2026-11-24', slot: 'EVENING' },
      { date: '2026-11-25', slot: 'MORNING' },
    ]);
    const back = svc.takeReopen('g1');
    expect(back?.pollOptions).toHaveLength(2);
    // Tout le reste du brouillon est rendu à l'identique.
    expect(back).toMatchObject({
      title: 'Brunch',
      lieu: 'Parc',
      heureRdv: '11:00',
      participation: 'limited',
      places: 5,
      reserved: ['u2'],
      pollDeadline: '2026-11-20',
    });
    expect(svc.takeReopen('g1')).toBeNull();
  });

  it('renoncer rend le brouillon tel quel', () => {
    const svc = new ConjonctionDraftService();
    svc.beginCompose(draft());
    svc.takeComposeRequest('g1');
    svc.finishCompose('g1');
    expect(svc.takeReopen('g1')?.pollOptions).toEqual([{ date: '2026-11-24', slot: 'EVENING' }]);
  });

  it('Story 47.4 — la durée validée par le composer rejoint le brouillon ; renoncer la garde', () => {
    const svc = new ConjonctionDraftService();
    svc.beginCompose({ ...draft(), durationSlots: 2 });
    svc.takeComposeRequest('g1');
    svc.finishCompose('g1', [{ date: '2026-11-24', slot: 'EVENING' }], 6);
    expect(svc.takeReopen('g1')?.durationSlots).toBe(6);

    svc.beginCompose({ ...draft(), durationSlots: 2 });
    svc.takeComposeRequest('g1');
    svc.finishCompose('g1');
    expect(svc.takeReopen('g1')?.durationSlots).toBe(2);
  });

  it('un brouillon d’une autre partie n’est jamais rendu, et « clear » abandonne tout', () => {
    const svc = new ConjonctionDraftService();
    svc.beginCompose(draft());
    svc.takeComposeRequest('g1');
    svc.finishCompose('autre');
    expect(svc.takeReopen('autre')).toBeNull();
    svc.finishCompose('g1');
    svc.clear();
    expect(svc.takeReopen('g1')).toBeNull();
    expect(svc.takeComposeRequest('g1')).toBeNull();
  });

  it('le service garde sa propre copie : modifier l’original ensuite ne change pas le brouillon', () => {
    const svc = new ConjonctionDraftService();
    const original = draft();
    svc.beginCompose(original);
    original.pollOptions.push({ date: '2026-12-01', slot: 'MORNING' });
    original.reserved.push('u9');
    const taken = svc.takeComposeRequest('g1');
    expect(taken?.pollOptions).toHaveLength(1);
    expect(taken?.reserved).toEqual(['u2']);
  });
});
