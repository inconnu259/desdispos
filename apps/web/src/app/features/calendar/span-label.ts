import { spanEnd, type DaySlot } from '@master-jdr/shared';
import { SLOT_LABELS } from './agenda-badge.utils';

/**
 * Story 47.3 (FR-20) — l'écriture d'une plage de plusieurs créneaux. Fonctions pures, sans Angular : la
 * grille, l'Agenda, le rail, la carte d'événement et la fiche de scénario passent toutes par ici, pour que
 * la plage ne se dise jamais de deux façons.
 */

/** Un bout de plage : le jour (`YYYY-MM-DD`) et, quand il existe, son créneau. */
export interface SpanPoint {
  date: string;
  slot: DaySlot | null | undefined;
}

/** « ven. 6 nov. » — écrit ici (et non importé d'`event-card.util`) pour que ce module n'entre dans aucun cycle. */
function shortDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

const slotWord = (slot: DaySlot | null | undefined): string =>
  slot ? SLOT_LABELS[slot].toLocaleLowerCase('fr-FR') : '';

/** Vrai quand la fin diffère du début (un autre jour, ou un autre créneau) : un créneau seul n'est pas une plage. */
export function isSpan(start: SpanPoint, end: SpanPoint | null | undefined): end is SpanPoint {
  if (!end || !end.date) return false;
  // Une fin AVANT le début est une donnée incohérente : jamais une plage (elle ne se dessine pas à l'envers).
  if (end.date < start.date) return false;
  // Un créneau absent vaut la journée entière — la même lecture que partout dans le calendrier.
  const startSlot = start.slot ?? 'FULL_DAY';
  if (end.date === start.date) {
    const endSlot = end.slot ?? startSlot;
    return endSlot !== startSlot && SLOT_RANK[endSlot] > SLOT_RANK[startSlot];
  }
  return true;
}

/** Ordre des créneaux d'un jour ; la journée entière précède tout (elle commence avec le matin). */
const SLOT_RANK: Record<DaySlot, number> = { FULL_DAY: 0, MORNING: 1, AFTERNOON: 2, EVENING: 3 };

/** « ven. 6 nov. soir → dim. 8 nov. après-midi » — la forme courte, pour une ligne d'Agenda ou de carte. */
export function spanShortLabel(start: SpanPoint, end: SpanPoint): string {
  const side = (p: SpanPoint) => [shortDay(p.date), slotWord(p.slot)].filter(Boolean).join(' ');
  return `${side(start)} → ${side(end)}`;
}

const dayMonth = (key: string, withMonth: boolean): string => {
  const [y, m, d] = key.split('-').map(Number);
  const text = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    ...(withMonth ? { month: 'long' } : {}),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
  // Le premier du mois s'écrit « 1er » en français (« dimanche 1er novembre »).
  return d === 1 ? text.replace(/\b1\b/, '1er') : text;
};

/**
 * « du vendredi 6 soir au dimanche 8 après-midi » — la phrase du nom accessible. Le mois n'est écrit que
 * s'il diffère d'un bout à l'autre (« du vendredi 31 octobre soir au dimanche 2 novembre après-midi »).
 */
export function spanSentence(start: SpanPoint, end: SpanPoint): string {
  const withMonth = start.date.substring(0, 7) !== end.date.substring(0, 7);
  const side = (p: SpanPoint) =>
    [dayMonth(p.date, withMonth), slotWord(p.slot)].filter(Boolean).join(' ');
  return `du ${side(start)} au ${side(end)}`;
}

/** « (suite) » — écrit après le nom d'une plage sur les jours qui suivent le premier (rail). Mot fonctionnel,
 *  identique dans les trois thèmes (UX-DR14), donc hors du registre des tons. */
export const SPAN_CONTINUED = '(suite)';

/**
 * Story 47.5 (FR-20) — la fin d'un créneau candidat de `durationSlots` créneaux, ou `null` pour un créneau seul
 * (durée 1, journée entière, durée incohérente). Seul passage par `spanEnd` (`@master-jdr/shared`) des libellés de
 * candidats : la plage d'un vote se dit partout de la même façon, jamais recalculée à la main.
 */
function candidateEnd(
  option: { date: string; slot: DaySlot },
  durationSlots: number,
): SpanPoint | null {
  if (!Number.isInteger(durationSlots) || durationSlots <= 1 || option.slot === 'FULL_DAY') {
    return null;
  }
  const day = option.date.substring(0, 10);
  const end = spanEnd(day, option.slot, durationSlots);
  return { date: end.date, slot: end.slot };
}

/** « ven. 6 nov. soir → dim. 8 nov. après-midi » pour un candidat de plusieurs créneaux, `null` pour un créneau seul. */
export function candidateSpanShort(
  option: { date: string; slot: DaySlot },
  durationSlots: number,
): string | null {
  const end = candidateEnd(option, durationSlots);
  return end
    ? spanShortLabel({ date: option.date.substring(0, 10), slot: option.slot }, end)
    : null;
}

/** « du vendredi 6 soir au dimanche 8 après-midi » pour un candidat de plusieurs créneaux, `null` pour un seul. */
export function candidateSpanSentence(
  option: { date: string; slot: DaySlot },
  durationSlots: number,
): string | null {
  const end = candidateEnd(option, durationSlots);
  return end
    ? spanSentence({ date: option.date.substring(0, 10), slot: option.slot }, end)
    : null;
}

/** « ven. 6 soir → dim. 8 après-midi » — la forme compacte (sans mois) des lignes du sélecteur de réponse. */
export function spanCompactLabel(start: SpanPoint, end: SpanPoint): string {
  const side = (p: SpanPoint) => {
    const [y, m, d] = p.date.split('-').map(Number);
    const day = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, d)));
    return [day, slotWord(p.slot)].filter(Boolean).join(' ');
  };
  return `${side(start)} → ${side(end)}`;
}

/** Story 47.5 — l'entrée de calendrier (option de vote ou séance) écrite « début → fin » si c'est une plage, sinon
 *  `null` : le créneau seul garde l'écriture de chaque surface. */
export function entrySpanShortLabel(entry: {
  date: string;
  slot?: DaySlot | null;
  endDate?: string;
  endSlot?: DaySlot | null;
}): string | null {
  const start = { date: entry.date, slot: entry.slot };
  const end = entry.endDate ? { date: entry.endDate, slot: entry.endSlot } : null;
  return end && isSpan(start, end) ? spanShortLabel(start, end) : null;
}
