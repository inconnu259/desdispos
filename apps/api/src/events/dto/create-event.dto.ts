import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type {
  CreateEventDto as CreateEventPayload,
  EventPollOptionInput,
  EventSlot,
  UpdateEventDto as UpdateEventPayload,
} from '@master-jdr/shared';
// Import RUNTIME : le plafond est une valeur (un `import type` l'effacerait).
import { MAX_SLOT_WINDOW_SLOTS } from '@master-jdr/shared';
import { DURATION_CAP_MESSAGE } from '../seance-span';

/** `HH:MM` en 24 h, heures et minutes paddées — même règle que les informations pratiques d'une
 *  séance (Story 36.5) : la valeur n'est jamais reparsée en aval, c'est ici qu'on garantit sa forme. */
const HEURE_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Au moins un caractère non blanc. */
const NON_BLANK = /\S/;

/** Clé de jour `YYYY-MM-DD` (la validité calendaire et le refus d'un jour passé sont vérifiés par
 *  le service). */
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Mode « date fixée » (aucun champ de sondage fourni) : jour et créneau sont alors obligatoires et
 *  validés. Dès qu'un champ de sondage est fourni, le service tranche (il refuse tout mélange des deux
 *  modes, en français). */
function isFixedDateMode(o: { pollOptions?: unknown; pollDeadline?: unknown }): boolean {
  return o.pollOptions == null && o.pollDeadline == null;
}

/** Garde technique du nombre de créneaux d'un sondage de groupe (Story 40.5) — aucun plafond métier. */
export const POLL_OPTIONS_TECHNICAL_MAX = 200;

/** Créneaux admis pour une conjonction : jamais `FULL_DAY`, jamais vide (Story 40.1). */
export const EVENT_SLOTS: readonly EventSlot[] = ['MORNING', 'AFTERNOON', 'EVENING'];

/** Un créneau candidat du sondage de dates (Story 40.5) : un jour et un créneau précis (jamais
 *  `FULL_DAY`). La validité calendaire du jour est vérifiée par le service. */
export class EventPollOptionDto implements EventPollOptionInput {
  @IsString({ message: 'La date d’un créneau doit être au format AAAA-MM-JJ' })
  @Matches(DAY_KEY, { message: 'La date d’un créneau doit être au format AAAA-MM-JJ' })
  date!: string;

  @IsIn(EVENT_SLOTS, { message: 'Le créneau doit être le matin, l’après-midi ou le soir' })
  slot!: EventSlot;
}

/**
 * Création d'une conjonction (Story 40.1, `POST /parties/:id/events`), à date fixée (`date` +
 * `slot`) ou, depuis la Story 40.5, par sondage de dates (`pollOptions` + `pollDeadline`). Les deux
 * modes sont exclusifs : le service refuse (400, en français) l'absence des deux comme leur mélange.
 *
 * 🚨 `heureRdv` est une **étiquette** `"HH:MM"`, jamais un instant : rien ne la parse, ne la compare
 * ni ne la trie (addendum §5.7). Bornes des informations pratiques reprises de la Story 36.5 (lieu
 * ≤ 80, note ≤ 200). `capacity` absente ou `null` = « Tous les membres » ; sinon un entier ≥ 2 (l'hôte
 * occupe une place), sans plafond.
 */
export class CreateEventDto implements CreateEventPayload {
  @IsString({ message: 'Le nom doit être un texte' })
  @MaxLength(120, { message: 'Le nom ne peut pas dépasser 120 caractères' })
  @Matches(NON_BLANK, { message: 'Le nom ne peut pas être vide' })
  title!: string;

  @ValidateIf(isFixedDateMode)
  @IsString({ message: 'La date doit être au format AAAA-MM-JJ' })
  @Matches(DAY_KEY, { message: 'La date doit être au format AAAA-MM-JJ' })
  date?: string;

  @ValidateIf(isFixedDateMode)
  @IsIn(EVENT_SLOTS, { message: 'Le créneau doit être le matin, l’après-midi ou le soir' })
  slot?: EventSlot;

  /** Story 40.5 : créneaux candidats du sondage (au moins 2, distincts — vérifié par le service —, sans
   *  plafond métier : seule une garde technique borne la charge). */
  @IsOptional()
  @IsArray({ message: 'Les créneaux du sondage doivent être une liste' })
  @ArrayMaxSize(POLL_OPTIONS_TECHNICAL_MAX, { message: 'Trop de créneaux dans le sondage' })
  @ValidateNested({ each: true })
  @Type(() => EventPollOptionDto)
  pollOptions?: EventPollOptionDto[];

  /** Story 40.5 : fin du vote, clé `YYYY-MM-DD` (aujourd'hui accepté, jamais avant — vérifié par le
   *  service). */
  @IsOptional()
  @IsString({ message: 'L’échéance du vote doit être au format AAAA-MM-JJ' })
  @Matches(DAY_KEY, { message: 'L’échéance du vote doit être au format AAAA-MM-JJ' })
  pollDeadline?: string;

  @IsOptional()
  @IsString({ message: 'Le lieu doit être un texte' })
  @MaxLength(80, { message: 'Le lieu ne peut pas dépasser 80 caractères' })
  @Matches(NON_BLANK, { message: 'Le lieu ne peut pas être une chaîne vide' })
  lieu?: string | null;

  @IsOptional()
  @IsString({ message: "L'heure de rendez-vous doit être au format HH:MM (24 h)" })
  @Matches(HEURE_HH_MM, { message: "L'heure de rendez-vous doit être au format HH:MM (24 h)" })
  heureRdv?: string | null;

  @IsOptional()
  @IsString({ message: 'La note pratique doit être un texte' })
  @MaxLength(200, { message: 'La note pratique ne peut pas dépasser 200 caractères' })
  @Matches(NON_BLANK, { message: 'La note pratique ne peut pas être une chaîne vide' })
  notePratique?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt({ message: 'Le nombre de places doit être un entier' })
  @Min(2, { message: 'Des places limitées en comptent au moins 2, hôte compris' })
  capacity?: number | null;

  /** Story 47.1 : durée du rendez-vous, en créneaux enchaînés. Absente = 1 à la création, inchangée à la
   *  modification. */
  @IsOptional()
  @IsInt({ message: 'La durée doit être un entier d’au moins 1 créneau' })
  @Min(1, { message: 'La durée doit être un entier d’au moins 1 créneau' })
  @Max(MAX_SLOT_WINDOW_SLOTS, { message: DURATION_CAP_MESSAGE })
  durationSlots?: number;

  /** Story 40.4 : membres à qui une place est réservée d'emblée. Les règles métier (places limitées,
   *  jamais l'hôte, au plus `capacity − 1`, tous membres) sont vérifiées par le service. */
  @IsOptional()
  @IsArray({ message: 'Les places réservées doivent être une liste' })
  @ArrayMaxSize(100, { message: 'Trop de places réservées' })
  @ArrayUnique({ message: 'Une même personne ne peut pas recevoir deux places' })
  @IsUUID(undefined, { each: true, message: 'Un membre réservé est mal identifié' })
  reservedUserIds?: string[];
}

/**
 * Modification d'une conjonction (Story 40.2, `PATCH /parties/:id/events/:eventId`) : remplacement
 * complet, MÊMES champs et MÊMES règles que la création — l'hôte reste immuable (aucun champ ne le
 * désigne).
 */
export class UpdateEventDto extends CreateEventDto implements UpdateEventPayload {}
