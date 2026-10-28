import { spanEnd, type DaySlot } from '@master-jdr/shared';
import { SLOT_LABELS } from '../../features/calendar/agenda-badge.utils';
import { shortDayLabel } from '../../features/events/event-card.util';

/**
 * Story 47.1 (UX-DR14) — les mots de la durée d'un rendez-vous sont fonctionnels et identiques dans les
 * trois thèmes, sans mot du JDR ni « partie » (le compteur sert aussi les soirées). Ils vivent ici,
 * hors du registre des tons : dix clés neutres de plus feraient passer le thème Atelier sous la part de
 * vocabulaire propre que garde `theme-tone.service.spec.ts`.
 */
export const DURATION_TEXT = {
  label: 'Durée',
  shorten: 'Raccourcir',
  lengthen: 'Allonger',
  /** Le plafond de 15 jours, mot pour mot celui du serveur. */
  max: '15 jours au plus : au-delà, créez deux rendez-vous.',
  /** Rendez-vous au vote ouvert et sans date : la durée se lit ici, se règle dans le composer. */
  pollPending: 'La durée se règle dans le composer de dates tant que le vote est ouvert.',
  /** Story 47.4 — changer la durée d'un vote recrée toutes ses options : le nombre de réponses perdues. */
  lossMany: 'Changer la durée efface les {n} réponses déjà données.',
  lossOne: 'Changer la durée efface la réponse déjà donnée.',
  /** Story 47.4 — au-delà d'un créneau, une journée entière désignée quitte la composition. */
  fullDayRemoved:
    'Une journée entière ne dure qu’un créneau : les journées désignées sont retirées.',
  /** Story 47.4 — au-delà d'un créneau, une journée entière ne se désigne pas. */
  fullDayRefused:
    'Une journée entière ne dure qu’un créneau : choisissez un matin, un après-midi ou un soir.',
  /** Story 47.5 — plusieurs plages d'un même vote se superposent sur un créneau : la marque « ×2 » du coin. */
  overlapMark: '×{n}',
  /** Story 47.5 — le nom accessible de cette marque (la bande se lit sans la voir). */
  overlapAria: '{n} plages se superposent (×{n})',
  /** Story 47.5 — l'annonce du créneau courant du tableau de vote quand le candidat est une plage. */
  announceSpan: 'Créneau {n} sur {total}, {range}, {yes}',
  /** Story 47.5 — le pire nombre de disponibles d'une plage candidate, sur la carte du tableau de vote. */
  worstAvailability: '{n} dispos sur toute la plage',
  worstAvailabilityOne: '{n} dispo sur toute la plage',
  /** Story 47.6 — une fenêtre de l'automate d'une autre durée que le rendez-vous composé ne s'y ajoute pas. */
  windowDurationMismatch: 'Cette fenêtre ne dure pas {n} créneaux : elle n’a pas été ajoutée.',
  windowDurationMismatchOne: 'Cette fenêtre ne dure pas 1 créneau : elle n’a pas été ajoutée.',
} as const;

/** Story 47.6 — « Cette fenêtre ne dure pas 2 créneaux : elle n'a pas été ajoutée. » */
export function windowDurationRefusal(durationSlots: number): string {
  return durationSlots === 1
    ? DURATION_TEXT.windowDurationMismatchOne
    : DURATION_TEXT.windowDurationMismatch.replace('{n}', String(durationSlots));
}

/** Story 47.5 — « ×2 ». */
export function overlapMarkLabel(n: number): string {
  return DURATION_TEXT.overlapMark.replace('{n}', String(n));
}

/** Story 47.5 — « 2 plages se superposent (×2) ». */
export function overlapAriaLabel(n: number): string {
  return DURATION_TEXT.overlapAria.replaceAll('{n}', String(n));
}

/** Story 47.5 — « 2 dispos sur toute la plage » (« 1 dispo … » au singulier ; 0 s'écrit « 0 dispo »). */
export function worstAvailabilityLabel(n: number): string {
  return (n > 1 ? DURATION_TEXT.worstAvailability : DURATION_TEXT.worstAvailabilityOne).replace(
    '{n}',
    String(n),
  );
}

/** Story 47.4 — « Changer la durée efface les 4 réponses déjà données. » */
export function durationLossLabel(answers: number): string {
  return answers === 1
    ? DURATION_TEXT.lossOne
    : DURATION_TEXT.lossMany.replace('{n}', String(answers));
}

/** Un départ de plage : clé de jour `AAAA-MM-JJ` et créneau. */
export interface SpanStart {
  date: string;
  slot: DaySlot;
}

/** « 1 créneau » / « 3 créneaux ». */
export function durationSlotsLabel(slots: number): string {
  return slots === 1 ? '1 créneau' : `${slots} créneaux`;
}

/** « soit 1 jour » / « soit 3 jours » : la longueur en jours, arrondie au jour entamé. */
export function durationDaysLabel(slots: number): string {
  const days = Math.ceil(slots / 3);
  return days === 1 ? 'soit 1 jour' : `soit ${days} jours`;
}

function slotOfDay(day: string, slot: DaySlot): string {
  return `${shortDayLabel(day, false)} ${SLOT_LABELS[slot].toLocaleLowerCase('fr-FR')}`;
}

/** « sam. 14 après-midi → sam. 14 soir » : la plage écrite en clair depuis son départ (« sam. 14 soir » pour
 *  un seul créneau). */
export function durationRangeLabel(start: SpanStart, slots: number): string {
  // Un seul créneau : le départ suffit, une plage « soir → soir » n’apprendrait rien.
  if (slots === 1) return slotOfDay(start.date, start.slot);
  const end = spanEnd(start.date, start.slot, slots);
  return `${slotOfDay(start.date, start.slot)} → ${slotOfDay(end.date, end.slot)}`;
}

/**
 * Ce que le compteur écrit sous la durée : la plage en clair si le départ est connu, sinon « soit N
 * jours » dès 3 créneaux, sinon rien. Une durée que la plage ne supporte pas (journée entière au-delà
 * d'un créneau) n'écrit pas de plage.
 */
export function durationDetail(slots: number, start: SpanStart | null): string {
  if (start && !(start.slot === 'FULL_DAY' && slots > 1)) return durationRangeLabel(start, slots);
  return slots >= 3 ? durationDaysLabel(slots) : '';
}
