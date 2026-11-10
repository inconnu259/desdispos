import { talentDetail } from './talent-detail';

const LABELS = {
  attributes: 'Attributs',
  difficulty: 'Difficulté',
  effect: 'Effet',
  conditions: 'Conditions',
};

describe('talentDetail (Story 31.4, AC9)', () => {
  it('AC9 — produit une ligne par donnée présente puis le récit', () => {
    const detail = talentDetail(
      {
        name: 'Création',
        effect: { description: 'Fabrique un objet', conditions: 'Coût : moitié du prix.' },
        attributes: ['VIG', 'AGI'],
        difficulty: 'variable',
        description: 'Les artisans créent.',
      },
      LABELS,
    );
    expect(detail?.title).toBe('Création');
    expect(detail?.rows).toEqual([
      { label: 'Attributs', value: 'VIG · AGI' },
      { label: 'Difficulté', value: 'Variable' },
      { label: 'Effet', value: 'Fabrique un objet' },
      { label: 'Conditions', value: 'Coût : moitié du prix.' },
    ]);
    expect(detail?.narrative).toBe('Les artisans créent.');
  });

  it("AC9 — une ligne sans donnée n'existe pas ('-' et vide comptent pour absents)", () => {
    const detail = talentDetail(
      {
        name: 'Climatophile',
        effect: { description: '+2 aux tests', conditions: '' },
        attributes: [],
        difficulty: '-',
      },
      LABELS,
    );
    expect(detail?.rows?.map((r) => r.label)).toEqual(['Effet']);
    expect(detail?.narrative).toBe('');
  });

  it('AC3 (31.3) — sans aucune donnée exploitable : null, donc aucun déclencheur', () => {
    expect(talentDetail({ name: 'Vide', effect: {}, attributes: [] }, LABELS)).toBeNull();
    expect(talentDetail(undefined, LABELS)).toBeNull();
    expect(talentDetail({ name: '  ', effect: { description: 'x' } }, LABELS)).toBeNull();
  });
});
