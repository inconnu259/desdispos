import { IsString, Matches } from 'class-validator';
import type { ExtendPollDto as ExtendPollPayload } from '@master-jdr/shared';

/** Clé de jour `YYYY-MM-DD` (la validité calendaire et les bornes sont vérifiées par le service). */
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Prolongation du vote d'une conjonction (Story 40.7) : le nouveau jour d'échéance. */
export class ExtendPollDto implements ExtendPollPayload {
  @IsString({ message: 'La nouvelle échéance doit être au format AAAA-MM-JJ' })
  @Matches(DAY_KEY, { message: 'La nouvelle échéance doit être au format AAAA-MM-JJ' })
  expiresAt!: string;
}
