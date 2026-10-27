import type { SeanceInscriptionDto, SessionPollDto } from '@master-jdr/shared';
import { scenarioState, seanceState, type SeanceStateSource } from './status-derivation';

/** Jour de référence de toute cette suite. Aucune lecture de l'horloge : `seanceState()` reçoit
 *  `todayKey`, exactement comme l'Agenda (`calendar-agenda-view.spec.ts`). */
const TODAY = '2026-09-23';
const ME = 'user-moi';
const AUTRE = 'user-autre';

function iso(dateKey: string): string {
  return `${dateKey}T00:00:00.000Z`;
}

function poll(over: Partial<SessionPollDto> = {}): SessionPollDto {
  return {
    id: 'poll1',
    partieId: 'p1',
    status: 'OPEN',
    scenarioRef: null,
    expiresAt: null,
    chosenDate: null,
    chosenSlot: null,
    membersCount: 3,
    durationSlots: 1,
    options: [
      { id: 'o1', date: iso('2026-10-02'), slot: 'EVENING', votes: [] },
      { id: 'o2', date: iso('2026-10-09'), slot: 'EVENING', votes: [] },
    ],
    ...over,
  };
}

/** Un vote auquel `userIds` ont répondu sur TOUTES les options (définition de `getMissingVoters()`). */
function pollAnsweredBy(...userIds: string[]): SessionPollDto {
  const base = poll();
  return {
    ...base,
    options: base.options.map((o) => ({
      ...o,
      votes: userIds.map((userId) => ({
        userId,
        pseudo: userId,
        displayName: userId,
        answer: 'YES' as const,
      })),
    })),
  };
}

function inscription(over: Partial<SeanceInscriptionDto> = {}): SeanceInscriptionDto {
  return { min: 2, max: 4, inscrits: [], dateValidee: null, ...over };
}

function seance(over: SeanceStateSource = {}): SeanceStateSource {
  return { compteRendu: null, dateValidee: null, slotValidee: null, ...over };
}

describe('scenarioState — les quatre états servis tels quels', () => {
  it('BROUILLON → traitement de forme, jamais une teinte', () => {
    const s = scenarioState('BROUILLON');
    expect(s.labelKey).toBe('status.scenario_brouillon');
    expect(s.draft).toBe(true);
  });

  it('A_VENIR → soon', () => {
    expect(scenarioState('A_VENIR')).toEqual({
      tone: 'soon',
      labelKey: 'status.scenario_a_venir',
      draft: false,
    });
  });

  it('COURANT → live', () => {
    expect(scenarioState('COURANT')).toEqual({
      tone: 'live',
      labelKey: 'status.scenario_courant',
      draft: false,
    });
  });

  it('PASSE → done', () => {
    expect(scenarioState('PASSE')).toEqual({
      tone: 'done',
      labelKey: 'status.scenario_passe',
      draft: false,
    });
  });

  it('aucun état de scénario n’est marqué brouillon sauf BROUILLON', () => {
    for (const status of ['A_VENIR', 'COURANT', 'PASSE'] as const) {
      expect(scenarioState(status).draft, status).toBe(false);
    }
  });
});

// Chaque `it` ci-dessous correspond à UNE ligne de la matrice d'E/S de la spec 32.3.
describe('seanceState — la matrice d’E/S, ligne par ligne', () => {
  it('séance sans date ni vote → « À planifier » (todo)', () => {
    expect(seanceState(seance(), ME, TODAY)).toEqual({
      tone: 'todo',
      labelKey: 'status.seance_a_planifier',
      draft: false,
    });
  });

  it('vote ouvert, lecteur absent des votes → « Réponds au vote » (todo)', () => {
    const s = seanceState(seance({ poll: pollAnsweredBy(AUTRE) }), ME, TODAY);
    expect(s.labelKey).toBe('status.seance_answer_poll');
    expect(s.tone).toBe('todo');
  });

  it('vote ouvert, lecteur présent dans TOUTES les options → « Vote en cours » (live)', () => {
    const s = seanceState(seance({ poll: pollAnsweredBy(ME, AUTRE) }), ME, TODAY);
    expect(s.labelKey).toBe('status.seance_poll_open');
    expect(s.tone).toBe('live');
  });

  it('vote ouvert, réponse PARTIELLE → toujours « Réponds au vote » (définition de getMissingVoters)', () => {
    const base = poll();
    const partiel: SessionPollDto = {
      ...base,
      options: [
        {
          ...base.options[0],
          votes: [{ userId: ME, pseudo: ME, displayName: ME, answer: 'YES' }],
        },
        base.options[1],
      ],
    };
    expect(seanceState(seance({ poll: partiel }), ME, TODAY).labelKey).toBe(
      'status.seance_answer_poll',
    );
  });

  it('vote ouvert, lecteur non identifié → informe (« Vote en cours »), n’interpelle personne', () => {
    expect(seanceState(seance({ poll: poll() }), undefined, TODAY).labelKey).toBe(
      'status.seance_poll_open',
    );
  });

  it('inscriptions ouvertes → « Inscriptions ouvertes » (live)', () => {
    const s = seanceState(seance({ inscription: inscription() }), ME, TODAY);
    expect(s.labelKey).toBe('status.seance_inscriptions_ouvertes');
    expect(s.tone).toBe('live');
  });

  it('séance future, > 7 j → « Programmée » (soon), intensité lointaine, libellé de registre', () => {
    const s = seanceState(seance({ dateValidee: iso('2026-10-15') }), ME, TODAY);
    expect(s).toEqual({
      tone: 'soon',
      intensity: 'far',
      labelKey: 'status.seance_programmee',
      text: undefined,
      draft: false,
    });
  });

  it('séance future, 7 à 2 j → même teinte, intensité « proche »', () => {
    const s = seanceState(seance({ dateValidee: iso('2026-09-28') }), ME, TODAY);
    expect(s.tone).toBe('soon');
    expect(s.intensity).toBe('near');
    expect(s.text).toBeUndefined();
  });

  it('séance ≤ 1 j → badge plein ET libellé HUMAIN, sans changer de teinte', () => {
    const demain = seanceState(
      seance({
        poll: poll({ status: 'CLOSED', chosenDate: iso('2026-09-24'), chosenSlot: 'EVENING' }),
      }),
      ME,
      TODAY,
    );
    expect(demain.tone).toBe('soon');
    expect(demain.intensity).toBe('imminent');
    expect(demain.text).toBe('demain soir');

    const ceSoir = seanceState(
      seance({
        poll: poll({ status: 'CLOSED', chosenDate: iso(TODAY), chosenSlot: 'EVENING' }),
      }),
      ME,
      TODAY,
    );
    expect(ceSoir.tone).toBe('soon');
    expect(ceSoir.text).toBe('ce soir');
  });

  it('le jour même n’est PAS passé : une séance datée d’aujourd’hui reste « Programmée »', () => {
    expect(seanceState(seance({ dateValidee: iso(TODAY) }), ME, TODAY).labelKey).toBe(
      'status.seance_programmee',
    );
  });

  it('séance passée sans compte-rendu → « À débriefer » (todo)', () => {
    const s = seanceState(seance({ dateValidee: iso('2026-09-10') }), ME, TODAY);
    expect(s.labelKey).toBe('status.seance_a_debriefer');
    expect(s.tone).toBe('todo');
  });

  it('séance passée, compte-rendu blanc → toujours « À débriefer »', () => {
    expect(
      seanceState(seance({ dateValidee: iso('2026-09-10'), compteRendu: '   ' }), ME, TODAY)
        .labelKey,
    ).toBe('status.seance_a_debriefer');
  });

  it('séance passée avec compte-rendu → « Jouée » (done)', () => {
    const s = seanceState(
      seance({ dateValidee: iso('2026-09-10'), compteRendu: 'On a survécu.' }),
      ME,
      TODAY,
    );
    expect(s.labelKey).toBe('status.seance_jouee');
    expect(s.tone).toBe('done');
  });

  it('aucune date exploitable → retombe sur « À planifier », jamais un état inventé', () => {
    // Vote CLOS sans date retenue : rien à en tirer, et surtout rien à inventer.
    expect(
      seanceState(seance({ poll: poll({ status: 'CLOSED', chosenDate: null }) }), ME, TODAY)
        .labelKey,
    ).toBe('status.seance_a_planifier');
  });
});

// Le départage de deux états simultanés — testé explicitement, comme l'exige la spec.
describe('seanceState — une plage n’est passée qu’à sa fin (Story 47.2)', () => {
  const dated = (date: string, endDate: string | null) =>
    seance({ dateValidee: `${date}T00:00:00.000Z`, slotValidee: 'EVENING', endDate: endDate && `${endDate}T00:00:00.000Z` });

  it('commencée avant aujourd’hui mais finissant aujourd’hui ou plus tard : encore à venir', () => {
    const yesterday = '2026-09-22';
    expect(seanceState(dated(yesterday, TODAY), ME, TODAY).labelKey).not.toBe('status.seance_a_debriefer');
    expect(seanceState(dated(yesterday, '2026-09-26'), ME, TODAY).labelKey).not.toBe('status.seance_a_debriefer');
  });

  it('finie avant aujourd’hui : « À débriefer »', () => {
    expect(seanceState(dated('2026-09-18', '2026-09-22'), ME, TODAY).labelKey).toBe('status.seance_a_debriefer');
  });

  it('sans fin servie : le début décide, comme avant', () => {
    expect(seanceState(dated('2026-09-22', null), ME, TODAY).labelKey).toBe('status.seance_a_debriefer');
  });
});

describe('seanceState — ordre de priorité (actionnabilité décroissante)', () => {
  it('« À débriefer » prime sur tout une fois la date passée', () => {
    const s = seanceState(
      seance({
        poll: poll({ status: 'CLOSED', chosenDate: iso('2026-09-10'), chosenSlot: 'EVENING' }),
        inscription: inscription(),
      }),
      ME,
      TODAY,
    );
    expect(s.labelKey).toBe('status.seance_a_debriefer');
  });

  it('« Réponds au vote » (todo) prime sur « Inscriptions ouvertes » (live)', () => {
    const s = seanceState(
      seance({ poll: pollAnsweredBy(AUTRE), inscription: inscription() }),
      ME,
      TODAY,
    );
    expect(s.labelKey).toBe('status.seance_answer_poll');
  });

  it('« Inscriptions ouvertes » prime sur « Programmée »', () => {
    const s = seanceState(
      seance({
        poll: poll({ status: 'CLOSED', chosenDate: iso('2026-10-15'), chosenSlot: 'EVENING' }),
        inscription: inscription({ inscrits: [{ userId: AUTRE, pseudo: AUTRE }] }),
      }),
      ME,
      TODAY,
    );
    expect(s.labelKey).toBe('status.seance_inscriptions_ouvertes');
  });

  it('inscription COMPLÈTE : la séance datée redevient « Programmée »', () => {
    const complete = inscription({
      max: 2,
      inscrits: [
        { userId: ME, pseudo: ME },
        { userId: AUTRE, pseudo: AUTRE },
      ],
    });
    const s = seanceState(
      seance({
        poll: poll({ status: 'CLOSED', chosenDate: iso('2026-10-15'), chosenSlot: 'EVENING' }),
        inscription: complete,
      }),
      ME,
      TODAY,
    );
    expect(s.labelKey).toBe('status.seance_programmee');
  });
});

describe('seanceState — résolution de la date effective', () => {
  it('`dateValidee` à la racine suffit : une séance datée SANS vote ni inscription a un état', () => {
    // C'est précisément le trou que le correctif serveur de la story 32.3 bouche : avant, cette
    // séance-là n'exposait aucune date et retombait à tort sur « À planifier ».
    expect(seanceState(seance({ dateValidee: iso('2026-10-15') }), ME, TODAY).labelKey).toBe(
      'status.seance_programmee',
    );
  });

  it('`poll.chosenDate` l’emporte sur la date héritée', () => {
    const s = seanceState(
      seance({
        poll: poll({ status: 'CLOSED', chosenDate: iso('2026-09-10'), chosenSlot: 'EVENING' }),
        dateValidee: iso('2026-10-15'),
      }),
      ME,
      TODAY,
    );
    expect(s.labelKey).toBe('status.seance_a_debriefer');
  });

  it('repli sur `inscription.dateValidee` (charge utile d’une API pas encore redéployée)', () => {
    // Inscription COMPLÈTE, sinon « Inscriptions ouvertes » primerait — ce qu'un autre test
    // vérifie déjà : ici on veut isoler la seule résolution de date.
    const s = seanceState(
      seance({
        inscription: inscription({
          max: 1,
          inscrits: [{ userId: ME, pseudo: ME }],
          dateValidee: iso('2026-10-15'),
        }),
      }),
      ME,
      TODAY,
    );
    expect(s.labelKey).toBe('status.seance_programmee');
  });
});
