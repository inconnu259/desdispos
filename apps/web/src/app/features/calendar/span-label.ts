import type { DaySlot } from '@master-jdr/shared';
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
