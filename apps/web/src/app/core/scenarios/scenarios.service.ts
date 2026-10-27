import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  CreateScenarioDto,
  CreateSeancePollDto,
  DaySlot,
  ScenarioDocumentDto,
  ScenarioDto,
  SetCompteRenduDto,
  AddSeanceDto,
  SetInfosPratiquesDto,
  SetResumeFinDto,
  SetSeanceCapacityDto,
  UpdateScenarioDto,
} from '@master-jdr/shared';
import { API_BASE } from '../api-base';

// Sentinel reconnu par matchesPartie() — un événement temps réel générique (Story 19.1) n'a
// jamais de partieId précis à fournir (contrat AD-4, notifyChanged(): void, zéro argument).
const REALTIME_WILDCARD = '*';

/** Vrai si `change` concerne exactement `partieId`, OU provient d'un événement temps réel
 *  générique (wildcard). Fonction pure, testable isolément — même convention que
 *  `matchingHandlers` (Story 18.2). */
export function matchesPartie(change: { partieId: string } | null, partieId: string): boolean {
  return change !== null && (change.partieId === REALTIME_WILDCARD || change.partieId === partieId);
}

@Injectable({ providedIn: 'root' })
export class ScenariosService {
  private readonly http = inject(HttpClient);

  // Émis après chaque mutation réussie (create/update/open) — permet aux composants qui
  // affichent une liste de scénarios chargée ailleurs (ex. ScenarioTimeline, chargée une fois dans
  // un onglet séparé de ScenarioList/ScenarioForm) de savoir qu'ils doivent se recharger, sans
  // dépendre d'une navigation complète (F5) pour voir un changement fait dans un autre onglet.
  // Scopé par Partie (Story 17.3, AC1) : un nouvel objet à chaque appel garantit la notification
  // (Object.is sur la référence), le consommateur compare partieId pour ignorer les mutations
  // survenues sur une autre Partie.
  private readonly _changed = signal<{ partieId: string } | null>(null);
  readonly changed = this._changed.asReadonly();

  private notifyChanged(partieId: string): void {
    this._changed.set({ partieId });
  }

  /** Contrat public AD-4 (zéro argument), appelé par RealtimeService sur un événement SSE
   *  partie:{id} — nom délibérément différent de notifyChanged(partieId), privé et
   *  incompatible en signature (Story 17.3), pour ne toucher aucun de ses 17 appelants. */
  notifyRealtimeChanged(): void {
    this._changed.set({ partieId: REALTIME_WILDCARD });
  }

  async create(partieId: string, dto: CreateScenarioDto): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.post<ScenarioDto>(`${API_BASE}/parties/${partieId}/scenarios`, dto, {
        withCredentials: true,
      }),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  async update(scenarioId: string, dto: UpdateScenarioDto): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.patch<ScenarioDto>(`${API_BASE}/scenarios/${scenarioId}`, dto, {
        withCredentials: true,
      }),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  listDrafts(partieId: string): Promise<ScenarioDto[]> {
    return firstValueFrom(
      this.http.get<ScenarioDto[]>(`${API_BASE}/parties/${partieId}/scenarios/drafts`, {
        withCredentials: true,
      }),
    );
  }

  // Un seul événement temps réel (changed()) fait recharger plusieurs composants montés
  // simultanément (ScenarioTimeline, SeanceList, CalendarView…) — sans déduplication, chacun émet
  // sa propre requête GET identique, ce qui peut déclencher le throttler API en rafale (bug : 429
  // en boucle, "impossible de charger la chronologie"). Les appels concurrents pour la même Partie
  // partagent donc la même requête en vol.
  private readonly inFlightListAll = new Map<string, Promise<ScenarioDto[]>>();

  listAll(partieId: string): Promise<ScenarioDto[]> {
    const existing = this.inFlightListAll.get(partieId);
    if (existing) return existing;
    const request = firstValueFrom(
      this.http.get<ScenarioDto[]>(`${API_BASE}/parties/${partieId}/scenarios`, {
        withCredentials: true,
      }),
    ).finally(() => this.inFlightListAll.delete(partieId));
    this.inFlightListAll.set(partieId, request);
    return request;
  }

  async open(scenarioId: string): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.patch<ScenarioDto>(
        `${API_BASE}/scenarios/${scenarioId}/open`,
        {},
        { withCredentials: true },
      ),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  async markCourant(scenarioId: string): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.patch<ScenarioDto>(
        `${API_BASE}/scenarios/${scenarioId}/courant`,
        {},
        { withCredentials: true },
      ),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  async close(scenarioId: string): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.patch<ScenarioDto>(
        `${API_BASE}/scenarios/${scenarioId}/passe`,
        {},
        { withCredentials: true },
      ),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  async participate(scenarioId: string): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.post<ScenarioDto>(
        `${API_BASE}/scenarios/${scenarioId}/participate`,
        {},
        { withCredentials: true },
      ),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  /** Story 47.1 : `durationSlots` = durée de la nouvelle séance en créneaux enchaînés (absente = 1). */
  async addSeance(scenarioId: string, durationSlots?: number): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.post<ScenarioDto>(
        `${API_BASE}/scenarios/${scenarioId}/seances`,
        (durationSlots === undefined ? {} : { durationSlots }) satisfies AddSeanceDto,
        { withCredentials: true },
      ),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  async createSeancePoll(
    seanceId: string,
    options: { date: string; slot: DaySlot }[],
    /** Story 45.4 — la fin du vote (jour `YYYY-MM-DD`) ; absente, le serveur propose la sienne. */
    expiresAt?: string,
    /** Story 47.4 — la durée du rendez-vous, écrite avec le vote (même transaction) ; absente = inchangée. */
    durationSlots?: number,
  ): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.post<ScenarioDto>(
        `${API_BASE}/scenarios/seances/${seanceId}/poll`,
        {
          options,
          ...(expiresAt ? { expiresAt } : {}),
          ...(durationSlots !== undefined ? { durationSlots } : {}),
        } satisfies CreateSeancePollDto,
        { withCredentials: true },
      ),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  async deleteSeance(seanceId: string): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.delete<ScenarioDto>(`${API_BASE}/scenarios/seances/${seanceId}`, {
        withCredentials: true,
      }),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  async resetSeanceDate(seanceId: string): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.patch<ScenarioDto>(
        `${API_BASE}/scenarios/seances/${seanceId}/reset-date`,
        {},
        { withCredentials: true },
      ),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  async setSeanceCapacity(
    seanceId: string,
    inscriptionMin: number,
    inscriptionMax: number,
  ): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.patch<ScenarioDto>(
        `${API_BASE}/scenarios/seances/${seanceId}/capacite`,
        { inscriptionMin, inscriptionMax } satisfies SetSeanceCapacityDto,
        { withCredentials: true },
      ),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  async inscrire(seanceId: string): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.post<ScenarioDto>(
        `${API_BASE}/scenarios/seances/${seanceId}/inscription`,
        {},
        { withCredentials: true },
      ),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  async desinscrire(seanceId: string): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.delete<ScenarioDto>(`${API_BASE}/scenarios/seances/${seanceId}/inscription`, {
        withCredentials: true,
      }),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  async setCompteRendu(seanceId: string, compteRendu: string): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.patch<ScenarioDto>(
        `${API_BASE}/scenarios/seances/${seanceId}/compte-rendu`,
        { compteRendu } satisfies SetCompteRenduDto,
        { withCredentials: true },
      ),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  /** Informations pratiques d'une séance (Story 36.5). Un seul PATCH pour les trois champs :
   *  le MJ les saisit ensemble, et `null` vide un champ. Retour du `ScenarioDto` complet puis
   *  `notifyChanged`, qui repropage vers ScenarioTimeline, SeanceList et CalendarView. */
  async setInfosPratiques(seanceId: string, dto: SetInfosPratiquesDto): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.patch<ScenarioDto>(
        `${API_BASE}/scenarios/seances/${seanceId}/infos-pratiques`,
        dto satisfies SetInfosPratiquesDto,
        { withCredentials: true },
      ),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  async setResumeFin(scenarioId: string, resumeFin: string): Promise<ScenarioDto> {
    const result = await firstValueFrom(
      this.http.patch<ScenarioDto>(
        `${API_BASE}/scenarios/${scenarioId}/resume-fin`,
        { resumeFin } satisfies SetResumeFinDto,
        { withCredentials: true },
      ),
    );
    this.notifyChanged(result.partieId);
    return result;
  }

  uploadDocument(partieId: string, file: File, scenarioId?: string): Promise<ScenarioDocumentDto> {
    const form = new FormData();
    form.append('file', file);
    if (scenarioId) form.append('scenarioId', scenarioId);
    return firstValueFrom(
      this.http.post<ScenarioDocumentDto>(`${API_BASE}/parties/${partieId}/documents`, form, {
        withCredentials: true,
      }),
    );
  }

  listDocuments(scenarioId: string): Promise<ScenarioDocumentDto[]> {
    return firstValueFrom(
      this.http.get<ScenarioDocumentDto[]>(`${API_BASE}/scenarios/${scenarioId}/documents`, {
        withCredentials: true,
      }),
    );
  }

  listLibraryDocuments(partieId: string): Promise<ScenarioDocumentDto[]> {
    return firstValueFrom(
      this.http.get<ScenarioDocumentDto[]>(`${API_BASE}/parties/${partieId}/documents`, {
        withCredentials: true,
      }),
    );
  }

  downloadDocument(documentId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${API_BASE}/documents/${documentId}`, {
        responseType: 'blob',
        withCredentials: true,
      }),
    );
  }
}
