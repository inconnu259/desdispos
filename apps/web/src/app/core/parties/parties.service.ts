import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  CreateXpDistributionDto,
  InviteLinkDto,
  MembershipRole,
  PartieDto,
  PartieKind,
  PartieMemberDto,
  UserSearchResultDto,
  VisibilityLockPathDto,
  XpDistributionDto,
} from '@master-jdr/shared';
import { API_BASE } from '../api-base';

// `API_BASE` (importé ci-dessus) était masqué par une redéfinition en dur — corrigé pour que l'app
// reste fonctionnelle depuis un autre appareil que le poste de dev (cf. core/api-base.ts).
const API = API_BASE;

export interface PartiePayload {
  name: string;
  gameSystemId: string;
  kind: PartieKind;
  description?: string;
}

export interface InviteLinkPayload {
  maxUses?: number;
  expiresAt?: string;
}

@Injectable({ providedIn: 'root' })
export class PartiesService {
  private readonly http = inject(HttpClient);

  // AD-4 : contrat public générique, zéro argument. Compteur simple (pas de scoping par
  // partieId comme ScenariosService/Story 17.3) — inutile ici : RealtimeService ne notifie ce
  // service que pour le topic `partie:{id}` sur lequel PartieDetail s'est explicitement
  // connecté (Story 18.2, un seul PartieDetail monté à la fois par instance d'app), donc tout
  // appel de notifyChanged() concerne nécessairement LA Partie actuellement affichée.
  private readonly _changed = signal(0);
  readonly changed = this._changed.asReadonly();
  notifyChanged(): void {
    this._changed.update((v) => v + 1);
  }

  /** Sans rôle (Story 38.5) : TOUTES les parties de l'utilisateur, chacune avec son rôle
   *  (`mj | player | admin | member`) — une seule lecture, ralliements inclus. Avec un rôle, la
   *  liste historique par rôle (qui exclut les ralliements). */
  list(role?: 'mj' | 'player'): Promise<PartieDto[]> {
    const url = role ? `${API}/parties?role=${role}` : `${API}/parties`;
    return firstValueFrom(this.http.get<PartieDto[]>(url, { withCredentials: true }));
  }

  /** Story 42.5 : retire DÉFINITIVEMENT de SA liste une partie terminée ou annulée (`PUT /parties/:id/hidden`,
   *  idempotent, pour soi seul). Le serveur est seul juge (400 si la partie n'est pas terminée ni annulée). */
  hide(partieId: string): Promise<{ ok: true }> {
    return firstValueFrom(
      this.http.put<{ ok: true }>(
        `${API}/parties/${partieId}/hidden`,
        {},
        { withCredentials: true },
      ),
    );
  }

  // Plusieurs composants montés simultanément peuvent recharger sur le même changed() (cf. bug
  // 429 en rafale sur ScenariosService.listAll, même correctif ici) — les appels concurrents pour
  // la même clé partagent la même requête en vol.
  private readonly inFlightGet = new Map<string, Promise<PartieDto>>();
  private readonly inFlightMembers = new Map<string, Promise<PartieMemberDto[]>>();

  get(id: string): Promise<PartieDto> {
    const existing = this.inFlightGet.get(id);
    if (existing) return existing;
    const request = firstValueFrom(
      this.http.get<PartieDto>(`${API}/parties/${id}`, { withCredentials: true }),
    ).finally(() => this.inFlightGet.delete(id));
    this.inFlightGet.set(id, request);
    return request;
  }

  create(payload: PartiePayload): Promise<PartieDto> {
    return firstValueFrom(
      this.http.post<PartieDto>(`${API}/parties`, payload, { withCredentials: true }),
    );
  }

  update(id: string, payload: Partial<PartiePayload>): Promise<PartieDto> {
    return firstValueFrom(
      this.http.patch<PartieDto>(`${API}/parties/${id}`, payload, { withCredentials: true }),
    );
  }

  /** Conversion du type d'une partie (Story 29.14) — route dédiée : `update()` rejette désormais
   *  tout changement de `kind`, la conversion étant une opération à effets (création de scénario,
   *  semis de participants, rétrogradation de statuts) et non une édition de champ.
   *  `courantScenarioId` n'est attendu que quand la matrice signale `requiresCourantChoice`. */
  convertKind(id: string, kind: PartieKind, courantScenarioId?: string): Promise<PartieDto> {
    return firstValueFrom(
      this.http.patch<PartieDto>(
        `${API}/parties/${id}/kind`,
        courantScenarioId ? { kind, courantScenarioId } : { kind },
        { withCredentials: true },
      ),
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${API}/parties/${id}`, { withCredentials: true }),
    );
  }

  /** Dépose l'image de couverture (Story 29.12, AC1) — recadrage centré automatique côté serveur,
   *  aucune donnée de recadrage à transmettre (contrairement au portrait de personnage). */
  setCoverImage(id: string, file: File): Promise<PartieDto> {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(
      this.http.put<PartieDto>(`${API}/parties/${id}/cover`, form, { withCredentials: true }),
    );
  }

  /** Retire l'image de couverture (AC3) — la bannière générée reprend sa place. */
  removeCoverImage(id: string): Promise<PartieDto> {
    return firstValueFrom(
      this.http.delete<PartieDto>(`${API}/parties/${id}/cover`, { withCredentials: true }),
    );
  }

  close(id: string): Promise<PartieDto> {
    return firstValueFrom(
      this.http.patch<PartieDto>(`${API}/parties/${id}/close`, {}, { withCredentials: true }),
    );
  }

  reopen(id: string): Promise<PartieDto> {
    return firstValueFrom(
      this.http.patch<PartieDto>(`${API}/parties/${id}/reopen`, {}, { withCredentials: true }),
    );
  }

  // --- Membres & invitations (1c) ---

  searchUsers(q: string): Promise<UserSearchResultDto[]> {
    return firstValueFrom(
      this.http.get<UserSearchResultDto[]>(`${API}/users/search?q=${encodeURIComponent(q)}`, {
        withCredentials: true,
      }),
    );
  }

  members(id: string): Promise<PartieMemberDto[]> {
    const existing = this.inFlightMembers.get(id);
    if (existing) return existing;
    const request = firstValueFrom(
      this.http.get<PartieMemberDto[]>(`${API}/parties/${id}/members`, { withCredentials: true }),
    ).finally(() => this.inFlightMembers.delete(id));
    this.inFlightMembers.set(id, request);
    return request;
  }

  removeMember(id: string, userId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${API}/parties/${id}/members/${userId}`, { withCredentials: true }),
    );
  }

  /** Story 39.5 : quitter soi-même un groupe (`DELETE /parties/:id/members/me`). `deleteIfLastAdmin`
   *  n'est transmis que s'il est vrai : il confirme que le départ du DERNIER administrateur supprime
   *  le groupe — sans lui, le serveur refuse (409). L'interface ne l'envoie jamais aujourd'hui (seul
   *  un simple membre se voit offrir « Quitter le groupe »). */
  leave(id: string, deleteIfLastAdmin = false): Promise<{ ok: true; deleted: boolean }> {
    return firstValueFrom(
      this.http.delete<{ ok: true; deleted: boolean }>(`${API}/parties/${id}/members/me`, {
        withCredentials: true,
        ...(deleteIfLastAdmin ? { params: { deleteIfLastAdmin: 'true' } } : {}),
      }),
    );
  }

  /** Story 39.4 : nommer un administrateur (`ADMIN`, sur un autre membre) ou quitter l'office
   *  (`MEMBER`, sur soi-même). `deleteIfLastAdmin` n'est envoyé que par la confirmation du DERNIER
   *  administrateur : sans lui, le serveur refuse (409) plutôt que de supprimer le groupe. */
  setMemberRole(
    id: string,
    userId: string,
    payload: { role: MembershipRole; deleteIfLastAdmin?: boolean },
  ): Promise<{ ok: true; deleted: boolean }> {
    return firstValueFrom(
      this.http.patch<{ ok: true; deleted: boolean }>(
        `${API}/parties/${id}/members/${userId}/role`,
        payload,
        { withCredentials: true },
      ),
    );
  }

  inviteUser(id: string, inviteeUserId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        `${API}/parties/${id}/invitations`,
        { inviteeUserId },
        { withCredentials: true },
      ),
    );
  }

  inviteByEmail(id: string, email: string): Promise<{ ok: boolean }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean }>(
        `${API}/parties/${id}/invitations/by-email`,
        { email },
        { withCredentials: true },
      ),
    );
  }

  inviteLinks(id: string): Promise<InviteLinkDto[]> {
    return firstValueFrom(
      this.http.get<InviteLinkDto[]>(`${API}/parties/${id}/invite-links`, {
        withCredentials: true,
      }),
    );
  }

  createInviteLink(id: string, payload: InviteLinkPayload): Promise<InviteLinkDto> {
    return firstValueFrom(
      this.http.post<InviteLinkDto>(`${API}/parties/${id}/invite-links`, payload, {
        withCredentials: true,
      }),
    );
  }

  revokeInviteLink(linkId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${API}/invite-links/${linkId}`, { withCredentials: true }),
    );
  }

  // --- Distribution d'XP (Story 6.2) ---

  createXpDistribution(id: string, payload: CreateXpDistributionDto): Promise<XpDistributionDto> {
    return firstValueFrom(
      this.http.post<XpDistributionDto>(`${API_BASE}/parties/${id}/xp-distributions`, payload, {
        withCredentials: true,
      }),
    );
  }

  listXpDistributions(id: string): Promise<XpDistributionDto[]> {
    return firstValueFrom(
      this.http.get<XpDistributionDto[]>(`${API_BASE}/parties/${id}/xp-distributions`, {
        withCredentials: true,
      }),
    );
  }

  // --- Cadenas de visibilité (Story 31.6/31.7) ---

  getVisibilityLocks(id: string): Promise<VisibilityLockPathDto[]> {
    return firstValueFrom(
      this.http.get<VisibilityLockPathDto[]>(`${API}/parties/${id}/visibility-locks`, {
        withCredentials: true,
      }),
    );
  }

  /** Enregistrement DÉCLARATIF COMPLET (jamais un delta, même patron que `setOptions()`,
   *  Story 36.10) — `paths` décrit l'état voulu en entier. */
  setVisibilityLocks(
    id: string,
    paths: { fieldKey: string; subField?: string }[],
  ): Promise<VisibilityLockPathDto[]> {
    return firstValueFrom(
      this.http.put<VisibilityLockPathDto[]>(
        `${API}/parties/${id}/visibility-locks`,
        { paths },
        { withCredentials: true },
      ),
    );
  }
}
