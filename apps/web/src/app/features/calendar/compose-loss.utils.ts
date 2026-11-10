import type { DaySlot } from '@master-jdr/shared';

/** Une option d'un vote existant, telle que le composer la compare : son départ et le nombre de réponses qu'elle porte. */
export interface LossOption {
  /** Jour `AAAA-MM-JJ` (ou un ISO complet, dont seul le jour compte). */
  date: string;
  slot: DaySlot;
  answers: number;
}

/** Ce qu'une validation du composer coûte aux votants. */
export interface ComposeLoss {
  /** Réponses effacées par l'écriture. */
  answers: number;
  /** Créneaux retirés de la composition. */
  removed: number;
  /** La durée diffère de celle du rendez-vous : toutes les options sont recréées. */
  durationChanged: boolean;
}

/**
 * Story 47.4 — LA règle de l'avertissement de perte, pour le dialogue ET pour la revérification qui précède
 * l'écriture, en JDR comme pour un groupe : une durée différente de celle du rendez-vous visé efface TOUTES les
 * réponses (le serveur recrée toutes les options) ; à durée égale, seules les réponses des options retirées
 * partent. `keptKeys` : les créneaux composés, en clés `AAAA-MM-JJ|CRÉNEAU`.
 */
export function composeLoss(
  options: readonly LossOption[],
  keptKeys: ReadonlySet<string>,
  durationSlots: number,
  targetDurationSlots: number,
): ComposeLoss {
  const removed = options.filter((o) => !keptKeys.has(`${o.date.substring(0, 10)}|${o.slot}`));
  const durationChanged = durationSlots !== targetDurationSlots;
  const counted = durationChanged ? options : removed;
  return {
    answers: counted.reduce((sum, o) => sum + o.answers, 0),
    removed: removed.length,
    durationChanged,
  };
}
