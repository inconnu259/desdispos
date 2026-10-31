import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { GameSystemCapability, PermissionAction } from '@master-jdr/shared';
import { PrismaService } from '../prisma/prisma.service';
import { objectLike } from '../common/test-utils/jest-typed';
import {
  ACTION_CAPABILITY,
  ADMIN_ONLY_MESSAGE,
  CAPABILITY_UNAVAILABLE_MESSAGE,
  HOST_ONLY_MESSAGE,
  HOST_OR_ADMIN_ONLY_MESSAGE,
  JDR_POLICY,
  LIBRARY_NOT_FOUND_MESSAGE,
  MJ_ONLY_MESSAGE,
  NO_ACCESS_MESSAGE,
  PermissionService,
  RALLIEMENT_POLICY,
  RALLIEMENT_UNAVAILABLE_MESSAGE,
} from './permission.service';

// Story 37.6 (AD-6) — service UNIQUE de décision des droits. Un test de refus par cellule
// actions × rôles (`player`, non-membre) de la politique `jdr`, plus les 404 de chaque cible, la
// partie sans propriétaire, l'IDOR par séance/événement d'une autre partie et la lecture en lot.

const MJ = 'mj-a';
const PLAYER = 'joueur-a';
const STRANGER = 'etranger';

function partie(id: string, ownerId: string | null, gameSystemId = 'ryuutama') {
  return { id, ownerId, gameSystemId, name: `Partie ${id}`, kind: 'CAMPAGNE_EPISODIQUE' };
}

const PARTIE_A = partie('A', MJ);
const PARTIE_B = partie('B', 'mj-b');
// Partie d'un système sans aucune capacité JDR (famille jdr, fermé à la création).
const PARTIE_D = partie('D', MJ, 'draconis');

function makePrisma() {
  return {
    partie: { findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    event: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    seance: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    character: { findUnique: jest.fn() },
    invitation: { findUnique: jest.fn() },
    inviteLink: { findUnique: jest.fn() },
    announcement: { findUnique: jest.fn() },
    membership: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    user: { findUnique: jest.fn() },
  };
}

/** Membres simulés : `PLAYER` est membre de A, personne d'autre n'est membre de rien. */
function membershipsOf(members: Record<string, string[]>) {
  return ({ where }: { where: { userId_partieId: { userId: string; partieId: string } } }) => {
    const { userId, partieId } = where.userId_partieId;
    return Promise.resolve(
      (members[partieId] ?? []).includes(userId) ? { userId, partieId } : null,
    );
  };
}

// Politique `jdr` ÉCRITE EN DUR, jamais dérivée de `JDR_POLICY` : c'est la référence contre
// laquelle la table de production est comparée. Basculer une seule cellule de `JDR_POLICY` fait
// échouer le test d'égalité ET les tests par cellule ci-dessous.

/** Actions réservées au propriétaire (MJ) : organiser et administrer. */
const MJ_ONLY: PermissionAction[] = [
  'PARTIE_UPDATE',
  'PARTIE_CONVERT_KIND',
  'PARTIE_CLOSE',
  'PARTIE_REOPEN',
  'PARTIE_DELETE',
  'PARTIE_MEMBER_REMOVE',
  'PARTIE_VISIBILITY_LOCKS_READ',
  'PARTIE_VISIBILITY_LOCKS_UPDATE',
  'PARTIE_COVER_UPDATE',
  'PARTIE_REFERENCE_ASSET_MJ_READ',
  // Story 46.4 : masquer une fenêtre de l'automate — le MJ seul.
  'SLOT_WINDOW_HIDE',
  'SCENARIO_CREATE',
  'SCENARIO_UPDATE',
  'SCENARIO_STATUS_CHANGE',
  'SCENARIO_DRAFTS_READ',
  'SCENARIO_DOCUMENT_UPLOAD',
  'SEANCE_ADD',
  'SEANCE_DELETE',
  'SEANCE_DATE_RESET',
  'SEANCE_CAPACITY_SET',
  'SEANCE_COMPTE_RENDU_SET',
  'SEANCE_PRACTICAL_INFO_SET',
  'SEANCE_POLL_CREATE',
  'POLL_CHOOSE',
  'POLL_OPTIONS_SET',
  'POLL_CLOSE',
  // Story 37.7 : capacités JDR et invitations
  'CHARACTER_XP_SET',
  'CHARACTER_SHEET_FIELD_SET',
  'CHARACTER_HISTORY_READ',
  'XP_DISTRIBUTION_CREATE',
  'XP_DISTRIBUTION_READ',
  'HOMME_DRAGON_MANAGE',
  'HOMME_DRAGON_READ',
  'HOMME_DRAGON_UNLINK',
  'GROUP_ROLE_ASSIGN',
  'GROUP_ROLE_UNASSIGN',
  'ANNOUNCEMENT_CREATE',
  'INVITATION_CREATE',
  'INVITATION_READ',
  'INVITATION_REVOKE',
  'INVITE_LINK_CREATE',
  'INVITE_LINK_READ',
  'INVITE_LINK_REVOKE',
];

/** Actions ouvertes au MJ ET aux membres : lire et participer. */
const MEMBER_ACTIONS: PermissionAction[] = [
  'PARTIE_READ',
  'PARTIE_MEMBERS_READ',
  'PARTIE_AVAILABILITY_READ',
  'PARTIE_COVER_READ',
  'SCENARIO_READ',
  'SCENARIO_DOCUMENTS_READ',
  'SCENARIO_PARTICIPATE',
  'SEANCE_INSCRIBE',
  'SEANCE_UNSUBSCRIBE',
  'POLL_READ',
  'POLL_VOTE',
  // Story 37.7
  'PARTIE_REFERENCE_ASSET_READ',
  'CHARACTER_CREATE',
  'CHARACTER_LIST',
  'CHARACTER_READ',
  'CHARACTER_PORTRAIT_READ',
  'CHARACTER_NOTES_READ',
  'GROUP_ROLE_READ',
  'ANNOUNCEMENT_READ',
  'ANNOUNCEMENT_MARK_READ',
];

/** Table action → capacité ÉCRITE EN DUR (Story 37.7), référence de `ACTION_CAPABILITY`. */
const CAPABILITY_BY_ACTION: Partial<Record<PermissionAction, GameSystemCapability>> = {
  CHARACTER_CREATE: 'characters',
  CHARACTER_XP_SET: 'xp',
  CHARACTER_SHEET_FIELD_SET: 'characters',
  XP_DISTRIBUTION_CREATE: 'xp',
  HOMME_DRAGON_MANAGE: 'hommeDragon',
  GROUP_ROLE_ASSIGN: 'groupRoles',
  ANNOUNCEMENT_CREATE: 'announcements',
};

/**
 * Actions de couche 3 qui n'exigent VOLONTAIREMENT aucune capacité (décision du 2026-10-10) : les
 * lectures renvoient vide / null sur un système sans la capacité, le retrait d'un lien et le
 * marquage d'une annonce lue restent possibles. Toute nouvelle action de couche 3 doit figurer soit
 * dans `CAPABILITY_BY_ACTION`, soit ici — jamais nulle part.
 */
const CAPABILITY_OPT_OUT: PermissionAction[] = [
  'CHARACTER_LIST',
  'CHARACTER_READ',
  'CHARACTER_PORTRAIT_READ',
  'CHARACTER_NOTES_READ',
  'CHARACTER_HISTORY_READ',
  'XP_DISTRIBUTION_READ',
  'HOMME_DRAGON_READ',
  'HOMME_DRAGON_UNLINK',
  'GROUP_ROLE_UNASSIGN',
  'GROUP_ROLE_READ',
  'ANNOUNCEMENT_READ',
  'ANNOUNCEMENT_MARK_READ',
];

/** Préfixes des actions de couche 3 (capacités JDR). */
const LAYER3_PREFIXES = ['CHARACTER_', 'XP_', 'HOMME_DRAGON_', 'GROUP_ROLE_', 'ANNOUNCEMENT_'];

const ACTIONS: PermissionAction[] = [...MJ_ONLY, ...MEMBER_ACTIONS];

/** Actions que la politique `jdr` n'ouvre à aucun rôle (Story 39.4) : nommer un administrateur et
 *  quitter l'office n'existent que pour la famille `ralliement`. Story 39.5 : quitter soi-même la
 *  partie non plus — en JDR, seul le MJ retire un joueur. */
const JDR_NOBODY: PermissionAction[] = [
  'PARTIE_MEMBER_ROLE_SET',
  'PARTIE_LEAVE',
  // Story 40.1 : proposer / lister les conjonctions d'un groupe — n'existe pas en JDR.
  'EVENT_CREATE',
  'EVENT_LIST',
  // Story 40.2 : modifier une conjonction — n'existe pas en JDR.
  'EVENT_UPDATE',
  // Story 42.1 : annuler une conjonction — n'existe pas en JDR.
  'EVENT_CANCEL',
  // Story 49.2 : apporter un jeu à une soirée — n'existe pas en JDR.
  'EVENT_GAME_BRING',
  // Story 49.4 : écarter un jeu de l'hôte pour une soirée — n'existe pas en JDR.
  'EVENT_GAME_EXCLUDE',
  // Story 49.5 : signaler une Envie sur un jeu d'une soirée — n'existe pas en JDR.
  'EVENT_GAME_ENVY',
  // Story 40.4 : réserver une place à un membre — n'existe pas en JDR.
  'SEANCE_RESERVE',
  // Story 40.7 : prolonger le vote d'une conjonction — n'existe pas en JDR.
  'POLL_EXTEND',
];

describe('PermissionService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: PermissionService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.partie.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ A: PARTIE_A, B: PARTIE_B, D: PARTIE_D }[where.id] ?? null),
    );
    prisma.membership.findUnique.mockImplementation(membershipsOf({ A: [PLAYER], D: [PLAYER] }));
    service = new PermissionService(prisma as unknown as PrismaService);
  });

  describe('politique jdr — table complète', () => {
    it('JDR_POLICY est exactement la politique écrite en dur (aucune action en plus ni en moins)', () => {
      const expected: Record<string, string[]> = {};
      for (const action of MJ_ONLY) expected[action] = ['mj'];
      for (const action of MEMBER_ACTIONS) expected[action] = ['mj', 'player'];
      for (const action of JDR_NOBODY) expected[action] = [];
      expect(JDR_POLICY).toEqual(expected);
    });

    it('ACTION_CAPABILITY est exactement la table écrite en dur (aucune action en plus ni en moins)', () => {
      expect(ACTION_CAPABILITY).toEqual(CAPABILITY_BY_ACTION);
    });

    it('toute action de couche 3 de la politique a une capacité OU figure dans la liste de dérogations nommée', () => {
      const layer3 = (Object.keys(JDR_POLICY) as PermissionAction[]).filter((action) =>
        LAYER3_PREFIXES.some((prefix) => action.startsWith(prefix)),
      );
      const unclassified = layer3.filter(
        (action) => !(action in ACTION_CAPABILITY) && !CAPABILITY_OPT_OUT.includes(action),
      );
      // Une action ajoutée à la politique sans choix explicite (capacité ou dérogation) échoue ici.
      expect(unclassified).toEqual([]);
    });

    it('une dérogation n’est jamais aussi dans ACTION_CAPABILITY, et désigne une action existante', () => {
      expect(CAPABILITY_OPT_OUT.filter((action) => action in ACTION_CAPABILITY)).toEqual([]);
      expect(CAPABILITY_OPT_OUT.filter((action) => !(action in JDR_POLICY))).toEqual([]);
    });

    it('la table de capacités ne contient que des écritures de couche 3', () => {
      const outside = (Object.keys(ACTION_CAPABILITY) as PermissionAction[]).filter(
        (action) => !LAYER3_PREFIXES.some((prefix) => action.startsWith(prefix)),
      );
      expect(outside).toEqual([]);
    });
  });

  describe('assert() — rôle mj', () => {
    it.each(ACTIONS)('%s : accordé au propriétaire, avec le rôle mj', async (action) => {
      const grant = await service.assert(MJ, action, { partieId: 'A' });
      expect(grant).toEqual(objectLike({ partieId: 'A', role: 'mj', partie: PARTIE_A }));
      // Le propriétaire n'a jamais besoin d'une ligne Membership.
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('assert() — rôle player (membre)', () => {
    it.each(MJ_ONLY)('%s : refusé à un membre — 403 « réservée au MJ »', async (action) => {
      const refusal = service.assert(PLAYER, action, { partieId: 'A' });
      await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
      await expect(refusal).rejects.toThrow(MJ_ONLY_MESSAGE);
    });

    it.each(MEMBER_ACTIONS)('%s : accordé à un membre, avec le rôle player', async (action) => {
      const grant = await service.assert(PLAYER, action, { partieId: 'A' });
      expect(grant).toEqual(objectLike({ partieId: 'A', role: 'player' }));
    });
  });

  describe('assert() — action fermée à tous en JDR (Story 39.4)', () => {
    it.each(JDR_NOBODY)('%s : refusé au MJ lui-même — 403', async (action) => {
      const refusal = service.assert(MJ, action, { partieId: 'A' });
      await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
      await expect(refusal).rejects.toThrow(MJ_ONLY_MESSAGE);
    });

    it.each(JDR_NOBODY)('%s : refusé à un membre — 403', async (action) => {
      await expect(service.assert(PLAYER, action, { partieId: 'A' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it.each(JDR_NOBODY)('%s : refusé à un non-membre — 403 « pas accès »', async (action) => {
      const refusal = service.assert(STRANGER, action, { partieId: 'A' });
      await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
      await expect(refusal).rejects.toThrow(NO_ACCESS_MESSAGE);
    });
  });

  describe('assert() — non-membre', () => {
    it.each(ACTIONS)('%s : refusé à un non-membre — 403 « pas accès »', async (action) => {
      const refusal = service.assert(STRANGER, action, { partieId: 'A' });
      await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
      await expect(refusal).rejects.toThrow(NO_ACCESS_MESSAGE);
    });
  });

  describe('assert() — cible introuvable (404, message historique)', () => {
    it('partie inconnue → 404 « Partie introuvable »', async () => {
      await expect(service.assert(MJ, 'PARTIE_READ', { partieId: 'zzz' })).rejects.toThrow(
        new NotFoundException('Partie introuvable'),
      );
    });

    it('événement inconnu → 404 « Scénario introuvable »', async () => {
      prisma.event.findUnique.mockResolvedValue(null);
      await expect(service.assert(MJ, 'SCENARIO_UPDATE', { eventId: 'zzz' })).rejects.toThrow(
        new NotFoundException('Scénario introuvable'),
      );
    });

    it.each([
      ['CHARACTER_READ', 'characterId', 'character', 'Personnage introuvable'],
      ['INVITATION_REVOKE', 'invitationId', 'invitation', 'Invitation introuvable'],
      ['INVITE_LINK_REVOKE', 'inviteLinkId', 'inviteLink', 'Lien introuvable'],
      ['ANNOUNCEMENT_MARK_READ', 'announcementId', 'announcement', 'Annonce introuvable'],
    ] as const)('%s : %s inconnu → 404 « %s »', async (action, key, model, message) => {
      prisma[model].findUnique.mockResolvedValue(null);
      await expect(service.assert(MJ, action, { [key]: 'zzz' } as never)).rejects.toThrow(
        new NotFoundException(message),
      );
    });

    it('séance inconnue → 404 « Séance introuvable »', async () => {
      prisma.seance.findUnique.mockResolvedValue(null);
      await expect(service.assert(MJ, 'SEANCE_DELETE', { seanceId: 'zzz' })).rejects.toThrow(
        new NotFoundException('Séance introuvable'),
      );
    });
  });

  describe('assert() — partie résolue depuis la cible (aucun IDOR)', () => {
    it('séance de la partie B visée par le MJ de A → 403, la partie B étant lue depuis la séance', async () => {
      prisma.seance.findUnique.mockResolvedValue({
        id: 'seance-b',
        event: { id: 'event-b', partie: PARTIE_B },
      });

      const refusal = service.assert(MJ, 'SEANCE_DELETE', { seanceId: 'seance-b' });
      await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
      await expect(refusal).rejects.toThrow(NO_ACCESS_MESSAGE);
      expect(prisma.seance.findUnique).toHaveBeenCalledWith(
        objectLike({ where: { id: 'seance-b' } }),
      );
      // Jamais la partie A : aucune lecture par identifiant de partie.
      expect(prisma.partie.findUnique).not.toHaveBeenCalled();
    });

    it('événement de la partie B visé par le MJ de A → 403', async () => {
      prisma.event.findUnique.mockResolvedValue({ id: 'event-b', partie: PARTIE_B });

      await expect(
        service.assert(MJ, 'SCENARIO_STATUS_CHANGE', { eventId: 'event-b' }),
      ).rejects.toThrow(NO_ACCESS_MESSAGE);
    });

    it.each([
      ['CHARACTER_XP_SET', 'characterId', 'character'],
      ['INVITATION_REVOKE', 'invitationId', 'invitation'],
      ['INVITE_LINK_REVOKE', 'inviteLinkId', 'inviteLink'],
      ['ANNOUNCEMENT_MARK_READ', 'announcementId', 'announcement'],
    ] as const)(
      '%s : %s d’une autre partie visé par le MJ de A → 403, la partie B étant lue depuis la cible',
      async (action, key, model) => {
        prisma[model].findUnique.mockResolvedValue({ id: 'cible-b', partie: PARTIE_B });

        const refusal = service.assert(MJ, action, { [key]: 'cible-b' } as never);
        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(NO_ACCESS_MESSAGE);
        // Jamais lue par identifiant de partie : la route n'a aucune part dans la décision.
        expect(prisma.partie.findUnique).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['CHARACTER_XP_SET', 'characterId', 'character'],
      ['INVITATION_REVOKE', 'invitationId', 'invitation'],
      ['INVITE_LINK_REVOKE', 'inviteLinkId', 'inviteLink'],
      ['ANNOUNCEMENT_MARK_READ', 'announcementId', 'announcement'],
    ] as const)(
      '%s : %s de sa propre partie → autorisation portant la cible résolue',
      async (action, key, model) => {
        prisma[model].findUnique.mockResolvedValue({ id: 'cible-a', partie: PARTIE_A });

        const grant = await service.assert(MJ, action, { [key]: 'cible-a' } as never);
        expect(grant).toEqual(
          objectLike({ partieId: 'A', role: 'mj', target: { partieId: 'A', [key]: 'cible-a' } }),
        );
      },
    );

    it('séance de sa propre partie → autorisation portant la partie résolue', async () => {
      prisma.seance.findUnique.mockResolvedValue({
        id: 'seance-a',
        event: { id: 'event-a', partie: PARTIE_A },
      });

      const grant = await service.assert(MJ, 'SEANCE_DELETE', { seanceId: 'seance-a' });
      // L'autorisation porte l'action contrôlée et la cible résolue (séance → son événement).
      expect(grant).toEqual(
        objectLike({
          partieId: 'A',
          role: 'mj',
          action: 'SEANCE_DELETE',
          target: { partieId: 'A', eventId: 'event-a', seanceId: 'seance-a' },
        }),
      );
    });

    it('membre de A, séance de A : action de membre accordée, action MJ refusée', async () => {
      prisma.seance.findUnique.mockResolvedValue({
        id: 'seance-a',
        event: { id: 'event-a', partie: PARTIE_A },
      });

      await expect(
        service.assert(PLAYER, 'SEANCE_INSCRIBE', { seanceId: 'seance-a' }),
      ).resolves.toEqual(objectLike({ partieId: 'A', role: 'player' }));
      await expect(
        service.assert(PLAYER, 'SEANCE_CAPACITY_SET', { seanceId: 'seance-a' }),
      ).rejects.toThrow(MJ_ONLY_MESSAGE);
    });
  });

  describe('assert() — garde de capacité (Story 37.7, AD-1)', () => {
    const CAPABILITY_ACTIONS = Object.entries(CAPABILITY_BY_ACTION) as [
      PermissionAction,
      GameSystemCapability,
    ][];

    it.each(CAPABILITY_ACTIONS)(
      '%s : le MJ d’une partie dont le système n’a pas la capacité « %s » → 400, avant toute écriture',
      async (action) => {
        const refusal = service.assert(MJ, action, { partieId: 'D' });
        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow(CAPABILITY_UNAVAILABLE_MESSAGE);
      },
    );

    it.each(CAPABILITY_ACTIONS)(
      '%s : le rôle est contrôlé AVANT la capacité (un étranger reçoit « pas accès », pas 400)',
      async (action) => {
        await expect(service.assert(STRANGER, action, { partieId: 'D' })).rejects.toThrow(
          NO_ACCESS_MESSAGE,
        );
      },
    );

    it('un membre sur une action MJ d’une partie sans capacité reçoit « réservée au MJ », pas 400', async () => {
      await expect(
        service.assert(PLAYER, 'XP_DISTRIBUTION_CREATE', { partieId: 'D' }),
      ).rejects.toThrow(MJ_ONLY_MESSAGE);
    });

    it('une action sans capacité requise reste accordée sur une partie sans capacité (scénario, invitations)', async () => {
      await expect(service.assert(MJ, 'SCENARIO_CREATE', { partieId: 'D' })).resolves.toEqual(
        objectLike({ partieId: 'D', role: 'mj' }),
      );
      await expect(service.assert(MJ, 'INVITATION_CREATE', { partieId: 'D' })).resolves.toEqual(
        objectLike({ partieId: 'D', role: 'mj' }),
      );
    });

    it.each(CAPABILITY_OPT_OUT)(
      '%s : accordé à son rôle sur une partie sans capacité (lecture, retrait, marquage)',
      async (action) => {
        // Le MJ a toujours le droit ; les actions ouvertes aux membres le sont aussi à un joueur.
        await expect(service.assert(MJ, action, { partieId: 'D' })).resolves.toEqual(
          objectLike({ partieId: 'D', role: 'mj' }),
        );
        if (JDR_POLICY[action].includes('player')) {
          await expect(service.assert(PLAYER, action, { partieId: 'D' })).resolves.toEqual(
            objectLike({ partieId: 'D', role: 'player' }),
          );
        }
      },
    );

    it('un système de la famille ralliement (aucune capacité) refuse aussi — par la politique (Story 38.2)', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie('R', MJ, 'ralliement'));
      // Le créateur (propriétaire sans ligne de membership ici) est `admin` : la politique du
      // ralliement n'ouvre l'action à aucun rôle, le refus précède la garde de capacité.
      await expect(service.assert(MJ, 'CHARACTER_CREATE', { partieId: 'R' })).rejects.toThrow(
        RALLIEMENT_UNAVAILABLE_MESSAGE,
      );
    });
  });

  // Story 38.2 — politique de la famille `ralliement` : « voir » pour l'admin et les membres,
  // « modifier la partie » pour l'admin seul, tout le reste refusé à tous. Table ÉCRITE EN DUR,
  // un test de refus par cellule (admin / membre / étranger).
  describe('politique ralliement — Story 38.2', () => {
    const ADMIN = 'admin-r';
    const MEMBRE = 'membre-r';
    const OWNER_SANS_LIGNE = 'proprio-r';
    const RALLIEMENT = partie('R', ADMIN, 'ralliement');

    /** Voir : admin + membre. */
    const RALLIEMENT_VIEW: PermissionAction[] = [
      'PARTIE_READ',
      'PARTIE_MEMBERS_READ',
      'PARTIE_COVER_READ',
      // Story 39.5 : quitter le groupe — l'administrateur comme le membre.
      'PARTIE_LEAVE',
      // Story 40.1 : proposer une conjonction (dont on est l'hôte) et lister celles du groupe.
      'EVENT_CREATE',
      'EVENT_LIST',
      // Story 40.3 : s'inscrire à une conjonction et s'en désinscrire (routes partagées avec le JDR).
      'SEANCE_INSCRIBE',
      'SEANCE_UNSUBSCRIBE',
      // Story 40.5 : voter sur le sondage de dates d'une conjonction (éligibilité décidée par le port).
      'POLL_VOTE',
      // Story 49.2 : apporter un de ses jeux — cellule ouverte à l'admin ET au membre ; « participant autre que
      // l'hôte » est décidé par `EventGameBringService`, sous le verrou de la soirée (testé à part).
      'EVENT_GAME_BRING',
      // Story 49.5 : signaler une Envie — cellule ouverte à l'admin ET au membre ; « participant, nom sur place »
      // est décidé par `EventGameEnvyService`, sous le verrou de la soirée (testé à part).
      'EVENT_GAME_ENVY',
    ];
    /** Story 40.2 : la cellule de rôle est ouverte à l'admin ET au membre, mais l'action vise un
     *  événement (`{ eventId }`) et n'est accordée qu'à son hôte — testée à part, sur cette cible. */
    const RALLIEMENT_HOST_ONLY: PermissionAction[] = [
      'EVENT_UPDATE',
      // Story 42.1 : annuler une conjonction — hôte OU administrateur (testé à part).
      'EVENT_CANCEL',
      'SEANCE_RESERVE',
      // Story 40.6 : fixer la date d'une conjonction (testé à part, sur la cible `{ eventId }`).
      'POLL_CHOOSE',
      // Story 40.7 : prolonger le vote d'une conjonction (testé à part, sur la cible `{ eventId }`).
      'POLL_EXTEND',
      // Story 49.4 : écarter un jeu de l'hôte pour une soirée — hôte seul (testé à part, cible `{ eventId }`).
      'EVENT_GAME_EXCLUDE',
    ];
    /** Modifier la partie, la clore, la rouvrir, la brûler (Story 39.1), inviter et retirer un
     *  membre (Story 39.3) : admin seul. */
    const RALLIEMENT_ADMIN_ONLY: PermissionAction[] = [
      'PARTIE_UPDATE',
      'PARTIE_COVER_UPDATE',
      'PARTIE_CLOSE',
      'PARTIE_REOPEN',
      'PARTIE_DELETE',
      // Story 39.3 : inviter (pseudo, e-mail, lien), lister, révoquer, retirer un membre.
      'PARTIE_MEMBER_REMOVE',
      // Story 39.4 : nommer un administrateur, quitter l'office.
      'PARTIE_MEMBER_ROLE_SET',
      'INVITATION_CREATE',
      'INVITATION_READ',
      'INVITATION_REVOKE',
      'INVITE_LINK_CREATE',
      'INVITE_LINK_READ',
      'INVITE_LINK_REVOKE',
    ];
    /** Tout le reste : aucun rôle. */
    const RALLIEMENT_NOBODY: PermissionAction[] = ACTIONS.filter(
      (a) =>
        !RALLIEMENT_VIEW.includes(a) &&
        !RALLIEMENT_ADMIN_ONLY.includes(a) &&
        !RALLIEMENT_HOST_ONLY.includes(a),
    );

    beforeEach(() => {
      prisma.partie.findUnique.mockResolvedValue(RALLIEMENT);
      prisma.membership.findUnique.mockImplementation(
        ({ where }: { where: { userId_partieId: { userId: string } } }) => {
          const { userId } = where.userId_partieId;
          if (userId === ADMIN) return Promise.resolve({ userId, role: 'ADMIN' });
          if (userId === MEMBRE) return Promise.resolve({ userId, role: 'MEMBER' });
          return Promise.resolve(null);
        },
      );
    });

    it('RALLIEMENT_POLICY est exactement la politique écrite en dur', () => {
      const expected: Record<string, string[]> = {};
      for (const action of RALLIEMENT_VIEW) expected[action] = ['admin', 'member'];
      for (const action of RALLIEMENT_HOST_ONLY) expected[action] = ['admin', 'member'];
      for (const action of RALLIEMENT_ADMIN_ONLY) expected[action] = ['admin'];
      for (const action of RALLIEMENT_NOBODY) expected[action] = [];
      expect(RALLIEMENT_POLICY).toEqual(expected);
      expect(Object.keys(RALLIEMENT_POLICY).sort()).toEqual(Object.keys(JDR_POLICY).sort());
    });

    it.each([...RALLIEMENT_VIEW, ...RALLIEMENT_ADMIN_ONLY])(
      '%s : accordé à l’admin, avec le rôle admin (jamais mj)',
      async (action) => {
        const grant = await service.assert(ADMIN, action, { partieId: 'R' });
        expect(grant).toEqual(objectLike({ partieId: 'R', role: 'admin' }));
      },
    );

    it.each(RALLIEMENT_VIEW)('%s : accordé à un membre, avec le rôle member', async (action) => {
      const grant = await service.assert(MEMBRE, action, { partieId: 'R' });
      expect(grant).toEqual(objectLike({ partieId: 'R', role: 'member' }));
    });

    it.each(RALLIEMENT_ADMIN_ONLY)(
      '%s : refusé à un membre — 403 « réservée aux administrateurs »',
      async (action) => {
        const refusal = service.assert(MEMBRE, action, { partieId: 'R' });
        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(ADMIN_ONLY_MESSAGE);
      },
    );

    it.each(RALLIEMENT_NOBODY)(
      '%s : refusé à l’admin — 403 « indisponible pour ce type de partie »',
      async (action) => {
        const refusal = service.assert(ADMIN, action, { partieId: 'R' });
        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(RALLIEMENT_UNAVAILABLE_MESSAGE);
      },
    );

    it.each(RALLIEMENT_NOBODY)(
      '%s : refusé à un membre — 403 « indisponible pour ce type de partie »',
      async (action) => {
        const refusal = service.assert(MEMBRE, action, { partieId: 'R' });
        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(RALLIEMENT_UNAVAILABLE_MESSAGE);
      },
    );

    it.each([...ACTIONS, ...JDR_NOBODY])(
      '%s : refusé à un étranger — 403 « pas accès »',
      async (action) => {
        const refusal = service.assert(STRANGER, action, { partieId: 'R' });
        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(NO_ACCESS_MESSAGE);
      },
    );

    // Story 40.2 — EVENT_UPDATE : cellule de rôle ouverte, règle « hôte » décidée dans assert().
    describe('EVENT_UPDATE — hôte de la conjonction seul', () => {
      const event = (ownerId: string | null) => ({ id: 'ev-1', ownerId, partie: RALLIEMENT });

      it('accordé à l’hôte, qu’il soit membre ou administrateur', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(service.assert(MEMBRE, 'EVENT_UPDATE', { eventId: 'ev-1' })).resolves.toEqual(
          objectLike({ partieId: 'R', role: 'member' }),
        );
        prisma.event.findUnique.mockResolvedValue(event(ADMIN));
        await expect(service.assert(ADMIN, 'EVENT_UPDATE', { eventId: 'ev-1' })).resolves.toEqual(
          objectLike({ partieId: 'R', role: 'admin' }),
        );
      });

      it('refusé à un autre membre — 403 « réservée à l’hôte »', async () => {
        prisma.event.findUnique.mockResolvedValue(event(ADMIN));
        const refusal = service.assert(MEMBRE, 'EVENT_UPDATE', { eventId: 'ev-1' });
        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(HOST_ONLY_MESSAGE);
      });

      it('refusé à un administrateur qui n’est pas l’hôte — 403 « réservée à l’hôte »', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(service.assert(ADMIN, 'EVENT_UPDATE', { eventId: 'ev-1' })).rejects.toThrow(
          HOST_ONLY_MESSAGE,
        );
      });

      it('refusé à tous quand l’hôte a disparu (ownerId null)', async () => {
        prisma.event.findUnique.mockResolvedValue(event(null));
        await expect(service.assert(ADMIN, 'EVENT_UPDATE', { eventId: 'ev-1' })).rejects.toThrow(
          HOST_ONLY_MESSAGE,
        );
      });

      it('refusé sur une cible sans événement (partie) — jamais accordé faute d’hôte', async () => {
        await expect(service.assert(ADMIN, 'EVENT_UPDATE', { partieId: 'R' })).rejects.toThrow(
          HOST_ONLY_MESSAGE,
        );
      });

      it('refusé à un étranger — 403 « pas accès » (avant la règle hôte)', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(service.assert(STRANGER, 'EVENT_UPDATE', { eventId: 'ev-1' })).rejects.toThrow(
          NO_ACCESS_MESSAGE,
        );
      });

      it('événement inconnu → 404', async () => {
        prisma.event.findUnique.mockResolvedValue(null);
        await expect(
          service.assert(ADMIN, 'EVENT_UPDATE', { eventId: 'zzz' }),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    // Story 42.1 — EVENT_CANCEL : cellule de rôle ouverte, règle « hôte OU administrateur » décidée dans assert().
    describe('EVENT_CANCEL — hôte de la conjonction ou administrateur du groupe', () => {
      const event = (ownerId: string | null) => ({ id: 'ev-1', ownerId, partie: RALLIEMENT });

      it('accordé à l’hôte membre', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(service.assert(MEMBRE, 'EVENT_CANCEL', { eventId: 'ev-1' })).resolves.toEqual(
          objectLike({ partieId: 'R', role: 'member' }),
        );
      });

      it('accordé à un administrateur qui n’est pas l’hôte', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(service.assert(ADMIN, 'EVENT_CANCEL', { eventId: 'ev-1' })).resolves.toEqual(
          objectLike({ partieId: 'R', role: 'admin' }),
        );
      });

      it('accordé à un administrateur quand l’hôte a disparu (ownerId null)', async () => {
        prisma.event.findUnique.mockResolvedValue(event(null));
        await expect(service.assert(ADMIN, 'EVENT_CANCEL', { eventId: 'ev-1' })).resolves.toEqual(
          objectLike({ partieId: 'R', role: 'admin' }),
        );
      });

      it('refusé à un membre qui n’est pas l’hôte — 403', async () => {
        prisma.event.findUnique.mockResolvedValue(event(ADMIN));
        const refusal = service.assert(MEMBRE, 'EVENT_CANCEL', { eventId: 'ev-1' });
        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(HOST_OR_ADMIN_ONLY_MESSAGE);
      });

      it('refusé à un membre quand l’hôte a disparu (ownerId null)', async () => {
        prisma.event.findUnique.mockResolvedValue(event(null));
        await expect(service.assert(MEMBRE, 'EVENT_CANCEL', { eventId: 'ev-1' })).rejects.toThrow(
          HOST_OR_ADMIN_ONLY_MESSAGE,
        );
      });

      it('refusé à un membre sur une cible sans événement (partie)', async () => {
        await expect(service.assert(MEMBRE, 'EVENT_CANCEL', { partieId: 'R' })).rejects.toThrow(
          HOST_OR_ADMIN_ONLY_MESSAGE,
        );
      });

      it('refusé à un étranger — 403 « pas accès » (avant la règle hôte ou administrateur)', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(service.assert(STRANGER, 'EVENT_CANCEL', { eventId: 'ev-1' })).rejects.toThrow(
          NO_ACCESS_MESSAGE,
        );
      });

      it('événement inconnu → 404', async () => {
        prisma.event.findUnique.mockResolvedValue(null);
        await expect(
          service.assert(ADMIN, 'EVENT_CANCEL', { eventId: 'zzz' }),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    // Story 49.2 — EVENT_GAME_BRING : cellule de rôle ouverte à l'admin et au membre, sans règle « hôte » :
    // « participant autre que l'hôte » est décidé sous le verrou de la soirée, par EventGameBringService.
    describe('EVENT_GAME_BRING — tout membre du groupe, sans règle d’hôte', () => {
      const event = (ownerId: string | null) => ({ id: 'ev-1', ownerId, partie: RALLIEMENT });

      it('accordé à un membre qui n’est pas l’hôte', async () => {
        prisma.event.findUnique.mockResolvedValue(event(ADMIN));
        await expect(
          service.assert(MEMBRE, 'EVENT_GAME_BRING', { eventId: 'ev-1' }),
        ).resolves.toEqual(objectLike({ partieId: 'R', role: 'member' }));
      });

      it('accordé à un administrateur', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(
          service.assert(ADMIN, 'EVENT_GAME_BRING', { eventId: 'ev-1' }),
        ).resolves.toEqual(objectLike({ partieId: 'R', role: 'admin' }));
      });

      it('refusé à un étranger — 403 « pas accès »', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(
          service.assert(STRANGER, 'EVENT_GAME_BRING', { eventId: 'ev-1' }),
        ).rejects.toThrow(NO_ACCESS_MESSAGE);
      });

      it('événement inconnu → 404', async () => {
        prisma.event.findUnique.mockResolvedValue(null);
        await expect(
          service.assert(MEMBRE, 'EVENT_GAME_BRING', { eventId: 'zzz' }),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    // Story 49.5 — EVENT_GAME_ENVY : même cellule que EVENT_GAME_BRING, sans règle « hôte » : « participant de la
    // soirée, nom sur place » est décidé sous le verrou de la soirée, par EventGameEnvyService.
    describe('EVENT_GAME_ENVY — tout membre du groupe, sans règle d’hôte', () => {
      const event = (ownerId: string | null) => ({ id: 'ev-1', ownerId, partie: RALLIEMENT });

      it('accordé à un membre qui n’est pas l’hôte', async () => {
        prisma.event.findUnique.mockResolvedValue(event(ADMIN));
        await expect(
          service.assert(MEMBRE, 'EVENT_GAME_ENVY', { eventId: 'ev-1' }),
        ).resolves.toEqual(objectLike({ partieId: 'R', role: 'member' }));
      });

      it('accordé à un administrateur', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(
          service.assert(ADMIN, 'EVENT_GAME_ENVY', { eventId: 'ev-1' }),
        ).resolves.toEqual(objectLike({ partieId: 'R', role: 'admin' }));
      });

      it('accordé à l’hôte lui-même (il a aussi envie de jouer)', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(
          service.assert(MEMBRE, 'EVENT_GAME_ENVY', { eventId: 'ev-1' }),
        ).resolves.toEqual(objectLike({ partieId: 'R', role: 'member' }));
      });

      it('refusé à un étranger — 403 « pas accès »', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(
          service.assert(STRANGER, 'EVENT_GAME_ENVY', { eventId: 'ev-1' }),
        ).rejects.toThrow(NO_ACCESS_MESSAGE);
      });

      it('événement inconnu → 404', async () => {
        prisma.event.findUnique.mockResolvedValue(null);
        await expect(
          service.assert(MEMBRE, 'EVENT_GAME_ENVY', { eventId: 'zzz' }),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    // Story 49.4 — EVENT_GAME_EXCLUDE : cellule de rôle ouverte, règle « hôte » décidée dans assert().
    describe('EVENT_GAME_EXCLUDE — hôte de la soirée seul', () => {
      const event = (ownerId: string | null) => ({ id: 'ev-1', ownerId, partie: RALLIEMENT });

      it('accordé à l’hôte, qu’il soit membre ou administrateur', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(
          service.assert(MEMBRE, 'EVENT_GAME_EXCLUDE', { eventId: 'ev-1' }),
        ).resolves.toEqual(objectLike({ partieId: 'R', role: 'member' }));
        prisma.event.findUnique.mockResolvedValue(event(ADMIN));
        await expect(
          service.assert(ADMIN, 'EVENT_GAME_EXCLUDE', { eventId: 'ev-1' }),
        ).resolves.toEqual(objectLike({ partieId: 'R', role: 'admin' }));
      });

      it('refusé à un autre membre — 403 « réservée à l’hôte »', async () => {
        prisma.event.findUnique.mockResolvedValue(event(ADMIN));
        const refusal = service.assert(MEMBRE, 'EVENT_GAME_EXCLUDE', { eventId: 'ev-1' });
        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(HOST_ONLY_MESSAGE);
      });

      it('refusé à un administrateur qui n’est pas l’hôte — 403 « réservée à l’hôte »', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(
          service.assert(ADMIN, 'EVENT_GAME_EXCLUDE', { eventId: 'ev-1' }),
        ).rejects.toThrow(HOST_ONLY_MESSAGE);
      });

      it('refusé à tous quand l’hôte a disparu (ownerId null)', async () => {
        prisma.event.findUnique.mockResolvedValue(event(null));
        await expect(
          service.assert(ADMIN, 'EVENT_GAME_EXCLUDE', { eventId: 'ev-1' }),
        ).rejects.toThrow(HOST_ONLY_MESSAGE);
      });

      it('refusé à un étranger — 403 « pas accès » (avant la règle hôte)', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(
          service.assert(STRANGER, 'EVENT_GAME_EXCLUDE', { eventId: 'ev-1' }),
        ).rejects.toThrow(NO_ACCESS_MESSAGE);
      });

      it('événement inconnu → 404', async () => {
        prisma.event.findUnique.mockResolvedValue(null);
        await expect(
          service.assert(ADMIN, 'EVENT_GAME_EXCLUDE', { eventId: 'zzz' }),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    // Story 40.4 — SEANCE_RESERVE : cellule de rôle ouverte, règle « hôte » décidée dans assert() sur
    // une cible `{ seanceId }` (l'hôte est celui de l'événement de la séance).
    describe('SEANCE_RESERVE — hôte de la conjonction seul, cible séance', () => {
      const seance = (ownerId: string | null) => ({
        id: 'se-1',
        event: { id: 'ev-1', ownerId, partie: RALLIEMENT },
      });

      it('accordé à l’hôte de l’événement de la séance, qu’il soit membre ou administrateur', async () => {
        prisma.seance.findUnique.mockResolvedValue(seance(MEMBRE));
        await expect(
          service.assert(MEMBRE, 'SEANCE_RESERVE', { seanceId: 'se-1' }),
        ).resolves.toEqual(
          objectLike({
            partieId: 'R',
            role: 'member',
            target: { partieId: 'R', eventId: 'ev-1', seanceId: 'se-1' },
          }),
        );
        prisma.seance.findUnique.mockResolvedValue(seance(ADMIN));
        await expect(
          service.assert(ADMIN, 'SEANCE_RESERVE', { seanceId: 'se-1' }),
        ).resolves.toEqual(objectLike({ partieId: 'R', role: 'admin' }));
      });

      it('refusé à un autre membre — 403 « réservée à l’hôte »', async () => {
        prisma.seance.findUnique.mockResolvedValue(seance(ADMIN));
        const refusal = service.assert(MEMBRE, 'SEANCE_RESERVE', { seanceId: 'se-1' });
        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(HOST_ONLY_MESSAGE);
      });

      it('refusé à un administrateur qui n’est pas l’hôte — 403 « réservée à l’hôte »', async () => {
        prisma.seance.findUnique.mockResolvedValue(seance(MEMBRE));
        await expect(service.assert(ADMIN, 'SEANCE_RESERVE', { seanceId: 'se-1' })).rejects.toThrow(
          HOST_ONLY_MESSAGE,
        );
      });

      it('refusé à tous quand l’hôte a disparu (ownerId null)', async () => {
        prisma.seance.findUnique.mockResolvedValue(seance(null));
        await expect(service.assert(ADMIN, 'SEANCE_RESERVE', { seanceId: 'se-1' })).rejects.toThrow(
          HOST_ONLY_MESSAGE,
        );
      });

      it('refusé sur une cible sans événement (partie) — jamais accordé faute d’hôte', async () => {
        await expect(service.assert(ADMIN, 'SEANCE_RESERVE', { partieId: 'R' })).rejects.toThrow(
          HOST_ONLY_MESSAGE,
        );
      });

      it('refusé à un étranger — 403 « pas accès » (avant la règle hôte)', async () => {
        prisma.seance.findUnique.mockResolvedValue(seance(MEMBRE));
        await expect(
          service.assert(STRANGER, 'SEANCE_RESERVE', { seanceId: 'se-1' }),
        ).rejects.toThrow(NO_ACCESS_MESSAGE);
      });

      it('séance inconnue → 404', async () => {
        prisma.seance.findUnique.mockResolvedValue(null);
        await expect(
          service.assert(ADMIN, 'SEANCE_RESERVE', { seanceId: 'zzz' }),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('JDR : refusé même au propriétaire (le MJ) — la réservation n’existe pas', async () => {
        prisma.seance.findUnique.mockResolvedValue({
          id: 'se-1',
          event: { id: 'ev-1', ownerId: MJ, partie: PARTIE_A },
        });
        await expect(
          service.assert(MJ, 'SEANCE_RESERVE', { seanceId: 'se-1' }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    // Story 40.6 — POLL_CHOOSE : cellule de rôle ouverte aux membres, règle « hôte » décidée dans assert()
    // sur la cible `{ eventId }` (l'événement du sondage). Cible `{ partieId }` : cellule seule.
    describe('POLL_CHOOSE — hôte de la conjonction seul, cible événement', () => {
      const event = (ownerId: string | null) => ({ id: 'ev-1', ownerId, partie: RALLIEMENT });

      it('accordé à l’hôte, qu’il soit membre ou administrateur', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(service.assert(MEMBRE, 'POLL_CHOOSE', { eventId: 'ev-1' })).resolves.toEqual(
          objectLike({ partieId: 'R', role: 'member' }),
        );
        prisma.event.findUnique.mockResolvedValue(event(ADMIN));
        await expect(service.assert(ADMIN, 'POLL_CHOOSE', { eventId: 'ev-1' })).resolves.toEqual(
          objectLike({ partieId: 'R', role: 'admin' }),
        );
      });

      it('refusé à un autre membre — 403 « réservée à l’hôte »', async () => {
        prisma.event.findUnique.mockResolvedValue(event(ADMIN));
        const refusal = service.assert(MEMBRE, 'POLL_CHOOSE', { eventId: 'ev-1' });
        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(HOST_ONLY_MESSAGE);
      });

      it('refusé à un administrateur qui n’est pas l’hôte — 403 « réservée à l’hôte »', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(service.assert(ADMIN, 'POLL_CHOOSE', { eventId: 'ev-1' })).rejects.toThrow(
          HOST_ONLY_MESSAGE,
        );
      });

      it('refusé à tous quand l’hôte a disparu (ownerId null)', async () => {
        prisma.event.findUnique.mockResolvedValue(event(null));
        await expect(service.assert(ADMIN, 'POLL_CHOOSE', { eventId: 'ev-1' })).rejects.toThrow(
          HOST_ONLY_MESSAGE,
        );
      });

      it('refusé à un étranger — 403 « pas accès » (avant la règle hôte)', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(service.assert(STRANGER, 'POLL_CHOOSE', { eventId: 'ev-1' })).rejects.toThrow(
          NO_ACCESS_MESSAGE,
        );
      });

      it('événement inconnu → 404', async () => {
        prisma.event.findUnique.mockResolvedValue(null);
        await expect(
          service.assert(ADMIN, 'POLL_CHOOSE', { eventId: 'zzz' }),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('cible { partieId } : cellule de rôle seule (premier contrôle de la route partagée), étranger refusé', async () => {
        await expect(service.assert(MEMBRE, 'POLL_CHOOSE', { partieId: 'R' })).resolves.toEqual(
          objectLike({ partieId: 'R', role: 'member' }),
        );
        await expect(service.assert(STRANGER, 'POLL_CHOOSE', { partieId: 'R' })).rejects.toThrow(
          NO_ACCESS_MESSAGE,
        );
      });

      it('JDR : le propriétaire (MJ) décide, quelle que soit la cible — la règle « hôte » ne s’y applique pas', async () => {
        prisma.event.findUnique.mockResolvedValue({
          id: 'ev-1',
          ownerId: 'quelquun-d-autre',
          partie: PARTIE_A,
        });
        await expect(service.assert(MJ, 'POLL_CHOOSE', { eventId: 'ev-1' })).resolves.toEqual(
          objectLike({ partieId: 'A', role: 'mj' }),
        );
      });
    });

    // Story 40.7 — POLL_EXTEND : cellule de rôle ouverte aux membres, règle « hôte » décidée dans assert()
    // sur la cible `{ eventId }` (l'événement du sondage). Cible `{ partieId }` : cellule seule.
    describe('POLL_EXTEND — hôte de la conjonction seul, cible événement', () => {
      const event = (ownerId: string | null) => ({ id: 'ev-1', ownerId, partie: RALLIEMENT });

      it('accordé à l’hôte, qu’il soit membre ou administrateur', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(service.assert(MEMBRE, 'POLL_EXTEND', { eventId: 'ev-1' })).resolves.toEqual(
          objectLike({ partieId: 'R', role: 'member' }),
        );
        prisma.event.findUnique.mockResolvedValue(event(ADMIN));
        await expect(service.assert(ADMIN, 'POLL_EXTEND', { eventId: 'ev-1' })).resolves.toEqual(
          objectLike({ partieId: 'R', role: 'admin' }),
        );
      });

      it('refusé à un autre membre — 403 « réservée à l’hôte »', async () => {
        prisma.event.findUnique.mockResolvedValue(event(ADMIN));
        const refusal = service.assert(MEMBRE, 'POLL_EXTEND', { eventId: 'ev-1' });
        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(HOST_ONLY_MESSAGE);
      });

      it('refusé à un administrateur qui n’est pas l’hôte — 403 « réservée à l’hôte »', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(service.assert(ADMIN, 'POLL_EXTEND', { eventId: 'ev-1' })).rejects.toThrow(
          HOST_ONLY_MESSAGE,
        );
      });

      it('refusé à tous quand l’hôte a disparu (ownerId null)', async () => {
        prisma.event.findUnique.mockResolvedValue(event(null));
        await expect(service.assert(ADMIN, 'POLL_EXTEND', { eventId: 'ev-1' })).rejects.toThrow(
          HOST_ONLY_MESSAGE,
        );
      });

      it('refusé à un étranger — 403 « pas accès » (avant la règle hôte)', async () => {
        prisma.event.findUnique.mockResolvedValue(event(MEMBRE));
        await expect(service.assert(STRANGER, 'POLL_EXTEND', { eventId: 'ev-1' })).rejects.toThrow(
          NO_ACCESS_MESSAGE,
        );
      });

      it('événement inconnu → 404', async () => {
        prisma.event.findUnique.mockResolvedValue(null);
        await expect(
          service.assert(ADMIN, 'POLL_EXTEND', { eventId: 'zzz' }),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('cible { partieId } : cellule de rôle seule (premier contrôle de la route partagée), étranger refusé', async () => {
        await expect(service.assert(MEMBRE, 'POLL_EXTEND', { partieId: 'R' })).resolves.toEqual(
          objectLike({ partieId: 'R', role: 'member' }),
        );
        await expect(service.assert(STRANGER, 'POLL_EXTEND', { partieId: 'R' })).rejects.toThrow(
          NO_ACCESS_MESSAGE,
        );
      });

      it('JDR : la cellule est fermée, même au propriétaire (MJ) — la capacité n’existe pas', async () => {
        prisma.event.findUnique.mockResolvedValue({
          id: 'ev-1',
          ownerId: 'quelquun-d-autre',
          partie: PARTIE_A,
        });
        await expect(service.assert(MJ, 'POLL_EXTEND', { eventId: 'ev-1' })).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      });
    });

    it('un propriétaire sans ligne de membership compte comme admin, jamais mj', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie('R', OWNER_SANS_LIGNE, 'ralliement'));
      const grant = await service.assert(OWNER_SANS_LIGNE, 'PARTIE_UPDATE', { partieId: 'R' });
      expect(grant.role).toBe('admin');
    });

    it('le rôle vient de la ligne de membership uniquement : propriétaire déclaré MEMBER → member', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie('R', MEMBRE, 'ralliement'));
      const grant = await service.assert(MEMBRE, 'PARTIE_READ', { partieId: 'R' });
      expect(grant.role).toBe('member');
    });

    it('roleOf : admin / member / propriétaire sans ligne → admin / étranger → null', async () => {
      prisma.partie.findUnique.mockImplementation(() =>
        Promise.resolve({
          ownerId: OWNER_SANS_LIGNE,
          gameSystemId: 'ralliement',
          memberships: [],
        }),
      );
      expect(await service.roleOf('R', OWNER_SANS_LIGNE)).toBe('admin');
      expect(await service.roleOf('R', STRANGER)).toBeNull();

      prisma.partie.findUnique.mockResolvedValue({
        ownerId: ADMIN,
        gameSystemId: 'ralliement',
        memberships: [{ role: 'ADMIN' }],
      });
      expect(await service.roleOf('R', ADMIN)).toBe('admin');

      prisma.partie.findUnique.mockResolvedValue({
        ownerId: ADMIN,
        gameSystemId: 'ralliement',
        memberships: [{ role: 'MEMBER' }],
      });
      expect(await service.roleOf('R', MEMBRE)).toBe('member');
    });

    it('rolesOf : un lot mixte jdr / ralliement, une seule requête', async () => {
      prisma.partie.findMany.mockResolvedValue([
        { id: 'J', ownerId: 'u', gameSystemId: 'ryuutama', memberships: [] },
        { id: 'K', ownerId: 'autre', gameSystemId: 'ryuutama', memberships: [{ role: 'MEMBER' }] },
        { id: 'R1', ownerId: 'u', gameSystemId: 'ralliement', memberships: [{ role: 'ADMIN' }] },
        { id: 'R2', ownerId: 'u', gameSystemId: 'ralliement', memberships: [] },
        {
          id: 'R3',
          ownerId: 'autre',
          gameSystemId: 'ralliement',
          memberships: [{ role: 'MEMBER' }],
        },
      ]);
      const roles = await service.rolesOf('u', ['J', 'K', 'R1', 'R2', 'R3']);
      expect(Object.fromEntries(roles)).toEqual({
        J: 'mj',
        K: 'player',
        R1: 'admin',
        R2: 'admin',
        R3: 'member',
      });
      expect(prisma.partie.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('partie sans propriétaire (ownerId null, AD-5)', () => {
    const ORPHAN = partie('O', null);

    beforeEach(() => {
      prisma.partie.findUnique.mockResolvedValue(ORPHAN);
      prisma.membership.findUnique.mockImplementation(membershipsOf({ O: [PLAYER] }));
    });

    it('un membre garde ses droits de membre, mais n’est jamais mj', async () => {
      await expect(service.assert(PLAYER, 'PARTIE_READ', { partieId: 'O' })).resolves.toEqual(
        objectLike({ role: 'player' }),
      );
      await expect(service.assert(PLAYER, 'PARTIE_UPDATE', { partieId: 'O' })).rejects.toThrow(
        MJ_ONLY_MESSAGE,
      );
    });

    it('personne n’est mj : un non-membre est refusé, même pour une action MJ', async () => {
      await expect(service.assert(STRANGER, 'PARTIE_UPDATE', { partieId: 'O' })).rejects.toThrow(
        NO_ACCESS_MESSAGE,
      );
    });

    it('roleOf : membre → player, autre → null', async () => {
      prisma.partie.findUnique.mockResolvedValueOnce({
        ownerId: null,
        memberships: [{ userId: PLAYER }],
      });
      expect(await service.roleOf('O', PLAYER)).toBe('player');

      prisma.partie.findUnique.mockResolvedValueOnce({ ownerId: null, memberships: [] });
      expect(await service.roleOf('O', STRANGER)).toBeNull();
    });
  });

  describe('roleOf()', () => {
    it('propriétaire → mj, membre → player, autre → null, partie inconnue → null (une requête)', async () => {
      prisma.partie.findUnique.mockImplementation(
        ({ where }: { where: { id: string; memberships?: unknown } }) =>
          Promise.resolve(where.id === 'A' ? { ownerId: MJ, memberships: [] } : null),
      );
      expect(await service.roleOf('A', MJ)).toBe('mj');
      expect(await service.roleOf('A', STRANGER)).toBeNull();
      expect(await service.roleOf('zzz', MJ)).toBeNull();

      prisma.partie.findUnique.mockResolvedValue({
        ownerId: MJ,
        memberships: [{ userId: PLAYER }],
      });
      expect(await service.roleOf('A', PLAYER)).toBe('player');
      // Une seule requête par appel : l'appartenance est jointe, jamais relue à part.
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('rolesOf() — lecture en lot', () => {
    it('{A: mj, B: player}, C absente — UNE seule requête', async () => {
      prisma.partie.findMany.mockResolvedValue([
        { id: 'A', ownerId: 'u' },
        { id: 'B', ownerId: 'quelqu-un' },
      ]);

      const roles = await service.rolesOf('u', ['A', 'B', 'C']);

      expect(Object.fromEntries(roles)).toEqual({ A: 'mj', B: 'player' });
      expect(roles.has('C')).toBe(false);
      expect(prisma.partie.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.partie.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['A', 'B', 'C'] },
          OR: [{ ownerId: 'u' }, { memberships: { some: { userId: 'u' } } }],
        },
        select: {
          id: true,
          ownerId: true,
          gameSystemId: true,
          memberships: { where: { userId: 'u' }, select: { role: true } },
        },
      });
      expect(prisma.partie.findUnique).not.toHaveBeenCalled();
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    });

    it('partie sans propriétaire retenue par le filtre → player, jamais mj', async () => {
      prisma.partie.findMany.mockResolvedValue([{ id: 'O', ownerId: null }]);
      expect(Object.fromEntries(await service.rolesOf('u', ['O']))).toEqual({ O: 'player' });
    });

    it('lot vide → aucune requête', async () => {
      expect((await service.rolesOf('u', [])).size).toBe(0);
      expect(prisma.partie.findMany).not.toHaveBeenCalled();
    });
  });

  describe('ownerOf()', () => {
    it('identité du propriétaire ; null sans propriétaire ou si son compte est absent', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: MJ, pseudo: 'mj', displayName: 'Le MJ' });
      expect(await service.ownerOf(PARTIE_A)).toEqual({
        userId: MJ,
        pseudo: 'mj',
        displayName: 'Le MJ',
      });

      expect(await service.ownerOf(partie('O', null))).toBeNull();

      prisma.user.findUnique.mockResolvedValueOnce(null);
      expect(await service.ownerOf(PARTIE_A)).toBeNull();
    });
  });

  describe('membersOf()', () => {
    it('propriétaire d’abord, puis membres dans l’ordre fixe de la troupe, dédoublonnés', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: MJ, pseudo: 'mj', displayName: 'Le MJ' });
      prisma.membership.findMany.mockResolvedValue([
        { user: { id: 'u1', pseudo: 'alice', displayName: 'Alice' } },
        { user: { id: MJ, pseudo: 'mj', displayName: 'Le MJ' } },
        { user: { id: 'u2', pseudo: 'bob', displayName: 'Bob' } },
      ]);

      const members = await service.membersOf(PARTIE_A);

      expect(members.map((m) => m.userId)).toEqual([MJ, 'u1', 'u2']);
      expect(prisma.membership.findMany).toHaveBeenCalledWith(
        objectLike({
          where: { partieId: 'A' },
          orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
        }),
      );
    });

    it('partie sans propriétaire → ses seuls membres, sans lecture d’utilisateur', async () => {
      prisma.membership.findMany.mockResolvedValue([
        { user: { id: 'u1', pseudo: 'alice', displayName: 'Alice' } },
      ]);

      const members = await service.membersOf(partie('O', null));

      expect(members).toEqual([{ userId: 'u1', pseudo: 'alice', displayName: 'Alice' }]);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  // Story 44.1 (AD-4) — `canMany` / `organizerCan` : MÊME décision que `assert()` (une seule fonction
  // de refus), lue en lot, sans rien lever.
  describe('canMany() / organizerCan() — Story 44.1', () => {
    const HOST = 'hote';
    const ADMIN = 'admin-r';
    const MEMBRE = 'membre-r';
    const GROUPE = partie('R', ADMIN, 'ralliement');
    const ALL = { propose: true, edit: true, choose: true, extend: true };
    const NONE = { propose: false, edit: false, choose: false, extend: false };

    // Événements : trois du groupe (hôte, autre hôte, hôte disparu) et un du JDR (A).
    const EVENTS: Record<string, { id: string; ownerId: string | null; partie: object }> = {
      'ev-hote': { id: 'ev-hote', ownerId: HOST, partie: GROUPE },
      'ev-autre': { id: 'ev-autre', ownerId: 'quelquun', partie: GROUPE },
      'ev-orphelin': { id: 'ev-orphelin', ownerId: null, partie: GROUPE },
      'ev-jdr': { id: 'ev-jdr', ownerId: MJ, partie: PARTIE_A },
    };
    const SEANCES: Record<string, { id: string; event: object }> = {
      'se-hote': { id: 'se-hote', event: { ...EVENTS['ev-hote'], partieId: 'R' } },
      'se-jdr': { id: 'se-jdr', event: { ...EVENTS['ev-jdr'], partieId: 'A' } },
    };
    const roleRows: Record<string, Record<string, 'ADMIN' | 'MEMBER'>> = {
      R: { [ADMIN]: 'ADMIN', [MEMBRE]: 'MEMBER', [HOST]: 'MEMBER' },
      A: { [PLAYER]: 'MEMBER' },
    };

    beforeEach(() => {
      const withPartieId = (e: { id: string; ownerId: string | null; partie: object }) => ({
        ...e,
        partieId: (e.partie as { id: string }).id,
      });
      prisma.event.findMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(
          where.id.in.flatMap((id) => (EVENTS[id] ? [withPartieId(EVENTS[id])] : [])),
        ),
      );
      prisma.seance.findMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(where.id.in.flatMap((id) => (SEANCES[id] ? [SEANCES[id]] : []))),
      );
      prisma.membership.findMany.mockImplementation(
        ({ where }: { where: { userId: string; partieId: { in: string[] } } }) =>
          Promise.resolve(
            where.partieId.in.flatMap((partieId) => {
              const role = roleRows[partieId]?.[where.userId];
              return role ? [{ partieId, role }] : [];
            }),
          ),
      );
      // `assert()` lit les mêmes données une cible à la fois.
      prisma.event.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(EVENTS[where.id] ?? null),
      );
      prisma.seance.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(SEANCES[where.id] ?? null),
      );
      prisma.membership.findUnique.mockImplementation(
        ({ where }: { where: { userId_partieId: { userId: string; partieId: string } } }) => {
          const { userId, partieId } = where.userId_partieId;
          const role = roleRows[partieId]?.[userId];
          return Promise.resolve(role ? { userId, partieId, role } : null);
        },
      );
    });

    it('conjonction : l’hôte a tous les droits, un administrateur qui n’est pas l’hôte aucun', async () => {
      const [mine, theirs] = await Promise.all([
        service.organizerCan(HOST, [{ eventId: 'ev-hote' }]),
        service.organizerCan(ADMIN, [{ eventId: 'ev-hote' }]),
      ]);
      expect(mine).toEqual([ALL]);
      expect(theirs).toEqual([NONE]);
    });

    it('conjonction : un simple membre, un étranger et l’hôte disparu (ownerId null) n’ont aucun droit', async () => {
      expect(await service.organizerCan(MEMBRE, [{ eventId: 'ev-hote' }])).toEqual([NONE]);
      expect(await service.organizerCan(STRANGER, [{ eventId: 'ev-hote' }])).toEqual([NONE]);
      expect(await service.organizerCan(ADMIN, [{ eventId: 'ev-orphelin' }])).toEqual([NONE]);
      expect(await service.organizerCan(HOST, [{ eventId: 'ev-orphelin' }])).toEqual([NONE]);
    });

    it('JDR : le MJ propose, modifie et fixe la date mais ne « prolonge » jamais ; un joueur et un étranger rien', async () => {
      const gm = { propose: true, edit: true, choose: true, extend: false };
      expect(await service.organizerCan(MJ, [{ seanceId: 'se-jdr' }])).toEqual([gm]);
      expect(await service.organizerCan(MJ, [{ eventId: 'ev-jdr' }])).toEqual([gm]);
      expect(await service.organizerCan(PLAYER, [{ seanceId: 'se-jdr' }])).toEqual([NONE]);
      expect(await service.organizerCan(STRANGER, [{ seanceId: 'se-jdr' }])).toEqual([NONE]);
    });

    it('cible inconnue : tous les drapeaux à faux, sans rien lever (ni 404, ni rien révéler)', async () => {
      await expect(
        service.organizerCan(MJ, [{ seanceId: 'inconnue' }, { eventId: 'inconnu' }]),
      ).resolves.toEqual([NONE, NONE]);
      await expect(service.canMany(MJ, 'POLL_CHOOSE', [{ eventId: 'inconnu' }])).resolves.toEqual([
        false,
      ]);
      await expect(service.organizerCan(MJ, [])).resolves.toEqual([]);
    });

    it('le résultat est aligné sur les cibles, quel que soit leur mélange', async () => {
      const result = await service.organizerCan(HOST, [
        { eventId: 'ev-autre' },
        { seanceId: 'se-hote' },
        { eventId: 'ev-hote' },
        { seanceId: 'inconnue' },
      ]);
      expect(result).toEqual([NONE, ALL, ALL, NONE]);
    });

    it('nombre de lectures FIXE : une cible ou beaucoup, les mêmes trois lectures groupées, aucune lecture unitaire', async () => {
      const reads = () =>
        prisma.event.findMany.mock.calls.length +
        prisma.seance.findMany.mock.calls.length +
        prisma.membership.findMany.mock.calls.length;
      const unitary = () =>
        prisma.event.findUnique.mock.calls.length +
        prisma.seance.findUnique.mock.calls.length +
        prisma.membership.findUnique.mock.calls.length +
        prisma.partie.findUnique.mock.calls.length;

      await service.organizerCan(HOST, [{ eventId: 'ev-hote' }]);
      const one = reads();
      prisma.event.findMany.mockClear();
      prisma.seance.findMany.mockClear();
      prisma.membership.findMany.mockClear();

      await service.organizerCan(HOST, [
        { eventId: 'ev-hote' },
        { eventId: 'ev-autre' },
        { eventId: 'ev-orphelin' },
        { eventId: 'ev-jdr' },
        { seanceId: 'se-hote' },
        { seanceId: 'se-jdr' },
      ]);
      expect(reads()).toBe(one);
      expect(reads()).toBeLessThanOrEqual(3);
      expect(unitary()).toBe(0);
    });

    it('une cible `{ partieId }` (hors type) n’ouvre rien : la règle « hôte » ne joue que sur un événement', async () => {
      const bad = [{ partieId: 'R' }] as unknown as Parameters<typeof service.organizerCan>[1];
      await expect(service.organizerCan(ADMIN, bad)).resolves.toEqual([NONE]);
    });

    // Le garde-fou de l'AD-4 : `canMany` n'est vrai QUE si `assert()` accorde — mêmes cibles, mêmes
    // personnes, mêmes actions. (La preuve contre les vraies routes est dans les tests e2e.)
    const ACTIONS_OF_CAN: PermissionAction[] = [
      'SEANCE_POLL_CREATE',
      'POLL_OPTIONS_SET',
      'POLL_CHOOSE',
      'POLL_EXTEND',
      'EVENT_UPDATE',
    ];
    const TARGETS = [
      { eventId: 'ev-hote' },
      { eventId: 'ev-autre' },
      { eventId: 'ev-orphelin' },
      { eventId: 'ev-jdr' },
      { seanceId: 'se-hote' },
      { seanceId: 'se-jdr' },
    ] as const;

    it.each(ACTIONS_OF_CAN)(
      '%s : canMany(...) === true ⇔ assert(...) n’est pas refusé, pour chaque personne et chaque cible',
      async (action) => {
        for (const user of [MJ, PLAYER, HOST, ADMIN, MEMBRE, STRANGER]) {
          const verdicts = await service.canMany(user, action, TARGETS);
          for (const [i, target] of TARGETS.entries()) {
            const granted = await service.assert(user, action, target).then(
              () => true,
              () => false,
            );
            expect({ user, target, action, can: verdicts[i] }).toEqual({
              user,
              target,
              action,
              can: granted,
            });
          }
        }
      },
    );
  });

  describe('assertLibraryRead() — LIBRARY_READ (Story 48.3)', () => {
    it('la personne elle-même : accordé sans aucune lecture', async () => {
      await expect(service.assertLibraryRead('u1', 'u1')).resolves.toBeUndefined();
      expect(prisma.partie.findFirst).not.toHaveBeenCalled();
    });

    it('une partie de ralliement partagée existe : accordé', async () => {
      prisma.partie.findFirst.mockResolvedValue({ id: 'groupe' });
      await expect(service.assertLibraryRead('u1', 'u2')).resolves.toBeUndefined();
    });

    it('aucune partie partagée : 404, message unique', async () => {
      prisma.partie.findFirst.mockResolvedValue(null);
      const err = await service.assertLibraryRead('u1', 'inconnu').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).message).toBe(LIBRARY_NOT_FOUND_MESSAGE);
    });

    it('la requête ne porte que sur la famille ralliement, membres ou rencontre isolée, invités PENDING', async () => {
      prisma.partie.findFirst.mockResolvedValue({ id: 'x' });
      await service.assertLibraryRead('u1', 'u2');

      const args = (prisma.partie.findFirst.mock.calls as unknown[][])[0][0];
      const json = JSON.stringify(args);
      // Jamais une partie de JDR : seuls les systèmes de la famille ralliement sont retenus.
      expect(json).toContain('"gameSystemId":{"in":["');
      expect(json).not.toContain('ryuutama');
      // Rencontre isolée uniquement pour l'ouverture « invité / hôte ».
      expect(json).toContain('"kind":"ONE_SHOT"');
      // Seule une invitation restée sans réponse ouvre.
      expect(json).toContain('"status":"PENDING"');
      expect(json).not.toContain('DECLINED');
      expect(json).not.toContain('REVOKED');
    });
  });
});
