import type { AvailabilityCreateData, DeclarationLike } from './availability.service';

/**
 * « Remplacer » (résolution `overwrite`) : ce qui RESTE d'une déclaration existante une fois retiré ce que
 * couvrent les nouvelles déclarations qui la remplacent. Calcul PUR : ne lit ni n'écrit rien.
 *
 * Avant, « Remplacer » expirait la déclaration existante ENTIÈRE : remplacer le mercredi 11 d'une dispo du 11
 * au 13 effaçait aussi le 12 et le 13, et remplacer un lundi d'une récurrente effaçait tous les lundis — alors
 * que le dialogue ne nomme que le créneau visé. L'appelant expire toujours l'existante, puis crée les pièces
 * rendues ici :
 * - une ponctuelle est découpée en jours (ses jours couverts par un remplaçant disparaissent) ;
 * - une récurrente est découpée en séries (ses occurrences couvertes disparaissent) ;
 * - une existante `FULL_DAY` remplacée sur un seul créneau garde, sur les jours touchés, ses autres créneaux.
 *
 * `overwriters` regroupe TOUS les remplaçants de cette déclaration (un lot peut en remplacer plusieurs jours
 * à la fois) : découper une fois par remplaçant recréerait les jours retirés par les autres.
 */
export function remainderAfterOverwrite(
  userId: string,
  existing: DeclarationLike,
  overwriters: DeclarationLike[],
): AvailabilityCreateData[] {
  const span = spanOf(existing);
  if (span.start > span.end) return [];
  const conflicting = overwriters.filter(
    (n) => n.kind !== existing.kind && slotsOverlap(existing.slot, n.slot),
  );

  const holesCovering = (slot: DaySlot) =>
    conflicting
      .filter((n) => n.slot === 'FULL_DAY' || n.slot === slot)
      .flatMap((n) => holesOf(existing, n, span));

  if (existing.slot !== 'FULL_DAY') {
    return subtract([span], holesCovering(existing.slot))
      .map((i) => toData(userId, existing, existing.slot, i, span))
      .filter((d): d is AvailabilityCreateData => d !== null);
  }

  // `FULL_DAY` : là où aucun remplaçant ne passe, la journée entière reste ; là où un remplaçant ne prend
  // qu'un créneau, les autres créneaux restent, chacun pour soi.
  const allHoles = conflicting.flatMap((n) => holesOf(existing, n, span));
  const pieces: Array<AvailabilityCreateData | null> = subtract([span], allHoles).map((i) =>
    toData(userId, existing, 'FULL_DAY', i, span),
  );
  for (const slot of SLOTS) {
    for (const i of subtract(union(allHoles), holesCovering(slot))) {
      pieces.push(toData(userId, existing, slot, i, span));
    }
  }
  return pieces.filter((d): d is AvailabilityCreateData => d !== null);
}

type DaySlot = DeclarationLike['slot'];
const SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'] as const;
const MS_DAY = 86_400_000;

/** Intervalle de jours (minuit UTC, en ms), bornes INCLUSES ; `-Infinity` = sans début. */
interface Interval {
  start: number;
  end: number;
}

function floorDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function slotsOverlap(a: DaySlot, b: DaySlot): boolean {
  return a === 'FULL_DAY' || b === 'FULL_DAY' || a === b;
}

/** Jours sur lesquels une déclaration s'applique, comme les lit `matchesDeclaration` : une ponctuelle de son
 *  début à sa fin, une récurrente de son début (ou toujours) à `min(endDate, expiresAt)`. */
function spanOf(d: DeclarationLike): Interval {
  if (d.recurKind === 'PUNCTUAL') {
    return { start: floorDay(d.startDate!), end: floorDay(d.endDate!) };
  }
  const end = d.endDate && d.endDate < d.expiresAt ? d.endDate : d.expiresAt;
  return { start: d.startDate ? floorDay(d.startDate) : -Infinity, end: floorDay(end) };
}

function intersect(a: Interval, b: Interval): Interval | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return start <= end ? { start, end } : null;
}

/** Les jours de la semaine `weekday` (0 = dimanche) dans un intervalle fini. */
function occurrences(i: Interval, weekday: number): number[] {
  const days: number[] = [];
  let d = i.start + ((weekday - new Date(i.start).getUTCDay() + 7) % 7) * MS_DAY;
  for (; d <= i.end; d += 7 * MS_DAY) days.push(d);
  return days;
}

/** Ce que le remplaçant `n` retire de la période de `existing`, en jours. Contre une ponctuelle, un remplaçant
 *  récurrent ne retire que ses propres jours de la semaine ; contre une récurrente, retirer un intervalle
 *  supprime les occurrences qu'il contient (les autres jours n'en portaient pas). */
function holesOf(existing: DeclarationLike, n: DeclarationLike, span: Interval): Interval[] {
  if (existing.recurKind === 'RECURRING' && n.recurKind === 'RECURRING') {
    if (existing.dayOfWeek !== n.dayOfWeek) return [];
  }
  const inter = intersect(span, spanOf(n));
  if (!inter) return [];
  if (existing.recurKind === 'PUNCTUAL' && n.recurKind === 'RECURRING') {
    return occurrences(inter, n.dayOfWeek!).map((d) => ({ start: d, end: d }));
  }
  return [inter];
}

/** Fusionne des intervalles qui se chevauchent ou se touchent (jours consécutifs). */
function union(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const i of sorted) {
    const last = merged[merged.length - 1];
    if (last && i.start <= last.end + MS_DAY) last.end = Math.max(last.end, i.end);
    else merged.push({ ...i });
  }
  return merged;
}

/** `base` privé de `cuts`. */
function subtract(base: Interval[], cuts: Interval[]): Interval[] {
  const merged = union(cuts);
  const result: Interval[] = [];
  for (const b of base) {
    let start = b.start;
    for (const c of merged) {
      if (c.end < start || c.start > b.end) continue;
      if (c.start > start) result.push({ start, end: c.start - MS_DAY });
      start = c.end + MS_DAY;
    }
    if (start <= b.end) result.push({ start, end: b.end });
  }
  return result;
}

/** Une pièce restante, sous la forme de l'existante (même nature, même type, même jour de la semaine). Une
 *  pièce récurrente qui ne contient plus aucune occurrence n'est pas créée. */
function toData(
  userId: string,
  existing: DeclarationLike,
  slot: DaySlot,
  i: Interval,
  span: Interval,
): AvailabilityCreateData | null {
  if (existing.recurKind === 'PUNCTUAL') {
    return {
      userId,
      kind: existing.kind,
      recurKind: 'PUNCTUAL',
      dayOfWeek: null,
      slot,
      startDate: new Date(i.start),
      endDate: new Date(i.end),
      expiresAt: new Date(Math.min(existing.expiresAt.getTime(), i.end + MS_DAY - 1)),
    };
  }
  if (Number.isFinite(i.start) && occurrences(i, existing.dayOfWeek!).length === 0) return null;
  return {
    userId,
    kind: existing.kind,
    recurKind: 'RECURRING',
    dayOfWeek: existing.dayOfWeek,
    slot,
    startDate: Number.isFinite(i.start) ? new Date(i.start) : null,
    // La dernière pièce garde la borne de l'existante (souvent nulle : la série court jusqu'à `expiresAt`).
    endDate: i.end === span.end && !existing.endDate ? null : new Date(i.end),
    expiresAt: existing.expiresAt,
  };
}
