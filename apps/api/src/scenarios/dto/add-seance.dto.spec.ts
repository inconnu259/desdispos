import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AddSeanceDto } from './add-seance.dto';

async function check(payload: object) {
  return validate(plainToInstance(AddSeanceDto, payload));
}

describe('AddSeanceDto (Story 47.1)', () => {
  it('corps vide → valide (1 créneau)', async () => {
    expect(await check({})).toHaveLength(0);
  });

  it.each([1, 3, 45])('%i créneaux → valide', async (durationSlots) => {
    expect(await check({ durationSlots })).toHaveLength(0);
  });

  it('plus de 45 créneaux → refusé avec le message des 15 jours', async () => {
    const errors = await check({ durationSlots: 46 });
    expect(errors.flatMap((e) => Object.values(e.constraints ?? {}))).toContain(
      '15 jours au plus : au-delà, créez deux rendez-vous.',
    );
  });

  it.each([0, -1, 1.5])('durée %s → refusée', async (durationSlots) => {
    expect(await check({ durationSlots })).toHaveLength(1);
  });
});
