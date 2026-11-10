import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateSeancePollDto } from '../../scenarios/dto/create-seance-poll.dto';
import { SetPollOptionsDto } from './set-poll-options.dto';

const OPTIONS = [
  { date: '2099-01-02T00:00:00.000Z', slot: 'EVENING' },
  { date: '2099-01-09T00:00:00.000Z', slot: 'EVENING' },
];

/** Story 47.4 — la durée portée par `PUT …/options` et `POST …/seances/:id/poll` : optionnelle, 1 à 45. */
describe.each([
  ['SetPollOptionsDto', SetPollOptionsDto],
  ['CreateSeancePollDto', CreateSeancePollDto],
] as const)('%s — durationSlots (Story 47.4)', (_name, Dto) => {
  async function errorsOf(payload: object) {
    const errors = await validate(plainToInstance(Dto, payload));
    return {
      properties: errors.map((e) => e.property),
      messages: errors.flatMap((e) => Object.values(e.constraints ?? {})),
    };
  }

  it('absente → valide (durée inchangée)', async () => {
    expect((await errorsOf({ options: OPTIONS })).properties).toEqual([]);
  });

  it.each([1, 6, 45])('%i créneaux → valide', async (durationSlots) => {
    expect((await errorsOf({ options: OPTIONS, durationSlots })).properties).toEqual([]);
  });

  it('plus de 45 créneaux → refusé avec le message des 15 jours', async () => {
    const { properties, messages } = await errorsOf({ options: OPTIONS, durationSlots: 46 });
    expect(properties).toEqual(['durationSlots']);
    expect(messages).toContain('15 jours au plus : au-delà, créez deux rendez-vous.');
  });

  it.each([0, -2, 1.5, '3'])(
    'durée « %s » → refusée, message en français',
    async (durationSlots) => {
      const { properties, messages } = await errorsOf({ options: OPTIONS, durationSlots });
      expect(properties).toEqual(['durationSlots']);
      expect(messages).toContain('La durée doit être un entier d’au moins 1 créneau');
    },
  );
});
