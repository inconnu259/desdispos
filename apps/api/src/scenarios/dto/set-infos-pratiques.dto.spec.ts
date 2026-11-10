import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SetInfosPratiquesDto } from './set-infos-pratiques.dto';

const empty = { heureRdv: null, lieu: null, notePratique: null };

async function check(payload: object) {
  return validate(plainToInstance(SetInfosPratiquesDto, payload));
}

describe('SetInfosPratiquesDto (Story 36.5)', () => {
  it('les trois champs absents → invalide (ils sont saisis ensemble, jamais partiellement)', async () => {
    const errors = await check({});
    expect(errors.map((e) => e.property).sort()).toEqual(
      ['heureRdv', 'lieu', 'notePratique'].sort(),
    );
  });

  it('les trois champs à null → valide (null VIDE un champ)', async () => {
    expect(await check(empty)).toHaveLength(0);
  });

  it('les trois champs renseignés → valide', async () => {
    expect(
      await check({
        heureRdv: '20:30',
        lieu: 'chez Marc',
        notePratique: 'pensez aux dés',
      }),
    ).toHaveLength(0);
  });

  // ─── heureRdv : la garde n°1 rendue exécutable ─────────────────────────────
  // Le format est validé COTE SERVEUR, jamais seulement par le widget natif :
  // whitelist/forbidNonWhitelisted ne contrôlent pas la forme d'une chaîne.

  it.each(['00:00', '09:05', '20:30', '23:59'])('heureRdv « %s » → valide', async (heureRdv) => {
    expect(await check({ ...empty, heureRdv })).toHaveLength(0);
  });

  it.each([
    ['24:00', 'heure hors bornes'],
    ['25:00', 'heure hors bornes'],
    ['20:60', 'minutes hors bornes'],
    ['8h30', 'séparateur non conforme'],
    ['20:5', 'minutes non paddées'],
    ['2:30', 'heures non paddées'],
    ['20:30:00', 'secondes ajoutées'],
    ['bientôt', 'texte libre'],
    ['', 'chaîne vide — utiliser null pour vider'],
  ])('heureRdv « %s » → invalide (%s)', async (heureRdv) => {
    const errors = await check({ ...empty, heureRdv });
    expect(errors.some((e) => e.property === 'heureRdv')).toBe(true);
  });

  // ─── Bornes de longueur ────────────────────────────────────────────────────

  it('lieu à exactement la borne (80) → valide', async () => {
    expect(await check({ ...empty, lieu: 'a'.repeat(80) })).toHaveLength(0);
  });

  it('lieu au-delà de la borne (81) → invalide', async () => {
    const errors = await check({ ...empty, lieu: 'a'.repeat(81) });
    expect(errors.some((e) => e.property === 'lieu')).toBe(true);
  });

  it('notePratique à exactement la borne (200) → valide', async () => {
    expect(await check({ ...empty, notePratique: 'a'.repeat(200) })).toHaveLength(0);
  });

  it('notePratique au-delà de la borne (201) → invalide', async () => {
    const errors = await check({ ...empty, notePratique: 'a'.repeat(201) });
    expect(errors.some((e) => e.property === 'notePratique')).toBe(true);
  });

  it('un champ non-chaîne → invalide', async () => {
    const errors = await check({ ...empty, lieu: 42 });
    expect(errors.some((e) => e.property === 'lieu')).toBe(true);
  });

  // ─── Chaîne uniquement blanche : `null` est le seul moyen de vider un champ ────────────────

  it('lieu uniquement blanc → invalide', async () => {
    const errors = await check({ ...empty, lieu: '   ' });
    expect(errors.some((e) => e.property === 'lieu')).toBe(true);
  });

  it('notePratique uniquement blanc → invalide', async () => {
    const errors = await check({ ...empty, notePratique: '\t\n ' });
    expect(errors.some((e) => e.property === 'notePratique')).toBe(true);
  });
});

describe('SetInfosPratiquesDto — durée (Story 47.1)', () => {
  it('durée absente → valide (inchangée)', async () => {
    expect(await check(empty)).toHaveLength(0);
  });

  it.each([1, 6, 45])('%i créneaux → valide', async (durationSlots) => {
    expect(await check({ ...empty, durationSlots })).toHaveLength(0);
  });

  it.each([0, 46, 2.5])('durée %s → refusée', async (durationSlots) => {
    const errors = await check({ ...empty, durationSlots });
    expect(errors.map((e) => e.property)).toEqual(['durationSlots']);
  });
});
