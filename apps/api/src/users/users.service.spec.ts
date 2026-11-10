import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

jest.mock('argon2');

function makePrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('findByEmailOrPseudo', () => {
    it('cherche par email OU pseudo en correspondance exacte (utilisé pour la connexion)', async () => {
      await service.findByEmailOrPseudo('alice');
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ email: 'alice' }, { pseudo: 'alice' }] },
        include: { calendarLayers: true },
      });
    });

    it('retourne le premier utilisateur trouvé (email ou pseudo)', async () => {
      const user = { id: 'u1', email: 'a@b.c', pseudo: 'alice' };
      prisma.user.findFirst.mockResolvedValue(user);
      await expect(service.findByEmailOrPseudo('a@b.c')).resolves.toEqual(user);
    });
  });

  describe('searchByPseudo', () => {
    it('cherche par pseudo en correspondance partielle insensible à la casse, plafonnée à 10 et triée par pseudo, sans jamais sélectionner le hash, l’e-mail ni le nom affiché (AD-2)', async () => {
      await service.searchByPseudo('bob');
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { pseudo: { contains: 'bob', mode: 'insensitive' } },
        select: { id: true, pseudo: true },
        orderBy: { pseudo: 'asc' },
        take: 10,
      });
    });

    it("ne cherche jamais sur l'e-mail : une adresse e-mail passée en q n'est filtrée que sur pseudo (Story 32.1)", async () => {
      await service.searchByPseudo('alice@example.com');
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { pseudo: { contains: 'alice@example.com', mode: 'insensitive' } },
        select: { id: true, pseudo: true },
        orderBy: { pseudo: 'asc' },
        take: 10,
      });
    });

    it('échappe les métacaractères LIKE (`%`, `_`, `\\`) avant `contains` — recherchés littéralement, pas comme des jokers', async () => {
      await service.searchByPseudo('100%_off\\bob');
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { pseudo: { contains: '100\\%\\_off\\\\bob', mode: 'insensitive' } },
        select: { id: true, pseudo: true },
        orderBy: { pseudo: 'asc' },
        take: 10,
      });
    });

    it('trim `q` côté serveur avant le filtre (défense en profondeur, le client trim déjà)', async () => {
      await service.searchByPseudo('  bob  ');
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { pseudo: { contains: 'bob', mode: 'insensitive' } },
        select: { id: true, pseudo: true },
        orderBy: { pseudo: 'asc' },
        take: 10,
      });
    });
  });

  describe('create', () => {
    it('hash le mot de passe (argon2) avant de créer le compte — jamais en clair', async () => {
      (argon2.hash as jest.Mock).mockResolvedValue('HASHED');

      await service.create({
        email: 'a@b.c',
        pseudo: 'alice',
        password: 'plain-text',
      });

      expect(argon2.hash).toHaveBeenCalledWith('plain-text');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'a@b.c',
          pseudo: 'alice',
          passwordHash: 'HASHED',
          displayName: 'alice',
        },
      });
    });
  });
});
