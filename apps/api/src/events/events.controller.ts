import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateEventDto, UpdateEventDto } from './dto/create-event.dto';
import { EventEnvyBodyDto } from './dto/event-envy.dto';
import { EventBoardGamesService } from './event-board-games.service';
import { EventHostCountsService } from './event-host-counts.service';
import { EventGameBringService } from './event-game-bring.service';
import { EventGameEnvyService } from './event-game-envy.service';
import { EventGameExclusionService } from './event-game-exclusion.service';
import { GroupEventsService } from './group-events.service';

/**
 * Événements d'un groupe de ralliement — les conjonctions (Stories 40.1 et 40.2).
 *
 * 🚨 La liste vit sur `GET /parties/:id/events/list` et non sur `GET /parties/:id/events` : ce
 * chemin appartient déjà au flux temps réel (SSE, `RealtimeController`), qu'il ne faut pas toucher.
 */
@UseGuards(AuthenticatedGuard)
@Controller()
export class EventsController {
  constructor(
    private readonly groupEvents: GroupEventsService,
    private readonly eventBoardGames: EventBoardGamesService,
    private readonly hostCounts: EventHostCountsService,
    private readonly gameBrings: EventGameBringService,
    private readonly gameExclusions: EventGameExclusionService,
    private readonly gameEnvies: EventGameEnvyService,
  ) {}

  @Post('parties/:id/events')
  create(
    @Param('id', ParseUUIDPipe) partieId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateEventDto,
  ) {
    return this.groupEvents.create(partieId, user.id, dto);
  }

  @Get('parties/:id/events/list')
  list(@Param('id', ParseUUIDPipe) partieId: string, @CurrentUser() user: AuthUser) {
    return this.groupEvents.list(partieId, user.id);
  }

  /** Story 40.2 : l'hôte modifie sa conjonction (remplacement complet). */
  @Patch('parties/:id/events/:eventId')
  update(
    @Param('id', ParseUUIDPipe) partieId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateEventDto,
  ) {
    return this.groupEvents.update(partieId, eventId, user.id, dto);
  }

  /** Story 42.1 : l'hôte ou un administrateur annule la conjonction (définitif). */
  @Post('parties/:id/events/:eventId/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) partieId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.groupEvents.cancel(partieId, eventId, user.id);
  }

  /** Story 50.2 : le Compteur d'hôte d'un groupe (qui a reçu, combien de fois), lecture seule — `PARTIE_READ`. */
  @Get('parties/:id/host-counts')
  hostCountsOf(@Param('id', ParseUUIDPipe) partieId: string, @CurrentUser() user: AuthUser) {
    return this.hostCounts.list(partieId, user.id);
  }

  /** Story 49.1 : les jeux sur place d'une soirée à venir (jeux de l'hôte + N), lecture seule — `PARTIE_READ`. */
  @Get('events/:eventId/board-games')
  boardGames(@Param('eventId', ParseUUIDPipe) eventId: string, @CurrentUser() user: AuthUser) {
    return this.eventBoardGames.list(eventId, user.id);
  }

  /** Story 49.2 : j'apporte l'un de mes jeux à cette soirée — `EVENT_GAME_BRING`, idempotent (204). */
  @Put('events/:eventId/board-games/:boardGameId/bring')
  @HttpCode(204)
  async bring(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('boardGameId', ParseUUIDPipe) boardGameId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.gameBrings.bring(eventId, boardGameId, user.id);
  }

  /** Story 49.2 : je n'apporte plus ce jeu — idempotent (204). */
  @Delete('events/:eventId/board-games/:boardGameId/bring')
  @HttpCode(204)
  async unbring(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('boardGameId', ParseUUIDPipe) boardGameId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.gameBrings.unbring(eventId, boardGameId, user.id);
  }

  /** Story 49.4 : l'hôte écarte l'un de ses jeux pour cette soirée — `EVENT_GAME_EXCLUDE`, idempotent (204). */
  @Put('events/:eventId/board-games/:boardGameId/exclusion')
  @HttpCode(204)
  async exclude(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('boardGameId', ParseUUIDPipe) boardGameId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.gameExclusions.exclude(eventId, boardGameId, user.id);
  }

  /** Story 49.4 : l'hôte remet ce jeu pour cette soirée — idempotent (204). */
  @Delete('events/:eventId/board-games/:boardGameId/exclusion')
  @HttpCode(204)
  async restore(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('boardGameId', ParseUUIDPipe) boardGameId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.gameExclusions.restore(eventId, boardGameId, user.id);
  }

  /** Story 49.5 : j'ai envie de jouer à ce jeu (par nom) ce soir — `EVENT_GAME_ENVY`, idempotent (204). */
  @Put('events/:eventId/envies')
  @HttpCode(204)
  async envy(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: EventEnvyBodyDto,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.gameEnvies.envy(eventId, dto.nameKey, user.id);
  }

  /** Story 49.5 : je n'ai plus envie de ce jeu — idempotent (204). */
  @Delete('events/:eventId/envies')
  @HttpCode(204)
  async unenvy(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: EventEnvyBodyDto,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.gameEnvies.unenvy(eventId, dto.nameKey, user.id);
  }

  /** Story 49.2 : combien de soirées à venir attendent l'un de mes jeux — lu avant de le retirer de ma Ludothèque. */
  @Get('me/board-games/:boardGameId/brought-count')
  broughtCount(
    @Param('boardGameId', ParseUUIDPipe) boardGameId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.gameBrings.broughtCount(user.id, boardGameId);
  }
}
