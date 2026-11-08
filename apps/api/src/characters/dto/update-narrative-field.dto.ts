import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const NARRATIVE_FIELDS = [
  'sex',
  'age',
  'physicalTraits',
  'homeTown',
  'motivation',
  'personality',
] as const;

export class UpdateNarrativeFieldDto {
  @IsString()
  @IsIn(NARRATIVE_FIELDS)
  field!: (typeof NARRATIVE_FIELDS)[number];

  // null (ou absent) vide le champ ; sinon un texte borné. Avant la revue de sécurité 2026-11, n'importe
  // quel JSON (objet, tableau, chaîne géante) était accepté et stocké dans la fiche.
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  value?: string | null;
}
