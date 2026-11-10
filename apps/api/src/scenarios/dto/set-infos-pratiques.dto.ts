import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MAX_SLOT_WINDOW_SLOTS } from '@master-jdr/shared';
import { DURATION_CAP_MESSAGE } from '../../events/seance-span';

/** `HH:MM` en 24 h, heures et minutes paddées. Volontairement strict : la valeur n'est
 *  jamais reparsée en aval, donc c'est ici — et seulement ici — qu'on garantit sa forme. */
const HEURE_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Au moins un caractère non blanc — un champ « vide en apparence » doit être `null`,
 *  jamais une chaîne d'espaces qui se rendrait invisible partout tout en restant non-null. */
const NON_BLANK = /\S/;

/**
 * Informations pratiques d'une Séance (Story 36.5, dérogation D-15 amendée le 2026-08-19).
 *
 * 🚨 `heureRdv` est une **étiquette**, pas un instant : une chaîne `"20:30"` que rien ne parse,
 * ne compare, ne trie ni ne calcule. Elle n'entre JAMAIS dans la chaîne de disponibilité, qui
 * raisonne en créneau de journée (`MORNING`/`AFTERNOON`/`EVENING`/`FULL_DAY`). Introduire un
 * `DateTime` ici créerait une seconde granularité temporelle que rien ne sait consommer —
 * c'est précisément ce que D-15 interdit (addendum §5.7, gardes n°1 à 4).
 *
 * Les bornes sont volontairement basses (80 / 200) et non les 5000 habituels d'un texte libre :
 * ces valeurs partent avec CHAQUE charge de calendrier, pour toutes les séances de la plage, et
 * se rendent tronquées sur une bande de 20 px (story 36.5, encadré n°5b).
 *
 * Les trois champs sont saisis ENSEMBLE, en un seul appel (`scenarios.service.ts:897`) : ils ne
 * sont donc PAS facultatifs — un champ absent du payload serait effacé en silence par le service,
 * qui ne distingue pas « absent » de « explicitement vidé ». `null` reste la façon de VIDER un
 * champ, d'où le `@ValidateIf` qui écarte les validateurs de forme sur cette valeur.
 */
export class SetInfosPratiquesDto {
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(HEURE_HH_MM, {
    message: "L'heure de rendez-vous doit être au format HH:MM (24 h)",
  })
  heureRdv!: string | null;

  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  @Matches(NON_BLANK, { message: 'Le lieu ne peut pas être une chaîne vide' })
  lieu!: string | null;

  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  @Matches(NON_BLANK, {
    message: 'La note pratique ne peut pas être une chaîne vide',
  })
  notePratique!: string | null;

  /** Story 47.1 : nouvelle durée du rendez-vous, en créneaux enchaînés ; absente = inchangée (contrairement
   *  aux trois champs ci-dessus, qui sont toujours envoyés ensemble). */
  @IsOptional()
  @IsInt({ message: 'La durée doit être un entier d’au moins 1 créneau' })
  @Min(1, { message: 'La durée doit être un entier d’au moins 1 créneau' })
  @Max(MAX_SLOT_WINDOW_SLOTS, { message: DURATION_CAP_MESSAGE })
  durationSlots?: number;
}
