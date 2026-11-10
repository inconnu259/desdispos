import { IsIn } from 'class-validator';

/** Format d'export PDF — mêmes valeurs que `ExportCharacterPdfDto` (fiches joueur). */
export type HommeDragonPdfFormat = 'editable' | '2pages';

export class ExportHommeDragonPdfDto {
  @IsIn(['editable', '2pages'])
  format: HommeDragonPdfFormat;
}
