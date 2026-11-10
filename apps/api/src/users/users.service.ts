import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** Connexion par **email OU pseudo** (au choix de l'utilisateur, cf. Story login). Seul appelant :
   *  `AuthService.validateUser()` — inclut `calendarLayers` pour `toAuthUser()` (Story 30.4). */
  findByEmailOrPseudo(identifier: string) {
    return this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { pseudo: identifier }] },
      include: { calendarLayers: true },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Dédiée à `SessionSerializer.deserializeUser()` (`GET /auth/me`, Story 30.4) — `findById()`
   *  reste sans la relation `calendarLayers` : elle est appelée ailleurs (`character.service.ts`)
   *  pour des besoins sans rapport, une jointure systématique y serait un coût inutile. */
  findByIdWithCalendarLayers(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { calendarLayers: true },
    });
  }

  /**
   * Recherche par **pseudo uniquement**, en correspondance **partielle et insensible à la
   * casse** (Story 32.1 — l'e-mail n'est plus un critère de recherche, seule l'invitation par
   * e-mail exact, `inviteByEmail()`, reste un chemin séparé). Plafonnée à 10 résultats, triés par
   * pseudo pour un top 10 déterministe. `q` est trim (défense en profondeur, le client trim déjà)
   * et ses métacaractères LIKE (`\`, `%`, `_`) sont échappés avant `contains` — sinon ils
   * changeraient la sémantique de la recherche pour un utilisateur qui les tape littéralement.
   * Ne renvoie que l'identifiant public (id, pseudo) — ni le hash, ni l'e-mail, ni le nom
   * affiché (AD-2, seule exception à « pseudo et displayName toujours les deux »).
   */
  searchByPseudo(q: string) {
    const escaped = q.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
    return this.prisma.user.findMany({
      where: { pseudo: { contains: escaped, mode: 'insensitive' } },
      select: { id: true, pseudo: true },
      orderBy: { pseudo: 'asc' },
      take: 10,
    });
  }

  async create(data: { email: string; pseudo: string; password: string }) {
    const passwordHash = await argon2.hash(data.password);
    return this.prisma.user.create({
      data: {
        email: data.email,
        pseudo: data.pseudo,
        passwordHash,
        displayName: data.pseudo,
      },
    });
  }
}
