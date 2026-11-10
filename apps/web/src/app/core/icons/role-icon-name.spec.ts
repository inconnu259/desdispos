import { roleIconName } from './role-icon-name';

describe('roleIconName', () => {
  it('admin d’un groupe -> role-admin, admin d’une soirée isolée -> role-hote', () => {
    expect(roleIconName('admin', { soireeIsolee: false })).toBe('role-admin');
    expect(roleIconName('admin', { soireeIsolee: true })).toBe('role-hote');
    expect(roleIconName('admin')).toBe('role-admin');
  });

  it('member (ralliement) et player -> role-joueur', () => {
    expect(roleIconName('member', { soireeIsolee: false })).toBe('role-joueur');
    expect(roleIconName('player', { soireeIsolee: false })).toBe('role-joueur');
  });

  it('mj -> role-mj, soirée isolée ou non', () => {
    expect(roleIconName('mj', { soireeIsolee: false })).toBe('role-mj');
    expect(roleIconName('mj', { soireeIsolee: true })).toBe('role-mj');
  });

  it('le drapeau soireeIsolee ne change que le rôle admin', () => {
    expect(roleIconName('player', { soireeIsolee: true })).toBe('role-joueur');
    expect(roleIconName('member', { soireeIsolee: true })).toBe('role-joueur');
  });
});
