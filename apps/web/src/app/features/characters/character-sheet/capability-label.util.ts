import type { CharacterDto, CharacterSnapshotDto, GameSystemContentDto } from '@desdispos/shared';
import { findContentEntry } from '../../../core/characters/character.util';

export interface LevelUpEntry {
  level: number;
  pvAllocated: number;
  peAllocated: number;
  /** 1 ou 2 capacités (2 aux niveaux 4/6/10 — Attribut ET spéciale octroyés conjointement). */
  capabilities: { type: string; params: Record<string, unknown> }[];
}

/**
 * Une capacité individuelle rattachée au niveau qui l'a octroyée — aplatie depuis
 * `levelUps[].capabilities`, pour que les consommateurs (fiche, historique) manipulent une
 * capacité à la fois quel que soit le nombre octroyé au même niveau.
 */
export interface FlatCapability {
  level: number;
  capability: { type: string; params: Record<string, unknown> };
}

/** Types déjà intégrés dans une section dédiée de la fiche (Attributs/Vocation/Voie/Paysage/Immunités). */
const STRUCTURAL_CAPABILITY_TYPES = ['attribute', 'landscape', 'immunity', 'class', 'type'];

/** Lit `sheetData.levelUps` — absent sur les personnages créés avant ce palier, traité comme `[]`. */
export function getLevelUps(character: CharacterDto): LevelUpEntry[] {
  return ((character.sheetData as any)?.levelUps as LevelUpEntry[] | undefined) ?? [];
}

/**
 * Capacités octroyées à la création par certains talents de classe (Story 23.8, ex. Climatophile
 * du Météomancien) — stockées séparément de `levelUps[]` pour ne jamais fausser le calcul du
 * niveau (`1 + levelUps.length`). Absent sur les personnages qui n'en ont pas.
 */
function getClassCapabilities(
  character: CharacterDto,
): { type: string; params: Record<string, unknown> }[] {
  return (
    ((character.sheetData as any)?.classCapabilities as
      { type: string; params: Record<string, unknown> }[] | undefined) ?? []
  );
}

/**
 * Aplatit toutes les capacités obtenues, chacune rattachée à son niveau. Fusionne aussi
 * `classCapabilities` (Story 23.8) avec un `level: 1` conventionnel (obtenues à la création) —
 * sans jamais les insérer dans `levelUps[]` lui-même (cf. Dev Notes 23.8, calcul du niveau).
 */
export function getFlatCapabilities(character: CharacterDto): FlatCapability[] {
  const fromLevelUps = getLevelUps(character).flatMap((entry) =>
    (entry.capabilities ?? []).map((capability) => ({ level: entry.level, capability })),
  );
  const fromClassCapabilities = getClassCapabilities(character).map((capability) => ({
    level: 1,
    capability,
  }));
  return [...fromLevelUps, ...fromClassCapabilities];
}

/** Filtre les capacités par type (ex. tous les paysages/climats obtenus). */
export function getCapabilitiesByType(character: CharacterDto, type: string): FlatCapability[] {
  return getFlatCapabilities(character).filter((fc) => fc.capability.type === type);
}

/**
 * Capacités sans section structurelle dédiée (Protection d'un dragon, Voyage légendaire, et tout
 * type futur du même genre) — affichées dans un petit encart générique plutôt que perdues dans un
 * simple journal, cohérent avec le traitement des autres capacités.
 */
export function getOtherCapabilities(character: CharacterDto): FlatCapability[] {
  return getFlatCapabilities(character).filter(
    (fc) => !STRUCTURAL_CAPABILITY_TYPES.includes(fc.capability.type),
  );
}

/**
 * Résout l'entrée `levelUps[]` correspondant à un instantané `LEVEL_UP` (Historique) — chaque
 * snapshot de ce type correspond à exactement une montée de niveau, celle dont l'index est
 * `snapshot.level - 2` (niveau 2 = 1ère entrée, cf. `pendingLevels`/convention déjà établie).
 * `null` pour un snapshot `MJ_EDIT` (aucun choix de capacité associé).
 */
export function getLevelUpEntryForSnapshot(snapshot: CharacterSnapshotDto): LevelUpEntry | null {
  if (snapshot.trigger !== 'LEVEL_UP') return null;
  const levelUps = ((snapshot.sheetData as any)?.levelUps as LevelUpEntry[] | undefined) ?? [];
  return levelUps[snapshot.level - 2] ?? null;
}

/**
 * Description lisible de toutes les capacités choisies à une montée de niveau (Historique) —
 * jointes par « · » (niveaux 4/6/10 en ont deux). `null` pour un instantané `MJ_EDIT`.
 */
export function snapshotCapabilityChoice(
  snapshot: CharacterSnapshotDto,
  content: GameSystemContentDto | null,
): string | null {
  const entry = getLevelUpEntryForSnapshot(snapshot);
  if (!entry) return null;
  return (entry.capabilities ?? [])
    .map((capability) => capabilityDescription({ level: entry.level, capability }, content))
    .join(' · ');
}

interface LabelledData {
  label?: string;
}

/**
 * Description lisible d'une capacité choisie via le `LevelUpWizard` (FR-8 : "les capacités
 * choisies... sont enregistrées sur la fiche et affichées, avec leur description"). Les types
 * data-driven (landscape/immunity/class/type/dragon-protection) résolvent leur libellé depuis le
 * contenu seedé du système de jeu — jamais codé en dur, cohérent avec le reste de la fiche
 * (classData/typeData/weaponData).
 */
export function capabilityDescription(
  entry: FlatCapability,
  content: GameSystemContentDto | null,
): string {
  const { type, params } = entry.capability;
  switch (type) {
    case 'attribute':
      return `Attribut : ${params['attribute'] ?? ''}`;
    case 'landscape':
      return `Paysage/climat favori : ${resolveLabel(content, 'landscape', params)}`;
    case 'immunity':
      return `Immunité : ${resolveLabel(content, 'immunityState', params)}`;
    case 'class':
      return `Classe supplémentaire : ${resolveLabel(content, 'class', params)}`;
    case 'type':
      return `Type supplémentaire : ${resolveLabel(content, 'type', params)}`;
    case 'dragon-protection':
      return `Protection d'un dragon : ${resolveLabel(content, 'season', params)}`;
    case 'legendary-journey':
      return 'Voyage légendaire débloqué';
    default:
      return type;
  }
}

function resolveLabel(
  content: GameSystemContentDto | null,
  contentType: string,
  params: Record<string, unknown>,
): string {
  const key = params['key'] as string | undefined;
  const data = findContentEntry<LabelledData>(content, contentType, key);
  return data?.label ?? key ?? '';
}
