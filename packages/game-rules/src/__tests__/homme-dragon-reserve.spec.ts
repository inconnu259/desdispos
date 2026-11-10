import { describe, it, expect } from 'vitest';
import {
  reserveCapacity,
  reserveSouffleKind,
  reservePlacement,
  reservePlacements,
  validateReserve,
  RESERVE_REASON_TEMPS,
  RESERVE_REASON_QUOTA_AUTRE_RACE,
  RESERVE_REASON_RITUEL,
  RESERVE_REASON_AUTRE_RACE_NIVEAU,
} from '../ryuutama/homme-dragon-reserve';
import type { ReserveCatalogs } from '../ryuutama/homme-dragon-reserve';

const CATALOGS: ReserveCatalogs = {
  souffles: [
    { key: 'passe', data: { label: 'Passé', famille: 'temps', reservable: false } },
    { key: 'chance', data: { label: 'Chance', famille: 'destin' } },
    { key: 'fuite', data: { label: 'Fuite', famille: 'pnj' } },
    { key: 'courage', data: { label: 'Courage', race: 'DRAGON_ROUGE' } },
    { key: 'defi', data: { label: 'Défi', race: 'DRAGON_ROUGE' } },
    { key: 'nostalgie', data: { label: 'Nostalgie', race: 'DRAGON_VERT' } },
    { key: 'amour', data: { label: 'Amour', race: 'DRAGON_BLEU' } },
  ],
  rituels: [{ key: 'rituel-du-tabou', data: { label: 'Rituel du tabou' } }],
};

describe('reserveCapacity', () => {
  it.each([
    [1, 0],
    [2, 1],
    [3, 2],
    [5, 4],
    [0, 0],
    [-3, 0],
  ])('niveau %i : %i emplacement(s)', (level, expected) => {
    expect(reserveCapacity(level)).toBe(expected);
  });
});

describe('reserveSouffleKind', () => {
  it('classe commun / temps / race / autre race / rituel / inconnu', () => {
    const kind = (k: string) => reserveSouffleKind(k, 'DRAGON_ROUGE', CATALOGS);
    expect(kind('chance')).toBe('commun');
    expect(kind('passe')).toBe('temps');
    expect(kind('courage')).toBe('race');
    expect(kind('nostalgie')).toBe('autre-race');
    expect(kind('rituel-du-tabou')).toBe('rituel');
    expect(kind('n-importe-quoi')).toBe('inconnu');
  });
});

describe('reservePlacement', () => {
  const place = (key: string, slot: number, reserve: (string | null)[], level: number) =>
    reservePlacement(key, slot, reserve, level, 'DRAGON_ROUGE', CATALOGS);

  it('souffle du temps : jamais placeable', () => {
    const p = place('passe', 0, [], 5);
    expect(p.placeable).toBe(false);
    expect(p.reason).toBe(RESERVE_REASON_TEMPS);
  });

  it('commun et de la race : placeables, même plusieurs fois (repère « déjà dans »)', () => {
    const p = place('courage', 1, ['courage', null], 3);
    expect(p.placeable).toBe(true);
    expect(p.reason).toBeNull();
    expect(p.placedIn).toEqual([1]);
    expect(place('chance', 0, [], 2).placedIn).toEqual([]);
  });

  it("le repère ignore l'emplacement visé lui-même", () => {
    expect(place('chance', 0, ['chance'], 2).placedIn).toEqual([]);
  });

  it('autre race : refusée au niveau 2, avec sa raison écrite', () => {
    const p = place('nostalgie', 0, [], 2);
    expect(p.placeable).toBe(false);
    expect(p.reason).toBe(RESERVE_REASON_AUTRE_RACE_NIVEAU);
  });

  it('autre race au niveau 3 : placeable tant que le quota est libre', () => {
    expect(place('nostalgie', 0, [null, null], 3).placeable).toBe(true);
  });

  it('autre race : quota atteint par un autre souffle -> « Un seul souffle d’une autre race »', () => {
    const p = place('amour', 1, ['nostalgie', null], 3);
    expect(p.placeable).toBe(false);
    expect(p.reason).toBe(RESERVE_REASON_QUOTA_AUTRE_RACE);
  });

  it('autre race : le même souffle ne se place pas deux fois -> « Déjà dans l’emplacement N »', () => {
    const p = place('nostalgie', 1, ['nostalgie', null], 3);
    expect(p.placeable).toBe(false);
    expect(p.reason).toBe("Déjà dans l'emplacement 1");
    expect(p.placedIn).toEqual([1]);
  });

  it("autre race : l'emplacement qui la contient reste modifiable (quota hors emplacement visé)", () => {
    expect(place('amour', 0, ['nostalgie', 'chance'], 3).placeable).toBe(true);
    expect(place('nostalgie', 0, ['nostalgie', 'chance'], 3).placeable).toBe(true);
  });

  it('rituel : refusé avant le niveau 5, jamais compté « autre race »', () => {
    const p4 = place('rituel-du-tabou', 0, [], 4);
    expect(p4.placeable).toBe(false);
    expect(p4.reason).toBe(RESERVE_REASON_RITUEL);

    const p5 = place('rituel-du-tabou', 1, ['nostalgie', null, null, null], 5);
    expect(p5.placeable).toBe(true);
  });

  it('rituel placé : ne bloque pas une autre race', () => {
    expect(place('nostalgie', 1, ['rituel-du-tabou', null, null, null], 5).placeable).toBe(true);
  });

  it('clé inconnue : non placeable', () => {
    expect(place('fantome', 0, [], 5).placeable).toBe(false);
  });

  it('reservePlacements : un résultat par clé', () => {
    const all = reservePlacements(['passe', 'chance'], 0, [], 2, 'DRAGON_ROUGE', CATALOGS);
    expect(Object.keys(all)).toEqual(['passe', 'chance']);
    expect(all['passe'].placeable).toBe(false);
    expect(all['chance'].placeable).toBe(true);
  });
});

describe('validateReserve', () => {
  const validate = (reserve: (string | null)[], level: number, previous: (string | null)[] = []) =>
    validateReserve(reserve, level, 'DRAGON_ROUGE', CATALOGS, previous);

  it('réserve vide ou emplacements vides : valide, même au niveau 1', () => {
    expect(validate([], 1).valid).toBe(true);
    expect(validate([null, null], 3).valid).toBe(true);
  });

  it('niveau 1 : toute écriture refusée (capacité 0)', () => {
    const r = validate(['chance'], 1);
    expect(r.valid).toBe(false);
    expect(r.errors[0].field).toBe('reserve[0]');
  });

  it('capacité : un emplacement au-delà de niveau − 1 est refusé', () => {
    expect(validate(['chance', 'chance'], 2).valid).toBe(false);
    expect(validate(['chance', 'chance'], 3).valid).toBe(true);
  });

  it('souffle du temps refusé', () => {
    const r = validate(['passe'], 4);
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toBe(RESERVE_REASON_TEMPS);
  });

  it('un souffle commun ou de la race peut occuper plusieurs emplacements', () => {
    expect(validate(['chance', 'chance', 'courage', 'courage'], 5).valid).toBe(true);
  });

  it('autre race interdite avant le niveau 3', () => {
    const r = validate(['nostalgie'], 2);
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toBe(RESERVE_REASON_AUTRE_RACE_NIVEAU);
  });

  it("autre race : un seul souffle, sur un seul emplacement, dès le niveau 3", () => {
    expect(validate(['nostalgie', 'chance'], 3).valid).toBe(true);
    const deux = validate(['nostalgie', 'amour'], 3);
    expect(deux.valid).toBe(false);
    expect(deux.errors.some((e) => e.message === RESERVE_REASON_QUOTA_AUTRE_RACE)).toBe(true);
    expect(validate(['nostalgie', 'nostalgie'], 3).valid).toBe(false);
  });

  it('rituel : refusé au niveau 4, admis au niveau 5 sans compter « autre race »', () => {
    const r4 = validate(['rituel-du-tabou'], 4);
    expect(r4.valid).toBe(false);
    expect(r4.errors[0].message).toBe(RESERVE_REASON_RITUEL);
    expect(validate(['rituel-du-tabou', 'rituel-du-tabou', 'nostalgie'], 5).valid).toBe(true);
  });

  it('clé inconnue : refusée si nouvellement placée', () => {
    expect(validate(['fantome'], 3).valid).toBe(false);
  });

  it('clé inconnue déjà présente : tolérée (lisible, retirable)', () => {
    expect(validate(['fantome', 'chance'], 3, ['fantome', null]).valid).toBe(true);
    expect(validate(['fantome', null], 3, ['fantome', null]).valid).toBe(true);
  });

  it('surplus après baisse de niveau : toléré tant qu’il est inchangé, aucune purge', () => {
    const previous = ['chance', 'chance', 'courage'];
    expect(validate(['chance', 'chance', 'courage'], 2, previous).valid).toBe(true);
    // Retirer un souffle du surplus reste possible.
    expect(validate(['chance', 'chance', null], 2, previous).valid).toBe(true);
    // Mais rien de nouveau au-delà de la capacité.
    expect(validate(['chance', 'chance', 'fuite'], 2, previous).valid).toBe(false);
  });

  it('un rituel déjà présent reste toléré si le niveau a baissé', () => {
    expect(validate(['rituel-du-tabou'], 4, ['rituel-du-tabou']).valid).toBe(true);
  });
});
