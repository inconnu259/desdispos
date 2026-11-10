import type { PdfFieldValue } from './pdf-field-map.ts';

/** Miroir local des données nécessaires au mapping PDF notes — jamais un import direct de
 * `CharacterNoteDto` depuis `@desdispos/shared` (frontière types-only, effacée au runtime —
 * importer une valeur depuis ce package casse la suite `api`, cf. Story 10.5). */
export interface NotesPdfInput {
  /** Déjà triées et filtrées par confidentialité par l'appelant (`CharacterService.getNotes()`,
   * cf. Story 11.2 Dev Notes — ce module ne fait aucune vérification d'accès). */
  notes: { text: string; createdAt: string }[];
}

const MAX_NOTE_ROWS = 21;

/** Formate une date ISO en fr-FR (JJ/MM/AAAA) — dupliquée à l'identique depuis
 * `homme-dragon-pdf-field-map.ts` (fonction privée à ce fichier, non exportée) : le template PDF
 * est un document officiel destiné à des joueurs francophones, jamais l'ordre ISO
 * (AAAA-MM-JJ). Chaîne vide si la date est invalide (défense de profondeur, ne devrait jamais
 * arriver via l'API). */
function formatDateFr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR');
}

/**
 * Mappe le journal de notes d'un personnage vers les champs AcroForm du template officiel
 * (`Ryuutama_fiche_de_notes_edit.pdf`, 42 champs réels, tous `PDFTextField` — vérifiés via
 * pdf-lib, pas devinés, cf. Story 11.2 Task 0). Contrairement aux 3 autres templates PDF déjà
 * exploités dans ce projet, celui-ci **n'a aucun champ d'en-tête** (`joueur`/`voyageur`) —
 * uniquement 21 lignes `Note.{0..20}.{0|1}` (colonne `.0` = date, colonne `.1` = texte).
 *
 * `input.notes` est déjà dans l'ordre voulu par l'appelant (le plus récent en premier, cf.
 * `CharacterService.getNotes()`) — cette fonction ne trie jamais. Si plus de 21 notes sont
 * fournies, les entrées au-delà de la 21e sont omises sans erreur (limite physique du template,
 * même principe que la troncature à 21 emplacements équipement, Story 11.1).
 */
export function mapNotesToPdfFields(input: NotesPdfInput): PdfFieldValue[] {
  const fields: PdfFieldValue[] = [];
  for (let i = 0; i < MAX_NOTE_ROWS; i++) {
    const note = input.notes[i];
    fields.push(
      { field: `Note.${i}.0`, value: note ? formatDateFr(note.createdAt) : '', kind: 'text' },
      { field: `Note.${i}.1`, value: note?.text ?? '', kind: 'text' },
    );
  }
  return fields;
}
