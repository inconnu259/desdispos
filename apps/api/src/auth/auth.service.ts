import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { THEMES } from '@master-jdr/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { toAuthUser } from '../users/to-auth-user.util';
import { InviteLinksService } from '../invitations/invite-links.service';
import { PartiesService } from '../parties/parties.service';
import { EmailService } from '../email/email.service';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';
import { RegisterDto } from './dto/register.dto';
import { publicWebOrigin } from '../config/env';
import { normalizeEmail } from '../common/dto/email.transform';

const RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // +24h (FR-6)
const RESET_TOKEN_INVALID_MESSAGE = 'Lien invalide ou expiré. Merci de refaire une demande.';
const EMAIL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1h — fenêtre glissante de limitation par e-mail (FR-13)
const EMAIL_RATE_LIMIT_MAX = 5; // même valeur que le throttle IP existant (5/60s), fenêtre différente

const EMAIL_CHANGE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // +24h, même TTL que le reset mdp (Story 28.6)
const EMAIL_CHANGE_ROLLBACK_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // +1 mois (AC2, Story 28.6)
const EMAIL_CHANGE_TOKEN_INVALID_MESSAGE = 'Lien invalide ou expiré. Merci de refaire une demande.';
const EMAIL_CHANGE_ROLLBACK_TOKEN_INVALID_MESSAGE = 'Lien invalide ou expiré.';

/** Hash argon2 d'un secret aléatoire jeté, calculé une fois (mêmes paramètres que les vrais hash) : sert
 *  à vérifier un mot de passe quand le compte n'existe pas, pour que la durée de réponse n'en dise rien. */
let dummyPasswordHash: Promise<string> | undefined;
function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= argon2.hash(randomBytes(32).toString('hex'));
  return dummyPasswordHash;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly inviteLinks: InviteLinksService,
    private readonly email: EmailService,
    private readonly realtimeEvents: RealtimeEventsService,
    // Signaux de la partie rejointe (`notifyPartieSignalsChanged`, Story 39.3) : écriture de
    // `parties/`, aucune décision de droit.
    private readonly parties: PartiesService,
  ) {}

  /** Vérifie les identifiants (email OU pseudo) ; renvoie l'utilisateur (sans le hash) ou null. */
  async validateUser(identifier: string, password: string) {
    // Un identifiant contenant « @ » est une adresse (un pseudo ne peut pas en contenir) : comparée en
    // minuscules, comme elle est stockée.
    const lookup = identifier.includes('@') ? normalizeEmail(identifier) : identifier.trim();
    const user = await this.users.findByEmailOrPseudo(lookup);
    if (!user) {
      // Même coût qu'un vrai compte (vérification argon2 contre un hash factice) : sans ça, la durée de
      // la réponse dit si l'e-mail ou le pseudo existe.
      try {
        await argon2.verify(await getDummyPasswordHash(), password);
      } catch {
        // sans importance : le résultat est ignoré, seule la durée compte
      }
      return null;
    }

    let ok: boolean;
    try {
      ok = await argon2.verify(user.passwordHash, password);
    } catch {
      // `passwordHash` n'est pas un hash argon2 valide (ex. compte inséré manuellement en base
      // avec un mot de passe en clair) : traiter comme des identifiants invalides plutôt que de
      // laisser l'exception remonter en 500 (qui serait masquée en "identifiants invalides"
      // générique côté front de toute façon, mais sans le bon code HTTP).
      return null;
    }
    if (!ok) return null;

    // `mustResetPassword` doit rester lisible par `LocalStrategy` (garde AC3, Story 28.6), donc
    // pas de conversion `toAuthUser()` complète ici — mais `passwordHash` n'a lui aucune raison de
    // survivre au-delà de cette vérification (Story 30.4) : on le retire dès maintenant, la
    // conversion vers `AuthUser` intervient dans `LocalStrategy`, après la garde.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- extrait pour l'exclure de `safe`
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  // Inscription **sur invitation** (spec §2) : un token de lien valide est requis ; le compte créé
  // est rattaché à la partie du lien dans la même transaction (compte + Membership atomiques).
  async register(dto: RegisterDto) {
    // Lien vérifié AVANT tout le reste (hash argon2, création du compte) : sans lien valide, la réponse ne
    // doit rien dire de l'adresse ni du pseudo (avant, un 409 « déjà utilisé » répondait à n'importe qui,
    // et chaque essai coûtait un hash argon2 au serveur). consumeLink() revérifie dans la transaction.
    await this.inviteLinks.assertUsableForRegistration(dto.token, dto.email);
    try {
      const passwordHash = await argon2.hash(dto.password);
      let joinedPartieId: string | undefined;
      let joinedOwnerId: string | null = null;
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            pseudo: dto.pseudo,
            passwordHash,
            displayName: dto.pseudo,
            // Un thème tiré au hasard plutôt qu'un `null`/défaut fixe — évite que tout nouveau
            // compte démarre systématiquement sur le même thème (revue de code Story 28.4,
            // demande utilisateur). N'affecte pas le push-once (AD-13) : celui-ci ne concerne que
            // les comptes déjà existants avant cette story, jamais `null` après ce point.
            theme: this.pickRandomTheme(),
          },
        });
        const link = await this.inviteLinks.consumeLink(tx, dto.token, user.id);
        joinedPartieId = link.partieId;
        joinedOwnerId = link.partie.ownerId;
        // Compte tout juste créé : aucune UserCalendarLayer ne peut encore exister (Story 30.4).
        return toAuthUser({ ...user, calendarLayers: [] });
      });
      // Bug fix : le MJ/les autres membres ne voyaient jamais apparaître le nouveau membre sans
      // recharger — émis après résolution complète de la transaction, jamais dans son callback.
      if (joinedPartieId) {
        this.realtimeEvents.emit(partieTopic(joinedPartieId));
        // Story 39.3 : les autres membres (listes d'accueil, signaux) sont notifiés comme pour un
        // rejoignant existant, avec le propriétaire de la partie. Après la transaction.
        await this.parties.notifyPartieSignalsChanged(joinedPartieId, joinedOwnerId);
      }
      return result;
    } catch (e: unknown) {
      // Email OU pseudo déjà pris → contrainte d'unicité (Prisma P2002) → 409 propre.
      // On teste le `code` (plus robuste que `instanceof` avec le driver adapter Prisma 7).
      const err = e as { code?: string };
      if (err?.code === 'P2002') {
        // Le driver adapter Prisma 7 ne fiabilise pas `meta.target` → message générique.
        throw new ConflictException('Cet e-mail ou ce pseudo est déjà utilisé.');
      }
      throw e;
    }
  }

  /** Tirage uniforme parmi les thèmes valides — utilisé uniquement à l'inscription. */
  private pickRandomTheme(): (typeof THEMES)[number] {
    return THEMES[Math.floor(Math.random() * THEMES.length)];
  }

  /**
   * Crée l'index inverse UserSession — appelé juste après req.login() (AuthController.login).
   * `upsert` (pas `create`) : `sid` est `@unique` (Story 15.2, revue de code) — un appel en double
   * pour le même sessionID (retry client) est idempotent plutôt que de lever une erreur P2002.
   */
  async recordSession(userId: string, sid: string): Promise<void> {
    await this.prisma.userSession.upsert({
      where: { sid },
      create: { userId, sid },
      update: { userId },
    });
  }

  /**
   * Supprime l'index inverse UserSession — appelé juste avant req.session.destroy()
   * (AuthController.logout). `deleteMany` (pas `delete`) : idempotent, ne lève pas si la ligne
   * n'existe déjà plus.
   */
  async forgetSession(sid: string): Promise<void> {
    await this.prisma.userSession.deleteMany({ where: { sid } });
  }

  /**
   * Répond toujours { ok: true }, que l'adresse corresponde ou non à un compte (anti-énumération,
   * AC1) — les deux branches convergent vers le même retour final, pas de court-circuit anticipé.
   */
  async requestPasswordReset(email: string): Promise<{ ok: true }> {
    const user = await this.users.findByEmail(email);
    if (user) {
      // Limitation par e-mail (FR-13), en complément du throttle IP existant sur la route — un
      // `429`/réponse distincte fuiterait "cette adresse existe et a déjà été sollicitée" ; on
      // renvoie donc { ok: true } sans rien créer ni envoyer, comme pour un e-mail inconnu.
      const recentCount = await this.prisma.passwordResetToken.count({
        where: {
          userId: user.id,
          createdAt: { gt: new Date(Date.now() - EMAIL_RATE_LIMIT_WINDOW_MS) },
        },
      });
      if (recentCount >= EMAIL_RATE_LIMIT_MAX) {
        return { ok: true };
      }

      // Le secret est l'unique donnée capable de prouver la possession du lien ; jamais stocké
      // tel quel (AD-4) — seul son hash argon2 va en base. `id` (retourné par `create()`) sert de
      // clé de recherche publique côté vérification, un hash argon2 n'étant pas indexable.
      const secret = randomBytes(32).toString('base64url');
      const tokenHash = await argon2.hash(secret);
      const created = await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
      await this.email.sendMail('password-reset', user.email, {
        link: `${publicWebOrigin()}/reset-password/${created.id}.${secret}`,
      });
    }
    return { ok: true };
  }

  /**
   * Message générique unique pour token malformé/inconnu/expiré/déjà utilisé/secret invalide —
   * ne distingue jamais la cause côté appelant.
   *
   * Le secret doit être vérifié (`argon2.verify`) **avant** la réclamation atomique (`updateMany`) :
   * inverser l'ordre brûlerait le token légitime de l'utilisateur dès qu'une tentative avec un
   * mauvais secret sur un `id` valide serait soumise, l'empêchant de réutiliser son propre lien.
   *
   * Le hachage (`argon2.verify`/`argon2.hash`, CPU-bound) reste hors de la transaction Prisma —
   * seule la réclamation atomique du token et la mise à jour du mot de passe (les deux opérations
   * qui doivent rester ensemble) sont transactionnelles, pour ne pas tenir une connexion DB
   * pendant tout le temps de calcul du hachage.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const separatorIndex = token.indexOf('.');
    if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
      throw new NotFoundException(RESET_TOKEN_INVALID_MESSAGE);
    }
    const id = token.slice(0, separatorIndex);
    const secret = token.slice(separatorIndex + 1);

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { id },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException(RESET_TOKEN_INVALID_MESSAGE);
    }

    let valid: boolean;
    try {
      valid = await argon2.verify(record.tokenHash, secret);
    } catch {
      valid = false;
    }
    if (!valid) {
      throw new NotFoundException(RESET_TOKEN_INVALID_MESSAGE);
    }

    const passwordHash = await argon2.hash(newPassword);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.passwordResetToken.updateMany({
        where: { id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claim.count === 0) {
        throw new NotFoundException(RESET_TOKEN_INVALID_MESSAGE);
      }

      const updated = await tx.user.update({
        where: { id: record.userId },
        // `mustResetPassword: false` (Story 28.6) — un compte bloqué par un rollback d'e-mail
        // (AC3) redevient connectable dès qu'un reset mdp aboutit ; sans ce reset explicite, un
        // reset via ce flux ne le lèverait jamais.
        data: { passwordHash, mustResetPassword: false },
      });

      // Invalidation des sessions actives (AD-3, FR-11) — toutes, sans exception (écart assumé
      // avec changePassword(), qui préserve la session courante — Story 28.5).
      await this.revokeSessions(tx, record.userId);

      // Deferred-work (2026-08-25) : un token de reset plus ancien, non utilisé, resterait valide
      // après ce reset réussi via CE token (`id` exclu, déjà marqué `usedAt` ci-dessus) — un lien
      // de reset fuité mais non encore utilisé pourrait sinon encore servir après coup.
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      });

      return updated;
    });

    // Hors transaction (I/O réseau, best-effort — FR-12) : le mot de passe est déjà changé en
    // base, un échec d'envoi ne doit jamais faire échouer le reset. EmailService.sendMail() ne
    // relance jamais (catch interne → { ok: false }), aucun try/catch supplémentaire nécessaire.
    await this.email.sendMail('password-changed', updatedUser.email, {});
  }

  /**
   * Révoque les sessions actives d'un utilisateur (AD-3, FR-11) — partagée par resetPassword()
   * (toutes les sessions, sans exception) et changePassword() (`exceptSid` préserve la session
   * courante, Story 28.5). Toujours appelée depuis l'intérieur d'une transaction Prisma englobant
   * aussi la mise à jour de `passwordHash` (atomicité).
   *
   * Les deux tables (`Session`, gérée par connect-pg-simple, et `UserSession`, notre index
   * inverse) doivent rester synchronisées — une session supprimée d'un côté sans l'autre serait
   * soit un fantôme soit non révoquée.
   */
  async revokeSessions(
    tx: Prisma.TransactionClient,
    userId: string,
    exceptSid?: string,
  ): Promise<void> {
    // Revue de code : test explicite de présence, pas de vérité (`exceptSid ? ...`) — une chaîne
    // vide (en pratique jamais produite par express-session, mais pas garantie par le typage)
    // basculerait silencieusement en « révoque tout », y compris la session courante.
    const where = exceptSid !== undefined ? { userId, sid: { not: exceptSid } } : { userId };
    const activeSessions = await tx.userSession.findMany({
      where,
      select: { sid: true },
    });
    const sids = activeSessions.map((s) => s.sid);
    await tx.session.deleteMany({ where: { sid: { in: sids } } });
    await tx.userSession.deleteMany({ where });
  }

  /**
   * Story 43.2 — vérifie le mot de passe du compte `userId` (effacement du compte), sans rien modifier :
   * 401 « Mot de passe incorrect » s'il ne correspond pas, 404 si le compte n'existe plus. Seul endroit où
   * un mot de passe est comparé hors connexion et changement de mot de passe.
   */
  async verifyPassword(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('Compte introuvable');
    let valid: boolean;
    try {
      valid = await argon2.verify(user.passwordHash, password);
    } catch {
      valid = false;
    }
    if (!valid) throw new UnauthorizedException('Mot de passe incorrect');
  }

  /**
   * Changement de mot de passe en session (Story 28.5) — l'utilisateur est déjà authentifié et
   * prouve la connaissance du mot de passe actuel ; contrairement à resetPassword(), seules les
   * AUTRES sessions sont coupées (`exceptSid` = session courante, jamais lue depuis le corps de
   * la requête — AccountController).
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    exceptSid: string,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Compte introuvable');
    }

    let valid: boolean;
    try {
      valid = await argon2.verify(user.passwordHash, currentPassword);
    } catch {
      valid = false;
    }
    if (!valid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    const passwordHash = await argon2.hash(newPassword);

    // Deferred-work (2026-08-25) : compte supprimé entre le findUnique ci-dessus et cette
    // transaction (fenêtre astronomiquement improbable) — P2025 converti en 404 propre plutôt
    // que de remonter en 500 brut.
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { passwordHash } });
        await this.revokeSessions(tx, userId, exceptSid);
      });
    } catch (e) {
      // Même convention duck-typing que rollbackEmailChange() plus bas dans ce fichier.
      if ((e as { code?: string })?.code === 'P2025') {
        throw new NotFoundException('Compte introuvable');
      }
      throw e;
    }

    // Hors transaction, best-effort — même patron que resetPassword().
    await this.email.sendMail('password-changed', user.email, {});

    return { ok: true };
  }

  /**
   * Étape 1/3 du changement d'e-mail à double canal (Story 28.6, AC1) — authentifié, mot de passe
   * courant requis. Ne modifie jamais l'adresse du compte : crée un jeton de confirmation envoyé à
   * la NOUVELLE adresse, et un avis informatif envoyé à l'ANCIENNE. Écart assumé par rapport à
   * requestPasswordReset() : les jetons de confirmation précédents, non utilisés, sont invalidés à
   * chaque nouvelle demande — laisser vivre plusieurs jetons pointant vers des `newEmail`
   * différents ferait courir le risque qu'un ancien lien encore valide fasse aboutir le compte à
   * une adresse que l'utilisateur ne veut plus.
   */
  async requestEmailChange(
    userId: string,
    currentPassword: string,
    newEmail: string,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Compte introuvable');
    }

    let valid: boolean;
    try {
      valid = await argon2.verify(user.passwordHash, currentPassword);
    } catch {
      valid = false;
    }
    if (!valid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    // Normalisé (même patron que invitations.service.ts) — sans quoi une casse différente
    // (`New@B.C` vs `new@b.c`) contournerait les deux garde-fous ci-dessous (revue de code).
    const normalizedNewEmail = newEmail.trim().toLowerCase();

    if (normalizedNewEmail === user.email.toLowerCase()) {
      throw new ConflictException('Cette adresse est déjà celle de votre compte.');
    }

    // Route authentifiée, mot de passe déjà prouvé : contrairement à register()/
    // requestPasswordReset(), l'anti-énumération n'a pas la même valeur ici — message explicite.
    const existing = await this.users.findByEmail(normalizedNewEmail);
    if (existing) {
      throw new ConflictException('Cette adresse est déjà utilisée par un autre compte.');
    }

    // Limitation par e-mail (même patron que requestPasswordReset()) — évite le spam des deux
    // boîtes mail (nouvelle + ancienne) depuis une session compromise.
    const recentCount = await this.prisma.emailChangeToken.count({
      where: {
        userId,
        createdAt: { gt: new Date(Date.now() - EMAIL_RATE_LIMIT_WINDOW_MS) },
      },
    });
    if (recentCount >= EMAIL_RATE_LIMIT_MAX) {
      return { ok: true };
    }

    await this.prisma.emailChangeToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const secret = randomBytes(32).toString('base64url');
    const tokenHash = await argon2.hash(secret);
    const created = await this.prisma.emailChangeToken.create({
      data: {
        userId,
        newEmail: normalizedNewEmail,
        tokenHash,
        expiresAt: new Date(Date.now() + EMAIL_CHANGE_TOKEN_TTL_MS),
      },
    });

    await this.email.sendMail('email-change-confirm', normalizedNewEmail, {
      link: `${publicWebOrigin()}/confirm-email-change/${created.id}.${secret}`,
    });
    await this.email.sendMail('email-change-notice', user.email, {});

    return { ok: true };
  }

  /**
   * Étape 2/3 (Story 28.6, AC2, AC4) — le lien de confirmation, ouvert depuis la NOUVELLE adresse,
   * remplace réellement l'adresse du compte et crée un jeton de retour arrière (valable 1 mois,
   * envoyé à l'ANCIENNE adresse). Même patron token composite `id.secret` que resetPassword().
   */
  async confirmEmailChange(token: string): Promise<{ ok: true }> {
    const separatorIndex = token.indexOf('.');
    if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
      throw new NotFoundException(EMAIL_CHANGE_TOKEN_INVALID_MESSAGE);
    }
    const id = token.slice(0, separatorIndex);
    const secret = token.slice(separatorIndex + 1);

    const record = await this.prisma.emailChangeToken.findUnique({
      where: { id },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException(EMAIL_CHANGE_TOKEN_INVALID_MESSAGE);
    }

    let valid: boolean;
    try {
      valid = await argon2.verify(record.tokenHash, secret);
    } catch {
      valid = false;
    }
    if (!valid) {
      throw new NotFoundException(EMAIL_CHANGE_TOKEN_INVALID_MESSAGE);
    }

    const rollbackSecret = randomBytes(32).toString('base64url');
    const rollbackTokenHash = await argon2.hash(rollbackSecret);

    let createdRollback: { id: string };
    let oldEmail: string;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const claim = await tx.emailChangeToken.updateMany({
          where: { id, usedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date() },
        });
        if (claim.count === 0) {
          throw new NotFoundException(EMAIL_CHANGE_TOKEN_INVALID_MESSAGE);
        }

        const user = await tx.user.findUnique({ where: { id: record.userId } });
        if (!user) {
          throw new NotFoundException(EMAIL_CHANGE_TOKEN_INVALID_MESSAGE);
        }
        // Lue à l'intérieur de la transaction, juste avant l'update — ferme la fenêtre TOCTOU
        // qu'une lecture précédant la transaction laisserait ouverte (revue de code).
        const userOldEmail = user.email;

        await tx.user.update({
          where: { id: record.userId },
          data: { email: record.newEmail },
        });

        const rollback = await tx.emailChangeRollbackToken.create({
          data: {
            userId: record.userId,
            oldEmail: userOldEmail,
            tokenHash: rollbackTokenHash,
            expiresAt: new Date(Date.now() + EMAIL_CHANGE_ROLLBACK_TOKEN_TTL_MS),
          },
        });

        return { rollback, oldEmail: userOldEmail };
      });
      createdRollback = result.rollback;
      oldEmail = result.oldEmail;
    } catch (e: unknown) {
      // Adresse prise par un autre compte entre la demande et la confirmation (fenêtre jusqu'à
      // 24h) — jamais un 500 brut.
      const err = e as { code?: string };
      if (err?.code === 'P2002') {
        throw new ConflictException(
          'Cette adresse est désormais utilisée par un autre compte, merci de refaire une demande.',
        );
      }
      throw e;
    }

    // Hors transaction, best-effort — même patron que resetPassword()/changePassword().
    await this.email.sendMail('email-change-rollback-available', oldEmail, {
      link: `${publicWebOrigin()}/rollback-email-change/${createdRollback.id}.${rollbackSecret}`,
    });

    return { ok: true };
  }

  /**
   * Étape 3/3, cas d'usurpation (Story 28.6, AC3, AC4) — le lien de retour arrière, ouvert depuis
   * l'ANCIENNE adresse, restaure celle-ci, coupe TOUTES les sessions actives (réutilise
   * revokeSessions() de la Story 28.5, sans `exceptSid` — appelé hors session, rien à préserver) et
   * exige une réinitialisation du mot de passe avant toute reconnexion (`mustResetPassword`,
   * appliqué dans LocalStrategy.validate()).
   */
  async rollbackEmailChange(token: string): Promise<{ ok: true }> {
    const separatorIndex = token.indexOf('.');
    if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
      throw new NotFoundException(EMAIL_CHANGE_ROLLBACK_TOKEN_INVALID_MESSAGE);
    }
    const id = token.slice(0, separatorIndex);
    const secret = token.slice(separatorIndex + 1);

    const record = await this.prisma.emailChangeRollbackToken.findUnique({
      where: { id },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException(EMAIL_CHANGE_ROLLBACK_TOKEN_INVALID_MESSAGE);
    }

    let valid: boolean;
    try {
      valid = await argon2.verify(record.tokenHash, secret);
    } catch {
      valid = false;
    }
    if (!valid) {
      throw new NotFoundException(EMAIL_CHANGE_ROLLBACK_TOKEN_INVALID_MESSAGE);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const claim = await tx.emailChangeRollbackToken.updateMany({
          where: { id, usedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date() },
        });
        if (claim.count === 0) {
          throw new NotFoundException(EMAIL_CHANGE_ROLLBACK_TOKEN_INVALID_MESSAGE);
        }

        await tx.user.update({
          where: { id: record.userId },
          data: { email: record.oldEmail, mustResetPassword: true },
        });

        await this.revokeSessions(tx, record.userId);

        // Brûle tous les autres jetons encore valides du compte : celui qui a détourné l'adresse a pu,
        // avant ce rollback, demander une réinitialisation de mot de passe (lien reçu sur SON adresse)
        // ou un nouveau changement d'e-mail — il reprendrait le compte avec, sessions révoquées ou non.
        const now = new Date();
        await tx.passwordResetToken.updateMany({
          where: { userId: record.userId, usedAt: null },
          data: { usedAt: now },
        });
        await tx.emailChangeToken.updateMany({
          where: { userId: record.userId, usedAt: null },
          data: { usedAt: now },
        });
        await tx.emailChangeRollbackToken.updateMany({
          where: { userId: record.userId, usedAt: null },
          data: { usedAt: now },
        });
      });
    } catch (e: unknown) {
      const err = e as { code?: string };
      // Compte supprimé entre l'émission du jeton de rollback et son usage — jamais un 500 brut
      // (revue de code).
      if (err?.code === 'P2025') {
        throw new NotFoundException(EMAIL_CHANGE_ROLLBACK_TOKEN_INVALID_MESSAGE);
      }
      // oldEmail repris par un autre compte entre la confirmation et le rollback — même patron
      // que confirmEmailChange() (revue de code).
      if (err?.code === 'P2002') {
        throw new ConflictException(
          'Cette adresse est désormais utilisée par un autre compte, la restauration est impossible.',
        );
      }
      throw e;
    }

    // Hors transaction, best-effort.
    await this.email.sendMail('email-change-rolled-back', record.oldEmail, {
      link: `${publicWebOrigin()}/forgot-password`,
    });

    return { ok: true };
  }

  /**
   * Purge planifiée des tokens de réinitialisation expirés (AD-5, FR-14) — même cadence que
   * NotificationsService.sendDueReminders. Un seul prédicat (`expiresAt < now`), utilisé ou non :
   * `deleteMany` est un appel DB atomique et idempotent, aucune garde anti-chevauchement
   * nécessaire (contrairement à NotificationsService, qui boucle sur des envois d'e-mail).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpiredResetTokens(): Promise<void> {
    const where = { expiresAt: { lt: new Date() } };
    const { count } = await this.prisma.passwordResetToken.deleteMany({ where });
    if (count > 0) {
      this.logger.log(`${count} PasswordResetToken(s) expiré(s) purgé(s)`);
    }
    // Les jetons de changement d'e-mail expirés (et leurs hash) n'ont pas non plus à rester en base.
    const emailChange = await this.prisma.emailChangeToken.deleteMany({ where });
    const rollback = await this.prisma.emailChangeRollbackToken.deleteMany({ where });
    if (emailChange.count + rollback.count > 0) {
      this.logger.log(
        `${emailChange.count + rollback.count} jeton(s) de changement d'e-mail expiré(s) purgé(s)`,
      );
    }
  }
}
