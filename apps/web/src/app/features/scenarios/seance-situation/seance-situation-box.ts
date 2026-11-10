import type { SeanceDto } from '@desdispos/shared';
import { daysBetweenKeys } from '../../../core/status/status-badge.model';
import type { SeanceSituation } from '../../../core/status/status-derivation';

/**
 * Story 54.1 — l'encadré de situation d'une séance : l'action attendue du lecteur, ou rien.
 *
 * `voter`, `participer`, `se_desinscrire` sont des encadrés de joueur ; `lancer_le_vote`, `fixer_la_date` et
 * `reinitialiser_la_date` des encadrés de MJ.
 */
export type SeanceSituationBox =
  | 'voter'
  | 'participer'
  | 'se_desinscrire'
  | 'lancer_le_vote'
  | 'fixer_la_date'
  | 'reinitialiser_la_date';

type BoxSource = Pick<SeanceDto, 'poll' | 'inscription' | 'dateValidee'> & {
  /** Ce que le serveur permet à CETTE personne (Story 44.1) ; absent = aucun droit. */
  can?: Pick<SeanceDto['can'], 'choose'>;
};

/** Date effective de la séance (même résolution que `SeanceList.resolvedDate`). */
function hasDate(seance: BoxSource): boolean {
  return (seance.poll?.chosenDate ?? seance.dateValidee ?? seance.inscription?.dateValidee) != null;
}

/**
 * Quel encadré une séance appelle, ou `null` (aucune action attendue : la ligne « Ma situation » seule).
 *
 * 🚨 Fonction pure : `situation` est la valeur de `seanceSituation()`, jamais recalculée ici. Elle
 * sert de garde de rôle (un MJ lit `je_mene`, un joueur l'une des autres valeurs).
 * `isMj` est le drapeau des CONTRÔLES de la fiche (`SeanceList.isMj`), pas le rôle de lecture : le MJ
 * qui ouvre un chapitre passé en lecture seule lit `je_mene` avec `isMj` faux, donc aucun encadré.
 * `episodic` : une séance épisodique sans capacité garde son formulaire de capacité, sans encadré.
 */
export function seanceSituationBox(
  seance: BoxSource,
  situation: SeanceSituation | null,
  isMj: boolean,
  viewerId: string | undefined,
  todayKey: string,
  episodic = false,
): SeanceSituationBox | null {
  if (viewerId === undefined || situation === null) return null;

  if (situation === 'je_mene') {
    if (!isMj) return null;
    const poll = seance.poll;
    if (poll) {
      if (poll.status === 'OPEN') {
        // Story 54.3 : « Fixer la date… » seulement si le serveur le permet — jamais déduit du rôle.
        return !hasDate(seance) && seance.can?.choose ? 'fixer_la_date' : null;
      }
      return hasDate(seance) ? null : 'reinitialiser_la_date';
    }
    if (hasDate(seance)) return null; // datée sans vote : sa date et son bouton actuels
    if (episodic && !seance.inscription) return null; // capacité à fixer d'abord
    return 'lancer_le_vote';
  }

  const poll = seance.poll;
  const open = poll?.status === 'OPEN';

  if (situation === 'vote_a_faire') {
    if (!poll || !open) return null;
    // Le jour d'échéance reste un jour de vote ; une échéance passée n'appelle plus d'action.
    const deadline = poll.expiresAt?.substring(0, 10);
    return deadline === undefined || deadline >= todayKey ? 'voter' : null;
  }

  if (situation !== 'j_ai_vote' && situation !== 'pas_inscrit' && situation !== 'je_participe') {
    return null;
  }
  // Une séance datée garde sa date seule, sans bouton d'inscription ni de désinscription.
  if (hasDate(seance)) return null;
  const inscription = seance.inscription;
  if (!inscription) return null;
  if (inscription.inscrits.some((i) => i.userId === viewerId)) return 'se_desinscrire';
  return inscription.inscrits.length < inscription.max ? 'participer' : null;
}

/**
 * « jeudi » quand l'échéance tombe dans les six jours, sinon « jeudi 12 novembre ». Ne raisonne que
 * sur des clés de jour (`YYYY-MM-DD`), jamais sur des instants.
 */
export function voteDeadlineLabel(expiresAt: string, todayKey: string): string {
  const key = expiresAt.substring(0, 10);
  const [y, m, d] = key.split('-').map(Number);
  const days = daysBetweenKeys(todayKey, key);
  const options: Intl.DateTimeFormatOptions =
    days >= 0 && days <= 6
      ? { weekday: 'long', timeZone: 'UTC' }
      : { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' };
  return new Intl.DateTimeFormat('fr-FR', options).format(new Date(Date.UTC(y, m - 1, d)));
}
