export type DetectedDocumentMime = 'application/pdf' | 'text/plain';

const MIME_EXTENSION: Record<DetectedDocumentMime, string> = {
  'application/pdf': '.pdf',
  'text/plain': '.txt',
};

const TEXT_SNIFF_WINDOW = 8000;

/**
 * Détecte le type réel d'un document par ses octets, jamais par l'extension du fichier ni
 * le `Content-Type` déclaré par le client (les deux sont trivialement falsifiables) — même
 * principe que `detectImageMime`. Le PDF a une signature magique (`%PDF-`) ; le texte brut
 * n'en a aucune de fiable, donc heuristique : un vrai texte UTF-8/ASCII ne contient jamais
 * de byte NUL, un fichier binaire mal étiqueté `.txt` en contient presque toujours un
 * rapidement — on inspecte les 8000 premiers octets.
 */
export function detectDocumentMime(buffer: Buffer): DetectedDocumentMime | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }
  const window = buffer.subarray(0, TEXT_SNIFF_WINDOW);
  if (buffer.length > 0 && !window.includes(0x00)) {
    return 'text/plain';
  }
  return null;
}

/** Fenêtre de fin de fichier où l'on cherche le marqueur `%%EOF` (des octets parasites après le dernier
 *  `%%EOF` sont courants : sauts de ligne, signatures de certains logiciels). */
const PDF_EOF_WINDOW = 1024;
const PDF_HEADER_RE = /^%PDF-[12]\.\d/;

/**
 * Contrôle d'ENVELOPPE pour un fichier déjà détecté PDF par sa signature magique (AD-6, FR-15) : en-tête
 * `%PDF-1.x` / `%PDF-2.x` et marqueur `%%EOF` dans les derniers octets — ce qui écarte un fichier tronqué
 * ou un binaire quelconque préfixé de `%PDF-`. Coût constant, quelle que soit la taille du fichier.
 *
 * Volontairement PAS d'analyse complète (l'ancienne version appelait `PDFDocument.load()` +
 * `getPageCount()`) : pdf-lib parcourt l'arbre de pages sans mémoriser les nœuds déjà vus, si bien qu'un
 * PDF de quelques Ko dont l'arbre est un graphe partagé (chaque nœud cite plusieurs fois le même enfant)
 * fait exploser le parcours — et une bombe de décompression dans un flux d'objets fait de même avec la
 * mémoire. Le calcul étant synchrone, il gelait toute l'API (revue de sécurité 2026-11). Un PDF corrompu
 * mais bien enveloppé passe désormais : sans conséquence, le serveur ne l'ouvre jamais, il ne fait que le
 * servir en téléchargement.
 */
export function hasValidPdfEnvelope(buffer: Buffer): boolean {
  if (!PDF_HEADER_RE.test(buffer.subarray(0, 8).toString('latin1'))) return false;
  return buffer
    .subarray(Math.max(0, buffer.length - PDF_EOF_WINDOW))
    .includes('%%EOF', 0, 'latin1');
}

export function extensionForDocumentMime(mime: DetectedDocumentMime): string {
  return MIME_EXTENSION[mime];
}

const EXTENSION_MIME: Record<string, DetectedDocumentMime> = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
};

export function mimeForExtension(ext: string): DetectedDocumentMime | null {
  return EXTENSION_MIME[ext.toLowerCase()] ?? null;
}

/**
 * Un nom de fichier de document légitime est toujours `<uuid v4>.<ext connue>` (généré par
 * `randomUUID()` côté serveur, cf. `writeDocumentFile`). Validé avant tout accès disque en
 * défense en profondeur contre un nom corrompu contenant `../` ou un séparateur de chemin.
 */
const DOCUMENT_FILENAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|txt)$/i;

export function isValidDocumentFilename(filename: string): boolean {
  return DOCUMENT_FILENAME_RE.test(filename);
}
