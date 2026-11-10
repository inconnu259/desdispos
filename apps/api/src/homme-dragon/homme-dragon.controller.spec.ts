jest.mock('@master-jdr/game-rules', () => ({
  validateHommeDragon: jest.fn(),
}));

import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { HommeDragonController } from './homme-dragon.controller';
import { HommeDragonService } from './homme-dragon.service';
import { HommeDragonModule } from './homme-dragon.module';
import type { CreateHommeDragonDto } from '@master-jdr/shared';

const PARTIE_ID = '11111111-1111-4111-8111-111111111111';
const HD_ID = '22222222-2222-4222-8222-222222222222';

function makeService() {
  return {
    create: jest.fn(),
    findForPartie: jest.fn(),
    link: jest.fn(),
    unlink: jest.fn(),
  };
}

describe('HommeDragonController (parties/:id/homme-dragon, AD-23)', () => {
  let controller: HommeDragonController;
  let service: ReturnType<typeof makeService>;

  beforeEach(async () => {
    service = makeService();
    const module = await Test.createTestingModule({
      controllers: [HommeDragonController],
      providers: [{ provide: HommeDragonService, useValue: service }],
    }).compile();
    controller = module.get(HommeDragonController);
  });

  it('câblage : chemin parties/:id/homme-dragon, AuthenticatedGuard, déclaré dans HommeDragonModule', () => {
    expect(Reflect.getMetadata('path', HommeDragonController)).toBe('parties/:id/homme-dragon');
    expect(Reflect.getMetadata('__guards__', HommeDragonController)).toContain(AuthenticatedGuard);
    expect(Reflect.getMetadata('controllers', HommeDragonModule)).toContain(HommeDragonController);
  });

  it('POST délègue à create() avec partieId/user.id/dto (crée et lie)', () => {
    const dto = {
      race: 'DRAGON_ROUGE',
      artefact: { key: 'grand-arc' },
      nom: 'Ignis',
    } as unknown as CreateHommeDragonDto;
    controller.create('p1', { id: 'mj1' } as never, dto);
    expect(service.create).toHaveBeenCalledWith('p1', 'mj1', dto);
  });

  it('GET délègue à findForPartie() avec partieId/user.id', () => {
    controller.findForPartie('p1', { id: 'mj1' } as never);
    expect(service.findForPartie).toHaveBeenCalledWith('p1', 'mj1');
  });

  it('PUT :hommeDragonId délègue à link() avec partieId/hommeDragonId/user.id', () => {
    controller.link('p1', 'hd1', { id: 'mj1' } as never);
    expect(service.link).toHaveBeenCalledWith('p1', 'hd1', 'mj1');
  });

  it('DELETE :hommeDragonId délègue à unlink() avec partieId/hommeDragonId/user.id', () => {
    controller.unlink('p1', 'hd1', { id: 'mj1' } as never);
    expect(service.unlink).toHaveBeenCalledWith('p1', 'hd1', 'mj1');
  });

  describe('HTTP réel (ValidationPipe global)', () => {
    let app: INestApplication;
    const URL = `/parties/${PARTIE_ID}/homme-dragon`;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        controllers: [HommeDragonController],
        providers: [{ provide: HommeDragonService, useValue: service }],
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
        new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
      );
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('PUT puis DELETE : identifiants valides délégués au service', async () => {
      service.link.mockResolvedValue({ id: HD_ID });
      service.unlink.mockResolvedValue({ id: HD_ID });

      await request(app.getHttpServer()).put(`${URL}/${HD_ID}`).expect(200);
      expect(service.link).toHaveBeenCalledWith(PARTIE_ID, HD_ID, 'u1');

      await request(app.getHttpServer()).delete(`${URL}/${HD_ID}`).expect(200);
      expect(service.unlink).toHaveBeenCalledWith(PARTIE_ID, HD_ID, 'u1');
    });

    it('identifiant d’Homme Dragon mal formé → 400, rien délégué', async () => {
      await request(app.getHttpServer()).put(`${URL}/pas-un-uuid`).expect(400);
      await request(app.getHttpServer()).delete(`${URL}/pas-un-uuid`).expect(400);

      expect(service.link).not.toHaveBeenCalled();
      expect(service.unlink).not.toHaveBeenCalled();
    });

    it('partie déjà pourvue → 409 ; Homme Dragon étranger → 404 ; non-MJ → 403', async () => {
      service.link.mockRejectedValueOnce(new ConflictException());
      await request(app.getHttpServer()).put(`${URL}/${HD_ID}`).expect(409);

      service.link.mockRejectedValueOnce(new NotFoundException());
      await request(app.getHttpServer()).put(`${URL}/${HD_ID}`).expect(404);

      service.link.mockRejectedValueOnce(new ForbiddenException());
      await request(app.getHttpServer()).put(`${URL}/${HD_ID}`).expect(403);
    });

    it('GET renvoie { id, nom } ou null', async () => {
      service.findForPartie.mockResolvedValueOnce({ id: HD_ID, nom: 'Ignis' });
      const lie = await request(app.getHttpServer()).get(URL).expect(200);
      expect(lie.body).toEqual({ id: HD_ID, nom: 'Ignis' });

      service.findForPartie.mockResolvedValueOnce(null);
      await request(app.getHttpServer()).get(URL).expect(200);
      expect(service.findForPartie).toHaveBeenLastCalledWith(PARTIE_ID, 'u1');
    });

    it('les anciennes routes de la fiche par partie n’existent plus (PATCH, eveil-power, reserve, export.pdf → 404)', async () => {
      await request(app.getHttpServer()).patch(URL).send({ nom: 'x' }).expect(404);
      await request(app.getHttpServer()).post(`${URL}/eveil-power`).send({}).expect(404);
      await request(app.getHttpServer()).put(`${URL}/reserve/1`).send({ key: 'a' }).expect(404);
      await request(app.getHttpServer()).get(`${URL}/export.pdf`).expect(404);
    });
  });
});
