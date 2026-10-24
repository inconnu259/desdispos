import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { OpenPollEntry } from '@master-jdr/shared';
import { MyPartiesService } from '../my-parties/my-parties.service';
import { PollService } from './poll.service';

/**
 * Mes sondages de dates ouverts (Story 44.2) : UNE lecture, `GET /me/open-polls`, pour toutes mes parties et
 * toutes les familles — plus aucun appel par partie. Deux consommateurs :
 * - le calendrier personnel lit la liste complète (`entries`), quel que soit le mois affiché ;
 * - le tableau de bord et le compteur du shell lisent `openPolls` / `count`, inchangés : une entrée par partie
 *   où, joueur de JDR, il me reste un vote à faire.
 */
@Injectable({ providedIn: 'root' })
export class OpenPollsService {
  private readonly myPartiesSvc = inject(MyPartiesService);
  private readonly pollSvc = inject(PollService);

  /** Tous mes sondages ouverts, tels que le serveur les sert (jamais filtrés par période). */
  readonly entries = signal<OpenPollEntry[]>([]);

  /** La liste a été lue au moins une fois (ou je n'ai aucune partie) : son absence d'un vote fait alors autorité. */
  readonly loaded = signal(false);

  /** Par partie, le premier vote de JDR encore à faire (j'y suis votant éligible et je n'ai pas fini d'y
   *  répondre) — pour les parties où je suis joueur seulement. Même contrat qu'avant la story 44.2 : les
   *  badges du tableau de bord et du shell ne changent pas. */
  readonly openPolls = computed<Map<string, OpenPollEntry>>(() => {
    const playerPartieIds = new Set(this.myPartiesSvc.playerParties().map((p) => p.id));
    const map = new Map<string, OpenPollEntry>();
    for (const entry of this.entries()) {
      if (entry.family !== 'jdr' || !playerPartieIds.has(entry.partieId)) continue;
      if (!entry.me.eligible || entry.me.answered || map.has(entry.partieId)) continue;
      map.set(entry.partieId, entry);
    }
    return map;
  });
  readonly count = computed(() => this.openPolls().size);

  // L'ensemble de mes parties (pas leur statut, favori…) : une clé texte, donc un changement de statut ou de
  // favori ne relance aucune lecture.
  private readonly partieIdsKey = computed(() =>
    this.myPartiesSvc
      .allParties()
      .map((p) => p.id)
      .sort()
      .join(','),
  );

  // Compteur de requête : une réponse obsolète (deux rafraîchissements qui se croisent, p. ex. le shell au
  // démarrage et un signal temps réel) ne peut jamais écraser un état plus frais.
  private seq = 0;

  constructor() {
    // La liste de mes parties change (partie rejointe ou quittée) : la liste des sondages aussi.
    effect(() => {
      // Aucune partie : aucun sondage, et aucune requête — mais seulement une fois la liste de mes parties LUE :
      // au démarrage elle est encore vide, et déclarer `loaded` alors ferait croire à tout vote qu'il a disparu
      // (un lien `?poll` serait refusé, la Destinée fermée).
      if (this.partieIdsKey() === '') {
        if (!this.myPartiesSvc.loaded()) return;
        this.seq++;
        this.entries.set([]);
        this.loaded.set(true);
        return;
      }
      void this.refresh();
    });
  }

  /** Contrat public AD-4 — `RealtimeService` l'appelle sur un événement `user:{id}` : toute écriture de
   *  sondage ou de vote, quelle que soit la partie, prévient ce canal (`notifyPartieSignalsChanged`). */
  notifyChanged(): void {
    void this.refresh();
  }

  /** Relit mes sondages ouverts. Un échec transitoire garde le dernier état connu bon. */
  async refresh(): Promise<void> {
    const seq = ++this.seq;
    let list: OpenPollEntry[];
    try {
      list = await this.pollSvc.getMyOpenPolls();
    } catch {
      return;
    }
    if (seq !== this.seq) return;
    this.entries.set(list);
    this.loaded.set(true);
  }
}
