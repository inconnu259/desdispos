import { Inject, Injectable } from '@nestjs/common';
import { familyOf, hasAnswered, isPartieActive, type OpenPollEntry } from '@master-jdr/shared';
import { PermissionService } from '../permissions/permission.service';
import { isHiddenDraft, isSpoilRestricted } from '../permissions/scenario-visibility';
import { PrismaService } from '../prisma/prisma.service';
import { pollVoters } from './poll-voters';
import { OPEN_POLL_CONTEXT_PORT, type OpenPollContextPort } from './ports/open-poll-context.port';
import {
  RENDEZ_VOUS_DURATION_PORT,
  type RendezVousDurationPort,
} from './ports/rendez-vous-duration.port';

/**
 * `GET /me/open-polls` (Story 44.2, AR1/AR2) — tous MES sondages de dates ouverts, de toutes les familles
 * (JDR, groupe, soirée isolée), sur mes parties ACTIVES et non masquées, qu'ils tombent ce mois-ci ou dans
 * trois mois et que leur échéance soit passée ou non. Lecture seule, strictement anonyme : des compteurs et
 * MA réponse, jamais l'identité d'un votant.
 *
 * Nombre de lectures FIXE : les sondages (avec options et réponses), les membres des parties de JDR, puis le
 * contexte de la couche 2 (`OpenPollContextPort`, en lot). Jamais une requête par partie ni par sondage.
 */
@Injectable()
export class MyOpenPollsService {
  constructor(
    private readonly prisma: PrismaService,
    // Story 44.2 : le rôle sur chaque partie (donc l'anti-spoil) est décidé par le service de permission, en lot —
    // jamais en comparant le propriétaire de la partie.
    private readonly permissions: PermissionService,
    @Inject(OPEN_POLL_CONTEXT_PORT) private readonly context: OpenPollContextPort,
    @Inject(RENDEZ_VOUS_DURATION_PORT) private readonly duration: RendezVousDurationPort,
  ) {}

  async list(userId: string): Promise<OpenPollEntry[]> {
    const rows = await this.prisma.sessionPoll.findMany({
      where: {
        status: 'OPEN',
        // Mes parties seulement (propriétaire ou membre), non clôturées, non masquées par moi. Une partie
        // dont je ne suis pas membre n'apparaît jamais.
        partie: {
          closedAt: null,
          hiddenBy: { none: { userId } },
          OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        expiresAt: true,
        // Le statut du scénario porteur : l'anti-spoil (brouillon caché) se décide plus bas, par le rôle.
        seance: { select: { event: { select: { scenario: { select: { status: true } } } } } },
        partie: { select: { id: true, name: true, kind: true, gameSystemId: true, ownerId: true } },
        options: {
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
          // Les réponses ne sortent jamais d'ici : seuls les compteurs et ma réponse.
          select: {
            id: true,
            date: true,
            slot: true,
            votes: { select: { userId: true, answer: true } },
          },
        },
      },
    });
    if (rows.length === 0) return [];

    // Anti-spoil serveur : hors des parties dont je suis le MJ, le vote d'un brouillon caché n'existe pas.
    const roles = await this.permissions.rolesOf(userId, [
      ...new Set(rows.map((p) => p.partie.id)),
    ]);
    const polls = rows.filter((p) => {
      const status = p.seance?.event.scenario?.status;
      return !(
        status &&
        isSpoilRestricted(roles.get(p.partie.id)) &&
        isHiddenDraft(status, p.partie.kind)
      );
    });
    if (polls.length === 0) return [];

    const jdrPartieIds = [
      ...new Set(
        polls
          .filter((p) => familyOf(p.partie.gameSystemId) !== 'ralliement')
          .map((p) => p.partie.id),
      ),
    ];
    const [contexts, memberships, durations] = await Promise.all([
      this.context.contextOf(
        userId,
        polls.map((p) => p.id),
      ),
      jdrPartieIds.length === 0
        ? Promise.resolve([] as { partieId: string; userId: string }[])
        : this.prisma.membership.findMany({
            where: { partieId: { in: jdrPartieIds } },
            select: { partieId: true, userId: true },
          }),
      // Story 47.4 : la durée de chaque rendez-vous, en une lecture (1 pour un sondage sans séance).
      this.duration.durationsOf(polls.map((p) => p.id)),
    ]);
    const memberIdsByPartie = new Map<string, string[]>();
    for (const m of memberships) {
      const list = memberIdsByPartie.get(m.partieId) ?? [];
      list.push(m.userId);
      memberIdsByPartie.set(m.partieId, list);
    }

    const entries: OpenPollEntry[] = [];
    for (const poll of polls) {
      const ctx = contexts.get(poll.id);
      // Un sondage sans séance, ou d'une partie terminée / annulée, n'est pas servi (une seule définition
      // de « partie active » : `partieStatus` → `isPartieActive`).
      if (!ctx || !isPartieActive(ctx.status)) continue;

      const family = familyOf(poll.partie.gameSystemId) ?? 'jdr';
      const optionIds = poll.options.map((o) => o.id);
      const votedBy = new Map<string, Set<string>>();
      for (const option of poll.options) {
        for (const vote of option.votes) {
          const set = votedBy.get(vote.userId) ?? new Set<string>();
          set.add(option.id);
          votedBy.set(vote.userId, set);
        }
      }
      const voters = pollVoters({
        family,
        ownerId: poll.partie.ownerId,
        memberIds: memberIdsByPartie.get(poll.partie.id) ?? [],
        groupVoterIds: ctx.groupVoterIds,
      });
      const answered = (id: string) => hasAnswered(family, optionIds, votedBy.get(id) ?? new Set());

      entries.push({
        pollId: poll.id,
        partieId: poll.partie.id,
        partieName: poll.partie.name,
        family,
        kind: poll.partie.kind,
        seanceId: ctx.seanceId,
        title: ctx.title,
        expiresAt: poll.expiresAt?.toISOString() ?? null,
        durationSlots: durations.get(poll.id) ?? 1,
        options: poll.options.map((o) => {
          const mine = o.votes.find((v) => v.userId === userId);
          return {
            optionId: o.id,
            date: o.date.toISOString().substring(0, 10),
            slot: o.slot,
            yes: o.votes.filter((v) => v.answer === 'YES').length,
            maybe: o.votes.filter((v) => v.answer === 'MAYBE').length,
            no: o.votes.filter((v) => v.answer === 'NO').length,
            // `null`, jamais `undefined` : une seule représentation de « n'a pas répondu ».
            myAnswer: mine ? mine.answer : null,
          };
        }),
        eligibleCount: voters.length,
        answeredCount: voters.filter(answered).length,
        me: { eligible: voters.includes(userId), answered: answered(userId) },
        can: ctx.can,
      });
    }
    return entries;
  }
}
