jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('node:crypto', () => {
  const actual = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return { ...actual, randomUUID: jest.fn(() => 'fixed-uuid') };
});

import sharp from 'sharp';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import {
  detectImageMime,
  extensionForImageMime,
  extractUploadFilename,
  isValidUploadFilename,
  mimeForExtension,
  stripImageMetadata,
  unlinkUploadFile,
  writeUploadFile,
} from './image-upload.util';

const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP_HEADER = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
]);

describe('detectImageMime', () => {
  it('détecte un JPEG par ses octets magiques (FF D8 FF)', () => {
    expect(detectImageMime(JPEG_HEADER)).toBe('image/jpeg');
  });

  it('détecte un PNG par sa signature complète', () => {
    expect(detectImageMime(PNG_HEADER)).toBe('image/png');
  });

  it('détecte un WEBP (RIFF....WEBP)', () => {
    expect(detectImageMime(WEBP_HEADER)).toBe('image/webp');
  });

  it("rejette un fichier texte (pas d'octets magiques image)", () => {
    expect(detectImageMime(Buffer.from('not an image', 'ascii'))).toBeNull();
  });

  it('rejette un fichier renommé avec une extension .jpg mais un contenu exécutable (MZ, PE header)', () => {
    expect(detectImageMime(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
  });

  it('rejette un buffer trop court pour contenir une signature', () => {
    expect(detectImageMime(Buffer.from([0xff]))).toBeNull();
  });
});

describe('stripImageMetadata', () => {
  it('maxDimension : ramène le plus grand côté, sans jamais agrandir', async () => {
    const big = await sharp({
      create: { width: 3000, height: 1500, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const meta = await sharp(await stripImageMetadata(big, { maxDimension: 1024 })).metadata();
    expect([meta.width, meta.height]).toEqual([1024, 512]);
    expect(meta.format).toBe('png'); // format conservé (l'export PDF n'accepte que JPEG/PNG)

    const small = await sharp({
      create: { width: 100, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();
    const smallMeta = await sharp(
      await stripImageMetadata(small, { maxDimension: 1024 }),
    ).metadata();
    expect([smallMeta.width, smallMeta.height]).toEqual([100, 50]);
  });

  it('revue de sécurité : refuse une image dont les dimensions dépassent le plafond de pixels', async () => {
    // 8000 × 8000 = 64 Mpx > 50 Mpx : PNG uni, quelques dizaines de Ko seulement sur disque.
    const bomb = await sharp({
      create: { width: 8000, height: 8000, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(bomb.length).toBeLessThan(5 * 1024 * 1024);
    await expect(stripImageMetadata(bomb)).rejects.toThrow(/pixel limit/i);
  });

  it("supprime les métadonnées EXIF (GPS) d'une image réelle", async () => {
    const withExif = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .withExif({
        IFD0: { Copyright: 'Test' },
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: '51/1 30/1 3230/100',
          GPSLongitudeRef: 'W',
          GPSLongitude: '0/1 7/1 4366/100',
        },
      })
      .toBuffer();
    const inputMeta = await sharp(withExif).metadata();
    expect(inputMeta.exif).toBeDefined(); // sanity check : l'input a bien des métadonnées

    const cleaned = await stripImageMetadata(withExif);
    const outputMeta = await sharp(cleaned).metadata();
    expect(outputMeta.exif).toBeUndefined();
  });

  it('applique la rotation EXIF aux pixels avant de retirer le tag Orientation', async () => {
    const oriented = await sharp({
      create: {
        width: 8,
        height: 4,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const cleaned = await stripImageMetadata(oriented);
    const meta = await sharp(cleaned).metadata();
    expect(meta.width).toBe(4); // dimensions inversées : la rotation 90° a bien été appliquée
    expect(meta.height).toBe(8);
    expect(meta.orientation).toBeUndefined();
  });

  it("préserve le format d'entrée (JPEG reste JPEG)", async () => {
    const buf = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();
    const cleaned = await stripImageMetadata(buf);
    const meta = await sharp(cleaned).metadata();
    expect(meta.format).toBe('jpeg');
  });

  it('rejette (lève) un buffer avec une signature magique valide mais un contenu indécodable', async () => {
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    await expect(stripImageMetadata(fakeJpeg)).rejects.toThrow();
  });
});

describe('extensionForImageMime', () => {
  it('mappe chaque type détecté vers son extension', () => {
    expect(extensionForImageMime('image/jpeg')).toBe('.jpg');
    expect(extensionForImageMime('image/png')).toBe('.png');
    expect(extensionForImageMime('image/webp')).toBe('.webp');
  });
});

describe('mimeForExtension', () => {
  it('mappe chaque extension connue vers son mime, insensible à la casse', () => {
    expect(mimeForExtension('.jpg')).toBe('image/jpeg');
    expect(mimeForExtension('.PNG')).toBe('image/png');
    expect(mimeForExtension('.webp')).toBe('image/webp');
  });

  it('retourne null pour une extension inconnue', () => {
    expect(mimeForExtension('.gif')).toBeNull();
  });
});

describe('isValidUploadFilename', () => {
  it('accepte un nom de fichier UUID + extension connue (format généré par randomUUID())', () => {
    expect(isValidUploadFilename('11111111-1111-1111-1111-111111111111.jpg')).toBe(true);
  });

  it('rejette un chemin contenant un traversal (../)', () => {
    expect(isValidUploadFilename('../../etc/passwd')).toBe(false);
  });

  it('rejette un nom de fichier ne respectant pas le format UUID', () => {
    expect(isValidUploadFilename('old.jpg')).toBe(false);
  });

  it('rejette une extension non supportée', () => {
    expect(isValidUploadFilename('11111111-1111-1111-1111-111111111111.exe')).toBe(false);
  });
});

describe('extractUploadFilename', () => {
  const PREFIX = '/uploads/portraits/';
  const VALID_FILENAME = '11111111-1111-1111-1111-111111111111.jpg';
  const VALID_URL = `${PREFIX}${VALID_FILENAME}`;

  it('extrait le nom de fichier depuis une URL valide pour le préfixe donné', () => {
    expect(extractUploadFilename(VALID_URL, PREFIX)).toBe(VALID_FILENAME);
  });

  it('retourne null pour une URL nulle', () => {
    expect(extractUploadFilename(null, PREFIX)).toBeNull();
  });

  it("retourne null si l'URL ne commence pas par le préfixe attendu (domaine différent)", () => {
    expect(extractUploadFilename('/uploads/covers/x.jpg', PREFIX)).toBeNull();
  });

  it('retourne null pour un nom de fichier ne respectant pas le format UUID (défense path traversal)', () => {
    expect(extractUploadFilename(`${PREFIX}../../etc/passwd`, PREFIX)).toBeNull();
  });
});

describe('writeUploadFile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée le dossier, écrit le buffer sous un nom <uuid>.<ext> et retourne ce nom', async () => {
    const filename = await writeUploadFile('/uploads/covers', Buffer.from('bytes'), 'image/webp');

    expect(filename).toBe('fixed-uuid.webp');
    expect(mkdir).toHaveBeenCalledWith('/uploads/covers', { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('fixed-uuid.webp'),
      Buffer.from('bytes'),
    );
  });
});

describe('unlinkUploadFile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('supprime le fichier nommé dans le dossier donné', async () => {
    await unlinkUploadFile('/uploads/covers', 'fixed-uuid.webp');
    expect(unlink).toHaveBeenCalledWith(expect.stringContaining('fixed-uuid.webp'));
  });

  it("propage l'erreur si la suppression échoue (l'appelant décide comment réagir)", async () => {
    (unlink as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));
    await expect(unlinkUploadFile('/uploads/covers', 'missing.webp')).rejects.toThrow('ENOENT');
  });
});
