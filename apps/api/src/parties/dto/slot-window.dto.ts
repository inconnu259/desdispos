import { MAX_SLOT_WINDOW_SLOTS, type DaySlot } from '@master-jdr/shared';
import { IsDateString, IsIn, IsInt, Matches, Max, Min } from 'class-validator';

const DAY_SLOTS: DaySlot[] = ['MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY'];

/**
 * Story 46.4 — corps de `PUT` / `DELETE /parties/:id/available-slots/hidden` : la fenêtre de l'automate telle que
 * `GET available-slots` l'a servie (sa clé naturelle : jour, créneau de départ, durée en créneaux). Recopiée de la
 * réponse par le client, jamais d'un paramètre de page. « Pas dans le passé » se juge dans le service (la date du
 * jour n'est pas une constante de validation).
 */
export class SlotWindowKeyBody {
  @IsDateString({ strict: true }, { message: 'La date de la fenêtre est invalide' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La date de la fenêtre doit être au format AAAA-MM-JJ',
  })
  date!: string;

  @IsIn(DAY_SLOTS, { message: 'Le créneau de départ de la fenêtre est invalide' })
  startSlot!: DaySlot;

  @IsInt({ message: 'La durée de la fenêtre doit être un nombre entier de créneaux' })
  @Min(1, { message: 'La durée de la fenêtre est d’au moins un créneau' })
  @Max(MAX_SLOT_WINDOW_SLOTS, {
    message: `La durée de la fenêtre ne peut pas dépasser ${MAX_SLOT_WINDOW_SLOTS} créneaux`,
  })
  durationSlots!: number;
}
