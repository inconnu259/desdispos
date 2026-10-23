import type {
  MyCalendarOpenInscriptionEntry,
  MyCalendarSeanceEntry,
  PartieKind,
  PartieRole,
} from '@master-jdr/shared';

/** Une partie de l'utilisateur lecteur (propriétaire ou membre) — le strict nécessaire au calendrier. */
export interface OwnPartie {
  id: string;
  name: string;
  kind: PartieKind;
}

/** Fenêtre du calendrier, bornes incluses, en millisecondes UTC. */
export interface OwnEventsRange {
  fromMs: number;
  toMs: number;
}

/** Rôle de l'utilisateur sur chacune de ses parties, résolu EN LOT (jamais une requête par
 *  partie). Reçu en rappel : les identifiants des parties ne sont connus qu'une fois la liste lue
 *  par le port lui-même. */
export type OwnRolesResolver = (partieIds: string[]) => Promise<ReadonlyMap<string, PartieRole>>;

/** Ce que le calendrier personnel tire des événements de l'utilisateur. */
export interface OwnEvents {
  /** Les parties de l'utilisateur (propriétaire ou membre). */
  parties: OwnPartie[];
  /** Couche `mes-seances` : séances datées dans la fenêtre. Une séance d'une campagne épisodique
   *  n'est « mienne » que pour le MJ ou un inscrit. Date vide absente, créneau vide = `FULL_DAY`. */
  seances: MyCalendarSeanceEntry[];
  /** Couche `inscriptions-ouvertes` : séances à inscription ouverte, jamais filtrées par fenêtre. */
  inscriptionsOuvertes: MyCalendarOpenInscriptionEntry[];
}

/**
 * Port de la couche 1 : le calendrier personnel, AVEC titres (ce sont les propres parties de
 * l'utilisateur — la notion de partie tierce n'existe pas ici). Implémenté par `events/`.
 * Les déclarations de disponibilité restent lues par `availability/` ; les sondages ouverts (toutes familles)
 * ne passent plus par ce port ni par `GET /me/calendar` : ils viennent de `GET /me/open-polls` (Story 44.2).
 */
export interface OwnEventsPort {
  ownEventsOf(userId: string, roles: OwnRolesResolver, range: OwnEventsRange): Promise<OwnEvents>;
}

/** Jeton d'injection de `OwnEventsPort`. */
export const OWN_EVENTS_PORT = Symbol('OWN_EVENTS_PORT');
