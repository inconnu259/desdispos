import { hasAnswered, isPartieActive, partieStatus } from '@master-jdr/shared';
import { pollVoters } from './poll-voters';

// Story 44.2 — les trois définitions UNIQUES du lot : qui vote, qui a répondu, quelle partie est active.

describe('pollVoters()', () => {
  it('JDR : le MJ d’abord puis ses membres, dédoublonnés', () => {
    expect(
      pollVoters({
        family: 'jdr',
        ownerId: 'mj',
        memberIds: ['a', 'mj', 'b'],
        groupVoterIds: null,
      }),
    ).toEqual(['mj', 'a', 'b']);
  });

  it('JDR : un MJ dont le compte a disparu ne laisse que les membres', () => {
    expect(
      pollVoters({ family: 'jdr', ownerId: null, memberIds: ['a'], groupVoterIds: null }),
    ).toEqual(['a']);
  });

  it('ralliement : exactement les votants éligibles de la conjonction, jamais les membres du groupe', () => {
    expect(
      pollVoters({
        family: 'ralliement',
        ownerId: 'admin',
        memberIds: ['x', 'y', 'z'],
        groupVoterIds: ['hote', 'x'],
      }),
    ).toEqual(['hote', 'x']);
  });

  it('ralliement sans votants fournis : personne ne vote', () => {
    expect(
      pollVoters({ family: 'ralliement', ownerId: 'a', memberIds: ['b'], groupVoterIds: null }),
    ).toEqual([]);
  });
});

describe('hasAnswered()', () => {
  const options = ['o1', 'o2', 'o3'];

  it('JDR : il faut une réponse à CHAQUE option', () => {
    expect(hasAnswered('jdr', options, ['o1', 'o2'])).toBe(false);
    expect(hasAnswered('jdr', options, new Set(['o1', 'o2', 'o3']))).toBe(true);
    expect(hasAnswered('jdr', options, [])).toBe(false);
  });

  it('JDR : un sondage sans option compte comme répondu (rien à répondre)', () => {
    expect(hasAnswered('jdr', [], [])).toBe(true);
  });

  it('ralliement : une réponse à AU MOINS UNE option suffit', () => {
    expect(hasAnswered('ralliement', options, ['o2'])).toBe(true);
    expect(hasAnswered('ralliement', options, [])).toBe(false);
  });

  it('ralliement : une réponse à une option étrangère au sondage ne compte pas', () => {
    expect(hasAnswered('ralliement', options, ['ailleurs'])).toBe(false);
  });
});

describe('partieStatus() / isPartieActive()', () => {
  const closed = new Date('2026-01-01T00:00:00Z');

  it.each([
    [null, 'none', 'A_VENIR'],
    [null, 'started', 'EN_COURS'],
    [null, 'ended', 'TERMINEE'],
    [closed, 'none', 'TERMINEE'],
    [closed, 'started', 'TERMINEE'],
    [null, 'cancelled', 'ANNULEE'],
    [closed, 'cancelled', 'ANNULEE'],
  ] as const)('closedAt %s + avancement %s → %s', (closedAt, progress, expected) => {
    expect(partieStatus(closedAt, progress)).toBe(expected);
  });

  it('active = à venir ou en cours, jamais terminée ni annulée', () => {
    expect(isPartieActive('A_VENIR')).toBe(true);
    expect(isPartieActive('EN_COURS')).toBe(true);
    expect(isPartieActive('TERMINEE')).toBe(false);
    expect(isPartieActive('ANNULEE')).toBe(false);
  });
});
