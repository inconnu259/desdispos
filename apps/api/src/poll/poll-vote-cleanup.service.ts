import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  RENDEZ_VOUS_DURATION_PORT,
  type RendezVousDurationPort,
} from './ports/rendez-vous-duration.port';

/**
 * Story 40.8 — retrait des réponses d'une personne qui quitte un groupe, dans la transaction de
 * l'appelant (`PartiesService.leave()`, déjà sous le verrou de la partie). Code du module `poll/`
 * (qui reste l'écrivain de `PollVote`), mais sans dépendance vers `parties/` : `PollService` reçoit
 * `PartiesService` par `PARTIE_SIGNALS_PORT`, `PartiesService` ne peut donc pas l'injecter sans cycle.
 * Seule dépendance : `RendezVousDurationPort` (Story 47.6), un port de la couche 1.
 */
@Injectable()
export class PollVoteCleanupService {
  constructor(
    @Inject(RENDEZ_VOUS_DURATION_PORT) private readonly duration: RendezVousDurationPort,
  ) {}

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
   * Story 46.3 / 47.6 — les plages déjà proposées par un sondage OUVERT de la partie, en clés
   * `AAAA-MM-JJ|CRÉNEAU|DURÉE` (UTC) : le départ de l'option et la durée du rendez-vous qui porte le vote (1 pour un
   * vote sans séance, via `RendezVousDurationPort.durationsOf`, une seule lecture).
   * `PartiesService.getAvailableSlots()` en retire, pour le MJ seul, les fenêtres qui coïncident (même départ ET même
   * durée) : une fenêtre déjà dans un vote n'a pas à être reproposée. Lecture seule, aucun droit décidé ici
   * (l'appelant a déjà fait `PARTIE_AVAILABILITY_READ` et ne s'en sert que pour la vue nominative) ; `parties/` ne lit
   * jamais les tables du sondage lui-même. Les options (`db`) et les durées (le port, sur son propre client) sont
   * deux lectures distinctes, hors de toute transaction commune : un vote créé ou recréé entre les deux vaut 1 et
   * n'exclut, au pire, pas une fenêtre — sans effet d'écriture.
   */
  async openOptionKeys(
    db: Pick<Prisma.TransactionClient, 'pollOption'>,
    partieId: string,
  ): Promise<Set<string>> {
    const options = await db.pollOption.findMany({
      where: { poll: { partieId, status: 'OPEN' } },
      select: { date: true, slot: true, pollId: true },
    });
    if (options.length === 0) return new Set();
    const durations = await this.duration.durationsOf([...new Set(options.map((o) => o.pollId))]);
    return new Set(
      options.map(
        (o) =>
          `${o.date.toISOString().substring(0, 10)}|${o.slot}|${durations.get(o.pollId) ?? 1}`,
      ),
    );
  }
}
