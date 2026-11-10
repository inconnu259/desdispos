import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  ChooseArtefactCadeauDto,
  ChooseEveilPowerDto,
  CreateHommeDragonDto,
  HommeDragonDto,
  HommeDragonRefDto,
  MyHommeDragonDto,
  SetReserveSlotDto,
  UpdateHommeDragonDto,
} from '@master-jdr/shared';
import { API_BASE } from '../api-base';

/**
 * Homme Dragon (Epic 10, 33 ; AD-23, Story 33.8). La fiche s'adresse par SON id
 * (`/homme-dragons/:id`, propriétaire seul : `404` pour tout autre) ; une partie (« aventure »)
 * ne sert qu'à créer, associer ou dissocier (`/parties/:id/homme-dragon…`).
 */
@Injectable({ providedIn: 'root' })
export class HommeDragonService {
  private readonly http = inject(HttpClient);
  // Story 20.2 (AC2) : première introduction de ce signal (contrat AD-4, même forme que
  // CharacterService/PartiesService — compteur incrémenté, zéro information de Partie à porter).
  // AD-23 : câblé sur le canal `user:{id}` (la fiche n'ouvre aucun canal `partie:`).
  private readonly _changed = signal(0);
  readonly changed = this._changed.asReadonly();
  notifyChanged(): void {
    this._changed.update((v) => v + 1);
  }

  // Plusieurs composants montés simultanément peuvent recharger sur le même changed() (cf. bug
  // 429 en rafale sur ScenariosService.listAll, même correctif ici) — les appels concurrents pour
  // le même Homme Dragon partagent la même requête en vol.
  private readonly inFlightFindOne = new Map<string, Promise<HommeDragonDto>>();

  /** La fiche d'un Homme Dragon (propriétaire seul). `404` pour un Homme Dragon absent ou étranger. */
  findOne(hommeDragonId: string): Promise<HommeDragonDto> {
    const existing = this.inFlightFindOne.get(hommeDragonId);
    if (existing) return existing;
    const request = firstValueFrom(
      this.http.get<HommeDragonDto>(`${API_BASE}/homme-dragons/${hommeDragonId}`, {
        withCredentials: true,
      }),
    ).finally(() => this.inFlightFindOne.delete(hommeDragonId));
    this.inFlightFindOne.set(hommeDragonId, request);
    return request;
  }

  /** L'Homme Dragon lié à une aventure (`{ id, nom }`), ou `null` — MJ de la partie seul. */
  findForPartie(partieId: string): Promise<HommeDragonRefDto | null> {
    return firstValueFrom(
      this.http.get<HommeDragonRefDto | null>(`${API_BASE}/parties/${partieId}/homme-dragon`, {
        withCredentials: true,
      }),
    );
  }

  /** Mes Hommes Dragons pour « Personnages » (Story 33.5) — une seule lecture agrégée, jamais une
   *  requête par fiche. Une ligne par Homme Dragon, `aventures` éventuellement vide (AD-23). */
  listMine(): Promise<MyHommeDragonDto[]> {
    return firstValueFrom(
      this.http.get<MyHommeDragonDto[]>(`${API_BASE}/me/homme-dragons`, {
        withCredentials: true,
      }),
    );
  }

  /** Crée ET lie à l'aventure (transaction côté serveur) — aucune création hors aventure. */
  create(partieId: string, dto: CreateHommeDragonDto): Promise<HommeDragonDto> {
    return firstValueFrom(
      this.http.post<HommeDragonDto>(`${API_BASE}/parties/${partieId}/homme-dragon`, dto, {
        withCredentials: true,
      }),
    );
  }

  /** Associe un Homme Dragon existant à l'aventure (`409` si elle en a déjà un). Renvoie la fiche
   *  à jour (niveau et historique cumulés). */
  link(partieId: string, hommeDragonId: string): Promise<HommeDragonDto> {
    return firstValueFrom(
      this.http.put<HommeDragonDto>(
        `${API_BASE}/parties/${partieId}/homme-dragon/${hommeDragonId}`,
        null,
        { withCredentials: true },
      ),
    );
  }

  /** Dissocie l'Homme Dragon de l'aventure : la fiche est conservée, le niveau est recalculé
   *  (il peut baisser), rien n'est purgé. */
  unlink(partieId: string, hommeDragonId: string): Promise<HommeDragonDto> {
    return firstValueFrom(
      this.http.delete<HommeDragonDto>(
        `${API_BASE}/parties/${partieId}/homme-dragon/${hommeDragonId}`,
        { withCredentials: true },
      ),
    );
  }

  update(hommeDragonId: string, dto: UpdateHommeDragonDto): Promise<HommeDragonDto> {
    return firstValueFrom(
      this.http.patch<HommeDragonDto>(`${API_BASE}/homme-dragons/${hommeDragonId}`, dto, {
        withCredentials: true,
      }),
    );
  }

  chooseEveilPower(hommeDragonId: string, dto: ChooseEveilPowerDto): Promise<HommeDragonDto> {
    return firstValueFrom(
      this.http.post<HommeDragonDto>(
        `${API_BASE}/homme-dragons/${hommeDragonId}/eveil-power`,
        dto,
        { withCredentials: true },
      ),
    );
  }

  /** Choix unique et définitif de l'artefact cadeau du niveau 4 (Story 33.7). */
  chooseArtefactCadeau(
    hommeDragonId: string,
    dto: ChooseArtefactCadeauDto,
  ): Promise<HommeDragonDto> {
    return firstValueFrom(
      this.http.post<HommeDragonDto>(
        `${API_BASE}/homme-dragons/${hommeDragonId}/artefact-cadeau`,
        dto,
        { withCredentials: true },
      ),
    );
  }

  /** Écrit UN emplacement de la réserve de souffles (Story 33.6) — `slot` 1-based, `key: null`
   *  retire le souffle. Renvoie la fiche entière à jour ; n'appelle PAS `notifyChanged()` : une
   *  écriture de fiche n'émet rien côté serveur (AD-23), la section applique la réponse
   *  directement. */
  setReserveSlot(
    hommeDragonId: string,
    slot: number,
    dto: SetReserveSlotDto,
  ): Promise<HommeDragonDto> {
    return firstValueFrom(
      this.http.put<HommeDragonDto>(
        `${API_BASE}/homme-dragons/${hommeDragonId}/reserve/${slot}`,
        dto,
        { withCredentials: true },
      ),
    );
  }

  exportPdf(hommeDragonId: string, format: 'editable' | '2pages'): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${API_BASE}/homme-dragons/${hommeDragonId}/export.pdf`, {
        params: { format },
        responseType: 'blob',
        withCredentials: true,
      }),
    );
  }
}
