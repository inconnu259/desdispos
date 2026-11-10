import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  GAME_SYSTEMS,
  type AccountDeletionImpactDto,
  type AnnouncementDto,
  type Theme,
} from '@master-jdr/shared';
import { AuthService } from '../auth/auth.service';
import { PartiesService } from '../parties/parties.service';
import { PermissionService } from '../permissions/permission.service';
import { RELEASED_ANNOUNCEMENT_WHERE, isSpoilRestricted } from '../permissions/scenario-visibility';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService, userTopic } from '../realtime/realtime-events.service';
import { toDto as toAnnouncementDto } from '../announcements/announcements.service';
import { toAuthUser } from '../users/to-auth-user.util';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

/** Identifiants des systèmes d'une famille, lus dans le registre (Story 43.1) : la famille n'est pas
 *  une colonne, le filtre SQL passe donc par la liste des systèmes qui la portent. */
function systemIdsOfFamily(family: 'jdr' | 'ralliement'): string[] {
  return GAME_SYSTEMS.filter((g) => g.family === family).map((g) => g.id);
}
const RALLIEMENT_SYSTEM_IDS = systemIdsOfFamily('ralliement');
const JDR_SYSTEM_IDS = systemIdsOfFamily('jdr');

/** `groupBy` → table `partieId → nombre`. */
function countsByPartie(
  rows: { partieId: string; _count: { _all: number } }[],
): Map<string, number> {
  return new Map(rows.map((r) => [r.partieId, r._count._all]));
}

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    // Story 37.7 (AD-6) : toute décision de droit sur une partie passe par ce service.
    private readonly permissions: PermissionService,
    // Story 43.2 : mot de passe et sessions restent à `AuthService` (AD-11) ; la sortie des parties à
    // la procédure unique de `PartiesService` (AD-17).
    private readonly auth: AuthService,
    private readonly parties: PartiesService,
    // Story 52.4 (AD-5) : changer la préférence du rappel réveille les appareils du compte (`user:{id}`).
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  private readonly logger = new Logger(AccountService.name);

  /**
   * Story 43.2 (AD-11) — efface le compte `userId`. Mot de passe vérifié d'abord, par `AuthService` : un
   * faux mot de passe est refusé (401) sans rien modifier. Puis UNE transaction : parties de JDR possédées
   * supprimées, procédure de départ pour chaque groupe, sessions coupées, compte supprimé. Émissions et
   * e-mails d'annulation viennent après la validation uniquement.
   */
  async deleteAccount(userId: string, password: string): Promise<{ ok: true }> {
    await this.auth.verifyPassword(userId, password);
    // Lu avant l'effacement : l'e-mail d'annulation de ses conjonctions nomme encore leur hôte.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    if (!user) throw new NotFoundException('Compte introuvable');

    const effects = await this.prisma.$transaction(
      async (tx) => {
        const done = await this.parties.eraseMembershipsInTx(tx, userId);
        await this.auth.revokeSessions(tx, userId);
        await tx.user.delete({ where: { id: userId } });
        return done;
      },
      // Beaucoup de groupes verrouillés l'un après l'autre : au-delà des 5 s par défaut.
      { timeout: 30_000 },
    );

    await this.parties.announceAccountErasure(userId, user.displayName, effects);
    return { ok: true };
  }

  async updateDisplayName(userId: string, displayName: string) {
    let user;
    try {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { displayName },
        include: { calendarLayers: true },
      });
    } catch (e) {
      // Session référant un compte supprimé entre-temps (cas normalement impossible en usage
      // courant) — jamais un 500 brut, même pattern que resolveScenarioOrThrow().
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Compte introuvable');
      }
      throw e;
    }
    return toAuthUser(user);
  }

  /** N'applique jamais le thème (AD-13) — lit/écrit uniquement la colonne. */
  async updateTheme(userId: string, theme: Theme) {
    let user;
    try {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { theme },
        include: { calendarLayers: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Compte introuvable');
      }
      throw e;
    }
    return toAuthUser(user);
  }

  /** Patch partiel (Story 29.8) — seuls les champs fournis sont mis à jour, même route accueillera
   *  partiesViewMode/charactersSort/charactersViewMode (29.9) sans changer de forme.
   *  `defaultCalendarLayers` (Story 30.4) n'est PAS une colonne scalaire : un lot fourni (même
   *  vide, distinct d'absent) remplace atomiquement les lignes `UserCalendarLayer` existantes et
   *  pose `calendarLayersSetAt`, dans une transaction unique avec le reste des scalaires. */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const { defaultCalendarLayers, ...scalarDto } = dto;
    let user;
    try {
      if (defaultCalendarLayers !== undefined) {
        const uniqueKeys = [...new Set(defaultCalendarLayers)];
        const [, , updated] = await this.prisma.$transaction([
          this.prisma.userCalendarLayer.deleteMany({ where: { userId } }),
          this.prisma.userCalendarLayer.createMany({
            data: uniqueKeys.map((layerKey) => ({ userId, layerKey })),
          }),
          this.prisma.user.update({
            where: { id: userId },
            data: { ...scalarDto, calendarLayersSetAt: new Date() },
            include: { calendarLayers: true },
          }),
        ]);
        user = updated;
      } else {
        user = await this.prisma.user.update({
          where: { id: userId },
          data: { ...scalarDto },
          include: { calendarLayers: true },
        });
      }
    } catch (e) {
      // Revue de code : compte supprimé entre l'authentification et cet appel — dans la branche
      // `defaultCalendarLayers`, `userCalendarLayer.createMany()` peut échouer AVANT `user.update()`
      // avec une violation de contrainte FK (P2003) plutôt que P2025 ; les deux doivent aboutir au
      // même 404 propre, jamais un 500 brut.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === 'P2025' || e.code === 'P2003')
      ) {
        throw new NotFoundException('Compte introuvable');
      }
      throw e;
    }
    // Story 52.4 (AD-5) — faire taire ou réactiver le rappel est lu par tous les appareils du compte : `user:{id}`,
    // après l'écriture, et seulement quand ce champ est dans la requête. Jamais un échec d'émission ne fait croire
    // que l'écriture a échoué.
    if (dto.availabilityReminder !== undefined) {
      try {
        this.realtimeEvents.emit(userTopic(userId));
      } catch (err) {
        this.logger.warn(
          `Échec de l'émission temps réel après changement du rappel des dispos (userId=${userId}) : ${String(err)}`,
        );
      }
    }
    return toAuthUser(user);
  }

  /**
   * Story 43.1 (AD-11) — ce que l'effacement du compte emporterait, en lecture seule et pour
   * `userId` seul : les groupes et rencontres isolées dont il est le SEUL administrateur (un groupe
   * qui garde un autre administrateur survit, il n'est pas listé) et les parties de JDR qu'il
   * possède. Lectures groupées, jamais une requête par partie.
   */
  async getDeletionImpact(userId: string): Promise<AccountDeletionImpactDto> {
    const [adminships, ownedJdr] = await Promise.all([
      this.prisma.membership.findMany({
        where: { userId, role: 'ADMIN', partie: { gameSystemId: { in: RALLIEMENT_SYSTEM_IDS } } },
        select: { partie: { select: { id: true, name: true } } },
      }),
      this.prisma.partie.findMany({
        where: { ownerId: userId, gameSystemId: { in: JDR_SYSTEM_IDS } },
        select: { id: true, name: true },
      }),
    ]);
    const groupIds = adminships.map((a) => a.partie.id);
    const jdrIds = ownedJdr.map((p) => p.id);

    const [adminRows, memberRows, eventRows, characterRows] = await Promise.all([
      groupIds.length
        ? this.prisma.membership.groupBy({
            by: ['partieId'],
            where: { partieId: { in: groupIds }, role: 'ADMIN' },
            _count: { _all: true },
          })
        : [],
      groupIds.length
        ? this.prisma.membership.groupBy({
            by: ['partieId'],
            where: { partieId: { in: groupIds } },
            _count: { _all: true },
          })
        : [],
      groupIds.length
        ? this.prisma.event.groupBy({
            by: ['partieId'],
            where: { partieId: { in: groupIds } },
            _count: { _all: true },
          })
        : [],
      // Un joueur ne perd ses personnages que s'il en a : on compte les joueurs distincts, MJ exclu.
      jdrIds.length
        ? this.prisma.character.findMany({
            where: { partieId: { in: jdrIds }, userId: { not: userId } },
            select: { partieId: true, userId: true },
            distinct: ['partieId', 'userId'],
          })
        : [],
    ]);

    const admins = countsByPartie(adminRows);
    const members = countsByPartie(memberRows);
    const events = countsByPartie(eventRows);
    const players = new Map<string, number>();
    for (const c of characterRows) players.set(c.partieId, (players.get(c.partieId) ?? 0) + 1);

    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'fr');
    return {
      // Le recomptage des administrateurs fait foi : un autre ADMIN sauve le groupe.
      groups: adminships
        .filter((a) => (admins.get(a.partie.id) ?? 0) <= 1)
        .map((a) => ({
          id: a.partie.id,
          name: a.partie.name,
          memberCount: members.get(a.partie.id) ?? 0,
          eventCount: events.get(a.partie.id) ?? 0,
        }))
        .sort(byName),
      jdrParties: ownedJdr
        .map((p) => ({ id: p.id, name: p.name, playerCount: players.get(p.id) ?? 0 }))
        .sort(byName),
    };
  }

  /** Idempotent (sémantique PUT) : un favori déjà posé n'est jamais une erreur (P2002 absorbé).
   *  Story 37.7 : l'utilisateur doit avoir un rôle sur la partie (`PARTIE_READ`) — 404 si elle
   *  n'existe pas, 403 s'il n'y est ni MJ ni membre : aucune ligne n'est écrite pour une partie
   *  étrangère. */
  async addFavorite(userId: string, partieId: string): Promise<{ ok: true }> {
    await this.permissions.assert(userId, 'PARTIE_READ', { partieId });
    try {
      await this.prisma.partieFavorite.create({ data: { userId, partieId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') return { ok: true };
        if (e.code === 'P2003') throw new NotFoundException('Partie introuvable');
      }
      throw e;
    }
    return { ok: true };
  }

  /** Idempotent par nature (`deleteMany` ne lève jamais si 0 ligne). */
  async removeFavorite(userId: string, partieId: string): Promise<{ ok: true }> {
    await this.prisma.partieFavorite.deleteMany({
      where: { userId, partieId },
    });
    return { ok: true };
  }

  /** Agrégation batchée sur toutes les parties de l'utilisateur (AD-3, jamais de fan-out par
   *  partie, cf. l'anti-pattern d'OpenPollsService). `toDto` réutilisé depuis AnnouncementsService
   *  (AD-17 : extraction, jamais duplication). */
  async getUnseenAnnouncements(userId: string): Promise<AnnouncementDto[]> {
    const announcements = await this.prisma.announcement.findMany({
      where: {
        // Anti-spoil serveur : propriétaire (MJ) → toutes les annonces ; simple membre (joueur) →
        // seulement celles de toute la partie ou ciblées sur un scénario `COURANT`/`PASSE`.
        OR: [
          { partie: { ownerId: userId } },
          { AND: [{ partie: { memberships: { some: { userId } } } }, RELEASED_ANNOUNCEMENT_WHERE] },
        ],
        reads: { none: { userId } },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        partie: {
          select: { owner: { select: { pseudo: true, displayName: true } } },
        },
      },
    });
    // Une partie sans propriétaire (AD-5, compte supprimé — inatteignable aujourd'hui) n'a plus
    // d'auteur à afficher : ses annonces sont écartées en attendant l'affichage « compte supprimé ».
    return announcements.flatMap((a) =>
      a.partie.owner ? [toAnnouncementDto(a, a.partie.owner)] : [],
    );
  }

  /** Idempotent (sémantique PUT), même pattern que addFavorite(). Story 37.7 : un rôle sur la
   *  partie de l'annonce est exigé (`ANNOUNCEMENT_MARK_READ`, partie résolue depuis l'annonce) —
   *  aucune ligne de lecture n'est écrite pour l'annonce d'une partie étrangère. */
  async markAnnouncementRead(userId: string, announcementId: string): Promise<{ ok: true }> {
    const grant = await this.permissions.assert(userId, 'ANNOUNCEMENT_MARK_READ', {
      announcementId,
    });
    // Anti-spoil serveur : hors MJ, une annonce ciblée sur un scénario non diffusé n'existe pas —
    // 404 comme une annonce inconnue (sinon 200/404 permettrait de sonder son existence).
    if (isSpoilRestricted(grant.role)) {
      const visible = await this.prisma.announcement.count({
        where: { AND: [{ id: announcementId }, RELEASED_ANNOUNCEMENT_WHERE] },
      });
      if (visible === 0) throw new NotFoundException('Annonce introuvable');
    }
    try {
      await this.prisma.announcementRead.create({
        data: { userId, announcementId },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') return { ok: true };
        if (e.code === 'P2003') throw new NotFoundException('Annonce introuvable');
      }
      throw e;
    }
    return { ok: true };
  }
}
