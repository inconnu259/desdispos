import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, ValidateIf } from 'class-validator';
import {
  CALENDAR_LAYER_KEYS,
  CHARACTER_SORTS,
  LIST_VIEW_MODES,
  PARTIE_SORTS,
  type CalendarLayerKey,
  type CharacterSort,
  type ListViewMode,
  type PartieSort,
} from '@desdispos/shared';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(PARTIE_SORTS)
  partiesSort?: PartieSort;

  @IsOptional()
  @IsBoolean()
  hideFinishedParties?: boolean;

  /** Story 52.4 (FR-5, AD-5) : « Me rappeler de déclarer mes dispos ». `null` est refusé (400) : la colonne n'est pas
   *  nullable, et `@IsOptional()` laisserait passer `null` jusqu'à Prisma (500). */
  @ValidateIf((_o, value) => value !== undefined)
  @IsBoolean()
  availabilityReminder?: boolean;

  @IsOptional()
  @IsIn(LIST_VIEW_MODES)
  partiesViewMode?: ListViewMode;

  @IsOptional()
  @IsIn(LIST_VIEW_MODES)
  charactersViewMode?: ListViewMode;

  @IsOptional()
  @IsIn(CHARACTER_SORTS)
  charactersSort?: CharacterSort;

  /** Story 30.4 (AC1, AC9) : lot de couches actives, remplace l'ensemble existant. Un tableau
   *  vide est une valeur valide (AC3 — « tout éteint », distinct d'absent). Plafond de 6 (taille
   *  de l'union) ; les doublons ne sont pas rejetés ici, dédupliqués dans le service (AC9).
   *  Revue de code : `@ArrayMaxSize` s'applique au tableau BRUT, avant la déduplication —
   *  un lot artificiel de 7+ doublons de la même clé serait donc rejeté en 400 plutôt que
   *  dédupliqué. Choix assumé : l'écran Compte (seul appelant actuel) envoie toujours un
   *  ensemble déjà dédupliqué (cases à cocher), ce scénario n'est pas atteignable depuis l'UI. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CALENDAR_LAYER_KEYS.length)
  @IsIn(CALENDAR_LAYER_KEYS, { each: true })
  defaultCalendarLayers?: CalendarLayerKey[];
}
