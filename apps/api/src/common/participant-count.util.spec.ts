import { participantCount } from './participant-count.util';

describe('participantCount (Story 36.6, AC9/AC10)', () => {
  it('ajoute le MJ au nombre de Membership', () => {
    expect(participantCount(3)).toBe(4);
  });

  it('une partie sans aucun membre a quand même un effectif de 1 — le MJ', () => {
    expect(participantCount(0)).toBe(1);
  });

  it('reste cohérent avec PermissionService.membersOf() : MJ + memberships, jamais les memberships seuls', () => {
    // PermissionService.membersOf() (Story 37.6, ex-`resolveParticipants()`) construit
    // `participants` = [mjUser, ...memberships]
    // et c'est ce tableau dont la longueur alimente `AggregatedSlotDto.total`. La formule ci-dessous
    // doit produire exactement le même nombre, sinon la piste de participation et la jauge de
    // disponibilité du groupe afficheraient deux dénominateurs sur la MÊME case.
    const memberships = ['u1', 'u2', 'u3'];
    const membersOfLength = ['mj', ...memberships].length;
    expect(participantCount(memberships.length)).toBe(membersOfLength);
  });

  it('ne renvoie jamais une valeur négative ni fractionnaire pour une entrée valide', () => {
    expect(participantCount(0)).toBeGreaterThan(0);
    expect(Number.isInteger(participantCount(7))).toBe(true);
  });
});
