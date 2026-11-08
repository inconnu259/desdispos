import { PDFDocument } from 'pdf-lib';
import {
  detectDocumentMime,
  extensionForDocumentMime,
  hasValidPdfEnvelope,
  isValidDocumentFilename,
  mimeForExtension,
} from './document-mime.util';

describe('detectDocumentMime', () => {
  it('détecte un PDF par sa signature magique %PDF-', () => {
    const buffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj');
    expect(detectDocumentMime(buffer)).toBe('application/pdf');
  });

  it('détecte un texte brut sans byte NUL', () => {
    const buffer = Buffer.from('Le marchand Ossian propose un pacte...', 'utf8');
    expect(detectDocumentMime(buffer)).toBe('text/plain');
  });

  it('rejette un buffer binaire arbitraire contenant un byte NUL (ex. faux .txt)', () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
    expect(detectDocumentMime(buffer)).toBeNull();
  });

  it('rejette un buffer vide', () => {
    expect(detectDocumentMime(Buffer.alloc(0))).toBeNull();
  });

  it('rejette un buffer JPEG (signature image, pas document)', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    // Un JPEG contient des bytes NUL rapidement dans son en-tête → correctement rejeté
    expect(detectDocumentMime(buffer)).toBeNull();
  });
});

describe('hasValidPdfEnvelope', () => {
  it('accepte un PDF réellement structuré (généré par pdf-lib lui-même)', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const buffer = Buffer.from(await doc.save());
    expect(hasValidPdfEnvelope(buffer)).toBe(true);
  });

  it('accepte des octets parasites après le dernier %%EOF', () => {
    expect(hasValidPdfEnvelope(Buffer.from('%PDF-1.7\n1 0 obj\n%%EOF\r\n\n  '))).toBe(true);
  });

  it('rejette un fichier tronqué (pas de %%EOF en fin de fichier)', () => {
    const buffer = Buffer.from('%PDF-1.4\n' + 'garbage'.repeat(500));
    expect(hasValidPdfEnvelope(buffer)).toBe(false);
  });

  it('rejette un %%EOF enfoui loin de la fin (binaire quelconque préfixé de %PDF-)', () => {
    const buffer = Buffer.concat([Buffer.from('%PDF-1.4\n%%EOF\n'), Buffer.alloc(4096, 0x41)]);
    expect(hasValidPdfEnvelope(buffer)).toBe(false);
  });

  it('rejette une version d’en-tête absurde et un buffer vide', () => {
    expect(hasValidPdfEnvelope(Buffer.from('%PDF-x\n%%EOF'))).toBe(false);
    expect(hasValidPdfEnvelope(Buffer.alloc(0))).toBe(false);
  });

  it('non-régression DoS : un arbre de pages en graphe partagé est traité en temps constant', () => {
    // 40 niveaux de nœuds /Pages citant chacun DEUX fois le même enfant : 2^40 visites pour un parcours
    // naïf (celui de pdf-lib), ce qui gelait l'API. L'enveloppe ne regarde que l'en-tête et la fin.
    const objects = ['1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj'];
    for (let i = 2; i < 42; i++) {
      objects.push(
        `${i} 0 obj << /Type /Pages /Kids [${i + 1} 0 R ${i + 1} 0 R] /Count 2 >> endobj`,
      );
    }
    objects.push('42 0 obj << /Type /Page >> endobj');
    const buffer = Buffer.from(
      `%PDF-1.7\n${objects.join('\n')}\ntrailer << /Root 1 0 R >>\n%%EOF\n`,
    );
    const start = performance.now();
    expect(hasValidPdfEnvelope(buffer)).toBe(true);
    expect(performance.now() - start).toBeLessThan(50);
  });
});

describe('extensionForDocumentMime / mimeForExtension', () => {
  it('mappe application/pdf ↔ .pdf', () => {
    expect(extensionForDocumentMime('application/pdf')).toBe('.pdf');
    expect(mimeForExtension('.pdf')).toBe('application/pdf');
  });

  it('mappe text/plain ↔ .txt', () => {
    expect(extensionForDocumentMime('text/plain')).toBe('.txt');
    expect(mimeForExtension('.txt')).toBe('text/plain');
  });

  it('mimeForExtension est insensible à la casse', () => {
    expect(mimeForExtension('.PDF')).toBe('application/pdf');
  });

  it('mimeForExtension renvoie null pour une extension inconnue', () => {
    expect(mimeForExtension('.exe')).toBeNull();
  });
});

describe('isValidDocumentFilename', () => {
  it('accepte un nom UUID v4 + extension connue', () => {
    expect(isValidDocumentFilename('550e8400-e29b-41d4-a716-446655440000.pdf')).toBe(true);
    expect(isValidDocumentFilename('550e8400-e29b-41d4-a716-446655440000.txt')).toBe(true);
  });

  it('rejette une tentative de path traversal', () => {
    expect(isValidDocumentFilename('../../etc/passwd')).toBe(false);
  });

  it('rejette une extension non whitelistée', () => {
    expect(isValidDocumentFilename('550e8400-e29b-41d4-a716-446655440000.exe')).toBe(false);
  });

  it('rejette un nom qui ne suit pas le format UUID', () => {
    expect(isValidDocumentFilename('document.pdf')).toBe(false);
  });
});
