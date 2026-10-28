import { describe, expect, it } from 'vitest';
import type { AvailabilityDeclarationDto, CalendarLayerKey } from '@master-jdr/shared';
import type { AgendaEntry } from './calendar-agenda-view/calendar-agenda-view';
import {
  RAIL_SLOTS,
  SLOT_PRECEDENCE,
  bandsAreUniform,
  buildDayDetail,
  composeSeanceInfo,
  buildMonthDetails,
  dateKeyToUtcMidnight,
  entryCoveredDays,
  entryPartieId,
  nextMeaningfulDate,
  toDateKey,
} from './day-detail.utils';

const ALL_LAYERS: CalendarLayerKey[] = [
  'mes-indisponibilites',
  'mes-disponibilites',
  'mes-seances',
  'votes-en-cours',
  'inscriptions-ouvertes',
  'disponibilite-groupe',
];

const NOW = new Date('2026-08-17T00:00:00Z');

function decl(over: Partial<AvailabilityDeclarationDto> = {}): AvailabilityDeclarationDto {
  return {
    id: 'd1',
    userId: 'u1',
    kind: 'AVAILABLE',
    recurKind: 'PUNCTUAL',
    dayOfWeek: null,
    slot: 'FULL_DAY',
    startDate: '2026-08-20T00:00:00.000Z',
    endDate: '2026-08-20T00:00:00.000Z',
    expiresAt: '2026-12-31T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

function seanceEntry(over: Partial<AgendaEntry> = {}): AgendaEntry {
  return {
    key: 'seance-s1',
    type: 'mes-seances',
    date: '2026-08-20',
    label: 'Le Convoi du Nord',
    slot: 'EVENING',
    partieId: 'p1',
    scenarioId: 'sc1',
    seanceId: 's1',
    ...over,
  };
}

describe('buildDayDetail — les trois créneaux', () => {
  it('rend toujours trois créneaux, dans l’ordre matin → après-midi → soir', () => {
    const detail = buildDayDetail('2026-08-20', [], ALL_LAYERS, [], NOW);

    expect(detail.slots).toHaveLength(3);
    expect(detail.slots.map((s) => s.slot)).toEqual(['MORNING', 'AFTERNOON', 'EVENING']);
    expect(detail.slots.map((s) => s.label)).toEqual(['Matin', 'Après-midi', 'Soir']);
  });

  it('rend les trois créneaux même quand un seul porte un objet — « Matin » ne disparaît jamais', () => {
    const detail = buildDayDetail('2026-08-20', [seanceEntry()], ALL_LAYERS, [], NOW);

    expect(detail.slots).toHaveLength(3);
    expect(detail.slots[0].slot).toBe('MORNING');
    expect(detail.slots[0].seanceLabel).toBeNull();
    expect(detail.slots[2].seanceLabel).toBe('Le Convoi du Nord');
  });

  it('marque un jour sans rien comme vide (AC4)', () => {
    const detail = buildDayDetail('2026-08-20', [], ALL_LAYERS, [], NOW);

    expect(detail.isEmpty).toBe(true);
    expect(detail.slots.every((s) => s.status === 'UNKNOWN')).toBe(true);
  });

  it('ne marque pas comme vide un jour portant seulement une déclaration', () => {
    const detail = buildDayDetail('2026-08-20', [], ALL_LAYERS, [decl()], NOW);

    expect(detail.isEmpty).toBe(false);
    expect(detail.slots.every((s) => s.status === 'AVAILABLE')).toBe(true);
  });

  it('ignore les entrées d’un autre jour', () => {
    const detail = buildDayDetail(
      '2026-08-21',
      [seanceEntry({ date: '2026-08-20' })],
      ALL_LAYERS,
      [],
      NOW,
    );

    expect(detail.slots.every((s) => s.seanceLabel === null)).toBe(true);
    expect(detail.isEmpty).toBe(true);
  });
});

describe('buildDayDetail — FULL_DAY et créneau absent', () => {
  it('applique une séance FULL_DAY aux trois créneaux', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [seanceEntry({ slot: 'FULL_DAY' })],
      ALL_LAYERS,
      [],
      NOW,
    );

    expect(detail.slots.map((s) => s.seanceLabel)).toEqual([
      'Le Convoi du Nord',
      'Le Convoi du Nord',
      'Le Convoi du Nord',
    ]);
  });

  it('traite un créneau absent comme FULL_DAY', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [seanceEntry({ slot: undefined })],
      ALL_LAYERS,
      [],
      NOW,
    );

    expect(detail.slots.every((s) => s.seanceLabel === 'Le Convoi du Nord')).toBe(true);
  });
});

describe('buildDayDetail — AC6 : la couche gouverne le texte, jamais l’indisponibilité', () => {
  it('nomme la séance et rend le créneau indisponible quand la couche est allumée', () => {
    const detail = buildDayDetail('2026-08-20', [seanceEntry()], ALL_LAYERS, [], NOW);

    expect(detail.slots[2].seanceLabel).toBe('Le Convoi du Nord');
    expect(detail.slots[2].status).toBe('UNAVAILABLE');
  });

  it('retire le TEXTE mais conserve l’indisponibilité quand la couche est éteinte', () => {
    const sansSeances = ALL_LAYERS.filter((l) => l !== 'mes-seances');
    const detail = buildDayDetail('2026-08-20', [seanceEntry()], sansSeances, [], NOW);

    expect(detail.slots[2].seanceLabel).toBeNull();
    expect(detail.slots[2].status).toBe('UNAVAILABLE');
  });

  it('l’indisponibilité d’une séance écrase une déclaration « disponible »', () => {
    const detail = buildDayDetail('2026-08-20', [seanceEntry()], ALL_LAYERS, [decl()], NOW);

    expect(detail.slots[0].status).toBe('AVAILABLE');
    expect(detail.slots[2].status).toBe('UNAVAILABLE');
  });

  it('masque le libellé d’un vote quand la couche « votes-en-cours » est éteinte', () => {
    const poll: AgendaEntry = {
      key: 'poll-1',
      type: 'votes-en-cours',
      date: '2026-08-20',
      label: 'Les Cendres d’Ashal',
      slot: 'MORNING',
    };
    const sansVotes = ALL_LAYERS.filter((l) => l !== 'votes-en-cours');

    expect(buildDayDetail('2026-08-20', [poll], ALL_LAYERS, [], NOW).slots[0].pollLabel).toBe(
      'Les Cendres d’Ashal',
    );
    expect(buildDayDetail('2026-08-20', [poll], sansVotes, [], NOW).slots[0].pollLabel).toBeNull();
  });

  it('Story 36.6 — la participation du vote est portée par le créneau, gouvernée par la MÊME couche que le libellé', () => {
    const poll: AgendaEntry = {
      key: 'poll-1-o1',
      type: 'votes-en-cours',
      date: '2026-08-20',
      label: 'Les Cendres d’Ashal',
      slot: 'MORNING',
      vote: {
        partieId: 'partie-1',
        pollId: 'poll-1',
        optionId: 'o1',
        yes: 2,
        maybe: 1,
        no: 0,
        total: 4,
        myAnswer: 'YES',
      },
    };
    const sansVotes = ALL_LAYERS.filter((l) => l !== 'votes-en-cours');

    expect(buildDayDetail('2026-08-20', [poll], ALL_LAYERS, [], NOW).slots[0].pollVote).toEqual({
      partieId: 'partie-1',
      pollId: 'poll-1',
      optionId: 'o1',
      yes: 2,
      maybe: 1,
      no: 0,
      total: 4,
      myAnswer: 'YES',
    });
    // Couche éteinte : la piste disparaît exactement comme le libellé.
    expect(buildDayDetail('2026-08-20', [poll], sansVotes, [], NOW).slots[0].pollVote).toBeNull();
  });

  it('Story 36.6 — deux options du même vote sur deux créneaux : chaque créneau porte SA participation', () => {
    const matin: AgendaEntry = {
      key: 'poll-1-o1',
      type: 'votes-en-cours',
      date: '2026-08-20',
      label: 'Les Cendres d’Ashal',
      slot: 'MORNING',
      vote: {
        partieId: 'partie-1',
        pollId: 'p',
        optionId: 'o1',
        yes: 4,
        maybe: 0,
        no: 0,
        total: 4,
        myAnswer: 'YES',
      },
    };
    const soir: AgendaEntry = {
      ...matin,
      key: 'poll-1-o2',
      slot: 'EVENING',
      vote: {
        partieId: 'partie-1',
        pollId: 'p',
        optionId: 'o2',
        yes: 1,
        maybe: 0,
        no: 0,
        total: 4,
        myAnswer: null,
      },
    };

    const detail = buildDayDetail('2026-08-20', [matin, soir], ALL_LAYERS, [], NOW);

    expect(detail.slots[0].pollVote?.optionId).toBe('o1');
    expect(detail.slots[0].pollVote?.yes).toBe(4);
    expect(detail.slots[2].pollVote?.optionId).toBe('o2');
    expect(detail.slots[2].pollVote?.yes).toBe(1);
  });

  it('Story 36.6 — un vote sans participation renseignée laisse pollVote à null, jamais undefined', () => {
    const poll: AgendaEntry = {
      key: 'poll-1',
      type: 'votes-en-cours',
      date: '2026-08-20',
      label: 'Les Cendres d’Ashal',
      slot: 'MORNING',
    };

    expect(buildDayDetail('2026-08-20', [poll], ALL_LAYERS, [], NOW).slots[0].pollVote).toBeNull();
  });

  it('Story 36.6 — une SÉANCE gagnante n’emporte jamais la participation d’un vote concurrent (encadré n°8)', () => {
    const poll: AgendaEntry = {
      key: 'poll-1-o1',
      type: 'votes-en-cours',
      date: '2026-08-20',
      label: 'Vote concurrent',
      slot: 'EVENING',
      vote: {
        partieId: 'partie-1',
        pollId: 'p',
        optionId: 'o1',
        yes: 3,
        maybe: 0,
        no: 0,
        total: 4,
        myAnswer: null,
      },
    };

    const detail = buildDayDetail('2026-08-20', [seanceEntry(), poll], ALL_LAYERS, [], NOW);

    // Le rang gagnant est la séance : c'est elle que la bande dit, et aucune piste ne s'y pose.
    expect(detail.slots[2].winner).toBe('seance');
  });

  it('revue de code (2026-08-18) : le rang « vote » retombe sur le statut déclaré quand la couche « votes-en-cours » est éteinte', () => {
    const poll: AgendaEntry = {
      key: 'poll-1',
      type: 'votes-en-cours',
      date: '2026-08-20',
      label: 'Les Cendres d’Ashal',
      slot: 'MORNING',
    };
    const sansVotes = ALL_LAYERS.filter((l) => l !== 'votes-en-cours');

    expect(buildDayDetail('2026-08-20', [poll], ALL_LAYERS, [], NOW).slots[0].winner).toBe('vote');
    // Couche éteinte, aucune déclaration : retombe sur « none », pas « vote ».
    expect(buildDayDetail('2026-08-20', [poll], sansVotes, [], NOW).slots[0].winner).toBe('none');
    // Couche éteinte, avec une disponibilité déclarée : retombe sur « available ».
    expect(buildDayDetail('2026-08-20', [poll], sansVotes, [decl()], NOW).slots[0].winner).toBe(
      'available',
    );
  });
});

describe('buildDayDetail — doublon sur le même jour/créneau', () => {
  it('signale un « +1 autre » quand deux séances portent le même jour/créneau, sans les perdre', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [seanceEntry(), seanceEntry({ key: 'seance-s2', label: 'Autre table', scenarioId: 'sc2' })],
      ALL_LAYERS,
      [],
      NOW,
    );

    expect(detail.slots[2].seanceLabel).toBe('Le Convoi du Nord (+1 autre)');
  });

  it('signale un « +1 autre » quand deux votes portent le même jour/créneau', () => {
    const poll1: AgendaEntry = {
      key: 'poll-1',
      type: 'votes-en-cours',
      date: '2026-08-20',
      label: 'Les Cendres d’Ashal',
      slot: 'MORNING',
    };
    const poll2: AgendaEntry = { ...poll1, key: 'poll-2', label: 'Autre vote' };

    const detail = buildDayDetail('2026-08-20', [poll1, poll2], ALL_LAYERS, [], NOW);

    expect(detail.slots[0].pollLabel).toBe('Les Cendres d’Ashal (+1 autre)');
  });

  it('ne signale rien quand une seule séance porte le jour/créneau', () => {
    const detail = buildDayDetail('2026-08-20', [seanceEntry()], ALL_LAYERS, [], NOW);

    expect(detail.slots[2].seanceLabel).toBe('Le Convoi du Nord');
  });
});

describe('buildDayDetail — AC11 / AC7 : cible de navigation', () => {
  it('expose la cible du scénario quand la séance est nommée', () => {
    const detail = buildDayDetail('2026-08-20', [seanceEntry()], ALL_LAYERS, [], NOW);

    expect(detail.slots[2].seanceTarget).toEqual({ partieId: 'p1', scenarioId: 'sc1' });
  });

  it('n’expose aucune cible quand la couche est éteinte — pas d’affordance sur une ligne muette', () => {
    const sansSeances = ALL_LAYERS.filter((l) => l !== 'mes-seances');
    const detail = buildDayDetail('2026-08-20', [seanceEntry()], sansSeances, [], NOW);

    expect(detail.slots[2].seanceTarget).toBeNull();
  });

  it('n’expose aucune cible quand l’entrée ne porte pas d’identifiants (AC7)', () => {
    const anonyme = seanceEntry({ partieId: undefined, scenarioId: undefined });
    const detail = buildDayDetail('2026-08-20', [anonyme], ALL_LAYERS, [], NOW);

    expect(detail.slots[2].seanceLabel).toBe('Le Convoi du Nord');
    expect(detail.slots[2].seanceTarget).toBeNull();
  });

  it('n’expose jamais de cible sur un créneau sans séance', () => {
    const detail = buildDayDetail('2026-08-20', [], ALL_LAYERS, [decl()], NOW);

    expect(detail.slots.every((s) => s.seanceTarget === null)).toBe(true);
  });
});

describe('nextMeaningfulDate — AC3', () => {
  const entries: AgendaEntry[] = [
    seanceEntry({ key: 'a', date: '2026-08-25' }),
    { key: 'b', type: 'votes-en-cours', date: '2026-08-22', label: 'Vote' },
    { key: 'c', type: 'mes-disponibilites', date: '2026-08-18', label: 'Ponctuel' },
  ];

  it('retient le plus proche jour porteur à partir d’aujourd’hui', () => {
    expect(nextMeaningfulDate(entries, '2026-08-17')).toBe('2026-08-22');
  });

  it('ne compte pas une déclaration de disponibilité comme « quelque chose »', () => {
    const declsOnly: AgendaEntry[] = [
      { key: 'c', type: 'mes-disponibilites', date: '2026-08-18', label: 'Ponctuel' },
      { key: 'd', type: 'mes-indisponibilites', date: '2026-08-19', label: 'Ponctuel' },
    ];

    expect(nextMeaningfulDate(declsOnly, '2026-08-17')).toBeNull();
  });

  it('ne compte pas la tendance du groupe', () => {
    const groupe: AgendaEntry[] = [
      { key: 'g', type: 'disponibilite-groupe', date: '2026-08-18', label: '2/4 disponibles' },
    ];

    expect(nextMeaningfulDate(groupe, '2026-08-17')).toBeNull();
  });

  it('ignore les jours passés', () => {
    expect(nextMeaningfulDate(entries, '2026-08-23')).toBe('2026-08-25');
    expect(nextMeaningfulDate(entries, '2026-08-26')).toBeNull();
  });

  it('ignore les entrées sans date propre (inscriptions ouvertes)', () => {
    const sansDate: AgendaEntry[] = [
      { key: 'i', type: 'inscriptions-ouvertes', date: '', label: 'Partie — Scénario' },
    ];

    expect(nextMeaningfulDate(sansDate, '2026-08-17')).toBeNull();
  });

  it('retourne null sur une liste vide', () => {
    expect(nextMeaningfulDate([], '2026-08-17')).toBeNull();
  });
});

describe('conversions de dates', () => {
  it('convertit une clé de jour en minuit UTC', () => {
    const d = dateKeyToUtcMidnight('2026-08-20');

    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(7);
    expect(d.getUTCDate()).toBe(20);
    expect(d.getUTCHours()).toBe(0);
  });

  it('produit une clé locale à zéros de tête', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('fait l’aller-retour sur une date locale', () => {
    expect(toDateKey(new Date(2026, 7, 20))).toBe('2026-08-20');
  });
});

describe('RAIL_SLOTS', () => {
  it('porte les trois créneaux et leurs abréviations', () => {
    expect(RAIL_SLOTS).toHaveLength(3);
    expect(RAIL_SLOTS.map((r) => r.shortLabel)).toEqual(['Matin', 'Après-m.', 'Soir']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 36.2 — la préséance dans un créneau
// ─────────────────────────────────────────────────────────────────────────────

function pollEntry(over: Partial<AgendaEntry> = {}): AgendaEntry {
  return {
    key: 'poll-p1',
    type: 'votes-en-cours',
    date: '2026-08-20',
    label: 'Les Cendres d’Ashal',
    slot: 'EVENING',
    ...over,
  };
}

describe('SLOT_PRECEDENCE — l’ordre est écrit une fois', () => {
  it('porte les quatre rangs, dans l’ordre de FR-49', () => {
    expect([...SLOT_PRECEDENCE]).toEqual(['seance', 'vote', 'unavailable', 'available']);
  });

  it('n’inclut pas « non déclaré » — ce n’est pas un rang', () => {
    expect(SLOT_PRECEDENCE).not.toContain('none');
  });

  it('n’inclut pas la disponibilité du groupe — sortie de la préséance (FR-53)', () => {
    expect(SLOT_PRECEDENCE.some((r) => String(r).includes('groupe'))).toBe(false);
  });
});

describe('buildDayDetail — le rang gagnant', () => {
  it('une séance gagne sur tout le reste', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [seanceEntry(), pollEntry()],
      ALL_LAYERS,
      [decl()],
      NOW,
    );

    expect(detail.slots[2].winner).toBe('seance');
  });

  it('un vote gagne sur une déclaration', () => {
    const detail = buildDayDetail('2026-08-20', [pollEntry()], ALL_LAYERS, [decl()], NOW);

    expect(detail.slots[2].winner).toBe('vote');
  });

  it('une indisponibilité gagne sur rien', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [],
      ALL_LAYERS,
      [decl({ kind: 'UNAVAILABLE' })],
      NOW,
    );

    expect(detail.slots.map((s) => s.winner)).toEqual([
      'unavailable',
      'unavailable',
      'unavailable',
    ]);
  });

  it('une disponibilité déclarée donne « available »', () => {
    const detail = buildDayDetail('2026-08-20', [], ALL_LAYERS, [decl()], NOW);

    expect(detail.slots.every((s) => s.winner === 'available')).toBe(true);
  });

  it('un créneau sans rien donne « none »', () => {
    const detail = buildDayDetail('2026-08-20', [], ALL_LAYERS, [], NOW);

    expect(detail.slots.every((s) => s.winner === 'none')).toBe(true);
  });

  it('l’arbitrage est BANDE PAR BANDE, jamais à la journée (AC2)', () => {
    const detail = buildDayDetail('2026-08-20', [seanceEntry()], ALL_LAYERS, [decl()], NOW);

    expect(detail.slots.map((s) => s.winner)).toEqual(['available', 'available', 'seance']);
  });

  it('une séance sans créneau (FULL_DAY) occupe les trois bandes (AC11 / AD-9)', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [seanceEntry({ slot: 'FULL_DAY' })],
      ALL_LAYERS,
      [],
      NOW,
    );

    expect(detail.slots.every((s) => s.winner === 'seance')).toBe(true);
  });

  it('la couche éteinte retire le TEXTE mais pas le rang ni l’indisponibilité (AC6)', () => {
    const sansSeances = ALL_LAYERS.filter((l) => l !== 'mes-seances');
    const detail = buildDayDetail('2026-08-20', [seanceEntry()], sansSeances, [], NOW);

    expect(detail.slots[2].winner).toBe('seance');
    expect(detail.slots[2].seanceLabel).toBeNull();
    expect(detail.slots[2].status).toBe('UNAVAILABLE');
  });
});

describe('bandsAreUniform — la fusion des trois bandes (AC4)', () => {
  it('fusionne un jour entièrement disponible', () => {
    expect(bandsAreUniform(buildDayDetail('2026-08-20', [], ALL_LAYERS, [decl()], NOW))).toBe(true);
  });

  it('fusionne un jour entièrement vierge', () => {
    expect(bandsAreUniform(buildDayDetail('2026-08-20', [], ALL_LAYERS, [], NOW))).toBe(true);
  });

  it('ne fusionne pas quand un créneau diffère', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [],
      ALL_LAYERS,
      [decl({ slot: 'MORNING', kind: 'UNAVAILABLE' })],
      NOW,
    );

    expect(bandsAreUniform(detail)).toBe(false);
  });

  it('ne fusionne JAMAIS quand un événement est posé, même sur les trois créneaux', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [seanceEntry({ slot: 'FULL_DAY' })],
      ALL_LAYERS,
      [],
      NOW,
    );

    expect(detail.slots.every((s) => s.winner === 'seance')).toBe(true);
    expect(bandsAreUniform(detail)).toBe(false);
  });

  it('ne fusionne pas un jour couvert par un vote sur les trois créneaux', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [pollEntry({ slot: 'FULL_DAY' })],
      ALL_LAYERS,
      [],
      NOW,
    );

    expect(bandsAreUniform(detail)).toBe(false);
  });
});

describe('buildMonthDetails — la projection du mois', () => {
  it('rend une entrée par jour demandé', () => {
    const keys = ['2026-08-19', '2026-08-20', '2026-08-21'];
    const map = buildMonthDetails(keys, [seanceEntry()], ALL_LAYERS, [], NOW);

    expect([...map.keys()]).toEqual(keys);
    expect(map.get('2026-08-20')!.slots[2].winner).toBe('seance');
    expect(map.get('2026-08-19')!.isEmpty).toBe(true);
  });

  it('produit exactement le même détail que buildDayDetail pour un jour donné', () => {
    const direct = buildDayDetail('2026-08-20', [seanceEntry()], ALL_LAYERS, [decl()], NOW);
    const viaMonth = buildMonthDetails(['2026-08-20'], [seanceEntry()], ALL_LAYERS, [decl()], NOW);

    expect(viaMonth.get('2026-08-20')).toEqual(direct);
  });

  it('supporte une grille de 42 jours', () => {
    const keys = Array.from(
      { length: 42 },
      (_, i) => `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
    );
    const map = buildMonthDetails(keys, [], ALL_LAYERS, [], NOW);

    expect(map.size).toBeGreaterThan(0);
    for (const detail of map.values()) expect(detail.slots).toHaveLength(3);
  });
});

// ─── Informations pratiques (Story 36.5, D-15 amendée) ───────────────────────

describe('buildDayDetail — les informations pratiques', () => {
  it('AC3 : les trois champs sont portés par le créneau qui gagne', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [
        seanceEntry({
          seanceHeure: '20:30',
          seanceLieu: 'chez Marc',
          seanceNote: 'pensez aux dés',
        }),
      ],
      ALL_LAYERS,
      [],
      NOW,
    );

    const soir = detail.slots[2];
    expect(soir.seanceHeure).toBe('20:30');
    expect(soir.seanceLieu).toBe('chez Marc');
    expect(soir.seanceNote).toBe('pensez aux dés');
  });

  it('AC8 : couche « mes séances » éteinte → les trois disparaissent AVEC le titre', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [
        seanceEntry({
          seanceHeure: '20:30',
          seanceLieu: 'chez Marc',
          seanceNote: 'pensez aux dés',
        }),
      ],
      ALL_LAYERS.filter((l) => l !== 'mes-seances'),
      [],
      NOW,
    );

    const soir = detail.slots[2];
    expect(soir.seanceLabel).toBeNull();
    expect(soir.seanceHeure).toBeNull();
    expect(soir.seanceLieu).toBeNull();
    expect(soir.seanceNote).toBeNull();
    // …mais l'indisponibilité qui en découle demeure (FR-50).
    expect(soir.status).toBe('UNAVAILABLE');
  });

  it('AC4 : une séance sans informations pratiques les expose à null', () => {
    const detail = buildDayDetail('2026-08-20', [seanceEntry()], ALL_LAYERS, [], NOW);

    const soir = detail.slots[2];
    expect(soir.seanceLabel).toBe('Le Convoi du Nord');
    expect(soir.seanceHeure).toBeNull();
    expect(soir.seanceLieu).toBeNull();
    expect(soir.seanceNote).toBeNull();
  });

  it('AC4 : une séance n’ayant QU’UN lieu ne renseigne que celui-ci', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [seanceEntry({ label: 'Les Cendres d’Ashal', seanceLieu: 'en visio' })],
      ALL_LAYERS,
      [],
      NOW,
    );

    const soir = detail.slots[2];
    expect(soir.seanceLieu).toBe('en visio');
    expect(soir.seanceHeure).toBeNull();
    expect(soir.seanceNote).toBeNull();
  });

  it('un vote gagnant ne porte aucune information pratique (elles appartiennent à la séance)', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [
        {
          key: 'poll-1',
          type: 'votes-en-cours',
          date: '2026-08-20',
          label: 'Vote de date',
          slot: 'EVENING',
        },
      ],
      ALL_LAYERS,
      [],
      NOW,
    );

    const soir = detail.slots[2];
    expect(soir.winner).toBe('vote');
    expect(soir.seanceHeure).toBeNull();
    expect(soir.seanceLieu).toBeNull();
    expect(soir.seanceNote).toBeNull();
  });
});

describe('composeSeanceInfo — l’ordre de repli (AC3)', () => {
  const full = {
    seanceHeure: '20:30',
    seanceLieu: 'chez Marc',
    seanceNote: 'pensez aux dés',
  };

  it('niveau « full » : les trois, dans l’ordre heure · lieu · note', () => {
    expect(composeSeanceInfo(full, 'full')).toBe('20:30 · chez Marc · pensez aux dés');
  });

  it('niveau « compact » : la NOTE cède la première', () => {
    expect(composeSeanceInfo(full, 'compact')).toBe('20:30 · chez Marc');
  });

  it('niveau « minimal » : puis le lieu — l’heure tient le plus longtemps', () => {
    expect(composeSeanceInfo(full, 'minimal')).toBe('20:30');
  });

  it('AC4 : aucun champ → chaîne vide, jamais un séparateur orphelin', () => {
    expect(
      composeSeanceInfo({ seanceHeure: null, seanceLieu: null, seanceNote: null }, 'full'),
    ).toBe('');
  });

  it('AC4 : un seul champ → pas de séparateur', () => {
    expect(
      composeSeanceInfo({ seanceHeure: null, seanceLieu: 'en visio', seanceNote: null }, 'full'),
    ).toBe('en visio');
  });

  it('AC4 : un trou au milieu ne laisse pas de double séparateur', () => {
    expect(
      composeSeanceInfo(
        { seanceHeure: '20:30', seanceLieu: null, seanceNote: 'pensez aux dés' },
        'full',
      ),
    ).toBe('20:30 · pensez aux dés');
  });

  it('les valeurs vides ou blanches sont traitées comme absentes', () => {
    expect(
      composeSeanceInfo({ seanceHeure: '', seanceLieu: '   ', seanceNote: 'dés' }, 'full'),
    ).toBe('dés');
  });

  it('AC2 : l’heure est reprise TELLE QUELLE, jamais reformatée', () => {
    expect(
      composeSeanceInfo({ seanceHeure: '09:05', seanceLieu: null, seanceNote: null }, 'full'),
    ).toBe('09:05');
  });
});

describe('buildDayDetail — la disponibilité du groupe, canal séparé (Story 36.8)', () => {
  function groupEntry(over: Partial<AgendaEntry> = {}): AgendaEntry {
    return {
      key: 'groupe-2026-08-20-EVENING',
      type: 'disponibilite-groupe',
      date: '2026-08-20',
      label: 'Soir — 2/4 disponibles',
      slot: 'EVENING',
      group: { available: 2, unavailable: 1, unknown: 1, total: 4, members: null },
      ...over,
    };
  }

  it('projette le canal sur le créneau que l’entrée couvre (AC1)', () => {
    const detail = buildDayDetail('2026-08-20', [groupEntry()], ALL_LAYERS, [], NOW);

    const evening = detail.slots.find((s) => s.slot === 'EVENING')!;
    expect(evening.group).toEqual({
      available: 2,
      unavailable: 1,
      unknown: 1,
      total: 4,
      members: null,
    });
    // Les autres créneaux ne l'héritent pas : l'entrée nomme son créneau.
    expect(detail.slots.find((s) => s.slot === 'MORNING')!.group).toBeNull();
  });

  it('SURVIT à une séance ET à un vote sur le même créneau — c’est tout l’intérêt du canal (AC2)', () => {
    const withSeance = buildDayDetail(
      '2026-08-20',
      [seanceEntry(), groupEntry()],
      ALL_LAYERS,
      [],
      NOW,
    );
    const eveningSeance = withSeance.slots.find((s) => s.slot === 'EVENING')!;
    expect(eveningSeance.winner).toBe('seance');
    expect(eveningSeance.group).not.toBeNull();

    const withVote = buildDayDetail(
      '2026-08-20',
      [
        {
          key: 'poll-1',
          type: 'votes-en-cours',
          date: '2026-08-20',
          label: 'Vote',
          slot: 'EVENING',
        },
        groupEntry(),
      ],
      ALL_LAYERS,
      [],
      NOW,
    );
    const eveningVote = withVote.slots.find((s) => s.slot === 'EVENING')!;
    expect(eveningVote.winner).toBe('vote');
    expect(eveningVote.group).not.toBeNull();
  });

  it('n’entre JAMAIS dans la préséance — le rang reste celui du statut déclaré (AC1)', () => {
    const detail = buildDayDetail('2026-08-20', [groupEntry()], ALL_LAYERS, [], NOW);

    // Aucune déclaration, aucun objet posé : sans le canal le créneau serait 'none', et il l'est.
    expect(detail.slots.find((s) => s.slot === 'EVENING')!.winner).toBe('none');
    expect(SLOT_PRECEDENCE).not.toContain('groupe');
  });

  it('disparaît quand la couche est éteinte (AC10)', () => {
    const layers = ALL_LAYERS.filter((k) => k !== 'disponibilite-groupe');
    const detail = buildDayDetail('2026-08-20', [groupEntry()], layers, [], NOW);

    expect(detail.slots.every((s) => s.group === null)).toBe(true);
  });

  it('FULL_DAY couvre les trois créneaux, comme partout ailleurs', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [groupEntry({ slot: 'FULL_DAY' })],
      ALL_LAYERS,
      [],
      NOW,
    );

    expect(detail.slots.every((s) => s.group !== null)).toBe(true);
  });

  it('une entrée sans charge utile structurée ne pose rien — jamais un canal vide inventé', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [groupEntry({ group: undefined })],
      ALL_LAYERS,
      [],
      NOW,
    );

    expect(detail.slots.find((s) => s.slot === 'EVENING')!.group).toBeNull();
  });

  it('ne rend pas un jour « porteur » : le groupe DÉCRIT un créneau, il n’y ajoute rien à faire', () => {
    const detail = buildDayDetail('2026-08-20', [groupEntry()], ALL_LAYERS, [], NOW);
    expect(detail.isEmpty).toBe(true);
  });
});

describe('buildDayDetail — le filtre par partie (Story 44.8)', () => {
  const vote = (partieId: string, key: string, label: string): AgendaEntry => ({
    key,
    type: 'votes-en-cours',
    date: '2026-08-20',
    label,
    slot: 'EVENING',
    vote: {
      partieId,
      pollId: key,
      optionId: 'o1',
      yes: 1,
      maybe: 0,
      no: 0,
      total: 3,
      myAnswer: null,
    },
  });
  const HIDDEN = new Set(['p1']);

  it('sans filtre ou avec un ensemble vide, rien ne change', () => {
    const entries = [seanceEntry(), vote('p2', 'v2', 'Vote B')];
    const base = buildDayDetail('2026-08-20', entries, ALL_LAYERS, [], NOW);
    expect(buildDayDetail('2026-08-20', entries, ALL_LAYERS, [], NOW, null)).toEqual(base);
    expect(buildDayDetail('2026-08-20', entries, ALL_LAYERS, [], NOW, new Set())).toEqual(base);
  });

  it('le vote d’une partie masquée disparaît du créneau, comme s’il n’existait pas', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [vote('p1', 'v1', 'Vote A')],
      ALL_LAYERS,
      [],
      NOW,
      HIDDEN,
    );
    expect(detail.slots[2].pollLabel).toBeNull();
    expect(detail.slots[2].pollVote).toBeNull();
    expect(detail.slots[2].winner).not.toBe('vote');
  });

  it('la séance d’une partie masquée garde le créneau INDISPONIBLE mais n’est jamais nommée (FR-50)', () => {
    const detail = buildDayDetail('2026-08-20', [seanceEntry()], ALL_LAYERS, [decl()], NOW, HIDDEN);
    expect(detail.slots[2].seanceLabel).toBeNull();
    expect(detail.slots[2].seanceTarget).toBeNull();
    expect(detail.slots[2].status).toBe('UNAVAILABLE');
    expect(detail.slots[2].winner).toBe('seance');
  });

  it('une séance visible et une masquée sur le même créneau : la visible est nommée, sans « +1 autre »', () => {
    const hidden = seanceEntry({
      key: 'seance-s2',
      seanceId: 's2',
      label: 'Caché',
      partieId: 'p1',
    });
    const visible = seanceEntry({
      key: 'seance-s3',
      seanceId: 's3',
      label: 'Visible',
      partieId: 'p2',
    });
    const detail = buildDayDetail('2026-08-20', [hidden, visible], ALL_LAYERS, [], NOW, HIDDEN);
    expect(detail.slots[2].seanceLabel).toBe('Visible');
  });

  it('les parties non masquées et les déclarations ne sont pas touchées', () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [vote('p2', 'v2', 'Vote B')],
      ALL_LAYERS,
      [decl()],
      NOW,
      HIDDEN,
    );
    expect(detail.slots[2].pollLabel).toBe('Vote B');
    expect(detail.slots[0].status).toBe('AVAILABLE');
  });

  it('buildMonthDetails transmet le filtre', () => {
    const map = buildMonthDetails(['2026-08-20'], [seanceEntry()], ALL_LAYERS, [], NOW, HIDDEN);
    expect(map.get('2026-08-20')!.slots[2].seanceLabel).toBeNull();
  });

  it('entryPartieId lit la partie d’une séance, d’un vote, et rien pour une déclaration', () => {
    expect(entryPartieId(seanceEntry())).toBe('p1');
    expect(entryPartieId(vote('p9', 'v', 'x'))).toBe('p9');
    expect(
      entryPartieId({ key: 'd', type: 'mes-disponibilites', date: '2026-08-20', label: '' }),
    ).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 47.5 — voter une plage : toutes les options qui couvrent un créneau
// ─────────────────────────────────────────────────────────────────────────────

describe('buildDayDetail — les plages d’un même vote sur un créneau (Story 47.5)', () => {
  const participation = (optionId: string, pollId = 'poll-1') => ({
    partieId: 'p1',
    pollId,
    optionId,
    yes: 1,
    maybe: 0,
    no: 0,
    total: 4,
    myAnswer: null,
  });
  // Durée 3 : samedi matin → samedi soir (a), samedi après-midi → dimanche matin (b). Elles se recouvrent
  // le samedi après-midi et le samedi soir.
  const a = pollEntry({
    key: 'opt-a',
    date: '2026-08-22',
    slot: 'MORNING',
    endDate: '2026-08-22',
    endSlot: 'EVENING',
    vote: participation('a'),
  });
  const b = pollEntry({
    key: 'opt-b',
    date: '2026-08-22',
    slot: 'AFTERNOON',
    endDate: '2026-08-23',
    endSlot: 'MORNING',
    vote: participation('b'),
  });

  it('un créneau couvert deux fois porte les deux options, dans l’ordre de leur début, et leur compte', () => {
    // Entrées passées à l’envers : l’ordre est celui du début, pas celui de la liste.
    const detail = buildDayDetail('2026-08-22', [b, a], ALL_LAYERS, [], NOW);
    const afternoon = detail.slots[1];
    expect(afternoon.pollCount).toBe(2);
    expect(afternoon.pollVotes.map((v) => v.vote.optionId)).toEqual(['a', 'b']);
    expect(afternoon.pollVotes[0].range).toBe('sam. 22 matin → sam. 22 soir');
    expect(afternoon.pollVotes[1].range).toBe('sam. 22 après-midi → dim. 23 matin');
    expect(afternoon.pollVotes[1].rangeSentence).toBe(
      'du samedi 22 après-midi au dimanche 23 matin',
    );
  });

  it('un créneau couvert une seule fois n’a qu’une option ; pollVote garde son sens (la première)', () => {
    const detail = buildDayDetail('2026-08-22', [a, b], ALL_LAYERS, [], NOW);
    const morning = detail.slots[0];
    expect(morning.pollCount).toBe(1);
    expect(morning.pollVotes.map((v) => v.vote.optionId)).toEqual(['a']);
    expect(morning.pollVote?.optionId).toBe('a');
  });

  it('un créneau seul : une option, sans plage écrite — la sortie d’avant', () => {
    const single = pollEntry({ vote: participation('s') });
    const detail = buildDayDetail('2026-08-20', [single], ALL_LAYERS, [], NOW);
    expect(detail.slots[2].pollCount).toBe(1);
    expect(detail.slots[2].pollVotes).toHaveLength(1);
    expect(detail.slots[2].pollVotes[0].range).toBe('');
    expect(detail.slots[2].pollVote?.optionId).toBe('s');
  });

  it('un AUTRE vote qui couvre le même créneau ne se mêle pas aux lignes (il reste « +1 autre »)', () => {
    const other = pollEntry({
      key: 'opt-z',
      date: '2026-08-22',
      slot: 'AFTERNOON',
      label: 'Autre vote',
      vote: participation('z', 'poll-2'),
    });
    const detail = buildDayDetail('2026-08-22', [a, other], ALL_LAYERS, [], NOW);
    expect(detail.slots[1].pollVotes.map((v) => v.vote.optionId)).toEqual(['a']);
    expect(detail.slots[1].pollCount).toBe(1);
    expect(detail.slots[1].pollLabel).toContain('+1 autre');
  });

  it('couche « votes en cours » éteinte : ni lignes ni compte (comme pollVote)', () => {
    const layers = ALL_LAYERS.filter((l) => l !== 'votes-en-cours');
    const detail = buildDayDetail('2026-08-22', [a, b], layers, [], NOW);
    expect(detail.slots[1].pollVotes).toEqual([]);
    expect(detail.slots[1].pollCount).toBe(0);
    expect(detail.slots[1].pollVote).toBeNull();
  });

  it('la plage couvre le deuxième jour : le créneau du lendemain porte l’option qui le couvre', () => {
    const detail = buildDayDetail('2026-08-23', [a, b], ALL_LAYERS, [], NOW);
    expect(detail.slots[0].pollVotes.map((v) => v.vote.optionId)).toEqual(['b']);
    expect(detail.slots[0].pollCount).toBe(1);
  });
});

describe('entryCoveredDays — les jours d’une plage (Story 47.5)', () => {
  it('un créneau seul : son jour', () => {
    expect(entryCoveredDays(pollEntry())).toEqual(['2026-08-20']);
  });

  it('une plage : chacun de ses jours, du soir au lendemain compris', () => {
    const span = pollEntry({
      date: '2026-11-06',
      slot: 'EVENING',
      endDate: '2026-11-08',
      endSlot: 'AFTERNOON',
    });
    expect(entryCoveredDays(span)).toEqual(['2026-11-06', '2026-11-07', '2026-11-08']);
  });

  it('une plage qui franchit la fin du mois', () => {
    const span = pollEntry({
      date: '2026-10-31',
      slot: 'EVENING',
      endDate: '2026-11-01',
      endSlot: 'MORNING',
    });
    expect(entryCoveredDays(span)).toEqual(['2026-10-31', '2026-11-01']);
  });
});
