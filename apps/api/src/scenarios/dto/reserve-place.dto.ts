import { IsUUID } from 'class-validator';
import type { ReservePlaceDto as ReservePlacePayload } from '@master-jdr/shared';

/** Réservation d'une place à un membre (Story 40.4, `POST scenarios/seances/:id/reservations`). Les
 *  règles (hôte seul, places limitées, membre du groupe, capacité) sont vérifiées par le service. */
export class ReservePlaceDto implements ReservePlacePayload {
  @IsUUID(undefined, { message: 'Le membre doit être désigné par son identifiant' })
  userId!: string;
}
