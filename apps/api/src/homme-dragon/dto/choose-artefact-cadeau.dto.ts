import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Choix de l'artefact cadeau du niveau 4 (Story 33.7) — la validité de la clé (catalogue, race) est
 * vérifiée par le service, pas ici. */
export class ChooseArtefactCadeauDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key!: string;
}
