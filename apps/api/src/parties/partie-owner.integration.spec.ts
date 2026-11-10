import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

// Test d'intégration réel contre Postgres (Story 37.2, AD-5) : la garantie « la suppression du
// compte propriétaire laisse la partie en place » vit uniquement dans la clé étrangère
// `Partie_ownerId_fkey ... ON DELETE SET NULL`. Aucun test unitaire (Prisma mocké) ne la voit :
// un retour à `Cascade` passerait partout ailleurs sans bruit.
@Module({ imports: [PrismaModule] })
class TestAppModule {}

describe('Partie.ownerId (intégration réelle via Postgres)', () => {
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;
  let prisma: PrismaService;

  const suffix = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const partieIds: string[] = [];

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(TestAppModule, { logger: false });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.partie.deleteMany({ where: { id: { in: partieIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    // PrismaService n'implémente pas OnModuleDestroy : on ferme le pool explicitement.
    await prisma.$disconnect();
    await app.close();
  });

  it('AD-5 : supprimer le compte propriétaire conserve la partie, sans propriétaire, et ses membres', async () => {
    const [owner, player] = await Promise.all(
      ['owner', 'player'].map((label) =>
        prisma.user.create({
          data: {
            email: `${label}-${suffix}@test.local`,
            pseudo: `${label}-${suffix}`,
            displayName: `${label}-${suffix}`,
            passwordHash: 'x',
          },
        }),
      ),
    );
    userIds.push(owner.id, player.id);

    const partie = await prisma.partie.create({
      data: {
        name: `Proprietaire-${suffix}`,
        kind: 'CAMPAGNE_LINEAIRE',
        gameSystemId: 'ryuutama',
        ownerId: owner.id,
      },
    });
    partieIds.push(partie.id);
    const membership = await prisma.membership.create({
      data: { userId: player.id, partieId: partie.id },
    });

    await prisma.user.delete({ where: { id: owner.id } });

    const after = await prisma.partie.findUnique({ where: { id: partie.id } });
    expect(after).not.toBeNull();
    expect(after!.ownerId).toBeNull();
    const membershipAfter = await prisma.membership.findUnique({ where: { id: membership.id } });
    expect(membershipAfter).not.toBeNull();
    expect(membershipAfter!.userId).toBe(player.id);
  });
});
