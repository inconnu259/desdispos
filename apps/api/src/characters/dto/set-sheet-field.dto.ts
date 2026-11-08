import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MaxJsonSize } from '../../common/dto/max-json-size.validator';

export class SetSheetFieldDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  path!: string;

  // `@IsOptional()` ici ne signifie PAS "value peut être omis sans effet" mais sert à enregistrer
  // la propriété dans les métadonnées `class-validator` : sans AUCUN décorateur, `whitelist: true`
  // (ValidationPipe global) la considère comme un champ inconnu et la supprime/rejette (400), même
  // si elle est déclarée sur la classe (constaté empiriquement). `@IsOptional()` la rend visible au
  // whitelist tout en n'imposant aucune contrainte de forme — `value` accepte donc n'importe quelle
  // valeur JSON (string/number/object/array/null/absente), cohérent avec `PATCH /sheet-field
  // { path: string, value: unknown }` (AD-6). `@IsDefined()` a été essayé en premier mais rejette
  // `null` en plus d'`undefined` (contrairement à l'attente), ce qui aurait empêché le MJ de vider
  // un champ optionnel (ex. fetiqueObject).
  @IsOptional()
  @MaxJsonSize(10_000)
  value: unknown;
}
