import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import type {
  AvailabilityDeclarationDto,
  AvailKind,
  ConflictInfo,
  CreateAvailabilityBatchItem,
  CreateAvailabilityBatchResult,
  CreateAvailabilityDto,
  CreateAvailabilityResult,
  DaySlot,
  MeCalendarDto,
  UpdateAvailabilityDto,
} from '@desdispos/shared';
import { API_BASE } from '../api-base';

export { ConflictInfo };

/** Un conflit rendu par le serveur. `batchIndex` n'est renseigné que par la route groupée
 *  (`BatchConflictInfo`) : c'est la SEULE clé qui relie un conflit à la cellule sélectionnée
 *  qui l'a provoqué — les dates portées par ConflictInfo sont celles de la déclaration
 *  EXISTANTE (nulles pour une récurrente), pas celles du créneau soumis (Story 36.4). */
export type ConflictEntry = ConflictInfo & { batchIndex?: number };

export class ConflictError extends Error {
  constructor(public readonly conflicts: ConflictEntry[]) {
    super('Conflicting declarations detected');
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

const API = API_BASE;

export interface SplitOccurrenceBody {
  occurrence: string; // YYYY-MM-DD
  action: 'modify' | 'delete';
  dto?: { kind: AvailKind; slot: DaySlot };
}

export interface SplitOccurrenceResult {
  created: AvailabilityDeclarationDto[];
  deleted: string[];
}

@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private readonly http = inject(HttpClient);

  // Bug fix (temps réel) : contrat public AD-4 (zéro argument), même forme que
  // CharacterService/HommeDragonService/InvitationsService — appelé par RealtimeService sur un
  // événement SSE partie:{id} (une déclaration modifiée par un joueur affecte le calendrier de
  // toutes les Parties où il est MJ/membre, cf. AvailabilityService backend).
  private readonly _changed = signal(0);
  readonly changed = this._changed.asReadonly();
  notifyChanged(): void {
    this._changed.update((v) => v + 1);
  }

  // Plusieurs composants montés simultanément peuvent recharger sur le même changed() (cf. bug
  // 429 en rafale sur ScenariosService.listAll, même correctif ici) — les appels concurrents
  // partagent la même requête en vol.
  private inFlightGetMyDeclarations: Promise<AvailabilityDeclarationDto[]> | null = null;

  getMyDeclarations(): Promise<AvailabilityDeclarationDto[]> {
    if (this.inFlightGetMyDeclarations) return this.inFlightGetMyDeclarations;
    const request = firstValueFrom(
      this.http.get<AvailabilityDeclarationDto[]>(`${API}/availability`, { withCredentials: true }),
    ).finally(() => (this.inFlightGetMyDeclarations = null));
    this.inFlightGetMyDeclarations = request;
    return request;
  }

  createDeclaration(dto: CreateAvailabilityDto): Promise<CreateAvailabilityResult> {
    return firstValueFrom(
      this.http
        .post<CreateAvailabilityResult>(`${API}/availability`, dto, { withCredentials: true })
        .pipe(
          catchError((err: HttpErrorResponse) => {
            if (err.status === 409 && Array.isArray(err.error?.conflicts)) {
              return throwError(() => new ConflictError(err.error.conflicts as ConflictInfo[]));
            }
            return throwError(() => err);
          }),
        ),
    );
  }

  // Un seul POST portant tout le lot — jamais une boucle sur createDeclaration() (AC1).
  // Depuis la Story 36.4 (D-18), chaque item peut porter sa propre `conflictResolution` : la
  // route groupée n'échoue plus en bloc, elle absorbe l'écrasement et la découpe. Elle ne
  // remplace pas pour autant createDeclaration() — ConstraintPanel reste sur la route unitaire,
  // seul chemin de la contrainte récurrente et de la découpe d'occurrence.
  createDeclarationBatch(
    items: CreateAvailabilityBatchItem[],
  ): Promise<CreateAvailabilityBatchResult> {
    return firstValueFrom(
      this.http
        .post<CreateAvailabilityBatchResult>(
          `${API}/availability/batch`,
          { items },
          { withCredentials: true },
        )
        .pipe(
          catchError((err: HttpErrorResponse) => {
            if (err.status === 409 && Array.isArray(err.error?.conflicts)) {
              return throwError(() => new ConflictError(err.error.conflicts as ConflictEntry[]));
            }
            return throwError(() => err);
          }),
        ),
    );
  }

  updateDeclaration(
    id: string,
    dto: Partial<UpdateAvailabilityDto>,
  ): Promise<AvailabilityDeclarationDto> {
    return firstValueFrom(
      this.http.patch<AvailabilityDeclarationDto>(`${API}/availability/${id}`, dto, {
        withCredentials: true,
      }),
    );
  }

  deleteDeclaration(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${API}/availability/${id}`, { withCredentials: true }),
    );
  }

  splitOccurrence(id: string, body: SplitOccurrenceBody): Promise<SplitOccurrenceResult> {
    return firstValueFrom(
      this.http.post<SplitOccurrenceResult>(`${API}/availability/${id}/split`, body, {
        withCredentials: true,
      }),
    );
  }

  // Story 30.6, AC8/AC10 : un seul appel pour les 5 couches personnelles (Story 30.5, AD-18) —
  // appelé uniquement en contexte personnel (`profile/calendar`), jamais depuis un contexte de
  // partie (AC9), rappelé à chaque changement de plage affichée.
  getMyCalendar(from: string, to: string): Promise<MeCalendarDto> {
    return firstValueFrom(
      this.http.get<MeCalendarDto>(`${API}/me/calendar`, {
        params: { from, to },
        withCredentials: true,
      }),
    );
  }
}
