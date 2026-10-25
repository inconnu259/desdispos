import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SlotWindowKeyBody } from './slot-window.dto';

// Story 46.4 — le corps de `PUT` / `DELETE /parties/:id/available-slots/hidden` est la fenêtre telle que servie :
// jour, créneau de départ, durée en créneaux. Tout le reste est refusé en français (400).
describe('SlotWindowKeyBody (Story 46.4)', () => {
  const valid = { date: '2099-03-06', startSlot: 'EVENING', durationSlots: 1 };
  const errorsOf = async (over: Record<string, unknown>) =>
    validate(plainToInstance(SlotWindowKeyBody, { ...valid, ...over }));

  it('accepte une fenêtre telle que le serveur la sert', async () => {
    expect(await errorsOf({})).toHaveLength(0);
  });

  it.each(['MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY'])(
    'accepte le créneau %s',
    async (slot) => {
      expect(await errorsOf({ startSlot: slot })).toHaveLength(0);
    },
  );

  it.each([
    ['une date mal formée', { date: '06/03/2099' }],
    ['une date impossible', { date: '2099-02-31' }],
    ['une date avec une heure', { date: '2099-03-06T00:00:00Z' }],
    ['un créneau inconnu', { startSlot: 'NIGHT' }],
    ['un créneau absent', { startSlot: undefined }],
    ['une durée nulle', { durationSlots: 0 }],
    ['une durée négative', { durationSlots: -1 }],
    ['une durée décimale', { durationSlots: 1.5 }],
    ['une durée au-delà du plafond de 15 jours', { durationSlots: 46 }],
    ['une durée en texte', { durationSlots: '1' }],
  ])('refuse %s', async (_label, over) => {
    const errors = await errorsOf(over);
    expect(errors.length).toBeGreaterThan(0);
    // Messages en français, jamais ceux de class-validator par défaut.
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(messages.every((m) => /fenêtre/i.test(m))).toBe(true);
  });

  it('accepte la durée plafond (45 créneaux)', async () => {
    expect(await errorsOf({ durationSlots: 45 })).toHaveLength(0);
  });
});
