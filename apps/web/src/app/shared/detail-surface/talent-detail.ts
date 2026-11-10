import type { DetailRow, DetailSurfaceContent } from './detail-surface-host';

/** Projection minimale d'un talent du catalogue, telle que la fiche et l'assistant la lisent. */
export interface TalentDetailSource {
  name: string;
  effect?: { description?: string; conditions?: string };
  attributes?: string[];
  difficulty?: string;
  description?: string;
}

/** Libellés d'interface des lignes du tableau — micro-copie de `tones.ts`, jamais du texte de règle. */
export interface TalentDetailLabels {
  attributes: string;
  difficulty: string;
  effect: string;
  conditions: string;
}

/**
 * Contenu structuré de la surface de détail pour un talent (Story 31.4, DESIGN §7.2) : un tableau
 * mécanique (attributs, difficulté, effet, conditions) puis le récit d'ambiance. Écrit UNE fois,
 * partagé par la fiche et l'assistant — jamais dupliqué dans un composant.
 *
 * Une ligne n'existe que si sa donnée existe (`'-'` et vide = absente). Sans aucune ligne ni récit,
 * `null` : l'appelant ne rend AUCUN déclencheur (règle « pas de texte ⇒ pas d'aide »).
 */
export function talentDetail(
  talent: TalentDetailSource | undefined,
  labels: TalentDetailLabels,
): DetailSurfaceContent | null {
  const title = talent?.name?.trim();
  if (!talent || !title) return null;

  const rows: DetailRow[] = [];
  const add = (label: string, value: string | undefined): void => {
    const text = value?.trim();
    if (text && text !== '-') rows.push({ label, value: text });
  };
  add(labels.attributes, (talent.attributes ?? []).join(' · '));
  const difficulty = talent.difficulty?.trim();
  add(
    labels.difficulty,
    difficulty ? difficulty[0].toUpperCase() + difficulty.slice(1) : undefined,
  );
  add(labels.effect, talent.effect?.description);
  add(labels.conditions, talent.effect?.conditions);

  const narrative = talent.description?.trim() ?? '';
  if (rows.length === 0 && !narrative) return null;
  return { title, body: '', rows, narrative };
}
