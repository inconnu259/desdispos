import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ExportHommeDragonPdfDto } from './export-homme-dragon-pdf.dto';

describe('ExportHommeDragonPdfDto', () => {
  it.each(['editable', '2pages'])('accepte format=%s', async (format) => {
    const dto = plainToInstance(ExportHommeDragonPdfDto, { format });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejette un format inconnu', async () => {
    const dto = plainToInstance(ExportHommeDragonPdfDto, { format: '1page' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('rejette un format absent', async () => {
    const dto = plainToInstance(ExportHommeDragonPdfDto, {});
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
