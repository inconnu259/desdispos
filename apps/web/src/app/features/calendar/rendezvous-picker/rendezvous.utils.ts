import {
  isComposableSeance,
  isDatableSeance,
  type DatableSeanceEntry,
  type EventCardDto,
  type GameSystemFamily,
  type ScenarioDto,
} from '@master-jdr/shared';

/** La nature d'un rendez-vous à dater, telle que le choix l'écrit : une séance de JDR ou une soirée isolée. */
export type RendezvousNature = 'seance' | 'soiree' | 'seance_poll';

/** Un rendez-vous à dater, tel que « Proposer des dates » le liste (Story 45.1). */
export interface RendezvousRow {
  seanceId: string;
  partieId: string;
  /** Le nom propre de la partie ou du groupe : l'en-tête du groupe de lignes. */
  partieName: string;
  family: GameSystemFamily;
  nature: RendezvousNature;
  /** Story 45.5 — l'événement d'une soirée isolée (sa cible de composer) ; absent pour une séance de JDR et pour une
   *  ligne de la vitrine (elle ouvre l'atelier, qui retrouve l'événement par `seanceId`). */
  eventId?: string;
  /** Le nom du rendez-vous (« Titre — Séance 2 » quand le scénario en a plusieurs). */
  title: string;
}

export function natureOf(family: GameSystemFamily): RendezvousNature {
  return family === 'ralliement' ? 'soiree' : 'seance';
}

/** Le nom d'un rendez-vous : le titre, suivi du rang de la séance seulement s'il y en a plusieurs. */
export type RendezvousTitle = (title: string, rank: number, count: number) => string;

/** Une ligne de la vitrine, depuis `GET /me/datable-seances`. */
export function rowFromEntry(entry: DatableSeanceEntry, titleOf: RendezvousTitle): RendezvousRow {
  return {
    seanceId: entry.seanceId,
    partieId: entry.partieId,
    partieName: entry.partieName,
    family: entry.family,
    nature: natureOf(entry.family),
    title: titleOf(entry.title, entry.seanceRank, entry.seanceCount),
  };
}

/**
 * Les rendez-vous à dater d'une partie de JDR, dérivés des scénarios déjà chargés par l'atelier (même
 * prédicat que le serveur : `isDatableSeance`). Un scénario clôturé est figé, comme côté serveur.
 */
export function jdrRendezvous(
  scenarios: readonly ScenarioDto[],
  partie: { id: string; name: string },
  frozen: boolean,
  titleOf: RendezvousTitle,
): RendezvousRow[] {
  const rows: RendezvousRow[] = [];
  for (const scenario of scenarios) {
    if (scenario.status === 'PASSE') continue;
    scenario.seances.forEach((seance, i) => {
      const datable = isDatableSeance({
        hasDate: !!seance.dateValidee || !!seance.inscription?.dateValidee,
        hasPoll: !!seance.poll,
        cancelled: false,
        frozen,
        canOrganize: seance.can.propose,
      });
      if (!datable) return;
      rows.push({
        seanceId: seance.id,
        partieId: partie.id,
        partieName: partie.name,
        family: 'jdr',
        nature: 'seance',
        title: titleOf(scenario.title, i + 1, scenario.seances.length),
      });
    });
  }
  return rows;
}

/**
 * Story 46.3 — les rendez-vous COMPOSABLES d'une partie de JDR : à dater (comme `jdrRendezvous`), ou porteurs d'un vote
 * OUVERT que la personne peut modifier (`can.edit`) — le composer part alors de ses créneaux. Définis par le prédicat
 * partagé `isComposableSeance`. C'est ce que liste le choix quand une fenêtre de l'automate s'ajoute au vote.
 */
export function jdrComposable(
  scenarios: readonly ScenarioDto[],
  partie: { id: string; name: string },
  frozen: boolean,
  titleOf: RendezvousTitle,
): RendezvousRow[] {
  const rows: RendezvousRow[] = [];
  for (const scenario of scenarios) {
    if (scenario.status === 'PASSE') continue;
    scenario.seances.forEach((seance, i) => {
      const hasOpenPoll = seance.poll?.status === 'OPEN';
      const composable = isComposableSeance({
        hasDate: !!seance.dateValidee || !!seance.inscription?.dateValidee,
        hasPoll: !!seance.poll,
        hasOpenPoll,
        cancelled: false,
        frozen,
        canPropose: seance.can.propose,
        canEdit: seance.can.edit,
      });
      if (!composable) return;
      rows.push({
        seanceId: seance.id,
        partieId: partie.id,
        partieName: partie.name,
        family: 'jdr',
        nature: hasOpenPoll ? 'seance_poll' : 'seance',
        title: titleOf(scenario.title, i + 1, scenario.seances.length),
      });
    });
  }
  return rows;
}

/**
 * Les rendez-vous à dater d'un groupe ou d'une soirée isolée, dérivés des cartes déjà chargées : seule une
 * soirée isolée peut naître sans date ni vote ; un événement de groupe naît daté ou avec son vote.
 */
export function groupRendezvous(
  cards: readonly EventCardDto[],
  partie: { id: string; name: string },
  frozen: boolean,
): RendezvousRow[] {
  const rows: RendezvousRow[] = [];
  for (const card of cards) {
    if (!card.seance) continue;
    const datable = isDatableSeance({
      hasDate: !!card.seance.date,
      hasPoll: !!card.poll,
      cancelled: card.cancelled,
      frozen,
      canOrganize: card.can.propose,
    });
    if (!datable) continue;
    rows.push({
      seanceId: card.seance.id,
      partieId: partie.id,
      partieName: partie.name,
      family: 'ralliement',
      nature: 'soiree',
      eventId: card.id,
      title: card.title,
    });
  }
  return rows;
}
