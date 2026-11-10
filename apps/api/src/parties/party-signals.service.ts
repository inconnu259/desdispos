import { Injectable } from '@nestjs/common';
import { hasAnswered, hasCapability } from '@master-jdr/shared';
import type { PartieDto, PartySignalCode, PartySignalsDto } from '@master-jdr/shared';
import { VISIBLE_POLL_WHERE } from '../permissions/scenario-visibility';
import { PrismaService } from '../prisma/prisma.service';
import { PartiesService } from './parties.service';

/** Début du jour courant (UTC) : une conjonction « à venir » est datée d'aujourd'hui ou après. */
function startOfTodayUtc(): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

type OpenPollWithVotes = {
  partieId: string;
  options: { id: string; votes: { userId: string }[] }[];
};

/**
 * `GET /me/party-signals` (AD-3, Story 29.7) : dérive les 10 signaux de FR-12 pour toutes les
 * parties de l'utilisateur en un seul aller-retour par table concernée — jamais une requête par
 * partie. `role`/`status` sont lus tels quels depuis `PartiesService.listForUser()` (AD-8/AD-15,
 * Story 29.6), jamais redérivés ici.
 *
 * Story 40.4 : les groupes de ralliement n'entrent pas dans les listes par rôle ci-dessous (ils n'ont
 * ni MJ ni joueur) ; une entrée n'existe pour eux que lorsqu'une place est réservée à l'utilisateur
 * dans une conjonction à venir (`RESERVATION_A_CONFIRMER`), dérivée en UNE lecture groupée des
 * inscriptions réservées — jamais une requête par partie.
 */
@Injectable()
export class PartySignalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parties: PartiesService,
  ) {}

  async getSignals(userId: string): Promise<Record<string, PartySignalsDto>> {
    const [mjParties, playerParties] = await Promise.all([
      this.parties.listForUser(userId, 'mj'),
      this.parties.listForUser(userId, 'player'),
    ]);
    const mjPartieIds = mjParties.map((p) => p.id);
    // HOMME_DRAGON_A_CREER (AD-23) : seules les parties dont le système déclare la capacité
    // `hommeDragon` (registre, Story 37.7) peuvent porter ce signal — plus un identifiant en dur.
    const hommeDragonPartieIds = mjParties
      .filter((p) => hasCapability(p.gameSystemId, 'hommeDragon'))
      .map((p) => p.id);
    const playerPartieIds = playerParties.map((p) => p.id);

    const [
      charactersOwned,
      ryuutamaSansHommeDragon,
      membershipCounts,
      courantScenarios,
      scenariosMissingResume,
      seancesOfMjParties,
      openPolls,
      reservedRows,
      cancelledRows,
    ] = await Promise.all([
      this.prisma.character.findMany({
        where: { userId, partieId: { in: playerPartieIds } },
        select: { partieId: true },
      }),
      // HOMME_DRAGON_A_CREER (AD-23) : partie dont l'utilisateur est MJ, au système doté de la
      // capacité `hommeDragon`, `hommeDragonId` nul. Le lien vit sur `Partie` : une seule requête
      // sur les parties du MJ, sans requête par partie ni lecture des Hommes Dragons. Le filtre de
      // capacité est appliqué plus haut, côté serveur — le front ne le recalcule plus.
      this.prisma.partie.findMany({
        where: { id: { in: hommeDragonPartieIds }, hommeDragonId: null },
        select: { id: true },
      }),
      this.prisma.membership.groupBy({
        by: ['partieId'],
        where: { partieId: { in: mjPartieIds } },
        _count: { _all: true },
      }),
      // Story 37.3 : `partieId` vit sur l'événement de base, le statut sur son extension scénario.
      this.prisma.event.groupBy({
        by: ['partieId'],
        where: { partieId: { in: mjPartieIds }, scenario: { is: { status: 'COURANT' } } },
        _count: { _all: true },
      }),
      this.prisma.event.findMany({
        where: {
          partieId: { in: mjPartieIds },
          scenario: { is: { status: 'PASSE', resumeFin: null } },
        },
        select: { partieId: true },
      }),
      // COMPTE_RENDU_NON_REDIGE : décision retenue (Dev Notes, story 29.7) — signal MJ-only, la
      // rédaction du compte-rendu (Seance.compteRendu) étant une action exclusivement MJ.
      //
      // Anti-spoil serveur : la même requête groupée sert aussi à « la partie a une séance à venir »
      // pour le MJ — `Partie.nextSessionDate` exclut les brouillons cachés pour tous les lecteurs,
      // le MJ doit pourtant voir la date d'un brouillon qu'il a lui-même daté (sinon un faux
      // « aucune date »). Ne sont lues que les séances datées dont le compte rendu manque, ou à venir.
      this.prisma.seance.findMany({
        where: {
          event: { partieId: { in: mjPartieIds } },
          // Story 37.4 : séance datée = plage posée (seule source de la date).
          OR: [
            { compteRendu: null, startDate: { not: null } },
            { startDate: { gt: new Date() } },
            // Story 47.2 : une plage commencée est « à venir » jusqu'à sa fin.
            { endDate: { gt: new Date() } },
          ],
        },
        select: {
          compteRendu: true,
          startDate: true,
          endDate: true,
          event: { select: { partieId: true } },
        },
      }),
      // Une seule requête groupée sert à la fois VOTE_EN_COURS_SANS_REPONSE (joueur, filtré sur
      // les votes de l'utilisateur) et AUCUNE_DATE_NI_VOTE (MJ, simple présence d'un poll OPEN).
      // Anti-spoil serveur : côté joueur, le vote de la séance d'un brouillon caché n'existe pas — il
      // ne doit pas faire naître `VOTE_EN_COURS_SANS_REPONSE`.
      this.prisma.sessionPoll.findMany({
        where: {
          status: 'OPEN',
          OR: [
            { partieId: { in: mjPartieIds } },
            { AND: [{ partieId: { in: playerPartieIds } }, VISIBLE_POLL_WHERE] },
          ],
        },
        select: {
          partieId: true,
          options: {
            select: { id: true, votes: { where: { userId }, select: { userId: true } } },
          },
        },
      }),
      // RESERVATION_A_CONFIRMER (Story 40.4) : les places réservées à l'utilisateur dans une
      // conjonction dont le jour n'est pas passé (jour UTC, comme les règles d'inscription).
      this.prisma.inscription.findMany({
        where: {
          userId,
          status: 'RESERVED',
          // Story 42.1 : une place réservée d'une conjonction annulée n'attend plus de réponse.
          // Story 47.2 : une plage commencée, finissant aujourd'hui ou plus tard, attend encore sa réponse.
          seance: {
            OR: [
              { endDate: { gte: startOfTodayUtc() } },
              { endDate: null, startDate: { gte: startOfTodayUtc() } },
            ],
            event: { cancelledAt: null },
          },
        },
        select: { seance: { select: { event: { select: { partieId: true } } } } },
      }),
      // PARTIE_ANNULEE (Story 42.2) : les rencontres isolées de l'utilisateur dont l'événement unique est
      // annulé — UNE lecture groupée, jamais une par partie. Le statut vient de `listForUser` ci-dessous.
      this.prisma.event.findMany({
        where: {
          cancelledAt: { not: null },
          partie: {
            kind: 'ONE_SHOT',
            // Le créateur d'une rencontre isolée y a toujours son adhésion (il ne peut pas la quitter).
            memberships: { some: { userId } },
          },
        },
        select: { partieId: true },
      }),
    ]);

    const characterPartieIds = new Set(charactersOwned.map((c) => c.partieId));
    const hommeDragonACreerPartieIds = new Set(ryuutamaSansHommeDragon.map((p) => p.id));
    const partiesWithMembers = new Set(membershipCounts.map((m) => m.partieId));
    const partiesWithCourantScenario = new Set(courantScenarios.map((s) => s.partieId));
    const partiesMissingResume = new Set(scenariosMissingResume.map((s) => s.partieId));
    const partiesMissingCompteRendu = new Set(
      seancesOfMjParties.filter((s) => s.compteRendu == null).map((s) => s.event.partieId),
    );
    const mjPartiesWithFutureSeance = new Set(
      seancesOfMjParties
        .filter((s) => s.startDate != null && (s.endDate ?? s.startDate).getTime() > Date.now())
        .map((s) => s.event.partieId),
    );
    const openPollsByPartie = new Map<string, OpenPollWithVotes[]>();
    for (const poll of openPolls as OpenPollWithVotes[]) {
      const list = openPollsByPartie.get(poll.partieId) ?? [];
      list.push(poll);
      openPollsByPartie.set(poll.partieId, list);
    }

    const now = Date.now();

    const computeSignals = (partie: PartieDto, role: 'mj' | 'player'): PartySignalCode[] => {
      const signals: PartySignalCode[] = [];
      // Deferred-work (2026-08-25) : `Partie.nextSessionDate` n'est jamais effacé après la date
      // passée (AD-3 interdit de le recalculer depuis les séances ici — c'est un champ matérialisé,
      // recalculé uniquement par `EventsService.recalculateNextSession()` sur événement). Une date passée non
      // recalculée depuis désynchronise ces deux signaux si on la traite comme "connue" ; on la
      // lit donc comme absente ici, sans jamais réécrire le champ.
      //
      // Joueur : `nextSessionDate` (hors brouillons cachés). MJ : toutes les séances de la partie,
      // brouillons compris (lecture groupée ci-dessus).
      const hasFutureSessionDate =
        role === 'mj'
          ? mjPartiesWithFutureSeance.has(partie.id)
          : !!partie.nextSessionDate &&
            new Date(partie.nextSessionEndDate ?? partie.nextSessionDate).getTime() > now;

      // AC5 : une partie clôturée ne porte jamais un signal d'action, seuls les signaux de fin
      // subsistent — appliqué en premier, avant toute autre dérivation. Les deux signaux de fin
      // sont MJ-only (garde explicite, revue de code) : `partiesMissingCompteRendu`/
      // `partiesMissingResume` ne sont dérivés que sur `mjPartieIds`, mais le rester même si ces
      // requêtes étaient un jour élargies à toutes les parties.
      // Story 42.2 : une rencontre isolée annulée ne porte que ce signal, aucun signal d'action.
      if (partie.status === 'ANNULEE') return ['PARTIE_ANNULEE'];

      if (partie.status === 'TERMINEE') {
        if (role === 'mj' && partiesMissingCompteRendu.has(partie.id))
          signals.push('COMPTE_RENDU_NON_REDIGE');
        if (role === 'mj' && partiesMissingResume.has(partie.id))
          signals.push('RAPPORT_FIN_MANQUANT');
        signals.push('PARTIE_TERMINEE');
        return signals;
      }

      if (role === 'player') {
        // Story 29.15 : un système sans la capacité `characters` (Story 37.5, registre) ne doit
        // jamais émettre ce signal, même sans Character — même source (`hasCapability`) que le
        // bouton/onglet par défaut côté web, pour ne jamais diverger.
        if (
          !characterPartieIds.has(partie.id) &&
          hasCapability(partie.gameSystemId, 'characters')
        ) {
          signals.push('PERSONNAGE_A_CREER');
        }
        const openPollsHere = openPollsByPartie.get(partie.id) ?? [];
        // Story 44.2 : « a répondu » est la règle partagée `hasAnswered` (JDR : une réponse à CHAQUE option).
        const hasUnanswered = openPollsHere.some(
          (poll) =>
            !hasAnswered(
              'jdr',
              poll.options.map((opt) => opt.id),
              poll.options.filter((opt) => opt.votes.length > 0).map((opt) => opt.id),
            ),
        );
        if (hasUnanswered) signals.push('VOTE_EN_COURS_SANS_REPONSE');
      } else {
        if (hommeDragonACreerPartieIds.has(partie.id)) signals.push('HOMME_DRAGON_A_CREER');
        if (!partiesWithMembers.has(partie.id)) signals.push('AUCUN_MEMBRE_INVITE');
        if (!partiesWithCourantScenario.has(partie.id)) signals.push('AUCUN_SCENARIO_EN_COURS');
        if (!hasFutureSessionDate && !openPollsByPartie.has(partie.id)) {
          signals.push('AUCUNE_DATE_NI_VOTE');
        }
        if (partiesMissingResume.has(partie.id)) signals.push('RAPPORT_FIN_MANQUANT');
        if (partiesMissingCompteRendu.has(partie.id)) signals.push('COMPTE_RENDU_NON_REDIGE');
      }

      if (hasFutureSessionDate) signals.push('PROCHAINE_SEANCE_CONNUE');
      return signals;
    };

    const result: Record<string, PartySignalsDto> = {};
    for (const p of mjParties) {
      result[p.id] = {
        role: 'mj',
        status: p.status,
        signals: computeSignals(p, 'mj'),
      };
    }
    for (const p of playerParties) {
      result[p.id] = {
        role: 'player',
        status: p.status,
        signals: computeSignals(p, 'player'),
      };
    }

    // Story 40.4 : groupes de ralliement où une place est réservée à l'utilisateur. Le statut du
    // groupe vient de `listForUser` (une seule lecture, seulement s'il y a une réservation) ; un
    // groupe terminé ne porte plus de signal d'action (AC5 de la Story 29.7).
    const reservedPartieIds = new Set(reservedRows.map((r) => r.seance.event.partieId));
    const cancelledPartieIds = new Set(cancelledRows.map((r) => r.partieId));
    if (reservedPartieIds.size > 0 || cancelledPartieIds.size > 0) {
      const mine = await this.parties.listForUser(userId);
      for (const p of mine) {
        // Story 42.2 : une rencontre isolée annulée ne porte que ce signal, pour tous ses membres.
        if (p.status === 'ANNULEE') {
          if (cancelledPartieIds.has(p.id)) {
            result[p.id] = { role: 'player', status: p.status, signals: ['PARTIE_ANNULEE'] };
          }
          continue;
        }
        if (!reservedPartieIds.has(p.id) || p.status === 'TERMINEE') continue;
        result[p.id] = { role: 'player', status: p.status, signals: ['RESERVATION_A_CONFIRMER'] };
      }
    }
    return result;
  }
}
