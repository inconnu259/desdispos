import { atelierPath, atelierQuery, atelierUrl } from '@master-jdr/shared';

describe('atelierUrl (Story 44.7)', () => {
  const jdrMj = { partieId: 'p1', family: 'jdr', role: 'mj' } as const;
  const jdrPlayer = { partieId: 'p1', family: 'jdr', role: 'player' } as const;
  const group = { partieId: 'g1', family: 'ralliement', role: 'member' } as const;

  it('le MJ d’un JDR va à /calendar ; joueur et groupe à /guild-calendar', () => {
    expect(atelierUrl(jdrMj)).toBe('/parties/p1/calendar');
    expect(atelierUrl(jdrPlayer)).toBe('/parties/p1/guild-calendar');
    expect(atelierUrl(group)).toBe('/parties/g1/guild-calendar');
    expect(atelierUrl({ ...group, role: 'admin' })).toBe('/parties/g1/guild-calendar');
  });

  it('ajoute les paramètres demandés, dans un ordre stable, encodés', () => {
    expect(atelierUrl(group, { poll: 'abc' })).toBe('/parties/g1/guild-calendar?poll=abc');
    expect(atelierUrl(jdrMj, { pollList: true })).toBe('/parties/p1/calendar?pollList');
    expect(atelierUrl(jdrMj, { seanceId: 's 1', poll: 'a/b' })).toBe(
      '/parties/p1/calendar?poll=a%2Fb&seanceId=s%201',
    );
  });

  it('sans paramètre (ou paramètres vides), aucun « ? »', () => {
    expect(atelierUrl(group, {})).toBe('/parties/g1/guild-calendar');
    expect(atelierUrl(group, { poll: '', pollList: false })).toBe('/parties/g1/guild-calendar');
  });

  it('atelierPath et atelierQuery sont les deux morceaux, utilisables pour un routerLink', () => {
    expect(atelierPath(group)).toBe('/parties/g1/guild-calendar');
    expect(atelierQuery({ poll: 'x' })).toBe('poll=x');
    expect(atelierQuery()).toBe('');
  });
});
