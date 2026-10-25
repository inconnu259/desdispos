import type { DatableSeanceEntry, EventCardDto, ScenarioDto } from '@master-jdr/shared';
import {
  armableRendezvous,
  groupRendezvous,
  jdrRendezvous,
  natureOf,
  rowFromEntry,
  SOIREE_ROWS_ARMABLE,
  type RendezvousRow,
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

describe('vitrine et seam de la Story 45.5', () => {
  const entry = (over: Partial<DatableSeanceEntry>): DatableSeanceEntry => ({
    seanceId: 's1',
    partieId: 'p1',
    partieName: 'La Tour',
    family: 'jdr',
    kind: 'CAMPAGNE_LINEAIRE',
    title: 'Chapitre',
    seanceRank: 2,
    seanceCount: 3,
    can: PROPOSE,
    ...over,
  });

  it('rowFromEntry nomme la séance et déduit la nature de la famille', () => {
    expect(rowFromEntry(entry({}), title)).toMatchObject({
      title: 'Chapitre — Séance 2',
      nature: 'seance',
    });
    expect(natureOf('ralliement')).toBe('soiree');
  });

  it('le web masque les soirées tant que la 45.5 n’a pas livré leur cible de composer', () => {
    const rows: RendezvousRow[] = [
      rowFromEntry(entry({}), title),
      rowFromEntry(entry({ seanceId: 's2', family: 'ralliement', kind: 'ONE_SHOT' }), title),
    ];
    expect(SOIREE_ROWS_ARMABLE).toBe(false);
    expect(armableRendezvous(rows).map((r) => r.seanceId)).toEqual(['s1']);
  });
});
