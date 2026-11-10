import { Injectable } from '@angular/core';
import type { EventPollOptionInput } from '@master-jdr/shared';

/**
 * Brouillon d'une conjonction par sondage de dates (Story 40.5b) : tout ce que la fenêtre de création
 * saisit, pour faire l'aller-retour par le calendrier du groupe sans rien perdre (nom, lieu, heure,
 * infos, participation, places réservées, échéance et créneaux).
 */
export interface ConjonctionDraft {
  partieId: string;
  title: string;
  pollOptions: EventPollOptionInput[];
  /** Échéance du vote, clé `YYYY-MM-DD` (vide tant qu'elle n'est pas saisie). */
  pollDeadline: string;
  lieu: string;
  heureRdv: string;
  notePratique: string;
  participation: 'all' | 'limited';
  places: number;
  /** Membres à qui l'hôte réserve une place d'emblée. */
  reserved: string[];
  /** ⚠️ Story 47.4 : durée du rendez-vous, en créneaux — elle fait l'aller-retour dans les deux sens (le composer
   *  l'initialise, la fenêtre de création la reprend). Absente = 1. */
  durationSlots?: number;
}

/**
 * Aller-retour « Choisir les créneaux dans le calendrier » (Story 40.5b) : la fenêtre de création
 * dépose son brouillon ici et ouvre le calendrier du groupe ; le calendrier le lit, arme le mode
 * « composer » pour une nouvelle conjonction (aucun appel au serveur), puis rend le brouillon — créneaux
 * à jour s'il valide, tel quel s'il renonce — et l'onglet des conjonctions rouvre la fenêtre.
 *
 * Service racine, en mémoire seulement : un rechargement de page abandonne le brouillon (comme il
 * abandonne la fenêtre de création). Deux drapeaux à usage unique, jamais rejoués par une simple visite :
 * - `composePending` : la création attend ses créneaux, le calendrier le consomme à l'ouverture ;
 * - `reopenPending` : le calendrier a rendu la main, l'onglet le consomme pour rouvrir la fenêtre.
 */
@Injectable({ providedIn: 'root' })
export class ConjonctionDraftService {
  private draft: ConjonctionDraft | null = null;
  private composePending = false;
  private reopenPending = false;

  /** La création part choisir ses créneaux dans le calendrier. */
  beginCompose(draft: ConjonctionDraft): void {
    this.draft = { ...draft, pollOptions: [...draft.pollOptions], reserved: [...draft.reserved] };
    this.composePending = true;
    this.reopenPending = false;
  }

  /** Le calendrier de `partieId` reprend le brouillon en attente de créneaux ; `null` s'il n'y en a
   *  pas pour cette partie. Usage unique. */
  takeComposeRequest(partieId: string): ConjonctionDraft | null {
    if (!this.composePending || this.draft?.partieId !== partieId) return null;
    this.composePending = false;
    return this.draft;
  }

  /** Le calendrier rend la main : `pollOptions` (créneaux validés) remplace ceux du brouillon, et — Story 47.4 —
   *  `durationSlots` sa durée ; absents, le brouillon est rendu tel quel (renoncer). L'onglet rouvrira la fenêtre de
   *  création. */
  finishCompose(
    partieId: string,
    pollOptions?: EventPollOptionInput[],
    durationSlots?: number,
  ): void {
    if (this.draft?.partieId !== partieId) return;
    if (pollOptions) this.draft = { ...this.draft, pollOptions: [...pollOptions] };
    if (durationSlots !== undefined) this.draft = { ...this.draft, durationSlots };
    this.composePending = false;
    this.reopenPending = true;
  }

  /** L'onglet des conjonctions de `partieId` rouvre la fenêtre de création avec ce brouillon ; `null`
   *  sinon. Usage unique. */
  takeReopen(partieId: string): ConjonctionDraft | null {
    if (!this.reopenPending || this.draft?.partieId !== partieId) return null;
    this.reopenPending = false;
    return this.draft;
  }

  /** Brouillon abandonné ou enregistré. */
  clear(): void {
    this.draft = null;
    this.composePending = false;
    this.reopenPending = false;
  }
}
