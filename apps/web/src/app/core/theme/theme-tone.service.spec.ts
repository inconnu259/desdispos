import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ThemeToneService } from './theme-tone.service';
import { THEME_NAMES, THEMES, TONE_MAP, type Theme } from './tones';
import { NON_JDR_BANNED_WORDS } from './non-jdr-words.fixture';

describe('ThemeToneService', () => {
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it("AC3 (Story 28.4) : le thème connu localement s'applique dès la construction, indépendamment de toute authentification", () => {
    // Simule l'état « pas encore connecté » : localStorage porte le dernier thème connu, aucune
    // session/AuthService n'entre en jeu — reproduit fidèlement app.ts (ThemeToneService injecté
    // hors de toute dépendance à l'auth, cf. Dev Notes de la story).
    localStorage.setItem('jdr-theme', 'foret-ancienne');

    const service = TestBed.inject(ThemeToneService);

    expect(service.activeTheme()).toBe('foret-ancienne');
    expect(document.body.classList.contains('theme-foret-ancienne')).toBe(true);
  });

  it('valeur localStorage invalide/inexistante → repli sur le thème par défaut, sans plantage', () => {
    localStorage.setItem('jdr-theme', 'theme-disparu');

    const service = TestBed.inject(ThemeToneService);

    expect(service.activeTheme()).toBe('grimoire-emeraude');
  });

  it('aucune valeur en localStorage → thème par défaut', () => {
    const service = TestBed.inject(ThemeToneService);

    expect(service.activeTheme()).toBe('grimoire-emeraude');
  });

  it("Story 35.1 : un cache d'avant le renommage (`medieval-steampunk`) est lu comme `atelier-cuivre`", () => {
    localStorage.setItem('jdr-theme', 'medieval-steampunk');

    const service = TestBed.inject(ThemeToneService);

    expect(service.activeTheme()).toBe('atelier-cuivre');
    expect(document.body.classList.contains('theme-atelier-cuivre')).toBe(true);
    expect(document.body.classList.contains('theme-medieval-steampunk')).toBe(false);
  });

  it("Story 35.1 : une clé héritée du prototype (`constructor`) n'est pas prise pour un alias", () => {
    localStorage.setItem('jdr-theme', 'constructor');

    const service = TestBed.inject(ThemeToneService);

    expect(service.activeTheme()).toBe('grimoire-emeraude');
  });
});

// Story 35.1 — registre découpé en un fichier par thème.
describe('Tones — registre découpé par thème (Story 35.1)', () => {
  it('Atelier Cuivré est le nom affiché du thème `atelier-cuivre`', () => {
    expect(THEME_NAMES['atelier-cuivre']).toBe('Atelier Cuivré');
    expect(THEMES).toContain('atelier-cuivre');
    expect(THEMES).not.toContain('medieval-steampunk' as never);
  });

  it('les trois thèmes portent exactement le même jeu de clés, valeurs non vides', () => {
    const reference = Object.keys(TONE_MAP['grimoire-emeraude']).sort();
    expect(reference.length).toBeGreaterThan(0);
    for (const theme of THEMES) {
      expect(Object.keys(TONE_MAP[theme]).sort(), theme).toEqual(reference);
      for (const [key, value] of Object.entries(TONE_MAP[theme])) {
        expect(value.length, `${theme} → ${key}`).toBeGreaterThan(0);
      }
    }
  });
});

// Story 36.11 — garde contre le piège n°12 de la 36.9 : une clé posée dans un seul thème rend
// `undefined` à l'écran dans les deux autres, et aucun test de composant ne le voit (ils tournent
// tous sur le thème par défaut).
describe('TONE_MAP — les clés de la vue Agenda existent dans les TROIS thèmes', () => {
  const AGENDA_KEYS = [
    'calendar.agenda.section_awaiting',
    'calendar.agenda.section_scheduled',
    'calendar.agenda.section_past',
    'calendar.agenda.badge_answer_poll',
    'calendar.agenda.badge_poll_open',
    'calendar.agenda.badge_signup',
    'calendar.agenda.badge_signed_up',
    'calendar.agenda.badge_debrief',
    'calendar.agenda.empty',
    // Story 36.12 — l'Agenda du MJ.
    'calendar.agenda.badge_to_seal',
    'calendar.agenda.poll_open',
    'calendar.agenda.responded_count',
    'calendar.agenda.slots_proposed',
    'calendar.agenda.missing_voters',
    'calendar.agenda.no_date',
    'calendar.agenda.no_date_proposed',
    'calendar.agenda.action_launch_poll',
    'calendar.agenda.action_seal',
    'calendar.agenda.action_expand',
    'calendar.agenda.action_collapse',
    'calendar.agenda.seal_confirm_title',
    'calendar.agenda.seal_confirm_body',
  ];

  for (const theme of THEMES) {
    it(`${theme} porte les ${AGENDA_KEYS.length} clés, toutes non vides`, () => {
      for (const key of AGENDA_KEYS) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBeTruthy();
      }
    });
  }

  // Story 36.12 — 🚨 le libellé de scellement est RÉPÉTÉ sur chaque option d'un vote déplié, et un
  // vote en porte jusqu'à quarante. Trouvé à l'écran : avec la phrase de `cta.choose_date`
  // (« Planter le drapeau de la clairière »), chaque option passait sur deux lignes et la liste
  // devenait un mur. Une future relecture éditoriale (35.3) ne doit pas pouvoir le rallonger.
  for (const theme of THEMES) {
    it(`${theme} garde un libellé de scellement COURT`, () => {
      expect(TONE_MAP[theme]['calendar.agenda.action_seal'].length).toBeLessThanOrEqual(14);
    });
  }

  // Revue de code (36.12) — même famille de bouton contraint en largeur que `action_seal`
  // (`.agenda-entry__launch`, `white-space: nowrap`), mais rendu une seule fois par ligne « sans
  // date » plutôt que répété par option : seuil plus large, aligné sur le maximum actuel (18).
  for (const theme of THEMES) {
    it(`${theme} garde un libellé de « Lancer un vote » raisonnablement COURT`, () => {
      expect(TONE_MAP[theme]['calendar.agenda.action_launch_poll'].length).toBeLessThanOrEqual(20);
    });
  }

  // Story 36.12 — une clé à trou dont le thème a « oublié » le trou rend le gabarit littéral à
  // l'écran (« {n} sur {total} ont répondu »). Le typage ne peut rien voir : ce sont des chaînes.
  const PLACEHOLDERS: Record<string, string[]> = {
    'calendar.agenda.responded_count': ['{n}', '{total}'],
    'calendar.agenda.slots_proposed': ['{n}'],
    'calendar.agenda.missing_voters': ['{names}'],
  };

  for (const theme of THEMES) {
    it(`${theme} garde les gabarits à trou de l’Agenda`, () => {
      for (const [key, tokens] of Object.entries(PLACEHOLDERS)) {
        for (const token of tokens) {
          expect(TONE_MAP[theme][key], `${theme} / ${key}`).toContain(token);
        }
      }
    });
  }
});

// Story 36.14 — la barre repliée, le panneau « Affichage », la légende et les intentions de
// compte. Même garde que ci-dessus : aucun test de composant ne tourne hors du thème par défaut,
// donc une clé oubliée dans deux thèmes sur trois ne se verrait qu'à l'écran.
describe('TONE_MAP — les clés de la story 36.14 existent dans les TROIS thèmes', () => {
  const DISPLAY_KEYS = [
    'calendar.display.trigger',
    'calendar.display.trigger_aria',
    'calendar.display.section_visible',
    'calendar.display.show_legend',
    'calendar.display.filtered_badge',
    'calendar.legend.title',
    'calendar.legend.group_obvious',
    'calendar.legend.group_needs',
    'calendar.legend.entry.available',
    'calendar.legend.entry.unavailable',
    'calendar.legend.entry.seance',
    'calendar.legend.entry.vote',
    'calendar.legend.entry.poll_track',
    'calendar.legend.entry.group',
    'calendar.legend.entry.none',
    'account.calendar_intents_subtitle',
    'account.calendar_intent.disponibilites',
    'account.calendar_intent.seances',
    'account.calendar_intent.votes',
    'account.calendar_intent.groupe',
  ];

  for (const theme of THEMES) {
    it(`${theme} porte les ${DISPLAY_KEYS.length} clés, toutes non vides`, () => {
      for (const key of DISPLAY_KEYS) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBeTruthy();
      }
    });
  }

  // 🚨 Le déclencheur PARTAGE UNE LIGNE avec la bascule de vues, la pastille de résumé et jusqu'à
  // deux chips de mode — et c'est cette ligne unique qui est toute la raison d'être de la story
  // (`deferred-work.md:66` : la barre passait à DEUX lignes dès 1400 px). Un libellé long le
  // reproduirait exactement. Même patron de garde que `calendar.agenda.action_seal`, dont la
  // story 36.12 a découvert le défaut à l'écran et pas aux tests.
  for (const theme of THEMES) {
    it(`${theme} garde un libellé d'« Affichage » COURT`, () => {
      expect(TONE_MAP[theme]['calendar.display.trigger'].length).toBeLessThanOrEqual(12);
    });
  }

  // La pastille est `white-space: nowrap` et porte déjà deux nombres : son gabarit doit rester
  // court, sinon elle pousse la bascule de vues hors de la ligne.
  for (const theme of THEMES) {
    it(`${theme} garde un gabarit de pastille COURT`, () => {
      expect(TONE_MAP[theme]['calendar.display.filtered_badge'].length).toBeLessThanOrEqual(48);
    });
  }

  // Un thème qui « oublierait » un trou rendrait le gabarit littéral (« {n} sur {total} »).
  for (const theme of THEMES) {
    it(`${theme} conserve les deux trous de la pastille de résumé`, () => {
      const value = TONE_MAP[theme]['calendar.display.filtered_badge'];
      expect(value, `${theme} / {n}`).toContain('{n}');
      expect(value, `${theme} / {total}`).toContain('{total}');
    });
  }
});

// Story 31.1 — le menu « ⋮ » de la fiche. Même garde que ci-dessus : `character.pdf_crop_edit_cta`
// manquait déjà dans `foret-ancienne` avant cette story (invisible faute de ce test), corrigé au
// passage puisque cette story déplace précisément cette clé dans le nouveau menu.
describe('TONE_MAP — les clés du menu de la fiche (story 31.1) existent dans les TROIS thèmes', () => {
  const SHEET_MENU_KEYS = [
    'character.sheet_menu_trigger_aria',
    'character.export_editable_cta',
    'character.export_2pages_cta',
    'character.export_equipment_cta',
    'character.export_notes_cta',
    'character.pdf_crop_edit_cta',
  ];

  for (const theme of THEMES) {
    it(`${theme} porte les ${SHEET_MENU_KEYS.length} clés, toutes non vides`, () => {
      for (const key of SHEET_MENU_KEYS) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBeTruthy();
      }
    });
  }
});

// Story 31.4 — micro-copie du wizard de création et de la surface de détail. `TONE_MAP` garantit
// la présence des trois thèmes, PAS celle d'une clé dans chacun : une clé oubliée compile et rend
// `undefined` à l'écran. Seul ce test de parité l'attrape.
describe('Tones — surface de détail et wizard de création (Story 31.4)', () => {
  const WIZARD_KEYS = [
    'detail.row_attributes',
    'detail.row_difficulty',
    'detail.row_effect',
    'detail.row_conditions',
    'detail.narrative_show',
    'detail.narrative_hide',
    'character.equipment_group_individual',
    'character.equipment_group_contenant',
    'character.equipment_group_animal',
    'character.equipment_search_label',
    'character.equipment_search_placeholder',
    'character.equipment_search_empty',
    'character.equipment_budget',
    'character.equipment_over_budget',
    'character.choice_deselect_hint',
    'character.choice_talents_label',
    'character.choice_advantages_label',
    'character.choice_required_flag',
    'character.choice_reference_toggle',
    'character.equipment_group_toggle',
    'character.equipment_filter_all',
    'character.equipment_filter_mine',
    'character.equipment_qty_less',
    'character.equipment_qty_more',
    'character.recap_button',
    'character.recap_title',
    'character.recap_cart_title',
    'character.recap_remove',
    'character.recap_total',
    'character.recap_empty_hint',
  ];
  const PLACEHOLDERS: Record<string, string[]> = {
    'character.equipment_budget': ['{spent}', '{total}'],
    'character.equipment_over_budget': ['{n}'],
    'character.equipment_group_toggle': ['{group}', '{n}'],
    'character.equipment_qty_less': ['{name}'],
    'character.equipment_qty_more': ['{name}'],
  };

  for (const theme of THEMES) {
    it(`${theme} porte les ${WIZARD_KEYS.length} clés, toutes non vides`, () => {
      for (const key of WIZARD_KEYS) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBeTruthy();
      }
    });

    it(`${theme} garde les gabarits à trou du wizard`, () => {
      for (const [key, tokens] of Object.entries(PLACEHOLDERS)) {
        for (const token of tokens) {
          expect(TONE_MAP[theme][key], `${theme} / ${key}`).toContain(token);
        }
      }
    });
  }
});

// Story 29.15 — l'onglet "Ma fiche" (état vide) et le slot d'initiale du roster (tooltip
// accessible) gagnent chacun une nouvelle clé thématisée. Même garde de parité que ci-dessus.
describe('Tones — bouton clair pour créer son personnage depuis la partie (Story 29.15)', () => {
  const KEYS = ['character.no_character_yet', 'roster.create_slot_label'];

  for (const theme of THEMES) {
    it(`${theme} porte les ${KEYS.length} clés, toutes non vides`, () => {
      for (const key of KEYS) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBeTruthy();
      }
    });
  }
});

// Spec fiches-personnages-partie-et-retour — libellé de l'onglet « Fiches » (renommé depuis
// « Ma fiche ») et bouton retour de la fiche vers la partie. Même garde de parité que ci-dessus :
// une clé posée dans un seul thème rendrait `undefined` à l'écran dans les deux autres.
describe('Tones — onglet « Fiches » et bouton retour (spec fiches-personnages-partie-et-retour)', () => {
  const KEYS = ['character.party_sheets_tab_label', 'character.back_to_partie_cta'];

  for (const theme of THEMES) {
    it(`${theme} porte les ${KEYS.length} clés, toutes non vides`, () => {
      for (const key of KEYS) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBeTruthy();
      }
    });
  }
});

// Story 29.16 — la section « À forger » de l'écran Personnages. Même garde de parité que
// ci-dessus : une clé posée dans un seul thème rendrait `undefined` à l'écran dans les deux
// autres, invisible à tout test de composant (ils tournent sur le thème par défaut).
describe('Tones — section de création depuis « Personnages » (Story 29.16)', () => {
  const KEYS = [
    'my_characters.create_title',
    'my_characters.create_entry',
    'my_characters.create_more',
    'my_characters.create_more_one',
    'my_characters.create_less',
    'my_characters.empty_with_entries',
  ];
  const PLACEHOLDERS: Record<string, string[]> = {
    'my_characters.create_entry': ['{partie}'],
    'my_characters.create_more': ['{n}'],
  };

  for (const theme of THEMES) {
    it(`${theme} porte les ${KEYS.length} clés, toutes non vides`, () => {
      for (const key of KEYS) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBeTruthy();
      }
    });

    it(`${theme} garde les gabarits à trou de la section de création`, () => {
      for (const [key, tokens] of Object.entries(PLACEHOLDERS)) {
        for (const token of tokens) {
          expect(TONE_MAP[theme][key], `${theme} / ${key}`).toContain(token);
        }
      }
    });
  }
});

// Story 33.5 — ligne de création de l'Homme Dragon et libellé du marqueur de nature. Même garde
// de parité que ci-dessus ; « Homme Dragon » est un nom propre du système, jamais thématisé :
// `character.nature_dragon` doit être strictement identique dans les trois thèmes.
describe('Tones — Homme Dragon dans « Personnages » (Story 33.5)', () => {
  for (const theme of THEMES) {
    it(`${theme} porte my_characters.create_entry_hd (gabarit {partie}) et character.nature_dragon`, () => {
      expect(
        TONE_MAP[theme]['my_characters.create_entry_hd'],
        `${theme} / create_entry_hd`,
      ).toBeTruthy();
      expect(TONE_MAP[theme]['my_characters.create_entry_hd']).toContain('{partie}');
      expect(TONE_MAP[theme]['my_characters.create_entry_hd']).toContain('Homme Dragon');
      expect(TONE_MAP[theme]['character.nature_dragon'], `${theme} / nature_dragon`).toBeTruthy();
    });
  }

  it('character.nature_dragon est identique dans les trois thèmes (nom propre, jamais thématisé)', () => {
    const values = THEMES.map((theme) => TONE_MAP[theme]['character.nature_dragon']);
    expect(new Set(values).size).toBe(1);
    expect(values[0]).toBe('Homme Dragon');
  });
});

// Story 31.7 — bouton MJ-only "Confidentialité" vers l'écran de configuration des cadenas.
// Même garde de parité que ci-dessus.
describe('Tones — bouton "Confidentialité" de PartieDetail (Story 31.7)', () => {
  for (const theme of THEMES) {
    it(`${theme} porte la clé partie.visibility_btn, non vide`, () => {
      expect(TONE_MAP[theme]['partie.visibility_btn']).toBeTruthy();
    });
  }
});

// Correctif de revue (session bmad-build, 2026-09-22) : message affiché sur CharacterSheet quand
// `derived` est masqué par un cadenas de visibilité (Story 31.6) — même garde de parité que ci-dessus.
describe('Tones — statistiques dérivées masquées sur CharacterSheet (correctif Story 31.6/31.7)', () => {
  for (const theme of THEMES) {
    it(`${theme} porte la clé evolution.derived_hidden, non vide`, () => {
      expect(TONE_MAP[theme]['evolution.derived_hidden']).toBeTruthy();
    });
    it(`${theme} porte la clé evolution.hidden_marker, non vide`, () => {
      expect(TONE_MAP[theme]['evolution.hidden_marker']).toBeTruthy();
    });
  }
});

// Story 32.2 — les trois titres de zone de l'onglet Détails (Action/Consultation/Référence). Même
// garde de parité que ci-dessus (36.11/36.14/31.1) : une clé posée dans un seul thème rendrait
// `undefined` à l'écran dans les deux autres, invisible à tout test de composant (ils tournent tous
// sur le thème par défaut).
describe('Tones — zones de l’onglet Détails de PartieDetail (Story 32.2)', () => {
  const KEYS = [
    'partie.details_zone_action',
    'partie.details_zone_consultation',
    'partie.details_zone_reference',
  ];

  for (const theme of THEMES) {
    it(`${theme} porte les ${KEYS.length} clés, toutes non vides`, () => {
      for (const key of KEYS) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBeTruthy();
      }
    });
  }
});

// Story 32.3 — les libellés d'état de scénario et de séance. Même garde de parité que ci-dessus :
// aucun test de composant ne tourne hors du thème par défaut, donc une clé oubliée dans deux
// thèmes sur trois ne rendrait `undefined` qu'à l'écran.
describe('Tones — états de scénario et de séance (Story 32.3)', () => {
  const STATUS_KEYS = [
    'status.scenario_brouillon',
    'status.scenario_a_venir',
    'status.scenario_courant',
    'status.scenario_passe',
    'status.seance_a_planifier',
    'status.seance_answer_poll',
    'status.seance_poll_open',
    'status.seance_inscriptions_ouvertes',
    'status.seance_programmee',
    'status.seance_a_debriefer',
    'status.seance_jouee',
  ];

  for (const theme of THEMES) {
    it(`${theme} porte les ${STATUS_KEYS.length} clés, toutes non vides`, () => {
      for (const key of STATUS_KEYS) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBeTruthy();
      }
    });
  }

  // 🚨 Ce sont des noms d'état CONTRACTUELS : ils doivent être rigoureusement les mêmes dans les
  // trois thèmes (Design Notes de la story). Une relecture éditoriale qui « thématiserait » l'un
  // d'eux réintroduirait un troisième vocabulaire d'état — exactement ce que la spec interdit.
  for (const key of STATUS_KEYS) {
    it(`${key} est identique dans les trois thèmes`, () => {
      const values = THEMES.map((t) => TONE_MAP[t][key]);
      expect(new Set(values).size, `${key} → ${values.join(' / ')}`).toBe(1);
    });
  }

  // 🚨 Deux libellés DISTINCTS pour le vote, lisibles sans la teinte : c'est la contrainte
  // d'accessibilité explicite de la story (« deux teintes imposent deux libellés »).
  for (const theme of THEMES) {
    it(`${theme} distingue « réponds au vote » de « vote en cours »`, () => {
      expect(TONE_MAP[theme]['status.seance_answer_poll']).not.toBe(
        TONE_MAP[theme]['status.seance_poll_open'],
      );
    });
  }

  // « Courant », jamais « En cours » : « en cours » est réservé au vote.
  for (const theme of THEMES) {
    it(`${theme} nomme le scénario en cours « Courant »`, () => {
      expect(TONE_MAP[theme]['status.scenario_courant']).toBe('Courant');
    });
  }
});

// Story 34.1 — messages d'échec de connexion. Même garde de parité que ci-dessus : une clé posée
// dans un seul thème rendrait `undefined` à l'écran dans les deux autres. Et, même thématisé,
// chaque texte doit NOMMER sa cause par un mot clair — sans quoi un thème pourrait redevenir
// trompeur (ex. un service indisponible présenté comme des identifiants faux).
describe("Tones — messages d'échec de connexion (Story 34.1)", () => {
  const CAUSE_WORDS: Record<string, string> = {
    'auth.login_invalid': 'invalide',
    'auth.login_reset_required': 'réinitialis',
    'auth.login_throttled': 'tentatives',
    'auth.login_unavailable': 'indisponible',
    'auth.login_unexpected': 'erreur',
  };

  for (const theme of THEMES) {
    it(`${theme} porte les ${Object.keys(CAUSE_WORDS).length} clés, non vides`, () => {
      for (const key of Object.keys(CAUSE_WORDS)) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBeTruthy();
      }
    });

    it(`${theme} nomme la cause de chaque échec par un mot clair`, () => {
      for (const [key, word] of Object.entries(CAUSE_WORDS)) {
        expect(TONE_MAP[theme][key].toLowerCase(), `${theme} / ${key}`).toContain(word);
      }
    });

    it(`${theme} ne parle d'identifiants que pour « identifiants invalides »`, () => {
      for (const key of Object.keys(CAUSE_WORDS)) {
        if (key === 'auth.login_invalid') continue;
        const text = TONE_MAP[theme][key].toLowerCase();
        expect(text, `${theme} / ${key}`).not.toContain('identifiant');
        expect(text, `${theme} / ${key}`).not.toContain('mot de passe incorrect');
      }
    });
  }
});

// Story 34.2 — libellés du bouton de révélation du mot de passe. Garde de parité : une clé posée
// dans un seul thème rendrait `undefined` comme libellé accessible dans les deux autres. Texte
// neutre, identique dans les trois thèmes (un libellé d'accessibilité ne se thématise pas).
describe('Tones — libellés de révélation du mot de passe (Story 34.2)', () => {
  const KEYS = ['auth.password_show', 'auth.password_hide'];

  for (const theme of THEMES) {
    it(`${theme} porte les ${KEYS.length} clés, non vides`, () => {
      for (const key of KEYS) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBeTruthy();
      }
    });

    it(`${theme} porte le même texte neutre que les autres thèmes`, () => {
      for (const key of KEYS) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(TONE_MAP[THEMES[0]][key]);
      }
    });
  }

  it('« afficher » et « masquer » se distinguent', () => {
    for (const theme of THEMES) {
      expect(TONE_MAP[theme]['auth.password_show']).not.toBe(TONE_MAP[theme]['auth.password_hide']);
    }
  });
});

// Story 34.3 — thème de la visite, posé avant le premier rendu d'Angular : le dernier thème connu,
// sinon un tirage équiprobable parmi THEMES, jamais écrit dans le stockage (sinon la visite
// suivante le prendrait pour un thème connu et le tirage cesserait).
describe('ThemeToneService — thème de la visite (Story 34.3)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.className = '';
    TestBed.resetTestingModule();
  });

  const themeClasses = () =>
    Array.from(document.body.classList).filter((c) => c.startsWith('theme-'));

  it('thème mémorisé valide : appliqué tel quel, aucun tirage', () => {
    localStorage.setItem('jdr-theme', 'foret-ancienne');
    const random = vi.spyOn(Math, 'random');

    const service = TestBed.inject(ThemeToneService);
    service.applyVisitTheme();

    expect(service.activeTheme()).toBe('foret-ancienne');
    expect(themeClasses()).toEqual(['theme-foret-ancienne']);
    expect(random).not.toHaveBeenCalled();
  });

  for (const [index, theme] of THEMES.entries()) {
    it(`aucun thème mémorisé : le tirage peut donner « ${theme} » (équiprobable parmi THEMES)`, () => {
      vi.spyOn(Math, 'random').mockReturnValue((index + 0.5) / THEMES.length);

      const service = TestBed.inject(ThemeToneService);
      service.applyVisitTheme();

      expect(service.activeTheme()).toBe(theme);
      expect(themeClasses()).toEqual([`theme-${theme}`]);
    });
  }

  it("le thème tiré n'est jamais écrit dans le stockage", () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const service = TestBed.inject(ThemeToneService);
    service.applyVisitTheme();

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem('jdr-theme')).toBeNull();
  });

  it('valeur illisible ou inconnue : traitée comme « aucune information » (tirage), classe résiduelle retirée', () => {
    localStorage.setItem('jdr-theme', 'theme-disparu');
    document.body.classList.add('theme-disparu', 'theme-grimoire-emeraude');
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const service = TestBed.inject(ThemeToneService);
    service.applyVisitTheme();

    expect(service.activeTheme()).toBe(THEMES[Math.floor(0.5 * THEMES.length)]);
    expect(themeClasses()).toEqual([`theme-${service.activeTheme()}`]);
    expect(localStorage.getItem('jdr-theme')).toBe('theme-disparu');
  });

  it('stockage indisponible : aucune erreur, un thème est tiré et appliqué, rien écrit', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('accès refusé', 'SecurityError');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const service = TestBed.inject(ThemeToneService);
    expect(() => service.applyVisitTheme()).not.toThrow();

    expect(service.activeTheme()).toBe(THEMES[0]);
    expect(themeClasses()).toEqual([`theme-${THEMES[0]}`]);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('setTheme reste le seul à écrire le stockage, et retire toute classe theme-*', () => {
    document.body.classList.add('theme-inconnu');
    const service = TestBed.inject(ThemeToneService);

    service.setTheme('foret-ancienne');

    expect(localStorage.getItem('jdr-theme')).toBe('foret-ancienne');
    expect(themeClasses()).toEqual(['theme-foret-ancienne']);
  });

  it('setTheme ne plante pas si le stockage est indisponible, et applique quand même le thème', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const service = TestBed.inject(ThemeToneService);

    expect(() => service.setTheme('foret-ancienne')).not.toThrow();
    expect(service.activeTheme()).toBe('foret-ancienne');
  });
});

// Story 34.3 — ligne d'orientation de la connexion et messages de validation des formulaires
// d'authentification. Garde de parité : une clé posée dans un seul thème rendrait `undefined` à
// l'écran dans les deux autres. Les messages de validation (`auth.field_*`) restent neutres et
// identiques, ils NOMMENT la règle ; la ligne d'orientation (`auth.login_invite_only`) a, depuis la
// 35.3, la voix de chaque thème (elle doit toujours dire « invitation »).
describe('Tones — validation et orientation des écrans d’authentification (Story 34.3)', () => {
  const RULE_WORDS: Record<string, string> = {
    'auth.login_invite_only': 'invitation',
    'auth.field_required': 'champ',
    'auth.field_email_invalid': 'e-mail',
    'auth.field_pseudo_min': '3 caractères',
    'auth.field_password_min': '8 caractères',
  };

  for (const theme of THEMES) {
    it(`${theme} porte les ${Object.keys(RULE_WORDS).length} clés, non vides, et nomme la règle`, () => {
      for (const [key, word] of Object.entries(RULE_WORDS)) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBeTruthy();
        expect(TONE_MAP[theme][key].toLowerCase(), `${theme} / ${key}`).toContain(word);
      }
    });
  }

  for (const key of Object.keys(RULE_WORDS).filter((k) => k.startsWith('auth.field_'))) {
    it(`${key} est identique dans les trois thèmes (texte neutre de référence)`, () => {
      const values = THEMES.map((t) => TONE_MAP[t][key]);
      expect(new Set(values).size, `${key} → ${values.join(' / ')}`).toBe(1);
    });
  }
});

describe("Tones — ligne d'orientation de la connexion (Story 35.3)", () => {
  it('auth.login_invite_only a la voix de chaque thème et dit « invitation »', () => {
    const values = THEMES.map((theme) => TONE_MAP[theme]['auth.login_invite_only']);
    expect(new Set(values).size, values.join(' / ')).toBe(THEMES.length);
    for (const value of values) expect(value.toLowerCase()).toContain('invitation');
  });
});

// Story 34.4 — accroche de la bande d'authentification : une clé par thème, texte propre à chaque
// thème (contrairement aux messages de validation de la 34.3, volontairement neutres).
describe('Tones — accroche de la bande d’authentification (Story 34.4)', () => {
  for (const theme of THEMES) {
    it(`${theme} porte auth.tagline, non vide`, () => {
      expect(TONE_MAP[theme]['auth.tagline'], theme).toBeTruthy();
      expect(TONE_MAP[theme]['auth.tagline'].trim(), theme).not.toBe('');
    });
  }

  it('auth.tagline est distincte d’un thème à l’autre', () => {
    const values = THEMES.map((t) => TONE_MAP[t]['auth.tagline']);
    expect(new Set(values).size, values.join(' / ')).toBe(THEMES.length);
  });
});

// Story 35.2 — classement des textes. Une formulation qui se répète vit sous UNE clé `common.*`
// (les voix des trois thèmes sont écrites par la 35.3 : ces clés ne sont plus imposées identiques).
// Les trous `{nom}` doivent être les mêmes partout, sinon `fillTone` laisserait un trou affiché
// dans l'un des thèmes.
describe('Tones — textes migrés au registre (Story 35.2)', () => {
  const REFERENCE = TONE_MAP[THEMES[0]];

  it('les clés communes (`common.*`) existent dans les trois thèmes et ont leur propre voix', () => {
    const communes = Object.keys(REFERENCE).filter((key) => key.startsWith('common.'));
    expect(communes.length).toBeGreaterThan(0);
    // Les mots fonctionnels qui restent identiques sont recensés par NEUTRAL_KEYS (voir plus bas).
    const voix = communes.filter((key) => new Set(THEMES.map((t) => TONE_MAP[t][key])).size > 1);
    expect(voix.length).toBeGreaterThan(communes.length / 2);
  });

  it('les trous `{nom}` d’une clé sont les mêmes dans les trois thèmes', () => {
    const holes = (text: string) => (text.match(/\{[a-z_]+\}/g) ?? []).sort().join(',');
    for (const key of Object.keys(REFERENCE)) {
      for (const theme of THEMES) {
        expect(holes(TONE_MAP[theme][key]), `${theme} / ${key}`).toBe(holes(REFERENCE[key]));
      }
    }
  });

  it('aucune valeur du registre n’est vide', () => {
    for (const theme of THEMES) {
      for (const [key, value] of Object.entries(TONE_MAP[theme])) {
        expect(value.trim(), `${theme} / ${key}`).not.toBe('');
      }
    }
  });

  it('les libellés orphelins supprimés par la 35.2 ne reviennent pas', () => {
    const orphelines = [
      'dashboard.controls_toggle_aria',
      'dashboard.sort_label',
      'partie.show_troupe',
      'partie.hide_troupe',
      'cta.launch_vote',
      'cta.send_reminder',
      'section.constraints',
      'empty.no_constraints',
      'alert.expiring_soon',
      'status.unavailable_label',
      'status.unknown_label',
      'empty.no_poll',
      'success.date_chosen',
      'character.tab_label',
      'character.portrait_missing',
      'account.save_btn',
      'account.email_change_title',
      // Story 35.3 : les types de partie n'ont plus qu'une série, `partie.kind_*`.
      'core.parties_kind_one_shot',
      'core.parties_kind_campagne',
      'core.parties_kind_campagne_episodique',
      // Story 35.3 : remplacées par une phrase entière par cas (accord dans le registre).
      'calendar.conflict_overwrite_one',
      'calendar.conflict_overwrite_many',
    ];
    for (const theme of THEMES) {
      for (const key of orphelines) {
        expect(Object.keys(TONE_MAP[theme]), `${theme} / ${key}`).not.toContain(key);
      }
    }
  });
});

// Story 35.3 — une voix par thème. Les trois thèmes ne sont plus des copies : chacun tient son
// univers (Grimoire Émeraude : magie et bibliothèque, vouvoiement ; Forêt Ancienne : nature et
// druides, tutoiement ; Atelier Cuivré : engrenages et registres, vouvoiement) de la première à la
// dernière clé. Les textes CONTRACTUELS restent neutres et identiques, et tout autre texte
// identique doit être recensé ici, avec sa raison : un texte qui reste identique par oubli échoue.
describe('Tones — une voix par thème (Story 35.3)', () => {
  /** Clés VOLONTAIREMENT identiques dans les trois thèmes — exactement ces clés, ni plus ni moins.
   *  Une clé qui s'ajoute au registre sans voix propre fait échouer le premier test ; une clé
   *  recensée ici qui reçoit une voix fait échouer le second (la liste ne pourrit pas). */
  const NEUTRAL_KEYS = new Set<string>([
    // Contractuels (spec 35.3) : états, nom propre, accessibilité du mot de passe, règles de champ, badges de l’Agenda
    'auth.field_required',
    'auth.field_email_invalid',
    'auth.field_pseudo_min',
    'auth.field_password_min',
    'auth.password_show',
    'auth.password_hide',
    'status.scenario_brouillon',
    'status.scenario_a_venir',
    'status.scenario_courant',
    'status.scenario_passe',
    'status.seance_a_planifier',
    'status.seance_answer_poll',
    'status.seance_poll_open',
    'status.seance_inscriptions_ouvertes',
    'status.seance_programmee',
    'status.seance_a_debriefer',
    'status.seance_jouee',
    'calendar.agenda.badge_answer_poll',
    'calendar.agenda.badge_poll_open',
    'calendar.agenda.badge_signup',
    'calendar.agenda.badge_signed_up',
    'calendar.agenda.badge_debrief',
    'calendar.agenda.badge_to_seal',
    'character.nature_dragon',
    // Verbatim du contrat d’UI du calendrier (stories 32.2, 36.4, 36.9, 36.14) et noms de vues
    'common.conserver',
    'common.remplacer',
    'common.vue_agenda',
    'common.vue_mois',
    'common.vue_semaine',
    'account.calendar_layer.mes-indisponibilites',
    'account.calendar_layer.mes-disponibilites',
    'account.calendar_layer.mes-seances',
    'account.calendar_layer.votes-en-cours',
    'account.calendar_layer.inscriptions-ouvertes',
    'account.calendar_layer.disponibilite-groupe',
    'account.calendar_intent.disponibilites',
    'account.calendar_intent.seances',
    'account.calendar_intent.votes',
    'account.calendar_intent.groupe',
    'partie.details_zone_action',
    'partie.details_zone_consultation',
    'partie.details_zone_reference',
    'calendar.display.trigger',
    'calendar.display.section_visible',
    'calendar.display.show_legend',
    'calendar.display.filtered_badge',
    'calendar.legend.entry.available',
    'calendar.legend.entry.unavailable',
    'calendar.legend.entry.vote',
    'calendar.legend.entry.group',
    'calendar.legend.entry.none',
    'calendar.view_back',
    'calendar.view_toggle_month_short',
    'calendar.view_toggle_week_short',
    'calendar.view_toggle_agenda_short',
    'calendar.conflict_walkthrough_label',
    'cta.destiny_mode',
    // Story 44.3 — « Organisateur » : mot de travail, identique partout (EXPERIENCE §3.2)
    'calendar.destiny_state_organizer',
    // Story 44.4 — le plateau : comptes, étiquette « meilleur », « n oui » et annonce du créneau courant
    // sont des mots de travail, identiques partout (EXPERIENCE §3.2)
    'calendar.destiny_board_answers_one',
    'calendar.destiny_board_answers_many',
    'calendar.destiny_board_best',
    'calendar.destiny_board_yes',
    'calendar.destiny_board_announce',
    // Story 44.5 — le tiroir : mots de travail et accessibilité, identiques partout
    'calendar.destiny_sheet_region',
    'calendar.destiny_sheet_dates_one',
    'calendar.destiny_sheet_dates_many',
    'calendar.destiny_sheet_hide',
    'calendar.destiny_sheet_collapse_aria',
    // Story 44.6 — « Fermer » du message de fermeture de la Destinée
    'calendar.destiny_notice_dismiss',
    // Story 45.1 — nature d'un rendez-vous dans le choix : explication en clair, volontairement hors thème
    // (« soirée sans date » dans les trois thèmes, EXPERIENCE §3.3)
    // Story 45.7 — explication en clair, volontairement hors thème (EXPERIENCE §2.7)
    'partie.mode_plain_quete',
    'partie.mode_plain_ralliement',
    'partie.kind_plain_ONE_SHOT',
    'partie.kind_plain_CAMPAGNE_LINEAIRE',
    'partie.kind_plain_CAMPAGNE_EPISODIQUE',
    'partie.ralliement_kind_plain_ONE_SHOT',
    'partie.ralliement_kind_plain_CAMPAGNE_EPISODIQUE',
    'calendar.rendezvous_nature_seance',
    'calendar.rendezvous_nature_soiree',
    'calendar.rendezvous_nature_seance_poll',
    // Story 46.1 — boutons de la colonne de droite : noms accessibles identiques dans les trois thèmes
    'calendar.column_dock',
    'calendar.column_reopen',
    // Story 46.2 — actions de la fenêtre sélectionnée : mêmes mots dans les trois thèmes
    'calendar.window_add',
    'calendar.window_hide',
    // Story 46.4 — « Démasquer » : le même mot dans les trois thèmes
    'calendar.window_unhide',
    // Vocabulaire du système de jeu (Ryuutama) : noms de fiches, de rubriques et de catégories
    'partie.asset_journal_cta',
    'partie.asset_carte_cta',
    'partie.asset_monde_cta',
    'partie.asset_monstre_cta',
    'partie.asset_ville_cta',
    'partie.asset_objectif_chasse_cta',
    'partie.asset_objectif_quete_cta',
    'partie.asset_objectif_voyage_cta',
    'partie.asset_oeuf_de_bataille_cta',
    'partie.asset_structure_cta',
    'my_characters.sort_niveau',
    'character.level_badge',
    'characters_sheet.history_level',
    'characters_sheet.levelup_title_level',
    'roster.mj_badge',
    'character.choice_talents_label',
    'character.choice_advantages_label',
    'character.choice_reference_toggle',
    'character.recap_total',
    'detail.row_attributes',
    'detail.row_difficulty',
    'detail.row_effect',
    'detail.row_conditions',
    'character.equipment_group_individual',
    'character.equipment_group_contenant',
    'character.equipment_group_animal',
    'characters_wizard.attributes_profile_aria',
    'characters_wizard.attributes_banner_profile',
    'hd.sheet_export_editable',
    'hd.sheet_export_2pages',
    // Mots fonctionnels courts : états de disponibilité, réponses de vote, champs, bornes, unités
    'common.au',
    'common.disponible',
    'common.du',
    'common.heure',
    'common.indisponible',
    'common.lieu',
    'common.non',
    'common.oui',
    'common.peut_etre',
    'common.poids',
    'common.seance_n',
    'common.title_seance_index',
    'common.titre',
    'calendar.agg_available_title',
    'calendar.agg_unknown_title',
    'calendar.agg_unavailable_title',
    'calendar.view_group_unavailable_detail',
    'calendar.view_selection_one',
    'calendar.month_cell_instructions',
    'calendar.month_day_today_aria',
    'calendar.week_decl_available',
    'calendar.week_decl_punctual',
    'calendar.week_decl_recurring',
    'calendar.week_decl_unavailable',
    'calendar.week_status_available',
    'calendar.week_status_unavailable',
    'calendar.week_status_unknown',
    'calendar.util_answer_yes',
    'calendar.util_answer_maybe',
    'calendar.util_answer_no',
    'calendar.util_group_unavailable_one',
    'calendar.util_group_unavailable_many',
    'calendar.util_word_no_answer',
    'calendar.util_counter',
    'calendar.constraint_end_date',
    'calendar.constraint_kind_aria',
    'calendar.constraint_start_date',
    'calendar.conflict_kind_available',
    'calendar.conflict_kind_unavailable',
    'calendar.compose_confirm_responses_many',
    'calendar.compose_confirm_responses_one',
    // Story 38.5 : mots de travail provisoires des rôles d’un ralliement (identiques dans les trois
    // thèmes en attendant les variantes validées) et libellés fonctionnels des filtres de la liste
    'dashboard.filter_genre_label',
    'dashboard.filter_genre_all',
    'dashboard.group_by_type_label',
    'dashboard.role_ralliement_host',
    'dashboard.role_ralliement_guest',
    'dashboard.role_ralliement_admin',
    'dashboard.role_ralliement_member',
    // Story 39.1 : sections de l’onglet d’ouverture d’un groupe, mots fonctionnels identiques
    'partie.ralliement_conjonctions_upcoming',
    'partie.ralliement_conjonctions_past',
    'partie.ralliement_conjonctions_upcoming_empty',
    'partie.ralliement_conjonctions_past_empty',
    // Story 41.1 : seconds onglets et ligne de participation d’une soirée isolée, mots fonctionnels
    // identiques (le premier onglet, au nom du thème, a sa voix et n’est pas listé ici)
    'partie.ralliement_soiree_guests_tab',
    'partie.ralliement_soiree_invitations_tab',
    'partie.ralliement_soiree_participation',
    // Story 41.3 : état vide de l'onglet de l'hôte et pastille d'une invitation reçue, sans pronom
    'partie.ralliement_soiree_guests_empty',
    // Story 41.4 : bandeau d'une rencontre isolée terminée, sans pronom
    'partie.ralliement_soiree_status_closed_label',
    'dashboard.invitation_pending_chip',
    // Story 39.4 : badge, boutons et confirmation de nomination des administrateurs d’un groupe,
    // verbatim du contrat d’UI (identiques dans les trois thèmes) ; « Vous restez membre » prend le
    // tutoiement de la forêt, donc sa clé a une voix et n’est pas listée ici
    'partie.ralliement_admin_badge',
    'partie.ralliement_appoint_btn',
    'partie.ralliement_appoint_confirm',
    'partie.ralliement_step_down_btn',
    'partie.ralliement_last_admin_btn',
    // Story 39.5 : bouton « Quitter le groupe », verbatim du contrat d’UI ; sa confirmation prend le
    // tutoiement de la forêt, donc sa clé a une voix et n’est pas listée ici
    'partie.ralliement_leave_btn',
    // Story 40.1 : fenêtre de création et carte d’une conjonction — libellés de champ, options,
    // chips de situation et badges verbatim du contrat d’UI ; le nom de la rencontre (Conjonction /
    // Halte / Réunion), le rappel d’hôte tutoyé dans la forêt, l’heure de « retrouvailles » de la
    // forêt (« rendez-vous » s’y lirait comme un vouvoiement) et les replis d’erreur ont une voix
    'partie.ralliement_event_date_label',
    'partie.ralliement_event_date_fixed',
    'partie.ralliement_event_date_poll',
    'partie.ralliement_event_day_label',
    'partie.ralliement_event_slot_label',
    'partie.ralliement_event_place_label',
    'partie.ralliement_event_note_label',
    'partie.ralliement_event_participation_label',
    'partie.ralliement_event_participation_all',
    'partie.ralliement_event_participation_limited',
    'partie.ralliement_event_places_count_aria',
    'partie.ralliement_event_places_less',
    'partie.ralliement_event_places_more',
    'partie.ralliement_event_cancel_btn',
    'partie.ralliement_event_host',
    'partie.ralliement_event_situation',
    'partie.ralliement_event_chip_participating',
    'partie.ralliement_event_chip_was_there',
    'partie.ralliement_event_chip_not_registered',
    'partie.ralliement_event_badge_in_days',
    'partie.ralliement_event_badge_today',
    'partie.ralliement_event_badge_tomorrow',
    'partie.ralliement_event_no_date',
    // Story 40.2 : fenêtre de détail d’une conjonction — boutons, étiquettes de fiche, titres de
    // section et unités de la ligne de participation verbatim du contrat d’UI ; le titre du mode
    // édition, le panneau de situation, l’heure de rendez-vous, « vous » et les replis d’erreur
    // ont une voix
    'partie.ralliement_event_close_btn',
    'partie.ralliement_event_edit_btn',
    'partie.ralliement_event_save_btn',
    'partie.ralliement_event_sheet_date',
    'partie.ralliement_event_sheet_host',
    'partie.ralliement_event_sheet_place',
    'partie.ralliement_event_sheet_participation',
    'partie.ralliement_event_sheet_note',
    'partie.ralliement_event_participants_heading',
    'partie.ralliement_event_participants_empty',
    'partie.ralliement_event_unit_place',
    'partie.ralliement_event_unit_registered',
    'partie.ralliement_event_unit_free',
    // Story 40.3 : « S'inscrire », « Me désinscrire » et « Complet » verbatim du contrat d’UI ; l’état
    // écrit du panneau et les replis d’erreur ont une voix
    'partie.ralliement_event_signup_btn',
    'partie.ralliement_event_unsubscribe_btn',
    'partie.ralliement_event_badge_full',
    // Story 40.4 : « Place réservée », « Accepter », « Décliner », « Réserver une place à des membres »,
    // son aide, la pastille « invité·e » de l’hôte et les actions de retrait sont des mots du contrat
    // d’UI ; les situations de la personne réservée et les replis d’erreur ont une voix
    'partie.ralliement_event_chip_reserved',
    'partie.ralliement_event_accept_btn',
    'partie.ralliement_event_decline_btn',
    'partie.ralliement_event_reserve_label',
    'partie.ralliement_event_reserve_hint',
    'partie.ralliement_event_reserve_none',
    'partie.ralliement_event_reserve_chip_aria',
    'partie.ralliement_event_unreserve_btn',
    'partie.ralliement_event_unreserve_aria',
    'partie.ralliement_event_pending_text',
    // Story 40.5 : sondage de dates d’une conjonction — libellés de champ, badge, puce, ligne de date et
    // lignes de résumé verbatim du contrat d’UI (sans adresse à la personne) ; les phrases des panneaux
    // membre et hôte (« Vote à faire… », « Vous êtes l’hôte… ») ont une voix
    'partie.ralliement_event_poll_slots_label',
    'partie.ralliement_event_poll_add_btn',
    'partie.ralliement_event_poll_slot_remove_aria',
    'partie.ralliement_event_poll_summary',
    'partie.ralliement_event_poll_min_hint',
    'partie.ralliement_event_poll_remove_hint',
    'partie.ralliement_event_poll_deadline_label',
    'partie.ralliement_event_unit_slot',
    'partie.ralliement_event_unit_available',
    'partie.ralliement_event_poll_date_line',
    'partie.ralliement_event_badge_poll',
    'partie.ralliement_event_chip_vote_todo',
    'partie.ralliement_event_poll_best',
    'partie.ralliement_event_poll_host_answers',
    'partie.ralliement_event_poll_host_waiting',
    'partie.ralliement_event_poll_slots_heading',
    'partie.ralliement_event_poll_ended',
    'partie.ralliement_event_poll_ends_today',
    'partie.ralliement_event_poll_ends_tomorrow',
    'partie.ralliement_event_poll_ends_in_days',
    // Story 40.6 : fixer la date — libellés, décompte et avertissement verbatim du contrat d’UI (« Fixer la
    // date… », « n oui · n peut-être · n non », « La date sera scellée… ») ; seul le repli d’erreur a une voix
    'partie.ralliement_event_fix_date_btn',
    'partie.ralliement_event_fix_confirm_btn',
    'partie.ralliement_event_fix_heading',
    'partie.ralliement_event_fix_counts',
    'partie.ralliement_event_fix_past',
    'partie.ralliement_event_fix_warning',
    // Story 42.5 : « Retirer de ma liste » — nom accessible et bouton sont du contrat ; la phrase de
    // confirmation garde ses mots, la forêt la tutoie (« ta liste », « toi seul »)
    'dashboard.hide_party_aria',
    'dashboard.hide_party_confirm_btn',
    // Story 42.2 : l'état « Annulée » de la tuile et la phrase du bandeau d'une rencontre annulée sont du contrat
    'dashboard.status_cancelled_badge',
    'partie.ralliement_soiree_status_cancelled_label',
    // Story 42.1 : annuler une conjonction — le mot « Annulée », la question et l’avertissement de la
    // confirmation sont verbatim du contrat d’UI ; le bouton, le constat et le repli d’erreur ont une voix
    'partie.ralliement_event_badge_cancelled',
    'partie.ralliement_event_cancel_event_heading',
    'partie.ralliement_event_cancel_event_warning',
    // Story 40.7 : prolonger le vote — libellés, phrase d’introduction et avertissement verbatim du contrat
    // d’UI (« Prolonger le vote », « Nouvelle échéance », « Les personnes qui n’ont pas encore voté… ») ;
    // seul le repli d’erreur a une voix
    'partie.ralliement_event_extend_btn',
    'partie.ralliement_event_extend_confirm_btn',
    'partie.ralliement_event_extend_heading',
    'partie.ralliement_event_extend_field',
    'partie.ralliement_event_extend_warning',
    // Story 40.5b : calendrier du groupe — liens et boutons verbatim du contrat d’UI (« Calendrier du
    // groupe », « Choisir les créneaux dans le calendrier », « Voter dans le calendrier », « Composer
    // les créneaux »), titre du panneau des votes et unités de l’avertissement de retrait de créneaux
    'partie.ralliement_calendar_link',
    'partie.ralliement_event_poll_calendar_btn',
    'partie.ralliement_event_vote_in_calendar_btn',
    'partie.ralliement_event_compose_in_calendar_btn',
    'partie.ralliement_calendar_polls_heading',
    'partie.ralliement_calendar_confirm_slots_one',
    'partie.ralliement_calendar_confirm_slots_many',
    'partie.ralliement_calendar_confirm_responses_one',
    'partie.ralliement_calendar_confirm_responses_many',
    'partie.ralliement_calendar_confirm_summary_one',
    'partie.ralliement_calendar_confirm_summary_many',
    'partie.ralliement_calendar_confirm_note',
    // Gabarits structurels et libellés techniques
    'partie.signal_more_count',
    'parties.detail_link_expires_short',
    'parties.roster_aria_character',
    'parties.roster_aria_character_class',
    'parties.roster_aria_create',
    'portrait.cropper_zoom',
    'portrait.avatar_aria',
    'portrait.avatar_aria_empty',
    // Story 43.1 : zone sensible et confirmation d'effacement du compte — textes fixes du contrat
    // (UX-DR12, UX-DR13), volontairement identiques dans les trois thèmes.
    'account.danger_title',
    'account.delete_pill',
    'account.delete_intro',
    'account.delete_groups_title',
    'account.delete_group_line',
    'account.delete_members_one',
    'account.delete_members_many',
    'account.delete_events_one',
    'account.delete_events_many',
    'account.delete_jdr_title',
    'account.delete_jdr_line',
    'account.delete_jdr_line_one',
    'account.delete_jdr_line_none',
    'account.delete_irreversible',
    'account.delete_confirm_btn',
    // Story 48.1 : Ludothèque — libellés de saisie (« Nom », « Joueurs », « à », « Durée en minutes »,
    // « Ajouter », « Seul le nom est obligatoire. »), mesures (« {min}–{max} joueurs », « {d} min » et
    // formes partielles), décomptes (« {n} jeu(x) »), message max < min et repli d’erreur : mesure ou
    // saisie, volontairement hors thème (EXPERIENCE.md §3.3) ; seuls titre, visibilité et doublon ont une voix
    'board_games.field_name',
    'board_games.field_players',
    'board_games.field_players_to',
    'board_games.field_players_min_aria',
    'board_games.field_players_max_aria',
    'board_games.field_duration',
    'board_games.add_btn',
    'board_games.hint',
    'board_games.max_below_min',
    'board_games.error_fallback',
    'board_games.measure_players_range',
    'board_games.measure_players_exact_one',
    'board_games.measure_players_exact_many',
    'board_games.measure_players_min',
    'board_games.measure_players_max',
    'board_games.measure_duration',
    'board_games.count_one',
    'board_games.count_many',
    // Story 48.2 : correction et retrait — « Enregistrer », nom accessible du ✎ (« Modifier {nom} »),
    // « Jeu retiré » et son « Annuler » : textes fonctionnels du contrat (EXPERIENCE.md §3.3),
    // volontairement hors thème ; seul « Retirer de mon cabinet / coffre / râtelier » a une voix
    'board_games.save_btn',
    'board_games.edit_aria',
    'board_games.removed',
    'board_games.undo_btn',
    // Story 48.3 : « Fermer » de la feuille d’une Ludothèque — libellé fonctionnel d’un bouton de
    // fermeture, volontairement hors thème (comme les autres boutons d’action neutres de cette liste)
    'board_games.sheet_close',
    // Story 50.1 : onglet des jeux du groupe — « Chercher un jeu… », « Jouable à : » et son nom accessible,
    // « chez {noms} », « moi », pied « {n} jeux chez {m} membres » (accordé) et « Aucun jeu ne correspond. » :
    // saisie, mesure ou provenance, volontairement hors thème (EXPERIENCE.md §3.3) ; seule la ligne
    // « groupe sans jeu » (`board_games.group_empty`) a une voix
    'board_games.group_search',
    'board_games.group_fit_label',
    'board_games.group_fit_chip_aria',
    'board_games.group_owners_prefix',
    'board_games.group_owner_me',
    'board_games.group_footer',
    'board_games.group_footer_members_one',
    'board_games.group_footer_members_many',
    'board_games.group_no_match',
    // Story 50.2 : « Qui reçoit » — « {n} fois » et « Jamais : {noms} » sont des mesures et un libellé de liste,
    // volontairement hors thème (EXPERIENCE.md §3.3) ; seul le titre de la section (`host_counts.title`) a une voix
    'host_counts.times',
    'host_counts.never',
    // Story 49.1 : jeux sur place d'une soirée — « Chez {nom} » / « Chez moi » (provenance), résumé « {n} jeux sur
    // place · {k} jouables à {total} » (jeux et jouables accordés chacun avec son nombre), puce « Jouables à {total} », pastille
    // « jouable à {total} », comptes de section (« · 6 », « · 3 sur 6 »), nom accessible d'un en-tête, annonce
    // polie quand N change (« 7 participants : 4 jeux jouables à 7. ») : mesure ou provenance, volontairement
    // hors thème (EXPERIENCE.md §3.3) ; seuls l'onglet, la ligne « aucun jeu » et le lien discret ont une voix
    'event_games.host_section',
    'event_games.host_section_self',
    'event_games.summary',
    'event_games.summary_games_one',
    'event_games.summary_games_many',
    'event_games.summary_playable_one',
    'event_games.summary_playable_many',
    'event_games.filter_fit',
    'event_games.fit_pill',
    'event_games.section_count',
    'event_games.section_count_filtered',
    'event_games.section_aria',
    'event_games.section_aria_filtered',
    'event_games.section_aria_filtered_one',
    'event_games.participants_one',
    'event_games.participants_many',
    'event_games.playable_one',
    'event_games.playable_many',
    'event_games.announce',
    // Story 49.2 : doublons et provenance — « ×{n} », « aussi chez {noms} », « aussi apporté par {noms} »,
    // « déjà chez {nom} » (⚠ rendu par app-icon), « par {nom} », « par moi », « moi » (nom du détenteur qui est la personne connectée) :
    // provenance et mesure, volontairement hors thème ; le message de retrait d'un jeu apporté à des soirées à
    // venir (« Ce jeu est apporté à {n} soirées à venir : il en sera retiré. ») est un texte fonctionnel, neutre.
    // Seuls les deux titres de section, « J'apporte », « Je ne l'apporte plus » et « Votre cabinet est vide » ont une voix
    'event_games.dup_pill',
    'event_games.also_at',
    'event_games.also_brought_by',
    'event_games.already_at',
    'event_games.by_other',
    'event_games.by_me',
    'event_games.holder_me',
    'board_games.remove_brought_one',
    'board_games.remove_brought_many',
    // Story 49.4 : noms accessibles du ⋮ d'un jeu de l'hôte et de son menu (« Actions pour {nom} ») — libellés
    // fonctionnels d'accessibilité, volontairement hors thème ; l'entrée du menu, le titre et la mention de la
    // section du bas et « Remettre » ont une voix
    'event_games.menu_trigger_aria',
    'event_games.menu_aria',
    // Story 49.5 : noms accessibles du compte d'Envies (« Voir les noms — {nom}, {n} {unite} ») et de la liste des
    // noms (« Noms pour {nom} ») — libellés fonctionnels d'accessibilité, volontairement hors thème ; le libellé
    // du ♥, l'unité du compte (appel / envie / demande) et la puce de tri ont une voix
    'event_games.envy_count_aria',
    'event_games.envy_names_aria',
  ]);

  const REFERENCE = TONE_MAP['grimoire-emeraude'];
  const identicalKeys = () =>
    Object.keys(REFERENCE).filter(
      (key) => new Set(THEMES.map((theme) => TONE_MAP[theme][key])).size === 1,
    );

  it('aucune clé n’est identique dans les trois thèmes, hors des textes neutres recensés', () => {
    const oubliees = identicalKeys().filter((key) => !NEUTRAL_KEYS.has(key));
    expect(oubliees, `clés restées en libellé générique : ${oubliees.join(', ')}`).toEqual([]);
  });

  it('chaque texte neutre recensé existe et est réellement identique dans les trois thèmes', () => {
    const identiques = new Set(identicalKeys());
    for (const key of NEUTRAL_KEYS) {
      expect(Object.keys(REFERENCE), key).toContain(key);
      expect(identiques.has(key), `${key} a désormais une voix : le retirer de NEUTRAL_KEYS`).toBe(
        true,
      );
    }
  });

  it('les textes contractuels sont neutres et identiques dans les trois thèmes', () => {
    const contractuelles = Object.keys(REFERENCE).filter(
      (key) =>
        key.startsWith('status.') ||
        key === 'character.nature_dragon' ||
        key.startsWith('auth.password_') ||
        key.startsWith('auth.field_') ||
        key.startsWith('calendar.agenda.badge_'),
    );
    expect(contractuelles.length).toBe(24);
    for (const key of contractuelles) {
      const values = THEMES.map((theme) => TONE_MAP[theme][key]);
      expect(new Set(values).size, `${key} → ${values.join(' / ')}`).toBe(1);
    }
  });

  // Les clés les plus vues (navigation, authentification, tableau de bord, partie, calendrier,
  // vote, personnages, Homme Dragon) : aucun thème ne dit la même chose qu'un autre.
  const HIGH_VISIBILITY = [
    'nav.my_games',
    'nav.create_game',
    'nav.logout',
    'nav.calendar',
    'nav.account',
    'nav.characters',
    'auth.tagline',
    'auth.login_invalid',
    'auth.login_reset_required',
    'auth.login_throttled',
    'auth.login_unavailable',
    'auth.login_identifier_label',
    'auth.login_submit',
    'auth.login_forgot_link',
    'auth.login_invite_only',
    'auth.register_submit',
    'auth.forgot_sent',
    'auth.forgot_submit',
    'auth.reset_submit',
    'common.connexion',
    'common.creer_un_compte',
    'common.mot_de_passe',
    'common.mot_de_passe_oublie',
    'common.nouveau_mot_de_passe',
    'common.lien_invalide',
    'common.retour_a_la_connexion',
    'common.annuler',
    'common.enregistrer',
    'common.supprimer',
    'common.confirmer',
    'common.valider',
    'common.chargement',
    'common.rechercher',
    'common.fermer',
    'dashboard.title_invitations',
    'dashboard.empty',
    'dashboard.role_mj',
    'dashboard.role_player',
    'dashboard.section_awaiting',
    'dashboard.section_upcoming',
    'dashboard.section_finished',
    'dashboard.sort_urgence',
    'dashboard.favorite_add_aria',
    'partie.new_title',
    'partie.save_btn',
    'partie.name_label',
    'partie.kind_ONE_SHOT',
    'partie.kind_CAMPAGNE_LINEAIRE',
    'partie.kind_CAMPAGNE_EPISODIQUE',
    'partie.signal_vote_en_cours_sans_reponse',
    'partie.signal_aucune_date_ni_vote',
    'partie.delete_btn',
    'parties.detail_tab_scenario',
    'parties.detail_delete_confirm',
    'scenarios.list_title',
    'scenarios.form_title',
    'scenarios.editor_close',
    'scenarios.seances_inscrire',
    'scenarios.seances_desinscrire',
    'calendar.agenda.section_awaiting',
    'calendar.agenda.empty',
    'calendar.agenda.poll_open',
    'calendar.agenda.no_date',
    'calendar.legend.title',
    'calendar.view_no_poll',
    'calendar.view_propose_dates',
    'calendar.view_modify_dates',
    'calendar.compose_link_stale',
    'calendar.rendezvous_picker_title',
    'calendar.conflict_intent_prefix',
    'calendar.conflict_title_many',
    'calendar.conflict_overwrite_available_many',
    'calendar.compose_count_many',
    'calendar.selbar_count_many',
    'cta.withdraw_vote',
    'poll.status_title',
    'announcement.publish_cta',
    'my_characters.title',
    'character.create_cta',
    'evolution.levelup_cta',
    'evolution.inventory_section_title',
    'roster.invite_slot',
    'hd.creation_page_title',
    'homme-dragon.created_notice',
    'account.title',
    'account.password_title',
    'characters_wizard.step_progress',
    'characters_wizard.summary_default_title',
  ];

  it('les clés de grande visibilité existent et sont toutes distinctes d’un thème à l’autre', () => {
    for (const key of HIGH_VISIBILITY) {
      expect(Object.keys(REFERENCE), key).toContain(key);
      const values = THEMES.map((theme) => TONE_MAP[theme][key]);
      expect(new Set(values).size, `${key} → ${values.join(' / ')}`).toBe(THEMES.length);
    }
  });

  // Forme d'adresse : une seule par thème, de la première à la dernière clé. Les textes contractuels
  // sont exclus (neutres, ils gardent leur forme d'origine : « Réponds au vote »).
  const isContractual = (key: string) =>
    key.startsWith('status.') ||
    key === 'character.nature_dragon' ||
    key.startsWith('auth.password_') ||
    key.startsWith('auth.field_') ||
    key.startsWith('calendar.agenda.badge_') ||
    // Story 43.1 : confirmation d'effacement du compte, textes fixes du contrat (UX-DR12), vouvoyés.
    /^account\.delete_(intro|groups_title|jdr_title|irreversible)$/.test(key) ||
    // Story 45.7 : lignes en clair du formulaire de création — une seule voix neutre pour les trois thèmes (UX §2.7).
    /^partie\.(mode_plain_|kind_plain_|ralliement_kind_plain_)/.test(key);
  const VOUVOIEMENT =
    /(^|[^\p{L}])(vous|votre|vos)(?=$|[^\p{L}])|-vous(?=$|[^\p{L}])|(^|[^\p{L}])(réessayez|rechargez|vérifiez|choisissez|ouvrez|créez|connectez|terminez|refaites|patientez|utilisez|acceptez|cochez|cliquez|revalidez|demandez|revenez|touchez|répartissez|gravez|ajoutez|sélectionnez|renseignez|veuillez|rédigez|déverrouillez|rouvrez|consultez|plantez|façonnez)(?=$|[^\p{L}])/iu;
  // Impératifs du tutoiement, restreints aux formes sans ambiguïté (« ouvre » est aussi un « il ouvre »).
  const TUTOIEMENT_PRONOMS =
    /(^|[^\p{L}])((tu|toi|ton|ta|tes|te)(?=$|[^\p{L}])|t[’'](?=\p{L}))|-toi(?=$|[^\p{L}])/iu;
  const TUTOIEMENT_IMPERATIFS =
    /(^|[^\p{L}])(réessaie|vérifie|choisis|refais|patiente|accepte|coche|clique|revalide|reviens|répartis|déverrouille|saisis|renseigne|prends)(?=$|[^\p{L}])/iu;

  for (const theme of ['grimoire-emeraude', 'atelier-cuivre'] as const) {
    it(`${theme} vouvoie partout — aucun « tu », « ton », « réessaie »… hors textes contractuels`, () => {
      for (const [key, value] of Object.entries(TONE_MAP[theme])) {
        if (isContractual(key)) continue;
        expect(TUTOIEMENT_PRONOMS.test(value), `${theme} / ${key} → ${value}`).toBe(false);
        expect(TUTOIEMENT_IMPERATIFS.test(value), `${theme} / ${key} → ${value}`).toBe(false);
      }
    });
  }

  it('foret-ancienne tutoie partout — aucun « vous », « votre », « réessayez »… hors textes contractuels', () => {
    for (const [key, value] of Object.entries(TONE_MAP['foret-ancienne'])) {
      if (isContractual(key)) continue;
      expect(VOUVOIEMENT.test(value), `foret-ancienne / ${key} → ${value}`).toBe(false);
      // Un impératif en « -ez » (hors « chez », « assez »…) trahit un vouvoiement.
      const imperatifs = (
        value.replace(/laissez-passer/gi, 'passe-droit').match(/[\p{L}]+ez(?![\p{L}])/giu) ?? []
      ).filter((mot) => !/^(chez|assez|nez|rez)$/i.test(mot));
      expect(imperatifs, `foret-ancienne / ${key} → ${value}`).toEqual([]);
    }
  });

  it('chaque thème parle son propre vocabulaire, sur une part substantielle du registre', () => {
    const univers: Record<Theme, RegExp> = {
      'grimoire-emeraude':
        /grimoire|parchemin|oracle|sceau|sortilège|missive|enlumin|chapitre|voyageur|compagnon|chronique|almanach|folio|conseil|proclam|inscri|scell|glose|coffre|maître|forg/i,
      'foret-ancienne':
        /sentier|forêt|clairière|cercle|écureuil|hibou|besace|carnet|étape|lune|racine|grav|plant|éveil|parole|guide|habitant|cueill|pécule|feuille|compagnon/i,
      'atelier-cuivre':
        /mission|opération|registre|automate|pneumatique|scrutin|consign|équipage|mécanicien|atelier|plaque|badge|composant|calibr|vapeur|purg|ingénieur|établi|fréquence|télégramme|assembl|soute|chargement|rouage/i,
    };
    // Story 48.1 : les textes neutres recensés (NEUTRAL_KEYS) sont hors thème PAR CONSTRUCTION — ils
    // n'entrent pas dans la part mesurée, sans quoi chaque lot de libellés de saisie ou de mesure
    // (ex. la Ludothèque) ferait passer un thème sous le seuil sans qu'aucune voix ne se soit perdue.
    for (const theme of THEMES) {
      const total = Object.entries(TONE_MAP[theme])
        .filter(([key]) => !NEUTRAL_KEYS.has(key))
        .map(([, value]) => value);
      const marques = total.filter((value) => univers[theme].test(value));
      expect(marques.length, `${theme} : ${marques.length}/${total.length}`).toBeGreaterThan(
        total.length * 0.35,
      );
    }
  });

  it('la connexion ne distingue jamais « compte inexistant » de « mot de passe incorrect »', () => {
    for (const theme of THEMES) {
      const text = TONE_MAP[theme]['auth.login_invalid'].toLowerCase();
      expect(text, theme).not.toMatch(/inexistant|introuvable|inconnu|n’existe pas|incorrect/);
      expect(text, theme).toContain('invalide');
    }
  });

  it('un lien invalide le dit, dans chaque thème (une erreur nomme sa cause)', () => {
    for (const theme of THEMES) {
      expect(TONE_MAP[theme]['common.lien_invalide'].toLowerCase(), theme).toContain('invalide');
      expect(
        TONE_MAP[theme][
          'common.lien_invalide_ou_expire_merci_de_refaire_une_demande'
        ].toLowerCase(),
        theme,
      ).toContain('expiré');
      expect(TONE_MAP[theme]['auth.rollback_error'].toLowerCase(), theme).toContain('expiré');
    }
  });

  // La boîte de conflit construit ces clés dynamiquement (`calendar.conflict_overwrite_${kind}_${n}`) :
  // aucune recherche de la clé complète ne les trouve, ce test est donc leur seule garde.
  it('les quatre phrases « Remplacer » de la boîte de conflit existent, non vides, dans chaque thème', () => {
    for (const theme of THEMES) {
      for (const kind of ['available', 'unavailable']) {
        for (const nombre of ['one', 'many']) {
          const key = `calendar.conflict_overwrite_${kind}_${nombre}`;
          expect(TONE_MAP[theme][key]?.trim(), `${theme} / ${key}`).toBeTruthy();
        }
      }
    }
  });

  it('le lien « mot de passe oublié » cité par le message de réinitialisation est celui du thème', () => {
    for (const theme of THEMES) {
      const lien = TONE_MAP[theme]['auth.login_forgot_link'];
      expect(TONE_MAP[theme]['auth.login_reset_required'], theme).toContain(`« ${lien} »`);
    }
  });

  it('les types de partie ont une seule série de libellés : `partie.kind_*`', () => {
    for (const theme of THEMES) {
      expect(
        Object.keys(TONE_MAP[theme]).filter((key) => key.startsWith('core.parties_kind_')),
      ).toEqual([]);
      for (const kind of ['ONE_SHOT', 'CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE']) {
        expect(TONE_MAP[theme][`partie.kind_${kind}`], `${theme} / ${kind}`).toBeTruthy();
      }
    }
  });

  it('le mot « vote » des paires d’état reste distinct : « Réponds au vote » ≠ « Vote en cours »', () => {
    for (const theme of THEMES) {
      expect(TONE_MAP[theme]['calendar.agenda.badge_answer_poll'], theme).not.toBe(
        TONE_MAP[theme]['calendar.agenda.badge_poll_open'],
      );
      // Le signal du tableau de bord reprend la même paire : jamais « Vote en attente ».
      expect(TONE_MAP[theme]['partie.signal_vote_en_cours_sans_reponse'], theme).not.toMatch(
        /en attente/i,
      );
    }
  });

  it('Story 38.2 : le formulaire en mode ralliement porte les libellés validés le 2026-10-11', () => {
    const attendu: Record<Theme, Record<string, string>> = {
      'grimoire-emeraude': {
        'partie.mode_ralliement': 'Ralliement',
        'partie.mode_quete': 'Quête',
        'partie.ralliement_kind_label': 'Nature du ralliement',
        'partie.ralliement_name_label': 'Nom du ralliement',
        'partie.ralliement_kind_ONE_SHOT': 'La conjonction des Esprits',
        'partie.ralliement_kind_CAMPAGNE_EPISODIQUE': 'La convergence des Sortilèges',
        'partie.ralliement_submit_btn': 'Convoquer le ralliement',
      },
      'foret-ancienne': {
        'partie.mode_ralliement': 'Veillée',
        'partie.mode_quete': 'Sentier',
        'partie.ralliement_kind_label': 'Nature de la veillée',
        'partie.ralliement_name_label': 'Nom de la veillée',
        'partie.ralliement_kind_ONE_SHOT': 'La halte au gué',
        'partie.ralliement_kind_CAMPAGNE_EPISODIQUE': 'La grande transhumance',
        'partie.ralliement_submit_btn': 'Allumer la veillée',
      },
      'atelier-cuivre': {
        'partie.mode_ralliement': 'Rassemblement',
        'partie.mode_quete': 'Mission',
        'partie.ralliement_kind_label': 'Régime du rassemblement',
        'partie.ralliement_name_label': 'Nom du rassemblement',
        'partie.ralliement_kind_ONE_SHOT': 'La réunion d’établi',
        'partie.ralliement_kind_CAMPAGNE_EPISODIQUE': 'Le grand chantier',
        'partie.ralliement_submit_btn': 'Monter le rassemblement',
      },
    };
    for (const theme of THEMES) {
      for (const [key, value] of Object.entries(attendu[theme])) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(value);
      }
      // Le groupe de la bascule est nommé (annoncé aux lecteurs d’écran).
      expect(TONE_MAP[theme]['partie.mode_label'], theme).toBeTruthy();
    }
  });

  // Story 38.4 : titres de formulaire et variantes de la page d'un ralliement (UX-DR17).
  const RALLIEMENT_PAGE_KEYS = [
    'partie.ralliement_save_error',
    'partie.ralliement_created_but_cover_failed',
    'partie.ralliement_new_title',
    'partie.ralliement_edit_title',
    'partie.ralliement_no_description',
    'partie.ralliement_status_closed_label',
    'identity.ralliement_homonymy_warning',
  ];

  it('Story 38.4 : les variantes de la page d’un ralliement existent, avec trois voix distinctes', () => {
    for (const key of RALLIEMENT_PAGE_KEYS) {
      const valeurs = THEMES.map((theme) => TONE_MAP[theme][key]);
      for (const [i, valeur] of valeurs.entries()) {
        expect(valeur, `${THEMES[i]} / ${key}`).toBeTruthy();
      }
      expect(new Set(valeurs).size, key).toBe(THEMES.length);
    }
  });

  it('Story 38.4 : aucun mot de JDR ni de quête dans les textes propres au ralliement', () => {
    const interdit = NON_JDR_BANNED_WORDS;
    for (const theme of THEMES) {
      const cles = Object.keys(TONE_MAP[theme]).filter(
        (key) => key.includes('ralliement') && !key.startsWith('partie.mode_'),
      );
      for (const key of cles) {
        expect(interdit.test(TONE_MAP[theme][key]), `${theme} / ${key}`).toBe(false);
      }
    }
  });

  it('Story 38.4 : les titres de création et de modification nomment le ralliement du thème', () => {
    const attendu: Record<Theme, [string, string]> = {
      'grimoire-emeraude': ['Nouveau ralliement', 'ralliement'],
      'foret-ancienne': ['Nouvelle veillée', 'veillée'],
      'atelier-cuivre': ['Nouveau rassemblement', 'rassemblement'],
    };
    for (const theme of THEMES) {
      const [creation, mot] = attendu[theme];
      expect(TONE_MAP[theme]['partie.ralliement_new_title'], theme).toBe(creation);
      expect(TONE_MAP[theme]['partie.ralliement_edit_title'], theme).toContain(mot);
    }
  });

  // Story 39.1 : l'onglet d'ouverture d'un groupe nomme les conjonctions avec les mots du thème.
  it('Story 39.1 : l’onglet des conjonctions d’un groupe a une voix par thème, sans mot de JDR', () => {
    const attendu: Record<Theme, [string, string]> = {
      'grimoire-emeraude': ['Conjonctions', 'Aucune conjonction pour l’instant'],
      'foret-ancienne': ['Haltes', 'Aucune halte pour l’instant'],
      'atelier-cuivre': ['Réunions', 'Aucune réunion pour l’instant'],
    };
    for (const theme of THEMES) {
      const [onglet, vide] = attendu[theme];
      expect(TONE_MAP[theme]['partie.ralliement_conjonctions_tab'], theme).toBe(onglet);
      expect(TONE_MAP[theme]['partie.ralliement_conjonctions_empty'], theme).toBe(vide);
      expect(TONE_MAP[theme]['partie.ralliement_conjonctions_upcoming'], theme).toBe('À venir');
      expect(TONE_MAP[theme]['partie.ralliement_conjonctions_past'], theme).toBe('Passées');
    }
  });

  // Story 41.1 : la page d'une rencontre isolée nomme son premier onglet au singulier avec les mots du
  // thème ; « Invités » / « Invitations » et la ligne de participation sont communs aux trois thèmes.
  it('Story 41.1 : les onglets d’une rencontre isolée ont une voix par thème, sans mot de JDR', () => {
    const attendu: Record<Theme, string> = {
      'grimoire-emeraude': 'Conjonction',
      'foret-ancienne': 'Halte',
      'atelier-cuivre': 'Réunion',
    };
    for (const theme of THEMES) {
      const tone = TONE_MAP[theme];
      expect(tone['partie.ralliement_soiree_tab'], theme).toBe(attendu[theme]);
      expect(tone['partie.ralliement_soiree_guests_tab'], theme).toBe('Invités');
      expect(tone['partie.ralliement_soiree_invitations_tab'], theme).toBe('Invitations');
      expect(tone['partie.ralliement_soiree_participation'], theme).toBe(
        'Sur invitation · pas de limite',
      );
    }
  });

  // Story 40.1 : la rencontre d'un groupe porte le nom du thème (Conjonction / Halte / Réunion) sur
  // le bouton, le titre de la fenêtre, le libellé du nom et le bouton de création ; les mots du
  // contrat d'UI (« Renoncer », « Tous les membres », « Places limitées », chips) sont identiques.
  it('Story 40.1 : la création d’une conjonction suit le thème, sans mot de JDR', () => {
    const attendu: Record<Theme, [string, string, string, string]> = {
      'grimoire-emeraude': [
        '+ Nouvelle conjonction',
        'Nouvelle conjonction',
        'Nom de la conjonction',
        'Créer la conjonction',
      ],
      'foret-ancienne': ['+ Nouvelle halte', 'Nouvelle halte', 'Nom de la halte', 'Créer la halte'],
      'atelier-cuivre': [
        '+ Nouvelle réunion',
        'Nouvelle réunion',
        'Nom de la réunion',
        'Créer la réunion',
      ],
    };
    for (const theme of THEMES) {
      const tone = TONE_MAP[theme];
      const [bouton, titre, nom, creer] = attendu[theme];
      expect(tone['partie.ralliement_event_new_btn'], theme).toBe(bouton);
      expect(tone['partie.ralliement_event_create_title'], theme).toBe(titre);
      expect(tone['partie.ralliement_event_name_label'], theme).toBe(nom);
      expect(tone['partie.ralliement_event_submit_btn'], theme).toBe(creer);
      expect(tone['partie.ralliement_event_cancel_btn'], theme).toBe('Renoncer');
      expect(tone['partie.ralliement_event_participation_all'], theme).toBe('Tous les membres');
      expect(tone['partie.ralliement_event_participation_limited'], theme).toBe('Places limitées');
      expect(tone['partie.ralliement_event_host'], theme).toContain('{name}');
      expect(tone['partie.ralliement_event_badge_in_days'], theme).toContain('{n}');
      for (const key of Object.keys(tone).filter((k) => k.startsWith('partie.ralliement_event_'))) {
        expect(NON_JDR_BANNED_WORDS.test(tone[key]), `${theme} / ${key}`).toBe(false);
      }
    }
    expect(TONE_MAP['foret-ancienne']['partie.ralliement_event_places_hint']).toBe(
      'places · tu es l’hôte (1 place)',
    );
    for (const key of [
      'partie.ralliement_event_create_error',
      'partie.ralliement_event_list_error',
    ]) {
      expect(new Set(THEMES.map((theme) => TONE_MAP[theme][key])).size, key).toBe(THEMES.length);
    }
  });

  // Story 40.2 : la fenêtre de détail d'une conjonction. Boutons, étiquettes de fiche et unités sont
  // identiques ; le nom de la rencontre, le panneau de situation, l'heure et « vous » ont une voix.
  it('Story 40.2 : la fenêtre de détail garde les mots du contrat et prend la voix du thème, sans mot de JDR', () => {
    const neutres: Record<string, string> = {
      'partie.ralliement_event_close_btn': 'Refermer',
      'partie.ralliement_event_edit_btn': 'Modifier',
      'partie.ralliement_event_save_btn': 'Enregistrer',
      'partie.ralliement_event_cancel_btn': 'Renoncer',
      'partie.ralliement_admin_badge': 'Admin',
    };
    for (const [key, attendu] of Object.entries(neutres)) {
      for (const theme of THEMES) expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(attendu);
    }
    const voix = [
      'partie.ralliement_event_edit_title',
      'partie.ralliement_event_update_error',
      'partie.ralliement_event_sheet_heading',
      'partie.ralliement_event_situation_host',
      'partie.ralliement_event_situation_host_past',
      'partie.ralliement_event_situation_registered',
      'partie.ralliement_event_situation_registered_past',
      'partie.ralliement_event_situation_none',
      'partie.ralliement_event_situation_none_past',
    ];
    for (const key of voix) {
      const valeurs = THEMES.map((theme) => TONE_MAP[theme][key]);
      expect(new Set(valeurs).size, key).toBe(THEMES.length);
    }
    // « Rendez-vous à » reste commun au Grimoire et à l'Atelier ; seule la forêt dit « Retrouvailles ».
    expect(TONE_MAP['foret-ancienne']['partie.ralliement_event_panel_time']).toBe(
      'Retrouvailles à {time}',
    );
    expect(TONE_MAP['grimoire-emeraude']['partie.ralliement_event_edit_title']).toBe(
      'Modifier la conjonction',
    );
    expect(TONE_MAP['foret-ancienne']['partie.ralliement_event_edit_title']).toBe(
      'Modifier la halte',
    );
    expect(TONE_MAP['atelier-cuivre']['partie.ralliement_event_edit_title']).toBe(
      'Modifier la réunion',
    );
    for (const theme of THEMES) {
      expect(TONE_MAP[theme]['partie.ralliement_event_panel_time'], theme).toContain('{time}');
      for (const key of ['place', 'registered', 'free']) {
        expect(TONE_MAP[theme][`partie.ralliement_event_unit_${key}`], theme).toMatch(
          /^[^|]+\|[^|]+$/,
        );
      }
    }
    expect(TONE_MAP['foret-ancienne']['partie.ralliement_event_situation_host']).toBe(
      'Tu es l’hôte de cette halte.',
    );
  });

  // Story 40.3 : s'inscrire à une conjonction et s'en désinscrire. Les trois mots du contrat sont
  // identiques ; l'état « Complet » écrit dans le panneau et les replis d'erreur ont une voix.
  it('Story 40.3 : inscription et désinscription gardent les mots du contrat et prennent la voix du thème, sans mot de JDR', () => {
    const neutres: Record<string, string> = {
      'partie.ralliement_event_signup_btn': 'S’inscrire',
      'partie.ralliement_event_unsubscribe_btn': 'Me désinscrire',
      'partie.ralliement_event_badge_full': 'Complet',
    };
    for (const [key, attendu] of Object.entries(neutres)) {
      for (const theme of THEMES) expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(attendu);
    }
    const voix = [
      'partie.ralliement_event_situation_full',
      'partie.ralliement_event_signup_error',
      'partie.ralliement_event_unsubscribe_error',
    ];
    for (const key of voix) {
      const valeurs = THEMES.map((theme) => TONE_MAP[theme][key]);
      expect(new Set(valeurs).size, key).toBe(THEMES.length);
      for (const valeur of valeurs) expect(valeur, key).not.toMatch(NON_JDR_BANNED_WORDS);
    }
    for (const key of [...Object.keys(neutres), ...voix]) {
      for (const theme of THEMES) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).not.toMatch(NON_JDR_BANNED_WORDS);
      }
    }
    expect(TONE_MAP['foret-ancienne']['partie.ralliement_event_situation_full']).toBe(
      'Complet : toutes les places de cette halte sont prises.',
    );
  });

  // Story 40.4 : réserver une place à des membres. Les mots du contrat sont identiques dans les trois
  // thèmes ; la situation de la personne réservée, le signal d'accueil et les replis d'erreur ont une voix.
  it('Story 40.4 : la réservation de place garde les mots du contrat et prend la voix du thème, sans mot de JDR', () => {
    const neutres: Record<string, string> = {
      'partie.ralliement_event_chip_reserved': 'Place réservée',
      'partie.ralliement_event_accept_btn': 'Accepter',
      'partie.ralliement_event_decline_btn': 'Décliner',
      'partie.ralliement_event_reserve_label': 'Réserver une place à des membres',
      'partie.ralliement_event_unreserve_btn': 'Retirer la réservation',
    };
    for (const [key, attendu] of Object.entries(neutres)) {
      for (const theme of THEMES) expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(attendu);
    }
    const voix = [
      'partie.signal_reservation_a_confirmer',
      'partie.ralliement_event_situation_reserved',
      'partie.ralliement_event_situation_reserved_past',
      'partie.ralliement_event_accept_error',
      'partie.ralliement_event_decline_error',
      'partie.ralliement_event_reserve_error',
      'partie.ralliement_event_unreserve_error',
    ];
    for (const key of voix) {
      const valeurs = THEMES.map((theme) => TONE_MAP[theme][key]);
      expect(new Set(valeurs).size, key).toBe(THEMES.length);
    }
    for (const key of [...Object.keys(neutres), ...voix]) {
      for (const theme of THEMES) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).not.toMatch(NON_JDR_BANNED_WORDS);
      }
    }
    for (const theme of THEMES) {
      expect(TONE_MAP[theme]['partie.ralliement_event_reserve_chip_aria'], theme).toContain(
        '{name}',
      );
      expect(TONE_MAP[theme]['partie.ralliement_event_unreserve_aria'], theme).toContain('{name}');
      // Le texte de l’hôte reste lisible en toutes lettres : « <nom> — invité·e, n’a pas encore accepté ».
      expect(TONE_MAP[theme]['partie.ralliement_event_pending_text'], theme).toBe(
        '{name} — invité·e, n’a pas encore accepté',
      );
    }
    expect(TONE_MAP['foret-ancienne']['partie.ralliement_event_situation_reserved']).toBe(
      'Une place t’est gardée à cette halte : accepte-la ou décline-la.',
    );
  });

  // Story 40.5 : proposer une conjonction par sondage de dates. Les libellés du contrat d'UI (« Vote en
  // cours », « Vote à faire », « Date à voter · jusqu'au », « Le vote se termine le », « Meilleur
  // créneau… », « Réponses : x sur N », « N'ont pas encore répondu ») sont identiques dans les trois
  // thèmes ; les phrases adressées à la personne (panneaux membre et hôte) ont une voix. Aucun mot de JDR.
  it('Story 40.5 : le sondage de dates garde les mots du contrat et prend la voix du thème, sans mot de JDR', () => {
    const neutres: Record<string, string> = {
      'partie.ralliement_event_badge_poll': 'Vote en cours',
      'partie.ralliement_event_chip_vote_todo': 'Vote à faire',
      'partie.ralliement_event_poll_date_line': 'Date à voter · jusqu’au {date}',
      'partie.ralliement_event_poll_deadline_label': 'Le vote se termine le',
      'partie.ralliement_event_poll_add_btn': 'Ajouter',
      'partie.ralliement_event_poll_best': 'Meilleur créneau pour l’instant : {date} — {n} oui',
      'partie.ralliement_event_poll_host_answers': 'Réponses : {x} sur {n}',
      'partie.ralliement_event_poll_host_waiting': 'N’ont pas encore répondu : {names}',
    };
    for (const [key, attendu] of Object.entries(neutres)) {
      for (const theme of THEMES) expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(attendu);
    }
    const voix = [
      'partie.ralliement_event_poll_member_todo',
      'partie.ralliement_event_poll_my_answers',
      'partie.ralliement_event_poll_member_voted',
      'partie.ralliement_event_poll_host_summary',
      'partie.ralliement_event_poll_not_eligible',
    ];
    for (const key of voix) {
      const valeurs = THEMES.map((theme) => TONE_MAP[theme][key]);
      // Au moins deux voix distinctes (le Grimoire et l'Atelier vouvoient, la forêt tutoie).
      expect(new Set(valeurs).size, key).toBeGreaterThan(1);
    }
    // Le contrat d'UI, mot pour mot, dans le Grimoire (vouvoiement) ; tutoiement dans la forêt.
    expect(TONE_MAP['grimoire-emeraude']['partie.ralliement_event_poll_member_todo']).toBe(
      'Vote à faire. Vous êtes inscrit·e : donnez vos disponibilités avant le {date}.',
    );
    expect(TONE_MAP['grimoire-emeraude']['partie.ralliement_event_poll_host_summary']).toBe(
      'Vous êtes l’hôte. Le vote se termine {when} — {n} créneaux proposés.',
    );
    expect(TONE_MAP['foret-ancienne']['partie.ralliement_event_poll_member_todo']).toBe(
      'Vote à faire. Tu es inscrit·e : donne tes disponibilités avant le {date}.',
    );
    for (const theme of THEMES) {
      const tone = TONE_MAP[theme];
      expect(tone['partie.ralliement_event_poll_member_todo'], theme).toContain('{date}');
      expect(tone['partie.ralliement_event_poll_host_summary'], theme).toContain('{when}');
      expect(tone['partie.ralliement_event_poll_my_answers'], theme).toMatch(/\{x\}.*\{n\}/);
      for (const unit of ['slot', 'available']) {
        expect(tone[`partie.ralliement_event_unit_${unit}`], theme).toMatch(/^[^|]+\|[^|]+$/);
      }
    }
    for (const key of Object.keys(TONE_MAP['grimoire-emeraude']).filter((k) =>
      k.startsWith('partie.ralliement_event_poll_'),
    )) {
      for (const theme of THEMES) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).not.toMatch(NON_JDR_BANNED_WORDS);
      }
    }
  });

  // Story 40.5b : le calendrier du groupe. Les liens et boutons du contrat d'UI sont identiques dans les
  // trois thèmes ; le nom de la rencontre, le tutoiement et les raisons du mode « composer » ont une
  // voix. Aucun mot de JDR.
  it('Story 40.5b : le calendrier du groupe garde les mots du contrat et prend la voix du thème, sans mot de JDR', () => {
    const neutres: Record<string, string> = {
      'partie.ralliement_calendar_link': 'Calendrier du groupe',
      'partie.ralliement_event_poll_calendar_btn': 'Choisir les créneaux dans le calendrier',
      'partie.ralliement_event_vote_in_calendar_btn': 'Voter dans le calendrier',
      'partie.ralliement_event_compose_in_calendar_btn': 'Composer les créneaux',
    };
    for (const [key, attendu] of Object.entries(neutres)) {
      for (const theme of THEMES) expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(attendu);
    }
    const voix = [
      'partie.ralliement_calendar_compose_target_poll',
      'partie.ralliement_calendar_compose_target_new',
      'partie.ralliement_calendar_compose_full_day',
      'partie.ralliement_calendar_compose_save_error',
      'partie.ralliement_calendar_compose_stale_voters',
      'partie.ralliement_calendar_events_error',
      'partie.ralliement_calendar_polls_empty',
      'partie.ralliement_calendar_confirm_title',
      'partie.ralliement_calendar_confirm_warning_one',
      'partie.ralliement_calendar_confirm_warning_many',
    ];
    for (const key of voix) {
      const valeurs = THEMES.map((theme) => TONE_MAP[theme][key]);
      expect(new Set(valeurs).size, key).toBe(THEMES.length);
    }
    // Les trous des gabarits du mode « composer » et du panneau des votes.
    for (const theme of THEMES) {
      const tone = TONE_MAP[theme];
      expect(tone['partie.ralliement_calendar_compose_target_poll'], theme).toContain('{title}');
      expect(tone['partie.ralliement_calendar_poll_can_vote'], theme).toContain('{date}');
      expect(tone['partie.ralliement_calendar_confirm_warning_many'], theme).toMatch(
        /{slots}.*{votes}/,
      );
    }
    // La raison du refus d'une journée entière nomme les trois créneaux permis.
    for (const theme of THEMES) {
      const raison = TONE_MAP[theme]['partie.ralliement_calendar_compose_full_day'];
      expect(raison, theme).toMatch(/matin/);
      expect(raison, theme).toMatch(/après-midi/);
      expect(raison, theme).toMatch(/soir/);
    }
    for (const key of Object.keys(TONE_MAP['grimoire-emeraude']).filter(
      (k) =>
        k.startsWith('partie.ralliement_calendar_') ||
        [
          'partie.ralliement_event_poll_calendar_btn',
          'partie.ralliement_event_vote_in_calendar_btn',
          'partie.ralliement_event_compose_in_calendar_btn',
        ].includes(k),
    )) {
      for (const theme of THEMES) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).not.toMatch(NON_JDR_BANNED_WORDS);
      }
    }
  });

  // Story 40.6 : fixer la date d'une conjonction. Les mots du contrat d'UI (« Fixer la date… », le décompte
  // « n oui · n peut-être · n non », l'avertissement de sceau) sont identiques dans les trois thèmes ; le
  // repli d'erreur nomme la rencontre à la manière du thème. Aucun mot de JDR.
  it('Story 40.6 : « Fixer la date » garde les mots du contrat et prend la voix du thème pour l’erreur, sans mot de JDR', () => {
    const neutres: Record<string, string> = {
      'partie.ralliement_event_fix_date_btn': 'Fixer la date…',
      'partie.ralliement_event_fix_confirm_btn': 'Fixer la date',
      'partie.ralliement_event_fix_heading':
        'Fixer la date — « {title} » : les créneaux, du plus au moins plébiscité',
      'partie.ralliement_event_fix_counts': '{yes} oui · {maybe} peut-être · {no} non',
      'partie.ralliement_event_fix_past': 'Jour passé : ce créneau ne peut plus être retenu',
      'partie.ralliement_event_fix_warning':
        'La date sera scellée et les inscrits prévenus par e-mail. Elle ne pourra plus être rouverte ; les inscriptions tardives restent possibles.',
    };
    for (const [key, attendu] of Object.entries(neutres)) {
      for (const theme of THEMES) expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(attendu);
    }
    const erreurs = THEMES.map(
      (theme) => TONE_MAP[theme]['partie.ralliement_event_fix_date_error'],
    );
    expect(new Set(erreurs).size).toBe(THEMES.length);
    // « Renoncer » (annulation) et « Votre accord » (titre) existent déjà dans chaque thème.
    for (const theme of THEMES) {
      expect(TONE_MAP[theme]['partie.ralliement_event_cancel_btn'], theme).toBe('Renoncer');
      expect(TONE_MAP[theme]['parties.confirm_title'], theme).toBeTruthy();
    }
    for (const key of Object.keys(TONE_MAP['grimoire-emeraude']).filter((k) =>
      k.startsWith('partie.ralliement_event_fix_'),
    )) {
      for (const theme of THEMES) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).not.toMatch(NON_JDR_BANNED_WORDS);
      }
    }
  });

  // Story 42.1 : annuler une conjonction. Le mot « Annulée », le titre de la confirmation et son avertissement
  // sont identiques dans les trois thèmes ; les boutons, le constat de la fenêtre et le repli d'erreur nomment
  // la rencontre à la manière du thème. Aucun mot de JDR.
  it('Story 42.1 : « Annuler » garde « Annulée » et l’avertissement, et prend la voix du thème pour le bouton, le constat et l’erreur, sans mot de JDR', () => {
    const neutres: Record<string, string> = {
      'partie.ralliement_event_badge_cancelled': 'Annulée',
      'partie.ralliement_event_cancel_event_heading': 'Annuler « {title} » ?',
      'partie.ralliement_event_cancel_event_warning':
        'Les inscrits seront prévenus par e-mail. Cette action est définitive.',
    };
    for (const [key, attendu] of Object.entries(neutres)) {
      for (const theme of THEMES) expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(attendu);
    }
    for (const key of [
      'partie.ralliement_event_cancel_event_btn',
      'partie.ralliement_event_cancel_event_confirm_btn',
      'partie.ralliement_event_cancelled_text',
      'partie.ralliement_event_cancel_event_error',
    ]) {
      const voix = THEMES.map((theme) => TONE_MAP[theme][key]);
      expect(new Set(voix).size, key).toBe(THEMES.length);
    }
    expect(TONE_MAP['grimoire-emeraude']['partie.ralliement_event_cancel_event_btn']).toBe(
      'Annuler la conjonction',
    );
    for (const key of Object.keys(TONE_MAP['grimoire-emeraude']).filter(
      (k) =>
        k.startsWith('partie.ralliement_event_cancel_event_') ||
        k === 'partie.ralliement_event_cancelled_text' ||
        k === 'partie.ralliement_event_badge_cancelled',
    )) {
      for (const theme of THEMES) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).not.toMatch(NON_JDR_BANNED_WORDS);
      }
    }
  });

  // Story 40.7 : prolonger le vote d'une conjonction. Les mots du contrat d'UI (« Prolonger le vote », « Nouvelle
  // échéance », l'avertissement de relance) sont identiques dans les trois thèmes ; le repli d'erreur nomme la
  // rencontre à la manière du thème. Aucun mot de JDR.
  it('Story 40.7 : « Prolonger le vote » garde les mots du contrat et prend la voix du thème pour l’erreur, sans mot de JDR', () => {
    const neutres: Record<string, string> = {
      'partie.ralliement_event_extend_btn': 'Prolonger le vote',
      'partie.ralliement_event_extend_confirm_btn': 'Prolonger',
      'partie.ralliement_event_extend_heading': '« {title} » — le vote se termine le {date}.',
      'partie.ralliement_event_extend_field': 'Nouvelle échéance',
      'partie.ralliement_event_extend_warning':
        'Les personnes qui n’ont pas encore voté seront relancées la veille de la nouvelle échéance.',
    };
    for (const [key, attendu] of Object.entries(neutres)) {
      for (const theme of THEMES) expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(attendu);
    }
    const erreurs = THEMES.map((theme) => TONE_MAP[theme]['partie.ralliement_event_extend_error']);
    expect(new Set(erreurs).size).toBe(THEMES.length);
    // « Renoncer » (annulation) et « Votre accord » (titre) existent déjà dans chaque thème.
    for (const theme of THEMES) {
      expect(TONE_MAP[theme]['partie.ralliement_event_cancel_btn'], theme).toBe('Renoncer');
      expect(TONE_MAP[theme]['parties.confirm_title'], theme).toBeTruthy();
    }
    for (const key of Object.keys(TONE_MAP['grimoire-emeraude']).filter((k) =>
      k.startsWith('partie.ralliement_event_extend_'),
    )) {
      for (const theme of THEMES) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).not.toMatch(NON_JDR_BANNED_WORDS);
      }
    }
  });

  // Story 39.3 : variantes « groupe » des outils d'invitation et de l'écran d'un lien d'invitation.
  const GROUPE_INVITATION_KEYS = [
    'partie.ralliement_invite_title',
    'partie.ralliement_search_label',
    'partie.ralliement_invite_btn',
    'partie.ralliement_invite_by_email_label',
    'partie.ralliement_links_title',
    'partie.ralliement_generate_link',
    'partie.ralliement_remove_member_confirm',
    'partie.ralliement_remove_member_error',
    'join.ralliement_title',
    'join.ralliement_login_or_register',
    'join.ralliement_join_btn',
    'join.ralliement_join_error',
  ];

  it('Story 39.3 : les variantes d’invitation d’un groupe existent, avec trois voix et sans mot de JDR', () => {
    for (const key of GROUPE_INVITATION_KEYS) {
      const valeurs = THEMES.map((theme) => TONE_MAP[theme][key]);
      for (const [i, valeur] of valeurs.entries()) {
        expect(valeur, `${THEMES[i]} / ${key}`).toBeTruthy();
        expect(NON_JDR_BANNED_WORDS.test(valeur), `${THEMES[i]} / ${key}`).toBe(false);
      }
      expect(new Set(valeurs).size, key).toBe(THEMES.length);
    }
  });

  // Story 39.4 : administrateurs d'un groupe. Les mots du contrat d'UI (badge, boutons, confirmations
  // courtes) sont identiques dans les trois thèmes ; l'avertissement du dernier administrateur et le
  // repli d'erreur ont une voix par thème. Aucun mot de JDR nulle part, mêmes trous partout.
  const ADMINS_NEUTRES: Record<string, string> = {
    'partie.ralliement_admin_badge': 'Admin',
    'partie.ralliement_appoint_btn': 'Nommer admin',
    'partie.ralliement_step_down_btn': 'Quitter l’office',
    'partie.ralliement_last_admin_btn': 'Quitter et supprimer',
  };
  const ADMINS_VOIX = ['partie.ralliement_last_admin_confirm', 'partie.ralliement_role_error'];

  it('Story 39.4 : les mots du contrat d’UI des administrateurs sont identiques et sans mot de JDR', () => {
    for (const [key, attendu] of Object.entries(ADMINS_NEUTRES)) {
      for (const theme of THEMES) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(attendu);
        expect(NON_JDR_BANNED_WORDS.test(TONE_MAP[theme][key]), `${theme} / ${key}`).toBe(false);
      }
    }
  });

  it('Story 39.4 : l’avertissement du dernier administrateur et le repli d’erreur ont une voix par thème', () => {
    for (const key of ADMINS_VOIX) {
      const valeurs = THEMES.map((theme) => TONE_MAP[theme][key]);
      for (const [i, valeur] of valeurs.entries()) {
        expect(valeur, `${THEMES[i]} / ${key}`).toBeTruthy();
        expect(NON_JDR_BANNED_WORDS.test(valeur), `${THEMES[i]} / ${key}`).toBe(false);
      }
      expect(new Set(valeurs).size, key).toBe(THEMES.length);
    }
  });

  it('Story 39.4 : « quitter l’office » garde le texte du contrat, tutoyé dans la forêt', () => {
    const contrat =
      'Quitter l’office d’administrateur de « {partie} » ? Vous restez membre du groupe.';
    expect(TONE_MAP['grimoire-emeraude']['partie.ralliement_step_down_confirm']).toBe(contrat);
    expect(TONE_MAP['atelier-cuivre']['partie.ralliement_step_down_confirm']).toBe(contrat);
    expect(TONE_MAP['foret-ancienne']['partie.ralliement_step_down_confirm']).toBe(
      contrat.replace('Vous restez', 'Tu restes'),
    );
  });

  it('Story 39.4 : les confirmations gardent leurs trous dans les trois thèmes', () => {
    for (const theme of THEMES) {
      const tone = TONE_MAP[theme];
      expect(tone['partie.ralliement_appoint_confirm'], theme).toContain('{name}');
      expect(tone['partie.ralliement_appoint_confirm'], theme).toContain('{partie}');
      expect(tone['partie.ralliement_step_down_confirm'], theme).toContain('{partie}');
      for (const trou of ['{partie}', '{members}', '{conjonctions}']) {
        expect(tone['partie.ralliement_last_admin_confirm'], theme).toContain(trou);
      }
    }
  });

  // Story 39.5 : quitter un groupe. Bouton identique dans les trois thèmes, confirmation verbatim du
  // contrat (tutoyée dans la forêt), repli d'erreur avec une voix par thème. Aucun mot de JDR.
  it('Story 39.5 : « Quitter le groupe » garde les mots du contrat, sans mot de JDR', () => {
    const contrat =
      'Quitter « {partie} » ? Vous n’en ferez plus partie ; un administrateur devra vous inviter à nouveau pour revenir.';
    for (const theme of THEMES) {
      const tone = TONE_MAP[theme];
      expect(tone['partie.ralliement_leave_btn'], theme).toBe('Quitter le groupe');
      for (const key of [
        'partie.ralliement_leave_btn',
        'partie.ralliement_leave_confirm',
        'partie.ralliement_leave_error',
      ]) {
        expect(tone[key], `${theme} / ${key}`).toBeTruthy();
        expect(NON_JDR_BANNED_WORDS.test(tone[key]), `${theme} / ${key}`).toBe(false);
      }
      expect(tone['partie.ralliement_leave_confirm'], theme).toContain('{partie}');
    }
    expect(TONE_MAP['grimoire-emeraude']['partie.ralliement_leave_confirm']).toBe(contrat);
    expect(TONE_MAP['atelier-cuivre']['partie.ralliement_leave_confirm']).toBe(contrat);
    expect(TONE_MAP['foret-ancienne']['partie.ralliement_leave_confirm']).toBe(
      'Quitter « {partie} » ? Tu n’en feras plus partie ; un administrateur devra t’inviter à nouveau pour revenir.',
    );
    const erreurs = THEMES.map((theme) => TONE_MAP[theme]['partie.ralliement_leave_error']);
    expect(new Set(erreurs).size).toBe(THEMES.length);
  });

  it('Story 39.3 : les gabarits de l’écran de lien et de retrait gardent leurs trous', () => {
    for (const theme of THEMES) {
      expect(TONE_MAP[theme]['join.ralliement_title'], theme).toContain('{name}');
      expect(TONE_MAP[theme]['partie.ralliement_remove_member_confirm'], theme).toContain('{name}');
      expect(TONE_MAP[theme]['partie.ralliement_remove_member_confirm'], theme).toContain(
        '{partie}',
      );
    }
  });

  // Story 38.5 : filtres « Genre » / « Rang » étendu, regroupement par type et rôles d'un ralliement.
  it('Story 38.5 : les genres de la liste ont une voix par thème, et les rôles du ralliement leurs mots de travail', () => {
    const genres: Record<Theme, [string, string]> = {
      'grimoire-emeraude': ['Quêtes', 'Ralliements'],
      'foret-ancienne': ['Sentiers', 'Veillées'],
      'atelier-cuivre': ['Missions', 'Rassemblements'],
    };
    for (const theme of THEMES) {
      const tone = TONE_MAP[theme];
      expect(tone['dashboard.genre_quetes'], theme).toBe(genres[theme][0]);
      expect(tone['dashboard.genre_ralliements'], theme).toBe(genres[theme][1]);
      expect(tone['dashboard.filter_genre_label'], theme).toBe('Genre');
      expect(tone['dashboard.group_by_type_label'], theme).toBe('Grouper par type');
      expect(tone['dashboard.role_ralliement_host'], theme).toBe('Hôte');
      expect(tone['dashboard.role_ralliement_guest'], theme).toBe('Invité');
      expect(tone['dashboard.role_ralliement_admin'], theme).toBe('Admin');
      expect(tone['dashboard.role_ralliement_member'], theme).toBe('Membre');
    }
  });
});

// Story 44.3 — la liste des destinées (puce ✦). Le mode soirée l'affiche : aucun mot du JDR, ni « partie ».
describe('Tones — la liste des destinées (Story 44.3)', () => {
  const KEYS = Object.keys(TONE_MAP['grimoire-emeraude']).filter(
    (key) =>
      key.startsWith('calendar.destiny_list_') ||
      key.startsWith('calendar.destiny_row_') ||
      key.startsWith('calendar.destiny_state_') ||
      key === 'calendar.destiny_quit',
  );

  it('onze clés, présentes dans les trois thèmes, sans mot du JDR ni « partie »', () => {
    expect(KEYS).toHaveLength(11);
    for (const theme of THEMES) {
      for (const key of KEYS) {
        const value = TONE_MAP[theme][key];
        expect(value, `${theme} / ${key}`).toBeTruthy();
        expect(value, `${theme} / ${key}`).not.toMatch(NON_JDR_BANNED_WORDS);
        expect(value.toLowerCase(), `${theme} / ${key}`).not.toContain('partie');
      }
    }
  });

  it('les quatre pastilles d’état suivent EXPERIENCE §3.2', () => {
    const attendu: Record<Theme, string[]> = {
      'grimoire-emeraude': ['À faire', 'Répondu', 'Organisateur', 'Vous ne votez pas'],
      'foret-ancienne': ['À faire', 'Répondu', 'Organisateur', 'Tu ne votes pas'],
      'atelier-cuivre': ['À traiter', 'Consigné', 'Organisateur', 'Non votant'],
    };
    for (const theme of THEMES) {
      const tone = TONE_MAP[theme];
      expect(
        ['todo', 'answered', 'organizer', 'not_voting'].map(
          (s) => tone[`calendar.destiny_state_${s}`],
        ),
        theme,
      ).toEqual(attendu[theme]);
    }
  });
});

// Story 44.4 — le plateau de la destinée. Le mode soirée l'affiche : aucun mot du JDR, ni « partie ».
describe('Tones — le plateau de la destinée (Story 44.4)', () => {
  const KEYS = Object.keys(TONE_MAP['grimoire-emeraude']).filter((key) =>
    key.startsWith('calendar.destiny_board_'),
  );

  it('onze clés, présentes dans les trois thèmes, sans mot du JDR ni « partie »', () => {
    expect(KEYS).toHaveLength(11);
    for (const theme of THEMES) {
      for (const key of KEYS) {
        const value = TONE_MAP[theme][key];
        expect(value, `${theme} / ${key}`).toBeTruthy();
        expect(value, `${theme} / ${key}`).not.toMatch(NON_JDR_BANNED_WORDS);
        expect(value.toLowerCase(), `${theme} / ${key}`).not.toContain('partie');
      }
    }
  });

  it('les chevrons parlent de créneaux, plus de votes', () => {
    for (const theme of THEMES) {
      expect(TONE_MAP[theme]['calendar.destiny_prev_aria'], theme).not.toMatch(
        /conseil|scrutin|cercle/i,
      );
      expect(TONE_MAP[theme]['calendar.destiny_next_aria'], theme).not.toMatch(
        /conseil|scrutin|cercle/i,
      );
    }
  });
});

// Story 44.5 — le tiroir de la destinée. Le mode soirée l'affiche : aucun mot du JDR, ni « partie ».
describe('Tones — le tiroir de la destinée (Story 44.5)', () => {
  const KEYS = Object.keys(TONE_MAP['grimoire-emeraude']).filter((key) =>
    key.startsWith('calendar.destiny_sheet_'),
  );

  it('sept clés, présentes dans les trois thèmes, sans mot du JDR ni « partie »', () => {
    expect(KEYS).toHaveLength(7);
    for (const theme of THEMES) {
      for (const key of KEYS) {
        const value = TONE_MAP[theme][key];
        expect(value, `${theme} / ${key}`).toBeTruthy();
        expect(value, `${theme} / ${key}`).not.toMatch(NON_JDR_BANNED_WORDS);
        expect(value.toLowerCase(), `${theme} / ${key}`).not.toContain('partie');
      }
    }
  });

  it('les gabarits portent leurs variables', () => {
    for (const theme of THEMES) {
      const tone = TONE_MAP[theme];
      expect(tone['calendar.destiny_sheet_region'], theme).toContain('{name}');
      expect(tone['calendar.destiny_sheet_deadline_open'], theme).toContain('{date}');
      expect(tone['calendar.destiny_sheet_dates_many'], theme).toContain('{n}');
    }
  });
});

// Story 44.6 — les messages de fermeture de la Destinée. Le mode soirée les affiche : aucun mot du JDR, ni « partie ».
describe('Tones — la fermeture de la Destinée (Story 44.6)', () => {
  const KEYS = Object.keys(TONE_MAP['grimoire-emeraude']).filter(
    (key) =>
      key.startsWith('calendar.destiny_closed_') ||
      key === 'calendar.destiny_notice_dismiss' ||
      key === 'calendar.destiny_link_unknown',
  );

  it('six clés, présentes dans les trois thèmes, sans mot du JDR ni « partie »', () => {
    expect(KEYS).toHaveLength(6);
    for (const theme of THEMES) {
      for (const key of KEYS) {
        const value = TONE_MAP[theme][key];
        expect(value, `${theme} / ${key}`).toBeTruthy();
        expect(value, `${theme} / ${key}`).not.toMatch(NON_JDR_BANNED_WORDS);
        expect(value.toLowerCase(), `${theme} / ${key}`).not.toContain('partie');
      }
    }
  });

  it('les messages du Grimoire suivent la table EXPERIENCE §5.1', () => {
    const tone = TONE_MAP['grimoire-emeraude'];
    expect(tone['calendar.destiny_closed_fixed']).toBe('Ce vote est clos : sa date est fixée.');
    expect(tone['calendar.destiny_closed_cancelled']).toBe(
      'Ce vote est clos : le rendez-vous est annulé.',
    );
    expect(tone['calendar.destiny_closed_generic']).toBe('Ce vote est clos.');
    expect(tone['calendar.destiny_closed_gone']).toBe('Ce vote n’est plus ouvert.');
  });
});

// Story 44.8 — le filtre par partie de « Affichage ». Le mode soirée l'affiche : aucun mot du JDR, ni « partie ».
describe('Tones — le filtre par partie (Story 44.8)', () => {
  it('le titre de la section a une voix par thème, sans mot du JDR ni « partie »', () => {
    const voices = new Set<string>();
    for (const theme of THEMES) {
      const value = TONE_MAP[theme]['calendar.display.section_parties'];
      expect(value, theme).toBeTruthy();
      expect(value, theme).not.toMatch(NON_JDR_BANNED_WORDS);
      expect(value.toLowerCase(), theme).not.toContain('partie');
      voices.add(value);
    }
    expect(voices.size).toBe(3);
  });
});

// Story 45.7 — les lignes en clair du formulaire de création : une seule voix pour les trois thèmes, et aucun mot du
// JDR (ni « partie ») dans celles du mode soirée.
describe('Tones — lignes en clair du formulaire de création (Story 45.7)', () => {
  const PLAIN = [
    'partie.mode_plain_quete',
    'partie.mode_plain_ralliement',
    'partie.kind_plain_ONE_SHOT',
    'partie.kind_plain_CAMPAGNE_LINEAIRE',
    'partie.kind_plain_CAMPAGNE_EPISODIQUE',
    'partie.ralliement_kind_plain_ONE_SHOT',
    'partie.ralliement_kind_plain_CAMPAGNE_EPISODIQUE',
  ];
  const SOIREE = PLAIN.filter((k) => k.includes('ralliement'));
  const JDR_WORDS =
    /(^|[^\p{L}])(mj|campagnes?|sc[ée]narios?|s[ée]ances?|joueurs?|qu[êe]tes?|troupe|parties?)(?=$|[^\p{L}])/iu;

  it.each(PLAIN)('%s : le même texte dans les trois thèmes, jamais vide', (key) => {
    const texts = THEMES.map((theme) => TONE_MAP[theme][key]);
    expect(texts[0], key).toBeTruthy();
    expect(new Set(texts).size, key).toBe(1);
  });

  it.each(SOIREE)('%s : aucun mot du JDR ni « partie »', (key) => {
    expect(JDR_WORDS.test(TONE_MAP['grimoire-emeraude'][key]), key).toBe(false);
  });

  it('les lignes du JDR gardent leurs mots (garde-fou du test précédent)', () => {
    expect(JDR_WORDS.test(TONE_MAP['grimoire-emeraude']['partie.kind_plain_ONE_SHOT'])).toBe(true);
  });
});

// Story 46.1 — la section des fenêtres de l'automate : « destinée » ne désigne plus que le mode ; les boutons de la
// colonne de droite disent la même chose dans les trois thèmes.
describe("Tones — fenêtres de l'automate et colonne de droite (Story 46.1)", () => {
  it('section.slots : un nom par thème, sans « destinée »', () => {
    expect(TONE_MAP['grimoire-emeraude']['section.slots']).toBe('Éphémérides');
    expect(TONE_MAP['foret-ancienne']['section.slots']).toBe('Clairières disponibles');
    expect(TONE_MAP['atelier-cuivre']['section.slots']).toBe("Créneaux calculés par l'automate");
    for (const theme of THEMES) expect(TONE_MAP[theme]['section.slots']).not.toMatch(/destin/i);
  });

  it.each([
    'calendar.column_dock',
    'calendar.column_reopen',
    'calendar.window_add',
    'calendar.window_hide',
    'calendar.window_unhide',
  ])('%s : le même texte dans les trois thèmes', (key) => {
    const texts = THEMES.map((theme) => TONE_MAP[theme][key]);
    expect(texts[0], key).toBeTruthy();
    expect(new Set(texts).size, key).toBe(1);
  });
});

// Story 48.1 — la Ludothèque : titre, visibilité et refus d’un doublon prennent la voix de chaque thème (textes
// validés le 2026-10-29, EXPERIENCE.md §3.1-3.2) ; tout le reste est neutre.
describe('Tones — Ludothèque (Story 48.1)', () => {
  const VOICED: Record<string, Record<string, string>> = {
    'board_games.title': {
      'grimoire-emeraude': 'Mon cabinet de reliques',
      'foret-ancienne': 'Mon coffre aux trésors',
      'atelier-cuivre': 'Mon râtelier',
    },
    'board_games.visibility': {
      'grimoire-emeraude':
        'Visible par les membres de vos groupes et les invités de vos conjonctions.',
      'foret-ancienne': 'Visible par tes cercles et les invités de tes haltes.',
      'atelier-cuivre': 'Visible par vos équipages et les invités de vos réunions.',
    },
    'board_games.duplicate': {
      'grimoire-emeraude': 'Ce jeu est déjà dans votre cabinet.',
      'foret-ancienne': 'Ce jeu est déjà dans ton coffre.',
      'atelier-cuivre': 'Ce jeu est déjà sur votre râtelier.',
    },
    // Story 48.2
    'board_games.remove_btn': {
      'grimoire-emeraude': 'Retirer de mon cabinet',
      'foret-ancienne': 'Retirer de mon coffre',
      'atelier-cuivre': 'Retirer de mon râtelier',
    },
    // Story 48.3 : consulter la Ludothèque d'une personne — nom accessible du bouton sur un nom,
    // titre du tiroir, ligne de prêt et ligne « vide » : les quatre ont une voix (décision du
    // 2026-10-30) ; aucune clé neutre n'est ajoutée par cette story
    'board_games.open_aria': {
      'grimoire-emeraude': 'Voir le cabinet de {nom}',
      'foret-ancienne': 'Voir le coffre de {nom}',
      'atelier-cuivre': 'Voir le râtelier de {nom}',
    },
    'board_games.sheet_title': {
      'grimoire-emeraude': 'Cabinet de {nom} · {n}',
      'foret-ancienne': 'Coffre de {nom} · {n}',
      'atelier-cuivre': 'Râtelier de {nom} · {n}',
    },
    'board_games.sheet_loan': {
      'grimoire-emeraude': 'Pour emprunter un jeu, demandez-le à {nom}.',
      'foret-ancienne': 'Pour emprunter un jeu, demande-le à {nom}.',
      'atelier-cuivre': 'Pour un prêt, adressez-vous à {nom}.',
    },
    'board_games.sheet_empty': {
      'grimoire-emeraude': 'Le cabinet de {nom} est vide.',
      'foret-ancienne': 'Le coffre de {nom} est vide.',
      'atelier-cuivre': 'Le râtelier de {nom} est vide.',
    },
    // Story 50.1 : « groupe sans jeu » (EXPERIENCE.md §3.2)
    'board_games.group_empty': {
      'grimoire-emeraude': "Personne n'a encore rempli son cabinet.",
      'foret-ancienne': "Personne n'a encore rempli son coffre.",
      'atelier-cuivre': "Personne n'a encore garni son râtelier.",
    },
    // Story 50.2 : titre de « Qui reçoit » (EXPERIENCE.md §3.1)
    'host_counts.title': {
      'grimoire-emeraude': 'Qui ouvre sa porte',
      'foret-ancienne': 'Qui accueille le cercle',
      'atelier-cuivre': "Qui accueille l'équipage",
    },
  };

  for (const theme of THEMES) {
    it(`${theme} porte le titre, la visibilité et le refus de doublon validés`, () => {
      for (const [key, byTheme] of Object.entries(VOICED)) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(byTheme[theme]);
      }
    });
  }

  it('libellés de saisie, mesures et décomptes : le texte du contrat, identique dans les trois thèmes', () => {
    const expected: Record<string, string> = {
      'board_games.field_name': 'Nom',
      'board_games.field_players': 'Joueurs',
      'board_games.field_players_to': 'à',
      'board_games.field_duration': 'Durée en minutes',
      'board_games.add_btn': 'Ajouter',
      'board_games.hint': 'Seul le nom est obligatoire.',
      'board_games.measure_players_range': '{min}–{max} joueurs',
      'board_games.measure_players_min': '{min}+ joueurs',
      'board_games.measure_players_max': "jusqu'à {max} joueurs",
      'board_games.measure_duration': '{d} min',
      'board_games.count_one': '{n} jeu',
      'board_games.count_many': '{n} jeux',
      // Story 48.2
      'board_games.save_btn': 'Enregistrer',
      'board_games.edit_aria': 'Modifier {nom}',
      'board_games.removed': 'Jeu retiré',
      'board_games.undo_btn': 'Annuler',
      // Story 48.3
      'board_games.sheet_close': 'Fermer',
      // Story 50.1
      'board_games.group_search': 'Chercher un jeu…',
      'board_games.group_fit_label': 'Jouable à :',
      'board_games.group_fit_chip_aria': 'Jouable à {n}',
      'board_games.group_owners_prefix': 'chez',
      'board_games.group_owner_me': 'moi',
      'board_games.group_footer': '{games} chez {members}',
      'board_games.group_footer_members_one': '{m} membre',
      'board_games.group_footer_members_many': '{m} membres',
      'board_games.group_no_match': 'Aucun jeu ne correspond.',
      // Story 50.2
      'host_counts.times': '{n} fois',
      'host_counts.never': 'Jamais : {noms}',
    };
    for (const theme of THEMES) {
      for (const [key, text] of Object.entries(expected)) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(text);
      }
    }
  });
});

// Story 49.1 — les jeux sur place d'une soirée : l'onglet (Reliques / Trésors / Joyaux), la ligne « aucun jeu » et
// le lien discret prennent la voix de chaque thème (textes validés le 2026-10-29, EXPERIENCE.md §3.1-3.2) ;
// mesures, provenance et annonces sont neutres.
describe('Tones — jeux sur place d’une soirée (Story 49.1)', () => {
  const VOICED: Record<string, Record<string, string>> = {
    'event_games.tab': {
      'grimoire-emeraude': 'Reliques',
      'foret-ancienne': 'Trésors',
      'atelier-cuivre': 'Joyaux',
    },
    'event_games.tab_count': {
      'grimoire-emeraude': 'Reliques · {n}',
      'foret-ancienne': 'Trésors · {n}',
      'atelier-cuivre': 'Joyaux · {n}',
    },
    'event_games.empty': {
      'grimoire-emeraude': "Aucune relique sur place pour l'instant.",
      'foret-ancienne': "Aucun trésor sur place pour l'instant.",
      'atelier-cuivre': "Aucun joyau sur place pour l'instant.",
    },
    'event_games.fill_link': {
      'grimoire-emeraude': 'Remplir mon cabinet',
      'foret-ancienne': 'Remplir mon coffre',
      'atelier-cuivre': 'Garnir mon râtelier',
    },
  };

  for (const theme of THEMES) {
    it(`${theme} porte l’onglet, la ligne « aucun jeu » et le lien discret validés`, () => {
      for (const [key, byTheme] of Object.entries(VOICED)) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(byTheme[theme]);
      }
    });
  }

  it('mesures, provenance et annonces : le texte du contrat, identique dans les trois thèmes', () => {
    const expected: Record<string, string> = {
      'event_games.host_section': 'Chez {nom}',
      'event_games.host_section_self': 'Chez moi',
      'event_games.summary': '{games} · {playable}',
      'event_games.summary_games_one': '{n} jeu sur place',
      'event_games.summary_games_many': '{n} jeux sur place',
      'event_games.summary_playable_one': '{k} jouable à {total}',
      'event_games.summary_playable_many': '{k} jouables à {total}',
      'event_games.filter_fit': 'Jouables à {total}',
      'event_games.fit_pill': 'jouable à {total}',
      'event_games.section_count': '· {n}',
      'event_games.section_count_filtered': '· {k} sur {n}',
      'event_games.section_aria_filtered_one': '{k} sur {n} jeu',
      'event_games.announce': '{participants} : {playable}.',
    };
    for (const theme of THEMES) {
      for (const [key, text] of Object.entries(expected)) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(text);
      }
    }
  });
});

// Story 49.2 — ce que j'apporte : les deux titres de section (« Apportées » / « Dans mon cabinet »), « J'apporte »,
// « Je ne l'apporte plus » et « Votre cabinet est vide » prennent la voix de chaque thème (textes validés le
// 2026-10-29, EXPERIENCE.md §3.1-3.2) ; doublons, provenance et message de retrait sont neutres.
describe('Tones — ce que j’apporte à une soirée (Story 49.2)', () => {
  const VOICED: Record<string, Record<string, string>> = {
    'event_games.brought_section': {
      'grimoire-emeraude': 'Apportées',
      'foret-ancienne': 'Apportés à la veillée',
      'atelier-cuivre': 'Acheminés',
    },
    'event_games.mine_section': {
      'grimoire-emeraude': 'Dans mon cabinet',
      'foret-ancienne': 'Dans mon coffre',
      'atelier-cuivre': 'Sur mon râtelier',
    },
    'event_games.bring_btn': {
      'grimoire-emeraude': "J'apporte",
      'foret-ancienne': "Je l'apporte",
      'atelier-cuivre': "Je l'achemine",
    },
    'event_games.unbring_btn': {
      'grimoire-emeraude': "Je ne l'apporte plus",
      'foret-ancienne': "Je ne l'apporte plus",
      'atelier-cuivre': "Annuler l'acheminement",
    },
    'event_games.mine_empty': {
      'grimoire-emeraude': 'Votre cabinet est vide.',
      'foret-ancienne': 'Ton coffre est vide.',
      'atelier-cuivre': 'Votre râtelier est vide.',
    },
  };

  for (const theme of THEMES) {
    it(`${theme} porte les titres de section, les deux actions et la section vide validés`, () => {
      for (const [key, byTheme] of Object.entries(VOICED)) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(byTheme[theme]);
      }
    });
  }

  it('doublons, provenance et message de retrait : le texte du contrat, identique dans les trois thèmes', () => {
    const expected: Record<string, string> = {
      'event_games.dup_pill': '×{n}',
      'event_games.also_at': 'aussi chez {noms}',
      'event_games.also_brought_by': 'aussi apporté par {noms}',
      'event_games.already_at': 'déjà chez {nom}',
      'event_games.by_other': 'par {nom}',
      'event_games.by_me': 'par moi',
      'event_games.holder_me': 'moi',
      'board_games.remove_brought_one':
        'Ce jeu est apporté à 1 soirée à venir : il en sera retiré.',
      'board_games.remove_brought_many':
        'Ce jeu est apporté à {n} soirées à venir : il en sera retiré.',
    };
    for (const theme of THEMES) {
      for (const [key, text] of Object.entries(expected)) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(text);
      }
    }
  });

  it('le tutoiement de la Forêt et le vouvoiement des deux autres thèmes dans la section vide', () => {
    expect(TONE_MAP['foret-ancienne']['event_games.mine_empty']).toMatch(/^Ton /);
    expect(TONE_MAP['grimoire-emeraude']['event_games.mine_empty']).toMatch(/^Votre /);
    expect(TONE_MAP['atelier-cuivre']['event_games.mine_empty']).toMatch(/^Votre /);
  });
});

// Story 49.4 — écarter un jeu pour ce soir (hôte) : l'entrée du menu ⋮, le titre et la mention de la section du bas
// et le bouton « Remettre » prennent la voix de chaque thème (textes validés le 2026-10-29, EXPERIENCE.md §3.1-3.2) ;
// les noms accessibles du ⋮ et de son menu sont neutres.
describe('Tones — écarter un jeu pour ce soir (Story 49.4)', () => {
  const VOICED: Record<string, Record<string, string>> = {
    'event_games.exclude_entry': {
      'grimoire-emeraude': 'Sceller pour ce soir',
      'foret-ancienne': 'Laisser au logis ce soir',
      'atelier-cuivre': 'Hors service ce soir',
    },
    'event_games.excluded_section': {
      'grimoire-emeraude': 'Scellées ce soir',
      'foret-ancienne': 'Restés au logis',
      'atelier-cuivre': 'Hors service',
    },
    'event_games.excluded_note': {
      'grimoire-emeraude': 'visible par vous seul·e',
      'foret-ancienne': 'visible par toi seul·e',
      'atelier-cuivre': 'visible par vous seul·e',
    },
    'event_games.restore_btn': {
      'grimoire-emeraude': 'Lever le sceau',
      'foret-ancienne': 'Ressortir',
      'atelier-cuivre': 'Remettre en service',
    },
  };

  for (const theme of THEMES) {
    it(`${theme} porte l’entrée du menu, la section du bas, sa mention et « Remettre » validés`, () => {
      for (const [key, byTheme] of Object.entries(VOICED)) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(byTheme[theme]);
      }
    });
  }

  it('chaque libellé a des voix différentes d’un thème à l’autre', () => {
    for (const key of Object.keys(VOICED)) {
      const texts = new Set(THEMES.map((theme) => TONE_MAP[theme][key]));
      expect(texts.size, key).toBeGreaterThan(1);
    }
  });

  it('noms accessibles du ⋮ et de son menu : identiques dans les trois thèmes', () => {
    const expected: Record<string, string> = {
      'event_games.menu_trigger_aria': 'Actions pour {nom}',
      'event_games.menu_aria': 'Menu des actions pour {nom}',
    };
    for (const theme of THEMES) {
      for (const [key, text] of Object.entries(expected)) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(text);
      }
    }
  });
});

// Story 49.5 — signaler une Envie : le libellé du ♥, l'unité du compte (singulier et pluriel) et la puce de tri
// prennent la voix de chaque thème (textes validés le 2026-10-29, EXPERIENCE.md §3.2) ; les noms accessibles du
// compte et de la liste des noms sont neutres.
describe('Tones — signaler une Envie (Story 49.5)', () => {
  const VOICED: Record<string, Record<string, string>> = {
    'event_games.envy_btn': {
      'grimoire-emeraude': "Cette relique m'appelle",
      'foret-ancienne': "J'ai envie d'y jouer",
      'atelier-cuivre': "Je veux l'essayer",
    },
    'event_games.envy_unit_one': {
      'grimoire-emeraude': 'appel',
      'foret-ancienne': 'envie',
      'atelier-cuivre': 'demande',
    },
    'event_games.envy_unit_many': {
      'grimoire-emeraude': 'appels',
      'foret-ancienne': 'envies',
      'atelier-cuivre': 'demandes',
    },
    'event_games.sort_envy': {
      'grimoire-emeraude': 'Les plus appelées',
      'foret-ancienne': 'Les plus attendus',
      'atelier-cuivre': 'Les plus demandés',
    },
  };

  for (const theme of THEMES) {
    it(`${theme} porte le libellé du ♥, l’unité du compte et la puce de tri validés`, () => {
      for (const [key, byTheme] of Object.entries(VOICED)) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(byTheme[theme]);
      }
    });
  }

  it('chaque libellé a des voix différentes d’un thème à l’autre (trois voix distinctes)', () => {
    for (const key of Object.keys(VOICED)) {
      const texts = new Set(THEMES.map((theme) => TONE_MAP[theme][key]));
      expect(texts.size, key).toBe(3);
    }
  });

  it('noms accessibles du compte et de la liste des noms : identiques dans les trois thèmes', () => {
    const expected: Record<string, string> = {
      'event_games.envy_count_aria': 'Voir les noms — {nom}, {n} {unite}',
      'event_games.envy_names_aria': 'Noms pour {nom}',
    };
    for (const theme of THEMES) {
      for (const [key, text] of Object.entries(expected)) {
        expect(TONE_MAP[theme][key], `${theme} / ${key}`).toBe(text);
      }
    }
  });
});
