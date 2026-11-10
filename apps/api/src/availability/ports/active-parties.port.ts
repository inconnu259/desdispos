/**
 * Port de la couche 1 (Story 52.4, AD-5) : l'utilisateur est-il dans au moins une partie ACTIVE ? Implémenté par
 * `events/` (qui calcule l'avancement des parties), lié par `PortsModule` : `availability/` n'importe ni `events/`
 * ni `parties/`.
 *
 * Active au sens de `partieStatus()` puis `isPartieActive()` — la seule définition. L'utilisateur possède la partie
 * (MJ, hôte) ou en est membre ; une invitation en attente ne compte pas ; JDR comme ralliement.
 */
export interface ActivePartiesPort {
  hasActivePartie(userId: string): Promise<boolean>;
}

/** Jeton d'injection de `ActivePartiesPort`. */
export const ACTIVE_PARTIES_PORT = Symbol('ACTIVE_PARTIES_PORT');
