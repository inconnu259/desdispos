import { join } from 'node:path';
import { extractUploadFilename } from '../common/image-upload.util';
import { UPLOADS_ROOT } from '../common/uploads-root';

export const PORTRAITS_DIR = join(UPLOADS_ROOT, 'portraits');
export const PORTRAITS_URL_PREFIX = '/uploads/portraits/';

/**
 * Un `portraitUrl` corrompu (édité manuellement, migration ratée) ne doit jamais atteindre
 * `unlink`/`readFile` avec un chemin non validé — défense en profondeur contre un path traversal
 * (AD-17, `extractUploadFilename` générique paramétré par le préfixe du domaine portrait).
 */
export function extractPortraitFilename(portraitUrl: string | null): string | null {
  return extractUploadFilename(portraitUrl, PORTRAITS_URL_PREFIX);
}
