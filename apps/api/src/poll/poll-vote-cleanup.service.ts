import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/**
 * Story 40.8 — retrait des réponses d'une personne qui quitte un groupe, dans la transaction de
 * l'appelant (`PartiesService.leave()`, déjà sous le verrou de la partie). Code du module `poll/`
 * (qui reste l'écrivain de `PollVote`), mais sans AUCUNE dépendance : `PollService` reçoit
 * `PartiesService` par `PARTIE_SIGNALS_PORT`, `PartiesService` ne peut donc pas l'injecter sans cycle.
 */
@Injectable()
export class PollVoteCleanupService {
  /**
   * Retire les réponses de `userId` sur les sondages `OPEN` de la partie ; les votes des sondages
   * fermés sont conservés. Aucun droit décidé ici (l'appelant a obtenu `PARTIE_LEAVE` /
   * `PARTIE_MEMBER_REMOVE`). N'émet rien : l'appelant émet après SON commit. Renvoie le nombre de
   * réponses retirées.
   */
  async removeOpenVotesInTx(
    tx: Prisma.TransactionClient,
    partieId: string,
    userId: string,
  ): Promise<number> {
    const { count } = await tx.pollVote.deleteMany({
      where: { userId, poll: { partieId, status: 'OPEN' } },
    });
    return count;
  }

  /**
   * Story 42.3 — ferme, dans la transaction de l'appelant (`PartiesService.leave()`), les sondages ouverts
   * des conjonctions que la personne qui sort organisait et qui viennent d'être annulées. Un sondage déjà
   * fermé (date fixée) reste tel quel. Aucun droit décidé ici ; n'émet rien : l'appelant émet après son
   * commit. Renvoie le nombre de sondages fermés.
   */
  async closePollsInTx(tx: Prisma.TransactionClient, pollIds: string[]): Promise<number> {
    if (pollIds.length === 0) return 0;
    const { count } = await tx.sessionPoll.updateMany({
      where: { id: { in: pollIds }, status: 'OPEN' },
      data: { status: 'CLOSED' },
    });
    return count;
  }

  /**
   * Story 46.3 — les créneaux déjà proposés par un sondage OUVERT de la partie, en clés `AAAA-MM-JJ|CRÉNEAU`
   * (UTC). `PartiesService.getAvailableSlots()` en retire, pour le MJ seul, les fenêtres de l'automate qui
   * coïncident (même départ ; la durée de chaque option est de 1 créneau, jusqu'à l'épic 47) : une fenêtre déjà
   * dans un vote n'a pas à être reproposée. Lecture seule, aucun droit décidé ici (l'appelant a déjà fait
   * `PARTIE_AVAILABILITY_READ` et ne s'en sert que pour la vue nominative) ; `parties/` ne lit jamais les tables
   * du sondage lui-même.
   */
  async openOptionKeys(
    db: Pick<Prisma.TransactionClient, 'pollOption'>,
    partieId: string,
  ): Promise<Set<string>> {
    const options = await db.pollOption.findMany({
      where: { poll: { partieId, status: 'OPEN' } },
      select: { date: true, slot: true },
    });
    return new Set(options.map((o) => `${o.date.toISOString().substring(0, 10)}|${o.slot}`));
  }
}
