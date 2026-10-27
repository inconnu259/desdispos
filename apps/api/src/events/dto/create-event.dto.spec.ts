import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateEventDto } from './create-event.dto';

const valid = { title: 'Catane et galettes', date: '2031-10-10', slot: 'EVENING' };

async function check(payload: object) {
  return validate(plainToInstance(CreateEventDto, payload));
}

/** Propriétés en erreur et messages (toujours en français). */
async function errorsOf(payload: object) {
  const errors = await check(payload);
  return {
    properties: errors.map((e) => e.property).sort(),
    messages: errors.flatMap((e) => Object.values(e.constraints ?? {})),
  };
}

describe('CreateEventDto (Story 40.1)', () => {
  it('le minimum (nom, jour, créneau) → valide ; « tous les membres » par défaut', async () => {
    expect(await check(valid)).toHaveLength(0);
    expect(await check({ ...valid, capacity: null })).toHaveLength(0);
  });

  it('tous les champs renseignés → valide, sans plafond de places', async () => {
    expect(
      await check({
        ...valid,
        lieu: 'Lyon 3e',
        heureRdv: '20:30',
        notePratique: 'On mange sur place.',
        capacity: 8,
      }),
    ).toHaveLength(0);
    expect(await check({ ...valid, capacity: 500 })).toHaveLength(0);
  });

  it.each(['', '   '])('nom vide (« %s ») → refusé, message en français', async (title) => {
    const { properties, messages } = await errorsOf({ ...valid, title });
    expect(properties).toEqual(['title']);
    expect(messages).toContain('Le nom ne peut pas être vide');
  });

  it.each(['FULL_DAY', '', undefined, 'NIGHT'])('créneau « %s » → refusé', async (slot) => {
    const { properties, messages } = await errorsOf({ ...valid, slot });
    expect(properties).toEqual(['slot']);
    expect(messages).toContain('Le créneau doit être le matin, l’après-midi ou le soir');
  });

  it.each(['10/10/2031', '2031-1-1', '', 'demain'])('date « %s » → refusée', async (date) => {
    const { properties } = await errorsOf({ ...valid, date });
    expect(properties).toEqual(['date']);
  });

  it.each(['8:30', '24:00', '20h30', '20:30:00'])('heure « %s » → refusée', async (heureRdv) => {
    const { properties, messages } = await errorsOf({ ...valid, heureRdv });
    expect(properties).toEqual(['heureRdv']);
    expect(messages).toContain("L'heure de rendez-vous doit être au format HH:MM (24 h)");
  });

  it('lieu > 80 et note > 200 caractères → refusés', async () => {
    const { properties } = await errorsOf({
      ...valid,
      lieu: 'x'.repeat(81),
      notePratique: 'x'.repeat(201),
    });
    expect(properties).toEqual(['lieu', 'notePratique']);
    expect(
      await check({ ...valid, lieu: 'x'.repeat(80), notePratique: 'x'.repeat(200) }),
    ).toHaveLength(0);
  });

  it.each([1, 0, -3, 2.5])(
    'places limitées à %s → refusées (au moins 2, hôte compris)',
    async (capacity) => {
      const { properties } = await errorsOf({ ...valid, capacity });
      expect(properties).toEqual(['capacity']);
    },
  );

  it('places limitées à 2 → valide', async () => {
    expect(await check({ ...valid, capacity: 2 })).toHaveLength(0);
  });
});

describe('CreateEventDto — sondage de dates (Story 40.5)', () => {
  const poll = {
    title: 'Catane et galettes',
    pollOptions: [
      { date: '2031-10-10', slot: 'EVENING' },
      { date: '2031-10-11', slot: 'MORNING' },
    ],
    pollDeadline: '2031-10-05',
  };

  it('mode sondage (créneaux + échéance, sans date ni créneau) → valide', async () => {
    expect(await check(poll)).toHaveLength(0);
  });

  it('beaucoup de créneaux → valide (aucun plafond métier), seule la garde technique borne', async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      date: `2031-11-${String((i % 28) + 1).padStart(2, '0')}`,
      slot: 'EVENING',
    }));
    expect(await check({ ...poll, pollOptions: many })).toHaveLength(0);
    const tooMany = Array.from({ length: 201 }, () => ({ date: '2031-11-01', slot: 'EVENING' }));
    const { properties } = await errorsOf({ ...poll, pollOptions: tooMany });
    expect(properties).toEqual(['pollOptions']);
  });

  it('un créneau FULL_DAY ou une date mal formée dans le sondage → refusé, message en français', async () => {
    const full = await errorsOf({
      ...poll,
      pollOptions: [{ date: '2031-10-10', slot: 'FULL_DAY' }],
    });
    expect(full.properties).toEqual(['pollOptions']);
    const malformed = await errorsOf({
      ...poll,
      pollOptions: [{ date: '10/10/2031', slot: 'EVENING' }],
    });
    expect(malformed.properties).toEqual(['pollOptions']);
  });

  it('échéance mal formée → refusée', async () => {
    const { properties, messages } = await errorsOf({ ...poll, pollDeadline: 'vendredi' });
    expect(properties).toEqual(['pollDeadline']);
    expect(messages).toContain('L’échéance du vote doit être au format AAAA-MM-JJ');
  });

  it('le mode date fixée reste exigeant : sans sondage, date et créneau obligatoires', async () => {
    const { properties } = await errorsOf({ title: 'Catane' });
    expect(properties).toEqual(['date', 'slot']);
  });
});

describe('CreateEventDto — durée (Story 47.1)', () => {
  it('durée absente → valide (1 créneau à la création, inchangée à la modification)', async () => {
    expect(await check(valid)).toHaveLength(0);
  });

  it.each([1, 3, 45])('%i créneaux → valide', async (durationSlots) => {
    expect(await check({ ...valid, durationSlots })).toHaveLength(0);
  });

  it('plus de 45 créneaux → refusé avec le message des 15 jours', async () => {
    const { properties, messages } = await errorsOf({ ...valid, durationSlots: 46 });
    expect(properties).toEqual(['durationSlots']);
    expect(messages).toContain('15 jours au plus : au-delà, créez deux rendez-vous.');
  });

  it.each([0, -2, 1.5, '3'])('durée « %s » → refusée, message en français', async (durationSlots) => {
    const { properties, messages } = await errorsOf({ ...valid, durationSlots });
    expect(properties).toEqual(['durationSlots']);
    expect(messages).toContain('La durée doit être un entier d’au moins 1 créneau');
  });
});
