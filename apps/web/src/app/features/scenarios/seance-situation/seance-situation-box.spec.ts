import type { SeanceDto, SessionPollDto } from '@master-jdr/shared';
import { seanceSituationBox, voteDeadlineLabel } from './seance-situation-box';

const TODAY = '2026-11-07';
const ME = 'u1';

const POLL: SessionPollDto = {
  id: 'poll1',
  partieId: 'p1',
  status: 'OPEN',
  scenarioRef: null,
  expiresAt: null,
  chosenDate: null,
  chosenSlot: null,
  membersCount: 4,
  durationSlots: 1,
  options: [],
};

type Source = Pick<SeanceDto, 'poll' | 'inscription' | 'dateValidee'>;
const BARE: Source = { dateValidee: null };

function inscription(
  inscrits: string[],
  max = 4,
  dateValidee: string | null = null,
): NonNullable<SeanceDto['inscription']> {
  return {
    min: 2,
    max,
    dateValidee,
    inscrits: inscrits.map((userId) => ({ userId, pseudo: userId })),
  } as NonNullable<SeanceDto['inscription']>;
}

describe('seanceSituationBox — joueur', () => {
  it('vote à faire, sans échéance → voter', () => {
    const s: Source = { ...BARE, poll: POLL };
    expect(seanceSituationBox(s, 'vote_a_faire', false, ME, TODAY)).toBe('voter');
  });

  it('vote à faire, échéance aujourd’hui ou plus tard → voter', () => {
    for (const day of ['2026-11-07', '2026-11-12']) {
      const s: Source = { ...BARE, poll: { ...POLL, expiresAt: `${day}T21:59:59.000Z` } };
      expect(seanceSituationBox(s, 'vote_a_faire', false, ME, TODAY), day).toBe('voter');
    }
  });

  it('vote à faire, échéance passée → null (la ligne seule)', () => {
    const s: Source = { ...BARE, poll: { ...POLL, expiresAt: '2026-11-06T21:59:59.000Z' } };
    expect(seanceSituationBox(s, 'vote_a_faire', false, ME, TODAY)).toBeNull();
  });

  it('inscription ouverte, sans date, places restantes → participer', () => {
    const s: Source = { ...BARE, inscription: inscription(['u2']) };
    expect(seanceSituationBox(s, 'pas_inscrit', false, ME, TODAY)).toBe('participer');
  });

  it('inscription complète → null', () => {
    const s: Source = { ...BARE, inscription: inscription(['u2', 'u3'], 2) };
    expect(seanceSituationBox(s, 'pas_inscrit', false, ME, TODAY)).toBeNull();
  });

  it('inscrit, sans date → se_desinscrire', () => {
    const s: Source = { ...BARE, inscription: inscription([ME, 'u2']) };
    expect(seanceSituationBox(s, 'je_participe', false, ME, TODAY)).toBe('se_desinscrire');
  });

  it('inscrit avec date (ou non inscrit avec date) → null : la date seule', () => {
    const dated = '2026-11-20T00:00:00.000Z';
    const a: Source = { dateValidee: dated, inscription: inscription([ME], 4, dated) };
    const b: Source = { dateValidee: dated, inscription: inscription(['u2'], 4, dated) };
    expect(seanceSituationBox(a, 'je_participe', false, ME, TODAY)).toBeNull();
    expect(seanceSituationBox(b, 'pas_inscrit', false, ME, TODAY)).toBeNull();
  });

  it('j’y étais et aucune situation → null', () => {
    const s: Source = { ...BARE, inscription: inscription([ME]) };
    expect(seanceSituationBox(s, 'j_y_etais', false, ME, TODAY)).toBeNull();
    expect(seanceSituationBox(s, null, false, ME, TODAY)).toBeNull();
  });

  describe('vote ouvert ET inscription (Story 8.8)', () => {
    it('vote à faire → voter, inscrit ou non', () => {
      for (const inscrits of [[ME], ['u2']]) {
        const s: Source = { ...BARE, poll: POLL, inscription: inscription(inscrits) };
        expect(seanceSituationBox(s, 'vote_a_faire', false, ME, TODAY)).toBe('voter');
      }
    });

    it('j’ai voté → l’inscription décide : participer, se_desinscrire ou null', () => {
      const open = { ...BARE, poll: POLL };
      expect(
        seanceSituationBox({ ...open, inscription: inscription(['u2']) }, 'j_ai_vote', false, ME, TODAY),
      ).toBe('participer');
      expect(
        seanceSituationBox({ ...open, inscription: inscription([ME]) }, 'j_ai_vote', false, ME, TODAY),
      ).toBe('se_desinscrire');
      expect(
        seanceSituationBox(
          { ...open, inscription: inscription(['u2', 'u3'], 2) },
          'j_ai_vote',
          false,
          ME,
          TODAY,
        ),
      ).toBeNull();
    });

    it('j’ai voté sans inscription → null', () => {
      expect(seanceSituationBox({ ...BARE, poll: POLL }, 'j_ai_vote', false, ME, TODAY)).toBeNull();
    });
  });

  it('un lecteur inconnu n’a aucun encadré', () => {
    expect(seanceSituationBox({ ...BARE, poll: POLL }, 'vote_a_faire', false, undefined, TODAY)).toBeNull();
  });
});

describe('seanceSituationBox — MJ', () => {
  it('sans date ni vote (linéaire) → lancer_le_vote', () => {
    expect(seanceSituationBox(BARE, 'je_mene', true, ME, TODAY)).toBe('lancer_le_vote');
  });

  it('épisodique, capacité fixée → lancer_le_vote ; sans capacité → null', () => {
    expect(
      seanceSituationBox({ ...BARE, inscription: inscription([]) }, 'je_mene', true, ME, TODAY, true),
    ).toBe('lancer_le_vote');
    expect(seanceSituationBox(BARE, 'je_mene', true, ME, TODAY, true)).toBeNull();
  });

  it('séance datée sans vote → null', () => {
    expect(
      seanceSituationBox({ dateValidee: '2026-11-20T00:00:00.000Z' }, 'je_mene', true, ME, TODAY),
    ).toBeNull();
  });

  it('vote ouvert → null (jusqu’à la Story 54.3)', () => {
    expect(seanceSituationBox({ ...BARE, poll: POLL }, 'je_mene', true, ME, TODAY)).toBeNull();
  });

  it('vote clos sans date → reinitialiser_la_date', () => {
    const s: Source = { ...BARE, poll: { ...POLL, status: 'CLOSED' } };
    expect(seanceSituationBox(s, 'je_mene', true, ME, TODAY)).toBe('reinitialiser_la_date');
  });

  it('date scellée → null', () => {
    const s: Source = {
      dateValidee: '2026-11-20T00:00:00.000Z',
      poll: { ...POLL, status: 'CLOSED', chosenDate: '2026-11-20T00:00:00.000Z' },
    };
    expect(seanceSituationBox(s, 'je_mene', true, ME, TODAY)).toBeNull();
  });

  it('MJ en lecture seule (contrôles absents) → aucun encadré', () => {
    expect(seanceSituationBox(BARE, 'je_mene', false, ME, TODAY)).toBeNull();
    const closed: Source = { ...BARE, poll: { ...POLL, status: 'CLOSED' } };
    expect(seanceSituationBox(closed, 'je_mene', false, ME, TODAY)).toBeNull();
  });
});

describe('voteDeadlineLabel', () => {
  it('dans les six jours : le jour de la semaine seul', () => {
    expect(voteDeadlineLabel('2026-11-12T21:59:59.000Z', TODAY)).toBe('jeudi');
    expect(voteDeadlineLabel('2026-11-07T21:59:59.000Z', TODAY)).toBe('samedi');
    expect(voteDeadlineLabel('2026-11-13T21:59:59.000Z', TODAY)).toBe('vendredi');
  });

  it('au-delà : jour et date', () => {
    expect(voteDeadlineLabel('2026-11-14T21:59:59.000Z', TODAY)).toBe('samedi 14 novembre');
    expect(voteDeadlineLabel('2026-11-19T00:00:00.000Z', TODAY)).toBe('jeudi 19 novembre');
  });
});
