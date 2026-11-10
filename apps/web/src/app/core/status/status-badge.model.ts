import type { DaySlot } from '@master-jdr/shared';

/**
 * Story 32.3 — **la** source unique des teintes de statut et des seuils d'imminence.
 *
 * Ce module ne fait que DÉPLACER ce que la story 36.11 avait arbitré dans
 * `features/calendar/agenda-badge.utils.ts` : les deux types, la table des créneaux adverbiaux, les
 * paliers et les libellés humains. Pas une virgule n'a changé — `agenda-badge.utils.ts` réimporte
 * et réexporte ces symboles, donc la vue Agenda garde exactement le même comportement.
 *
 * 🚨 **Ce qui n'a PAS été déplacé, et pourquoi.** `badgeFor()` et `sectionIdFor()` raisonnent sur
 * `AgendaEntry` — une forme propre à l'Agenda, qui ne décrit ni un scénario ni une `SeanceDto`.
 * Les généraliser aurait demandé d'inventer un type pivot que personne ne demande.
 */

/** Teintes de la palette de statut (`--jdr-status-*`, `styles.scss`). Jamais une couleur en dur. */
/** Story 42.1 : `cancelled` est le rouge de l'« annulé » (DESIGN.md §2, `--color-unavailable`) — il ne vaut JAMAIS
 *  seul : le badge d'une conjonction annulée écrit toujours « Annulée ». */
export type BadgeTone = 'todo' | 'live' | 'soon' | 'done' | 'cancelled';

/** L'imminence est une **intensité**, jamais un état ni une cinquième couleur : la séance garde
 *  `status-soon` et le badge se densifie. [Source: DESIGN.md §7.1] */
export type BadgeIntensity = 'far' | 'near' | 'imminent';

/** Forme adverbiale du créneau, pour les libellés humains d'imminence (« ce soir », « demain
 *  matin »). `FULL_DAY` et l'absence de créneau n'en portent aucune : « aujourd'hui » suffit. */
export const SLOT_WHEN: Record<DaySlot, { today: string; tomorrow: string } | null> = {
  MORNING: { today: 'ce matin', tomorrow: 'demain matin' },
  AFTERNOON: { today: 'cet après-midi', tomorrow: 'demain après-midi' },
  EVENING: { today: 'ce soir', tomorrow: 'demain soir' },
  FULL_DAY: null,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Découpe une clé `YYYY-MM-DD` en instant UTC.
 *
 * 🚨 On **n'utilise jamais `new Date(dateKey)` implicitement pour comparer des jours** : ici les
 * trois nombres sont extraits à la main et recomposés en UTC, donc l'arithmétique est exacte et
 * ne peut pas dériver d'un jour selon le fuseau. L'incohérence UTC/local du projet est une dette
 * connue (`deferred-work.md`) ; ces fonctions n'y ajoutent rien parce qu'elles ne raisonnent que
 * sur des clés, jamais sur des instants. */
function keyToUtcMs(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Nombre de jours entiers de `fromKey` à `toKey`. Négatif si `toKey` est dans le passé. */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return Math.round((keyToUtcMs(toKey) - keyToUtcMs(fromKey)) / MS_PER_DAY);
}

/** Décale une clé de N jours et rend une clé. Utilitaire de test, et de tout ce qui a besoin de
 *  raisonner en jours sans quitter le vocabulaire des clés. */
export function addDaysToKey(dateKey: string, days: number): string {
  return new Date(keyToUtcMs(dateKey) + days * MS_PER_DAY).toISOString().substring(0, 10);
}

/** Le palier d'imminence d'une échéance. [Source: DESIGN.md §7.1, table des trois paliers] */
export function imminenceIntensity(dateKey: string, todayKey: string): BadgeIntensity {
  const days = daysBetweenKeys(todayKey, dateKey);
  if (days <= 1) return 'imminent';
  if (days <= 7) return 'near';
  return 'far';
}

/**
 * Le décompte affiché sur le badge d'une séance programmée.
 *
 * 🚨 **Au dernier palier le libellé est humain** — « ce soir », « demain soir » — **jamais
 * « J-1 »** [Source: EXPERIENCE.md §3]. Au-delà, un décompte : en jours jusqu'à deux semaines,
 * puis en semaines, comme la planche contractuelle (« dans 5 j », « dans 3 sem. »).
 */
export function imminenceLabel(
  dateKey: string,
  slot: DaySlot | undefined,
  todayKey: string,
): string {
  const days = daysBetweenKeys(todayKey, dateKey);
  const when = slot ? SLOT_WHEN[slot] : null;
  if (days <= 0) return when ? when.today : "aujourd'hui";
  if (days === 1) return when ? when.tomorrow : 'demain';
  if (days < 14) return `dans ${days} j`;
  // Revue de code 36.11 — `Math.floor`, pas `Math.round` : avec l'arrondi, la transition « 2
  // sem. » → « 3 sem. » avait lieu au jour 18 (17,5 arrondi au-dessus) plutôt qu'au jour 21
  // attendu d'une granularité « semaines », survalorisant l'imminence de 3 jours.
  return `dans ${Math.floor(days / 7)} sem.`;
}
