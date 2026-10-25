import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { DatableSeanceEntry } from '@master-jdr/shared';
import { API_BASE } from '../api-base';

/**
 * Mes rendez-vous qui attendent une date (Story 45.1) : UNE lecture, `GET /me/datable-seances`, pour toutes mes
 * parties — le calendrier personnel en tire le bouton « Proposer des dates ». À l'atelier, la liste se dérive
 * de la charge utile déjà chargée : ce service n'y sert pas.
 *
 * Paresseux : rien n'est lu avant le premier `refresh()` (le calendrier personnel), et le temps réel
 * (`user:{id}`) ne relit qu'après cela.
 */
@Injectable({ providedIn: 'root' })
export class DatableSeancesService {
  private readonly http = inject(HttpClient);

  /** Les rendez-vous à dater, tels que le serveur les sert. */
  readonly entries = signal<DatableSeanceEntry[]>([]);

  /** La liste a été lue au moins une fois. */
  readonly loaded = signal(false);

  private started = false;
  // Compteur de requête : une réponse obsolète ne peut jamais écraser un état plus frais.
  private seq = 0;

  /** Contrat public — `RealtimeService` l'appelle sur un événement `user:{id}` : toute écriture qui date,
   *  efface, crée, annule ou clôt un rendez-vous prévient ce canal. */
  notifyChanged(): void {
    if (this.started) void this.refresh();
  }

  /** Relit mes rendez-vous à dater. Un échec transitoire garde le dernier état connu bon. */
  async refresh(): Promise<void> {
    this.started = true;
    const seq = ++this.seq;
    let list: DatableSeanceEntry[];
    try {
      list = await firstValueFrom(
        this.http.get<DatableSeanceEntry[]>(`${API_BASE}/me/datable-seances`, {
          withCredentials: true,
        }),
      );
    } catch {
      return;
    }
    if (seq !== this.seq) return;
    this.entries.set(list);
    this.loaded.set(true);
  }
}
