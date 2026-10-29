import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Story 37.7 (AD-6) — garde « aucune lecture directe du propriétaire pour décider d'un droit ».
 *
 * Toute décision de droit sur une partie passe par `PermissionService` (`assert`, `roleOf`,
 * `rolesOf`). Ce test balaie les sources non-spec de `apps/api/src` et échoue dès qu'un fichier
 * hors de `permissions/` mentionne le propriétaire d'une partie (`ownerId`, relation `.owner`) sans
 * figurer dans la liste d'exceptions NOMMÉE ci-dessous. Chaque exception dit pourquoi la lecture
 * n'est PAS une décision de droit ; ajouter un fichier à la liste est une décision de revue, jamais
 * un réflexe pour faire passer le test.
 *
 * Hors balayage : `permissions/` (le service qui décide), les specs, et `common/test-utils/`
 * (fabriques réservées aux specs, exclues du build).
 */

/** Racine balayée : `apps/api/src`. */
const SRC_ROOT = join(__dirname, '..');

/**
 * Propriétaire d'une partie : le champ `ownerId`, la relation Prisma lue par `.owner`, ou la
 * relation demandée à Prisma (`select|include: { owner: … }`, `{ owner }`).
 */
const OWNER_READ = /\bownerId\b|\.owner\b|\bowner\s*:|\{\s*owner\s*[,}]/;

/**
 * Exceptions nommées (chemin relatif à `apps/api/src`, séparateur `/`) → pourquoi la lecture du
 * propriétaire n'y décide d'aucun droit. Le test vérifie aussi que chaque entrée existe encore ET
 * mentionne encore le propriétaire : une exception périmée doit être retirée.
 */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  'parties/parties.service.ts':
    "Écrivain de la table Partie : projection DTO (`ownerId`), écritures de création/mise à jour, filtre de liste (propriétaire OU membre) et transmission de l'identifiant du propriétaire aux helpers d'émission temps réel. Les rôles viennent de PermissionService.",
  'scenarios/scenarios.service.ts':
    'Remplit `Event.ownerId` à la création et transmet le propriétaire à `notifyPartieSignalsChanged` ; les droits viennent de PermissionService.assert (hors périmètre de 37.7, scénario inchangé).',
  'events/events.service.ts':
    "Écrivain de la table Event : `Event.ownerId` est une colonne écrite à la création, jamais une décision de droit. Implémente aussi `OccupiedSpansPort` et `OwnEventsPort` (Story 37.8) : filtres de requête « propriétaire OU membre » et constitution des participants d'une séance (sélection de personnes, pas un droit) ; le rôle de l'appelant lui est fourni par le service de permission.",
  'availability/availability.service.ts':
    "Résolution des parties à notifier après l'écriture d'une déclaration (`affectedPartieIds` : parties où l'utilisateur est propriétaire OU membre) — plomberie temps réel, pas un droit. Depuis la Story 37.8, les ensembles de participants d'une séance et le calendrier personnel viennent des ports (`events/`) ; le rôle de l'utilisateur vient de PermissionService.rolesOf.",
  'homme-dragon/homme-dragon.service.ts':
    "Filtre d'écriture atomique (`updateMany` conditionnel sur `Partie.ownerId`, protection contre la course), après un `assert(HOMME_DRAGON_MANAGE)` qui a déjà décidé du droit.",
  'invitations/invite-links.service.ts':
    "`consumeLink` : refus 409 « déjà le MJ » (état de la relation, pas un droit : le consommateur n'a justement aucun droit sur la partie) et transmission à `notifyPartieSignalsChanged`.",
  'invitations/invitations.service.ts':
    "`accept` lit le propriétaire de la partie pour le transmettre à `notifyPartieSignalsChanged` (Story 39.3 : un ralliement a plusieurs administrateurs, l'invitant n'est plus le destinataire du signal) ; le droit d'inviter vient de PermissionService.assert.",
  'auth/auth.service.ts':
    "`register` transmet le propriétaire de la partie rejointe par lien à `notifyPartieSignalsChanged` après la transaction (Story 39.3) ; aucune décision de droit, le compte tout juste créé n'en a aucun.",
  'account/account.service.ts':
    "Filtre de lecture agrégée « annonces non vues de MES parties » (propriétaire OU membre) et auteur affiché de l'annonce ; les écritures (favori, annonce lue) passent par PermissionService.assert.",
  'characters/character.service.ts':
    "Projection d'étiquette « l'auteur de la fiche est le MJ » (`ownerIsMj`) et transmission à `notifyPartieSignalsChanged` ; le rôle de l'appelant (`viewerIsMj`) vient de PermissionService (grant.role, roleOf, rolesOf).",
  'poll/my-open-polls.service.ts':
    "Filtre de lecture agrégée « mes sondages ouverts » (propriétaire OU membre de MES parties) et constitution des votants d'un sondage de JDR (le MJ vote avec ses membres) : sélection de parties et de personnes, pas un droit. L'anti-spoil (brouillon caché) est décidé par le rôle de PermissionService.rolesOf.",
  'poll/poll-voters.ts':
    "Définition unique des votants d'un sondage de JDR : le propriétaire de la partie (le MJ) vote avec ses membres — sélection de personnes, pas un droit.",
  'events/datable-seances.service.ts':
    'Filtre de lecture agrégée « mes rendez-vous à dater » (propriétaire OU membre de MES parties) : sélection de parties, pas un droit. Le droit de proposer des dates vient de PermissionService.organizerCan, jamais du propriétaire.',
  'events/open-poll-context.service.ts':
    "Hôte de la conjonction (propriétaire de l'événement) transmis à eligibleVoters : sélection de votants, pas un droit ; les droits d'organisateur viennent de PermissionService.organizerCan.",
  'notifications/notifications.service.ts':
    'Destinataires du rappel de la veille de chaque séance (propriétaire + membres de la partie) : sélection de destinataires, pas un droit.',
  'board-games/board-games.service.ts':
    "Story 48.1 : `BoardGame.ownerId` (nom imposé par l'épic 48) est le propriétaire d'un JEU, jamais celui d'une partie. Seul écrivain de la table `BoardGame` : colonne écrite à la création et filtre « mes jeux » sur l'utilisateur de la session — aucun identifiant reçu en paramètre, aucune décision de droit sur une partie.",
};

/** Fichiers sources non-spec de `dir`, chemins relatifs à `SRC_ROOT` (séparateur `/`). */
function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(SRC_ROOT, full).split(sep).join('/');
    if (statSync(full).isDirectory()) {
      if (rel === 'permissions' || rel === 'common/test-utils') continue;
      out.push(...listSources(full));
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.d.ts')) {
      out.push(rel);
    }
  }
  return out;
}

/**
 * Source sans ses commentaires (les sauts de ligne sont conservés). Un commentaire qui MENTIONNE le
 * propriétaire n'est pas une lecture : il ne doit ni faire échouer le balayage ni maintenir en vie
 * une exception périmée. Les chaînes et gabarits sont parcourus pour qu'un `//` d'URL ne soit pas
 * pris pour un commentaire.
 */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      out += ch;
      i++;
      while (i < source.length && source[i] !== ch) {
        if (source[i] === '\\') {
          out += source[i];
          i++;
        }
        out += source[i] ?? '';
        i++;
      }
      out += ch;
      i++;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/** Lignes de code (hors commentaires) d'une source qui lisent le propriétaire d'une partie. */
function ownerReads(source: string): string[] {
  return stripComments(source)
    .split('\n')
    .filter((line) => OWNER_READ.test(line));
}

describe('aucune lecture directe du propriétaire hors de permissions/ (Story 37.7, AD-6)', () => {
  const sources = listSources(SRC_ROOT);

  it('le balayage trouve toutes les sources connues (pas un balayage vide ou tronqué)', () => {
    // Toutes les exceptions nommées doivent être retrouvées par le balayage : un répertoire
    // omis ferait disparaître silencieusement des fichiers du contrôle.
    const missing = Object.keys(EXCEPTIONS).filter((rel) => !sources.includes(rel));
    expect(missing).toEqual([]);
    expect(sources).not.toContain('permissions/permission.service.ts');
    expect(sources.some((rel) => rel.endsWith('.spec.ts'))).toBe(false);
  });

  it('aucun fichier hors exception ne lit le propriétaire d’une partie', () => {
    const offenders = sources
      .filter((rel) => !(rel in EXCEPTIONS))
      .flatMap((rel) =>
        ownerReads(readFileSync(join(SRC_ROOT, rel), 'utf8')).map(
          (line) => `${rel} : ${line.trim()}`,
        ),
      );
    // Un droit se décide par PermissionService.assert / roleOf / rolesOf, jamais en comparant
    // `ownerId` : voir la liste d'exceptions nommée en tête de ce fichier.
    expect(offenders).toEqual([]);
  });

  it('chaque exception nommée mentionne encore le propriétaire (sinon : la retirer de la liste)', () => {
    const stale = Object.keys(EXCEPTIONS).filter(
      (rel) => ownerReads(readFileSync(join(SRC_ROOT, rel), 'utf8')).length === 0,
    );
    expect(stale).toEqual([]);
  });

  it('chaque exception donne sa raison', () => {
    for (const [rel, reason] of Object.entries(EXCEPTIONS)) {
      expect({ rel, documented: reason.trim().length > 20 }).toEqual({ rel, documented: true });
    }
  });

  describe('le détecteur', () => {
    it.each([
      'if (partie.ownerId !== userId) throw new ForbiddenException();',
      'where: { ownerId: userId },',
      'const isMj = partie.ownerId === userId;',
      'return a.partie.owner ? [a.partie.owner] : [];',
      'const { ownerId } = partie;',
      'select: { owner: { select: { pseudo: true } } },',
      'include: { owner: true },',
      'select: { owner },',
      'const url = "http://x"; const ok = partie.ownerId === userId;',
    ])('signale : %s', (line) => {
      expect(ownerReads(line)).toEqual([line]);
    });

    it.each([
      'const ownerIds = [];',
      'await this.permissions.ownerOf(partie);',
      'const { role } = await this.permissions.assert(userId, "PARTIE_READ", { partieId });',
      'ownerIsMj = viewerIsMj;',
      '// partie.ownerId !== userId : commentaire seul',
      'const x = 1; // ownerId dans un commentaire de fin de ligne',
      '/** Le MJ (`ownerId`) ... */',
      'const ownerPseudo = "x";',
    ])('ne signale pas : %s', (line) => {
      expect(ownerReads(line)).toEqual([]);
    });

    it('ne signale pas un commentaire de bloc sur plusieurs lignes, mais signale le code qui suit', () => {
      const source = [
        '/**',
        ' * Compare `partie.ownerId` à l’utilisateur.',
        ' */',
        'const a = 1;',
      ].join('\n');
      expect(ownerReads(source)).toEqual([]);
      expect(ownerReads(source + '\nconst b = partie.ownerId;')).toEqual([
        'const b = partie.ownerId;',
      ]);
    });
  });
});
