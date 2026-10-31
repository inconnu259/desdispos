import { ForbiddenException, Injectable } from '@nestjs/common';
import type { HostCountsDto } from '@master-jdr/shared';
import {
  PermissionService,
  RALLIEMENT_UNAVAILABLE_MESSAGE,
} from '../permissions/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService, isRalliementGroup } from './events.service';

/** Ligne `User` lue pour un membre — pseudo et nom affiché, jamais l'e-mail. */
interface HostMemberRow {
  userId: string;
  pseudo: string;
  displayName: string;
}

/** Ordre des membres : le plus grand compte d'abord, puis nom affiché (accents et casse ignorés), pseudo et
 *  identifiant — total et stable, sans mise en avant d'aucune sorte. */
function compareMembers(
  a: HostMemberRow & { count: number },
  b: HostMemberRow & { count: number },
) {
  return (
    b.count - a.count ||
    a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' }) ||
    a.pseudo.localeCompare(b.pseudo, 'fr', { sensitivity: 'base' }) ||
    a.userId.localeCompare(b.userId)
  );
}

/**
 * Projection explicite du Compteur d'hôte (Story 50.2) : champ par champ, jamais d'étalement. Chaque membre actuel
 * figure, à 0 s'il n'a jamais reçu ; les hôtes qui ne sont plus membres (ou n'ont plus de compte) sont écartés —
 * leurs événements ne sont attribués à personne.
 */
export function toHostCountsDto(
  members: HostMemberRow[],
  hosted: { hostId: string; count: number }[],
): HostCountsDto {
  const countOf = new Map(hosted.map((h) => [h.hostId, h.count]));
  const rows = members.map((m) => ({
    userId: m.userId,
    pseudo: m.pseudo,
    displayName: m.displayName,
    count: countOf.get(m.userId) ?? 0,
  }));
  return { members: rows.sort(compareMembers) };
}

/**
 * Le Compteur d'hôte d'un groupe (épic 50, Story 50.2) : qui a reçu le groupe, et combien de fois. Le droit est
 * décidé par `PermissionService` (`PARTIE_READ`) AVANT toute lecture ; seul un GROUPE a un Compteur (une rencontre
 * isolée ou une partie de JDR répond le même 403 que les jeux sur place). Les comptes viennent d'`EventsService`
 * (écrivain d'`Event`) ; ce service ne lit que les membres actuels. Aucune émission : une lecture ne change rien.
 */
@Injectable()
export class EventHostCountsService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly events: EventsService,
    private readonly prisma: PrismaService,
  ) {}

  async list(partieId: string, userId: string): Promise<HostCountsDto> {
    const { partie } = await this.permissions.assert(userId, 'PARTIE_READ', { partieId });
    if (!isRalliementGroup(partie)) {
      throw new ForbiddenException(RALLIEMENT_UNAVAILABLE_MESSAGE);
    }
    const [memberships, hosted] = await Promise.all([
      this.prisma.membership.findMany({
        where: { partieId },
        select: { user: { select: { id: true, pseudo: true, displayName: true } } },
      }),
      this.events.pastHostedCounts(partieId),
    ]);
    return toHostCountsDto(
      memberships.map((m) => ({
        userId: m.user.id,
        pseudo: m.user.pseudo,
        displayName: m.user.displayName,
      })),
      hosted,
    );
  }
}
