import type {
  DaySlot,
  ScenarioStatus,
  SeanceInscriptionDto,
  SessionPollDto,
} from '@desdispos/shared';
import { hasUnansweredOptions } from '../poll/poll.util';
import {
  imminenceIntensity,
  imminenceLabel,
  type BadgeIntensity,
  type BadgeTone,
} from './status-badge.model';

/**
 * Story 32.3 — la dérivation d'état, **pure et sans Angular** (patron `agenda-badge.utils.ts` /
 * `party-signal-priority.ts` : testable sans TestBed).
 *
 * 🚨 **Aucun endpoint nouveau, aucun champ `status` sur la séance** (AD-20). Les quatre états de
 * scénario sont servis tels quels ; les états de séance sont DÉRIVÉS de la charge utile déjà
 * envoyée — vote, inscription, date effective, compte-rendu. Le serveur ne nomme pas ces états,
 * et ne doit pas commencer à le faire : ils dépendent du jour courant (et la situation du LECTEUR,
 * « Vote à faire » vs « J’ai voté », se dérive à part — `seanceSituation()`, story 53.1).
 */

/** Les dix clés de libellé d'état, résolues par `theme.tone()` — jamais un libellé en dur.
 *
 *  Story 53.1 : l'état de séance est IMPERSONNEL — le « Réponds au vote » (appel à l'action du
 *  lecteur) a quitté ce registre, il vit désormais dans la pastille « Ma situation »
 *  (`seanceSituation()` → `situation.vote_a_faire`). */
export type StatusLabelKey =
  | 'status.scenario_brouillon'
  | 'status.scenario_a_venir'
  | 'status.scenario_courant'
  | 'status.scenario_passe'
  | 'status.seance_a_planifier'
  | 'status.seance_poll_open'
  | 'status.seance_inscriptions_ouvertes'
  | 'status.seance_programmee'
  | 'status.seance_a_debriefer'
  | 'status.seance_jouee';

/** Ce que le badge doit rendre. `text`, quand il est là, REMPLACE le libellé de registre : c'est
 *  un décompte calculé (« demain soir »), pas un intitulé thématisable. */
export interface StatusBadgeState {
  tone: BadgeTone;
  intensity?: BadgeIntensity;
  labelKey: StatusLabelKey;
  text?: string;
  /** Brouillon : un traitement de FORME (contour tireté, fond transparent, texte atténué), jamais
   *  une cinquième teinte. Le rendu neutralise `tone` quand ce drapeau est levé. */
  draft: boolean;
}

/** Les quatre états de scénario, servis tels quels par l'API (`ScenarioStatus`).
 *
 * 🚨 **« Courant », jamais « En cours »** — correction assumée du libellé historique. Le bouton
 * voisin de `scenario-editor` dit déjà « Marquer comme Courant », et « en cours » reste réservé au
 * VOTE (« Vote en cours »). Deux choses différentes ne peuvent pas porter le même mot.
 *
 * 🚨 **Le masquage anti-spoil ne vit PAS ici.** `BROUILLON` rend un état comme les autres ; c'est
 * `ScenarioTimeline.buildNodes(scenarios, includeBrouillon)` — et lui seul — qui décide qu'un
 * joueur n'en voit ni le nœud, ni le badge, ni le compteur. Dupliquer la garde ici donnerait deux
 * endroits à tenir d'accord.
 */
export function scenarioState(status: ScenarioStatus): StatusBadgeState {
  switch (status) {
    case 'BROUILLON':
      // `tone` reste renseigné pour que le type soit total, mais le rendu l'ignore : un brouillon
      // se signale par sa forme, pas par sa couleur.
      return { tone: 'todo', labelKey: 'status.scenario_brouillon', draft: true };
    case 'A_VENIR':
      return { tone: 'soon', labelKey: 'status.scenario_a_venir', draft: false };
    case 'COURANT':
      return { tone: 'live', labelKey: 'status.scenario_courant', draft: false };
    case 'PASSE':
      return { tone: 'done', labelKey: 'status.scenario_passe', draft: false };
  }
}

/**
 * Ce dont la dérivation d'une séance a besoin — une forme STRUCTURELLE, pas `SeanceDto`.
 *
 * `SeanceDto` y est assignable tel quel, et le widget « Prochaine séance » de `PartieDetail`, qui
 * n'a qu'une date et un vote agrégés au niveau de la Partie (jamais de `SeanceDto`), peut l'être
 * aussi. Une signature prenant `SeanceDto` aurait forcé ce widget à fabriquer une fausse séance.
 */
export interface SeanceStateSource {
  poll?: SessionPollDto;
  inscription?: SeanceInscriptionDto;
  /** Date effective servie à la racine du DTO depuis la story 32.3 (`poll.chosenDate` ?? colonne
   *  `Seance.dateValidee`). */
  dateValidee?: string | null;
  slotValidee?: DaySlot | null;
  /** Story 47.2 : fin de la plage (`Seance.endDate`), servie à la racine du DTO ; absente = le début. */
  endDate?: string | null;
  compteRendu?: string | null;
}

/**
 * La date effective d'une séance, en clé `YYYY-MM-DD`, ou `null`.
 *
 * 🚨 **Les trois sources sont lues** parce que l'entrée est une forme PARTIELLE
 * (`SeanceStateSource`), pas un `SeanceDto` : le widget « Prochaine séance » de `PartieDetail` ne
 * fournit qu'une date agrégée, une inscription seule n'a pas de vote, et un `SeanceDto` complet
 * porte les trois. Sur un DTO servi, `dateValidee` racine suffit toujours — les deux autres
 * branches existent pour les appelants qui n'en ont pas.
 */
function dateKeyOf(seance: SeanceStateSource): string | null {
  const iso = seance.poll?.chosenDate ?? seance.dateValidee ?? seance.inscription?.dateValidee;
  return iso ? iso.substring(0, 10) : null;
}

/** Le créneau de la date effective — seul un vote scellé en porte un. */
function slotOf(seance: SeanceStateSource): DaySlot | undefined {
  return seance.poll?.chosenDate
    ? (seance.poll.chosenSlot ?? undefined)
    : (seance.slotValidee ?? undefined);
}

/**
 * La clé de FIN d'une séance (`YYYY-MM-DD`), ou `null` quand elle n'a aucune date effective.
 *
 * Story 47.2 : une séance n'est passée qu'une fois sa FIN passée — une plage commencée reste
 * annoncée. Source unique du « passé » pour `seanceState()`, `seanceSituation()` et
 * `nextSeanceOf()` : trois définitions auraient fini par diverger.
 */
function lastKeyOf(seance: SeanceStateSource): string | null {
  const dateKey = dateKeyOf(seance);
  const endKey = seance.endDate ? seance.endDate.substring(0, 10) : null;
  return endKey && dateKey && endKey > dateKey ? endKey : dateKey;
}

/** Passée = fin strictement avant `todayKey`. Le jour même n'est PAS passé (une séance du soir reste
 *  à venir le matin) : même comparaison que `sectionIdFor()` dans l'Agenda. Sans date : jamais passée. */
function isPastSeance(seance: SeanceStateSource, todayKey: string): boolean {
  const lastKey = lastKeyOf(seance);
  return lastKey !== null && lastKey < todayKey;
}

/**
 * L'état d'une séance à UN jour donné — **impersonnel** (Story 53.1).
 *
 * 🚨 **L'ordre des branches EST le départage**, et il est arbitré, pas improvisé (Design Notes de
 * la story) : actionnabilité décroissante, dans l'esprit de `dominantSignal()` (29.7).
 *   1. Une fois la date passée, « À débriefer » prime sur tout — c'est le seul état en retard.
 *   2. Un vote ouvert prime sur le reste : c'est lui qui produira la date.
 *   3. « Inscriptions ouvertes » prime sur « Programmée » (ligne explicite de la matrice d'E/S) :
 *      une place encore libre demande une décision, une date déjà connue non.
 *   4. « Programmée », et son intensité d'imminence.
 *   5. « À planifier » en repli — jamais un état inventé quand aucune date n'est exploitable.
 *
 * 🚨 **Aucun lecteur ici.** L'appel à l'action (« Vote à faire ») dépend de QUI regarde : il est
 * porté par `seanceSituation()` et la pastille, pas par ce badge. Un vote ouvert dit toujours
 * « Vote en cours », pour tout le monde.
 *
 * @param todayKey le jour courant en `YYYY-MM-DD` — injecté, jamais lu de l'horloge ici (fonction
 *   pure, et une seule source de « aujourd'hui » par écran, comme dans l'Agenda).
 */
export function seanceState(seance: SeanceStateSource, todayKey: string): StatusBadgeState {
  const dateKey = dateKeyOf(seance);

  // 1 — passée.
  if (isPastSeance(seance, todayKey)) {
    return seance.compteRendu?.trim()
      ? { tone: 'done', labelKey: 'status.seance_jouee', draft: false }
      : { tone: 'todo', labelKey: 'status.seance_a_debriefer', draft: false };
  }

  // 2 — vote ouvert, pour tout le monde.
  if (seance.poll?.status === 'OPEN') {
    return { tone: 'live', labelKey: 'status.seance_poll_open', draft: false };
  }

  // 3 — inscriptions ouvertes : il reste une place. Aucun jumeau côté `PartySignalCode`
  // (asymétrie assumée par la spec), donc aucun vocabulaire à contredire.
  const inscription = seance.inscription;
  if (inscription && inscription.inscrits.length < inscription.max) {
    return { tone: 'live', labelKey: 'status.seance_inscriptions_ouvertes', draft: false };
  }

  // 4 — programmée. L'imminence est une INTENSITÉ : la teinte reste `soon` aux trois paliers, et
  // seul le dernier remplace le libellé de registre par un libellé humain (« demain soir »).
  if (dateKey) {
    const intensity = imminenceIntensity(dateKey, todayKey);
    return {
      tone: 'soon',
      intensity,
      labelKey: 'status.seance_programmee',
      text:
        intensity === 'imminent' ? imminenceLabel(dateKey, slotOf(seance), todayKey) : undefined,
      draft: false,
    };
  }

  // 5 — repli honnête.
  return { tone: 'todo', labelKey: 'status.seance_a_planifier', draft: false };
}

/**
 * Story 53.1 — « Ma situation » : ce que la séance est POUR le lecteur. Six valeurs, ou `null`
 * (aucune pastille). C'est LA définition — la pastille partagée et ses surfaces la lisent,
 * aucune ne la recalcule.
 */
export type SeanceSituation =
  'je_mene' | 'vote_a_faire' | 'j_ai_vote' | 'je_participe' | 'pas_inscrit' | 'j_y_etais';

/**
 * Story 53.2 — ce que la pastille « Ma situation » sait rendre : les six situations de séance, plus
 * `place_reservee`, propre aux soirées/conjonctions (une place réservée en attente de réponse).
 * `seanceSituation()` ne la produit jamais ; `eventSituation()` (`event-card.util.ts`) la produit.
 */
export type SituationValue = SeanceSituation | 'place_reservee';

/**
 * La situation d'UN lecteur face à UNE séance, à UN jour donné. Pure : ni horloge, ni Angular.
 *
 * 🚨 **L'ordre des branches EST la règle** (matrice d'E/S de la story 53.1) :
 *   sans lecteur → `null` ; MJ → `je_mene` ; vote ouvert → `vote_a_faire` tant qu'une option
 *   reste sans réponse (même inscrit), sinon `j_ai_vote` ; puis l'inscription ; puis la date
 *   effective ; enfin un vote clos sans date.
 *
 * « A répondu » est `hasUnansweredOptions()`, jamais redéfini ici. « Passée » est celui de
 * `seanceState()` (fin de plage, jour même non passé).
 */
export function seanceSituation(
  seance: SeanceStateSource,
  viewerId: string | undefined,
  isMj: boolean,
  todayKey: string,
): SeanceSituation | null {
  if (viewerId === undefined) return null;
  if (isMj) return 'je_mene';

  const poll = seance.poll;
  if (poll?.status === 'OPEN') {
    return hasUnansweredOptions(poll, viewerId) ? 'vote_a_faire' : 'j_ai_vote';
  }

  const past = isPastSeance(seance, todayKey);

  // Séance à inscription : c'est l'inscription du lecteur qui décide, pas la seule date.
  const inscription = seance.inscription;
  if (inscription) {
    const registered = inscription.inscrits.some((i) => i.userId === viewerId);
    if (registered) return past ? 'j_y_etais' : 'je_participe';
    return past ? null : 'pas_inscrit';
  }

  // Sans inscription : la date effective vaut participation.
  if (dateKeyOf(seance) !== null) return past ? 'j_y_etais' : 'je_participe';

  // Vote clos sans date : seule la trace d'une réponse du lecteur reste lisible.
  if (poll && !hasUnansweredOptions(poll, viewerId)) return 'j_ai_vote';

  return null;
}

/**
 * Story 53.1 — la prochaine séance d'un scénario : la première, dans l'ordre servi, dont la fin
 * n'est pas passée (une séance sans date n'est pas passée). `null` s'il n'y en a aucune — MJ
 * compris : « prochaine » ne dépend pas du lecteur.
 */
export function nextSeanceOf<S extends SeanceStateSource>(
  scenario: { seances?: readonly S[] } | null | undefined,
  todayKey: string,
): S | null {
  return scenario?.seances?.find((s) => !isPastSeance(s, todayKey)) ?? null;
}
