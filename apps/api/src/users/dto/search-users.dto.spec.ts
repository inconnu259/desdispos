import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SearchUsersDto } from './search-users.dto';

describe('SearchUsersDto', () => {
  it('q d’un seul caractère → invalide (Story 32.1, seuil minimal de 2)', async () => {
    const dto = plainToInstance(SearchUsersDto, { q: 'a' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'q')).toBe(true);
  });

  it('q de deux caractères → valide', async () => {
    const dto = plainToInstance(SearchUsersDto, { q: 'al' });
    expect(await validate(dto)).toHaveLength(0);
  });
});
