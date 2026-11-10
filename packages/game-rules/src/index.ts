export { computeDerived } from './ryuutama/compute-derived.ts';
export { validate } from './ryuutama/validate.ts';
export { mapToPdfFields } from './ryuutama/pdf-field-map.ts';
export { levelForXp, pendingLevels, LEVEL_TABLE } from './ryuutama/leveling.ts';
export { validateHommeDragon } from './ryuutama/validate-homme-dragon.ts';
export {
  levelForScenariosPasse,
  computeHommeDragonDerived,
  pendingEveilLevels,
  HOMME_DRAGON_LEVEL_THRESHOLDS,
  ARTEFACT_CADEAU_LEVEL,
  SOUFFLES_RITUELS_LEVEL,
} from './ryuutama/homme-dragon-derived.ts';
export { mapHommeDragonToPdfFields } from './ryuutama/homme-dragon-pdf-field-map.ts';
export { flattenVoyageursProteges } from './ryuutama/homme-dragon-voyageurs.ts';
export {
  availableSouffles,
  SOUFFLES_MULTICOLORES_LEVEL,
} from './ryuutama/homme-dragon-souffles.ts';
export {
  reserveCapacity,
  reserveSouffleKind,
  reservePlacement,
  reservePlacements,
  validateReserve,
  reserveReasonDejaDans,
  RESERVE_REASON_TEMPS,
  RESERVE_REASON_QUOTA_AUTRE_RACE,
  RESERVE_REASON_RITUEL,
  RESERVE_REASON_AUTRE_RACE_NIVEAU,
  RESERVE_REASON_INCONNU,
} from './ryuutama/homme-dragon-reserve.ts';
export { mapEquipmentToPdfFields } from './ryuutama/equipment-pdf-field-map.ts';
export { mapNotesToPdfFields } from './ryuutama/notes-pdf-field-map.ts';
export { resolveWeaponCategory, resolveWeapon } from './ryuutama/resolve-weapon-category.ts';
export { resolveStartingEquipment } from './ryuutama/resolve-starting-equipment.ts';
export type {
  RyuutamaSheetData,
  DerivedStats,
  ValidationResult,
  ValidationError,
  RyuutamaCatalog,
  InventoryItem,
} from './ryuutama/types.ts';
export type { RyuutamaPdfContent, PdfFieldValue } from './ryuutama/pdf-field-map.ts';
export type { CapabilityType } from './ryuutama/leveling.ts';
export type {
  HommeDragonRace,
  HommeDragonSheetData,
  HommeDragonArtefactCatalogEntry,
} from './ryuutama/validate-homme-dragon.ts';
export type { HommeDragonDerivedStats } from './ryuutama/homme-dragon-derived.ts';
export type {
  HommeDragonVoyageur,
  HommeDragonAventureVoyageurs,
} from './ryuutama/homme-dragon-voyageurs.ts';
export type {
  HommeDragonPdfContent,
  HommeDragonPdfInput,
} from './ryuutama/homme-dragon-pdf-field-map.ts';
export type {
  SouffleFamille,
  SouffleCatalogEntry,
  AvailableSouffle,
  SouffleGroup,
  SouffleGroupSection,
} from './ryuutama/homme-dragon-souffles.ts';
export type {
  Reserve,
  ReserveCatalogs,
  ReserveSouffleKind,
  ReservePlacement,
} from './ryuutama/homme-dragon-reserve.ts';
export type { EquipmentPdfInput } from './ryuutama/equipment-pdf-field-map.ts';
export type {
  WeaponItemEntry,
  WeaponCategoryEntry,
  WeaponItemContentData,
  WeaponCategoryContentData,
  WeaponResolutionCatalog,
  ResolvedWeapon,
} from './ryuutama/resolve-weapon-category.ts';
export type {
  EquipmentCatalogEntry,
  ResolvedStartingEquipment,
} from './ryuutama/resolve-starting-equipment.ts';
