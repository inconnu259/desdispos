/**
 * Port de la couche 2 : « parmi ces séances sans date, lesquelles ne se datent plus pour une raison que
 * `events/` ne connaît pas ? » (Story 45.1, AR3). Aujourd'hui : celles d'un scénario clôturé, une notion du
 * JDR que seul `scenarios/` lit. Implémenté par `scenarios/`, branché par `PortsModule` — `events/`
 * n'importe jamais `scenarios/`.
 */
export interface DatableSeanceFilter {
  /** Les identifiants, parmi `seanceIds`, à EXCLURE de la liste des rendez-vous à dater. En lot. */
  excludedSeanceIds(seanceIds: string[]): Promise<Set<string>>;
}

/** Jeton d'injection de `DatableSeanceFilter`. */
export const DATABLE_SEANCE_FILTER = Symbol('DATABLE_SEANCE_FILTER');
