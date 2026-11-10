import type { PdfFieldValue } from './pdf-field-map.ts';

/** Miroir local des données nécessaires au mapping PDF équipement — jamais un import direct de
 * `CharacterDto`/`RyuutamaSheetData` depuis `@desdispos/shared` (frontière types-only, effacée
 * au runtime — importer une valeur depuis ce package casse la suite `api`, cf. Story 10.5). */
export interface EquipmentPdfInput {
  ownerPseudo: string;
  characterName: string;
  encombrementLimit: number;
  equipment: {
    individual: { name: string; weight: number; price?: string; effect?: string }[];
    contenants: { name: string; weight: number; price?: string; effect?: string }[];
    animaux: { name: string; price?: string; effect?: string }[];
  };
}

/**
 * Ordre exact des 21 emplacements Objet/Prix/Enc du template (Bloc A : 5 lignes avec Effets ;
 * Bloc B : 16 emplacements sans Effets — nommage `_2`/`_3` non séquentiel selon la ligne, artefact
 * de l'outil source du PDF, vérifié via pdf-lib, cf. Story 11.1 Task 0). Liste énumérée plutôt que
 * dérivée par une formule, pour éviter toute reconstruction erronée du nommage irrégulier.
 * Chacun des 21 emplacements a bien son propre champ `Prix*` (Story 14.3) — seuls les 5 premiers
 * ont en plus un champ Effets (`EFFETS_FIELDS` ci-dessous), limite physique du template.
 */
const OBJECT_SLOTS: readonly [string, string, string][] = [
  ['ObjetRow1', 'PrixRow1', 'EncRow1'],
  ['ObjetRow2', 'PrixRow2', 'EncRow2'],
  ['ObjetRow3', 'PrixRow3', 'EncRow3'],
  ['ObjetRow4', 'PrixRow4', 'EncRow4'],
  ['ObjetRow5', 'PrixRow5', 'EncRow5'],
  ['ObjetRow1_2', 'PrixRow1_2', 'EncRow1_2'],
  ['ObjetRow1_3', 'PrixRow1_3', 'EncRow1_3'],
  ['ObjetRow2_2', 'PrixRow2_2', 'EncRow2_2'],
  ['ObjetRow2_3', 'PrixRow2_3', 'EncRow2_3'],
  ['ObjetRow3_2', 'PrixRow3_2', 'EncRow3_2'],
  ['ObjetRow3_3', 'PrixRow3_3', 'EncRow3_3'],
  ['ObjetRow4_2', 'PrixRow4_2', 'EncRow4_2'],
  ['ObjetRow4_3', 'PrixRow4_3', 'EncRow4_3'],
  ['ObjetRow5_2', 'PrixRow5_2', 'EncRow5_2'],
  ['ObjetRow5_3', 'PrixRow5_3', 'EncRow5_3'],
  ['ObjetRow6', 'PrixRow6', 'EncRow6'],
  ['ObjetRow6_2', 'PrixRow6_2', 'EncRow6_2'],
  ['ObjetRow7', 'PrixRow7', 'EncRow7'],
  ['ObjetRow7_2', 'PrixRow7_2', 'EncRow7_2'],
  ['ObjetRow8', 'PrixRow8', 'EncRow8'],
  ['ObjetRow8_2', 'PrixRow8_2', 'EncRow8_2'],
];

/** Champs "Effets" du Bloc A (5 premiers emplacements uniquement) — limite physique du template,
 * ne jamais étendre au-delà. */
const EFFETS_FIELDS = ['EffetsRow1', 'EffetsRow2', 'EffetsRow3', 'EffetsRow4', 'EffetsRow5'];

/**
 * Bloc « Contenant » (3 emplacements) — chacun a ses 4 champs propres (Objet/Prix/Enc/Effets),
 * contrairement au bloc objets généraux où seuls les 5 premiers ont un champ Effets. Noms vérifiés
 * via `pdf-lib` (Story 14.3), pas devinés.
 */
const CONTENANT_SLOTS: readonly [string, string, string, string][] = [
  ['ContenantRow1', 'PrixRow1_4', 'EncRow1_4', 'EffetsRow1_2'],
  ['ContenantRow2', 'PrixRow2_4', 'EncRow2_4', 'EffetsRow2_2'],
  ['ContenantRow3', 'PrixRow3_4', 'EncRow3_4', 'EffetsRow3_2'],
];

/**
 * Bloc « Animal » (3 emplacements) — **aucun champ `Enc*`** pour ce bloc dans le template lui-même
 * (confirme structurellement FR8 : le gabarit PDF officiel n'a jamais eu de colonne encombrement
 * pour les animaux). Noms vérifiés via `pdf-lib` (Story 14.3), pas devinés.
 */
const ANIMAL_SLOTS: readonly [string, string, string][] = [
  ['AnimalRow1', 'PrixRow1_5', 'EffetsRow1_3'],
  ['AnimalRow2', 'PrixRow2_5', 'EffetsRow2_3'],
  ['AnimalRow3', 'PrixRow3_5', 'EffetsRow3_3'],
];

/**
 * Mappe l'équipement d'un personnage vers les champs AcroForm du template officiel
 * (`Ryuutama-fiche_equipement_edit.pdf`, 94 champs réels, tous `PDFTextField` — vérifiés via
 * pdf-lib, pas devinés, cf. Story 11.1 Task 0).
 *
 * `individual` remplit les 21 emplacements `OBJECT_SLOTS` (Objet/Prix/Enc sur les 21, Effets sur
 * les 5 premiers uniquement — limite physique du template, Story 14.3) ; au-delà, les objets
 * excédentaires sont omis sans erreur (limite physique du template, même principe que
 * `voyageurs_proteges_1/2`/`historique` sur la fiche Homme Dragon, Story 10.5).
 *
 * `contenants`/`animaux` remplissent chacun leurs 3 emplacements dédiés (`CONTENANT_SLOTS`/
 * `ANIMAL_SLOTS`, Story 14.3) — même troncature silencieuse au-delà de 3, même convention.
 *
 * Champ `Po` (monnaie) : volontairement jamais poussé — aucune donnée de monnaie totale dans le
 * modèle (hors scope PRD §4.2).
 *
 * `encombrement` = somme des poids de `individual` **et** `contenants` — jamais `animaux`, qui
 * n'ont pas de poids (FR8), même règle que `InventoryTab.totalWeight()` côté web (Story 14.2).
 */
/** `sheetData` atteint cette fonction via un cast non validé à l'exécution (`as unknown as
 * RyuutamaSheetData`, cf. `EquipmentPdfService`) — une fiche legacy/corrompue peut porter un
 * `weight` `null`/`NaN`/chaîne malgré le typage `number`. Traité comme absent (même convention
 * que `??` pour `price`/`effect`) plutôt que laissé fuiter en `"null"`/`"NaN"` dans le PDF, ou
 * pire, en concaténation de chaîne silencieuse dans le total `encombrement`. */
function isValidWeight(weight: unknown): weight is number {
  return typeof weight === 'number' && !Number.isNaN(weight);
}

function numericWeightOrZero(weight: unknown): number {
  return isValidWeight(weight) ? weight : 0;
}

export function mapEquipmentToPdfFields(input: EquipmentPdfInput): PdfFieldValue[] {
  const totalWeight =
    input.equipment.individual.reduce((sum, item) => sum + numericWeightOrZero(item.weight), 0) +
    input.equipment.contenants.reduce((sum, item) => sum + numericWeightOrZero(item.weight), 0);

  const fields: PdfFieldValue[] = [
    { field: 'joueur', value: input.ownerPseudo, kind: 'text' },
    { field: 'voyageur', value: input.characterName, kind: 'text' },
    { field: 'limite_enc', value: String(input.encombrementLimit), kind: 'text' },
    { field: 'encombrement', value: String(totalWeight), kind: 'text' },
  ];

  const individual = input.equipment.individual;
  for (let i = 0; i < OBJECT_SLOTS.length; i++) {
    const [objetField, prixField, encField] = OBJECT_SLOTS[i];
    const item = individual[i];
    fields.push(
      { field: objetField, value: item?.name ?? '', kind: 'text' },
      { field: prixField, value: item?.price ?? '', kind: 'text' },
      {
        field: encField,
        value: isValidWeight(item?.weight) ? String(item.weight) : '',
        kind: 'text',
      },
    );
  }

  for (let i = 0; i < EFFETS_FIELDS.length; i++) {
    fields.push({ field: EFFETS_FIELDS[i], value: individual[i]?.effect ?? '', kind: 'text' });
  }

  const contenants = input.equipment.contenants;
  for (let i = 0; i < CONTENANT_SLOTS.length; i++) {
    const [objetField, prixField, encField, effetsField] = CONTENANT_SLOTS[i];
    const item = contenants[i];
    fields.push(
      { field: objetField, value: item?.name ?? '', kind: 'text' },
      { field: prixField, value: item?.price ?? '', kind: 'text' },
      {
        field: encField,
        value: isValidWeight(item?.weight) ? String(item.weight) : '',
        kind: 'text',
      },
      { field: effetsField, value: item?.effect ?? '', kind: 'text' },
    );
  }

  const animaux = input.equipment.animaux;
  for (let i = 0; i < ANIMAL_SLOTS.length; i++) {
    const [objetField, prixField, effetsField] = ANIMAL_SLOTS[i];
    const item = animaux[i];
    fields.push(
      { field: objetField, value: item?.name ?? '', kind: 'text' },
      { field: prixField, value: item?.price ?? '', kind: 'text' },
      { field: effetsField, value: item?.effect ?? '', kind: 'text' },
    );
  }

  return fields;
}
