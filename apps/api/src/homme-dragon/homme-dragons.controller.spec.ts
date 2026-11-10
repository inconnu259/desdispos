jest.mock('@master-jdr/game-rules', () => ({
  validateHommeDragon: jest.fn(),
}));

import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { HommeDragonSheetController } from './homme-dragons.controller';
import { HommeDragonService } from './homme-dragon.service';
import { HommeDragonPdfService } from './homme-dragon.pdf.service';
import { HommeDragonModule } from './homme-dragon.module';
import type { ChooseEveilPowerDto } from './dto/choose-eveil-power.dto';
import type { HommeDragonDto, UpdateHommeDragonDto } from '@master-jdr/shared';

const ID = '11111111-1111-4111-8111-111111111111';

function makeService() {
  return {
    update: jest.fn(),
    findOne: jest.fn(),
    chooseEveilPower: jest.fn(),
    chooseArtefactCadeau: jest.fn(),
    setReserveSlot: jest.fn(),
    getOwnerPseudo: jest.fn(),
  };
}

function makePdfService() {
  return {
    fillHommeDragonPdf: jest.fn(),
  };
}

describe('HommeDragonSheetController (homme-dragons/:id, AD-23)', () => {
  let controller: HommeDragonSheetController;
  let service: ReturnType<typeof makeService>;
  let pdfService: ReturnType<typeof makePdfService>;

  beforeEach(async () => {
    service = makeService();
    pdfService = makePdfService();
    const module = await Test.createTestingModule({
      controllers: [HommeDragonSheetController],
      providers: [
        { provide: HommeDragonService, useValue: service },
        { provide: HommeDragonPdfService, useValue: pdfService },
      ],
    }).compile();
    controller = module.get(HommeDragonSheetController);
  });

  it('câblage : chemin homme-dragons/:id, AuthenticatedGuard, déclaré dans HommeDragonModule', () => {
    expect(Reflect.getMetadata('path', HommeDragonSheetController)).toBe('homme-dragons/:id');
    expect(Reflect.getMetadata('__guards__', HommeDragonSheetController)).toContain(
      AuthenticatedGuard,
    );
    expect(Reflect.getMetadata('controllers', HommeDragonModule)).toContain(
      HommeDragonSheetController,
    );
  });

  it('GET délègue à findOne() avec id/user.id', () => {
    controller.findOne(ID, { id: 'u1' } as never);
    expect(service.findOne).toHaveBeenCalledWith(ID, 'u1');
  });

  it('PATCH délègue à update() avec id/user.id/dto', () => {
    const dto = { demeure: 'Une auberge' } as UpdateHommeDragonDto;
    controller.update(ID, { id: 'mj1' } as never, dto);
    expect(service.update).toHaveBeenCalledWith(ID, 'mj1', dto);
  });

  it('PUT reserve/:slot délègue à setReserveSlot() avec id/user.id/slot/dto', () => {
    controller.setReserveSlot(ID, 3, { id: 'mj1' } as never, { key: 'chance' });
    expect(service.setReserveSlot).toHaveBeenCalledWith(ID, 'mj1', 3, { key: 'chance' });
  });

  it('POST eveil-power délègue à chooseEveilPower() avec id/user.id/dto', () => {
    const dto: ChooseEveilPowerDto = { level: 2, key: 'escorte-du-dragon' };
    controller.chooseEveilPower(ID, { id: 'mj1' } as never, dto);
    expect(service.chooseEveilPower).toHaveBeenCalledWith(ID, 'mj1', dto);
  });

  it('POST artefact-cadeau délègue à chooseArtefactCadeau() avec id/user.id/dto (Story 33.7)', () => {
    const dto = { key: 'lanterne' };
    controller.chooseArtefactCadeau(ID, { id: 'mj1' } as never, dto);
    expect(service.chooseArtefactCadeau).toHaveBeenCalledWith(ID, 'mj1', dto);
  });

  describe('exportPdf()', () => {
    it('résout la fiche/le pseudo MJ puis délègue à fillHommeDragonPdf()', async () => {
      const hommeDragon = { userId: 'mj1' } as unknown as HommeDragonDto;
      service.findOne.mockResolvedValue(hommeDragon);
      service.getOwnerPseudo.mockResolvedValue('admin');
      pdfService.fillHommeDragonPdf.mockResolvedValue(Buffer.from('pdf'));

      const result = await controller.exportPdf(ID, { format: 'editable' }, { id: 'u1' } as never);

      expect(service.findOne).toHaveBeenCalledWith(ID, 'u1');
      expect(service.getOwnerPseudo).toHaveBeenCalledWith('mj1');
      expect(pdfService.fillHommeDragonPdf).toHaveBeenCalledWith(hommeDragon, 'admin', 'editable');
      expect(result.getStream()).toBeDefined();
    });

    it("transmet le format '2pages' au service ; le nom du fichier est fondé sur l'id de l'Homme Dragon", async () => {
      const hommeDragon = { userId: 'mj1' } as unknown as HommeDragonDto;
      service.findOne.mockResolvedValue(hommeDragon);
      service.getOwnerPseudo.mockResolvedValue('admin');
      pdfService.fillHommeDragonPdf.mockResolvedValue(Buffer.from('pdf'));

      const result = await controller.exportPdf(ID, { format: '2pages' }, { id: 'u1' } as never);

      expect(pdfService.fillHommeDragonPdf).toHaveBeenCalledWith(hommeDragon, 'admin', '2pages');
      expect(result.getHeaders().disposition).toBe(
        `attachment; filename="homme-dragon-${ID}-2pages.pdf"`,
      );
    });

    it('fiche absente ou étrangère (404 du service) → propagé, jamais un PDF', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        controller.exportPdf(ID, { format: 'editable' }, { id: 'u1' } as never),
      ).rejects.toThrow(NotFoundException);
      expect(pdfService.fillHommeDragonPdf).not.toHaveBeenCalled();
      expect(service.getOwnerPseudo).not.toHaveBeenCalled();
    });
  });

  describe('validation HTTP réelle (ValidationPipe global)', () => {
    let app: INestApplication;
    const SHEET_URL = `/homme-dragons/${ID}`;
    const EXPORT_URL = `${SHEET_URL}/export.pdf`;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        controllers: [HommeDragonSheetController],
        providers: [
          { provide: HommeDragonService, useValue: service },
          { provide: HommeDragonPdfService, useValue: pdfService },
        ],
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

      service.findOne.mockResolvedValue({ userId: 'mj1' });
      service.getOwnerPseudo.mockResolvedValue('admin');
      pdfService.fillHommeDragonPdf.mockResolvedValue(Buffer.from('pdf-bytes'));
    });

    afterEach(async () => {
      await app.close();
    });

    it('format absent → 400 via le pipeline HTTP réel', async () => {
      await request(app.getHttpServer()).get(EXPORT_URL).expect(400);

      expect(pdfService.fillHommeDragonPdf).not.toHaveBeenCalled();
    });

    it('format inconnu (1page) → 400 via le pipeline HTTP réel', async () => {
      await request(app.getHttpServer()).get(EXPORT_URL).query({ format: '1page' }).expect(400);

      expect(pdfService.fillHommeDragonPdf).not.toHaveBeenCalled();
    });

    it.each(['editable', '2pages'])('format=%s → 200 via le pipeline HTTP réel', async (format) => {
      await request(app.getHttpServer()).get(EXPORT_URL).query({ format }).expect(200);

      expect(service.findOne).toHaveBeenCalledWith(ID, 'u1');
      expect(pdfService.fillHommeDragonPdf).toHaveBeenCalledWith(
        { userId: 'mj1' },
        'admin',
        format,
      );
    });

    it("identifiant mal formé → 400 (ParseUUIDPipe), jamais d'appel au service", async () => {
      await request(app.getHttpServer()).get('/homme-dragons/pas-un-uuid').expect(400);

      expect(service.findOne).not.toHaveBeenCalled();
    });

    it("PATCH avec artefactCadeau → 400 : le cadeau n'est jamais modifiable par PATCH (Story 33.7)", async () => {
      await request(app.getHttpServer())
        .patch(SHEET_URL)
        .send({ artefactCadeau: { key: 'lanterne' } })
        .expect(400);

      expect(service.update).not.toHaveBeenCalled();
    });

    it("PATCH avec reserve → 400 : la réserve n'est jamais écrite par le PATCH générique (Story 33.6)", async () => {
      await request(app.getHttpServer())
        .patch(SHEET_URL)
        .send({ reserve: ['chance'] })
        .expect(400);

      expect(service.update).not.toHaveBeenCalled();
    });

    it('PUT reserve/:slot : corps invalide → 400, rien délégué', async () => {
      const url = `${SHEET_URL}/reserve`;
      for (const body of [{}, { key: '' }, { key: 42 }, { key: 'chance', extra: 1 }]) {
        await request(app.getHttpServer()).put(`${url}/1`).send(body).expect(400);
      }
      // Numéro d'emplacement non entier.
      await request(app.getHttpServer()).put(`${url}/abc`).send({ key: 'chance' }).expect(400);
      expect(service.setReserveSlot).not.toHaveBeenCalled();
    });

    it('PUT reserve/:slot : { key } place, { key: null } retire — numéro 1-based délégué au service', async () => {
      const url = `${SHEET_URL}/reserve`;

      await request(app.getHttpServer()).put(`${url}/2`).send({ key: 'chance' }).expect(200);
      expect(service.setReserveSlot).toHaveBeenLastCalledWith(ID, 'u1', 2, { key: 'chance' });

      await request(app.getHttpServer()).put(`${url}/2`).send({ key: null }).expect(200);
      expect(service.setReserveSlot).toHaveBeenLastCalledWith(ID, 'u1', 2, { key: null });
    });

    it('POST artefact-cadeau sans clé → 400 ; avec clé → délègue au service', async () => {
      const url = `${SHEET_URL}/artefact-cadeau`;
      await request(app.getHttpServer()).post(url).send({}).expect(400);
      expect(service.chooseArtefactCadeau).not.toHaveBeenCalled();

      await request(app.getHttpServer()).post(url).send({ key: 'lanterne' }).expect(201);
      expect(service.chooseArtefactCadeau).toHaveBeenCalledWith(ID, 'u1', { key: 'lanterne' });
    });

    it('Homme Dragon absent ou étranger : GET fiche et export PDF → 404 identique, aucune donnée ni PDF (jamais 403)', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Homme Dragon introuvable'));

      const fiche = await request(app.getHttpServer()).get(SHEET_URL).expect(404);
      const pdf = await request(app.getHttpServer())
        .get(EXPORT_URL)
        .query({ format: 'editable' })
        .expect(404);

      expect(fiche.body).toEqual(pdf.body);
      expect(pdfService.fillHommeDragonPdf).not.toHaveBeenCalled();
      expect(service.getOwnerPseudo).not.toHaveBeenCalled();
    });
  });
});
