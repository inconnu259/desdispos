import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { BoardGameDto, CreateBoardGameInput } from '@master-jdr/shared';
import { API_BASE } from '../api-base';

/**
 * Ma Ludothèque (Story 48.1) — `GET`/`POST /me/board-games`. Le serveur calcule `nameKey` et trie la
 * liste ; le front ne recalcule jamais la clé.
 *
 * Temps réel : `changed` est un compteur incrémenté par `notifyChanged()`, câblé dans
 * `RealtimeService` au préfixe `user:` — toute écriture d'un jeu émet `user:{propriétaire}`, ce qui
 * met à jour les autres onglets de la même personne.
 */
@Injectable({ providedIn: 'root' })
export class BoardGamesService {
  private readonly http = inject(HttpClient);

  private readonly _changed = signal(0);
  readonly changed = this._changed.asReadonly();
  notifyChanged(): void {
    this._changed.update((v) => v + 1);
  }

  /** Mes jeux, dans l'ordre alphabétique servi par l'API. Chaque appel émet sa propre requête :
   *  une relecture déclenchée après une écriture ne doit jamais recevoir un instantané d'avant elle. */
  list(): Promise<BoardGameDto[]> {
    return firstValueFrom(
      this.http.get<BoardGameDto[]>(`${API_BASE}/me/board-games`, { withCredentials: true }),
    );
  }

  /** Ajoute un jeu ; rejette avec la réponse HTTP (409 doublon, 400 bornes ou plafond). */
  create(input: CreateBoardGameInput): Promise<BoardGameDto> {
    return firstValueFrom(
      this.http.post<BoardGameDto>(`${API_BASE}/me/board-games`, input, { withCredentials: true }),
    );
  }
}
