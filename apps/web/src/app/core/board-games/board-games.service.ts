import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  BoardGameDto,
  CreateBoardGameInput,
  GroupBoardGamesDto,
  UpdateBoardGameInput,
  UserLibraryDto,
} from '@master-jdr/shared';
import { API_BASE } from '../api-base';

/**
 * Ma Ludothèque (Stories 48.1, 48.2) — `GET`/`POST /me/board-games`, `PATCH`/`DELETE
 * /me/board-games/:id` — et, en lecture seule, celle d'une autre personne (Story 48.3). Le serveur calcule `nameKey` et trie la
 * liste ; le front ne recalcule jamais la clé.
 *
 * Temps réel : `changed` est un compteur incrémenté par `notifyChanged()`, câblé dans
 * `RealtimeService` au préfixe `user:` — toute écriture d'un jeu émet `user:{propriétaire}`, ce qui
 * met à jour les autres onglets de la même personne. Story 48.3 : aussi au préfixe `partie:` — la feuille
 * « Ludothèque d'une personne » se relit quand le propriétaire écrit un jeu.
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

  /** Ludothèque d'une autre personne (Story 48.3, lecture seule). Rejette avec la réponse HTTP : 404 pour tout
   *  refus, compte inconnu compris. Chaque appel émet sa propre requête. */
  listOf(userId: string): Promise<UserLibraryDto> {
    return firstValueFrom(
      this.http.get<UserLibraryDto>(`${API_BASE}/users/${encodeURIComponent(userId)}/board-games`, {
        withCredentials: true,
      }),
    );
  }

  /** Les jeux des membres actuels d'un groupe (Story 50.1, lecture seule), regroupés par nom normalisé par
   *  l'API. Rejette avec la réponse HTTP (403 pour une rencontre isolée, une partie de JDR ou un non-membre,
   *  404 pour une partie inconnue). Chaque appel émet sa propre requête. */
  listOfGroup(partieId: string): Promise<GroupBoardGamesDto> {
    return firstValueFrom(
      this.http.get<GroupBoardGamesDto>(
        `${API_BASE}/parties/${encodeURIComponent(partieId)}/board-games`,
        { withCredentials: true },
      ),
    );
  }

  /** Ajoute un jeu ; rejette avec la réponse HTTP (409 doublon, 400 bornes ou plafond). */
  create(input: CreateBoardGameInput): Promise<BoardGameDto> {
    return firstValueFrom(
      this.http.post<BoardGameDto>(`${API_BASE}/me/board-games`, input, { withCredentials: true }),
    );
  }

  /** Corrige un de mes jeux (corps partiel) ; rejette avec la réponse HTTP (409 doublon, 400 bornes,
   *  404 jeu absent — retiré ailleurs entre-temps). */
  update(id: string, input: UpdateBoardGameInput): Promise<BoardGameDto> {
    return firstValueFrom(
      this.http.patch<BoardGameDto>(`${API_BASE}/me/board-games/${encodeURIComponent(id)}`, input, {
        withCredentials: true,
      }),
    );
  }

  /** Retire un de mes jeux (204) ; rejette avec la réponse HTTP (404 jeu absent). */
  async remove(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${API_BASE}/me/board-games/${encodeURIComponent(id)}`, {
        withCredentials: true,
      }),
    );
  }
}
