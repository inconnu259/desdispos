import { afterEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { RailTarget } from '../day-detail.utils';
import type { VoteOptionActivatedEvent } from '../poll-track.utils';
import {
  CalendarAgendaView,
  type AgendaEntry,
  type AgendaSealRequest,
} from './calendar-agenda-view';
import { TONE_MAP } from '../../../core/theme/tones';
import { fillTone } from '../../../core/theme/tone-format';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

/** Toutes les dates des fixtures sont relatives à ce jour, injecté — aucun `new Date()` réel
 *  n'entre dans ces tests (piège n°14 de la story). */
const TODAY = '2026-08-22';

async function createAgenda(entries: AgendaEntry[], loading = false, todayKey = TODAY) {
  await TestBed.configureTestingModule({ imports: [CalendarAgendaView] }).compileComponents();
  const fixture = TestBed.createComponent(CalendarAgendaView);
  fixture.componentRef.setInput('entries', entries);
  fixture.componentRef.setInput('loading', loading);
  fixture.componentRef.setInput('todayKey', todayKey);
  fixture.detectChanges();
  return fixture;
}

function sectionTitles(fixture: { nativeElement: HTMLElement }): string[] {
  return [...fixture.nativeElement.querySelectorAll('.agenda-section__title')].map((n) =>
    (n.textContent ?? '').trim(),
  );
}

function entryTitles(fixture: { nativeElement: HTMLElement }): string[] {
  return [...fixture.nativeElement.querySelectorAll('.agenda-entry__title')].map((n) =>
    (n.textContent ?? '').trim(),
  );
}

function badges(fixture: { nativeElement: HTMLElement }): string[] {
  return [...fixture.nativeElement.querySelectorAll('.agenda-badge')].map((n) =>
    (n.textContent ?? '').trim(),
  );
}

/** Story 36.12 — déplie la n-ième ligne de vote. Un vote non mûr est compact par défaut : sans ce
 *  geste, ses options ne sont pas dans le DOM (AC2/AC8). */
function expand(fixture: { nativeElement: HTMLElement; detectChanges: () => void }, index = 0) {
  const lines =
    fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.agenda-entry__disclose');
  lines[index].click();
  fixture.detectChanges();
}

/** Les créneaux rendus sous une ligne de vote, dans l'ordre du DOM (donc de la faveur). */
function optionLabels(fixture: { nativeElement: HTMLElement }): string[] {
  return [...fixture.nativeElement.querySelectorAll('.agenda-option__date')].map((n) =>
    (n.textContent ?? '').trim(),
  );
}

const SEANCE: AgendaEntry = {
  key: 'seance-1',
  type: 'mes-seances',
  date: '2026-09-05',
  label: 'Le Convoi du Nord',
  slot: 'EVENING',
  partieId: 'p1',
  scenarioId: 's1',
  seanceId: 'se1',
  compteRenduManquant: false,
};

const VOTE: AgendaEntry = {
  key: 'poll-1',
  type: 'votes-en-cours',
  date: '2026-08-28',
  label: 'Les Cendres d’Ashal',
  slot: 'EVENING',
  detail: 'Soir',
  vote: {
    partieId: 'p1',
    pollId: 'poll1',
    optionId: 'o1',
    yes: 2,
    maybe: 0,
    no: 0,
    total: 4,
    myAnswer: null,
  },
};

const INSCRIPTION: AgendaEntry = {
  key: 'inscription-1',
  type: 'inscriptions-ouvertes',
  date: '',
  label: 'La Halte du Griffon',
  detail: '3/5 inscrits',
  jeSuisInscrit: false,
};

const PASSEE: AgendaEntry = {
  ...SEANCE,
  key: 'seance-old',
  date: '2026-08-01',
  compteRenduManquant: true,
};

describe('CalendarAgendaView — les trois sections (AC1, AC10)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC1 : trois sections, dans l’ordre contractuel', async () => {
    const fixture = await createAgenda([SEANCE, VOTE, INSCRIPTION, PASSEE]);
    expect(sectionTitles(fixture)).toEqual([
      GRIMOIRE_TONE['dashboard.section_awaiting'],
      'Ce qui est annoncé',
      'Ce qui est révolu',
    ]);
  });

  it('AC1 : 🚨 AUCUN jour ne figure en en-tête — les en-têtes sont les trois titres, rien d’autre', async () => {
    const fixture = await createAgenda([SEANCE, VOTE, INSCRIPTION, PASSEE]);
    const headings = [...fixture.nativeElement.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((n) =>
      (n.textContent ?? '').trim(),
    );
    expect(headings).toHaveLength(3);
    for (const h of headings) {
      expect(h).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(h).not.toMatch(/septembre|août|samedi|vendredi/i);
    }
  });

  it('AC10 : une section sans entrée n’est pas rendue du tout', async () => {
    const fixture = await createAgenda([VOTE]);
    expect(sectionTitles(fixture)).toEqual([GRIMOIRE_TONE['dashboard.section_awaiting']]);
    expect(fixture.nativeElement.querySelectorAll('.agenda-section')).toHaveLength(1);
  });

  it('AC10 : rien à afficher → un message unique, aucune section', async () => {
    const fixture = await createAgenda([]);
    expect(fixture.nativeElement.querySelector('.agenda-view__empty').textContent).toContain(
      GRIMOIRE_TONE['calendar.agenda.empty'],
    );
    expect(fixture.nativeElement.querySelectorAll('.agenda-section')).toHaveLength(0);
  });

  it('AC10 : pendant le chargement, le spinner et JAMAIS le message de vide', async () => {
    const fixture = await createAgenda([], true);
    expect(fixture.nativeElement.querySelector('mat-progress-spinner')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.agenda-view__empty')).toBeNull();
  });

  it('encadré n°4 : les trois couches de disponibilité ne produisent aucune ligne', async () => {
    const fixture = await createAgenda([
      { key: 'd1', type: 'mes-disponibilites', date: TODAY, label: 'Ponctuel' },
      { key: 'd2', type: 'mes-indisponibilites', date: TODAY, label: 'Récurrent' },
      { key: 'g1', type: 'disponibilite-groupe', date: TODAY, label: 'Soir — 2/4 disponibles' },
    ]);
    expect(fixture.nativeElement.querySelectorAll('.agenda-entry')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.agenda-view__empty')).toBeTruthy();
  });

  it('🚨 une séance passée sans `compteRenduManquant` (calendrier personnel) reste hors agenda', async () => {
    const personnelle: AgendaEntry = { ...SEANCE, key: 'p', date: '2026-08-01' };
    delete personnelle.compteRenduManquant;
    const fixture = await createAgenda([personnelle]);
    expect(fixture.nativeElement.querySelectorAll('.agenda-entry')).toHaveLength(0);
  });
});

describe('CalendarAgendaView — la date est une propriété de la ligne (AC2, AC3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC2 : la date et le créneau sont rendus SUR la ligne, en clair', async () => {
    const fixture = await createAgenda([SEANCE]);
    const meta = fixture.nativeElement.querySelector('.agenda-entry__meta').textContent;
    expect(meta).toContain('samedi 5 septembre');
    expect(meta).toContain('soir');
  });

  it('AC2 : le code brut du créneau ne fuit jamais à l’écran', async () => {
    const fixture = await createAgenda([SEANCE, VOTE]);
    expect(fixture.nativeElement.textContent).not.toContain('EVENING');
  });

  it('AC2 : les informations pratiques suivent la date, sans écraser le reste', async () => {
    const fixture = await createAgenda([
      { ...SEANCE, seanceHeure: '20:30', seanceLieu: 'chez Marc', seanceNote: 'pensez aux dés' },
    ]);
    const meta = fixture.nativeElement.querySelector('.agenda-entry__meta').textContent;
    expect(meta).toContain('20:30 · chez Marc · pensez aux dés');
    expect(meta).toContain('samedi 5 septembre');
  });

  it('AC3 : une inscription sans date figure dans « Ça t’attend » et le dit', async () => {
    const fixture = await createAgenda([INSCRIPTION]);
    expect(sectionTitles(fixture)).toEqual([GRIMOIRE_TONE['dashboard.section_awaiting']]);
    const meta = fixture.nativeElement.querySelector('.agenda-entry__meta').textContent;
    expect(meta).toContain('3/5 inscrits');
    expect(meta).toContain(GRIMOIRE_TONE['calendar.agenda.no_date']);
  });

  it('AC3 : une entrée sans date ne rend aucun séparateur orphelin', async () => {
    const fixture = await createAgenda([INSCRIPTION]);
    const meta = fixture.nativeElement.querySelector('.agenda-entry__meta').textContent.trim();
    expect(meta.startsWith('·')).toBe(false);
    expect(meta.endsWith('·')).toBe(false);
  });
});

describe('CalendarAgendaView — badges dépendants du lecteur (AC4, AC8, AC11)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC4 : sans ma réponse le vote appelle une action…', async () => {
    const fixture = await createAgenda([VOTE]);
    expect(badges(fixture)).toEqual(['Réponds au vote']);
  });

  it('AC4 : …et le MÊME vote change de libellé une fois répondu, sans disparaître', async () => {
    const fixture = await createAgenda([{ ...VOTE, vote: { ...VOTE.vote!, myAnswer: 'YES' } }]);
    expect(entryTitles(fixture)).toEqual(['Les Cendres d’Ashal']);
    expect(badges(fixture)).toEqual(['Vote en cours']);
  });

  it('AC8 : une inscription dit s’il reste quelque chose à faire', async () => {
    const libre = await createAgenda([INSCRIPTION]);
    expect(badges(libre)).toEqual(['S’inscrire']);
    TestBed.resetTestingModule();
    const prise = await createAgenda([{ ...INSCRIPTION, jeSuisInscrit: true }]);
    expect(badges(prise)).toEqual(['Inscrit']);
  });

  it('AC8 : une séance passée sans compte-rendu appelle le débrief', async () => {
    const fixture = await createAgenda([PASSEE]);
    expect(badges(fixture)).toEqual(['Débriefer']);
  });

  it('AC11 : trois intensités, une seule teinte — jamais une cinquième couleur', async () => {
    const fixture = await createAgenda([
      { ...SEANCE, key: 'loin', date: '2026-09-12' },
      { ...SEANCE, key: 'proche', date: '2026-08-26' },
      { ...SEANCE, key: 'imminent', date: '2026-08-23' },
    ]);
    const classes = [...fixture.nativeElement.querySelectorAll('.agenda-badge')].map(
      (n: Element) => n.className,
    );
    // Ordre du DOM = ordre de la section, donc par date croissante : imminent, proche, lointain.
    expect(classes.every((c) => c.includes('agenda-badge--soon'))).toBe(true);
    expect(classes[0]).toContain('agenda-badge--imminent');
    expect(classes[1]).toContain('agenda-badge--near');
    expect(classes[2]).toContain('agenda-badge--far');
  });

  it('AC11 : le dernier palier parle humain — « demain soir », jamais « J-1 »', async () => {
    const fixture = await createAgenda([{ ...SEANCE, date: '2026-08-23' }]);
    expect(badges(fixture)).toEqual(['demain soir']);
  });

  it('AC8 : aucune ligne ne porte la couleur seule — chaque badge a un libellé non vide', async () => {
    const fixture = await createAgenda([SEANCE, VOTE, INSCRIPTION, PASSEE]);
    const labels = badges(fixture);
    expect(labels).toHaveLength(4);
    expect(labels.every((l) => l.length > 0)).toBe(true);
  });
});

describe('CalendarAgendaView — ordre à l’intérieur des sections', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('« Ça t’attend » : ce qui réclame une action d’abord, puis par date, sans date en dernier', async () => {
    // ⚠️ Story 36.12 — deux `pollId` DISTINCTS : deux options du même vote fusionneraient
    // désormais en une seule ligne, et le test ne mesurerait plus un ordre.
    const fixture = await createAgenda([
      {
        ...VOTE,
        key: 'repondu',
        label: 'B répondu',
        vote: { ...VOTE.vote!, pollId: 'pollB', myAnswer: 'YES' },
      },
      INSCRIPTION,
      {
        ...VOTE,
        key: 'attente',
        label: 'A en attente',
        date: '2026-08-30',
        vote: { ...VOTE.vote!, pollId: 'pollA' },
      },
    ]);
    expect(entryTitles(fixture)).toEqual(['A en attente', 'La Halte du Griffon', 'B répondu']);
  });

  it('« Ce qui est annoncé » : par date croissante', async () => {
    const fixture = await createAgenda([
      { ...SEANCE, key: 'tard', label: 'Tard', date: '2026-10-01' },
      { ...SEANCE, key: 'tot', label: 'Tôt', date: '2026-09-01' },
    ]);
    expect(entryTitles(fixture)).toEqual(['Tôt', 'Tard']);
  });

  it('« Ce qui est révolu » : du plus récent au plus ancien', async () => {
    const fixture = await createAgenda([
      { ...PASSEE, key: 'vieux', label: 'Vieux', date: '2026-06-01' },
      { ...PASSEE, key: 'hier', label: 'Hier', date: '2026-08-21' },
    ]);
    expect(entryTitles(fixture)).toEqual(['Hier', 'Vieux']);
  });
});

describe('CalendarAgendaView — activer une ligne (AC5, AC12)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC5 : une ligne portant une séance est un bouton qui ouvre LE SCÉNARIO', async () => {
    const fixture = await createAgenda([SEANCE]);
    const emitted: RailTarget[] = [];
    fixture.componentInstance.scenarioActivated.subscribe((t: RailTarget) => emitted.push(t));

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.agenda-entry__open');
    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-label')).toContain(
      fillTone(GRIMOIRE_TONE['common.ouvrir_le_scenario_label'], { label: 'Le Convoi du Nord' }),
    );
    expect(button.getAttribute('aria-label')).not.toContain('séance');

    button.click();
    expect(emitted).toEqual([{ partieId: 'p1', scenarioId: 's1' }]);
  });

  it('AC12 : sans scénario identifiable, la ligne n’est PAS un bouton (pas de bouton désactivé)', async () => {
    const fixture = await createAgenda([INSCRIPTION]);
    expect(fixture.nativeElement.querySelector('.agenda-entry__open')).toBeNull();
    expect(fixture.nativeElement.querySelector('.agenda-entry__static')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('button[disabled]')).toBeNull();
  });

  it('AC12 : 🚨 une ligne de vote ne NAVIGUE jamais — et aucun bouton n’en contient un autre', async () => {
    const fixture = await createAgenda([{ ...VOTE, partieId: 'p1', scenarioId: 's1' }]);
    const emitted: RailTarget[] = [];
    fixture.componentInstance.scenarioActivated.subscribe((t: RailTarget) => emitted.push(t));

    // ⚠️ Story 36.12 — la ligne d'un vote EST un bouton, mais il déplie ; il n'ouvre rien.
    const line: HTMLButtonElement = fixture.nativeElement.querySelector('.agenda-entry__disclose');
    expect(line).toBeTruthy();
    line.click();
    expect(emitted).toHaveLength(0);

    // La garde structurelle qui compte : aucun bouton n'est imbriqué dans un autre.
    for (const button of fixture.nativeElement.querySelectorAll('button')) {
      expect(button.querySelector('button')).toBeNull();
    }
  });
});

describe('CalendarAgendaView — le sélecteur de réponse survit à la refonte (AC13)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('une option dépliée porte sa piste et reste activable, avec son ancre', async () => {
    // ⚠️ Story 36.12 — la piste vit désormais sur l'OPTION, pas sur la ligne : on déplie d'abord.
    const fixture = await createAgenda([VOTE]);
    const emitted: VoteOptionActivatedEvent[] = [];
    fixture.componentInstance.voteOptionActivated.subscribe((e: VoteOptionActivatedEvent) =>
      emitted.push(e),
    );
    expand(fixture);

    expect(fixture.nativeElement.querySelector('app-poll-track')).toBeTruthy();
    const action: HTMLButtonElement = fixture.nativeElement.querySelector('.agenda-option__answer');
    expect(action.getAttribute('aria-label')).toContain(
      GRIMOIRE_TONE['common.repondre_au_vote_label'].split(' — ')[0],
    );
    expect(action.getAttribute('aria-haspopup')).toBe('menu');

    action.click();
    expect(emitted).toHaveLength(1);
    expect(emitted[0].vote.optionId).toBe('o1');
    expect(emitted[0].slot).toBe('EVENING');
    expect(emitted[0].anchor).toBe(action);
  });

  it('une séance ne porte jamais de piste de participation', async () => {
    const fixture = await createAgenda([SEANCE]);
    expect(fixture.nativeElement.querySelector('app-poll-track')).toBeNull();
  });
});

// ─── Story 36.12 — l'Agenda du MJ ───────────────────────────────────────────

/** Trois options d'un MÊME vote. `yes` par défaut à zéro : le vote n'est donc pas mûr, sauf si un
 *  test le décide. */
function options(...yes: number[]): AgendaEntry[] {
  const dates = ['2026-08-28', '2026-08-29', '2026-08-30'];
  return yes.map((y, i) => ({
    ...VOTE,
    key: `poll1-o${i}`,
    date: dates[i],
    vote: { ...VOTE.vote!, optionId: `o${i}`, yes: y },
  }));
}

async function createMjAgenda(
  entries: AgendaEntry[],
  missingByPoll: Record<string, string[]> = {},
) {
  await TestBed.configureTestingModule({ imports: [CalendarAgendaView] }).compileComponents();
  const fixture = TestBed.createComponent(CalendarAgendaView);
  fixture.componentRef.setInput('entries', entries);
  fixture.componentRef.setInput('todayKey', TODAY);
  fixture.componentRef.setInput('canSeal', true);
  fixture.componentRef.setInput('missingByPoll', missingByPoll);
  fixture.detectChanges();
  return fixture;
}

describe('CalendarAgendaView — une ligne = un vote (AC7)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('🚨 trois options d’un même vote ne font QU’UNE ligne', async () => {
    const fixture = await createAgenda(options(0, 0, 0));
    expect(entryTitles(fixture)).toEqual(['Les Cendres d’Ashal']);
    expect(fixture.nativeElement.querySelectorAll('.agenda-entry')).toHaveLength(1);
  });

  it('deux votes distincts font deux lignes', async () => {
    const [a] = options(0);
    const b: AgendaEntry = {
      ...VOTE,
      key: 'autre',
      label: 'Le Convoi du Nord',
      vote: { ...VOTE.vote!, pollId: 'poll2', optionId: 'x' },
    };
    const fixture = await createAgenda([a, b]);
    expect(entryTitles(fixture)).toHaveLength(2);
  });

  it('une option privée d’agrégats (API dégradée) garde sa ligne, elle n’est jamais perdue', async () => {
    const fixture = await createAgenda([{ ...VOTE, key: 'orphelin', vote: undefined }]);
    expect(entryTitles(fixture)).toEqual(['Les Cendres d’Ashal']);
  });
});

describe('CalendarAgendaView — le dépliement (AC1, AC2, AC8)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC2 : un vote NON mûr est compact — aucune option dans le DOM', async () => {
    const fixture = await createAgenda(options(1, 0, 0));
    expect(optionLabels(fixture)).toEqual([]);
    expect(
      fixture.nativeElement.querySelector('.agenda-entry__disclose').getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('AC1 : un vote mûr est déplié D’OFFICE, sans aucun geste', async () => {
    // 3 oui sur 4 : majorité absolue, critère B de Q-25.
    const fixture = await createAgenda(options(3, 0, 0));
    expect(optionLabels(fixture)).toHaveLength(3);
    expect(
      fixture.nativeElement.querySelector('.agenda-entry__disclose').getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('AC8 : 🚨 activer une ligne NON mûre la déplie — c’est le seul chemin de réponse', async () => {
    const fixture = await createAgenda(options(1, 0, 0));
    expand(fixture);
    expect(optionLabels(fixture)).toHaveLength(3);
    expect(
      fixture.nativeElement.querySelector('.agenda-entry__disclose').getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('AC8 : une seconde activation replie', async () => {
    const fixture = await createAgenda(options(1, 0, 0));
    expand(fixture);
    expand(fixture);
    expect(optionLabels(fixture)).toEqual([]);
  });

  it('AC8 : un vote MÛR peut être replié à la main', async () => {
    const fixture = await createAgenda(options(3, 0, 0));
    expand(fixture);
    expect(optionLabels(fixture)).toEqual([]);
  });
});

describe('CalendarAgendaView — les options dépliées (AC3, AC4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC4 : les options sont triées par faveur, le favori en tête', async () => {
    const fixture = await createAgenda(options(0, 3, 1));
    // Le créneau fait partie du libellé d'une option — contrairement au résumé de la méta, qui
    // n'énumère que des dates : ici c'est la cible d'un scellement, elle doit être sans ambiguïté.
    expect(optionLabels(fixture)).toEqual([
      'sam. 29 août, soir',
      'dim. 30 août, soir',
      'ven. 28 août, soir',
    ]);
    expect(
      fixture.nativeElement.querySelector('.agenda-option--fav .agenda-option__date').textContent,
    ).toContain('29 août');
  });

  it('AC3 : chaque option porte sa piste et son compteur', async () => {
    const fixture = await createAgenda(options(3, 1, 0));
    expect(fixture.nativeElement.querySelectorAll('app-poll-track')).toHaveLength(3);
    // 🚨 Le compteur est émis par `<app-poll-track>` lui-même (36.6) : la surface ne le redouble
    // pas. Le redoubler l'affichait deux fois par option — défaut trouvé à l'écran.
    expect(
      [...fixture.nativeElement.querySelectorAll('app-poll-track .cnt')].map((n) =>
        (n.textContent ?? '').trim(),
      ),
    ).toEqual(['3 / 4', '1 / 4', '0 / 4']);
  });

  it('AC4 : 🚨 TOUTES les options sont scellables, pas seulement le favori', async () => {
    const fixture = await createMjAgenda(options(3, 1, 0));
    expect(fixture.nativeElement.querySelectorAll('.agenda-option__seal')).toHaveLength(3);
  });

  it('AC6 : ma réponse est rendue en toutes lettres sur l’option', async () => {
    const entries = options(1, 0, 0);
    entries[0] = { ...entries[0], vote: { ...entries[0].vote!, myAnswer: 'YES' } };
    const fixture = await createAgenda(entries);
    expand(fixture);
    // Émise par `<app-poll-track>`, qui produit les DEUX formulations — la surface n'en
    // reformule aucune (36.6).
    expect(fixture.nativeElement.querySelector('app-poll-track .mine').textContent.trim()).toBe(
      fillTone(GRIMOIRE_TONE['calendar.util_answer_mine'], {
        answer: GRIMOIRE_TONE['calendar.util_answer_yes'],
      }),
    );
  });
});

describe('CalendarAgendaView — sceller (AC3, AC10, AC12)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC10 : le bouton émet le triplet d’identité de l’option, et son libellé', async () => {
    const fixture = await createMjAgenda(options(3, 0, 0));
    const emitted: AgendaSealRequest[] = [];
    fixture.componentInstance.sealRequested.subscribe((r: AgendaSealRequest) => emitted.push(r));

    fixture.nativeElement.querySelector('.agenda-option__seal').click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      partieId: 'p1',
      pollId: 'poll1',
      optionId: 'o0',
      pollLabel: 'Les Cendres d’Ashal',
    });
    expect(emitted[0].dateLabel).toContain('28 août');
  });

  it('AC6/AC12 : 🚨 sans pouvoir de scellement, AUCUN bouton — ni actif ni désactivé', async () => {
    const fixture = await createAgenda(options(3, 0, 0));
    expect(fixture.nativeElement.querySelectorAll('.agenda-option__seal')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('button[disabled]')).toBeNull();
    // AC6 — la structure de ligne, elle, est la MÊME : les options restent dépliées et lisibles.
    expect(optionLabels(fixture)).toHaveLength(3);
  });
});

describe('CalendarAgendaView — le badge d’une ligne de vote (AC15)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('MJ + vote mûr → « À sceller »', async () => {
    const fixture = await createMjAgenda(options(3, 0, 0));
    expect(badges(fixture)).toEqual(['À sceller']);
  });

  it('MJ + vote NON mûr → « Réponds au vote »', async () => {
    const fixture = await createMjAgenda(options(1, 0, 0));
    expect(badges(fixture)).toEqual(['Réponds au vote']);
  });

  it('joueur + vote mûr → « Réponds au vote », jamais « À sceller »', async () => {
    const fixture = await createAgenda(options(3, 0, 0));
    expect(badges(fixture)).toEqual(['Réponds au vote']);
  });

  it('🚨 avoir répondu à UNE option sur trois ne suffit pas : le vote reste en attente', async () => {
    const entries = options(1, 0, 0);
    entries[0] = { ...entries[0], vote: { ...entries[0].vote!, myAnswer: 'YES' } };
    const fixture = await createAgenda(entries);
    expect(badges(fixture)).toEqual(['Réponds au vote']);
  });

  it('avoir répondu partout → « Vote en cours »', async () => {
    const fixture = await createAgenda(
      options(1, 0, 0).map((e) => ({ ...e, vote: { ...e.vote!, myAnswer: 'YES' as const } })),
    );
    expect(badges(fixture)).toEqual(['Vote en cours']);
  });
});

describe('CalendarAgendaView — la méta d’une ligne de vote (AC14)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function meta(fixture: { nativeElement: HTMLElement }): string {
    return (fixture.nativeElement.querySelector('.agenda-entry__meta')?.textContent ?? '').trim();
  }

  it('deux créneaux sont énumérés', async () => {
    const fixture = await createAgenda(options(0, 0));
    expect(meta(fixture)).toContain('ven. 28 août, soir ou sam. 29 août, soir');
  });

  // Revue de code (36.12) — deux options même jour, créneaux différents : sans le créneau dans le
  // résumé, elles étaient rendues indiscernables (« ven. 28 août ou ven. 28 août »).
  it('deux options DU MÊME JOUR à des créneaux différents ne sont pas indiscernables', async () => {
    const [morning, evening] = options(0, 0);
    const fixture = await createAgenda([
      { ...morning, date: '2026-08-28', slot: 'MORNING' },
      { ...evening, date: '2026-08-28', slot: 'EVENING' },
    ]);
    expect(meta(fixture)).toContain('ven. 28 août, matin ou ven. 28 août, soir');
  });

  it('au-delà de deux, ils sont résumés', async () => {
    const fixture = await createAgenda(options(0, 0, 0));
    expect(meta(fixture)).toContain(
      fillTone(GRIMOIRE_TONE['calendar.agenda.slots_proposed'], { n: 3 }),
    );
  });

  it('le compteur est celui du VOTE — le minimum sur les options, jamais la somme', async () => {
    const fixture = await createAgenda(options(3, 1, 0));
    expect(meta(fixture)).toContain(
      fillTone(GRIMOIRE_TONE['calendar.agenda.responded_count'], { n: 0, total: 4 }),
    );
  });

  it('🚨 aucune piste au niveau du vote : une piste agrégée affirmerait un avis inexistant', async () => {
    const fixture = await createAgenda(options(3, 1, 0));
    expect(fixture.nativeElement.querySelector('.agenda-entry__row app-poll-track')).toBeNull();
  });

  it('côté MJ, la méta nomme qui manque', async () => {
    const fixture = await createMjAgenda(options(1, 0, 0), { poll1: ['Léa', 'Tom'] });
    expect(meta(fixture)).toContain(
      fillTone(GRIMOIRE_TONE['calendar.agenda.missing_voters'], { names: 'Léa, Tom' }),
    );
  });

  it('au-delà de trois manquants, elle en nomme trois et compte le reste', async () => {
    const fixture = await createMjAgenda(options(1, 0, 0), {
      poll1: ['Léa', 'Tom', 'Zoé', 'Ana', 'Bo'],
    });
    expect(meta(fixture)).toContain('Léa, Tom, Zoé et 2 autres');
  });

  it('côté joueur, elle ne nomme personne — aucune identité ne transite', async () => {
    const fixture = await createAgenda(options(1, 0, 0));
    expect(meta(fixture)).not.toContain('il manque');
  });
});

describe('CalendarAgendaView — la séance sans date proposée (AC5, AC13)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const SANS_DATE: AgendaEntry = {
    key: 'sans-date-1',
    type: 'seances-sans-date',
    date: '',
    label: 'Le Convoi du Nord — Séance 4',
    partieId: 'p1',
    scenarioId: 's1',
    seanceId: 'se4',
  };

  it('AC5 : la ligne dit ce qui manque et propose de lancer un vote', async () => {
    const fixture = await createMjAgenda([SANS_DATE]);
    expect(entryTitles(fixture)).toEqual(['Le Convoi du Nord — Séance 4']);
    expect(fixture.nativeElement.querySelector('.agenda-entry__meta').textContent).toContain(
      GRIMOIRE_TONE['calendar.agenda.no_date_proposed'],
    );
    expect(fixture.nativeElement.querySelector('.agenda-entry__launch').textContent.trim()).toBe(
      GRIMOIRE_TONE['calendar.agenda.action_launch_poll'],
    );
  });

  it('AC13 : le bouton émet le seanceId', async () => {
    const fixture = await createMjAgenda([SANS_DATE]);
    const emitted: string[] = [];
    fixture.componentInstance.pollLaunchRequested.subscribe((id: string) => emitted.push(id));
    fixture.nativeElement.querySelector('.agenda-entry__launch').click();
    expect(emitted).toEqual(['se4']);
  });

  it('🚨 elle porte une ACTION, pas un badge d’état — et elle ne navigue pas', async () => {
    const fixture = await createMjAgenda([SANS_DATE]);
    expect(badges(fixture)).toEqual([]);
    expect(fixture.nativeElement.querySelector('.agenda-entry__open')).toBeNull();
  });

  it('elle se range en fin de « Ça t’attend », comme toute ligne sans date', async () => {
    const fixture = await createMjAgenda([SANS_DATE, ...options(1, 0, 0)]);
    expect(entryTitles(fixture)).toEqual(['Les Cendres d’Ashal', 'Le Convoi du Nord — Séance 4']);
  });
});

describe('CalendarAgendaView — une plage tient en UNE ligne (Story 47.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const WEEKEND: AgendaEntry = {
    key: 'seance-w',
    type: 'mes-seances',
    date: '2026-09-04',
    slot: 'EVENING',
    endDate: '2026-09-06',
    endSlot: 'AFTERNOON',
    label: 'Week-end jeux',
    partieId: 'p1',
    scenarioId: 'sc1',
    seanceId: 'w',
  };

  it('une seule ligne « début → fin », dans la section de son début', async () => {
    const fixture = await createAgenda([WEEKEND]);
    expect(entryTitles(fixture)).toEqual(['Week-end jeux']);
    const meta = fixture.nativeElement.querySelector('.agenda-entry__meta').textContent;
    expect(meta).toContain('ven. 4 sept. soir → dim. 6 sept. après-midi');
  });

  it('commencée mais pas finie : encore « à venir » ; finie : elle quitte cette section', async () => {
    const started = await createAgenda(
      [{ ...WEEKEND, date: '2026-08-21', endDate: '2026-08-23', compteRenduManquant: true }],
      false,
      TODAY,
    );
    expect(sectionTitles(started)).toEqual([GRIMOIRE_TONE['calendar.agenda.section_scheduled']]);
    TestBed.resetTestingModule();

    const ended = await createAgenda(
      [{ ...WEEKEND, date: '2026-08-19', endDate: '2026-08-21', compteRenduManquant: true }],
      false,
      TODAY,
    );
    expect(sectionTitles(ended)).not.toContain(GRIMOIRE_TONE['calendar.agenda.section_scheduled']);
  });

  it('un créneau seul : la ligne d’avant', async () => {
    const fixture = await createAgenda([{ ...WEEKEND, endDate: undefined, endSlot: undefined }]);
    const meta = fixture.nativeElement.querySelector('.agenda-entry__meta').textContent;
    expect(meta).not.toContain('→');
  });
});

describe('CalendarAgendaView — options de plusieurs créneaux, écrites de bout en bout (Story 47.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const spanned = (): AgendaEntry[] =>
    options(0, 3, 1).map((o) => ({
      ...o,
      slot: 'EVENING' as const,
      endDate: (
        { '2026-08-28': '2026-08-30', '2026-08-29': '2026-08-31', '2026-08-30': '2026-09-01' } as Record<
          string,
          string
        >
      )[o.date],
      endSlot: 'AFTERNOON' as const,
    }));

  it('chaque option dépliée dit son début et sa fin', async () => {
    const fixture = await createAgenda(spanned());
    expect(optionLabels(fixture)).toEqual([
      'sam. 29 août soir → lun. 31 août après-midi',
      'dim. 30 août soir → mar. 1 sept. après-midi',
      'ven. 28 août soir → dim. 30 août après-midi',
    ]);
  });

  it('la demande de scellement porte la plage écrite', async () => {
    const fixture = await createMjAgenda(spanned());
    const requests: { dateLabel: string; optionId: string }[] = [];
    fixture.componentInstance.sealRequested.subscribe((r: { dateLabel: string; optionId: string }) =>
      requests.push(r),
    );
    (fixture.nativeElement.querySelector('.agenda-option__seal') as HTMLButtonElement).click();

    expect(requests).toHaveLength(1);
    expect(requests[0].dateLabel).toBe('sam. 29 août soir → lun. 31 août après-midi');
  });
});
