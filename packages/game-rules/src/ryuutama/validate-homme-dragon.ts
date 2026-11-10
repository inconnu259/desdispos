import type { ValidationError, ValidationResult } from './types.ts';

/** Race de l'Homme Dragon — miroir local de `HommeDragonRace` (`@master-jdr/shared`), jamais
 * importé en valeur runtime depuis `packages/shared` (frontière types-only, cf. `types.ts`). */
export type HommeDragonRace = 'DRAGON_VERT' | 'DRAGON_BLEU' | 'DRAGON_ROUGE' | 'DRAGON_NOIR';

const VALID_RACES: HommeDragonRace[] = [
  'DRAGON_VERT',
  'DRAGON_BLEU',
  'DRAGON_ROUGE',
  'DRAGON_NOIR',
];

export interface HommeDragonSheetData {
  race: HommeDragonRace;
  artefact: { key: string; nom?: string; inscription?: string };
  nom: string;
  apparence?: string;
  caractere?: string;
  vocation?: string;
  demeure?: string;
  avatar?: string;
  mondesProteges?: string;
  eveilPowers?: { level: number; key: string }[];
  /** Artefact cadeau du niveau 4 (Story 33.7) — choix définitif, jamais validé ici (règle serveur). */
  artefactCadeau?: { key: string };
  /** Réserve de souffles (Story 33.6) : positionnelle (index = emplacement − 1), clé d'un souffle
   * du catalogue `souffle` ou `souffleRituel`, `null`/absent = emplacement vide. Jamais validée
   * ici : les règles de la réserve vivent dans `homme-dragon-reserve.ts`. */
  reserve?: (string | null)[];
}

/** Entrée de catalogue `hommeDragonArtefact` dérivée du contenu seedé en base
 * (`GameSystemService.getContent`), même principe que `RyuutamaCatalog` pour le PJ. */
export interface HommeDragonArtefactCatalogEntry {
  key: string;
  race: string;
}

export function validateHommeDragon(
  data: HommeDragonSheetData,
  catalog: HommeDragonArtefactCatalogEntry[],
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.nom?.trim()) {
    errors.push({ field: 'nom', message: 'Le nom est obligatoire' });
  }

  if (!data.race || !VALID_RACES.includes(data.race)) {
    errors.push({
      field: 'race',
      message: `Race invalide. Races acceptées : ${VALID_RACES.join(', ')}`,
    });
  }

  const entry = catalog.find((e) => e.key === data.artefact?.key);
  if (!data.artefact?.key || !entry || entry.race !== data.race) {
    errors.push({
      field: 'artefact.key',
      message: "L'artefact choisi doit appartenir à la race sélectionnée",
    });
  }

  return { valid: errors.length === 0, errors };
}
