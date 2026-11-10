import {
  bestOption,
  destinyEntryOption,
  sortOptionsChronologically,
  type RankableOption,
} from '@master-jdr/shared';

const TODAY = '2026-10-20';

const opt = (
  id: string,
  date: string,
  yes: number,
  maybe: number,
  slot: RankableOption['slot'] = 'EVENING',
) => ({ id, date, slot, yes, maybe });

describe('bestOption (Story 44.3)', () => {
  it('le plus de oui l’emporte', () => {
    const best = bestOption([opt('a', '2026-10-25', 1, 5), opt('b', '2026-10-26', 3, 0)], TODAY);
    expect(best?.id).toBe('b');
  });

  it('à égalité de oui, le plus de peut-être', () => {
    const best = bestOption([opt('a', '2026-10-25', 2, 0), opt('b', '2026-10-26', 2, 1)], TODAY);
    expect(best?.id).toBe('b');
  });

  it('à égalité complète, le plus tôt : le jour, puis le créneau de la journée', () => {
    expect(
      bestOption([opt('a', '2026-10-26', 2, 1), opt('b', '2026-10-25', 2, 1)], TODAY)?.id,
    ).toBe('b');
    expect(
      bestOption(
        [opt('soir', '2026-10-25', 2, 1, 'EVENING'), opt('matin', '2026-10-25', 2, 1, 'MORNING')],
        TODAY,
      )?.id,
    ).toBe('matin');
  });

  it('les options passées sont exclues, même si elles sont les plus plébiscitées', () => {
    const best = bestOption([opt('old', '2026-10-19', 9, 9), opt('ok', '2026-10-20', 1, 0)], TODAY);
    expect(best?.id).toBe('ok');
  });

  it('aucun meilleur sans « oui », ni sans option à venir', () => {
    expect(bestOption([opt('a', '2026-10-25', 0, 4)], TODAY)).toBeNull();
    expect(bestOption([opt('old', '2026-10-01', 5, 0)], TODAY)).toBeNull();
    expect(bestOption([], TODAY)).toBeNull();
  });

  it('ne modifie pas la liste reçue', () => {
    const options = [opt('a', '2026-10-26', 1, 0), opt('b', '2026-10-25', 2, 0)];
    bestOption(options, TODAY);
    expect(options.map((o) => o.id)).toEqual(['a', 'b']);
  });
});

describe('sortOptionsChronologically (Story 44.4)', () => {
  it('le jour, puis le créneau de la journée', () => {
    const sorted = sortOptionsChronologically([
      opt('plein', '2026-10-25', 0, 0, 'FULL_DAY'),
      opt('soir', '2026-10-25', 0, 0, 'EVENING'),
      opt('lendemain', '2026-10-26', 0, 0, 'MORNING'),
      opt('matin', '2026-10-25', 0, 0, 'MORNING'),
      opt('aprem', '2026-10-25', 0, 0, 'AFTERNOON'),
    ]);
    expect(sorted.map((o) => o.id)).toEqual(['matin', 'aprem', 'soir', 'plein', 'lendemain']);
  });

  it('ne modifie pas la liste reçue', () => {
    const options = [opt('b', '2026-10-26', 0, 0), opt('a', '2026-10-25', 0, 0)];
    sortOptionsChronologically(options);
    expect(options.map((o) => o.id)).toEqual(['b', 'a']);
  });
});

describe('destinyEntryOption (Story 44.3)', () => {
  const options = [
    opt('past', '2026-10-10', 9, 0),
    opt('late', '2026-11-02', 4, 0),
    opt('soon', '2026-10-22', 1, 0),
  ];

  it('vote ouvert : le premier créneau À VENIR, quel que soit son score', () => {
    expect(destinyEntryOption({ expiresAt: '2026-10-30T00:00:00.000Z', options }, TODAY)?.id).toBe(
      'soon',
    );
    expect(destinyEntryOption({ expiresAt: null, options }, TODAY)?.id).toBe('soon');
  });

  it('le jour de l’échéance, le vote est encore ouvert', () => {
    expect(destinyEntryOption({ expiresAt: '2026-10-20T23:59:00.000Z', options }, TODAY)?.id).toBe(
      'soon',
    );
  });

  it('vote terminé : le meilleur créneau', () => {
    expect(destinyEntryOption({ expiresAt: '2026-10-19T00:00:00.000Z', options }, TODAY)?.id).toBe(
      'late',
    );
  });

  it('vote terminé sans meilleur : le premier créneau à venir', () => {
    const nobody = [
      opt('past', '2026-10-10', 0, 0),
      opt('b', '2026-11-05', 0, 0),
      opt('a', '2026-11-01', 0, 0),
    ];
    expect(
      destinyEntryOption({ expiresAt: '2026-10-01T00:00:00.000Z', options: nobody }, TODAY)?.id,
    ).toBe('a');
  });

  it('tous les créneaux passés : le premier créneau ; aucune option : null', () => {
    const past = [opt('b', '2026-10-05', 0, 0), opt('a', '2026-10-02', 0, 0)];
    expect(destinyEntryOption({ expiresAt: null, options: past }, TODAY)?.id).toBe('a');
    expect(destinyEntryOption({ expiresAt: null, options: [] }, TODAY)).toBeNull();
  });
});
