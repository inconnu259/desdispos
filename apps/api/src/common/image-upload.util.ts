import sharp from 'sharp';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Utilitaire d'upload d'image partagé (AD-17, Story 29.12) — EXTRAIT du code de portrait de
 * personnage (Story 16.2). Mécanismes de sécurité, pas hygiène de code : validation par octets
 * magiques, nettoyage EXIF, gardes anti-traversée de chemin. Transportés tels quels depuis
 * `characters/image-mime.util.ts`/`portrait-storage.util.ts`, jamais réécrits au passage.
 *
 * Ce que ce fichier NE porte PAS (AD-17, verbatim) :
 * - le plafond de taille (5 Mo) : redéclaré dans les décorateurs de chaque contrôleur, jamais
 *   factorisé ici — les décorateurs sont évalués à la déclaration de la classe ;
 * - le verrou optimiste `updatedAt`/l'émission SSE : restent au domaine appelant (personnage,
 *   partie), qui les entoure autour de ces fonctions.
 */

export type DetectedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const MIME_EXTENSION: Record<DetectedImageMime, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const EXTENSION_MIME: Record<string, DetectedImageMime> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Détecte le type réel d'une image par ses octets magiques (signatures binaires), jamais par
 * l'extension du fichier ni le `Content-Type` déclaré par le client (les deux sont trivialement
 * falsifiables). Retourne `null` si le buffer ne correspond à aucun des 3 formats acceptés.
 */
export function detectImageMime(buffer: Buffer): DetectedImageMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Nettoie les métadonnées EXIF/XMP/IPTC (position GPS notamment) d'une image avant stockage.
 * sharp() les retire déjà par défaut au toBuffer() — mais retire aussi le tag EXIF Orientation,
 * qui détermine la rotation visuelle correcte d'une photo prise en mode portrait sur mobile.
 * autoOrient() applique cette rotation dans les pixels AVANT que le tag ne soit supprimé, pour ne
 * pas régresser visuellement les photos EXIF-orientées. Préserve le format d'entrée (JPEG reste
 * JPEG, etc.) — aucun appel à toFormat()/jpeg(). Pour une image animée (WEBP/PNG multi-frames),
 * seule la première frame est conservée (comportement par défaut de sharp, aucune option
 * `{ animated: true }` passée) — acceptable ici car un portrait/une couverture est attendu comme
 * une image statique.
 */
export async function stripImageMetadata(
  buffer: Buffer,
  options: { maxDimension?: number } = {},
): Promise<Buffer> {
  const image = openImage(buffer).autoOrient();
  // Optionnel : ramène le plus grand côté à `maxDimension` (jamais d'agrandissement). Les portraits n'ont
  // aucune raison d'être stockés en 6000 px — et l'export PDF de la fiche les redécode à chaque fois.
  if (options.maxDimension) {
    image.resize({
      width: options.maxDimension,
      height: options.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  return image.toBuffer();
}

/**
 * Nombre maximal de pixels qu'on accepte de DÉCODER. Une image de 5 Mo peut déclarer des dimensions
 * énormes (PNG très compressible : 20 000 × 20 000 px tiennent dans quelques Mo) et réclamer plus d'1 Go
 * de mémoire au décodage — le défaut de sharp (~268 Mpx) le laisse passer. 50 Mpx couvre toute photo de
 * téléphone qui tient dans la limite de 5 Mo.
 */
export const MAX_IMAGE_INPUT_PIXELS = 50_000_000;

/** Point d'entrée UNIQUE vers sharp pour une image envoyée par un utilisateur : plafond de pixels. */
export function openImage(buffer: Buffer): sharp.Sharp {
  return sharp(buffer, { limitInputPixels: MAX_IMAGE_INPUT_PIXELS });
}

export function extensionForImageMime(mime: DetectedImageMime): string {
  return MIME_EXTENSION[mime];
}

export function mimeForExtension(ext: string): DetectedImageMime | null {
  return EXTENSION_MIME[ext.toLowerCase()] ?? null;
}

/**
 * Un nom de fichier d'upload légitime est TOUJOURS `<uuid v4>.<ext connue>` (généré par
 * `randomUUID()` côté serveur, cf. `writeUploadFile`). Validé avant tout accès disque
 * (`unlink`/`readFile`) en défense en profondeur contre une URL corrompue qui contiendrait `../`
 * ou un séparateur de chemin. Même motif pour tous les domaines (portraits, couvertures) — il n'a
 * jamais eu besoin d'être spécifique à l'un d'eux.
 */
const UPLOAD_FILENAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

export function isValidUploadFilename(filename: string): boolean {
  return UPLOAD_FILENAME_RE.test(filename);
}

/**
 * Extrait un nom de fichier validé d'une URL stockée en base, pour un domaine donné (préfixe
 * d'URL paramétré — `/uploads/portraits/`, `/uploads/covers/`, …). Retourne `null` si l'URL est
 * absente, ne porte pas le préfixe attendu, ou si le nom de fichier extrait n'a pas la forme
 * `<uuid>.<ext>` attendue (défense en profondeur).
 */
export function extractUploadFilename(fileUrl: string | null, urlPrefix: string): string | null {
  if (!fileUrl || !fileUrl.startsWith(urlPrefix)) return null;
  const filename = fileUrl.slice(urlPrefix.length);
  return isValidUploadFilename(filename) ? filename : null;
}

/**
 * Écrit un buffer déjà validé/nettoyé sous un nom `<uuid v4>.<ext>` dans le dossier `dir`, en le
 * créant si besoin. Remonté depuis `character.service.ts` (Story 29.12, AD-17) — l'écriture disque
 * faisait partie de ce qui devait être extrait, pas seulement la validation/le nettoyage.
 */
export async function writeUploadFile(
  dir: string,
  buffer: Buffer,
  mime: DetectedImageMime,
): Promise<string> {
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${extensionForImageMime(mime)}`;
  await writeFile(join(dir, filename), buffer);
  return filename;
}

/**
 * Supprime un fichier d'upload déjà nommé (pas d'URL brute — l'appelant a déjà validé/extrait le
 * nom). Ne capture aucune erreur : l'appelant décide comment réagir (log + continuer, comme le
 * font `character.service.ts`/`parties.service.ts` pour un fichier orphelin déjà disparu).
 */
export async function unlinkUploadFile(dir: string, filename: string): Promise<void> {
  await unlink(join(dir, filename));
}
