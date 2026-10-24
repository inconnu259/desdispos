import { Injectable, computed, inject, signal } from '@angular/core';
import type { PartieDto } from '@master-jdr/shared';
import { PartiesService } from '../parties/parties.service';

/** Deux listes désignent le même ensemble de parties (mêmes id, rôle et nom, dans le même ordre). */
function samePartiesIdentity(a: PartieDto[], b: PartieDto[]): boolean {
  return (
    a.length === b.length &&
    a.every((p, i) => p.id === b[i].id && p.role === b[i].role && p.name === b[i].name)
  );
}

@Injectable({ providedIn: 'root' })
export class MyPartiesService {
  private readonly parties = inject(PartiesService);

  /** Toutes les parties de l'utilisateur, quel que soit son rôle (Story 38.5) — chacune porte déjà
   *  son `role` (`mj | player | admin | member`, projection serveur par lot, AD-15) : une seule
   *  lecture `GET /parties`, plus de deux appels par rôle qui excluaient les ralliements. */
  private readonly _allParties = signal<PartieDto[]>([]);
  /** Lecture seule : seule `refreshAll()` écrit, derrière sa garde anti-course (`seq`). */
  readonly allParties = this._allParties.asReadonly();
  /** La liste a été lue au moins une fois (Story 44.7) : avant, « aucune partie » veut dire « pas encore su », et
   *  rien ne doit en conclure qu'il n'y a aucun sondage ouvert. */
  readonly loaded = signal(false);
  /** Les parties que l'utilisateur maîtrise — simple vue filtrée de la liste complète. Égalité par
   *  identité/rôle/nom : un `refreshAll()` qui ne change que `isFavorite`, le statut… ne notifie
   *  pas les consommateurs (`OpenPollsService` relance un fetch par partie à chaque changement). */
  readonly mjParties = computed(() => this.allParties().filter((p) => p.role === 'mj'), {
    equal: samePartiesIdentity,
  });
  /** Les parties où l'utilisateur est joueur — même égalité que `mjParties`. */
  readonly playerParties = computed(() => this.allParties().filter((p) => p.role === 'player'), {
    equal: samePartiesIdentity,
  });
  readonly hasMjParties = computed(() => this.mjParties().length > 0);

  private seq = 0;

  constructor() {
    // Nettoyage (revue de code, Story 29.1) : l'ancien `ModeService.setMode()` écrivait cette clé,
    // désormais orpheline — plus rien ne la lit, mais elle restait indéfiniment dans le
    // localStorage des utilisateurs ayant déjà basculé de mode avant ce refactor.
    if (typeof localStorage !== 'undefined') localStorage.removeItem('master-jdr.mode');
  }

  // Bug fix critique (production) : un vote créé sur N'IMPORTE QUELLE Partie déclenchait un
  // rafraîchissement complet et non protégé de la liste — deux appels concurrents (ex. Shell au
  // bootstrap + une reconnexion SSE) pouvaient résoudre dans le désordre, et le moindre échec réseau
  // transitoire vidait silencieusement TOUTE la liste des Parties, sans jamais se réparer avant le
  // prochain déclenchement réussi. Compteur `seq` (même pattern que OpenPollsService.refresh()) :
  // une réponse obsolète ne peut plus écraser un état plus frais, et un échec ne vide plus jamais la
  // liste — le dernier état connu bon est conservé.
  async refreshAll(): Promise<void> {
    const seq = ++this.seq;
    let list: PartieDto[] | undefined;
    try {
      list = await this.parties.list();
    } catch {
      // Échec transitoire : on garde le dernier état connu bon, pas de `.set([])`.
    }
    if (seq !== this.seq) return; // réponse obsolète, une requête plus récente est en vol
    if (list) {
      this._allParties.set(list);
      this.loaded.set(true);
    }
  }

  /** Story 42.5 : retire une partie terminée ou annulée de la liste de l'utilisateur, puis relit la liste (la
   *  partie en a disparu côté serveur). Un refus du serveur remonte à l'appelant, la liste reste inchangée. */
  async hide(partieId: string): Promise<void> {
    await this.parties.hide(partieId);
    await this.refreshAll();
  }

  /** Alias historiques de `refreshAll()` (la liste n'est plus scindée par rôle) : conservés pour les
   *  appelants existants, sans second appel réseau. */
  refreshMjParties(): Promise<void> {
    return this.refreshAll();
  }

  refreshPlayerParties(): Promise<void> {
    return this.refreshAll();
  }

  /** Contrat public AD-4 (zéro argument) — RealtimeService l'appelle sur un événement SSE
   *  user:{id} (bug fix : reculé depuis le préfixe générique 'partie:', cf. RealtimeService — la
   *  liste d'appartenance ne change jamais via une mutation partie-scopée générique comme un vote
   *  ou un scénario). Depuis la Story 38.5, la création d'une partie émet aussi ce canal. */
  notifyChanged(): void {
    void this.refreshAll();
  }
}
