import { describe, expect, it } from 'vitest';
import { THEMES, TONE_MAP } from '../../core/theme/tones';
import {
  GROUP_PASTILLE_MAX,
  type GroupAvailability,
  type GroupMember,
  groupAriaLabel,
  groupCounterLabel,
  groupFillRatio,
  groupIsAllBlocked,
  memberStatusGlyph,
  memberStatusWord,
  showsMemberPastilles,
  worstAvailability,
} from './group-availability.utils';

// Thème de référence pour les cas courants ; le bloc « voix par thème » en bas vérifie les autres.
const tone = TONE_MAP['grimoire-emeraude'];

function member(id: string, status: GroupMember['status']): GroupMember {
  return { userId: id, pseudo: id, displayName: id.toUpperCase(), status };
}

function group(partial: Partial<GroupAvailability> = {}): GroupAvailability {
  return {
    available: 0,
    unavailable: 0,
    unknown: 0,
    total: 4,
    members: null,
    ...partial,
  };
}

describe('groupFillRatio (Story 36.8)', () => {
  it('remplit à proportion des membres disponibles (AC3)', () => {
    expect(groupFillRatio(group({ available: 1, unknown: 3 }))).toBe(25);
    expect(groupFillRatio(group({ available: 4 }))).toBe(100);
  });

  it('rend zéro sur un effectif nul — jamais une division par zéro ni un NaN dans un style', () => {
    expect(groupFillRatio(group({ available: 2, total: 0 }))).toBe(0);
    expect(groupFillRatio(group({ available: undefined as unknown as number, total: 4 }))).toBe(0);
  });

  it('borne à 100 % un effectif périmé (plus de disponibles que de membres)', () => {
    expect(groupFillRatio(group({ available: 6, total: 4 }))).toBe(100);
  });
});

describe('les deux vides (AC6, Story 36.8)', () => {
  it('« tout le monde est bloqué » quand unavailable atteint l’effectif', () => {
    expect(groupIsAllBlocked(group({ unavailable: 4, total: 4 }))).toBe(true);
  });

  it('« personne ne s’est prononcé » n’est PAS « tout le monde est bloqué »', () => {
    const nobodySpoke = group({ unknown: 4 });
    expect(groupIsAllBlocked(nobodySpoke)).toBe(false);
    expect(groupFillRatio(nobodySpoke)).toBe(0);
    // Les deux états rendent une jauge de hauteur nulle : sans le drapeau, ils seraient
    // indistinguables. C'est exactement ce que l'AC6 interdit.
    expect(groupFillRatio(group({ unavailable: 4, total: 4 }))).toBe(0);
  });

  it('cas intermédiaire tranché par la story : personne de dispo, une PARTIE bloquée ⇒ pas « tout le monde »', () => {
    expect(groupIsAllBlocked(group({ unavailable: 2, unknown: 2, total: 4 }))).toBe(false);
  });

  it('un effectif nul n’est jamais « tout le monde est bloqué »', () => {
    expect(groupIsAllBlocked(group({ unavailable: 0, total: 0 }))).toBe(false);
  });
});

describe('showsMemberPastilles (AC4/AC5, Story 36.8)', () => {
  it('rend des pastilles jusqu’à six membres', () => {
    const six = Array.from({ length: GROUP_PASTILLE_MAX }, (_, i) => member(`u${i}`, 'AVAILABLE'));
    expect(showsMemberPastilles(group({ members: six, total: 6 }))).toBe(true);
  });

  it('retombe sur la jauge au-delà de six (AC5)', () => {
    const seven = Array.from({ length: 7 }, (_, i) => member(`u${i}`, 'AVAILABLE'));
    expect(showsMemberPastilles(group({ members: seven, total: 7 }))).toBe(false);
  });

  it('retombe sur la jauge quand le serveur n’a servi aucune identité (joueur, AC3)', () => {
    expect(showsMemberPastilles(group({ members: null }))).toBe(false);
  });

  it('retombe sur la jauge sur une liste vide — « aucune identité » n’est pas « troupe de zéro »', () => {
    expect(showsMemberPastilles(group({ members: [] }))).toBe(false);
  });
});

describe('groupAriaLabel (AC15, Story 36.8)', () => {
  it('dit toujours les disponibles sur l’effectif', () => {
    expect(groupAriaLabel(group({ available: 2, unknown: 2 }), tone)).toContain(
      '2 sur 4 disponibles',
    );
  });

  it('distingue les deux vides EN TOUTES LETTRES, sans la couleur (AC6 + P-1)', () => {
    expect(groupAriaLabel(group({ unavailable: 4, total: 4 }), tone)).toContain(
      'tous les compagnons sont empêchés',
    );
    expect(groupAriaLabel(group({ unknown: 4 }), tone)).toContain('nul ne s’est prononcé');
  });

  it('nomme les membres et leur statut quand le serveur en a servi (AC7, vue MJ)', () => {
    const label = groupAriaLabel(
      group({
        available: 1,
        unavailable: 1,
        unknown: 1,
        total: 3,
        members: [
          member('alice', 'AVAILABLE'),
          member('bob', 'UNAVAILABLE'),
          member('carol', 'UNKNOWN'),
        ],
      }),
      tone,
    );
    expect(label).toContain('ALICE disponible');
    expect(label).toContain('BOB indisponible');
    expect(label).toContain('CAROL sans réponse');
  });

  it('ne nomme personne quand aucune identité n’est servie (AC3, vue joueur)', () => {
    const counts = { available: 2, unavailable: 1, unknown: 1 };
    const anonymous = groupAriaLabel(group(counts), tone);
    // Assertion d'égalité STRICTE : « ne contient pas tel nom » passerait aussi pour une
    // mauvaise raison (un nom absent de la fixture). Ici, la seule chose que le libellé peut
    // dire, ce sont les nombres.
    expect(anonymous).toBe('Disponibilité de la troupe : 2 sur 4 disponibles — 1 indisponible');

    // Et la preuve que c'est bien la donnée qui décide : mêmes compteurs, identités servies.
    const named = groupAriaLabel(
      group({
        ...counts,
        members: [
          member('alice', 'AVAILABLE'),
          member('bob', 'AVAILABLE'),
          member('carol', 'UNAVAILABLE'),
          member('dave', 'UNKNOWN'),
        ],
      }),
      tone,
    );
    expect(named).toContain('ALICE disponible');
    expect(named.startsWith(anonymous)).toBe(true);
  });
});

describe('groupCounterLabel (Story 36.8)', () => {
  it('double la forme là où il y a la place', () => {
    expect(groupCounterLabel(group({ available: 2 }))).toBe('2 / 4');
  });

  it('borne un effectif périmé — jamais « 5 / 4 »', () => {
    expect(groupCounterLabel(group({ available: 5, total: 4 }))).toBe('4 / 4');
  });
});

describe('memberStatusWord (Story 36.8)', () => {
  it('écrit les trois statuts en toutes lettres — point unique du vocabulaire', () => {
    expect(memberStatusWord(member('a', 'AVAILABLE'), tone)).toBe('disponible');
    expect(memberStatusWord(member('a', 'UNAVAILABLE'), tone)).toBe('indisponible');
    expect(memberStatusWord(member('a', 'UNKNOWN'), tone)).toBe('sans réponse');
  });
});

describe('memberStatusGlyph (revue de code, Story 36.8)', () => {
  it('donne un glyphe distinct par statut — jamais la seule couleur sous le seuil téléphone', () => {
    expect(memberStatusGlyph(member('a', 'AVAILABLE'))).toBe('D');
    expect(memberStatusGlyph(member('a', 'UNAVAILABLE'))).toBe('I');
    expect(memberStatusGlyph(member('a', 'UNKNOWN'))).toBe('?');
  });
});

// Story 35.3 — les voix divergent : le nom accessible du canal et le mot de statut lisent le ton
// passé, jamais celui du thème de référence.
describe('voix par thème — le ton passé est celui qui parle', () => {
  for (const theme of THEMES) {
    const t = TONE_MAP[theme];

    it(`${theme} : le nom accessible dit « tout le monde est bloqué » dans la voix du thème`, () => {
      expect(groupAriaLabel(group({ unavailable: 4, total: 4 }), t)).toContain(
        t['calendar.util_group_all_blocked'],
      );
    });

    it(`${theme} : le statut d'un membre reprend les mots du thème`, () => {
      expect(memberStatusWord(member('a', 'AVAILABLE'), t)).toBe(
        t['calendar.week_status_available'],
      );
      expect(memberStatusWord(member('a', 'UNKNOWN'), t)).toBe(t['calendar.util_word_no_answer']);
    });
  }

  it('le même effectif se dit autrement dans chaque thème', () => {
    const labels = THEMES.map((theme) =>
      groupAriaLabel(group({ unavailable: 4, total: 4 }), TONE_MAP[theme]),
    );
    expect(new Set(labels).size).toBe(THEMES.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 47.5 — la pire disponibilité d’une plage candidate
// ─────────────────────────────────────────────────────────────────────────────

describe('worstAvailability — le plus petit nombre de disponibles sur la plage (Story 47.5)', () => {
  const cell = (date: string, slot: 'MORNING' | 'AFTERNOON' | 'EVENING', available: number) => ({
    date,
    slot,
    available,
  });
  // Vendredi soir → dimanche après-midi : 6 créneaux.
  const weekend = [
    cell('2026-11-06', 'EVENING', 5),
    cell('2026-11-07', 'MORNING', 2),
    cell('2026-11-07', 'AFTERNOON', 4),
    cell('2026-11-07', 'EVENING', 6),
    cell('2026-11-08', 'MORNING', 3),
    cell('2026-11-08', 'AFTERNOON', 5),
  ];

  it('6 créneaux, 5, 2, 4… : le pire est 2', () => {
    expect(worstAvailability(weekend, { date: '2026-11-06', slot: 'EVENING' }, 6)).toBe(2);
  });

  it('une cellule manquante : pas de chiffre (jamais un chiffre partiel)', () => {
    const missing = weekend.filter((c) => !(c.date === '2026-11-08' && c.slot === 'AFTERNOON'));
    expect(worstAvailability(missing, { date: '2026-11-06', slot: 'EVENING' }, 6)).toBeNull();
  });

  it('une carte vide : pas de chiffre', () => {
    expect(worstAvailability([], { date: '2026-11-06', slot: 'EVENING' }, 6)).toBeNull();
  });

  it('une durée invalide : pas de chiffre', () => {
    expect(worstAvailability(weekend, { date: '2026-11-06', slot: 'EVENING' }, 0)).toBeNull();
    expect(worstAvailability(weekend, { date: '2026-11-06', slot: 'FULL_DAY' }, 3)).toBeNull();
  });

  it('un zéro est un chiffre (personne de libre sur toute la plage)', () => {
    const zero = weekend.map((c) => (c.slot === 'MORNING' && c.date === '2026-11-07' ? cell(c.date, 'MORNING', 0) : c));
    expect(worstAvailability(zero, { date: '2026-11-06', slot: 'EVENING' }, 6)).toBe(0);
  });

  it('accepte une date ISO complète côté carte comme côté départ', () => {
    const iso = weekend.map((c) => ({ ...c, date: `${c.date}T00:00:00.000Z` }));
    expect(worstAvailability(iso, { date: '2026-11-06T00:00:00.000Z', slot: 'EVENING' }, 6)).toBe(2);
  });
});
