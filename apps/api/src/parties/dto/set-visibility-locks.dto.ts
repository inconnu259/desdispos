import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';

// Autorise les identifiants de sous-clé (camelCase alphanumérique) — jamais une chaîne libre.
const FIELD_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;

/**
 * Périmètre resserré (décision utilisateur 2026-09-22, cf. Boundaries du spec 31.6) : SEULES ces
 * 10 clés — déjà déclarées `lockable: true` dans `sheetSchema` (`GameSystemService.getSchema`) —
 * sont verrouillables. `classChoices`/`classCapabilities`/`magicSeason`/`knownRitualSpells`/
 * `levelUps` restent hors périmètre : verrouiller `levelUps` en particulier retirerait
 * `sheetData.levelUps` et ferait silencieusement chuter `CharacterDto.level` à 1 sans jamais
 * l'annoncer dans `hiddenFields` (`level` n'est pas dérivé par `toDto()` de la même façon que
 * `derived`) — une régression que ce DTO doit bloquer à l'entrée, pas seulement documenter.
 *
 * Liste FIGÉE ici (pas importée de `GameSystemService.getSchema()`) : `PartiesModule` ne dépend
 * pas de `GameSystemModule` (qui dépend déjà de `PartiesModule` — un import inverse créerait un
 * cycle de modules). Si `sheetSchema` gagne une clé `lockable` supplémentaire, cette liste doit
 * être mise à jour à la main.
 */
const LOCKABLE_FIELD_KEYS = [
  'classId',
  'specialtyTypeId',
  'typeId',
  'attributes',
  'weaponId',
  'customWeapon',
  'fetiqueObject',
  'equipment',
  'startingEquipment',
  'narrative',
] as const;

/**
 * Sous-champs verrouillables par clé (revue de code du 2026-09-22, story 31.6) — miroir de
 * `lockableFields` dans `sheetSchema` (`GameSystemService.getSchema`), même raison de duplication
 * figée que `LOCKABLE_FIELD_KEYS` ci-dessus (cycle de modules `PartiesModule`↔`GameSystemModule`).
 * Une clé ABSENTE de cette table n'a AUCUN sous-champ verrouillable (verrouillable en bloc
 * seulement) : sans ce garde-fou, `{fieldKey:'narrative', subField:'name'}` était accepté et
 * retirait réellement le NOM du personnage, alors que le schéma ne déclare aucun sous-champ
 * verrouillable pour `narrative` — même défaut que celui déjà corrigé pour `fieldKey` (`levelUps`),
 * jamais étendu à `subField`.
 */
const LOCKABLE_SUB_FIELDS: Partial<
  Record<(typeof LOCKABLE_FIELD_KEYS)[number], readonly string[]>
> = {
  attributes: ['AGI', 'ESP', 'INT', 'VIG'],
};

@ValidatorConstraint({ name: 'subFieldMatchesFieldKey', async: false })
class SubFieldMatchesFieldKeyConstraint implements ValidatorConstraintInterface {
  validate(subField: unknown, args: ValidationArguments): boolean {
    if (subField === undefined) return true;
    const fieldKey = (args.object as VisibilityLockPathInput).fieldKey;
    const allowed = LOCKABLE_SUB_FIELDS[fieldKey as (typeof LOCKABLE_FIELD_KEYS)[number]];
    return Array.isArray(allowed) && allowed.includes(subField);
  }

  defaultMessage(args: ValidationArguments): string {
    const fieldKey = (args.object as VisibilityLockPathInput).fieldKey;
    return `subField invalide pour fieldKey "${fieldKey}"`;
  }
}

class VisibilityLockPathInput {
  @IsIn(LOCKABLE_FIELD_KEYS)
  @MaxLength(64)
  fieldKey!: string;

  @IsOptional()
  @IsString()
  @Matches(FIELD_KEY_PATTERN)
  @MaxLength(64)
  @Validate(SubFieldMatchesFieldKeyConstraint)
  subField?: string;
}

/**
 * Story 31.6 — jeu DÉCLARATIF COMPLET des chemins verrouillés pour une Partie, jamais un delta
 * (même patron que `SetPollOptionsDto`, Story 36.10/D-16) : ce qui n'est pas dans `paths` est
 * retiré par `PartiesService.setVisibilityLocks()`.
 *
 * `subField` est validé contre `LOCKABLE_SUB_FIELDS` (voir ci-dessus) : un sous-champ qui n'est pas
 * déclaré pour ce `fieldKey` est rejeté à l'entrée, jamais silencieusement inerte.
 */
export class SetVisibilityLocksDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => VisibilityLockPathInput)
  paths!: VisibilityLockPathInput[];
}
