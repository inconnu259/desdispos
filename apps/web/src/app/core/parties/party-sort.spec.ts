import type { PartieDto, PartySignalsDto } from '@desdispos/shared';
import { pinFavorites, sortParties } from './party-sort';

function makeParty(overrides: Partial<PartieDto> = {}): PartieDto {
  return {
    id: 'p1',
    name: 'Zebre',
    kind: 'ONE_SHOT',
    gameSystemId: 'draconis',
    description: null,
    ownerId: 'mj1',
    createdAt: '2026-01-01T00:00:00.000Z',
    nextSessionDate: null,
    nextSessionSlot: null,
    role: 'mj',
    status: 'A_VENIR',
    isFavorite: false,
    coverImageVersion: null,
    can: { coverUpdate: true },
    ...overrides,
  };
}

function signals(entries: Record<string, PartySignalsDto>): Map<string, PartySignalsDto> {
  return new Map(Object.entries(entries));
}

describe('sortParties (Story 29.8)', () => {
  it('urgence : une partie « bloquante » avant une partie sans signal', () => {
    const blocking = makeParty({ id: 'a', name: 'A' });
    const none = makeParty({ id: 'b', name: 'B' });
    const map = signals({
      a: { role: 'mj', status: 'A_VENIR', signals: ['AUCUN_MEMBRE_INVITE'] },
      b: { role: 'mj', status: 'A_VENIR', signals: [] },
    });

    const sorted = sortParties([none, blocking], 'urgence', map);

    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('urgence : PARTIE_TERMINEE (statut TERMINEE) toujours en dernier, même avec un signal bloquant coexistant', () => {
    const blocking = makeParty({ id: 'a', name: 'A', status: 'A_VENIR' });
    const finished = makeParty({ id: 'b', name: 'B', status: 'TERMINEE' });
    const map = signals({
      a: { role: 'mj', status: 'A_VENIR', signals: ['AUCUN_MEMBRE_INVITE'] },
      b: {
        role: 'mj',
        status: 'TERMINEE',
        signals: ['RAPPORT_FIN_MANQUANT', 'PARTIE_TERMINEE'],
      },
    });

    const sorted = sortParties([finished, blocking], 'urgence', map);

    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('urgence : une rencontre ANNULEE (Story 42.2) passe après toute partie active, comme une terminée', () => {
    const active = makeParty({ id: 'a', name: 'A', status: 'A_VENIR' });
    const cancelled = makeParty({ id: 'b', name: 'B', status: 'ANNULEE' });
    const map = signals({
      a: { role: 'mj', status: 'A_VENIR', signals: [] },
      b: { role: 'player', status: 'ANNULEE', signals: ['PARTIE_ANNULEE'] },
    });

    const sorted = sortParties([cancelled, active], 'urgence', map);

    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('urgence : une partie sans entrée dans signalsMap se comporte comme « aucun signal » (chargement pas encore résolu)', () => {
    const blocking = makeParty({ id: 'a', name: 'A' });
    const missing = makeParty({ id: 'b', name: 'B' });
    const map = signals({
      a: { role: 'mj', status: 'A_VENIR', signals: ['AUCUN_MEMBRE_INVITE'] },
    });

    const sorted = sortParties([missing, blocking], 'urgence', map);

    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('date : ordre croissant, une partie sans nextSessionDate toujours en dernier', () => {
    const later = makeParty({ id: 'a', nextSessionDate: '2026-09-01T00:00:00.000Z' });
    const sooner = makeParty({ id: 'b', nextSessionDate: '2026-08-01T00:00:00.000Z' });
    const none = makeParty({ id: 'c', nextSessionDate: null });

    const sorted = sortParties([later, none, sooner], 'date', new Map());

    expect(sorted.map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });

  it('nom : ordre alphabétique', () => {
    const zebre = makeParty({ id: 'a', name: 'Zebre' });
    const abbaye = makeParty({ id: 'b', name: 'Abbaye' });

    const sorted = sortParties([zebre, abbaye], 'nom', new Map());

    expect(sorted.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('type : rang explicite, indépendant des libellés (Campagne < Campagne épisodique < One-shot)', () => {
    const oneShot = makeParty({ id: 'a', kind: 'ONE_SHOT' });
    const campagne = makeParty({ id: 'b', kind: 'CAMPAGNE_LINEAIRE' });
    const episodique = makeParty({ id: 'c', kind: 'CAMPAGNE_EPISODIQUE' });

    const sorted = sortParties([oneShot, episodique, campagne], 'type', new Map());

    expect(sorted.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('statut : A_VENIR < EN_COURS < TERMINEE', () => {
    const termine = makeParty({ id: 'a', status: 'TERMINEE' });
    const enCours = makeParty({ id: 'b', status: 'EN_COURS' });
    const aVenir = makeParty({ id: 'c', status: 'A_VENIR' });

    const sorted = sortParties([termine, enCours, aVenir], 'statut', new Map());

    expect(sorted.map((p) => p.id)).toEqual(['c', 'b', 'a']);
  });

  it('ne mute jamais le tableau reçu en entrée', () => {
    const a = makeParty({ id: 'a', name: 'Zebre' });
    const b = makeParty({ id: 'b', name: 'Abbaye' });
    const input = [a, b];

    sortParties(input, 'nom', new Map());

    expect(input).toEqual([a, b]);
  });

  it('valeur hors union (Review Findings, défensif) : ne plante pas, renvoie une copie dans l’ordre d’origine', () => {
    const a = makeParty({ id: 'a', name: 'Zebre' });
    const b = makeParty({ id: 'b', name: 'Abbaye' });

    const sorted = sortParties([a, b], 'inconnu' as never, new Map());

    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('pinFavorites (Story 29.8, FR-11)', () => {
  it('place les favoris en tête, indépendamment de leur position d’origine', () => {
    const a = makeParty({ id: 'a', isFavorite: false });
    const b = makeParty({ id: 'b', isFavorite: true });
    const c = makeParty({ id: 'c', isFavorite: false });

    const pinned = pinFavorites([a, b, c]);

    expect(pinned.map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });

  it('conserve l’ordre relatif au sein des favoris et au sein des non-favoris (tri stable)', () => {
    const a = makeParty({ id: 'a', isFavorite: true });
    const b = makeParty({ id: 'b', isFavorite: false });
    const c = makeParty({ id: 'c', isFavorite: true });
    const d = makeParty({ id: 'd', isFavorite: false });

    const pinned = pinFavorites([a, b, c, d]);

    expect(pinned.map((p) => p.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('ne mute jamais le tableau reçu en entrée', () => {
    const a = makeParty({ id: 'a', isFavorite: false });
    const b = makeParty({ id: 'b', isFavorite: true });
    const input = [a, b];

    pinFavorites(input);

    expect(input).toEqual([a, b]);
  });
});
