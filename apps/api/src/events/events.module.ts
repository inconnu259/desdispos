import { Module } from '@nestjs/common';
import { BoardGamesModule } from '../board-games/board-games.module';
import { EmailModule } from '../email/email.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { InvitationCleanupService } from '../invitations/invitation-cleanup.service';
import { PollModule } from '../poll/poll.module';
import { DatableSeancesService } from './datable-seances.service';
import { EventBoardGamesService } from './event-board-games.service';
import { EventHostCountsService } from './event-host-counts.service';
import { EventGameBringService } from './event-game-bring.service';
import { EventGameEnvyService } from './event-game-envy.service';
import { EventGameExclusionService } from './event-game-exclusion.service';
import { EventCancellationMailer } from './event-cancellation-mailer.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { GroupEventsService } from './group-events.service';
import { MyDatableSeancesController } from './me-datable-seances.controller';
import { GroupPollChoiceService } from './group-poll-choice.service';
import { GroupPollExtensionService } from './group-poll-extension.service';
import { OpenPollContextService } from './open-poll-context.service';

/**
 * Événement de base, séances et inscriptions (Story 37.3, couche 2 « rassemblement »).
 * N'importe aucun module métier — seuls `PrismaService` et `RealtimeEventsService` (globaux) sont
 * injectés — pour que `PartiesModule` (couche 2) comme `ScenariosModule` (couche 3) puissent
 * l'importer sans cycle.
 *
 * Story 40.1 : les conjonctions d'un groupe (`EventsController` → `GroupEventsService`) ajoutent
 * `PermissionsModule` (transverse, sans module métier) et le port des signaux de partie
 * (`PARTIE_SIGNALS_PORT`, fourni par le `PortsModule` global) — jamais `PartiesModule`/
 * `PartiesService`, qui importe ce module.
 *
 * Story 40.4 : `EmailModule` (transverse) envoie l'e-mail « une place vous est réservée » après le commit.
 *
 * Story 40.5 : `PollModule` (couche 1) — `GroupEventsService` fait écrire le sondage d'une conjonction par
 * `PollService`, dans la transaction de l'événement. `PollModule` n'importe jamais `events/` (ports).
 *
 * Story 40.6 : `GroupPollChoiceService` (fixer la date d'une conjonction) est exporté pour `PortsModule`,
 * qui le lie à `GroupPollChoosePort` — il dépend de `PermissionsModule` et `EmailModule`, jamais de `poll/`.
 *
 * Story 40.7 : `GroupPollExtensionService` (prolonger le vote) est exporté pour `PortsModule`, qui le lie à
 * `GroupPollExtendPort` — il ne dépend que de `PermissionsModule`, jamais de `poll/`.
 *
 * Story 42.2 : `InvitationCleanupService` (code d'`invitations/`, sans dépendance) révoque les invitations d'une
 * soirée isolée annulée — fourni ICI car `InvitationsModule` importe ce module (l'inverse ferait un cycle).
 *
 * Story 42.3 : `EventCancellationMailer` (e-mail n° 7) est exporté — `PartiesService.leave()` l'appelle après le
 * commit du départ d'un hôte, sans passer par `GroupEventsService` (cycle de fournisseurs).
 *
 * Story 49.1 : `BoardGamesModule` (couche 2, seul lecteur/écrivain de `BoardGame`) — `EventBoardGamesService` lit
 * les jeux de l'hôte d'une soirée par `BoardGamesService.listOfOwner`. La dépendance va de `events/` vers
 * `board-games/`, jamais l'inverse (`BoardGamesModule` n'importe que `PermissionsModule`).
 *
 * Story 49.2 : `EventGameBringService` écrit `EventGameBring` (les jeux qu'un participant apporte) ; il lit la
 * propriété d'un jeu par `BoardGamesService`, jamais `prisma.boardGame`.
 *
 * Story 49.4 : `EventGameExclusionService` écrit `EventGameExcluded` (les jeux de l'hôte écartés pour une soirée) ; même
 * lecture de la propriété d'un jeu par `BoardGamesService`.
 *
 * Story 49.5 : `EventGameEnvyService` écrit `EventGameEnvy` (les Envies, par nom de jeu) ; `EventsService` reçoit
 * `BoardGamesService` pour lire les noms sur place (purge des Envies orphelines) — toujours `events/ → board-games/`.
 *
 * Story 40.3 : `GroupEventsService` est exporté — les routes d'inscription partagées avec le JDR
 * (`scenarios/seances/:id/inscription`) y délèguent la branche « groupe ».
 */
@Module({
  imports: [PermissionsModule, EmailModule, PollModule, BoardGamesModule],
  controllers: [EventsController, MyDatableSeancesController],
  providers: [
    EventsService,
    EventCancellationMailer,
    InvitationCleanupService,
    GroupEventsService,
    EventBoardGamesService,
    EventHostCountsService,
    EventGameBringService,
    EventGameExclusionService,
    EventGameEnvyService,
    GroupPollChoiceService,
    GroupPollExtensionService,
    OpenPollContextService,
    DatableSeancesService,
  ],
  exports: [
    EventsService,
    EventCancellationMailer,
    GroupEventsService,
    GroupPollChoiceService,
    GroupPollExtensionService,
    OpenPollContextService,
  ],
})
export class EventsModule {}
