import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DaySlot, PartieKind, PartieRole, SessionPollDto } from '@master-jdr/shared';
// Import RUNTIME du registre des systèmes (Story 40.5) : la famille de la partie décide si le vote
// passe par les règles d'un groupe. Jamais `import type` sur une valeur.
import { defaultPollDeadline, familyOf } from '@master-jdr/shared';
import { countParticipants } from '../common/participant-count.util';
import { PermissionService, type PartieGrant } from '../permissions/permission.service';
import {
  HIDDEN_DRAFT_POLL_WHERE,
  VISIBLE_POLL_WHERE,
  isSpoilRestricted,
} from '../permissions/scenario-visibility';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';
import { CastVoteDto } from './dto/cast-vote.dto';
import { ChooseDateDto } from './dto/choose-date.dto';
import { CreatePollDto } from './dto/create-poll.dto';
import { ExtendPollDto } from './dto/extend-poll.dto';
import { Prisma } from '@prisma/client';
import { SetPollOptionsDto } from './dto/set-poll-options.dto';
import { GROUP_POLL_CHOOSE_PORT, type GroupPollChoosePort } from './ports/group-poll-choose.port';
import { GROUP_POLL_EXTEND_PORT, type GroupPollExtendPort } from './ports/group-poll-extend.port';
import { GROUP_POLL_VOTE_PORT, type GroupPollVotePort } from './ports/group-poll-vote.port';
import { PARTIE_SIGNALS_PORT, type PartieSignalsPort } from './ports/partie-signals.port';
import {
  RENDEZ_VOUS_DURATION_PORT,
  type RendezVousDurationPort,
} from './ports/rendez-vous-duration.port';
import { SEANCE_DATE_PORT, type SeanceDatePort } from './ports/seance-date.port';

/** Refus de fixer la date d'une conjonction dont la date est déjà fixée (Story 40.6). */
export const DATE_ALREADY_FIXED_MESSAGE = 'La date de cette conjonction est déjà fixée';

/** Refus de fixer la date d'une conjonction sur un créneau dont le jour est déjà passé (Story 40.6). */
export const PAST_OPTION_MESSAGE = 'Ce créneau est déjà passé : choisissez un jour à venir';

/** Refus de prolonger un vote dont la nouvelle échéance n'est pas un jour calendaire valide (Story 40.7). */
export const EXTEND_INVALID_DAY_MESSAGE = "La nouvelle échéance n'est pas un jour valide";

/** Refus de prolonger un vote vers un jour qui n'est pas strictement après l'échéance actuelle (Story 40.7). */
export const EXTEND_NOT_LATER_MESSAGE =
  "La nouvelle échéance doit être postérieure à l'échéance actuelle";

/** Bornes d'un sondage du JDR (Story 36.10) : de 2 à 40 créneaux. */
export const JDR_POLL_OPTION_BOUNDS = { min: 2, max: 40 } as const;

/** Garde technique d'un sondage de groupe (Story 40.5) : aucun plafond métier — seulement de quoi
 *  borner la charge d'une requête. */
export const GROUP_POLL_OPTION_BOUNDS = { min: 2, max: 200 } as const;

/** Refus de fixer une échéance de vote déjà passée (Story 40.5). */
export const POLL_DEADLINE_PAST_MESSAGE = "L'échéance du vote ne peut pas être passée";

/** Story 47.4 : refus d'un créneau « journée entière » proposé pour un rendez-vous de plusieurs créneaux. */
export const POLL_FULL_DAY_SPAN_MESSAGE =
  'Une journée entière ne dure qu’un créneau : retirez-la ou ramenez la durée à 1.';

/**
 * Story 47.4 — écrit, dans la transaction ouverte par l'appelant (celle qui pose aussi la durée et
 * `Seance.pollId`), le vote créé par `create()` : `durationSlots` est la durée EFFECTIVE du rendez-vous.
 */
export type PollWrite = (
  tx: Prisma.TransactionClient,
  durationSlots: number,
) => Promise<{ id: string }>;

/** Bornes du nombre de créneaux d'un sondage. */
export interface PollOptionBounds {
  min: number;
  max: number;
}

/** Un créneau candidat tel qu'écrit : un jour (instant UTC) et un créneau. */
export interface PollOptionInput {
  date: Date;
  slot: DaySlot;
}

const POLL_INCLUDE = {
  options: {
    include: {
      votes: {
        include: { user: { select: { pseudo: true, displayName: true } } },
      },
    },
  },
} as const;

@Injectable()
export class PollService {
  constructor(
    private readonly prisma: PrismaService,
    // Story 37.6 (AD-6) : tout droit sur une partie est décidé par le service de permission. Les
    // routes de vote gardent la cible `{ partieId }` de l'URL plus leurs propres contrôles
    // d'appartenance (vote → partie, option → vote).
    private readonly permissions: PermissionService,
    private readonly realtimeEvents: RealtimeEventsService,
    // Story 37.8 (AD-8) : couche 1 — les deux dépendances vers les couches supérieures sont des
    // ports (`poll/ports/`), liés par `PortsModule` : la date de la séance (écrite dans la
    // transaction de clôture du vote, avec `Partie.nextSessionDate/Slot`, seul écrivain
    // `events/`) et les signaux de partie (émis par `parties/`).
    @Inject(SEANCE_DATE_PORT) private readonly seanceDate: SeanceDatePort,
    @Inject(PARTIE_SIGNALS_PORT) private readonly partieSignals: PartieSignalsPort,
    // Story 40.5 : les règles d'un vote de GROUPE (votants éligibles, échéance, date déjà fixée) sont
    // celles de `events/`, jointes par un port — `poll/` ne connaît pas la conjonction.
    @Inject(GROUP_POLL_VOTE_PORT) private readonly groupVotes: GroupPollVotePort,
    // Story 40.6 : fixer la date d'une conjonction — le droit d'hôte et l'e-mail « C'est fixé » sont ceux
    // de `events/`, derrière ce port ; `poll/` garde l'écriture du sondage.
    @Inject(GROUP_POLL_CHOOSE_PORT) private readonly groupChoice: GroupPollChoosePort,
    // Story 40.7 : prolonger le vote d'une conjonction — le droit d'hôte est celui de `events/`, derrière
    // ce port ; `poll/` garde l'écriture du sondage.
    @Inject(GROUP_POLL_EXTEND_PORT) private readonly groupExtension: GroupPollExtendPort,
    // Story 47.4 : la durée du rendez-vous voté (`Seance.durationSlots`) est lue et écrite par `events/`,
    // derrière ce port — `poll/` ne touche jamais la séance.
    @Inject(RENDEZ_VOUS_DURATION_PORT) private readonly duration: RendezVousDurationPort,
  ) {}

  /** Crée un vote de date sur la partie de l'autorisation. Seul appelant :
   *  `ScenariosService.createSeancePoll()`, qui a déjà obtenu l'autorisation `SEANCE_POLL_CREATE`
   *  pour la séance visée (Story 37.6 : plus de second contrôle de droit ici).
   *
   *  Story 47.4 : `persist` reçoit l'écriture du vote et l'exécute dans SA transaction (verrous, durée,
   *  `Seance.pollId` : `EventsService.createSeancePoll`) ; absent, le vote est écrit seul, d'une durée 1. */
  async create(
    grant: PartieGrant,
    userId: string,
    dto: CreatePollDto,
    persist?: (write: PollWrite) => Promise<void>,
  ): Promise<SessionPollDto> {
    const partieId = grant.partieId;

    // Story 8.8 (Décision 2) : un seul vote actif par Séance, pas par Partie — plusieurs
    // SessionPoll OPEN peuvent désormais coexister sur la même Partie (un par Séance). La garde
    // « déjà liée à un vote de date » de ScenariosService.createSeancePoll() (Story 8.7) suffit à
    // garantir l'unicité au niveau Séance ; retiré : la fermeture auto de tout poll OPEN existant.
    const options = dto.options.map((o) => ({ date: new Date(o.date), slot: o.slot }));
    // Les doublons sont refusés AVANT d'ouvrir la transaction (comme avant la Story 40.5).
    assertNoDuplicateOptions(options);
    // Story 45.4 — la fin du vote choisie par le MJ (refusée si passée) ; absente, la fonction partagée la propose.
    const expiresAt = dto.expiresAt === undefined ? undefined : deadlineFromDay(dto.expiresAt);
    const written: { poll: PollWithOptions; durationSlots: number }[] = [];
    const write: PollWrite = async (tx, durationSlots) => {
      const poll = await this.createInTx(tx, partieId, userId, {
        options,
        scenarioRef: dto.scenarioRef ?? null,
        expiresAt,
        durationSlots,
      });
      written.push({ poll, durationSlots });
      return poll;
    };
    if (persist) {
      await persist(write);
    } else {
      await this.prisma.$transaction((tx) => write(tx, 1));
    }
    const result = written.at(-1);
    if (!result) throw new NotFoundException('Poll introuvable');
    this.realtimeEvents.emit(partieTopic(partieId));
    // AUCUNE_DATE_NI_VOTE (Story 29.7, AD-14) : en plus de partieTopic ci-dessus, jamais en
    // remplacement.
    await this.partieSignals.notifyChanged(partieId);
    return toDto(result.poll, await countParticipants(this.prisma, partieId), result.durationSlots);
  }

  /**
   * Écrit un vote de date DANS la transaction de l'appelant (Story 40.5) — l'unique écrivain de
   * `SessionPoll`/`PollOption`, que `create()` (JDR : échéance par défaut de 14 jours, bornes portées
   * par le DTO) et la création d'une conjonction à sondage (groupe : échéance choisie, créneaux sans
   * plafond métier, événement + séance + sondage écrits ensemble ou pas du tout) partagent. N'émet
   * rien : l'appelant émet après son commit.
   *
   * `expiresAt` absent → l'échéance par défaut du JDR. `bounds` absentes → aucune borne vérifiée ici
   * (le DTO du JDR les porte déjà) ; présentes, le nombre de créneaux y est contrôlé. Les doublons
   * (clé `date|slot` normalisée par `optionKey()`, la MÊME que celle de `setOptions()`) sont toujours
   * refusés. Story 47.4 : `durationSlots` (durée effective du rendez-vous, 1 si absente) refuse un créneau
   * `FULL_DAY` au-delà d'un créneau.
   */
  async createInTx(
    tx: Prisma.TransactionClient,
    partieId: string,
    userId: string,
    input: {
      options: PollOptionInput[];
      scenarioRef?: string | null;
      expiresAt?: Date;
      bounds?: PollOptionBounds;
      durationSlots?: number;
    },
  ): Promise<PollWithOptions> {
    // Revue de code (Story 36.10) — clé normalisée par `optionKey()` : comparer la chaîne brute reçue
    // laissait deux dates représentant le même instant (composante horaire ou décalage différents)
    // passer pour distinctes, ce que `@IsDateString()` autorise en entrée.
    assertOptionBounds(input.options.length, input.bounds);
    assertNoDuplicateOptions(input.options);
    assertFullDayAlone(input.options, input.durationSlots ?? 1);
    return tx.sessionPoll.create({
      data: {
        partieId,
        createdById: userId,
        scenarioRef: input.scenarioRef ?? null,
        // Story 45.4 — sans échéance donnée, la MÊME fonction que le composer (plus de délai fixe de 14 jours).
        expiresAt: input.expiresAt ?? defaultDeadline(input.options),
        options: { create: input.options.map((o) => ({ date: o.date, slot: o.slot })) },
      },
      include: POLL_INCLUDE,
    });
  }

  /**
   * Story 47.4 — l'UNIQUE écriture des créneaux et de l'échéance d'un sondage OUVERT, dans la transaction
   * de l'appelant, qui a déjà posé les verrous (partie puis événement) et la durée du rendez-vous
   * (`RendezVousDurationPort.setDurationInTx`, ou `EventsService.updateHosted` pour une conjonction).
   * Partagée par le JDR (`setOptions`, `PUT …/options`) et le groupe (modification d'une conjonction).
   *
   * - `purge` faux (durée inchangée) : RÉCONCILIATION sur la clé `date|slot` (Story 36.10) — un créneau
   *   conservé garde son identifiant et ses réponses, seuls les retirés perdent les leurs.
   * - `purge` vrai (la durée vient de changer, seule source : le retour de `setDurationInTx`) : toutes
   *   les options sont supprimées (leurs réponses partent en cascade) puis recréées, et la relance de la
   *   veille est ré-armée — chaque option propose désormais une autre plage.
   *
   * Échéance : `expiresAt` absent = gardée ; « changée » se compare par JOUR (les deux appelants passent
   * une fin de jour, et une fin écrite avant la 45.4 n'est pas « changée » par un client qui renvoie son
   * jour) ; une NOUVELLE échéance déjà passée est refusée (400), une échéance inchangée toujours acceptée.
   * Une échéance changée ré-arme aussi la relance. Refuse un sondage introuvable (404) ou fermé (400), un
   * nombre de créneaux hors `bounds` et des doublons. Aucun droit décidé ici. N'émet rien.
   */
  async setOptionsInTx(
    tx: Prisma.TransactionClient,
    pollId: string,
    input: { options: PollOptionInput[]; expiresAt?: Date; bounds: PollOptionBounds },
    { purge }: { purge: boolean },
  ): Promise<void> {
    const poll = await tx.sessionPoll.findUnique({
      where: { id: pollId },
      select: {
        status: true,
        expiresAt: true,
        options: { select: { id: true, date: true, slot: true } },
      },
    });
    if (!poll) throw new NotFoundException('Poll introuvable');
    if (poll.status !== 'OPEN') throw new BadRequestException('Le poll est déjà fermé');
    assertOptionBounds(input.options.length, input.bounds);

    // Le plan refuse aussi les doublons du jeu voulu — même en cas de purge.
    const plan = planOptions(poll.options, input.options);
    const newDeadline = input.expiresAt;
    const deadlineChanged =
      newDeadline !== undefined &&
      (!poll.expiresAt || dayKeyUtc(poll.expiresAt) !== dayKeyUtc(newDeadline));
    if (deadlineChanged && dayKeyUtc(newDeadline) < dayKeyUtc(new Date())) {
      throw new BadRequestException(POLL_DEADLINE_PAST_MESSAGE);
    }

    if (purge) {
      // La cascade `onDelete: Cascade` de PollVote → PollOption emporte TOUTES les réponses : l'écran les
      // a annoncées avant la validation (« Changer la durée efface les {n} réponses déjà données. »).
      await tx.pollOption.deleteMany({ where: { pollId } });
      await tx.pollOption.createMany({
        data: input.options.map((o) => ({ pollId, date: o.date, slot: o.slot })),
      });
    } else {
      if (plan.toDeleteIds.length > 0) {
        // La cascade `onDelete: Cascade` de PollVote → PollOption emporte les réponses de ces
        // options, et d'elles seules.
        await tx.pollOption.deleteMany({ where: { id: { in: plan.toDeleteIds } } });
      }
      if (plan.toCreate.length > 0) {
        await tx.pollOption.createMany({
          data: plan.toCreate.map((o) => ({ pollId, date: o.date, slot: o.slot })),
        });
      }
    }
    if (deadlineChanged || purge) {
      // Story 40.7 : une nouvelle échéance — ou de nouvelles plages — ré-arme la relance de la veille.
      await tx.sessionPoll.update({
        where: { id: pollId },
        data: { ...(deadlineChanged ? { expiresAt: newDeadline } : {}), relanceSentAt: null },
      });
    }
  }

  /**
   * Story 42.1 — ferme, dans la transaction de l'appelant, le sondage d'une conjonction annulée.
   * Idempotent : un sondage déjà fermé (date fixée) reste tel quel. Aucun droit décidé ici (l'appelant a
   * obtenu `EVENT_CANCEL`). N'émet rien : l'appelant émet après son commit.
   */
  async closeInTx(tx: Prisma.TransactionClient, pollId: string): Promise<void> {
    await tx.sessionPoll.updateMany({
      where: { id: pollId, status: 'OPEN' },
      data: { status: 'CLOSED' },
    });
  }

  async findOpen(partieId: string, userId: string): Promise<SessionPollDto | null> {
    const { role } = await this.permissions.assert(userId, 'POLL_READ', { partieId });
    // Anti-spoil serveur : un joueur ne voit pas le vote de la séance d'un brouillon caché ; le MJ
    // voit tout.
    const poll = await this.prisma.sessionPoll.findFirst({
      where: isSpoilRestricted(role)
        ? { AND: [{ partieId, status: 'OPEN' }, VISIBLE_POLL_WHERE] }
        : { partieId, status: 'OPEN' },
      include: POLL_INCLUDE,
    });
    if (!poll) return null;
    const durations = await this.duration.durationsOf([poll.id]);
    return toDto(poll, await countParticipants(this.prisma, partieId), durations.get(poll.id) ?? 1);
  }

  async castVote(
    partieId: string,
    pollId: string,
    userId: string,
    dto: CastVoteDto,
  ): Promise<void> {
    const { role, partie } = await this.permissions.assert(userId, 'POLL_VOTE', { partieId });
    const poll = await this.prisma.sessionPoll.findUnique({
      where: { id: pollId },
    });
    if (
      !poll ||
      poll.partieId !== partieId ||
      poll.status !== 'OPEN' ||
      (await this.isHiddenFromPlayer(role, pollId))
    ) {
      throw new BadRequestException('Poll introuvable ou fermé');
    }
    await this.assertGroupVoteAllowed(poll, partie, userId);
    const option = await this.prisma.pollOption.findUnique({
      where: { id: dto.optionId },
    });
    if (!option || option.pollId !== pollId) {
      throw new BadRequestException('Option introuvable dans ce poll');
    }
    const write = (db: Prisma.TransactionClient) =>
      db.pollVote.upsert({
        where: { optionId_userId: { optionId: dto.optionId, userId } },
        update: { answer: dto.answer },
        create: {
          pollId,
          optionId: dto.optionId,
          userId,
          answer: dto.answer,
        },
      });
    if (familyOf(partie.gameSystemId) === 'ralliement') {
      // Story 40.6 : l'écriture d'un vote de groupe se fait sous le verrou de la conjonction, avec relecture
      // de l'état du sondage — un vote et la fixation de la date simultanés sont sérialisés.
      await this.prisma.$transaction(async (tx) => {
        await this.assertGroupPollStillOpen(tx, poll);
        await write(tx);
      });
    } else {
      await write(this.prisma);
    }
    this.realtimeEvents.emit(partieTopic(partieId));
    // VOTE_EN_COURS_SANS_REPONSE (Story 29.7, AD-14) : en plus de partieTopic ci-dessus, jamais en
    // remplacement.
    await this.partieSignals.notifyChanged(partieId);
  }

  /** Story 40.5 : un vote (ou son retrait) sur le sondage d'un GROUPE de ralliement passe en plus par
   *  les règles de la conjonction — votant éligible, échéance, date non fixée — décidées par `events/`
   *  derrière le port. Une partie de JDR n'y passe pas : ses règles de vote restent celles de la
   *  Story 37.1, sans lecture supplémentaire. */
  private async assertGroupVoteAllowed(
    poll: { id: string; partieId: string; expiresAt: Date | null },
    partie: { kind: PartieKind; gameSystemId: string },
    userId: string,
  ): Promise<void> {
    if (familyOf(partie.gameSystemId) !== 'ralliement') return;
    await this.groupVotes.assertCanVote(poll, partie, userId);
  }

  /** Story 40.6 : sous le verrou de la conjonction (partie puis événement), le sondage d'un groupe est
   *  toujours ouvert et sa date n'est pas fixée — sinon 400, rien n'est écrit. */
  private async assertGroupPollStillOpen(
    tx: Prisma.TransactionClient,
    poll: { id: string; partieId: string },
  ): Promise<void> {
    const { dated } = await this.groupVotes.lockConjonction(tx, poll);
    const fresh = await tx.sessionPoll.findUnique({
      where: { id: poll.id },
      select: { status: true },
    });
    if (dated || !fresh || fresh.status !== 'OPEN') {
      throw new BadRequestException('Poll introuvable ou fermé');
    }
  }

  /** Anti-spoil serveur : vrai si `pollId` est le vote de la séance d'un brouillon caché ET que
   *  l'appelant est un joueur — il reçoit alors la même erreur qu'un vote inconnu, sans écriture. */
  private async isHiddenFromPlayer(role: PartieRole, pollId: string): Promise<boolean> {
    if (!isSpoilRestricted(role)) return false;
    const hidden = await this.prisma.sessionPoll.count({
      where: { AND: [{ id: pollId }, HIDDEN_DRAFT_POLL_WHERE] },
    });
    return hidden > 0;
  }

  /** Retire la réponse de l'appelant sur une option (Story 30.1, AD-10) — supprime la ligne
   *  `PollVote`, jamais une réponse vide : « n'a pas répondu » est déjà représenté par l'absence
   *  de ligne. `userId` vient uniquement de `@CurrentUser()` (jamais de l'URL/du corps), donc le
   *  `where` du `deleteMany` ne peut jamais cibler que la réponse de l'appelant — l'isolation
   *  entre membres est structurelle, pas une vérification ajoutée. `deleteMany` (jamais `delete`
   *  avec la clé composite) rend le retrait idempotent : rejouer un retrait, ou retirer une
   *  réponse jamais posée, ne lève jamais (même garantie que `removeFavorite()`). */
  async withdrawVote(
    partieId: string,
    pollId: string,
    optionId: string,
    userId: string,
  ): Promise<void> {
    const { role, partie } = await this.permissions.assert(userId, 'POLL_VOTE', { partieId });
    const poll = await this.prisma.sessionPoll.findUnique({
      where: { id: pollId },
    });
    if (
      !poll ||
      poll.partieId !== partieId ||
      poll.status !== 'OPEN' ||
      (await this.isHiddenFromPlayer(role, pollId))
    ) {
      throw new BadRequestException('Poll introuvable ou fermé');
    }
    await this.assertGroupVoteAllowed(poll, partie, userId);
    const option = await this.prisma.pollOption.findUnique({
      where: { id: optionId },
    });
    if (!option || option.pollId !== pollId) {
      throw new BadRequestException('Option introuvable dans ce poll');
    }
    if (familyOf(partie.gameSystemId) === 'ralliement') {
      // Story 40.6 : même verrou que le vote — un retrait après la fixation de la date est refusé.
      await this.prisma.$transaction(async (tx) => {
        await this.assertGroupPollStillOpen(tx, poll);
        await tx.pollVote.deleteMany({ where: { optionId, userId } });
      });
    } else {
      await this.prisma.pollVote.deleteMany({
        where: { optionId, userId },
      });
    }
    this.realtimeEvents.emit(partieTopic(partieId));
    // VOTE_EN_COURS_SANS_REPONSE (Story 29.7, AD-14) : un retrait peut faire réapparaître ce
    // signal pour ce membre — même raisonnement que castVote(), en plus de partieTopic ci-dessus,
    // jamais en remplacement.
    await this.partieSignals.notifyChanged(partieId);
  }

  async choose(
    partieId: string,
    pollId: string,
    userId: string,
    dto: ChooseDateDto,
  ): Promise<void> {
    const { partie } = await this.permissions.assert(userId, 'POLL_CHOOSE', { partieId });
    // Story 40.6 : la famille de la partie décide — un groupe de ralliement fixe la date de sa conjonction
    // (hôte seul, sous le verrou de l'événement), le JDR garde son chemin inchangé (Story 37.1).
    if (familyOf(partie.gameSystemId) === 'ralliement') {
      await this.chooseGroupDate(partie, pollId, userId, dto);
      return;
    }
    // Story 47.5 (AD-11) : la fixation prend le verrou de la partie puis de l'événement (le même que
    // celui d'un changement de durée : `RendezVousDurationPort.setDurationInTx` sans durée = verrous
    // seulement), PUIS relit le vote (ouvert, de la partie) et l'option — une durée changée ou des
    // options recréées en même temps sont sérialisées, la date est écrite depuis l'option relue.
    //
    // Story 37.8 (AD-15) : le vote clos, la plage de la séance rattachée et la prochaine séance de
    // la partie sont écrits ensemble ou pas du tout. Ce service n'écrit QUE le vote : la date de
    // séance et `Partie.nextSessionDate/Slot` (recalculé comme la plus proche séance à venir, une
    // date passée n'est pas retenue) sont l'affaire du port, dans cette même transaction. Le même
    // port ré-arme le rappel de la veille de la séance (`Seance.reminderSentAt`, Story 37.9) et écrit
    // la plage entière (`fin = spanEnd(début, durée)`, Story 47.2).
    await this.prisma.$transaction(async (tx) => {
      // Le vote doit être celui de CETTE partie AVANT de prendre le moindre verrou : un MJ ne retient jamais les
      // lignes d'une autre partie en visant son vote.
      const owner = await tx.sessionPoll.findUnique({
        where: { id: pollId },
        select: { partieId: true },
      });
      if (!owner || owner.partieId !== partieId) throw new NotFoundException('Poll introuvable');
      await this.duration.setDurationInTx(tx, pollId);
      const poll = await tx.sessionPoll.findUnique({ where: { id: pollId } });
      if (!poll || poll.partieId !== partieId) throw new NotFoundException('Poll introuvable');
      if (poll.status !== 'OPEN') throw new BadRequestException('Le poll est déjà fermé');
      const option = await tx.pollOption.findUnique({ where: { id: dto.optionId } });
      if (!option || option.pollId !== pollId) throw new NotFoundException('Option introuvable');
      await tx.sessionPoll.update({
        where: { id: pollId },
        data: {
          status: 'CLOSED',
          chosenDate: option.date,
          chosenSlot: option.slot,
        },
      });
      await this.seanceDate.chooseDate(tx, pollId, option.date, option.slot);
    });
    this.realtimeEvents.emit(partieTopic(partieId));
    // AUCUNE_DATE_NI_VOTE/PROCHAINE_SEANCE_CONNUE (Story 29.7, AD-14) : en plus de partieTopic
    // ci-dessus, jamais en remplacement.
    await this.partieSignals.notifyChanged(partieId);
  }

  /**
   * Story 40.6 — l'hôte fixe la date d'une conjonction depuis son sondage (UX-DR12). Le droit « hôte »
   * est décidé par `events/` derrière le port, sur l'événement du sondage (403 pour tout autre membre,
   * administrateur compris). Puis UNE transaction : verrou de la partie puis
   * de l'événement, relecture du sondage (ouvert, de la partie, option de ce sondage), sondage clos avec
   * la date choisie, plage de la séance et prochaine séance écrites par `SeanceDatePort` — tout ou rien.
   * Une date déjà fixée ou un sondage déjà fermé est refusé (400) : la date ne se rouvre jamais. L'échéance
   * dépassée ne bloque pas l'hôte. Après le commit : `partie:{id}`, signaux de l'accueil, puis l'e-mail
   * aux inscrits (jamais bloquant).
   */
  private async chooseGroupDate(
    partie: { id: string; kind: PartieKind },
    pollId: string,
    userId: string,
    dto: ChooseDateDto,
  ): Promise<void> {
    const partieId = partie.id;
    // Le port refuse d'abord un sondage qui n'est pas celui d'une conjonction de cette partie (404), puis tout membre qui n'est pas l'hôte (403) — avant toute écriture.
    await this.groupChoice.assertCanChoose({ id: pollId, partieId }, partie, userId);
    await this.prisma.$transaction(async (tx) => {
      const { dated } = await this.groupVotes.lockConjonction(tx, { id: pollId, partieId });
      if (dated) throw new BadRequestException(DATE_ALREADY_FIXED_MESSAGE);
      const poll = await tx.sessionPoll.findUnique({ where: { id: pollId } });
      if (!poll || poll.partieId !== partieId) throw new NotFoundException('Poll introuvable');
      if (poll.status !== 'OPEN') throw new BadRequestException('Le poll est déjà fermé');
      const option = await tx.pollOption.findUnique({ where: { id: dto.optionId } });
      if (!option || option.pollId !== pollId) throw new NotFoundException('Option introuvable');
      // Un jour déjà passé (clé de jour UTC, comme les conjonctions 40.1 à 40.3) ne se scelle pas : la
      // conjonction serait passée d'emblée (ni rappel, ni modification possible). Aujourd'hui reste accepté.
      if (option.date.toISOString().substring(0, 10) < new Date().toISOString().substring(0, 10)) {
        throw new BadRequestException(PAST_OPTION_MESSAGE);
      }
      await tx.sessionPoll.update({
        where: { id: pollId },
        data: { status: 'CLOSED', chosenDate: option.date, chosenSlot: option.slot },
      });
      await this.seanceDate.chooseDate(tx, pollId, option.date, option.slot);
    });
    this.realtimeEvents.emit(partieTopic(partieId));
    await this.partieSignals.notifyChanged(partieId);
    await this.groupChoice.notifyDateFixed({ id: pollId, partieId });
  }

  /**
   * Story 40.7 — l'hôte prolonge le vote de sa conjonction (UX-DR12). Le droit « hôte » est décidé par
   * `events/` derrière le port, sur l'événement du sondage (403 pour tout autre membre, administrateur
   * compris) ; la route n'existe pas en JDR (cellule `POLL_EXTEND` fermée).
   * Puis UNE transaction sous le verrou de la conjonction (partie puis événement, comme la fixation de
   * la date) : le sondage doit être ouvert et la date non fixée, le nouveau jour strictement après le jour
   * d'échéance actuel et pas avant aujourd'hui (400 sinon, rien n'est écrit). L'échéance déjà dépassée
   * ne bloque pas : tant que le sondage est ouvert et sans date, la prolonger rouvre le vote (`expiresAt`
   * est sa seule porte). La nouvelle échéance est la fin du jour choisi (UTC), comme à la création, et la
   * relance de la veille est ré-armée (`relanceSentAt` remis à vide). Après le commit : `partie:{id}` puis
   * les signaux de l'accueil.
   */
  async extend(
    partieId: string,
    pollId: string,
    userId: string,
    dto: ExtendPollDto,
  ): Promise<void> {
    const { partie } = await this.permissions.assert(userId, 'POLL_EXTEND', { partieId });
    // Le port refuse d'abord un sondage qui n'est pas celui d'une conjonction de cette partie (400), puis tout membre qui n'est pas l'hôte (403) — avant toute écriture.
    await this.groupExtension.assertCanExtend({ id: pollId, partieId }, partie, userId);
    const newDay = dto.expiresAt;
    const newDeadline = endOfDayUtc(newDay);
    if (!newDeadline) throw new BadRequestException(EXTEND_INVALID_DAY_MESSAGE);
    if (newDay < dayKeyUtc(new Date())) throw new BadRequestException(POLL_DEADLINE_PAST_MESSAGE);
    await this.prisma.$transaction(async (tx) => {
      const { dated } = await this.groupVotes.lockConjonction(tx, { id: pollId, partieId });
      if (dated) throw new BadRequestException(DATE_ALREADY_FIXED_MESSAGE);
      const poll = await tx.sessionPoll.findUnique({
        where: { id: pollId },
        select: { partieId: true, status: true, expiresAt: true },
      });
      if (!poll || poll.partieId !== partieId) throw new NotFoundException('Poll introuvable');
      if (poll.status !== 'OPEN') throw new BadRequestException('Le poll est déjà fermé');
      if (poll.expiresAt && newDay <= dayKeyUtc(poll.expiresAt)) {
        throw new BadRequestException(EXTEND_NOT_LATER_MESSAGE);
      }
      await tx.sessionPoll.update({
        where: { id: pollId },
        data: { expiresAt: newDeadline, relanceSentAt: null },
      });
    });
    this.realtimeEvents.emit(partieTopic(partieId));
    // VOTE_EN_COURS_SANS_REPONSE (Story 29.7, AD-14) : un vote rouvert fait réapparaître ce signal pour
    // ceux qui n'avaient plus de raison de voter — en plus de partieTopic ci-dessus, jamais en remplacement.
    await this.partieSignals.notifyChanged(partieId);
  }

  /**
   * Story 36.10 (dérogation D-16) — remplace le jeu d'options d'un vote **OUVERT** par celui que
   * le MJ vient de composer sur la grille. MJ seul (`POLL_OPTIONS_SET`).
   *
   * 🚨 **RÉCONCILIATION, JAMAIS REMPLACEMENT.** `PollVote` est en cascade sur `PollOption`
   * (`schema.prisma:313`) : supprimer toutes les options pour les recréer détruirait les réponses
   * de TOUS les membres à chaque ajout d'une seule date. La comparaison se fait sur la clé métier
   * `date|slot` — la même que celle du dédoublonnage de `create()` — et **une option conservée
   * garde son `id` et ne subit aucune écriture**. Seules les options réellement retirées perdent
   * leurs réponses, ce que Q-22 autorise sous avertissement préalable côté client.
   *
   * Le jeu reçu est **déclaratif et complet** : ce qui n'y est pas est retiré.
   *
   * Story 47.4 : `durationSlots` (absent = inchangée) est écrit dans la MÊME transaction, d'abord, sous
   * les verrous de la partie puis de l'événement (`RendezVousDurationPort.setDurationInTx`) ; une durée
   * réellement changée recrée toutes les options (`purge`), une durée inchangée réconcilie comme avant.
   * Un créneau `FULL_DAY` est refusé dès que la durée effective dépasse 1 (rien n'est écrit).
   */
  async setOptions(
    partieId: string,
    pollId: string,
    userId: string,
    dto: SetPollOptionsDto,
  ): Promise<SessionPollDto> {
    await this.permissions.assert(userId, 'POLL_OPTIONS_SET', { partieId });

    const poll = await this.prisma.sessionPoll.findUnique({
      where: { id: pollId },
      select: { partieId: true, status: true },
    });
    // Le poll doit appartenir à la partie de l'URL : sans cette vérification, un MJ pourrait
    // muter le vote d'une AUTRE partie en forgeant un pollId (même garde que castVote/choose).
    if (!poll || poll.partieId !== partieId) throw new NotFoundException('Poll introuvable');
    if (poll.status !== 'OPEN') throw new BadRequestException('Le poll est déjà fermé');

    // Bornes redites ici, en plus du DTO : le service est appelable sans passer par le pipe de
    // validation (tests, orchestration cross-module), et c'est lui qui porte l'invariant.
    assertOptionBounds(dto.options.length, JDR_POLL_OPTION_BOUNDS);
    const options = dto.options.map((o) => ({ date: new Date(o.date), slot: o.slot }));

    // Story 45.4 — une NOUVELLE fin du vote (repousser la fin d'un vote de JDR EST sa prolongation) ; une fin
    // inchangée est toujours acceptée, même passée : on peut corriger les créneaux d'un vote terminé (la
    // comparaison, par jour, est celle de `setOptionsInTx`).
    const expiresAt =
      dto.expiresAt === undefined ? undefined : deadlineFromDay(dto.expiresAt, false);

    // Une seule transaction : la durée, un retrait et son ajout sont écrits ensemble ou pas du tout.
    const durationSlots = await this.prisma.$transaction(async (tx) => {
      const written = await this.duration.setDurationInTx(tx, pollId, dto.durationSlots);
      assertFullDayAlone(options, written.durationSlots);
      await this.setOptionsInTx(
        tx,
        pollId,
        { options, expiresAt, bounds: JDR_POLL_OPTION_BOUNDS },
        { purge: written.changed },
      );
      return written.durationSlots;
    });

    const updated = await this.prisma.sessionPoll.findUnique({
      where: { id: pollId },
      include: POLL_INCLUDE,
    });
    // Revue de code — même garde qu'à la lecture initiale : rien ne supprime un `SessionPoll`
    // aujourd'hui, donc ce cas est inatteignable en pratique, mais `toDto(null, ...)` planterait
    // en erreur non contrôlée plutôt qu'en 404 propre si ça changeait un jour.
    if (!updated) throw new NotFoundException('Poll introuvable');
    this.realtimeEvents.emit(partieTopic(partieId));
    // VOTE_EN_COURS_SANS_REPONSE (Story 29.7, AD-14) : ajouter une option fait RÉAPPARAÎTRE ce
    // signal chez les membres qui avaient tout répondu ; en retirer une peut le faire
    // disparaître. En plus de partieTopic ci-dessus, jamais en remplacement.
    await this.partieSignals.notifyChanged(partieId);
    return toDto(updated, await countParticipants(this.prisma, partieId), durationSlots);
  }

  async close(partieId: string, pollId: string, userId: string): Promise<void> {
    await this.permissions.assert(userId, 'POLL_CLOSE', { partieId });
    const poll = await this.prisma.sessionPoll.findUnique({
      where: { id: pollId },
    });
    if (!poll || poll.partieId !== partieId) throw new NotFoundException('Poll introuvable');
    if (poll.status !== 'OPEN') throw new BadRequestException('Le poll est déjà fermé');
    await this.prisma.sessionPoll.update({
      where: { id: pollId },
      data: { status: 'CLOSED' },
    });
    this.realtimeEvents.emit(partieTopic(partieId));
    // VOTE_EN_COURS_SANS_REPONSE/AUCUNE_DATE_NI_VOTE (Story 29.7, AD-14) : en plus de partieTopic
    // ci-dessus, jamais en remplacement.
    await this.partieSignals.notifyChanged(partieId);
  }
}

/** Clé de jour `YYYY-MM-DD` (UTC) d'un instant — la convention des conjonctions (40.1 à 40.7). */
function dayKeyUtc(date: Date): string {
  return date.toISOString().substring(0, 10);
}

/** La fin de vote proposée pour ces créneaux, aujourd'hui (UTC) : `defaultPollDeadline` donne le jour, ce jour-là
 *  se termine à sa dernière milliseconde (Story 45.4). */
function defaultDeadline(options: readonly { date: Date }[]): Date {
  const day = defaultPollDeadline(
    options.map((o) => ({ date: dayKeyUtc(o.date) })),
    dayKeyUtc(new Date()),
  );
  return endOfDayUtc(day) as Date;
}

/** Une fin de vote reçue (jour `YYYY-MM-DD`) : 400 si ce n'est pas un vrai jour ; avec `refusePast`, 400 aussi si
 *  ce jour est déjà passé (création). La comparaison « inchangée » d'une modification se fait chez l'appelant. */
function deadlineFromDay(day: string, refusePast = true): Date {
  const end = endOfDayUtc(day);
  if (!end) throw new BadRequestException(EXTEND_INVALID_DAY_MESSAGE);
  if (refusePast && day < dayKeyUtc(new Date())) {
    throw new BadRequestException(POLL_DEADLINE_PAST_MESSAGE);
  }
  return end;
}

/** Fin du jour `dayKey` (UTC, dernière milliseconde) — l'échéance d'un vote de groupe, comme à sa
 *  création (Story 40.5) — ou `null` si la clé ne désigne pas un vrai jour du calendrier. */
function endOfDayUtc(dayKey: string): Date | null {
  const [y, m, d] = dayKey.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(start.getTime()) || dayKeyUtc(start) !== dayKey) return null;
  return new Date(start.getTime() + 86_400_000 - 1);
}

/** Story 36.10 (revue de code) — clé métier d'une option : `date|slot`, normalisée. Point UNIQUE
 *  de la définition, partagé par le dédoublonnage de `create()` **et** la comparaison
 *  « existante » / « voulue » de `setOptions()`. Une option se reconnaît par ce qu'elle propose,
 *  jamais par sa position dans la liste — et deux dates représentant le même instant sous des
 *  formats différents (composante horaire, décalage) doivent produire la MÊME clé, sans quoi
 *  `create()` laisserait passer un doublon que `setOptions()` traiterait différemment. */
function optionKey(date: Date, slot: string): string {
  return `${date.toISOString()}|${slot}`;
}

/** Deux créneaux de même clé `date|slot` (normalisée par `optionKey()`) → 400. */
function assertNoDuplicateOptions(options: PollOptionInput[]): void {
  const seen = new Set<string>();
  for (const o of options) {
    const key = optionKey(o.date, o.slot);
    if (seen.has(key)) throw new BadRequestException('Options dupliquées (même date et créneau)');
    seen.add(key);
  }
}

/** Story 47.4 : une journée entière (`FULL_DAY`) n'existe qu'à 1 créneau — sinon 400, rien n'est écrit. */
export function assertFullDayAlone(
  options: readonly PollOptionInput[],
  durationSlots: number,
): void {
  if (durationSlots > 1 && options.some((o) => o.slot === 'FULL_DAY')) {
    throw new BadRequestException(POLL_FULL_DAY_SPAN_MESSAGE);
  }
}

/** Le nombre de créneaux d'un sondage respecte-t-il ses bornes ? Sans bornes, rien à vérifier. */
function assertOptionBounds(count: number, bounds: PollOptionBounds | undefined): void {
  if (!bounds) return;
  if (count < bounds.min || count > bounds.max) {
    throw new BadRequestException(
      bounds === JDR_POLL_OPTION_BOUNDS
        ? 'Un vote porte de 2 à 40 créneaux'
        : `Un vote porte au moins ${bounds.min} créneaux (et au plus ${bounds.max})`,
    );
  }
}

/** RÉCONCILIATION d'un jeu de créneaux (Story 36.10, partagée avec la Story 40.5) : compare le jeu
 *  EXISTANT au jeu VOULU sur la clé `date|slot` et ne produit que le delta — les identifiants des
 *  options retirées, les options à créer. Une option conservée ne figure nulle part : elle garde son
 *  `id` et ne subit aucune écriture. Refuse les doublons du jeu voulu. */
function planOptions(
  existingOptions: { id: string; date: Date; slot: string }[],
  wantedOptions: PollOptionInput[],
): { toDeleteIds: string[]; toCreate: PollOptionInput[] } {
  const wanted = new Map<string, PollOptionInput>();
  for (const o of wantedOptions) {
    const key = optionKey(o.date, o.slot);
    if (wanted.has(key)) throw new BadRequestException('Options dupliquées (même date et créneau)');
    wanted.set(key, o);
  }
  const existing = new Map<string, string>(); // clé métier → id d'option
  for (const opt of existingOptions) existing.set(optionKey(opt.date, opt.slot), opt.id);
  return {
    toDeleteIds: [...existing.entries()].filter(([key]) => !wanted.has(key)).map(([, id]) => id),
    toCreate: [...wanted.entries()].filter(([key]) => !existing.has(key)).map(([, o]) => o),
  };
}

/** Un vote tel qu'écrit et relu ici, avec ses options et leurs réponses. */
type PollWithOptions = Prisma.SessionPollGetPayload<{ include: typeof POLL_INCLUDE }>;

/** Story 36.6 — `membersCount` est passé en paramètre (jamais dérivé de `poll`) : c'est une
 *  propriété de la PARTIE, et le point unique qui la calcule est `countParticipants()`. Story 47.4 :
 *  `durationSlots` aussi — c'est une propriété de la séance, lue par `RendezVousDurationPort`. */
function toDto(poll: PollWithOptions, membersCount: number, durationSlots: number): SessionPollDto {
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
