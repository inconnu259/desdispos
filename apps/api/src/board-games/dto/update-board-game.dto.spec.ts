import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateBoardGameDto } from './update-board-game.dto';

async function errorsOf(body: Record<string, unknown>) {
  const dto = plainToInstance(UpdateBoardGameDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, errors };
}

describe('UpdateBoardGameDto (Story 48.2)', () => {
  it('corps vide → valide (rien ne change)', async () => {
    const { errors } = await errorsOf({});
    expect(errors).toHaveLength(0);
  });

  it('nom seul → valide, rogné', async () => {
    const { dto, errors } = await errorsOf({ name: ' Azul Summer ' });
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Azul Summer');
  });

  it('nombres seuls, `null` compris → valide (nom absent = inchangé)', async () => {
    const { errors } = await errorsOf({ minPlayers: 2, maxPlayers: null, durationMin: null });
    expect(errors).toHaveLength(0);
  });

  it.each([
    ['null', null],
    ['vide', ''],
    ['blanc', '   '],
    ['81 caractères', 'x'.repeat(81)],
  ])('nom %s → refusé, message en français', async (_label, name) => {
    const { errors } = await errorsOf({ name });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
    expect(Object.values(errors[0].constraints ?? {}).join(' ')).toMatch(/nom du jeu/);
  });

  it.each([0, 100, 2.5])('joueurs %p → refusé (entier de 1 à 99)', async (value) => {
    const { errors } = await errorsOf({ minPlayers: value, maxPlayers: value });
    expect(errors.map((e) => e.property).sort()).toEqual(['maxPlayers', 'minPlayers']);
  });

  it.each([0, 1441, 12.5])('durée %p → refusée (entier de 1 à 1440)', async (value) => {
    const { errors } = await errorsOf({ durationMin: value });
    expect(errors.map((e) => e.property)).toEqual(['durationMin']);
    expect(Object.values(errors[0].constraints ?? {}).join(' ')).toMatch(/durée/);
  });

  it('un nombre envoyé en texte est refusé (aucune conversion implicite)', async () => {
    const { errors } = await errorsOf({ maxPlayers: '4' });
    expect(errors.map((e) => e.property)).toEqual(['maxPlayers']);
  });

  it('un champ inconnu est refusé par la liste blanche', async () => {
    const { errors } = await errorsOf({ ownerId: 'un-autre-compte' });
    expect(errors.map((e) => e.property)).toEqual(['ownerId']);
  });
});
