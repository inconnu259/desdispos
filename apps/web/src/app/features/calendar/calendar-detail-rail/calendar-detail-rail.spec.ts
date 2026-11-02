import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { afterEach, describe, expect, it } from 'vitest';
import type { CalendarLayerKey } from '@master-jdr/shared';
import { CalendarDetailRail } from './calendar-detail-rail';
import type { AgendaEntry } from '../calendar-agenda-view/calendar-agenda-view';
import { type DayDetail, buildDayDetail } from '../day-detail.utils';
import { TONE_MAP } from '../../../core/theme/tones';
import { fillTone } from '../../../core/theme/tone-format';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

const ALL_LAYERS: CalendarLayerKey[] = [
  'mes-indisponibilites',
  'mes-disponibilites',
  'mes-seances',
  'votes-en-cours',
  'inscriptions-ouvertes',
  'disponibilite-groupe',
];

const NOW = new Date('2026-08-17T00:00:00Z');

const SEANCE: AgendaEntry = {
  key: 'seance-s1',
  type: 'mes-seances',
  date: '2026-08-20',
  label: 'Le Convoi du Nord',
  slot: 'EVENING',
  partieId: 'p1',
  scenarioId: 'sc1',
  seanceId: 's1',
};

async function createRail(detail: DayDetail | null, touchedSlot: string | null = null) {
  await TestBed.configureTestingModule({
    imports: [CalendarDetailRail],
    providers: [provideAnimationsAsync()],
  }).compileComponents();

  const fixture = TestBed.createComponent(CalendarDetailRail);
  fixture.componentRef.setInput('detail', detail);
  fixture.componentRef.setInput('touchedSlot', touchedSlot);
  fixture.detectChanges();
  return fixture;
}

/** Story 36.6 — une option de vote sur le créneau du matin, avec sa participation. */
const VOTE: AgendaEntry = {
  key: 'poll-p1-o1',
  type: 'votes-en-cours',
  date: '2026-08-20',
  label: 'Les Cendres d’Ashal',
  slot: 'MORNING',
  vote: {
    partieId: 'partie-1',
    pollId: 'p1',
    optionId: 'o1',
    yes: 2,
    maybe: 1,
    no: 0,
    total: 4,
    myAnswer: 'YES',
  },
};

afterEach(() => TestBed.resetTestingModule());

describe('CalendarDetailRail — structure', () => {
  it('rend toujours trois lignes de créneau, même sur un jour vide (AC2/AC4)', async () => {
    const detail = buildDayDetail('2026-08-20', [], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    const lines = fixture.nativeElement.querySelectorAll('.it');
    expect(lines).toHaveLength(3);
  });

  it('rend la ligne « Matin » même quand seul le soir porte une séance', async () => {
    const detail = buildDayDetail('2026-08-20', [SEANCE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    const text = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelectorAll('.it')).toHaveLength(3);
    expect(text).toContain('Matin');
    expect(text).toContain('Après-midi');
    expect(text).toContain('Soir');
  });

  it('dit explicitement qu’un créneau ne porte rien plutôt que de rester vide (AC4)', async () => {
    const detail = buildDayDetail('2026-08-20', [], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    expect(fixture.nativeElement.textContent).toContain(
      GRIMOIRE_TONE['calendar.rail_status_unknown'],
    );
  });

  it('affiche le libellé du jour', async () => {
    const detail = buildDayDetail('2026-08-20', [], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    expect(fixture.nativeElement.querySelector('.dl').textContent).toContain('20 août');
  });

  it('nomme le créneau touché dans le libellé quand le geste en désignait un', async () => {
    const detail = buildDayDetail('2026-08-20', [SEANCE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail, 'EVENING');

    expect(fixture.nativeElement.querySelector('.dl').textContent).toContain('soir');
  });

  it('ne nomme aucun créneau dans le libellé pour un tap FULL_DAY', async () => {
    const detail = buildDayDetail('2026-08-20', [SEANCE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail, 'FULL_DAY');

    expect(fixture.nativeElement.querySelector('.dl').textContent).not.toContain('—');
  });
});

describe('CalendarDetailRail — accessibilité', () => {
  it('est une région live, pour un contenu qui change sans action explicite (AC10)', async () => {
    const detail = buildDayDetail('2026-08-20', [], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    const rail = fixture.nativeElement.querySelector('.rail');
    expect(rail.getAttribute('aria-live')).toBe('polite');
    expect(rail.getAttribute('role')).toBe('region');
  });

  it('masque les icônes de créneau aux lecteurs d’écran — le mot les nomme déjà', async () => {
    const detail = buildDayDetail('2026-08-20', [], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    const icons = fixture.nativeElement.querySelectorAll('app-icon.ic');
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
      expect(icon.querySelector('svg')!.getAttribute('aria-label')).toBeNull();
    }
    expect(Array.from(icons).map((i: any) => i.getAttribute('data-icon'))).toEqual([
      'matin',
      'apres-midi',
      'soir',
    ]);
  });

  it('écrit l’état en toutes lettres, jamais par la seule couleur (AC8)', async () => {
    const decl = {
      id: 'd1',
      userId: 'u1',
      kind: 'AVAILABLE' as const,
      recurKind: 'PUNCTUAL' as const,
      dayOfWeek: null,
      slot: 'FULL_DAY' as const,
      startDate: '2026-08-20T00:00:00.000Z',
      endDate: '2026-08-20T00:00:00.000Z',
      expiresAt: '2026-12-31T00:00:00.000Z',
      createdAt: '2026-08-01T00:00:00.000Z',
    };
    const detail = buildDayDetail('2026-08-20', [], ALL_LAYERS, [decl], NOW);
    const fixture = await createRail(detail);

    expect(fixture.nativeElement.textContent).toContain('Disponible');
  });
});

describe('CalendarDetailRail — AC11 : activer une ligne ouvre le scénario', () => {
  it('rend un vrai bouton sur la ligne portant une séance', async () => {
    const detail = buildDayDetail('2026-08-20', [SEANCE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    const buttons = fixture.nativeElement.querySelectorAll('button.v--action');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('Le Convoi du Nord');
  });

  it('annonce l’ouverture du SCÉNARIO, pas de la séance', async () => {
    const detail = buildDayDetail('2026-08-20', [SEANCE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    const button = fixture.nativeElement.querySelector('button.v--action');
    expect(button.getAttribute('aria-label')).toBe(
      fillTone(GRIMOIRE_TONE['common.ouvrir_le_scenario_label'], { label: 'Le Convoi du Nord' }),
    );
  });

  it('émet la cible du scénario au clic', async () => {
    const detail = buildDayDetail('2026-08-20', [SEANCE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    const emitted: unknown[] = [];
    fixture.componentInstance.scenarioActivated.subscribe((t) => emitted.push(t));

    fixture.nativeElement.querySelector('button.v--action').click();
    fixture.detectChanges();

    expect(emitted).toEqual([{ partieId: 'p1', scenarioId: 'sc1' }]);
  });

  it('s’active aussi au clavier — c’est un bouton natif, pas un div cliquable', async () => {
    const detail = buildDayDetail('2026-08-20', [SEANCE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    const button = fixture.nativeElement.querySelector('button.v--action');
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    // Un <button> est focalisable et activable à Entrée/Espace sans tabindex ni handler clavier.
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('ne rend AUCUN bouton sur les lignes sans séance — pas d’affordance morte', async () => {
    const detail = buildDayDetail('2026-08-20', [], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);
  });

  it('ne rend aucun bouton quand la couche « mes séances » est éteinte, mais garde l’indisponibilité (AC6)', async () => {
    const sansSeances = ALL_LAYERS.filter((l) => l !== 'mes-seances');
    const detail = buildDayDetail('2026-08-20', [SEANCE], sansSeances, [], NOW);
    const fixture = await createRail(detail);

    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);
    expect(fixture.nativeElement.textContent).not.toContain('Le Convoi du Nord');
    expect(fixture.nativeElement.textContent).toContain('Indisponible');
  });
});

describe('CalendarDetailRail — état sans détail', () => {
  it('reste rendu et le dit, plutôt que de disparaître', async () => {
    const fixture = await createRail(null);

    expect(fixture.nativeElement.querySelector('.rail')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['calendar.rail_empty']);
  });
});

// ─── Informations pratiques (Story 36.5, D-15 amendée) ───────────────────────

describe('CalendarDetailRail — informations pratiques', () => {
  const withInfos = (over: Partial<AgendaEntry>): AgendaEntry => ({ ...SEANCE, ...over });

  it('AC3 : les trois informations sont composées et rendues', async () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [
        withInfos({
          seanceHeure: '20:30',
          seanceLieu: 'chez Marc',
          seanceNote: 'pensez aux dés',
        }),
      ],
      ALL_LAYERS,
      [],
      NOW,
    );
    const fixture = await createRail(detail);

    expect(fixture.nativeElement.textContent).toContain('20:30 · chez Marc · pensez aux dés');
  });

  it('AC4 : aucune information → aucun nœud accessoire n’est rendu', async () => {
    const detail = buildDayDetail('2026-08-20', [SEANCE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    expect(fixture.nativeElement.querySelector('.v .m')).toBeNull();
  });

  it('AC4 : un seul champ → affiché seul, sans séparateur orphelin', async () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [withInfos({ label: 'Les Cendres d’Ashal', seanceLieu: 'en visio' })],
      ALL_LAYERS,
      [],
      NOW,
    );
    const fixture = await createRail(detail);

    expect(fixture.nativeElement.querySelector('.v .m').textContent.trim()).toBe('en visio');
  });

  it('AC8 : couche « mes séances » éteinte → les informations disparaissent avec le titre', async () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [withInfos({ seanceHeure: '20:30', seanceLieu: 'chez Marc' })],
      ALL_LAYERS.filter((l) => l !== 'mes-seances'),
      [],
      NOW,
    );
    const fixture = await createRail(detail);

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('chez Marc');
    expect(text).not.toContain('20:30');
    // …mais le créneau reste indisponible (FR-50).
    expect(text).toContain('Indisponible');
  });

  it('AC9 : du balisage est rendu LITTÉRALEMENT, jamais interprété', async () => {
    const detail = buildDayDetail(
      '2026-08-20',
      [withInfos({ seanceLieu: '<b>gras</b>' })],
      ALL_LAYERS,
      [],
      NOW,
    );
    const fixture = await createRail(detail);

    const node = fixture.nativeElement.querySelector('.v .m');
    expect(node.textContent).toContain('<b>gras</b>');
    expect(node.querySelector('b')).toBeNull();
  });
});

describe('CalendarDetailRail — piste de participation (Story 36.6)', () => {
  it('AC1 — la ligne d’un vote porte sa piste', async () => {
    const detail = buildDayDetail('2026-08-20', [VOTE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    const matin = fixture.nativeElement.querySelectorAll('.it')[0] as HTMLElement;
    expect(matin.querySelector('app-poll-track')).toBeTruthy();
  });

  it('AC4 — le rail porte le compteur « 3 / 4 » à TOUTES les largeurs', async () => {
    const detail = buildDayDetail('2026-08-20', [VOTE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    const matin = fixture.nativeElement.querySelectorAll('.it')[0] as HTMLElement;
    expect(matin.querySelector('.cnt')?.textContent?.trim()).toBe('3 / 4');
  });

  it('AC5 — ma réponse y est rappelée en toutes lettres', async () => {
    const detail = buildDayDetail('2026-08-20', [VOTE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    expect(fixture.nativeElement.textContent).toContain(
      fillTone(GRIMOIRE_TONE['calendar.util_answer_mine'], {
        answer: GRIMOIRE_TONE['calendar.util_answer_yes'],
      }),
    );
  });

  it('couche de votes éteinte : la piste disparaît avec le libellé', async () => {
    const sansVotes = ALL_LAYERS.filter((l) => l !== 'votes-en-cours');
    const detail = buildDayDetail('2026-08-20', [VOTE], sansVotes, [], NOW);
    const fixture = await createRail(detail);

    expect(fixture.nativeElement.querySelector('app-poll-track')).toBeNull();
  });

  it('encadré n°8 — une séance gagnante ne porte pas la piste d’un vote concurrent', async () => {
    const concurrent: AgendaEntry = { ...VOTE, slot: 'EVENING' };
    const detail = buildDayDetail('2026-08-20', [SEANCE, concurrent], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    const soir = fixture.nativeElement.querySelectorAll('.it')[2] as HTMLElement;
    expect(soir.querySelector('app-poll-track')).toBeNull();
  });
});

describe('CalendarDetailRail — le chemin CLAVIER vers le sélecteur de réponse (Story 36.7, AC7)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC7 — une ligne portant une option de vote est un VRAI bouton', async () => {
    // Les bandes des grilles ne sont pas focalisables (126 arrêts de tabulation refusés,
    // EXPERIENCE.md §6 bis) : sans cette ligne, répondre à un vote serait inatteignable au
    // clavier. Le rail est donc le chemin d'accès, exactement comme il l'est déjà pour une séance.
    const detail = buildDayDetail('2026-08-20', [VOTE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    const btn = fixture.nativeElement.querySelector('button.v--vote');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toContain(
      GRIMOIRE_TONE['common.repondre_au_vote_label'].split(' — ')[0],
    );
  });

  it('AC7 — l’activer signale l’option, avec le bouton pour ancre', async () => {
    const detail = buildDayDetail('2026-08-20', [VOTE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);
    const emitted: any[] = [];
    fixture.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    const btn = fixture.nativeElement.querySelector('button.v--vote') as HTMLElement;
    btn.click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].vote.optionId).toBe('o1');
    expect(emitted[0].slot).toBe('MORNING');
    expect(emitted[0].anchor).toBe(btn);
    // Date LOCALE-minuit, comme celle qu'émettent les grilles — jamais UTC (cf.
    // `dateKeyToLocalMidnight`).
    expect(emitted[0].date.getFullYear()).toBe(2026);
    expect(emitted[0].date.getDate()).toBe(20);
  });

  it('Story 47.5 — l’activer signale TOUTES les plages du vote qui couvrent le créneau', async () => {
    const other: AgendaEntry = {
      ...VOTE,
      key: 'poll-p1-o2',
      date: '2026-08-19',
      slot: 'EVENING',
      endDate: '2026-08-20',
      endSlot: 'AFTERNOON',
      vote: { ...VOTE.vote!, optionId: 'o2' },
    };
    const detail = buildDayDetail('2026-08-20', [VOTE, other], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);
    const emitted: any[] = [];
    fixture.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    (fixture.nativeElement.querySelector('button.v--vote') as HTMLElement).click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].lines.map((l: any) => l.vote.optionId).sort()).toEqual(['o1', 'o2']);
  });

  it('AC12 — sans participation servie, la ligne de vote n’est pas activable', async () => {
    // Dégradation honnête héritée de la 36.6 : pas d'agrégats ⇒ pas de piste, donc pas de
    // sélecteur non plus. Une ligne cliquable qui ne saurait pas quoi ouvrir serait un piège.
    const sansPiste = { ...VOTE, vote: undefined };
    const detail = buildDayDetail('2026-08-20', [sansPiste], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);

    expect(fixture.nativeElement.querySelector('button.v--vote')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['common.vote_de_date']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 36.8 — la lecture longue du canal de groupe (AC7)
// ─────────────────────────────────────────────────────────────────────────────

describe('CalendarDetailRail — la disponibilité du groupe (Story 36.8)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const MEMBERS = [
    { userId: 'mj1', pseudo: 'mj', displayName: 'Le MJ', status: 'AVAILABLE' as const },
    { userId: 'u1', pseudo: 'alice', displayName: 'Alice', status: 'UNAVAILABLE' as const },
    { userId: 'u2', pseudo: 'bob', displayName: 'Bob', status: 'UNKNOWN' as const },
  ];

  function groupEntry(members: typeof MEMBERS | null, slot = 'EVENING'): AgendaEntry {
    return {
      key: `groupe-${slot}`,
      type: 'disponibilite-groupe',
      date: '2026-08-20',
      label: 'Soir — 1/3 disponibles',
      slot: slot as AgendaEntry['slot'],
      group: { available: 1, unavailable: 1, unknown: 1, total: 3, members },
    };
  }

  function detailWith(entries: AgendaEntry[], layers: CalendarLayerKey[] = ALL_LAYERS): DayDetail {
    return buildDayDetail('2026-08-20', entries, layers, [], NOW);
  }

  it('AC7 — NOMME les membres et leur statut quand le serveur en sert (MJ)', async () => {
    const fixture = await createRail(detailWith([groupEntry(MEMBERS)]));
    const el = fixture.nativeElement as HTMLElement;

    const names = [...el.querySelectorAll('.grp__m')].map((n) => n.textContent!.trim());
    expect(names.some((n) => n.includes('Le MJ') && n.includes('disponible'))).toBe(true);
    expect(names.some((n) => n.includes('Alice') && n.includes('indisponible'))).toBe(true);
    expect(names.some((n) => n.includes('Bob') && n.includes('sans réponse'))).toBe(true);
  });

  it('🚨 AC3/AC7 — un JOUEUR ne voit AUCUN nom : le serveur ne lui en sert pas', async () => {
    const fixture = await createRail(detailWith([groupEntry(null)]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.grp__m')).toBeNull();
    expect(el.textContent).not.toContain('Alice');
    // Il voit la même donnée, sous la forme anonyme : la jauge et son compteur.
    expect(el.querySelector('app-group-gauge')).not.toBeNull();
    expect(el.querySelector('.cnt')!.textContent!.trim()).toBe('1 / 3');
  });

  it('AC7 — le rail NOMME même au-delà de six membres : c’est la lecture longue', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      userId: `u${i}`,
      pseudo: `p${i}`,
      displayName: `Membre ${i}`,
      status: 'AVAILABLE' as const,
    }));
    const fixture = await createRail(detailWith([groupEntry(many)]));

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.grp__m')).toHaveLength(8);
  });

  it('🚨 AC2 — la lecture longue s’AJOUTE à la valeur du créneau, elle ne la remplace pas', async () => {
    const fixture = await createRail(detailWith([SEANCE, groupEntry(MEMBERS)]));
    const el = fixture.nativeElement as HTMLElement;

    const evening = [...el.querySelectorAll('.it')][2];
    // Le rail continue de dire la séance (AC11 de la 36.1)…
    expect(evening.textContent).toContain('Le Convoi du Nord');
    // …ET où en est le groupe.
    expect(evening.querySelector('.grp')).not.toBeNull();
  });

  it('AC7 — le canal n’est PAS un bouton : le groupe n’ouvre rien', async () => {
    const fixture = await createRail(detailWith([groupEntry(MEMBERS)]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.grp')!.tagName).not.toBe('BUTTON');
    expect(el.querySelector('.grp button')).toBeNull();
    expect(el.querySelector('.grp')!.getAttribute('tabindex')).toBeNull();
  });

  it('AC15 — le conteneur porte un nom accessible complet, ses enfants sont aria-hidden', async () => {
    const fixture = await createRail(detailWith([groupEntry(MEMBERS)]));
    const grp = (fixture.nativeElement as HTMLElement).querySelector('.grp')!;

    expect(grp.getAttribute('role')).toBe('img');
    const label = grp.getAttribute('aria-label')!;
    expect(label).toContain('1 sur 3 disponible');
    expect(label).toContain('Le MJ disponible');
    expect(grp.querySelector('.grp__m')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('AC10 — couche éteinte : aucune lecture longue du groupe', async () => {
    const fixture = await createRail(
      detailWith(
        [groupEntry(MEMBERS)],
        ALL_LAYERS.filter((k) => k !== 'disponibilite-groupe'),
      ),
    );

    expect((fixture.nativeElement as HTMLElement).querySelector('.grp')).toBeNull();
  });
});

describe('CalendarDetailRail — une plage jour par jour (Story 47.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const WEEKEND: AgendaEntry = {
    ...SEANCE,
    key: 'seance-w',
    date: '2026-11-06',
    slot: 'EVENING',
    endDate: '2026-11-08',
    endSlot: 'AFTERNOON',
    label: 'Week-end jeux',
  };

  it('le premier jour écrit la plage, sans « (suite) »', async () => {
    const detail = buildDayDetail('2026-11-06', [WEEKEND], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ven. 6 nov. soir → dim. 8 nov. après-midi');
    expect(text).not.toContain('(suite)');
  });

  it('les jours suivants écrivent « (suite) » et la plage, sur chaque créneau couvert', async () => {
    const detail = buildDayDetail('2026-11-07', [WEEKEND], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);
    const lines = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.m--span'));
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line.textContent).toContain('(suite)');
      expect(line.textContent).toContain('ven. 6 nov. soir → dim. 8 nov. après-midi');
    }
  });

  it('la ligne activable annonce la plage entière', async () => {
    const detail = buildDayDetail('2026-11-07', [WEEKEND], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);
    const button = (fixture.nativeElement as HTMLElement).querySelector('button.v--action');
    expect(button?.getAttribute('aria-label')).toContain(
      'du vendredi 6 soir au dimanche 8 après-midi',
    );
  });

  it('un créneau seul : aucune ligne de plage', async () => {
    const detail = buildDayDetail('2026-08-20', [SEANCE], ALL_LAYERS, [], NOW);
    const fixture = await createRail(detail);
    expect((fixture.nativeElement as HTMLElement).querySelector('.m--span')).toBeNull();
  });
});
