import type { PartySignalCode } from '@master-jdr/shared';

/**
 * Ordre de priorité des 11 signaux (AC8, dont `RESERVATION_A_CONFIRMER` depuis la Story 40.4) — trois catégories déclarées par l'AC (« ce qui bloque
 * le démarrage », « ce qui a une échéance », « ce qui est en retard »), traduites ici en un ordre
 * total explicite (décision d'implémentation, aucune AC ne fournit cette table). `PARTIE_TERMINEE`
 * est hors catégorie et toujours prioritaire — une partie terminée reste en teinte « terminé »
 * même si un signal de fin (`RAPPORT_FIN_MANQUANT`) coexiste (AC8, cas explicite).
 * `PROCHAINE_SEANCE_CONNUE` est purement informatif (jamais une alerte) — placé en dernier, il ne
 * devient jamais le signal dominant tant qu'un autre signal est présent.
 */
const PRIORITY_ORDER: readonly PartySignalCode[] = [
  'PARTIE_TERMINEE',
  // Story 42.2 : une rencontre isolée annulée — hors catégorie, comme une terminée.
  'PARTIE_ANNULEE',
  // Bloque le démarrage.
  'AUCUN_MEMBRE_INVITE',
  'PERSONNAGE_A_CREER',
  'HOMME_DRAGON_A_CREER',
  'AUCUN_SCENARIO_EN_COURS',
  'AUCUNE_DATE_NI_VOTE',
  // A une échéance.
  'VOTE_EN_COURS_SANS_REPONSE',
  // Story 40.4 : une place réservée attend une réponse — même échéance que le vote, juste après lui.
  'RESERVATION_A_CONFIRMER',
  // En retard.
  'RAPPORT_FIN_MANQUANT',
  'COMPTE_RENDU_NON_REDIGE',
  // Informatif — jamais dominant s'il coexiste avec un autre signal.
  'PROCHAINE_SEANCE_CONNUE',
];

/** Le signal le plus prioritaire d'une partie, ou `null` si aucun signal actif. */
export function dominantSignal(signals: readonly PartySignalCode[]): PartySignalCode | null {
  for (const code of PRIORITY_ORDER) {
    if (signals.includes(code)) return code;
  }
  return null;
}

/** Les trois catégories de priorité de l'AC8 (« bloque le démarrage » / « a une échéance » /
 *  « en retard »), plus `informative` pour `PROCHAINE_SEANCE_CONNUE` (jamais une alerte).
 *  `PARTIE_TERMINEE` est hors catégorie (géré séparément par le statut, jamais via ce type). */
export type SignalCategory = 'blocking' | 'deadline' | 'overdue' | 'informative';

const SIGNAL_CATEGORIES: Partial<Record<PartySignalCode, SignalCategory>> = {
  AUCUN_MEMBRE_INVITE: 'blocking',
  PERSONNAGE_A_CREER: 'blocking',
  HOMME_DRAGON_A_CREER: 'blocking',
  AUCUN_SCENARIO_EN_COURS: 'blocking',
  AUCUNE_DATE_NI_VOTE: 'blocking',
  VOTE_EN_COURS_SANS_REPONSE: 'deadline',
  RESERVATION_A_CONFIRMER: 'deadline',
  RAPPORT_FIN_MANQUANT: 'overdue',
  COMPTE_RENDU_NON_REDIGE: 'overdue',
  PROCHAINE_SEANCE_CONNUE: 'informative',
};

/** Catégorie AC8 du signal dominant d'une partie, ou `null` si aucun signal actif ou si le
 *  dominant est `PARTIE_TERMINEE` (géré hors de ce type par le statut de la partie). */
export function dominantCategory(signals: readonly PartySignalCode[]): SignalCategory | null {
  const dominant = dominantSignal(signals);
  return dominant ? (SIGNAL_CATEGORIES[dominant] ?? null) : null;
}

/** Trie une liste de signaux du plus au moins prioritaire — utilisé pour choisir quels badges
 *  restent visibles quand il y en a plus de deux (AC3, `dominantSignal()` en tête). */
export function sortByPriority(signals: readonly PartySignalCode[]): PartySignalCode[] {
  return [...signals].sort((a, b) => PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b));
}
