import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  CharacterDto,
  CharacterNoteDto,
  CharacterSnapshotDto,
  CreateAnimalDto,
  CreateCharacterDto,
  CreateCharacterNoteDto,
  CreateContenantDto,
  CreateInventoryItemDto,
  CreateLevelUpDto,
  GameSystemContentDto,
  GameSystemDto,
  GameSystemSchemaDto,
  MyCharacterDto,
  SetJournalAutoAssociateDto,
  SetNoteScenarioDto,
  SetSheetFieldResultDto,
  UpdateAnimalDto,
  UpdateContenantDto,
  UpdateInventoryItemDto,
} from '@desdispos/shared';
import { API_BASE } from '../api-base';

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private readonly http = inject(HttpClient);
  // Story 20.1 (AC2) : première introduction de ce signal (contrat AD-4, même forme que
  // PartiesService — compteur incrémenté, zéro information de Partie à porter).
  private readonly _changed = signal(0);
  readonly changed = this._changed.asReadonly();
  notifyChanged(): void {
    this._changed.update((v) => v + 1);
  }

  getGameSystems(): Promise<GameSystemDto[]> {
    return firstValueFrom(
      this.http.get<GameSystemDto[]>(`${API_BASE}/game-systems`, { withCredentials: true }),
    );
  }

  getGameSystemSchema(id: string): Promise<GameSystemSchemaDto> {
    return firstValueFrom(
      this.http.get<GameSystemSchemaDto>(`${API_BASE}/game-systems/${id}/schema`, {
        withCredentials: true,
      }),
    );
  }

  getGameSystemContent(id: string): Promise<GameSystemContentDto> {
    return firstValueFrom(
      this.http.get<GameSystemContentDto>(`${API_BASE}/game-systems/${id}/content`, {
        withCredentials: true,
      }),
    );
  }

  getGameSystemAsset(partieId: string, systemId: string, key: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${API_BASE}/parties/${partieId}/game-systems/${systemId}/assets/${key}`, {
        responseType: 'blob',
        withCredentials: true,
      }),
    );
  }

  create(partieId: string, dto: CreateCharacterDto): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.post<CharacterDto>(`${API_BASE}/parties/${partieId}/characters`, dto, {
        withCredentials: true,
      }),
    );
  }

  // Plusieurs composants montés simultanément peuvent recharger sur le même changed() (cf. bug
  // 429 en rafale sur ScenariosService.listAll, même correctif ici) — les appels concurrents pour
  // la même clé partagent la même requête en vol.
  private readonly inFlightListByPartie = new Map<string, Promise<CharacterDto[]>>();
  private readonly inFlightGet = new Map<string, Promise<CharacterDto>>();

  listByPartie(partieId: string): Promise<CharacterDto[]> {
    const existing = this.inFlightListByPartie.get(partieId);
    if (existing) return existing;
    const request = firstValueFrom(
      this.http.get<CharacterDto[]>(`${API_BASE}/parties/${partieId}/characters`, {
        withCredentials: true,
      }),
    ).finally(() => this.inFlightListByPartie.delete(partieId));
    this.inFlightListByPartie.set(partieId, request);
    return request;
  }

  /** Tous les personnages de l'utilisateur courant, toutes parties confondues (Story 29.2). Un seul
   *  appelant (l'écran « mes personnages ») — pas de cache in-flight requis ici, contrairement à
   *  `listByPartie`/`get`. */
  listMine(): Promise<MyCharacterDto[]> {
    return firstValueFrom(
      this.http.get<MyCharacterDto[]>(`${API_BASE}/me/characters`, { withCredentials: true }),
    );
  }

  get(id: string): Promise<CharacterDto> {
    const existing = this.inFlightGet.get(id);
    if (existing) return existing;
    const request = firstValueFrom(
      this.http.get<CharacterDto>(`${API_BASE}/characters/${id}`, { withCredentials: true }),
    ).finally(() => this.inFlightGet.delete(id));
    this.inFlightGet.set(id, request);
    return request;
  }

  exportPdf(id: string, format: 'editable' | '2pages'): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${API_BASE}/characters/${id}/export.pdf`, {
        params: { format },
        responseType: 'blob',
        withCredentials: true,
      }),
    );
  }

  exportEquipmentPdf(id: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${API_BASE}/characters/${id}/export-equipment.pdf`, {
        responseType: 'blob',
        withCredentials: true,
      }),
    );
  }

  exportNotesPdf(id: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${API_BASE}/characters/${id}/export-notes.pdf`, {
        responseType: 'blob',
        withCredentials: true,
      }),
    );
  }

  updatePortrait(
    id: string,
    file: File,
    cropData: { scale: number; offsetX: number; offsetY: number } | null,
  ): Promise<CharacterDto> {
    const form = new FormData();
    form.append('file', file);
    if (cropData) form.append('cropData', JSON.stringify(cropData));
    return firstValueFrom(
      this.http.put<CharacterDto>(`${API_BASE}/characters/${id}/portrait`, form, {
        withCredentials: true,
      }),
    );
  }

  removePortrait(id: string): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.delete<CharacterDto>(`${API_BASE}/characters/${id}/portrait`, {
        withCredentials: true,
      }),
    );
  }

  /** Enregistre le recadrage dédié à l'export PDF — pas de fichier, l'image source existe déjà. */
  patchPdfPortraitCrop(
    id: string,
    cropData: { scale: number; offsetX: number; offsetY: number },
  ): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.patch<CharacterDto>(`${API_BASE}/characters/${id}/pdf-portrait-crop`, cropData, {
        withCredentials: true,
      }),
    );
  }

  /** Récupère les octets du portrait existant (utilisé par `PortraitCropper` pour permettre un réajustement du recadrage sans re-sélection de fichier, AC4). */
  getPortraitBlob(id: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${API_BASE}/characters/${id}/portrait`, {
        responseType: 'blob',
        withCredentials: true,
      }),
    );
  }

  levelUp(id: string, dto: CreateLevelUpDto): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.post<CharacterDto>(`${API_BASE}/characters/${id}/level-up`, dto, {
        withCredentials: true,
      }),
    );
  }

  getHistory(id: string): Promise<CharacterSnapshotDto[]> {
    return firstValueFrom(
      this.http.get<CharacterSnapshotDto[]>(`${API_BASE}/characters/${id}/history`, {
        withCredentials: true,
      }),
    );
  }

  addInventoryItem(id: string, dto: CreateInventoryItemDto): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.post<CharacterDto>(`${API_BASE}/characters/${id}/inventory-items`, dto, {
        withCredentials: true,
      }),
    );
  }

  updateInventoryItem(
    id: string,
    itemId: string,
    dto: UpdateInventoryItemDto,
  ): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.patch<CharacterDto>(`${API_BASE}/characters/${id}/inventory-items/${itemId}`, dto, {
        withCredentials: true,
      }),
    );
  }

  removeInventoryItem(id: string, itemId: string): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.delete<CharacterDto>(`${API_BASE}/characters/${id}/inventory-items/${itemId}`, {
        withCredentials: true,
      }),
    );
  }

  addContenant(id: string, dto: CreateContenantDto): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.post<CharacterDto>(`${API_BASE}/characters/${id}/contenants`, dto, {
        withCredentials: true,
      }),
    );
  }

  updateContenant(id: string, itemId: string, dto: UpdateContenantDto): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.patch<CharacterDto>(`${API_BASE}/characters/${id}/contenants/${itemId}`, dto, {
        withCredentials: true,
      }),
    );
  }

  removeContenant(id: string, itemId: string): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.delete<CharacterDto>(`${API_BASE}/characters/${id}/contenants/${itemId}`, {
        withCredentials: true,
      }),
    );
  }

  addAnimal(id: string, dto: CreateAnimalDto): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.post<CharacterDto>(`${API_BASE}/characters/${id}/animaux`, dto, {
        withCredentials: true,
      }),
    );
  }

  updateAnimal(id: string, itemId: string, dto: UpdateAnimalDto): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.patch<CharacterDto>(`${API_BASE}/characters/${id}/animaux/${itemId}`, dto, {
        withCredentials: true,
      }),
    );
  }

  removeAnimal(id: string, itemId: string): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.delete<CharacterDto>(`${API_BASE}/characters/${id}/animaux/${itemId}`, {
        withCredentials: true,
      }),
    );
  }

  addNote(id: string, dto: CreateCharacterNoteDto): Promise<CharacterNoteDto> {
    return firstValueFrom(
      this.http.post<CharacterNoteDto>(`${API_BASE}/characters/${id}/notes`, dto, {
        withCredentials: true,
      }),
    );
  }

  toggleNoteShare(id: string, noteId: string, shared: boolean): Promise<CharacterNoteDto> {
    return firstValueFrom(
      this.http.patch<CharacterNoteDto>(
        `${API_BASE}/characters/${id}/notes/${noteId}/share`,
        { shared },
        { withCredentials: true },
      ),
    );
  }

  setJournalAutoAssociate(id: string, value: boolean): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.patch<CharacterDto>(
        `${API_BASE}/characters/${id}/journal-auto-associate`,
        { journalAutoAssociate: value } satisfies SetJournalAutoAssociateDto,
        { withCredentials: true },
      ),
    );
  }

  setNoteScenario(
    id: string,
    noteId: string,
    scenarioId: string | null,
  ): Promise<CharacterNoteDto> {
    return firstValueFrom(
      this.http.patch<CharacterNoteDto>(
        `${API_BASE}/characters/${id}/notes/${noteId}/scenario`,
        { scenarioId } satisfies SetNoteScenarioDto,
        { withCredentials: true },
      ),
    );
  }

  getNotes(id: string): Promise<CharacterNoteDto[]> {
    return firstValueFrom(
      this.http.get<CharacterNoteDto[]>(`${API_BASE}/characters/${id}/notes`, {
        withCredentials: true,
      }),
    );
  }

  setXp(id: string, value: number): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.patch<CharacterDto>(
        `${API_BASE}/characters/${id}/xp`,
        { value },
        { withCredentials: true },
      ),
    );
  }

  setSheetField(id: string, path: string, value: unknown): Promise<SetSheetFieldResultDto> {
    return firstValueFrom(
      this.http.patch<SetSheetFieldResultDto>(
        `${API_BASE}/characters/${id}/sheet-field`,
        { path, value },
        { withCredentials: true },
      ),
    );
  }

  updateNarrativeField(id: string, field: string, value: unknown): Promise<CharacterDto> {
    return firstValueFrom(
      this.http.patch<CharacterDto>(
        `${API_BASE}/characters/${id}/narrative-field`,
        { field, value },
        { withCredentials: true },
      ),
    );
  }
}
