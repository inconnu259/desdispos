import type { HommeDragonRace } from '@master-jdr/shared';

/** Les 4 races, dans l'ordre d'affichage — partagé par la fiche et le parcours de création. */
export const RACES: HommeDragonRace[] = [
  'DRAGON_VERT',
  'DRAGON_BLEU',
  'DRAGON_ROUGE',
  'DRAGON_NOIR',
];

/** Étiquette courte de chaque carte de race (DESIGN Homme Dragon §7) : elle double la teinte. */
export const RACE_TAGS: Record<HommeDragonRace, string> = {
  DRAGON_VERT: 'Vert',
  DRAGON_BLEU: 'Bleu',
  DRAGON_ROUGE: 'Rouge',
  DRAGON_NOIR: 'Noir',
};

export const RACE_LABELS: Record<HommeDragonRace, string> = {
  DRAGON_VERT: 'Dragon Vert',
  DRAGON_BLEU: 'Dragon Bleu',
  DRAGON_ROUGE: 'Dragon Rouge',
  DRAGON_NOIR: 'Dragon Noir',
};
