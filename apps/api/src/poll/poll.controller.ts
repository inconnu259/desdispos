import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CastVoteDto } from './dto/cast-vote.dto';
import { ChooseDateDto } from './dto/choose-date.dto';
import { ExtendPollDto } from './dto/extend-poll.dto';
import { PollService } from './poll.service';
import { SetPollOptionsDto } from './dto/set-poll-options.dto';

@UseGuards(AuthenticatedGuard)
@Controller('parties/:id/poll')
export class PollController {
  constructor(private readonly poll: PollService) {}

  // Story 8.8 (Décision 2, revue de code) : la route générique de création de poll est retirée —
  // sans la fermeture auto de l'existant (Décision 2), un appel direct pouvait créer un nombre
  // illimité de SessionPoll orphelins, jamais liés à une Séance, invisibles et jamais nettoyés.
  // PollService.create() reste appelé en interne par ScenariosService.createSeancePoll() (Story
  // 8.7) — un vote de date exige désormais toujours un lien vers une Séance.

  @Get()
  findOpen(@Param('id', ParseUUIDPipe) partieId: string, @CurrentUser() user: AuthUser) {
    return this.poll.findOpen(partieId, user.id);
  }

  @Post(':pollId/vote')
  castVote(
    @Param('id', ParseUUIDPipe) partieId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CastVoteDto,
  ) {
    return this.poll.castVote(partieId, pollId, user.id, dto);
  }

  // Story 30.1 (AD-10) : route distincte de `DELETE :pollId` ci-dessous (close()) — celle-ci
  // supprime la ligne PollVote de l'appelant, celle-là ferme le poll sans rien supprimer. Ne
  // jamais fusionner ni réutiliser l'une pour l'autre (AC5).
  @Delete(':pollId/vote/:optionId')
  withdrawVote(
    @Param('id', ParseUUIDPipe) partieId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @Param('optionId', ParseUUIDPipe) optionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.poll.withdrawVote(partieId, pollId, optionId, user.id);
  }

  @Patch(':pollId/choose')
  choose(
    @Param('id', ParseUUIDPipe) partieId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ChooseDateDto,
  ) {
    // Story 37.8 (AD-15) : le service clôt le vote, pose la date de la séance ET recalcule
    // `Partie.nextSessionDate/Slot` dans une seule transaction (via `SeanceDatePort`) — plus
    // d'appel best-effort vers `scenarios/` après coup.
    return this.poll.choose(partieId, pollId, user.id, dto);
  }

  /**
   * Story 40.7 — l'hôte d'une conjonction prolonge son vote (nouvelle échéance `YYYY-MM-DD`). Route
   * propre au groupe de ralliement : la cellule `POLL_EXTEND` est fermée en JDR. Distincte de
   * `:pollId/choose` (qui scelle la date) : prolonger ne ferme jamais le sondage.
   */
  @Patch(':pollId/extend')
  extend(
    @Param('id', ParseUUIDPipe) partieId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ExtendPollDto,
  ) {
    return this.poll.extend(partieId, pollId, user.id, dto);
  }

  /**
   * Story 36.10 (D-16) — mutation des options d'un vote OUVERT, composées sur la grille.
   *
   * **PUT et non PATCH** : le corps décrit l'ÉTAT COMPLET du jeu d'options voulu, pas une
   * modification partielle. Route distincte de `:pollId/choose` (qui scelle) et de `DELETE
   * :pollId` (qui clôt) — ne jamais en réutiliser une pour l'autre, même raisonnement qu'AD-10.
   *
   * 🚨 La création d'un vote ne passe PAS par ici et n'a toujours aucune route générique : elle
   * reste `POST /scenarios/seances/:id/poll`, seul chemin qui garantit `Seance.pollId`.
   */
  @Put(':pollId/options')
  setOptions(
    @Param('id', ParseUUIDPipe) partieId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetPollOptionsDto,
  ) {
    return this.poll.setOptions(partieId, pollId, user.id, dto);
  }

  @Delete(':pollId')
  close(
    @Param('id', ParseUUIDPipe) partieId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.poll.close(partieId, pollId, user.id);
  }
}
