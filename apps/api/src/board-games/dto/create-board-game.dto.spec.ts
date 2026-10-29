import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBoardGameDto } from './create-board-game.dto';

async function errorsOf(body: Record<string, unknown>) {
  const dto = plainToInstance(CreateBoardGameDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, errors };
}

describe('CreateBoardGameDto (Story 48.1)', () => {
  it('nom seul → valide', async () => {
    const { errors } = await errorsOf({ name: 'Skull' });
    expect(errors).toHaveLength(0);
  });

  it('jeu complet → valide, nom rogné', async () => {
    const { dto, errors } = await errorsOf({
      name: ' Azul ',
      minPlayers: 2,
      maxPlayers: 4,
      durationMin: 40,
    });
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Azul');
  });

  it('valeurs `null` acceptées pour les champs facultatifs', async () => {
    const { errors } = await errorsOf({
      name: 'Skull',
      minPlayers: null,
      maxPlayers: null,
      durationMin: null,
    });
    expect(errors).toHaveLength(0);
  });

  it.each([
    ['vide', ''],
    ['blanc', '   '],
    ['81 caractères', 'x'.repeat(81)],
  ])('nom %s → refusé, message en français', async (_label, name) => {
    const { errors } = await errorsOf({ name });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
    expect(Object.values(errors[0].constraints ?? {}).join(' ')).toMatch(/nom du jeu/);
  });

  it('nom de 80 caractères → valide', async () => {
    const { errors } = await errorsOf({ name: 'x'.repeat(80) });
    expect(errors).toHaveLength(0);
  });

  it('nom absent → refusé', async () => {
    const { errors } = await errorsOf({});
    expect(errors.map((e) => e.property)).toEqual(['name']);
  });

  it.each([0, 100, 2.5])('joueurs %p → refusé (entier de 1 à 99)', async (value) => {
    const { errors } = await errorsOf({ name: 'Azul', minPlayers: value, maxPlayers: value });
    expect(errors.map((e) => e.property).sort()).toEqual(['maxPlayers', 'minPlayers']);
    for (const e of errors) {
      expect(Object.values(e.constraints ?? {}).join(' ')).toMatch(/joueurs/);
    }
  });

  it.each([1, 99])('joueurs %p → valide (borne)', async (value) => {
    const { errors } = await errorsOf({ name: 'Azul', minPlayers: value, maxPlayers: value });
    expect(errors).toHaveLength(0);
  });

  it.each([0, 1441, 12.5])('durée %p → refusée (entier de 1 à 1440)', async (value) => {
    const { errors } = await errorsOf({ name: 'Azul', durationMin: value });
    expect(errors.map((e) => e.property)).toEqual(['durationMin']);
    expect(Object.values(errors[0].constraints ?? {}).join(' ')).toMatch(/durée/);
  });

  it.each([1, 1440])('durée %p → valide (borne)', async (value) => {
    const { errors } = await errorsOf({ name: 'Azul', durationMin: value });
    expect(errors).toHaveLength(0);
  });

  it('un nombre envoyé en texte est refusé (aucune conversion implicite)', async () => {
    const { errors } = await errorsOf({ name: 'Azul', minPlayers: '2' });
    expect(errors.map((e) => e.property)).toEqual(['minPlayers']);
  });
});
