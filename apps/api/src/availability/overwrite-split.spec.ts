import type { DeclarationLike } from './availability.service';
import { remainderAfterOverwrite } from './overwrite-split';

// « Remplacer » découpe la déclaration remplacée : ce qui reste d'une existante une fois retiré ce que couvrent
// ses remplaçants. Lundi 2026-11-09, mercredi 2026-11-11.

const U = 'u1';
const EXPIRES = new Date('2027-03-01T00:00:00Z');
const d = (day: string) => new Date(`${day}T00:00:00Z`);

function punctual(over: Partial<DeclarationLike> & { from: string; to: string }): DeclarationLike {
  const { from, to, ...rest } = over;
  return {
    kind: 'AVAILABLE',
    recurKind: 'PUNCTUAL',
    dayOfWeek: null,
    slot: 'EVENING',
    startDate: d(from),
    endDate: d(to),
    expiresAt: new Date(d(to).getTime() + 86_399_999),
    ...rest,
  };
}

function recurring(over: Partial<DeclarationLike> = {}): DeclarationLike {
  return {
    kind: 'UNAVAILABLE',
    recurKind: 'RECURRING',
    dayOfWeek: 1,
    slot: 'EVENING',
    startDate: null,
    endDate: null,
    expiresAt: EXPIRES,
    ...over,
  };
}

/** Forme lisible d'une pièce : [slot, début, fin, type]. */
const shape = (pieces: ReturnType<typeof remainderAfterOverwrite>) =>
  pieces.map((p) => [
    p.slot,
    p.startDate?.toISOString().slice(0, 10) ?? null,
    p.endDate?.toISOString().slice(0, 10) ?? null,
    p.recurKind,
  ]);

describe('remainderAfterOverwrite', () => {
  it('ponctuelle de 3 jours, un jour remplacé au milieu → deux pièces de part et d’autre', () => {
    const pieces = remainderAfterOverwrite(U, punctual({ from: '2026-11-10', to: '2026-11-14' }), [
      punctual({ kind: 'UNAVAILABLE', from: '2026-11-12', to: '2026-11-12' }),
    ]);
    expect(shape(pieces)).toEqual([
      ['EVENING', '2026-11-10', '2026-11-11', 'PUNCTUAL'],
      ['EVENING', '2026-11-13', '2026-11-14', 'PUNCTUAL'],
    ]);
    // Chaque pièce garde la nature de l'existante et expire à la fin de son dernier jour.
    expect(pieces.every((p) => p.kind === 'AVAILABLE' && p.userId === U)).toBe(true);
    expect(pieces[0].expiresAt.toISOString()).toBe('2026-11-11T23:59:59.999Z');
  });

  it('remplacée entièrement → rien ne reste', () => {
    const pieces = remainderAfterOverwrite(U, punctual({ from: '2026-11-11', to: '2026-11-11' }), [
      punctual({ kind: 'UNAVAILABLE', from: '2026-11-10', to: '2026-11-12' }),
    ]);
    expect(pieces).toEqual([]);
  });

  it('récurrente du lundi, un lundi remplacé → la série avant et la série après, la dernière sans borne', () => {
    const pieces = remainderAfterOverwrite(U, recurring(), [
      punctual({ kind: 'AVAILABLE', from: '2026-11-16', to: '2026-11-16' }),
    ]);
    expect(shape(pieces)).toEqual([
      ['EVENING', null, '2026-11-15', 'RECURRING'],
      ['EVENING', '2026-11-17', null, 'RECURRING'],
    ]);
    expect(pieces.every((p) => p.dayOfWeek === 1 && p.expiresAt === EXPIRES)).toBe(true);
  });

  it('récurrente bornée dont la seule occurrence restante disparaît → pas de pièce vide', () => {
    // Lundis du 9 et du 16 seulement ; on remplace le 16 → reste la série jusqu'au 15 (lundi 9), et rien après.
    const pieces = remainderAfterOverwrite(
      U,
      recurring({ startDate: d('2026-11-09'), endDate: d('2026-11-18') }),
      [punctual({ kind: 'AVAILABLE', from: '2026-11-16', to: '2026-11-16' })],
    );
    expect(shape(pieces)).toEqual([['EVENING', '2026-11-09', '2026-11-15', 'RECURRING']]);
  });

  it('ponctuelle remplacée par une récurrente → seuls ses jours de la semaine disparaissent', () => {
    // Dispo du lundi 9 au dimanche 22 ; indispo récurrente le mercredi → retire le 11 et le 18.
    const pieces = remainderAfterOverwrite(U, punctual({ from: '2026-11-09', to: '2026-11-22' }), [
      recurring({ dayOfWeek: 3 }),
    ]);
    expect(shape(pieces)).toEqual([
      ['EVENING', '2026-11-09', '2026-11-10', 'PUNCTUAL'],
      ['EVENING', '2026-11-12', '2026-11-17', 'PUNCTUAL'],
      ['EVENING', '2026-11-19', '2026-11-22', 'PUNCTUAL'],
    ]);
  });

  it('journée entière remplacée sur un seul créneau → les deux autres créneaux du jour restent', () => {
    const pieces = remainderAfterOverwrite(
      U,
      punctual({ slot: 'FULL_DAY', from: '2026-11-10', to: '2026-11-12' }),
      [punctual({ kind: 'UNAVAILABLE', slot: 'AFTERNOON', from: '2026-11-11', to: '2026-11-11' })],
    );
    expect(shape(pieces)).toEqual([
      ['FULL_DAY', '2026-11-10', '2026-11-10', 'PUNCTUAL'],
      ['FULL_DAY', '2026-11-12', '2026-11-12', 'PUNCTUAL'],
      ['MORNING', '2026-11-11', '2026-11-11', 'PUNCTUAL'],
      ['EVENING', '2026-11-11', '2026-11-11', 'PUNCTUAL'],
    ]);
  });

  it('journée entière remplacée le même jour sur deux créneaux → seul le troisième reste ce jour-là', () => {
    const indispo = (slot: DeclarationLike['slot']) =>
      punctual({ kind: 'UNAVAILABLE', slot, from: '2026-11-11', to: '2026-11-11' });
    const pieces = remainderAfterOverwrite(
      U,
      punctual({ slot: 'FULL_DAY', from: '2026-11-11', to: '2026-11-11' }),
      [indispo('AFTERNOON'), indispo('EVENING')],
    );
    expect(shape(pieces)).toEqual([['MORNING', '2026-11-11', '2026-11-11', 'PUNCTUAL']]);
  });

  it('un créneau remplacé par une journée entière → ce jour disparaît', () => {
    const pieces = remainderAfterOverwrite(U, punctual({ from: '2026-11-10', to: '2026-11-11' }), [
      punctual({ kind: 'UNAVAILABLE', slot: 'FULL_DAY', from: '2026-11-11', to: '2026-11-11' }),
    ]);
    expect(shape(pieces)).toEqual([['EVENING', '2026-11-10', '2026-11-10', 'PUNCTUAL']]);
  });

  it('un remplaçant qui ne la contredit pas (même nature, autre créneau) ne retire rien', () => {
    const existing = punctual({ from: '2026-11-10', to: '2026-11-11' });
    const pieces = remainderAfterOverwrite(U, existing, [
      punctual({ kind: 'AVAILABLE', from: '2026-11-11', to: '2026-11-11' }),
      punctual({ kind: 'UNAVAILABLE', slot: 'MORNING', from: '2026-11-11', to: '2026-11-11' }),
    ]);
    expect(shape(pieces)).toEqual([['EVENING', '2026-11-10', '2026-11-11', 'PUNCTUAL']]);
  });
});
