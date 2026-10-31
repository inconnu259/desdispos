import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EventEnvyBodyDto } from './event-envy.dto';

async function errorsOf(body: Record<string, unknown>) {
  const dto = plainToInstance(EventEnvyBodyDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, errors };
}

describe('EventEnvyBodyDto (Story 49.5)', () => {
  it('une clé déjà normalisée → valide, inchangée', async () => {
    const { dto, errors } = await errorsOf({ nameKey: 'azul duel' });
    expect(errors).toHaveLength(0);
    expect(dto.nameKey).toBe('azul duel');
  });

  it('80 caractères → valide', async () => {
    const { errors } = await errorsOf({ nameKey: 'x'.repeat(80) });
    expect(errors).toHaveLength(0);
  });

  it.each([
    ['espaces autour', ' azul '],
    ['majuscule', 'Azul'],
    ['accent', 'échecs'],
    ['espaces doublés', 'azul  duel'],
  ])('clé non normalisée (%s) → refusée en français, jamais corrigée', async (_label, nameKey) => {
    const { dto, errors } = await errorsOf({ nameKey });
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {}).join(' ')).toMatch(/normalisée/);
    expect(dto.nameKey).toBe(nameKey);
  });

  it('clé vide → refusée en français', async () => {
    const { errors } = await errorsOf({ nameKey: '' });
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {}).join(' ')).toMatch(/obligatoire/);
  });

  it('81 caractères → refusée en français', async () => {
    const { errors } = await errorsOf({ nameKey: 'x'.repeat(81) });
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {}).join(' ')).toMatch(/80 caractères/);
  });

  it.each([[undefined], [null], [12], [['azul']]])('valeur %p → refusée', async (nameKey) => {
    const { errors } = await errorsOf({ nameKey });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('champ inconnu → refusé (whitelist)', async () => {
    const { errors } = await errorsOf({ nameKey: 'azul', userId: 'x' });
    expect(errors).toHaveLength(1);
  });
});
