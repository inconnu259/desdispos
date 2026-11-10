import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  BoardGameBroughtCountDto,
  CreateEventDto,
  EventBoardGamesDto,
  EventCardDto,
  ExtendPollDto,
  HostCountsDto,
  UpdateEventDto,
} from '@master-jdr/shared';
import { API_BASE } from '../../core/api-base';

/**
 * Conjonctions d'un groupe de ralliement (Stories 40.1 et 40.2) — accès HTTP seul, aucun état.
 *
 * 🚨 La liste vit sur `GET /parties/:id/events/list` : `GET /parties/:id/events` est le flux temps
 * réel (SSE) de la partie. Le rafraîchissement en direct ne passe PAS par un nouveau handler
 * `'partie:'` (checklist) : l'onglet réagit au signal `PartiesService.changed()`, déjà câblé sur le
 * canal `partie:{id}` de la page.
 */
@Injectable({ providedIn: 'root' })
export class EventsApiService {
  private readonly http = inject(HttpClient);

  /** Une requête par appel, JAMAIS partagée avec une requête déjà en vol : la relecture qui suit
   *  une création doit voir l'état validé, pas un instantané pris avant. La péremption des réponses
   *  est gérée par l'appelant (compteur de requêtes de `ConjonctionsTab`). */
  list(partieId: string): Promise<EventCardDto[]> {
    return firstValueFrom(
      this.http.get<EventCardDto[]>(`${API_BASE}/parties/${partieId}/events/list`, {
        withCredentials: true,
      }),
    );
  }

  /** Story 50.2 : le Compteur d'hôte d'un groupe (`GET /parties/:id/host-counts`) — chaque membre actuel et le
   *  nombre de conjonctions passées et non annulées qu'il a reçues. Rejette avec la réponse HTTP (403 pour une
   *  rencontre isolée, une partie de JDR ou un non-membre). Chaque appel émet sa propre requête ; la péremption
   *  des réponses est gérée par l'appelant (compteur de lectures de `HostBars`). */
  hostCounts(partieId: string): Promise<HostCountsDto> {
    return firstValueFrom(
      this.http.get<HostCountsDto>(`${API_BASE}/parties/${partieId}/host-counts`, {
        withCredentials: true,
      }),
    );
  }

  /** Story 49.1 : les jeux sur place d'une soirée à venir (`GET /events/:eventId/board-games`) — les jeux de
   *  l'hôte et le nombre de participants N. Soirée fermée : `games` vide. Chaque appel émet sa propre requête ;
   *  la péremption des réponses est gérée par l'appelant (compteur de requêtes de `EventGamesTab`). */
  boardGames(eventId: string): Promise<EventBoardGamesDto> {
    return firstValueFrom(
      this.http.get<EventBoardGamesDto>(`${API_BASE}/events/${eventId}/board-games`, {
        withCredentials: true,
      }),
    );
  }

  /** Story 49.2 : j'apporte l'un de mes jeux à cette soirée (`PUT …/bring`, 204, idempotent). Rejette avec la
   *  réponse HTTP : 400 soirée close, 403 pas participant ou hôte, 404 jeu retiré entre-temps. */
  async bring(eventId: string, boardGameId: string): Promise<void> {
    await firstValueFrom(
      this.http.put<void>(`${API_BASE}/events/${eventId}/board-games/${boardGameId}/bring`, null, {
        withCredentials: true,
      }),
    );
  }

  /** Story 49.2 : je n'apporte plus ce jeu (`DELETE …/bring`, 204, idempotent). Mêmes refus que `bring`. */
  async unbring(eventId: string, boardGameId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${API_BASE}/events/${eventId}/board-games/${boardGameId}/bring`, {
        withCredentials: true,
      }),
    );
  }

  /** Story 49.4 : l'hôte écarte l'un de ses jeux pour cette soirée (`PUT …/exclusion`, 204, idempotent). Rejette
   *  avec la réponse HTTP : 400 soirée close, 403 pas l'hôte, 404 jeu retiré entre-temps. */
  async exclude(eventId: string, boardGameId: string): Promise<void> {
    await firstValueFrom(
      this.http.put<void>(
        `${API_BASE}/events/${eventId}/board-games/${boardGameId}/exclusion`,
        null,
        { withCredentials: true },
      ),
    );
  }

  /** Story 49.4 : l'hôte remet ce jeu pour cette soirée (`DELETE …/exclusion`, 204, idempotent). Mêmes refus que
   *  `exclude`. */
  async restore(eventId: string, boardGameId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${API_BASE}/events/${eventId}/board-games/${boardGameId}/exclusion`, {
        withCredentials: true,
      }),
    );
  }

  /** Story 49.5 : j'ai envie de jouer à ce jeu ce soir (`PUT …/envies`, corps `{ nameKey }`, 204, idempotent) — par
   *  NOM (la clé normalisée reçue, jamais recalculée), pas par jeu. Rejette avec la réponse HTTP : 400 soirée close ou
   *  nom plus sur place, 403 pas participant. */
  async envy(eventId: string, nameKey: string): Promise<void> {
    await firstValueFrom(
      this.http.put<void>(
        `${API_BASE}/events/${eventId}/envies`,
        { nameKey },
        { withCredentials: true },
      ),
    );
  }

  /** Story 49.5 : je n'ai plus envie de ce jeu (`DELETE …/envies`, corps `{ nameKey }`, 204, idempotent). Mêmes refus
   *  que `envy`, sauf la participation et le « sur place » qui ne sont pas revérifiés. */
  async unenvy(eventId: string, nameKey: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${API_BASE}/events/${eventId}/envies`, {
        body: { nameKey },
        withCredentials: true,
      }),
    );
  }

  /** Story 49.2 : à combien de soirées encore ouvertes l'un de MES jeux est apporté — lu avant de le retirer de
   *  ma Ludothèque. Rejette avec la réponse HTTP (404 : jeu d'autrui ou retiré). */
  broughtCount(boardGameId: string): Promise<BoardGameBroughtCountDto> {
    return firstValueFrom(
      this.http.get<BoardGameBroughtCountDto>(
        `${API_BASE}/me/board-games/${encodeURIComponent(boardGameId)}/brought-count`,
        { withCredentials: true },
      ),
    );
  }

  create(partieId: string, dto: CreateEventDto): Promise<EventCardDto> {
    return firstValueFrom(
      this.http.post<EventCardDto>(`${API_BASE}/parties/${partieId}/events`, dto, {
        withCredentials: true,
      }),
    );
  }

  /** Story 40.3 : s'inscrire à la conjonction dont la séance est `seanceId` — route partagée avec le
   *  JDR (`POST /scenarios/seances/:id/inscription`), qui répond ici la carte à jour. Idempotent côté
   *  serveur ; refus en français (complet 409, passée 400). */
  inscrire(seanceId: string): Promise<EventCardDto> {
    return firstValueFrom(
      this.http.post<EventCardDto>(
        `${API_BASE}/scenarios/seances/${seanceId}/inscription`,
        {},
        { withCredentials: true },
      ),
    );
  }

  /** Story 40.3 : se désinscrire (`DELETE /scenarios/seances/:id/inscription`) — la carte à jour. */
  desinscrire(seanceId: string): Promise<EventCardDto> {
    return firstValueFrom(
      this.http.delete<EventCardDto>(`${API_BASE}/scenarios/seances/${seanceId}/inscription`, {
        withCredentials: true,
      }),
    );
  }

  /** Story 40.4 : accepter la place qui m'est réservée (`PATCH /scenarios/seances/:id/inscription/accept`)
   *  — la carte à jour. Décliner réutilise `desinscrire`. */
  accepter(seanceId: string): Promise<EventCardDto> {
    return firstValueFrom(
      this.http.patch<EventCardDto>(
        `${API_BASE}/scenarios/seances/${seanceId}/inscription/accept`,
        {},
        { withCredentials: true },
      ),
    );
  }

  /** Story 40.4 : l'hôte réserve une place à un membre (`POST /scenarios/seances/:id/reservations`) —
   *  la carte à jour, vue de l'hôte. Refus en français (complet 409, déjà inscrit 409, passée 400…). */
  reserver(seanceId: string, userId: string): Promise<EventCardDto> {
    return firstValueFrom(
      this.http.post<EventCardDto>(
        `${API_BASE}/scenarios/seances/${seanceId}/reservations`,
        { userId },
        { withCredentials: true },
      ),
    );
  }

  /** Story 40.4 : l'hôte retire la réservation d'un membre
   *  (`DELETE /scenarios/seances/:id/reservations/:userId`) — la carte à jour. */
  retirerReservation(seanceId: string, userId: string): Promise<EventCardDto> {
    return firstValueFrom(
      this.http.delete<EventCardDto>(
        `${API_BASE}/scenarios/seances/${seanceId}/reservations/${userId}`,
        { withCredentials: true },
      ),
    );
  }

  /** Story 40.6 : l'hôte fixe la date de sa conjonction depuis son sondage
   *  (`PATCH /parties/:id/poll/:pollId/choose`, route partagée avec le JDR — la famille de la partie décide).
   *  Rien n'est renvoyé : la carte à jour arrive par la relecture de la liste. Refus en français (pas
   *  l'hôte 403, date déjà fixée 400…). */
  choose(partieId: string, pollId: string, optionId: string): Promise<void> {
    return firstValueFrom(
      this.http.patch<void>(
        `${API_BASE}/parties/${partieId}/poll/${pollId}/choose`,
        { optionId },
        { withCredentials: true },
      ),
    );
  }

  /** Story 40.7 : l'hôte prolonge le vote de sa conjonction (`PATCH /parties/:id/poll/:pollId/extend`,
   *  `expiresAt` = clé `YYYY-MM-DD` du nouveau jour d'échéance). Rien n'est renvoyé : la carte à jour arrive
   *  par la relecture de la liste. Refus en français (pas l'hôte 403, jour non postérieur 400…). */
  extend(partieId: string, pollId: string, expiresAt: string): Promise<void> {
    const dto: ExtendPollDto = { expiresAt };
    return firstValueFrom(
      this.http.patch<void>(`${API_BASE}/parties/${partieId}/poll/${pollId}/extend`, dto, {
        withCredentials: true,
      }),
    );
  }

  /** Story 42.1 : l'hôte, ou un administrateur du groupe, annule la conjonction (`POST /parties/:id/events/:eventId/cancel`,
   *  définitif) — renvoie la carte à jour, `cancelled` posé. */
  cancel(partieId: string, eventId: string): Promise<EventCardDto> {
    return firstValueFrom(
      this.http.post<EventCardDto>(
        `${API_BASE}/parties/${partieId}/events/${eventId}/cancel`,
        null,
        {
          withCredentials: true,
        },
      ),
    );
  }

  /** Story 40.2 : l'hôte remplace sa conjonction (`PATCH /parties/:id/events/:eventId`) — renvoie
   *  la carte à jour, participants compris. */
  update(partieId: string, eventId: string, dto: UpdateEventDto): Promise<EventCardDto> {
    return firstValueFrom(
      this.http.patch<EventCardDto>(`${API_BASE}/parties/${partieId}/events/${eventId}`, dto, {
        withCredentials: true,
      }),
    );
  }
}
