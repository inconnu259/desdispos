import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CALENDAR_LAYER_KEYS } from '@master-jdr/shared';
import { UpdatePreferencesDto } from './update-preferences.dto';

async function validateDto(body: Record<string, unknown>) {
  const dto = plainToInstance(UpdatePreferencesDto, body);
  return validate(dto);
}

describe('UpdatePreferencesDto.defaultCalendarLayers (Story 30.4, AC1/AC9)', () => {
  it('absent → valide (préférence non touchée)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('tableau vide → valide (AC3 — tout éteint, distinct d’absent)', async () => {
    const errors = await validateDto({ defaultCalendarLayers: [] });
    expect(errors).toHaveLength(0);
  });

  it('sous-ensemble valide → valide', async () => {
    const errors = await validateDto({
      defaultCalendarLayers: ['mes-seances', 'votes-en-cours'],
    });
    expect(errors).toHaveLength(0);
  });

  it('clé hors union → rejeté', async () => {
    const errors = await validateDto({
      defaultCalendarLayers: ['clé-inventée'],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('defaultCalendarLayers');
  });

  it('plus de 6 éléments (taille de l’union) → rejeté', async () => {
    const errors = await validateDto({
      defaultCalendarLayers: [...CALENDAR_LAYER_KEYS, CALENDAR_LAYER_KEYS[0]],
    });
    expect(errors).toHaveLength(1);
  });

  it('pas un tableau → rejeté', async () => {
    const errors = await validateDto({
      defaultCalendarLayers: 'mes-seances',
    });
    expect(errors).toHaveLength(1);
  });
});

describe('UpdatePreferencesDto.availabilityReminder (Story 52.4)', () => {
  it('booléen vrai ou faux → valide', async () => {
    expect(await validateDto({ availabilityReminder: true })).toHaveLength(0);
    expect(await validateDto({ availabilityReminder: false })).toHaveLength(0);
  });

  it('absent → valide (préférence non touchée)', async () => {
    expect(await validateDto({})).toHaveLength(0);
  });

  it('chaîne ou nombre → rejeté (400)', async () => {
    for (const value of ['oui', 'false', 1, null]) {
      const errors = await validateDto({ availabilityReminder: value });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('availabilityReminder');
    }
  });
});
