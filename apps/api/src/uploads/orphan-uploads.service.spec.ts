import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { OrphanUploadsService, ORPHAN_GRACE_MS } from './orphan-uploads.service';
import type { PrismaService } from '../prisma/prisma.service';
import { PORTRAITS_DIR } from '../characters/portrait-paths';
import { COVERS_DIR } from '../parties/parties.service';
import { DOCUMENTS_DIR } from '../scenarios/document-storage.util';

jest.mock('node:fs/promises', () => ({
  readdir: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
}));

const NOW = 1_800_000_000_000;
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('OrphanUploadsService (revue de sécurité : fichiers des comptes et parties supprimés)', () => {
  let prisma: {
    character: { findMany: jest.Mock };
    partie: { findMany: jest.Mock };
    scenarioDocument: { findMany: jest.Mock };
  };
  let service: OrphanUploadsService;
  const files: Record<string, string[]> = {};
  const ages: Record<string, number> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      character: {
        findMany: jest.fn().mockResolvedValue([{ portraitUrl: `/uploads/portraits/${A}.jpg` }]),
      },
      partie: {
        findMany: jest.fn().mockResolvedValue([{ coverImageUrl: `/uploads/covers/${A}.webp` }]),
      },
      scenarioDocument: { findMany: jest.fn().mockResolvedValue([{ filename: `${A}.pdf` }]) },
    };
    service = new OrphanUploadsService(prisma as unknown as PrismaService);

    files[PORTRAITS_DIR] = [`${A}.jpg`, `${B}.png`, `${C}.webp`, 'notes-perso.txt'];
    files[COVERS_DIR] = [`${A}-large.webp`, `${B}-large.webp`, `${B}-compact.webp`];
    files[DOCUMENTS_DIR] = [`${A}.pdf`, `${B}.txt`];
    for (const dir of Object.keys(files)) {
      for (const name of files[dir]) ages[join(dir, name)] = 2 * ORPHAN_GRACE_MS;
    }
    // Portrait C : envoyé il y a 5 minutes, sa ligne n'est peut-être pas encore écrite.
    ages[join(PORTRAITS_DIR, `${C}.webp`)] = 5 * 60 * 1000;

    (readdir as unknown as jest.Mock).mockImplementation((dir: string) =>
      Promise.resolve(files[dir] ?? []),
    );
    (stat as jest.Mock).mockImplementation((path: string) =>
      Promise.resolve({ mtimeMs: NOW - ages[path] }),
    );
    (unlink as jest.Mock).mockResolvedValue(undefined);
  });

  it('efface les fichiers non référencés de plus d’une heure, et seulement eux', async () => {
    const removed = await service.sweep(NOW);

    const unlinked = (unlink as jest.Mock).mock.calls.map(([p]: [string]) => p).sort();
    expect(unlinked).toEqual(
      [
        join(PORTRAITS_DIR, `${B}.png`),
        join(COVERS_DIR, `${B}-large.webp`),
        join(COVERS_DIR, `${B}-compact.webp`),
        join(DOCUMENTS_DIR, `${B}.txt`),
      ].sort(),
    );
    expect(removed).toBe(4);
  });

  it('dossier absent : rien à faire, aucune erreur', async () => {
    (readdir as unknown as jest.Mock).mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );
    await expect(service.sweep(NOW)).resolves.toBe(0);
  });
});
