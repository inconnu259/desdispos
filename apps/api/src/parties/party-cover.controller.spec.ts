// PartyCoverController -> get-cover.dto.ts -> import RUNTIME (pas `import type`) de
// LIST_VIEW_MODES depuis @desdispos/shared (ESM, non transformé par ts-jest) — même piège déjà
// documenté pour GAME_SYSTEMS (parties.controller.spec.ts) et THEMES (account.controller.spec.ts).
jest.mock('@desdispos/shared', () => ({
  LIST_VIEW_MODES: ['large', 'medium', 'compact'],
}));

import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PartyCoverController } from './party-cover.controller';
import { PartiesService } from './parties.service';

const VALID_ID = '11111111-1111-1111-1111-111111111111';

function makePartiesService() {
  return {
    setCoverImage: jest.fn(),
    removeCoverImage: jest.fn(),
    getCoverFile: jest.fn(),
  };
}

describe('PartyCoverController — pipeline HTTP réel (Story 29.12, Task 9)', () => {
  let app: INestApplication;
  let parties: ReturnType<typeof makePartiesService>;

  beforeEach(async () => {
    parties = makePartiesService();
    const module = await Test.createTestingModule({
      controllers: [PartyCoverController],
      providers: [{ provide: PartiesService, useValue: parties }],
    })
      .overrideGuard(AuthenticatedGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{ user?: unknown }>();
          req.user = { id: 'u1' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('AC4 : joueur non-MJ → refus (403) sur PUT, le service reflète la garde getOwned', async () => {
    parties.setCoverImage.mockRejectedValue(new ForbiddenException());

    await request(app.getHttpServer())
      .put(`/parties/${VALID_ID}/cover`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'cover.jpg')
      .expect(403);
  });

  it('AC4 : joueur non-MJ → refus (403) sur DELETE, le service reflète la garde getOwned', async () => {
    parties.removeCoverImage.mockRejectedValue(new ForbiddenException());

    await request(app.getHttpServer()).delete(`/parties/${VALID_ID}/cover`).expect(403);
  });

  it('AC8 : non-membre → refus (403) sur GET, le service reflète la garde getViewable', async () => {
    parties.getCoverFile.mockRejectedValue(new ForbiddenException());

    await request(app.getHttpServer())
      .get(`/parties/${VALID_ID}/cover`)
      .query({ mode: 'large' })
      .expect(403);
  });

  it('AC6 : fichier de 6 Mo → 413 via le pipeline HTTP réel (multer + ParseFilePipe), service jamais appelé', async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 0xff);

    await request(app.getHttpServer())
      .put(`/parties/${VALID_ID}/cover`)
      .attach('file', oversized, 'cover.jpg')
      .expect(413);

    expect(parties.setCoverImage).not.toHaveBeenCalled();
  });

  it('fichier de taille valide → PartiesService.setCoverImage est appelé, 200', async () => {
    parties.setCoverImage.mockResolvedValue({
      id: VALID_ID,
      coverImageVersion: 'x',
    });

    await request(app.getHttpServer())
      .put(`/parties/${VALID_ID}/cover`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'cover.jpg')
      .expect(200);

    expect(parties.setCoverImage).toHaveBeenCalled();
  });

  it("fichier qui n'est pas une image (octets magiques invalides, même avec un Content-Type déclaré image/png) → 400", async () => {
    parties.setCoverImage.mockRejectedValue(
      new BadRequestException("Le fichier fourni n'est pas une image JPEG/PNG/WEBP valide"),
    );

    await request(app.getHttpServer())
      .put(`/parties/${VALID_ID}/cover`)
      .attach('file', Buffer.from('not an image'), {
        filename: 'cover.png',
        contentType: 'image/png',
      })
      .expect(400);
  });

  it('AC9 : mode hors union fermée → 400, jamais interprété comme une dimension', async () => {
    await request(app.getHttpServer())
      .get(`/parties/${VALID_ID}/cover`)
      .query({ mode: 'huge' })
      .expect(400);

    expect(parties.getCoverFile).not.toHaveBeenCalled();
  });

  it('coverImageUrl corrompu en base (le service ne trouve rien à servir) → 404, jamais un accès disque non gardé', async () => {
    parties.getCoverFile.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get(`/parties/${VALID_ID}/cover`)
      .query({ mode: 'large' })
      .expect(404);
  });

  it('Review Findings : le 404 ne porte JAMAIS le Cache-Control immuable — un fichier disparu du disque (CAP-20) ne doit pas être mémorisé un an par le navigateur', async () => {
    parties.getCoverFile.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .get(`/parties/${VALID_ID}/cover`)
      .query({ mode: 'large' })
      .expect(404);

    expect(res.headers['cache-control'] ?? '').not.toContain('immutable');
  });

  it('GET valide → 200 avec le buffer/mime du service, Cache-Control immuable posé', async () => {
    parties.getCoverFile.mockResolvedValue({
      buffer: Buffer.from('bytes'),
      mime: 'image/webp',
      version: 'stem-1',
    });

    const res = await request(app.getHttpServer())
      .get(`/parties/${VALID_ID}/cover`)
      .query({ mode: 'medium' })
      .expect(200);

    expect(res.headers['cache-control']).toContain('immutable');
    // Revue de sécurité : réservée aux membres connectés, jamais gardée par un cache partagé.
    expect(res.headers['cache-control']).toMatch(/^private/);
    expect(res.headers['etag']).toBeDefined();
  });
});
