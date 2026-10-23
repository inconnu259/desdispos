import { Injectable } from '@nestjs/common';
import { familyOf, partieStatus } from '@master-jdr/shared';
import { PermissionService } from '../permissions/permission.service';
import type { OpenPollContext, OpenPollContextPort } from '../poll/ports/open-poll-context.port';
import { PrismaService } from '../prisma/prisma.service';
import { eligibleVoters } from './eligible-voters';
import { EventsService, isRalliementGroup } from './events.service';

/**
 * Story 44.2 (AD-15) — ce que `poll/` ne peut pas lire d'un sondage ouvert : sa séance et son titre, le statut
 * de sa partie, les droits d'organisateur de la personne qui lit et, pour un groupe ou une soirée, les votants
 * éligibles (la définition unique `eligibleVoters`). Implémente `OpenPollContextPort`, lié par `PortsModule`.
 *
 * Lectures groupées, en nombre FIXE quel que soit le nombre de sondages : les séances (avec événement, partie
 * et inscriptions), les membres des groupes qui accueillent « tous les membres », l'avancement des parties
 * (`EventsService.progressByPartieIds`) et les droits (`PermissionService.organizerCan`).
 */
@Injectable()
export class OpenPollContextService implements OpenPollContextPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly permissions: PermissionService,
  ) {}

  async contextOf(userId: string, pollIds: string[]): Promise<Map<string, OpenPollContext>> {
    const result = new Map<string, OpenPollContext>();
    if (pollIds.length === 0) return result;

    const seances = await this.prisma.seance.findMany({
      where: { pollId: { in: pollIds } },
      select: {
        id: true,
        pollId: true,
        inscriptionMax: true,
        inscriptions: { select: { userId: true, status: true } },
        event: {
          select: {
            title: true,
            ownerId: true,
            partie: { select: { id: true, kind: true, gameSystemId: true, closedAt: true } },
          },
        },
      },
    });
    if (seances.length === 0) return result;

    const parties = [...new Map(seances.map((s) => [s.event.partie.id, s.event.partie])).values()];
    // Les membres d'un groupe ne sont lus que pour les conjonctions qui accueillent « tous les membres ».
    const wantMembers = [
      ...new Set(
        seances
          .filter((s) => isRalliementGroup(s.event.partie) && s.inscriptionMax === null)
          .map((s) => s.event.partie.id),
      ),
    ];
    const [progressOf, cans, memberships] = await Promise.all([
      this.events.progressByPartieIds(parties),
      this.permissions.organizerCan(
        userId,
        seances.map((s) => ({ seanceId: s.id })),
      ),
      wantMembers.length === 0
        ? Promise.resolve([] as { partieId: string; userId: string }[])
        : this.prisma.membership.findMany({
            where: { partieId: { in: wantMembers } },
            select: { partieId: true, userId: true },
          }),
    ]);
    const memberIdsByPartie = new Map<string, string[]>();
    for (const m of memberships) {
      const list = memberIdsByPartie.get(m.partieId) ?? [];
      list.push(m.userId);
      memberIdsByPartie.set(m.partieId, list);
    }

    seances.forEach((s, i) => {
      if (!s.pollId) return;
      const partie = s.event.partie;
      // Famille `ralliement` (groupe ou soirée isolée) : les votants viennent de la conjonction.
      const groupLike = familyOf(partie.gameSystemId) === 'ralliement';
      result.set(s.pollId, {
        seanceId: s.id,
        title: s.event.title,
        status: partieStatus(partie.closedAt, progressOf(partie.id)),
        can: cans[i],
        groupVoterIds: groupLike
          ? eligibleVoters({
              hostId: s.event.ownerId,
              inscriptionMax: s.inscriptionMax,
              inscriptions: s.inscriptions,
              memberIds: memberIdsByPartie.get(partie.id) ?? [],
            })
          : null,
      });
    });
    return result;
  }
}
