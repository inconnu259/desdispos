import type { SeanceInscriptionDto, SessionPollDto } from '@desdispos/shared';
import {
  nextSeanceOf,
  scenarioState,
  seanceSituation,
  seanceState,
  type SeanceStateSource,
} from './status-derivation';

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

/** Un vote auquel `userId` n'a répondu qu'à la PREMIÈRE option — réponse partielle. */
function pollPartiallyAnsweredBy(
  userId: string,
  over: Partial<SessionPollDto> = {},
): SessionPollDto {
  const base = poll(over);
  return {
    ...base,
    options: [
      {
        ...base.options[0],
        votes: [{ userId, pseudo: userId, displayName: userId, answer: 'YES' }],
      },
      base.options[1],
    ],
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
// Story 53.1 : l'état est IMPERSONNEL — plus de lecteur en entrée, un vote ouvert dit « Vote en
// cours » pour tout le monde (l'appel à l'action vit dans `seanceSituation()`).
describe('seanceState — la matrice d’E/S, ligne par ligne', () => {
  it('séance sans date ni vote → « À planifier » (todo)', () => {
    expect(seanceState(seance(), TODAY)).toEqual({
      tone: 'todo',
      labelKey: 'status.seance_a_planifier',
      draft: false,
    });
  });

  it('vote ouvert, personne n’a répondu → « Vote en cours » (live), jamais un appel à l’action', () => {
    const s = seanceState(seance({ poll: pollAnsweredBy(AUTRE) }), TODAY);
    expect(s.labelKey).toBe('status.seance_poll_open');
    expect(s.tone).toBe('live');
  });

  it('vote ouvert, tout le monde a répondu → le MÊME « Vote en cours » (live)', () => {
    const s = seanceState(seance({ poll: pollAnsweredBy(ME, AUTRE) }), TODAY);
    expect(s.labelKey).toBe('status.seance_poll_open');
    expect(s.tone).toBe('live');
  });

  it('vote ouvert, réponse PARTIELLE → toujours « Vote en cours »', () => {
    expect(seanceState(seance({ poll: pollPartiallyAnsweredBy(ME) }), TODAY).labelKey).toBe(
      'status.seance_poll_open',
    );
  });

  it('inscriptions ouvertes → « Inscriptions ouvertes » (live)', () => {
    const s = seanceState(seance({ inscription: inscription() }), TODAY);
    expect(s.labelKey).toBe('status.seance_inscriptions_ouvertes');
    expect(s.tone).toBe('live');
  });

  it('séance future, > 7 j → « Programmée » (soon), intensité lointaine, libellé de registre', () => {
    const s = seanceState(seance({ dateValidee: iso('2026-10-15') }), TODAY);
    expect(s).toEqual({
      tone: 'soon',
      intensity: 'far',
      labelKey: 'status.seance_programmee',
      text: undefined,
      draft: false,
    });
  });

  it('séance future, 7 à 2 j → même teinte, intensité « proche »', () => {
    const s = seanceState(seance({ dateValidee: iso('2026-09-28') }), TODAY);
    expect(s.tone).toBe('soon');
    expect(s.intensity).toBe('near');
    expect(s.text).toBeUndefined();
  });

  it('séance ≤ 1 j → badge plein ET libellé HUMAIN, sans changer de teinte', () => {
    const demain = seanceState(
      seance({
        poll: poll({ status: 'CLOSED', chosenDate: iso('2026-09-24'), chosenSlot: 'EVENING' }),
      }),
      TODAY,
    );
    expect(demain.tone).toBe('soon');
    expect(demain.intensity).toBe('imminent');
    expect(demain.text).toBe('demain soir');

    const ceSoir = seanceState(
      seance({
        poll: poll({ status: 'CLOSED', chosenDate: iso(TODAY), chosenSlot: 'EVENING' }),
      }),
      TODAY,
    );
    expect(ceSoir.tone).toBe('soon');
    expect(ceSoir.text).toBe('ce soir');
  });

  it('le jour même n’est PAS passé : une séance datée d’aujourd’hui reste « Programmée »', () => {
    expect(seanceState(seance({ dateValidee: iso(TODAY) }), TODAY).labelKey).toBe(
      'status.seance_programmee',
    );
  });

  it('séance passée sans compte-rendu → « À débriefer » (todo)', () => {
    const s = seanceState(seance({ dateValidee: iso('2026-09-10') }), TODAY);
    expect(s.labelKey).toBe('status.seance_a_debriefer');
    expect(s.tone).toBe('todo');
  });

  it('séance passée, compte-rendu blanc → toujours « À débriefer »', () => {
    expect(
      seanceState(seance({ dateValidee: iso('2026-09-10'), compteRendu: '   ' }), TODAY).labelKey,
    ).toBe('status.seance_a_debriefer');
  });

  it('séance passée avec compte-rendu → « Jouée » (done)', () => {
    const s = seanceState(
      seance({ dateValidee: iso('2026-09-10'), compteRendu: 'On a survécu.' }),
      TODAY,
    );
    expect(s.labelKey).toBe('status.seance_jouee');
    expect(s.tone).toBe('done');
  });

  it('aucune date exploitable → retombe sur « À planifier », jamais un état inventé', () => {
    // Vote CLOS sans date retenue : rien à en tirer, et surtout rien à inventer.
    expect(
      seanceState(seance({ poll: poll({ status: 'CLOSED', chosenDate: null }) }), TODAY).labelKey,
    ).toBe('status.seance_a_planifier');
  });
});

// Le départage de deux états simultanés — testé explicitement, comme l'exige la spec.
describe('seanceState — une plage n’est passée qu’à sa fin (Story 47.2)', () => {
  const dated = (date: string, endDate: string | null) =>
    seance({
      dateValidee: `${date}T00:00:00.000Z`,
      slotValidee: 'EVENING',
      endDate: endDate && `${endDate}T00:00:00.000Z`,
    });

  it('commencée avant aujourd’hui mais finissant aujourd’hui ou plus tard : encore à venir', () => {
    const yesterday = '2026-09-22';
    expect(seanceState(dated(yesterday, TODAY), TODAY).labelKey).not.toBe(
      'status.seance_a_debriefer',
    );
    expect(seanceState(dated(yesterday, '2026-09-26'), TODAY).labelKey).not.toBe(
      'status.seance_a_debriefer',
    );
  });

  it('finie avant aujourd’hui : « À débriefer »', () => {
    expect(seanceState(dated('2026-09-18', '2026-09-22'), TODAY).labelKey).toBe(
      'status.seance_a_debriefer',
    );
  });

  it('sans fin servie : le début décide, comme avant', () => {
    expect(seanceState(dated('2026-09-22', null), TODAY).labelKey).toBe(
      'status.seance_a_debriefer',
    );
  });
});

describe('seanceState — ordre de priorité (actionnabilité décroissante)', () => {
  it('« À débriefer » prime sur tout une fois la date passée', () => {
    const s = seanceState(
      seance({
        poll: poll({ status: 'CLOSED', chosenDate: iso('2026-09-10'), chosenSlot: 'EVENING' }),
        inscription: inscription(),
      }),
      TODAY,
    );
    expect(s.labelKey).toBe('status.seance_a_debriefer');
  });

  it('« Vote en cours » prime sur « Inscriptions ouvertes »', () => {
    const s = seanceState(
      seance({ poll: pollAnsweredBy(AUTRE), inscription: inscription() }),
      TODAY,
    );
    expect(s.labelKey).toBe('status.seance_poll_open');
  });

  it('« Inscriptions ouvertes » prime sur « Programmée »', () => {
    const s = seanceState(
      seance({
        poll: poll({ status: 'CLOSED', chosenDate: iso('2026-10-15'), chosenSlot: 'EVENING' }),
        inscription: inscription({ inscrits: [{ userId: AUTRE, pseudo: AUTRE }] }),
      }),
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
      TODAY,
    );
    expect(s.labelKey).toBe('status.seance_programmee');
  });
});

describe('seanceState — résolution de la date effective', () => {
  it('`dateValidee` à la racine suffit : une séance datée SANS vote ni inscription a un état', () => {
    // C'est précisément le trou que le correctif serveur de la story 32.3 bouche : avant, cette
    // séance-là n'exposait aucune date et retombait à tort sur « À planifier ».
    expect(seanceState(seance({ dateValidee: iso('2026-10-15') }), TODAY).labelKey).toBe(
      'status.seance_programmee',
    );
  });

  it('`poll.chosenDate` l’emporte sur la date héritée', () => {
    const s = seanceState(
      seance({
        poll: poll({ status: 'CLOSED', chosenDate: iso('2026-09-10'), chosenSlot: 'EVENING' }),
        dateValidee: iso('2026-10-15'),
      }),
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
      TODAY,
    );
    expect(s.labelKey).toBe('status.seance_programmee');
  });
});

// Story 53.1 — « Ma situation » : une fonction pure, la matrice d'E/S ligne par ligne (sans TestBed).
describe('seanceSituation — la matrice d’E/S de la story 53.1', () => {
  const FUTUR = iso('2026-10-15');
  const PASSE = iso('2026-09-10');
  const situation = (s: SeanceStateSource, isMj = false) => seanceSituation(s, ME, isMj, TODAY);
  const complete = (...ids: string[]) =>
    inscription({ max: ids.length, inscrits: ids.map((userId) => ({ userId, pseudo: userId })) });

  describe('lecteur et MJ', () => {
    it('sans lecteur → null, quoi que la séance contienne', () => {
      expect(
        seanceSituation(seance({ poll: poll(), dateValidee: FUTUR }), undefined, false, TODAY),
      ).toBeNull();
      expect(seanceSituation(seance(), undefined, true, TODAY)).toBeNull();
    });

    it('MJ → « je_mene », quel que soit l’état (vide, vote, inscription, passée)', () => {
      expect(situation(seance(), true)).toBe('je_mene');
      expect(situation(seance({ poll: poll() }), true)).toBe('je_mene');
      expect(situation(seance({ inscription: inscription() }), true)).toBe('je_mene');
      expect(situation(seance({ dateValidee: PASSE }), true)).toBe('je_mene');
    });
  });

  describe('vote ouvert', () => {
    it('aucune réponse → « vote_a_faire »', () => {
      expect(situation(seance({ poll: poll() }))).toBe('vote_a_faire');
      expect(situation(seance({ poll: pollAnsweredBy(AUTRE) }))).toBe('vote_a_faire');
    });

    it('réponse PARTIELLE → toujours « vote_a_faire » (définition de hasUnansweredOptions)', () => {
      expect(situation(seance({ poll: pollPartiallyAnsweredBy(ME) }))).toBe('vote_a_faire');
    });

    it('réponse à TOUTES les options → « j_ai_vote »', () => {
      expect(situation(seance({ poll: pollAnsweredBy(ME, AUTRE) }))).toBe('j_ai_vote');
    });

    it('inscrit ET vote non répondu → « vote_a_faire » (le vote prime sur l’inscription)', () => {
      expect(
        situation(seance({ poll: poll(), inscription: complete(ME, AUTRE), dateValidee: FUTUR })),
      ).toBe('vote_a_faire');
    });

    it('NON inscrit ET vote non répondu → « vote_a_faire » aussi', () => {
      expect(situation(seance({ poll: poll(), inscription: inscription() }))).toBe('vote_a_faire');
    });

    it('inscrit ET vote répondu → « j_ai_vote »', () => {
      expect(
        situation(seance({ poll: pollAnsweredBy(ME), inscription: complete(ME, AUTRE) })),
      ).toBe('j_ai_vote');
    });
  });

  describe('séance à inscription, sans vote ouvert', () => {
    it('inscrit, à venir → « je_participe »', () => {
      expect(
        situation(
          seance({
            inscription: inscription({ inscrits: [{ userId: ME, pseudo: ME }] }),
            dateValidee: FUTUR,
          }),
        ),
      ).toBe('je_participe');
    });

    it('inscrit, sans date → « je_participe » (jamais passée)', () => {
      expect(
        situation(seance({ inscription: inscription({ inscrits: [{ userId: ME, pseudo: ME }] }) })),
      ).toBe('je_participe');
    });

    it('inscrit, passée → « j_y_etais »', () => {
      expect(situation(seance({ inscription: complete(ME), dateValidee: PASSE }))).toBe(
        'j_y_etais',
      );
    });

    it('non inscrit, places libres, à venir → « pas_inscrit »', () => {
      expect(situation(seance({ inscription: inscription(), dateValidee: FUTUR }))).toBe(
        'pas_inscrit',
      );
    });

    it('non inscrit, inscription COMPLÈTE, à venir → « pas_inscrit » aussi', () => {
      expect(situation(seance({ inscription: complete(AUTRE), dateValidee: FUTUR }))).toBe(
        'pas_inscrit',
      );
    });

    it('non inscrit, passée → null', () => {
      expect(situation(seance({ inscription: inscription(), dateValidee: PASSE }))).toBeNull();
      expect(situation(seance({ inscription: complete(AUTRE), dateValidee: PASSE }))).toBeNull();
    });
  });

  describe('séance sans inscription : la date effective', () => {
    it('date à venir → « je_participe »', () => {
      expect(situation(seance({ dateValidee: FUTUR }))).toBe('je_participe');
    });

    it('le jour même n’est PAS passé → « je_participe »', () => {
      expect(situation(seance({ dateValidee: iso(TODAY) }))).toBe('je_participe');
    });

    it('date passée → « j_y_etais »', () => {
      expect(situation(seance({ dateValidee: PASSE }))).toBe('j_y_etais');
    });

    it('plage commencée mais pas finie → « je_participe » ; finie → « j_y_etais »', () => {
      expect(
        situation(seance({ dateValidee: iso('2026-09-22'), endDate: iso('2026-09-25') })),
      ).toBe('je_participe');
      expect(situation(seance({ dateValidee: iso('2026-09-22'), endDate: iso(TODAY) }))).toBe(
        'je_participe',
      );
      expect(
        situation(seance({ dateValidee: iso('2026-09-18'), endDate: iso('2026-09-22') })),
      ).toBe('j_y_etais');
    });

    it('date effective lue dans l’ordre poll.chosenDate → dateValidee → inscription.dateValidee', () => {
      // `chosenDate` passée l'emporte sur une `dateValidee` future.
      expect(
        situation(
          seance({
            poll: poll({ status: 'CLOSED', chosenDate: PASSE, chosenSlot: 'EVENING' }),
            dateValidee: FUTUR,
          }),
        ),
      ).toBe('j_y_etais');
      // Repli sur la date de l'inscription : inscrit, date passée → « j_y_etais ».
      expect(
        situation(
          seance({
            inscription: inscription({
              inscrits: [{ userId: ME, pseudo: ME }],
              dateValidee: PASSE,
            }),
          }),
        ),
      ).toBe('j_y_etais');
    });
  });

  describe('vote clos sans date', () => {
    it('le lecteur avait répondu → « j_ai_vote »', () => {
      expect(situation(seance({ poll: { ...pollAnsweredBy(ME), status: 'CLOSED' } }))).toBe(
        'j_ai_vote',
      );
    });

    it('le lecteur n’avait pas répondu → null', () => {
      expect(
        situation(seance({ poll: { ...pollAnsweredBy(AUTRE), status: 'CLOSED' } })),
      ).toBeNull();
      expect(
        situation(seance({ poll: pollPartiallyAnsweredBy(ME, { status: 'CLOSED' }) })),
      ).toBeNull();
    });
  });

  it('ni date ni vote ni inscription → null', () => {
    expect(situation(seance())).toBeNull();
  });
});

describe('nextSeanceOf — la première séance dont la fin n’est pas passée', () => {
  const dated = (id: string, date: string | null, endDate: string | null = null) => ({
    id,
    ...seance({ dateValidee: date && iso(date), endDate: endDate && iso(endDate) }),
  });

  it('saute les séances passées, dans l’ordre servi', () => {
    const scenario = {
      seances: [dated('a', '2026-09-10'), dated('b', '2026-09-30'), dated('c', '2026-10-05')],
    };
    expect(nextSeanceOf(scenario, TODAY)?.id).toBe('b');
  });

  it('le jour même n’est pas passé', () => {
    expect(nextSeanceOf({ seances: [dated('a', TODAY)] }, TODAY)?.id).toBe('a');
  });

  it('une plage commencée mais pas finie reste la prochaine', () => {
    const scenario = {
      seances: [dated('a', '2026-09-22', '2026-09-25'), dated('b', '2026-10-01')],
    };
    expect(nextSeanceOf(scenario, TODAY)?.id).toBe('a');
  });

  it('une séance sans date n’est pas passée : elle est retenue si rien de daté ne la précède', () => {
    const scenario = {
      seances: [dated('a', '2026-09-10'), dated('b', null), dated('c', '2026-10-01')],
    };
    expect(nextSeanceOf(scenario, TODAY)?.id).toBe('b');
  });

  it('suit l’ordre servi, pas l’ordre chronologique', () => {
    const scenario = { seances: [dated('a', '2026-10-20'), dated('b', '2026-10-01')] };
    expect(nextSeanceOf(scenario, TODAY)?.id).toBe('a');
  });

  it('null quand toutes sont passées, quand il n’y en a aucune, ou sans scénario', () => {
    expect(
      nextSeanceOf({ seances: [dated('a', '2026-09-01'), dated('b', '2026-09-22')] }, TODAY),
    ).toBeNull();
    expect(nextSeanceOf({ seances: [] }, TODAY)).toBeNull();
    expect(nextSeanceOf({}, TODAY)).toBeNull();
    expect(nextSeanceOf(null, TODAY)).toBeNull();
    expect(nextSeanceOf(undefined, TODAY)).toBeNull();
  });
});
