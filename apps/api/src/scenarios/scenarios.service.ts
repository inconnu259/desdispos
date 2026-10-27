import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Prisma, type Event, type Scenario, type ScenarioDocument } from '@prisma/client';
import type {
  CharacterNoteDto,
  EventCardDto,
  OrganizerCan,
  DaySlot,
  PartieKind,
  PartieRole,
  ScenarioDocumentDto,
  ScenarioDto,
  SeanceDto,
  SessionPollDto,
} from '@master-jdr/shared';
// Import RUNTIME du registre des systèmes (Story 40.3) : la famille de la partie choisit la branche
// des routes d'inscription partagées. Jamais `import type` sur une valeur.
import { familyOf } from '@master-jdr/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { GroupEventsService } from '../events/group-events.service';
import { PartiesService } from '../parties/parties.service';
import { countParticipants } from '../common/participant-count.util';
import {
  PermissionService,
  RALLIEMENT_UNAVAILABLE_MESSAGE,
  type PartieGrant,
} from '../permissions/permission.service';
import {
  VISIBLE_SCENARIO_WHERE,
  isHiddenDraft,
  isSpoilRestricted,
  isReleased,
  isRedactedForPlayer,
} from '../permissions/scenario-visibility';
import { CharacterService } from '../characters/character.service';
import { PollService } from '../poll/poll.service';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';
import { detectDocumentMime, isStructurallyValidPdf } from './document-mime.util';
import { deleteDocumentFile, readDocumentFile, writeDocumentFile } from './document-storage.util';

/** Un participant ou un membre tel que renvoyé par la lecture en lot `findPasseForParties`. */
export interface BatchParticipant {
  userId: string;
  pseudo: string;
  displayName: string;
}

/** Un scénario `PASSE` renvoyé par la lecture en lot `findPasseForParties` (AD-23). */
export interface PasseScenarioBatchItem {
  id: string;
  partieId: string;
  title: string;
  /** ISO — jamais nul (seuls les scénarios `PASSE` clos sont lus). */
  closedAt: string;
  participants: BatchParticipant[];
}

@Injectable()
export class ScenariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parties: PartiesService,
    private readonly characters: CharacterService,
    private readonly pollService: PollService,
    private readonly realtimeEvents: RealtimeEventsService,
    private readonly events: EventsService,
    // Story 37.6 (AD-6) : tout droit sur une partie, un scénario (événement) ou une séance est
    // décidé par ce service — la partie est résolue depuis la cible, jamais depuis la route.
    private readonly permissions: PermissionService,
    // Story 40.3 : branche « groupe » des routes d'inscription (conjonctions d'un ralliement).
    private readonly groupEvents: GroupEventsService,
  ) {}

  /** Scénario aplati avec son événement de base (Story 37.3), `null` s'il n'existe pas. */
  private async findScenario(scenarioId: string): Promise<ScenarioRow | null> {
    const scenario = await this.prisma.scenario.findUnique({
      where: { id: scenarioId },
      include: WITH_EVENT,
    });
    return scenario ? flattenScenario(scenario) : null;
  }

  /** Story 44.1 : les droits d'organisateur de `userId` sur un lot de séances, par `PermissionService`
   *  (jamais déduits du rôle ici) — passés aux fonctions qui construisent les `SeanceDto`. */
  private seanceCanOf(userId: string): SeanceCanOf {
    return (seanceIds) =>
      this.permissions.organizerCan(
        userId,
        seanceIds.map((seanceId) => ({ seanceId })),
      );
  }

  /** `toEnrichedDto` pour la personne autorisée par `grant` : rôle (anti-spoil) et droits de ses séances. */
  private enrich(
    scenario: ScenarioRow,
    partieKind: PartieKind,
    grant: PartieGrant,
  ): Promise<ScenarioDto> {
    return toEnrichedDto(
      this.prisma,
      this.characters,
      scenario,
      partieKind,
      grant.role,
      this.seanceCanOf(grant.userId),
    );
  }

  /** Relecture d'un scénario dont l'existence vient d'être établie. */
  private async reloadScenario(scenarioId: string): Promise<ScenarioRow> {
    return flattenScenario(
      await this.prisma.scenario.findUniqueOrThrow({
        where: { id: scenarioId },
        include: WITH_EVENT,
      }),
    );
  }

  async create(partieId: string, mjId: string, dto: CreateScenarioDto): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(mjId, 'SCENARIO_CREATE', { partieId });
    const { partie } = grant;

    // FR-1 (PRD §9) : une Partie ONE_SHOT a un unique scénario, créé automatiquement
    // (PartiesService.create, AD-7) — jamais de gestion multi-scénarios pour ce cas.
    if (partie.kind === 'ONE_SHOT') {
      throw new BadRequestException(
        'Une Partie de type ONE_SHOT ne peut pas avoir plusieurs scénarios — son scénario unique est créé automatiquement',
      );
    }

    // Story 37.3 : l'événement de base (titre, description, première séance) est créé par
    // `EventsService`, le scénario en est l'extension JDR, écrite dans la même transaction.
    // L'émission `partie:` a lieu dans `EventsService.create()`, après validation.
    const { event, extension } = await this.events.create(
      grant,
      {
        title: dto.title,
        description: dto.description ?? null,
        ownerId: partie.ownerId,
      },
      (tx, created) =>
        tx.scenario.create({
          data: {
            id: created.id,
            dureeHeures: dto.dureeHeures ?? null,
            dureeSeances: dto.dureeSeances ?? null,
            status: 'BROUILLON',
          },
        }),
    );

    return this.enrich(toRow(extension, event), partie.kind, grant);
  }

  async update(scenarioId: string, mjId: string, dto: UpdateScenarioDto): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(mjId, 'SCENARIO_UPDATE', { eventId: scenarioId });
    const scenario = await this.findScenario(scenarioId);
    if (!scenario) throw new NotFoundException('Scénario introuvable');
    const { partie } = grant;

    if (scenario.status === 'PASSE') {
      throw new BadRequestException(
        'Un scénario clôturé ne peut plus être modifié via cet endpoint — seule l’édition du résumé de fin (Epic 8) reste possible, via un mécanisme dédié',
      );
    }

    // Story 37.3 : titre et description vivent sur l'événement (écrits par `EventsService`), les
    // durées sur le scénario — une seule transaction, émission après validation.
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.title !== undefined || dto.description !== undefined) {
        await this.events.updateInTx(tx, scenarioId, {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
        });
      }
      return tx.scenario.update({
        where: { id: scenarioId },
        data: {
          ...(dto.dureeHeures !== undefined && { dureeHeures: dto.dureeHeures }),
          ...(dto.dureeSeances !== undefined && {
            dureeSeances: dto.dureeSeances,
          }),
        },
        include: WITH_EVENT,
      });
    });

    this.realtimeEvents.emit(partieTopic(scenario.partieId));
    return this.enrich(flattenScenario(updated), partie.kind, grant);
  }

  async uploadDocument(
    partieId: string,
    mjId: string,
    file: Express.Multer.File,
    scenarioId?: string,
  ): Promise<ScenarioDocumentDto> {
    await this.permissions.assert(mjId, 'SCENARIO_DOCUMENT_UPLOAD', { partieId });

    // scenarioId est un champ multipart optionnel : `undefined` = bibliothèque (voulu), mais
    // une chaîne vide ou malformée est une entrée cliente invalide, jamais interprétée
    // silencieusement comme "absent" (contrairement à un simple `if (scenarioId)`).
    if (scenarioId !== undefined) {
      if (!isUUID(scenarioId)) {
        throw new BadRequestException('scenarioId doit être un UUID valide ou absent');
      }
      const scenario = await this.findScenario(scenarioId);
      if (!scenario) throw new NotFoundException('Scénario introuvable');
      if (scenario.partieId !== partieId) {
        throw new BadRequestException("Ce scénario n'appartient pas à cette Partie");
      }
      if (scenario.status === 'PASSE') {
        throw new BadRequestException(
          'Un scénario clôturé ne peut plus recevoir de nouveaux documents — seul le résumé de fin (Epic 8) reste éditable',
        );
      }
    }

    const mime = detectDocumentMime(file.buffer);
    if (!mime) {
      throw new BadRequestException("Le fichier fourni n'est pas un PDF ou un texte valide");
    }
    if (mime === 'application/pdf' && !(await isStructurallyValidPdf(file.buffer))) {
      throw new BadRequestException(
        'Le fichier PDF fourni est corrompu ou structurellement invalide',
      );
    }

    const filename = await writeDocumentFile(file.buffer, mime);
    try {
      const document = await this.prisma.scenarioDocument.create({
        data: {
          partieId,
          scenarioId: scenarioId ?? null,
          filename,
          originalName: file.originalname,
          sizeBytes: file.size,
        },
      });
      this.realtimeEvents.emit(partieTopic(partieId));
      return toDocumentDto(document);
    } catch (e) {
      // Nettoyage du fichier orphelin si l'insertion échoue — même pattern que
      // updatePortrait (Story 4.5) : jamais de fichier sur disque sans ligne correspondante.
      await deleteDocumentFile(filename);
      throw e;
    }
  }

  async listDocuments(scenarioId: string, userId: string): Promise<ScenarioDocumentDto[]> {
    const grant = await this.permissions.assert(userId, 'SCENARIO_DOCUMENTS_READ', {
      eventId: scenarioId,
    });
    const scenario = await this.findScenario(scenarioId);
    if (!scenario) throw new NotFoundException('Scénario introuvable');

    // Anti-spoil serveur : pour un joueur, le brouillon caché n'existe pas (404) et les documents
    // ciblés sur un scénario non diffusé (hors `COURANT`/`PASSE`) ne sont pas servis — seule la
    // bibliothèque de la partie (`scenarioId` nul) l'est toujours.
    const player = isSpoilRestricted(grant.role);
    if (player && isHiddenDraft(scenario.status, grant.partie.kind)) {
      throw new NotFoundException('Scénario introuvable');
    }
    const withScenarioDocuments = !player || isReleased(scenario.status);

    const documents = await this.prisma.scenarioDocument.findMany({
      where: withScenarioDocuments
        ? { OR: [{ scenarioId }, { partieId: scenario.partieId, scenarioId: null }] }
        : { partieId: scenario.partieId, scenarioId: null },
      orderBy: { createdAt: 'desc' },
    });
    return documents.map(toDocumentDto);
  }

  async listLibraryDocuments(partieId: string, userId: string): Promise<ScenarioDocumentDto[]> {
    await this.permissions.assert(userId, 'SCENARIO_DOCUMENTS_READ', { partieId });

    const documents = await this.prisma.scenarioDocument.findMany({
      where: { partieId, scenarioId: null },
      orderBy: { createdAt: 'desc' },
    });
    return documents.map(toDocumentDto);
  }

  async listDrafts(partieId: string, mjId: string): Promise<ScenarioDto[]> {
    const { partie } = await this.permissions.assert(mjId, 'SCENARIO_DRAFTS_READ', { partieId });

    const scenarios = (
      await this.prisma.scenario.findMany({
        where: { event: { partieId }, status: 'BROUILLON' },
        orderBy: { event: { createdAt: 'desc' } },
        include: WITH_EVENT,
      })
    ).map(flattenScenario);
    const seancesByScenario = await loadSeancesBatch(
      this.prisma,
      scenarios.map((s) => s.id),
      await countParticipants(this.prisma, partieId),
      this.seanceCanOf(mjId),
    );
    return scenarios.map((s) =>
      toDto(s, partie.kind, undefined, seancesByScenario.get(s.id) ?? []),
    );
  }

  // Anti-spoil serveur (PRD FR-5/FR-6) : lecture ouverte à tout membre (`SCENARIO_READ`), pas MJ-only
  // comme listDrafts. Le MJ voit tout. Un joueur ne reçoit pas les brouillons cachés (hors
  // `ONE_SHOT`) et le contenu d'un scénario `A_VENIR` ou brouillon de `ONE_SHOT` est masqué
  // (`redactForViewer`). Tri chronologique croissant (passé → futur) pour alimenter la timeline
  // joueur (Story 7.5).
  async findAllForPartie(
    partieId: string,
    userId: string,
    pagination?: { skip?: number; take?: number },
  ): Promise<ScenarioDto[]> {
    const { partie, role } = await this.permissions.assert(userId, 'SCENARIO_READ', { partieId });

    const scenarios = (
      await this.prisma.scenario.findMany({
        where: isSpoilRestricted(role)
          ? { AND: [{ event: { partieId } }, VISIBLE_SCENARIO_WHERE] }
          : { event: { partieId } },
        orderBy: [{ event: { createdAt: 'asc' } }, { id: 'asc' }],
        skip: pagination?.skip,
        take: pagination?.take,
        include: WITH_EVENT,
      })
    ).map(flattenScenario);
    const scenarioIds = scenarios.map((s) => s.id);
    const seancesByScenario = await loadSeancesBatch(
      this.prisma,
      scenarioIds,
      await countParticipants(this.prisma, partieId),
      this.seanceCanOf(userId),
    );

    if (partie.kind !== 'CAMPAGNE_EPISODIQUE') {
      return Promise.all(
        scenarios.map(async (s) => {
          const seances = seancesByScenario.get(s.id) ?? [];
          const retrospectiveNotes = await loadRetrospectiveNotes(
            this.prisma,
            this.characters,
            s,
            partie.kind,
            seances,
            undefined,
          );
          return redactForViewer(
            toDto(s, partie.kind, undefined, seances, retrospectiveNotes),
            role,
            partie.kind,
          );
        }),
      );
    }

    const participants = await this.prisma.scenarioParticipant.findMany({
      where: { scenarioId: { in: scenarioIds } },
      include: { user: { select: { pseudo: true, displayName: true } } },
    });
    const byScenario = new Map<string, { userId: string; pseudo: string; displayName: string }[]>();
    for (const p of participants) {
      const list = byScenario.get(p.scenarioId) ?? [];
      list.push({
        userId: p.userId,
        pseudo: p.user.pseudo,
        displayName: p.user.displayName,
      });
      byScenario.set(p.scenarioId, list);
    }
    return Promise.all(
      scenarios.map(async (s) => {
        const seances = seancesByScenario.get(s.id) ?? [];
        const scenarioParticipants = byScenario.get(s.id) ?? [];
        const retrospectiveNotes = await loadRetrospectiveNotes(
          this.prisma,
          this.characters,
          s,
          partie.kind,
          seances,
          scenarioParticipants,
        );
        return redactForViewer(
          toDto(s, partie.kind, scenarioParticipants, seances, retrospectiveNotes),
          role,
          partie.kind,
        );
      }),
    );
  }

  /**
   * Lecture en lot, générique (AD-23) : les scénarios `PASSE` de N parties avec leurs participants,
   * et les membres de chacune de ces parties — TROIS requêtes groupées (scénarios, inscrits,
   * membres), jamais une boucle sur `findAllForPartie`. Ce service ne connaît pas les Hommes
   * Dragons : l'appelant décide quelles parties lui importent et assume la garde d'accès
   * (aucune ici — réservée aux services qui ont déjà établi que l'appelant peut tout lire).
   *
   * Règle de participation, identique à `findAllForPartie` (AD-4) : `CAMPAGNE_EPISODIQUE` →
   * inscrits au scénario ; sinon tous les membres de la partie. Les scénarios sont triés par date
   * de clôture puis id croissants. `kind` est lu par la relation `partie`, jamais par une requête
   * dédiée. Les membres sont dans l'ordre d'arrivée (`joinedAt`, `userId`), MJ exclu.
   */
  async findPasseForParties(partieIds: string[]): Promise<{
    scenarios: PasseScenarioBatchItem[];
    membersByPartie: Map<string, BatchParticipant[]>;
  }> {
    const membersByPartie = new Map<string, BatchParticipant[]>();
    if (partieIds.length === 0) return { scenarios: [], membersByPartie };

    const [scenarios, memberships] = await Promise.all([
      this.prisma.scenario.findMany({
        where: {
          event: { partieId: { in: partieIds } },
          status: 'PASSE',
          closedAt: { not: null },
        },
        orderBy: [{ closedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          closedAt: true,
          event: {
            select: { partieId: true, title: true, partie: { select: { kind: true } } },
          },
        },
      }),
      this.prisma.membership.findMany({
        where: { partieId: { in: partieIds } },
        orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
        include: { user: { select: { pseudo: true, displayName: true } } },
      }),
    ]);

    for (const m of memberships) {
      const list = membersByPartie.get(m.partieId) ?? [];
      list.push({ userId: m.userId, pseudo: m.user.pseudo, displayName: m.user.displayName });
      membersByPartie.set(m.partieId, list);
    }

    const episodicScenarioIds = scenarios
      .filter((s) => s.event.partie.kind === 'CAMPAGNE_EPISODIQUE')
      .map((s) => s.id);
    const inscrits =
      episodicScenarioIds.length === 0
        ? []
        : await this.prisma.scenarioParticipant.findMany({
            where: { scenarioId: { in: episodicScenarioIds } },
            include: { user: { select: { pseudo: true, displayName: true } } },
          });
    const inscritsByScenario = new Map<string, BatchParticipant[]>();
    for (const p of inscrits) {
      const list = inscritsByScenario.get(p.scenarioId) ?? [];
      list.push({ userId: p.userId, pseudo: p.user.pseudo, displayName: p.user.displayName });
      inscritsByScenario.set(p.scenarioId, list);
    }

    return {
      scenarios: scenarios.map((s) => ({
        id: s.id,
        partieId: s.event.partieId,
        title: s.event.title,
        closedAt: (s.closedAt as Date).toISOString(),
        participants:
          s.event.partie.kind === 'CAMPAGNE_EPISODIQUE'
            ? (inscritsByScenario.get(s.id) ?? [])
            : (membersByPartie.get(s.event.partieId) ?? []),
      })),
      membersByPartie,
    };
  }

  async open(scenarioId: string, mjId: string): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(mjId, 'SCENARIO_STATUS_CHANGE', {
      eventId: scenarioId,
    });
    const scenario = await this.findScenario(scenarioId);
    if (!scenario) throw new NotFoundException('Scénario introuvable');
    const { partie } = grant;

    if (scenario.status !== 'BROUILLON') {
      throw new BadRequestException('Seul un scénario Brouillon peut être ouvert aux joueurs');
    }

    // Anti-spoil serveur : `Partie.nextSessionDate/Slot` ignore les séances d'un brouillon caché ;
    // ouvrir le scénario rend ses séances datées éligibles. Changement de statut et recalcul (seul
    // écrivain : `events/`, sous verrou de la partie) dans UNE transaction ; émission après validation.
    const updated = await this.prisma.$transaction(async (tx) => {
      const opened = flattenScenario(
        await tx.scenario.update({
          where: { id: scenarioId },
          data: { status: 'A_VENIR' },
          include: WITH_EVENT,
        }),
      );
      await this.events.recalculateNextSessionInTx(tx, scenario.partieId);
      return opened;
    });

    this.realtimeEvents.emit(partieTopic(scenario.partieId));
    // Deferred-work (SSE, calendrier personnel) : un scénario ouvert peut rendre une inscription
    // atteignable pour un membre — sans ceci, GET /me/calendar reste périmé jusqu'au prochain
    // changement de plage.
    await this.parties.notifyPartieSignalsChanged(scenario.partieId, mjId);
    return this.enrich(updated, partie.kind, grant);
  }

  // AD-10 : unicité du scénario Courant vérifiée en service (verrou SELECT ... FOR UPDATE, même
  // mécanisme qu'AD-5), uniquement pour CAMPAGNE_LINEAIRE — CAMPAGNE_EPISODIQUE/ONE_SHOT autorisent
  // plusieurs COURANT simultanés (AD-4), aucun verrou/vérification pour ces kinds.
  async markCourant(scenarioId: string, mjId: string): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(mjId, 'SCENARIO_STATUS_CHANGE', {
      eventId: scenarioId,
    });
    const scenario = await this.findScenario(scenarioId);
    if (!scenario) throw new NotFoundException('Scénario introuvable');
    const { partie } = grant;

    if (scenario.status !== 'A_VENIR') {
      throw new BadRequestException('Seul un scénario À venir peut être marqué Courant');
    }

    if (partie.kind === 'CAMPAGNE_LINEAIRE') {
      const updated = await this.prisma.$transaction(async (tx) => {
        // Story 37.3 : `partieId` vit sur l'événement — verrou des scénarios de la partie par
        // jointure, `OF s` pour ne verrouiller que les lignes `Scenario` (comme avant).
        await tx.$queryRaw`SELECT s."id" FROM "Scenario" s JOIN "Event" e ON e."id" = s."id" WHERE e."partieId" = ${partie.id} FOR UPDATE OF s`;
        const existingCourant = await tx.scenario.findFirst({
          where: { event: { partieId: partie.id }, status: 'COURANT' },
        });
        if (existingCourant) {
          throw new ConflictException('Un scénario est déjà marqué Courant sur cette Partie.');
        }
        // `status: 'A_VENIR'` dans le where empêche d'écraser un statut ayant changé
        // entre la lecture hors verrou plus haut et cette écriture sous verrou.
        const { count } = await tx.scenario.updateMany({
          where: { id: scenarioId, status: 'A_VENIR' },
          data: { status: 'COURANT' },
        });
        if (count === 0) {
          throw new ConflictException('Le statut du scénario a changé entretemps, réessayez.');
        }
        return flattenScenario(
          await tx.scenario.findUniqueOrThrow({ where: { id: scenarioId }, include: WITH_EVENT }),
        );
      });
      this.realtimeEvents.emit(partieTopic(partie.id));
      // AUCUN_SCENARIO_EN_COURS (Story 29.7, AD-14) : en plus de partieTopic, jamais en remplacement.
      await this.parties.notifyPartieSignalsChanged(partie.id, mjId);
      return this.enrich(updated, partie.kind, grant);
    }

    const { count } = await this.prisma.scenario.updateMany({
      where: { id: scenarioId, status: 'A_VENIR' },
      data: { status: 'COURANT' },
    });
    if (count === 0) {
      throw new ConflictException('Le statut du scénario a changé entretemps, réessayez.');
    }
    const updated = await this.reloadScenario(scenarioId);
    this.realtimeEvents.emit(partieTopic(partie.id));
    // AUCUN_SCENARIO_EN_COURS (Story 29.7, AD-14) : en plus de partieTopic ci-dessus, jamais en
    // remplacement.
    await this.parties.notifyPartieSignalsChanged(partie.id, mjId);
    return this.enrich(updated, partie.kind, grant);
  }

  // AD-9 : écriture MJ-only (`SCENARIO_STATUS_CHANGE`). Contrairement à markCourant/AD-10, close() ne
  // contraint que le scénario ciblé lui-même — updateMany + count suffit (pas de verrou
  // FOR UPDATE/$transaction, aucune contrainte d'unicité entre scénarios ici).
  async close(scenarioId: string, mjId: string): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(mjId, 'SCENARIO_STATUS_CHANGE', {
      eventId: scenarioId,
    });
    const scenario = await this.findScenario(scenarioId);
    if (!scenario) throw new NotFoundException('Scénario introuvable');
    const { partie } = grant;

    if (scenario.status !== 'COURANT') {
      throw new BadRequestException('Seul un scénario Courant peut être clôturé');
    }

    const { count } = await this.prisma.scenario.updateMany({
      where: { id: scenarioId, status: 'COURANT' },
      data: { status: 'PASSE', closedAt: new Date() },
    });
    if (count === 0) {
      throw new ConflictException('Le statut du scénario a changé entretemps, réessayez.');
    }
    const updated = await this.reloadScenario(scenarioId);
    this.realtimeEvents.emit(partieTopic(scenario.partieId));
    // AUCUN_SCENARIO_EN_COURS (Story 29.7, AD-14) : la partie perd son scénario COURANT — en plus
    // de partieTopic ci-dessus, jamais en remplacement.
    await this.parties.notifyPartieSignalsChanged(scenario.partieId, mjId);
    return this.enrich(updated, partie.kind, grant);
  }

  // AD-9 : action joueur (`SCENARIO_PARTICIPATE`) — MJ+membre. AD-4 : ScenarioParticipant
  // n'existe que pour CAMPAGNE_EPISODIQUE, jamais peuplé/lu pour ONE_SHOT/CAMPAGNE_LINEAIRE.
  async participate(scenarioId: string, userId: string): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(userId, 'SCENARIO_PARTICIPATE', {
      eventId: scenarioId,
    });
    const scenario = await this.findScenario(scenarioId);
    if (!scenario) throw new NotFoundException('Scénario introuvable');
    const { partie } = grant;

    // Anti-spoil serveur : un joueur ne peut ni deviner l'existence d'un brouillon caché (404, aucune
    // écriture) ni rejoindre un scénario clôturé (400).
    if (isSpoilRestricted(grant.role)) {
      if (isHiddenDraft(scenario.status, partie.kind)) {
        throw new NotFoundException('Scénario introuvable');
      }
      if (scenario.status === 'PASSE') {
        throw new BadRequestException('Impossible de participer à un scénario clôturé');
      }
    }

    if (partie.kind !== 'CAMPAGNE_EPISODIQUE') {
      throw new BadRequestException(
        "La participation individuelle n'est disponible que pour les campagnes épisodiques",
      );
    }

    await this.prisma.scenarioParticipant.upsert({
      where: { scenarioId_userId: { scenarioId, userId } },
      create: { scenarioId, userId },
      update: {},
    });

    const updated = await this.reloadScenario(scenarioId);
    this.realtimeEvents.emit(partieTopic(partie.id));
    return this.enrich(updated, partie.kind, grant);
  }

  // AD-9 : écriture MJ-only (`SEANCE_ADD`, comme create/update/open/markCourant/close) — ajouter
  // une séance est une action MJ, contrairement à participate() (AD-9 joueur). Aucun plafond (AC1).
  async addSeance(scenarioId: string, mjId: string, durationSlots?: number): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(mjId, 'SEANCE_ADD', { eventId: scenarioId });
    const scenario = await this.findScenario(scenarioId);
    if (!scenario) throw new NotFoundException('Scénario introuvable');
    const { partie } = grant;

    if (scenario.status === 'PASSE') {
      throw new BadRequestException("Impossible d'ajouter une séance à un scénario clôturé");
    }

    // Story 37.3 : écriture déléguée à `EventsService` (qui émet `partie:`).
    // Story 47.1 : la durée est passée à `events/`, seul écrivain (absente = 1 créneau).
    await this.events.addSeance(grant, scenarioId, durationSlots);

    const updated = await this.reloadScenario(scenarioId);
    // Deferred-work (SSE, calendrier personnel) : une nouvelle séance peut apparaître dans
    // mes-seances/inscriptions-ouvertes pour un membre — GET /me/calendar doit le savoir.
    await this.parties.notifyPartieSignalsChanged(partie.id, mjId);
    return this.enrich(updated, partie.kind, grant);
  }

  // AD-9 : écriture MJ-only (`SEANCE_DELETE`). Un scénario a toujours au moins une séance (invariant
  // posé à sa création, cf. create()) — la toute première (par createdAt croissant, id en
  // tie-breaker si égalité exacte) ne peut donc jamais être supprimée (Story 8.7, AC5). Un
  // scénario PASSE (clôturé) est figé — sa découpe en séances ne doit plus changer rétroactivement
  // (revue de code Story 8.7). Inscription.onDelete: Cascade (déjà en place) supprime
  // automatiquement les inscriptions liées ; le SessionPoll lié (si pollId posé) est supprimé
  // ensuite (revue de code Story 8.8 : sans séance, le vote n'a plus de sens — cf.
  // `EventsService.deleteSeance`). Story 8.8 : supprimer une séance peut faire disparaître la date
  // la plus proche de la Partie → recalcul.
  async deleteSeance(seanceId: string, mjId: string): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(mjId, 'SEANCE_DELETE', { seanceId });
    const seance = await this.prisma.seance.findUnique({
      where: { id: seanceId },
    });
    if (!seance) throw new NotFoundException('Séance introuvable');
    const scenario = await resolveScenarioOrThrow(this.prisma, seance.eventId);
    const { partie } = grant;

    if (scenario.status === 'PASSE') {
      throw new BadRequestException("Impossible de supprimer une séance d'un scénario clôturé");
    }

    // Story 37.3 : règles de la séance (première séance protégée, 404 concurrent, vote lié
    // supprimé, recalcul de la prochaine date) et émission `partie:` déléguées à `EventsService`.
    await this.events.deleteSeance(grant, seance);

    const updated = await this.reloadScenario(scenario.id);
    // Deferred-work (SSE, calendrier personnel) : une séance supprimée peut retirer une ligne de
    // mes-seances/votes-en-cours chez un membre — GET /me/calendar doit le savoir.
    await this.parties.notifyPartieSignalsChanged(scenario.partieId, mjId);
    return this.enrich(updated, partie.kind, grant);
  }

  // AD-4 révisé (Story 8.8, Décision 1) : une Seance CAMPAGNE_EPISODIQUE peut désormais être liée à
  // un SessionPoll comme n'importe quel autre kind — le vote choisit *quand*, l'Inscription choisit
  // *qui* ; les deux coexistent sur la même séance. P2-AD-2 : PollModule reste le seul écrivain de
  // SessionPoll — cette méthode ne fait que poser la relation Seance.pollId (déjà @unique en base),
  // jamais créer/modifier un poll. Story 8.7 : point d'entrée unique — remplace l'ancien
  // linkSeancePoll() (créer un poll PUIS le lier en 2 appels séparés côté utilisateur).
  // ScenariosModule importe PollModule (lecture ET écriture ici, via PollService.create()) mais
  // PollModule/CreatePollDto restent inchangés (P2-AD-2) : aucune connaissance de Seance/Scenario
  // n'est ajoutée côté PollModule, c'est ScenariosService qui orchestre les deux écritures.
  // Story 47.4 : la non-atomicité de la 8.7 est levée — durée, vote et `Seance.pollId` sont écrits dans
  // UNE transaction (`EventsService.createSeancePoll`, sous les verrous de la partie puis de l'événement).
  async createSeancePoll(
    seanceId: string,
    mjId: string,
    options: { date: string; slot: DaySlot }[],
    expiresAt?: string,
    durationSlots?: number,
  ): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(mjId, 'SEANCE_POLL_CREATE', { seanceId });
    const seance = await this.prisma.seance.findUnique({
      where: { id: seanceId },
    });
    if (!seance) throw new NotFoundException('Séance introuvable');
    const scenario = await resolveScenarioOrThrow(this.prisma, seance.eventId);
    const { partie } = grant;

    // Un scénario PASSE est figé (cohérent avec deleteSeance/resetSeanceDate) : pas de nouveau
    // vote de date sur une séance dont le scénario est clôturé (revue de code, 2026-07-14).
    if (scenario.status === 'PASSE') {
      throw new BadRequestException(
        "Impossible de créer un vote de date pour une séance d'un scénario clôturé",
      );
    }

    // Story 37.3 : `EventsService` refuse une séance déjà liée AVANT de faire créer le vote par
    // `PollService` (seul écrivain de SessionPoll), pose `Seance.pollId` et émet `partie:`.
    // Story 37.6 : l'autorisation `SEANCE_POLL_CREATE` couvre aussi la création du vote — plus de
    // second contrôle de droit dans `PollService.create()`.
    // Story 47.4 : `PollService` prépare le vote, `EventsService` ouvre la transaction et y écrit la durée,
    // le vote (par l'écriture rendue) puis `Seance.pollId`.
    await this.pollService.create(grant, mjId, { options, expiresAt }, (write) =>
      this.events.createSeancePoll(grant, seance, durationSlots, write),
    );

    const updated = await this.reloadScenario(scenario.id);
    return this.enrich(updated, partie.kind, grant);
  }

  // Story 8.8, AC4 : détache le poll de la séance (Seance.pollId = null) et efface sa plage de
  // date (Story 37.4), PUIS supprime le SessionPoll lui-même (revue de code, décision
  // utilisateur : sans séance à dater, le vote n'a plus de sens — plus d'orphelin injoignable).
  // Ordre requis : détacher avant de supprimer (Seance.pollId référence SessionPoll en FK). Permet
  // de rappeler createSeancePoll() ensuite (sa garde « déjà liée à un vote » n'est plus bloquée une
  // fois pollId à null). Un scénario PASSE est figé (cohérent avec deleteSeance, revue Story 8.7).
  async resetSeanceDate(seanceId: string, mjId: string): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(mjId, 'SEANCE_DATE_RESET', { seanceId });
    const seance = await this.prisma.seance.findUnique({
      where: { id: seanceId },
    });
    if (!seance) throw new NotFoundException('Séance introuvable');
    const scenario = await resolveScenarioOrThrow(this.prisma, seance.eventId);
    const { partie } = grant;

    if (scenario.status === 'PASSE') {
      throw new BadRequestException(
        "Impossible de réinitialiser la date d'une séance d'un scénario clôturé",
      );
    }

    // Story 37.3 : détachement, suppression du vote, recalcul et émission `partie:` délégués.
    await this.events.resetSeanceDate(grant, seance);

    const updated = await this.reloadScenario(scenario.id);
    // Deferred-work (SSE, calendrier personnel) : une date réinitialisée rouvre un vote absent de
    // votes-en-cours chez un membre — GET /me/calendar doit le savoir.
    await this.parties.notifyPartieSignalsChanged(scenario.partieId, mjId);
    return this.enrich(updated, partie.kind, grant);
  }

  // AD-4/AD-5 : capacité d'inscription réservée à CAMPAGNE_EPISODIQUE — symétrique au rejet
  // CAMPAGNE_EPISODIQUE de linkSeancePoll (ici c'est l'inverse qui est rejeté). addSeance() reste
  // inchangé (Story 8.2) : la capacité se définit dans un second temps, comme linkSeancePoll pour
  // le linéaire (cf. Dev Notes Story 8.3 — schéma en deux temps cohérent entre les deux mécanismes).
  async setSeanceCapacity(
    seanceId: string,
    mjId: string,
    inscriptionMin: number,
    inscriptionMax: number,
  ): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(mjId, 'SEANCE_CAPACITY_SET', { seanceId });
    const seance = await this.prisma.seance.findUnique({
      where: { id: seanceId },
    });
    if (!seance) throw new NotFoundException('Séance introuvable');
    const scenario = await resolveScenarioOrThrow(this.prisma, seance.eventId);
    const { partie } = grant;

    if (scenario.status === 'PASSE') {
      throw new BadRequestException(
        "Impossible de définir la capacité d'une séance d'un scénario clôturé",
      );
    }
    if (partie.kind !== 'CAMPAGNE_EPISODIQUE') {
      throw new BadRequestException(
        "La capacité d'inscription ne peut être définie que pour les campagnes épisodiques",
      );
    }
    // Story 37.3 : contrôle min/max, écriture et émission `partie:` délégués à `EventsService`.
    await this.events.setSeanceCapacity(grant, seanceId, inscriptionMin, inscriptionMax);

    const updated = await this.reloadScenario(scenario.id);
    // Deferred-work (SSE, calendrier personnel) : une capacité posée peut rendre une inscription
    // ouvrable pour un membre — GET /me/calendar doit le savoir.
    await this.parties.notifyPartieSignalsChanged(scenario.partieId, mjId);
    return this.enrich(updated, partie.kind, grant);
  }

  // AD-5 (verbatim) : verrou de ligne explicite SELECT ... FOR UPDATE obligatoire — READ COMMITTED
  // seul ne suffit pas à empêcher un dépassement de max entre deux inscriptions concurrentes.
  async inscrire(seanceId: string, userId: string): Promise<ScenarioDto | EventCardDto> {
    const grant = await this.permissions.assert(userId, 'SEANCE_INSCRIBE', { seanceId });
    const seance = await this.prisma.seance.findUnique({
      where: { id: seanceId },
    });
    if (!seance) throw new NotFoundException('Séance introuvable');
    // Story 40.3 : la séance d'un groupe de ralliement est celle d'une conjonction (aucun scénario) —
    // branche décidée par la famille de la partie de la séance, avant toute règle du JDR.
    if (familyOf(grant.partie.gameSystemId) === 'ralliement') {
      return this.groupEvents.inscrire(grant, userId);
    }
    const scenario = await resolveScenarioOrThrow(this.prisma, seance.eventId);
    const { partie } = grant;

    // Anti-spoil serveur : la séance d'un brouillon caché n'existe pas pour un joueur (404, comme
    // `desinscrire`/`participate`) — avant le 400 « non actif », qui révélerait son existence.
    if (isSpoilRestricted(grant.role) && isHiddenDraft(scenario.status, partie.kind)) {
      throw new NotFoundException('Séance introuvable');
    }
    if (scenario.status === 'BROUILLON' || scenario.status === 'PASSE') {
      throw new BadRequestException(
        "Impossible de s'inscrire à une séance dont le scénario n'est pas actif",
      );
    }
    if (partie.kind !== 'CAMPAGNE_EPISODIQUE') {
      throw new BadRequestException(
        "L'inscription à capacité limitée n'est disponible que pour les campagnes épisodiques",
      );
    }
    // Story 37.3 : règles de la séance (capacité définie, gel par la date, verrou FOR UPDATE,
    // idempotence, plafond) et émission `partie:` déléguées à `EventsService`.
    await this.events.inscrire(grant, seance, userId);

    const updated = await this.reloadScenario(scenario.id);
    // Deferred-work (SSE, calendrier personnel) : une inscription change inscritsCount pour tous
    // les autres membres — GET /me/calendar doit le savoir. `userId` ici est le joueur agissant,
    // pas le MJ : notifyPartieSignalsChanged() veut l'id du MJ (partie.ownerId), porté par
    // l'autorisation ci-dessus.
    await this.parties.notifyPartieSignalsChanged(scenario.partieId, partie.ownerId);
    return this.enrich(updated, partie.kind, grant);
  }

  // deleteMany (pas delete) : idempotent si l'utilisateur n'était pas inscrit — pas d'effet de
  // bord dangereux possible, aucune garde de kind/capacité nécessaire (cf. Dev Notes Story 8.3).
  // Story 17.2 (AC1) : décision explicite de ne PAS ajouter de garde de statut scénario non plus —
  // un retrait d'inscription reste sûr et réversible quel que soit le statut (y compris PASSE).
  async desinscrire(seanceId: string, userId: string): Promise<ScenarioDto | EventCardDto> {
    const grant = await this.permissions.assert(userId, 'SEANCE_UNSUBSCRIBE', { seanceId });
    const seance = await this.prisma.seance.findUnique({
      where: { id: seanceId },
    });
    if (!seance) throw new NotFoundException('Séance introuvable');
    // Story 40.3 : même branche « groupe » que `inscrire`.
    if (familyOf(grant.partie.gameSystemId) === 'ralliement') {
      return this.groupEvents.desinscrire(grant, userId);
    }
    const scenario = await resolveScenarioOrThrow(this.prisma, seance.eventId);
    const { partie } = grant;

    // Anti-spoil serveur : la séance d'un brouillon caché n'existe pas pour un joueur — sans quoi la
    // réponse renverrait le DTO du brouillon.
    if (isSpoilRestricted(grant.role) && isHiddenDraft(scenario.status, partie.kind)) {
      throw new NotFoundException('Séance introuvable');
    }

    // Décision utilisateur (revue de code, 2026-07-14) : la date validée fige le roster — un
    // joueur ne peut plus se désinscrire une fois la séance confirmée par le MJ. Story 37.3 : règle,
    // retrait et émission `partie:` délégués à `EventsService`.
    await this.events.desinscrire(grant, seance, userId);

    const updated = await this.reloadScenario(scenario.id);
    // Deferred-work (SSE, calendrier personnel) : même raison qu'inscrire() ci-dessus.
    await this.parties.notifyPartieSignalsChanged(scenario.partieId, partie.ownerId);
    return this.enrich(updated, partie.kind, grant);
  }

  // ─── Places réservées d'une conjonction (Story 40.4) ────────────────────────────────────────
  // Routes partagées avec le JDR (`scenarios/seances/:id/…`) mais propres au groupe de ralliement :
  // la partie est résolue DEPUIS la séance par `PermissionService.assert` (jamais depuis la route).

  /** L'hôte de la conjonction réserve une place à un membre (`SEANCE_RESERVE` : cellule de rôle du
   *  groupe + « hôte de l'événement » décidé dans `assert()` ; nulle en JDR). Renvoie la carte à jour. */
  async reserver(seanceId: string, hostId: string, targetUserId: string): Promise<EventCardDto> {
    const grant = await this.permissions.assert(hostId, 'SEANCE_RESERVE', { seanceId });
    return this.groupEvents.reserver(grant, hostId, targetUserId);
  }

  /** L'hôte retire la réservation d'un membre (même droit). Renvoie la carte à jour. */
  async retirerReservation(
    seanceId: string,
    hostId: string,
    targetUserId: string,
  ): Promise<EventCardDto> {
    const grant = await this.permissions.assert(hostId, 'SEANCE_RESERVE', { seanceId });
    return this.groupEvents.retirerReservation(grant, hostId, targetUserId);
  }

  /** La personne à qui une place est réservée l'accepte (`SEANCE_INSCRIBE`, comme s'inscrire). La
   *  réservation n'existe que dans un groupe de ralliement : toute autre famille est refusée (403).
   *  Renvoie la carte à jour. */
  async accepterReservation(seanceId: string, userId: string): Promise<EventCardDto> {
    const grant = await this.permissions.assert(userId, 'SEANCE_INSCRIBE', { seanceId });
    if (familyOf(grant.partie.gameSystemId) !== 'ralliement') {
      throw new ForbiddenException(RALLIEMENT_UNAVAILABLE_MESSAGE);
    }
    return this.groupEvents.accepter(grant, userId);
  }

  // AD-1/AD-9 : compte-rendu = champ neutre de Seance, jamais restreint par kind ni par un
  // hypothétique statut (Seance n'en a aucun) — contrairement à setSeanceCapacity/inscrire/
  // validerDate (Story 8.3, réservés à CAMPAGNE_EPISODIQUE). Écriture MJ-only
  // (`SEANCE_COMPTE_RENDU_SET`).
  async setCompteRendu(seanceId: string, mjId: string, compteRendu: string): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(mjId, 'SEANCE_COMPTE_RENDU_SET', { seanceId });
    const seance = await this.prisma.seance.findUnique({
      where: { id: seanceId },
    });
    if (!seance) throw new NotFoundException('Séance introuvable');
    const scenario = await resolveScenarioOrThrow(this.prisma, seance.eventId);
    const { partie } = grant;

    await this.prisma.seance.update({
      where: { id: seanceId },
      data: { compteRendu },
    });

    const updated = await this.reloadScenario(scenario.id);
    this.realtimeEvents.emit(partieTopic(scenario.partieId));
    // COMPTE_RENDU_NON_REDIGE (Story 29.7, AD-14) : en plus de partieTopic ci-dessus, jamais en
    // remplacement.
    await this.parties.notifyPartieSignalsChanged(scenario.partieId, mjId);
    return this.enrich(updated, partie.kind, grant);
  }

  /** Informations pratiques d'une séance (Story 36.5, dérogation D-15 amendée le 2026-08-19).
   *  Même forme que setCompteRendu : champ neutre de Seance, jamais restreint par kind ni par un
   *  statut (Seance n'en a aucun), écriture MJ-only (`SEANCE_PRACTICAL_INFO_SET`).
   *
   *  🚨 Les trois valeurs sont écrites TELLES QUELLES. `heureRdv` n'est ni parsée, ni convertie,
   *  ni comparée : c'est une étiquette `"HH:MM"`, dont la forme a été garantie par le DTO. La
   *  chaîne de disponibilité continue de raisonner en créneau de journée (addendum §5.7).
   *  `null` vide le champ — c'est le seul moyen de le faire, et il doit rester possible. */
  async setInfosPratiques(
    seanceId: string,
    mjId: string,
    dto: SetInfosPratiquesPayload,
  ): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(mjId, 'SEANCE_PRACTICAL_INFO_SET', { seanceId });
    const seance = await this.prisma.seance.findUnique({
      where: { id: seanceId },
    });
    if (!seance) throw new NotFoundException('Séance introuvable');
    const scenario = await resolveScenarioOrThrow(this.prisma, seance.eventId);
    const { partie } = grant;

    // Story 37.3 : écriture (un seul update, les trois champs ensemble) et émission `partie:`
    // déléguées à `EventsService`.
    const { durationChanged } = await this.events.setInfosPratiques(grant, seanceId, dto);

    const updated = await this.reloadScenario(scenario.id);
    // Pas de notifyPartieSignalsChanged pour les informations pratiques : contrairement au
    // compte-rendu, leur absence n'est PAS un manquement et ne porte aucun signal (AC4). Corriger la
    // durée d'une séance, elle, déplace sa plage : les calendriers personnels doivent le savoir (47.1).
    if (durationChanged) {
      await this.parties.notifyPartieSignalsChanged(partie.id, mjId);
    }
    return this.enrich(updated, partie.kind, grant);
  }

  // AD-1/AD-9 : résumé de fin = champ de Scenario, écriture MJ-only (`SCENARIO_UPDATE`). Garde de statut
  // inversée par rapport à update() (scenarios.service.ts:76-80) : celle-ci rejette tant que le
  // scénario n'est pas encore PASSE, update() rejette une fois PASSE — les deux se complètent.
  // Aucune restriction de kind, rappelable à volonté après la première rédaction (AC3).
  async setResumeFin(scenarioId: string, mjId: string, resumeFin: string): Promise<ScenarioDto> {
    const grant = await this.permissions.assert(mjId, 'SCENARIO_UPDATE', { eventId: scenarioId });
    const scenario = await this.findScenario(scenarioId);
    if (!scenario) throw new NotFoundException('Scénario introuvable');
    const { partie } = grant;

    if (scenario.status !== 'PASSE') {
      throw new BadRequestException(
        "Le résumé de fin ne peut être rédigé qu'après clôture du scénario",
      );
    }

    const updated = flattenScenario(
      await this.prisma.scenario.update({
        where: { id: scenarioId },
        data: { resumeFin },
        include: WITH_EVENT,
      }),
    );

    this.realtimeEvents.emit(partieTopic(scenario.partieId));
    // RAPPORT_FIN_MANQUANT (Story 29.7, AD-14) : en plus de partieTopic ci-dessus, jamais en
    // remplacement.
    await this.parties.notifyPartieSignalsChanged(scenario.partieId, mjId);
    return this.enrich(updated, partie.kind, grant);
  }

  /** Story 9.1 (AD-2) : valide qu'un scenarioId existe et appartient à la Partie donnée — utilisé
   * par AnnouncementsService pour la portée d'une annonce. AUCUNE validation de statut ici
   * (contrairement à uploadDocument() qui bloque PASSE) : AD-2 est explicite, une annonce peut
   * viser un scénario BROUILLON/A_VENIR ; c'est la LECTURE qui la cache aux joueurs tant que le
   * scénario n'est ni COURANT ni PASSE (`RELEASED_ANNOUNCEMENT_WHERE`). */
  async verifyScenarioBelongsToPartie(scenarioId: string, partieId: string): Promise<void> {
    const scenario = await this.findScenario(scenarioId);
    if (!scenario) throw new NotFoundException('Scénario introuvable');
    if (scenario.partieId !== partieId) {
      throw new BadRequestException("Ce scénario n'appartient pas à cette Partie");
    }
  }

  async getDocumentFile(
    documentId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; mime: string; originalName: string }> {
    const document = await this.prisma.scenarioDocument.findUnique({
      where: { id: documentId },
      include: { scenario: { select: { status: true } } },
    });
    if (!document) throw new NotFoundException('Document introuvable');
    // La partie est celle du document lui-même, jamais un paramètre de route.
    const grant = await this.permissions.assert(userId, 'SCENARIO_DOCUMENTS_READ', {
      partieId: document.partieId,
    });
    // Anti-spoil serveur : un joueur n'obtient le fichier d'un document ciblé que si son scénario
    // est diffusé (`COURANT`/`PASSE`) — brouillon, `A_VENIR` : 404, aucun octet. La bibliothèque
    // (`scenarioId` nul) est toujours servie.
    if (
      isSpoilRestricted(grant.role) &&
      document.scenarioId !== null &&
      !(document.scenario && isReleased(document.scenario.status))
    ) {
      throw new NotFoundException('Document introuvable');
    }

    const file = await readDocumentFile(document.filename);
    if (!file) throw new NotFoundException('Fichier introuvable');

    return {
      buffer: file.buffer,
      mime: file.mime,
      originalName: document.originalName,
    };
  }
}

function toDocumentDto(document: ScenarioDocument): ScenarioDocumentDto {
  return {
    id: document.id,
    partieId: document.partieId,
    scenarioId: document.scenarioId,
    originalName: document.originalName,
    sizeBytes: document.sizeBytes,
    createdAt: document.createdAt.toISOString(),
  };
}

/** Inclusion de l'événement de base, porteur de `partieId/title/description/createdAt`. */
const WITH_EVENT = { event: true } as const;

type ScenarioWithEvent = Prisma.ScenarioGetPayload<{ include: typeof WITH_EVENT }>;

/** Scénario aplati (Story 37.3) : l'extension JDR et les champs de son événement de base, sous la
 *  forme qu'avait la ligne `Scenario` avant l'extraction — les projections DTO restent inchangées. */
export type ScenarioRow = Scenario &
  Pick<Event, 'partieId' | 'title' | 'description' | 'createdAt'>;

function toRow(scenario: Scenario, event: Event): ScenarioRow {
  return {
    id: scenario.id,
    partieId: event.partieId,
    title: event.title,
    description: event.description,
    createdAt: event.createdAt,
    status: scenario.status,
    dureeHeures: scenario.dureeHeures,
    dureeSeances: scenario.dureeSeances,
    resumeFin: scenario.resumeFin,
    closedAt: scenario.closedAt,
  };
}

function flattenScenario(scenario: ScenarioWithEvent): ScenarioRow {
  return toRow(scenario, scenario.event);
}

function toDto(
  scenario: ScenarioRow,
  partieKind?: PartieKind,
  participants?: { userId: string; pseudo: string; displayName: string }[],
  seances?: SeanceDto[],
  retrospectiveNotes?: CharacterNoteDto[],
): ScenarioDto {
  return {
    id: scenario.id,
    partieId: scenario.partieId,
    title: scenario.title,
    description: scenario.description,
    status: scenario.status,
    dureeHeures: scenario.dureeHeures,
    dureeSeances: scenario.dureeSeances,
    resumeFin: scenario.resumeFin,
    createdAt: scenario.createdAt.toISOString(),
    closedAt: scenario.closedAt ? scenario.closedAt.toISOString() : null,
    seances: seances ?? [],
    ...(partieKind === 'CAMPAGNE_EPISODIQUE' && {
      participants: participants ?? [],
    }),
    retrospectiveNotes,
  };
}

async function loadParticipants(
  prisma: PrismaService,
  scenarioId: string,
): Promise<{ userId: string; pseudo: string; displayName: string }[]> {
  const participants = await prisma.scenarioParticipant.findMany({
    where: { scenarioId },
    include: { user: { select: { pseudo: true, displayName: true } } },
  });
  return participants.map((p) => ({
    userId: p.userId,
    pseudo: p.user.pseudo,
    displayName: p.user.displayName,
  }));
}

const SEANCE_INCLUDE = {
  poll: {
    include: {
      options: {
        include: {
          votes: {
            include: { user: { select: { pseudo: true, displayName: true } } },
          },
        },
      },
    },
  },
  inscriptions: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] as Prisma.InscriptionOrderByWithRelationInput[],
    include: { user: { select: { pseudo: true } } },
  },
} as const;

/** Story 36.6 — `membersCount` arrive en paramètre : c'est une propriété de la PARTIE, calculée
 *  UNE fois par appel par `countParticipants()` (jamais une par séance ni par sondage, AD-3). */
function toSessionPollDto(
  poll: Prisma.SessionPollGetPayload<typeof SEANCE_INCLUDE.poll>,
  membersCount: number,
  // Story 47.4 : la durée du rendez-vous voté, lue de la séance qui porte le vote.
  durationSlots: number,
): SessionPollDto {
  return {
    id: poll.id,
    partieId: poll.partieId,
    status: poll.status,
    scenarioRef: poll.scenarioRef,
    expiresAt: poll.expiresAt?.toISOString() ?? null,
    chosenDate: poll.chosenDate?.toISOString() ?? null,
    chosenSlot: poll.chosenSlot,
    membersCount,
    durationSlots,
    options: (poll.options ?? []).map((opt) => ({
      id: opt.id,
      date: opt.date.toISOString(),
      slot: opt.slot,
      votes: (opt.votes ?? []).map((v) => ({
        userId: v.userId,
        pseudo: v.user.pseudo,
        displayName: v.user.displayName,
        answer: v.answer,
      })),
    })),
  };
}

/** Forme du payload accepté par setInfosPratiques (Story 36.5). Miroir de `SetInfosPratiquesDto`
 *  côté shared ; les trois champs sont saisis ensemble et `null` vide le champ. */
export interface SetInfosPratiquesPayload {
  heureRdv: string | null;
  lieu: string | null;
  notePratique: string | null;
  /** Story 47.1 : nouvelle durée du rendez-vous, en créneaux ; absente = inchangée. */
  durationSlots?: number;
}

/** Droits d'organisateur d'un lot de séances pour la personne qui lit (Story 44.1), alignés sur
 *  `seanceIds` — fournis par `PermissionService`, jamais déduits du rôle. */
type SeanceCanOf = (seanceIds: string[]) => Promise<OrganizerCan[]>;

function toSeanceDto(
  seance: Prisma.SeanceGetPayload<{ include: typeof SEANCE_INCLUDE }>,
  membersCount: number,
  can: OrganizerCan,
): SeanceDto {
  // Story 32.3 — la date EFFECTIVE remonte à la racine. Même résolution que partout ailleurs
  // (`EventsService.recalculateNextSession()`, `availability.service.ts`, `CalendarView`) : le vote scellé
  // d'abord, la colonne héritée ensuite. Sans ce champ, une séance datée dont `inscriptionMax`
  // est nul n'exposait aucune date — le bloc `inscription` était son seul porteur.
  // Story 37.4 : la plage de la séance est la seule source — `startDate`/`startSlot`. Un créneau
  // vide (date posée hors vote) reste « sans créneau » (`null`), comme `EventsService.recalculateNextSession()`.
  const dateEffective = seance.startDate ?? null;
  const slotEffectif = seance.startSlot ?? null;
  // Contrat inchangé du bloc `inscription` : `dateValidee` y garde sa sémantique brute d'avant la
  // plage — `null` quand la date vient d'un vote choisi, le début de la plage sinon.
  const dateHorsVote = seance.poll?.chosenDate ? null : dateEffective;
  return {
    id: seance.id,
    // Story 37.3 : le contrat garde `scenarioId` — même valeur que `Seance.eventId`.
    scenarioId: seance.eventId,
    poll: seance.poll
      ? toSessionPollDto(seance.poll, membersCount, seance.durationSlots)
      : undefined,
    inscription:
      seance.inscriptionMax != null
        ? {
            min: seance.inscriptionMin ?? 0,
            max: seance.inscriptionMax,
            inscrits: (seance.inscriptions ?? []).map((i) => ({
              userId: i.userId,
              pseudo: i.user.pseudo,
            })),
            dateValidee: dateHorsVote ? dateHorsVote.toISOString() : null,
          }
        : undefined,
    dateValidee: dateEffective ? dateEffective.toISOString() : null,
    slotValidee: slotEffectif,
    // Story 47.2 : la fin de la plage, lue de la séance (jamais de `poll.chosenDate`) ; le début à défaut.
    endDate: dateEffective ? (seance.endDate ?? dateEffective).toISOString() : null,
    endSlot: dateEffective ? (seance.endDate ? seance.endSlot : slotEffectif) : null,
    compteRendu: seance.compteRendu,
    // Story 36.5 — rendus tels quels. `heureRdv` reste une CHAÎNE : aucun new Date(), aucun
    // formatage, aucun tri. Le client l'affiche, il ne la calcule pas.
    heureRdv: seance.heureRdv ?? null,
    lieu: seance.lieu ?? null,
    notePratique: seance.notePratique ?? null,
    createdAt: seance.createdAt.toISOString(),
    durationSlots: seance.durationSlots,
    can,
  };
}

// AC2 (Story 17.2) : résout la relation Seance.eventId → Scenario (même identifiant, Story
// 37.3) sans laisser fuiter un 500 non contrôlé si la clé étrangère se révèle orpheline (cas
// normalement impossible en usage courant — findUniqueOrThrow() lève
// Prisma.PrismaClientKnownRequestError/P2025, vérifié empiriquement contre la base de ce projet).
async function resolveScenarioOrThrow(
  prisma: PrismaService,
  eventId: string,
): Promise<ScenarioRow> {
  try {
    return flattenScenario(
      await prisma.scenario.findUniqueOrThrow({
        where: { id: eventId },
        include: WITH_EVENT,
      }),
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw new NotFoundException('Scénario introuvable');
    }
    throw e;
  }
}

async function loadSeancesBatch(
  prisma: PrismaService,
  scenarioIds: string[],
  membersCount: number,
  canOf: SeanceCanOf,
): Promise<Map<string, SeanceDto[]>> {
  const seances = await prisma.seance.findMany({
    where: { eventId: { in: scenarioIds } },
    orderBy: { createdAt: 'asc' },
    include: SEANCE_INCLUDE,
  });
  // Un lot pour toutes les séances : le nombre de lectures de droits ne dépend pas du nombre de séances.
  const cans = await canOf(seances.map((s) => s.id));
  const byScenario = new Map<string, SeanceDto[]>();
  seances.forEach((s, i) => {
    const list = byScenario.get(s.eventId) ?? [];
    list.push(toSeanceDto(s, membersCount, cans[i]));
    byScenario.set(s.eventId, list);
  });
  return byScenario;
}

async function loadSeances(
  prisma: PrismaService,
  scenarioId: string,
  membersCount: number,
  canOf: SeanceCanOf,
): Promise<SeanceDto[]> {
  const byScenario = await loadSeancesBatch(prisma, [scenarioId], membersCount, canOf);
  return byScenario.get(scenarioId) ?? [];
}

// Garantit que `participants`/`seances` restent toujours cohérents sur le DTO retourné par toute
// transition d'état (create/open/update/markCourant/close/participate/addSeance/linkSeancePoll) —
// sinon ces champs redeviendraient `undefined`/vides après une action MJ, faisant disparaître à
// tort la liste des participants/séances côté frontend (ScenarioEditor/ScenarioReadDialog).
async function toEnrichedDto(
  prisma: PrismaService,
  characters: CharacterService,
  scenario: ScenarioRow,
  partieKind: PartieKind,
  viewerRole: PartieRole,
  canOf: SeanceCanOf,
): Promise<ScenarioDto> {
  return redactForViewer(
    await buildEnrichedDto(prisma, characters, scenario, partieKind, canOf),
    viewerRole,
    partieKind,
  );
}

/**
 * Anti-spoil serveur (PRD FR-5/FR-6) : un joueur ne reçoit ni la description, ni les durées, ni le
 * compte rendu des séances d'un scénario dont le contenu est masqué (`A_VENIR`, ou brouillon de
 * `ONE_SHOT`). Les champs restent présents mais nuls — la forme du DTO ne change pas. Le MJ reçoit
 * toujours le DTO complet. Titre, séances (dates, votes, inscriptions) et participants restent.
 */
function redactForViewer(dto: ScenarioDto, role: PartieRole, partieKind: PartieKind): ScenarioDto {
  if (!isSpoilRestricted(role) || !isRedactedForPlayer(dto.status, partieKind)) return dto;
  return {
    ...dto,
    description: null,
    dureeHeures: null,
    dureeSeances: null,
    seances: dto.seances.map((s) => ({ ...s, compteRendu: null })),
  };
}

async function buildEnrichedDto(
  prisma: PrismaService,
  characters: CharacterService,
  scenario: ScenarioRow,
  partieKind: PartieKind,
  canOf: SeanceCanOf,
): Promise<ScenarioDto> {
  // Story 36.6 — l'effectif est dérivé de `scenario.partieId`, déjà chargé, plutôt que threadé
  // depuis les 18 points d'appel : un paramètre de plus sur chacun n'aurait rien garanti de plus
  // et aurait multiplié les occasions de l'oublier. Un seul comptage par appel.
  const membersCount = await countParticipants(prisma, scenario.partieId);
  const seances = await loadSeances(prisma, scenario.id, membersCount, canOf);
  if (partieKind !== 'CAMPAGNE_EPISODIQUE') {
    const retrospectiveNotes = await loadRetrospectiveNotes(
      prisma,
      characters,
      scenario,
      partieKind,
      seances,
      undefined,
    );
    return toDto(scenario, partieKind, undefined, seances, retrospectiveNotes);
  }
  const participants = await loadParticipants(prisma, scenario.id);
  const retrospectiveNotes = await loadRetrospectiveNotes(
    prisma,
    characters,
    scenario,
    partieKind,
    seances,
    participants,
  );
  return toDto(scenario, partieKind, participants, seances, retrospectiveNotes);
}

// AD-11 : agrégation en lecture seule via CharacterService (jamais d'accès Prisma direct à
// CharacterNote depuis ScenariosModule). Ne s'exécute que pour un scénario PASSE (AC7) — sinon
// retourne `undefined` immédiatement, sans appel CharacterService. Fenêtre = [min, max] des dates
// des séances (poll.chosenDate ?? inscription.dateValidee, DTO inchangé), `null`/`null` si aucune
// séance datée (cf. `[ASSUMPTION]` Story 8.6 : aucune automatisation sur donnée non confirmée).
async function loadRetrospectiveNotes(
  prisma: PrismaService,
  characters: CharacterService,
  scenario: { id: string; partieId: string; status: string },
  partieKind: PartieKind,
  seances: SeanceDto[],
  participants: { userId: string; pseudo: string }[] | undefined,
): Promise<CharacterNoteDto[] | undefined> {
  if (scenario.status !== 'PASSE') return undefined;

  const dates = seances
    .map((s) => s.poll?.chosenDate ?? s.inscription?.dateValidee ?? null)
    .filter((d): d is string => d !== null)
    .map((d) => new Date(d));
  const windowStart =
    dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const windowEnd = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

  const allCharacters = await characters.findAllByPartie(scenario.partieId);
  const relevantCharacters =
    partieKind === 'CAMPAGNE_EPISODIQUE'
      ? allCharacters.filter((c) => (participants ?? []).some((p) => p.userId === c.userId))
      : allCharacters;

  const notesPerCharacter = await Promise.all(
    relevantCharacters.map((c) =>
      characters.getRetrospectiveNotes(c.id, scenario.id, windowStart, windowEnd),
    ),
  );
  return notesPerCharacter.flat();
}
