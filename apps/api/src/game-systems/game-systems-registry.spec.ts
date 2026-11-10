// Story 37.5 : registre unique des systèmes de jeu (`GAME_SYSTEMS` de `@master-jdr/shared`) et
// ses quatre lecteurs. Le VRAI registre est exercé (aucun `jest.mock`) : `transformIgnorePatterns`
// laisse ts-jest transformer `@master-jdr/*`.
import {
  GAME_SYSTEMS,
  badgeOf,
  familyOf,
  hasCapability,
  isOpenForCreation,
  kindsOf,
  type GameSystemCapability,
} from '@master-jdr/shared';

const ALL_CAPABILITIES: GameSystemCapability[] = [
  'characters',
  'scenarioLifecycle',
  'xp',
  'hommeDragon',
  'groupRoles',
  'announcements',
  'linearCampaign',
];

const JDR_KINDS = ['ONE_SHOT', 'CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE'];

describe('registre GAME_SYSTEMS (Story 37.5)', () => {
  it('déclare exactement les cinq systèmes attendus', () => {
    expect(GAME_SYSTEMS.map((g) => g.id)).toEqual([
      'draconis',
      'conte-de-minuit',
      'ryuutama',
      'esteren',
      'ralliement',
    ]);
  });

  it('ryuutama : famille jdr, toutes les capacités, trois types, ouvert à la création', () => {
    expect(familyOf('ryuutama')).toBe('jdr');
    for (const capability of ALL_CAPABILITIES) {
      expect(hasCapability('ryuutama', capability)).toBe(true);
    }
    expect(kindsOf('ryuutama')).toEqual(JDR_KINDS);
    expect(isOpenForCreation('ryuutama')).toBe(true);
  });

  it.each(['draconis', 'conte-de-minuit', 'esteren'])(
    '%s : famille jdr, aucune capacité, trois types, fermé',
    (id) => {
      expect(familyOf(id)).toBe('jdr');
      for (const capability of ALL_CAPABILITIES) {
        expect(hasCapability(id, capability)).toBe(false);
      }
      expect(kindsOf(id)).toEqual(JDR_KINDS);
      expect(isOpenForCreation(id)).toBe(false);
    },
  );

  it('ralliement : famille ralliement, aucune capacité, ONE_SHOT + CAMPAGNE_EPISODIQUE, ouvert à la création (Story 38.2)', () => {
    const entry = GAME_SYSTEMS.find((g) => g.id === 'ralliement');
    expect(entry?.name).toBe('Ralliement');
    expect(familyOf('ralliement')).toBe('ralliement');
    for (const capability of ALL_CAPABILITIES) {
      expect(hasCapability('ralliement', capability)).toBe(false);
    }
    expect(kindsOf('ralliement')).toEqual(['ONE_SHOT', 'CAMPAGNE_EPISODIQUE']);
    expect(isOpenForCreation('ralliement')).toBe(true);
  });

  it('seuls ryuutama et ralliement sont ouverts à la création (Story 38.2)', () => {
    expect(GAME_SYSTEMS.filter((g) => isOpenForCreation(g.id)).map((g) => g.id)).toEqual([
      'ryuutama',
      'ralliement',
    ]);
  });

  it("badge (Story 38.5) : R1 pour ryuutama, L1 pour ralliement, aucun pour les autres, jamais d'exception", () => {
    expect(badgeOf('ryuutama')).toBe('R1');
    expect(badgeOf('ralliement')).toBe('L1');
    for (const id of ['draconis', 'conte-de-minuit', 'esteren', 'inconnu']) {
      expect(badgeOf(id)).toBeNull();
    }
    expect(() => badgeOf('inconnu')).not.toThrow();
  });

  it('un id inconnu ne lève jamais : null / false / [] / false', () => {
    expect(() => familyOf('inconnu')).not.toThrow();
    expect(familyOf('inconnu')).toBeNull();
    expect(hasCapability('inconnu', 'characters')).toBe(false);
    expect(kindsOf('inconnu')).toEqual([]);
    expect(isOpenForCreation('inconnu')).toBe(false);
  });
});
