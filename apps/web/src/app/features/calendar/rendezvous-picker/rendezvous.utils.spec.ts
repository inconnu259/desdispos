import { isComposableSeance } from '@master-jdr/shared';
import type { DatableSeanceEntry, EventCardDto, ScenarioDto } from '@master-jdr/shared';
import {
  groupRendezvous,
  jdrComposable,
  jdrRendezvous,
  natureOf,
  rowFromEntry,
} from './rendezvous.utils';

// Story 45.1 — les rendez-vous « à dater » de l'atelier se dérivent de la charge utile déjà chargée, avec le
// MÊME prédicat que le serveur (`isDatableSeance`) ; la vitrine les reçoit de `GET /me/datable-seances`.

const PROPOSE = { propose: true, edit: true, choose: true, extend: false };
const NOBODY = { propose: false, edit: false, choose: false, extend: false };
const PARTIE = { id: 'p1', name: 'La Tour' };
const title = (t: string, rank: number, count: number) => (count > 1 ? `${t} — Séance ${rank}` : t);

function scenario(over: Partial<ScenarioDto>, seances: Record<string, unknown>[]): ScenarioDto {
  return {
    id: 'sc1',
    title: 'Chapitre',
    status: 'COURANT',
    seances: seances.map((s, i) => ({
      id: `s${i + 1}`,
      poll: undefined,
      dateValidee: null,
      can: PROPOSE,
      ...s,
    })),
    ...over,
  } as unknown as ScenarioDto;
}

describe('jdrRendezvous', () => {
  it('liste les séances sans date ni vote, avec leur rang quand le scénario en a plusieurs', () => {
    const rows = jdrRendezvous([scenario({}, [{}, {}])], PARTIE, false, title);
    expect(rows.map((r) => [r.seanceId, r.title, r.nature, r.partieName])).toEqual([
      ['s1', 'Chapitre — Séance 1', 'seance', 'La Tour'],
      ['s2', 'Chapitre — Séance 2', 'seance', 'La Tour'],
    ]);
  });

  it.each([
    ['une date posée', { dateValidee: '2099-01-01' }],
    ['une date d’inscription', { inscription: { dateValidee: '2099-01-01' } }],
    ['un vote (ouvert ou clos sans date)', { poll: { id: 'x', status: 'CLOSED' } }],
    ['pas le droit de proposer', { can: NOBODY }],
  ])('écarte une séance avec %s', (_label, over) => {
    expect(jdrRendezvous([scenario({}, [over])], PARTIE, false, title)).toEqual([]);
  });

  it('écarte un scénario clôturé et une partie figée', () => {
    expect(jdrRendezvous([scenario({ status: 'PASSE' }, [{}])], PARTIE, false, title)).toEqual([]);
    expect(jdrRendezvous([scenario({}, [{}])], PARTIE, true, title)).toEqual([]);
  });
});

describe('groupRendezvous', () => {
  const card = (over: Record<string, unknown> = {}) =>
    ({
      id: 'e1',
      title: 'Apéro',
      seance: { id: 's1', date: null },
      poll: null,
      cancelled: false,
      can: PROPOSE,
      ...over,
    }) as unknown as EventCardDto;

  it('une soirée sans date ni vote, que je peux proposer, est à dater', () => {
    expect(groupRendezvous([card()], PARTIE, false)).toEqual([
      {
        seanceId: 's1',
        partieId: 'p1',
        partieName: 'La Tour',
        family: 'ralliement',
        nature: 'soiree',
        eventId: 'e1',
        title: 'Apéro',
      },
    ]);
  });

  it.each([
    ['datée', { seance: { id: 's1', date: '2099-01-01' } }],
    ['avec un vote', { poll: { id: 'p', status: 'OPEN' } }],
    ['annulée', { cancelled: true }],
    ['sans droit', { can: NOBODY }],
    ['sans séance', { seance: null }],
  ])('écarte une conjonction %s', (_label, over) => {
    expect(groupRendezvous([card(over)], PARTIE, false)).toEqual([]);
  });
});

describe('vitrine (Story 45.1, 45.5)', () => {
  const entry = (over: Partial<DatableSeanceEntry>): DatableSeanceEntry => ({
    seanceId: 's1',
    partieId: 'p1',
    partieName: 'La Tour',
    family: 'jdr',
    kind: 'CAMPAGNE_LINEAIRE',
    title: 'Chapitre',
    seanceRank: 2,
    seanceCount: 3,
    durationSlots: 1,
    can: PROPOSE,
    ...over,
  });

  it('Story 45.5 — une soirée sans date est une ligne comme une autre : la nature « soirée », aucune passerelle', () => {
    const row = rowFromEntry(
      entry({ seanceId: 's2', family: 'ralliement', kind: 'ONE_SHOT' }),
      title,
    );
    expect(row).toMatchObject({ seanceId: 's2', nature: 'soiree' });
  });

  it('rowFromEntry nomme la séance et déduit la nature de la famille', () => {
    expect(rowFromEntry(entry({}), title)).toMatchObject({
      title: 'Chapitre — Séance 2',
      nature: 'seance',
    });
    expect(natureOf('ralliement')).toBe('soiree');
  });
});

// Story 46.3 — « composable » : à dater, ou porteur d'un vote OUVERT que l'on peut modifier.
describe('isComposableSeance', () => {
  const base = {
    hasDate: false,
    hasPoll: false,
    hasOpenPoll: false,
    cancelled: false,
    frozen: false,
    canPropose: true,
    canEdit: true,
  };

  it('à dater : composable', () => {
    expect(isComposableSeance(base)).toBe(true);
  });

  it('au vote ouvert et modifiable : composable', () => {
    expect(isComposableSeance({ ...base, hasPoll: true, hasOpenPoll: true })).toBe(true);
  });

  it.each([
    ['vote ouvert sans droit de modifier', { hasPoll: true, hasOpenPoll: true, canEdit: false }],
    ['vote clos sans date', { hasPoll: true, hasOpenPoll: false }],
    ['daté', { hasDate: true }],
    ['annulé', { cancelled: true, hasPoll: true, hasOpenPoll: true }],
    ['partie figée', { frozen: true }],
    ['sans droit de proposer', { canPropose: false }],
  ])('%s : pas composable', (_label, over) => {
    expect(isComposableSeance({ ...base, ...over })).toBe(false);
  });
});

describe('jdrComposable', () => {
  const open = { id: 'poll1', status: 'OPEN' };

  it('liste les séances à dater ET celles au vote ouvert modifiable, avec leur nature', () => {
    const rows = jdrComposable(
      [scenario({}, [{}, { poll: open }, { poll: { id: 'x', status: 'CLOSED' } }])],
      PARTIE,
      false,
      title,
    );
    expect(rows.map((r) => [r.seanceId, r.nature])).toEqual([
      ['s1', 'seance'],
      ['s2', 'seance_poll'],
    ]);
  });

  it('un vote ouvert que l’on ne peut pas modifier, un scénario clos, une partie figée : rien', () => {
    expect(
      jdrComposable([scenario({}, [{ poll: open, can: NOBODY }])], PARTIE, false, title),
    ).toEqual([]);
    expect(jdrComposable([scenario({ status: 'PASSE' }, [{}])], PARTIE, false, title)).toEqual([]);
    expect(jdrComposable([scenario({}, [{}, { poll: open }])], PARTIE, true, title)).toEqual([]);
  });
});
