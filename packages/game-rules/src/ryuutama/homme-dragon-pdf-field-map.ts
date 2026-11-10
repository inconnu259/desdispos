import type { PdfFieldValue } from './pdf-field-map.ts';
import type { HommeDragonSheetData } from './validate-homme-dragon.ts';
import { reserveCapacity } from './homme-dragon-reserve.ts';
import {
  flattenVoyageursProteges,
  type HommeDragonAventureVoyageurs,
} from './homme-dragon-voyageurs.ts';

/** Miroir local des champs de `HommeDragonDto` (`@master-jdr/shared`) nécessaires au mapping PDF
 * — jamais importé directement depuis `packages/shared` (frontière types-only, même convention
 * que `HommeDragonRace`/`HommeDragonSheetData` dans `validate-homme-dragon.ts`). */
export interface HommeDragonPdfInput {
  sheetData: HommeDragonSheetData;
  createdAt: string;
  derived: { level: number; PS: number };
  /** Aventures de l'Homme Dragon (AD-23) : leurs voyageurs sont aplatis et dédoublonnés pour le PDF
   * par `flattenVoyageursProteges()`. */
  aventures: HommeDragonAventureVoyageurs[];
  historique: { scenarioTitle: string; date: string; participants: string[] }[];
  eveilPowers: { level: number; key: string }[];
}

/** Contenu résolu (labels) à fournir par l'appelant — jamais chargé en interne, cf. principe des
 * fonctions pures de ce package. */
export interface HommeDragonPdfContent {
  /** Libellé de la race (ex. "Dragon Rouge") — même RACE_LABELS que le frontend. */
  raceLabel: string;
  /** Pseudo du MJ — remplit le champ "meneur". */
  mjPseudo: string;
  /** key → label du catalogue `eveilPower` — résout eveil_1..4 sans jamais afficher une clé technique brute. */
  eveilPowerLabels: Record<string, string>;
  /** `label` du catalogue `hommeDragonArtefact` pour `sheetData.artefact.key` — imprimé quand le MJ
   * n'a pas saisi de nom personnalisé. `undefined` si le catalogue ne connaît plus l'entrée : la
   * clé brute sert alors de dernier repli. */
  artefactLabel?: string;
  /** key → label des catalogues `souffle` + `souffleRituel` — résout `souffle_1..4` (réserve,
   * Story 33.6). Une clé absente (souffle retiré du catalogue) s'imprime telle quelle : la ligne
   * reste lisible, comme sur la fiche. */
  reserveLabels?: Record<string, string>;
}

/** Nombre de cases `souffle_N` du gabarit officiel. */
const PDF_RESERVE_BOXES = 4;

const MAX_HISTORIQUE_ROWS = 12;

/** Formate une date ISO en fr-FR (JJ/MM/AAAA) — le template PDF est un document officiel destiné
 * à des joueurs francophones, jamais l'ordre ISO (AAAA-MM-JJ). Chaîne vide si la date est
 * invalide (défense de profondeur, ne devrait jamais arriver via l'API). */
function formatDateFr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR');
}

/**
 * Mappe une fiche Homme Dragon vers les champs AcroForm du template officiel
 * (`Ryuutama_fiche_homme-dragon_big_edit.pdf`, 63 champs réels, tous `PDFTextField` — vérifiés
 * via pdf-lib, pas devinés, cf. Story 10.5 Task 0).
 *
 * Champs de souffle (Story 33.4, qui renverse la décision « état plein » de la Story 10.5) :
 * - `souffle_max` = PS max (`derived.PS`) ;
 * - `souffle_actuel` reste VIDE : un champ « actuel » rempli laisserait croire à un suivi de
 *   consommation que l'application n'a pas (épic 33 : aucun décompte en séance) — la case se
 *   remplit au stylo à la table ;
 * - `nombre_souffles` (« Nombre Max : » de la réserve) = capacité de réserve `max(niveau − 1, 0)`
 *   (`docs/dragons.md`) — jamais les PS, comme l'ancien mapping le faisait à tort ;
 * - `souffle_1`..`souffle_4` (les 4 cases de la réserve, Story 33.6) = le NOM du souffle (sans son
 *   coût) de l'emplacement de même numéro dans `sheetData.reserve` ; case vide si l'emplacement
 *   ou la réserve est vide. Rien n'est décompté : ni « utilisé » ni « restant ».
 * Les souffles disponibles eux-mêmes ne tiennent pas dans le template : ils sont dessinés sur des
 * pages ajoutées par `HommeDragonPdfService` (`availableSouffles()`).
 *
 * `eveil_1`..`eveil_4` sont mappés PAR NIVEAU (`eveil_1` = niveau 2, `eveil_2` = niveau 3,
 * `eveil_3` = niveau 4, `eveil_4` = niveau 5), jamais par position dans `eveilPowers[]` — la
 * disposition visuelle réelle du template n'est pas dans l'ordre de lecture 1-2-3-4 (vérifié par
 * les coordonnées des champs), et l'API autorise un remplissage hors-ordre des niveaux (Story
 * 10.4, revue de code) : un mapping par index produirait un résultat visuellement incohérent.
 *
 * `sc1`..`sc12`/`date_sc_1`..`date_sc_12`/`voy_sc_1`..`voy_sc_12` : le template n'a que 12 lignes.
 * `historique` est déjà renvoyé en ordre chronologique croissant (le plus ancien en premier) —
 * si plus de 12 entrées existent, seules les 12 plus récentes sont gardées (`slice(-12)`), plus
 * utiles à table que le tout début de la campagne.
 *
 * `monde_protege_1/2/3` : le template a 3 emplacements pour un seul champ `mondesProteges` (texte
 * libre) côté données — jamais découpé artificiellement, seul le premier est rempli.
 * `voyageurs_proteges_1/2` : deux zones multilignes — TOUS les voyageurs de TOUTES les aventures
 * sont imprimés, dédoublonnés (`flattenVoyageursProteges`, AD-23), répartis dans l'ordre (première
 * moitié dans la zone 1, le reste dans la zone 2), un par ligne.
 */
export function mapHommeDragonToPdfFields(
  dto: HommeDragonPdfInput,
  content: HommeDragonPdfContent,
): PdfFieldValue[] {
  const { sheetData, derived, aventures, historique, eveilPowers } = dto;

  const apparenceCaractere = [sheetData.apparence, sheetData.caractere]
    .filter((v): v is string => Boolean(v?.trim()))
    .join('\n\n');

  const recentHistorique = historique.slice(-MAX_HISTORIQUE_ROWS);

  const artefactNom = sheetData.artefact.nom?.trim();
  const artefactPrinted = artefactNom || content.artefactLabel || sheetData.artefact.key;

  const pseudos = flattenVoyageursProteges(aventures).map((v) => v.pseudo);
  const splitAt = Math.ceil(pseudos.length / 2);
  const reserve = sheetData.reserve ?? [];

  const fields: PdfFieldValue[] = [
    { field: 'nom', value: sheetData.nom, kind: 'text' },
    { field: 'couleur', value: content.raceLabel, kind: 'text' },
    { field: 'niveau', value: String(derived.level), kind: 'text' },
    { field: 'artefact', value: artefactPrinted, kind: 'text' },
    { field: 'inscription', value: sheetData.artefact.inscription ?? '', kind: 'text' },
    { field: 'avatar', value: sheetData.avatar ?? '', kind: 'text' },
    { field: 'meneur', value: content.mjPseudo, kind: 'text' },
    { field: 'cree_le', value: formatDateFr(dto.createdAt), kind: 'text' },
    { field: 'souffle_max', value: String(derived.PS), kind: 'text' },
    { field: 'souffle_actuel', value: '', kind: 'text' },
    { field: 'nombre_souffles', value: String(reserveCapacity(derived.level)), kind: 'text' },
    { field: 'apparence_caractere', value: apparenceCaractere, kind: 'text' },
    { field: 'vocation', value: sheetData.vocation ?? '', kind: 'text' },
    { field: 'demeure', value: sheetData.demeure ?? '', kind: 'text' },
    { field: 'monde_protege_1', value: sheetData.mondesProteges ?? '', kind: 'text' },
    { field: 'monde_protege_2', value: '', kind: 'text' },
    { field: 'monde_protege_3', value: '', kind: 'text' },
    { field: 'voyageurs_proteges_1', value: pseudos.slice(0, splitAt).join('\n'), kind: 'text' },
    { field: 'voyageurs_proteges_2', value: pseudos.slice(splitAt).join('\n'), kind: 'text' },
  ];

  for (let slot = 1; slot <= PDF_RESERVE_BOXES; slot++) {
    const key = reserve[slot - 1];
    fields.push({
      field: `souffle_${slot}`,
      value: key ? (content.reserveLabels?.[key] ?? key) : '',
      kind: 'text',
    });
  }

  for (let level = 2; level <= 5; level++) {
    const key = eveilPowers.find((e) => e.level === level)?.key;
    fields.push({
      field: `eveil_${level - 1}`,
      // Jamais la clé brute (cf. doc `HommeDragonPdfContent.eveilPowerLabels`) : si le catalogue
      // n'a plus de libellé pour cette clé (entrée renommée/supprimée après le choix du MJ),
      // chaîne vide plutôt qu'un identifiant technique illisible sur la fiche imprimée.
      value: key ? (content.eveilPowerLabels[key] ?? '') : '',
      kind: 'text',
    });
  }

  for (let i = 0; i < MAX_HISTORIQUE_ROWS; i++) {
    const entry = recentHistorique[i];
    fields.push(
      { field: `sc${i + 1}`, value: entry?.scenarioTitle ?? '', kind: 'text' },
      { field: `date_sc_${i + 1}`, value: entry ? formatDateFr(entry.date) : '', kind: 'text' },
      { field: `voy_sc_${i + 1}`, value: entry?.participants.join(', ') ?? '', kind: 'text' },
    );
  }

  return fields;
}
