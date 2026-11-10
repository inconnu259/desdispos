import {
  checkPartieKindTransition,
  type PartieKind,
  type PartieKindTransitionState,
} from '@desdispos/shared';

/**
 * Table de vérité de la matrice de conversion (Story 29.14, Task 2).
 *
 * La fonction vit dans `@desdispos/shared` — point de dérivation unique consommé par le serveur
 * ET par le formulaire d'édition. Ce fichier couvre la table elle-même : les 6 transitions, leurs
 * états limites et trois invariants transverses. Côté API, `parties.service.spec.ts` exerce la
 * MÊME fonction (aucun verdict simulé) mais sous l'angle de son application par le service.
 */

const OPEN: PartieKindTransitionState = {
  scenarioCount: 1,
  courantCount: 0,
  isClosed: false,
};

function state(over: Partial<PartieKindTransitionState> = {}): PartieKindTransitionState {
  return { ...OPEN, ...over };
}

const KINDS: PartieKind[] = ['ONE_SHOT', 'CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE'];

describe('checkPartieKindTransition', () => {
  describe('transition identité (from === to)', () => {
    it.each(KINDS)('%s → %s est autorisée, sans effet ni choix', (kind) => {
      const verdict = checkPartieKindTransition(kind, kind, state());
      expect(verdict).toEqual({ allowed: true, effects: [], requiresCourantChoice: false });
    });

    it('reste autorisée même sur une partie clôturée — le formulaire renvoie toujours kind', () => {
      const verdict = checkPartieKindTransition('ONE_SHOT', 'ONE_SHOT', state({ isClosed: true }));
      expect(verdict.allowed).toBe(true);
    });

    it('reste autorisée même dans un état qui refuserait une vraie conversion', () => {
      // 3 scénarios refuserait → ONE_SHOT, mais ici il n'y a aucune conversion à évaluer.
      const verdict = checkPartieKindTransition(
        'ONE_SHOT',
        'ONE_SHOT',
        state({ scenarioCount: 3 }),
      );
      expect(verdict.allowed).toBe(true);
    });
  });

  describe('Règle C — aucune conversion sur une partie clôturée', () => {
    const REAL_TRANSITIONS: [PartieKind, PartieKind][] = [
      ['ONE_SHOT', 'CAMPAGNE_LINEAIRE'],
      ['ONE_SHOT', 'CAMPAGNE_EPISODIQUE'],
      ['CAMPAGNE_LINEAIRE', 'ONE_SHOT'],
      ['CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE'],
      ['CAMPAGNE_EPISODIQUE', 'ONE_SHOT'],
      ['CAMPAGNE_EPISODIQUE', 'CAMPAGNE_LINEAIRE'],
    ];

    it.each(REAL_TRANSITIONS)('%s → %s est refusée si la partie est clôturée', (from, to) => {
      const verdict = checkPartieKindTransition(from, to, state({ isClosed: true }));
      expect(verdict).toEqual({ allowed: false, refusal: 'PARTIE_CLOSED' });
    });

    it('la clôture prime sur un refus qui serait sinon dû au nombre de scénarios', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_LINEAIRE',
        'ONE_SHOT',
        state({ scenarioCount: 5, isClosed: true }),
      );
      expect(verdict).toEqual({ allowed: false, refusal: 'PARTIE_CLOSED' });
    });
  });

  describe('Cas 1 — ONE_SHOT → CAMPAGNE_LINEAIRE', () => {
    it('est autorisée sans condition ni effet', () => {
      const verdict = checkPartieKindTransition('ONE_SHOT', 'CAMPAGNE_LINEAIRE', state());
      expect(verdict).toEqual({ allowed: true, effects: [], requiresCourantChoice: false });
    });
  });

  describe('Cas 2 — ONE_SHOT → CAMPAGNE_EPISODIQUE', () => {
    it('est autorisée et sème les participants', () => {
      const verdict = checkPartieKindTransition('ONE_SHOT', 'CAMPAGNE_EPISODIQUE', state());
      expect(verdict).toEqual({
        allowed: true,
        effects: ['SEED_PARTICIPANTS'],
        requiresCourantChoice: false,
      });
    });
  });

  describe('Cas 3 — CAMPAGNE_LINEAIRE → ONE_SHOT', () => {
    it('à 1 scénario : autorisée, aucun effet', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_LINEAIRE',
        'ONE_SHOT',
        state({ scenarioCount: 1 }),
      );
      expect(verdict).toEqual({ allowed: true, effects: [], requiresCourantChoice: false });
    });

    it('à 0 scénario : autorisée, et EN CRÉE un — sans quoi la partie serait définitivement coincée', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_LINEAIRE',
        'ONE_SHOT',
        state({ scenarioCount: 0 }),
      );
      expect(verdict).toEqual({
        allowed: true,
        effects: ['CREATE_SCENARIO'],
        requiresCourantChoice: false,
      });
    });

    it('à 2 scénarios : refusée', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_LINEAIRE',
        'ONE_SHOT',
        state({ scenarioCount: 2 }),
      );
      expect(verdict).toEqual({ allowed: false, refusal: 'TOO_MANY_SCENARIOS_FOR_ONE_SHOT' });
    });

    it('à 7 scénarios : refusée aussi', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_LINEAIRE',
        'ONE_SHOT',
        state({ scenarioCount: 7 }),
      );
      expect(verdict.allowed).toBe(false);
    });
  });

  describe('Cas 4 — CAMPAGNE_LINEAIRE → CAMPAGNE_EPISODIQUE', () => {
    it('est autorisée et sème les participants', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_LINEAIRE',
        'CAMPAGNE_EPISODIQUE',
        state(),
      );
      expect(verdict).toEqual({
        allowed: true,
        effects: ['SEED_PARTICIPANTS'],
        requiresCourantChoice: false,
      });
    });

    it('reste autorisée quel que soit le nombre de COURANT — le passage lève le verrou, il ne le pose pas', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_LINEAIRE',
        'CAMPAGNE_EPISODIQUE',
        state({ scenarioCount: 4, courantCount: 3 }),
      );
      expect(verdict.allowed).toBe(true);
      expect(verdict).toMatchObject({ requiresCourantChoice: false });
    });
  });

  describe('Cas 5 — CAMPAGNE_EPISODIQUE → ONE_SHOT', () => {
    it('à 1 scénario : autorisée', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_EPISODIQUE',
        'ONE_SHOT',
        state({ scenarioCount: 1 }),
      );
      expect(verdict).toEqual({ allowed: true, effects: [], requiresCourantChoice: false });
    });

    it('à 0 scénario : autorisée, et en crée un', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_EPISODIQUE',
        'ONE_SHOT',
        state({ scenarioCount: 0 }),
      );
      expect(verdict).toMatchObject({ allowed: true, effects: ['CREATE_SCENARIO'] });
    });

    it('à 2 scénarios : refusée', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_EPISODIQUE',
        'ONE_SHOT',
        state({ scenarioCount: 2 }),
      );
      expect(verdict).toEqual({ allowed: false, refusal: 'TOO_MANY_SCENARIOS_FOR_ONE_SHOT' });
    });
  });

  describe('Cas 6 — CAMPAGNE_EPISODIQUE → CAMPAGNE_LINEAIRE', () => {
    it('à 0 COURANT : autorisée, aucun effet, aucun choix', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_EPISODIQUE',
        'CAMPAGNE_LINEAIRE',
        state({ scenarioCount: 3, courantCount: 0 }),
      );
      expect(verdict).toEqual({ allowed: true, effects: [], requiresCourantChoice: false });
    });

    it('à 1 COURANT : autorisée, aucun choix — l’invariant est déjà satisfait', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_EPISODIQUE',
        'CAMPAGNE_LINEAIRE',
        state({ scenarioCount: 3, courantCount: 1 }),
      );
      expect(verdict).toEqual({ allowed: true, effects: [], requiresCourantChoice: false });
    });

    it('à 2 COURANT : autorisée, mais exige de désigner celui qui reste Courant', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_EPISODIQUE',
        'CAMPAGNE_LINEAIRE',
        state({ scenarioCount: 4, courantCount: 2 }),
      );
      expect(verdict).toEqual({
        allowed: true,
        effects: ['DEMOTE_EXTRA_COURANTS'],
        requiresCourantChoice: true,
      });
    });

    it('à 5 COURANT : même verdict — jamais un refus', () => {
      const verdict = checkPartieKindTransition(
        'CAMPAGNE_EPISODIQUE',
        'CAMPAGNE_LINEAIRE',
        state({ scenarioCount: 6, courantCount: 5 }),
      );
      expect(verdict).toMatchObject({ allowed: true, requiresCourantChoice: true });
    });
  });

  describe('invariants transverses', () => {
    it('aucune transition vers CAMPAGNE_EPISODIQUE n’exige de choix de Courant', () => {
      for (const from of KINDS) {
        for (let courantCount = 0; courantCount <= 4; courantCount++) {
          const verdict = checkPartieKindTransition(
            from,
            'CAMPAGNE_EPISODIQUE',
            state({ scenarioCount: 5, courantCount }),
          );
          expect(verdict).toMatchObject({ requiresCourantChoice: false });
        }
      }
    });

    it('requiresCourantChoice implique toujours l’effet DEMOTE_EXTRA_COURANTS, et réciproquement', () => {
      for (const from of KINDS) {
        for (const to of KINDS) {
          for (let courantCount = 0; courantCount <= 3; courantCount++) {
            for (const scenarioCount of [0, 1, 2, 5]) {
              const verdict = checkPartieKindTransition(
                from,
                to,
                state({ scenarioCount, courantCount }),
              );
              if (!verdict.allowed) continue;
              expect(verdict.requiresCourantChoice).toBe(
                verdict.effects.includes('DEMOTE_EXTRA_COURANTS'),
              );
            }
          }
        }
      }
    });

    it('un refus ne porte jamais d’effet — rien ne doit être appliqué après un refus (AC10)', () => {
      for (const from of KINDS) {
        for (const to of KINDS) {
          const verdict = checkPartieKindTransition(
            from,
            to,
            state({ scenarioCount: 9, courantCount: 4, isClosed: true }),
          );
          if (verdict.allowed) continue;
          expect(verdict).not.toHaveProperty('effects');
        }
      }
    });
  });
});
