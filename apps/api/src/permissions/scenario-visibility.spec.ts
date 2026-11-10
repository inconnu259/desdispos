import type { PartieKind, ScenarioStatus } from '@master-jdr/shared';
import {
  HIDDEN_DRAFT_POLL_WHERE,
  HIDDEN_DRAFT_SCENARIO_WHERE,
  HIDDEN_DRAFT_SEANCE_WHERE,
  RELEASED_ANNOUNCEMENT_WHERE,
  RELEASED_STATUSES,
  VISIBLE_POLL_WHERE,
  VISIBLE_SCENARIO_WHERE,
  VISIBLE_SEANCE_WHERE,
  isContentMasked,
  isGameMaster,
  isHiddenDraft,
  isSpoilRestricted,
  isRedactedForPlayer,
  isReleased,
} from './scenario-visibility';

const STATUSES: ScenarioStatus[] = ['BROUILLON', 'A_VENIR', 'COURANT', 'PASSE'];
const KINDS: PartieKind[] = ['ONE_SHOT', 'CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE'];

describe('scenario-visibility (anti-spoil serveur)', () => {
  describe('isSpoilRestricted', () => {
    it('le MJ voit tout ; tout autre rôle est restreint', () => {
      expect(isSpoilRestricted('player')).toBe(true);
      expect(isSpoilRestricted('mj')).toBe(false);
      expect(isGameMaster('mj')).toBe(true);
    });

    it('échoue FERMÉ : rôle inconnu, absent ou futur → restreint', () => {
      expect(isSpoilRestricted(undefined)).toBe(true);
      expect(isSpoilRestricted(null)).toBe(true);
      expect(isSpoilRestricted('admin')).toBe(true);
      expect(isSpoilRestricted('member')).toBe(true);
      expect(isSpoilRestricted('inconnu' as unknown as 'mj')).toBe(true);
      expect(isGameMaster(undefined)).toBe(false);
    });
  });

  describe('isHiddenDraft', () => {
    it.each(KINDS.flatMap((kind) => STATUSES.map((status) => [status, kind] as const)))(
      '%s / %s',
      (status, kind) => {
        // Brouillon caché = BROUILLON hors ONE_SHOT, et rien d'autre.
        expect(isHiddenDraft(status, kind)).toBe(status === 'BROUILLON' && kind !== 'ONE_SHOT');
      },
    );
  });

  describe('isContentMasked', () => {
    it.each(KINDS.flatMap((kind) => STATUSES.map((status) => [status, kind] as const)))(
      '%s / %s',
      (status, kind) => {
        // Contenu masqué = A_VENIR, ou brouillon de ONE_SHOT (exemption : listé mais masqué).
        const expected = status === 'A_VENIR' || (status === 'BROUILLON' && kind === 'ONE_SHOT');
        expect(isContentMasked(status, kind)).toBe(expected);
      },
    );
  });

  describe('isReleased', () => {
    it('seuls COURANT et PASSE sont diffusés', () => {
      expect(STATUSES.filter(isReleased)).toEqual(['COURANT', 'PASSE']);
      expect(RELEASED_STATUSES).toEqual(['COURANT', 'PASSE']);
    });
  });

  describe('isRedactedForPlayer', () => {
    it('couvre le brouillon caché et le contenu masqué : tout sauf COURANT/PASSE', () => {
      for (const kind of KINDS) {
        for (const status of STATUSES) {
          expect(isRedactedForPlayer(status, kind)).toBe(!isReleased(status));
        }
      }
    });
  });

  describe('fragments Prisma', () => {
    it('le brouillon caché est un BROUILLON dont la partie n’est pas un ONE_SHOT', () => {
      expect(HIDDEN_DRAFT_SCENARIO_WHERE).toEqual({
        status: 'BROUILLON',
        event: { partie: { kind: { not: 'ONE_SHOT' } } },
      });
    });

    it('les fragments dérivés (séance, vote) et leurs négations partent de la même définition', () => {
      expect(VISIBLE_SCENARIO_WHERE).toEqual({ NOT: HIDDEN_DRAFT_SCENARIO_WHERE });
      expect(HIDDEN_DRAFT_SEANCE_WHERE).toEqual({
        event: { scenario: { is: HIDDEN_DRAFT_SCENARIO_WHERE } },
      });
      expect(VISIBLE_SEANCE_WHERE).toEqual({ NOT: HIDDEN_DRAFT_SEANCE_WHERE });
      expect(HIDDEN_DRAFT_POLL_WHERE).toEqual({ seance: { is: HIDDEN_DRAFT_SEANCE_WHERE } });
      expect(VISIBLE_POLL_WHERE).toEqual({ NOT: HIDDEN_DRAFT_POLL_WHERE });
    });

    it('annonces : toute la partie, ou ciblées sur un scénario diffusé', () => {
      expect(RELEASED_ANNOUNCEMENT_WHERE).toEqual({
        OR: [{ scenarioId: null }, { scenario: { is: { status: { in: ['COURANT', 'PASSE'] } } } }],
      });
    });
  });
});
