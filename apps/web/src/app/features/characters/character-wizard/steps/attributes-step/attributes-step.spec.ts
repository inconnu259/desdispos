import { TestBed } from '@angular/core/testing';
import type { ContentEntryDto } from '@master-jdr/shared';
import { AttributesStep } from './attributes-step';
import { fillTone } from '../../../../../core/theme/tone-format';
import { TONE_MAP } from '../../../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

const PATTERNS: ContentEntryDto[] = [
  { key: 'equilibre', data: { label: 'Équilibré', values: [6, 6, 6, 6] } },
  { key: 'polyvalent', data: { label: 'Polyvalent', values: [8, 4, 6, 6] } },
  { key: 'specialiste', data: { label: 'Spécialiste', values: [4, 4, 8, 8] } },
];

// Story 31.4 (AC11, C1) — les puces ne sont plus indexées par EMPLACEMENT du profil mais par VALEUR
// DISTINCTE : une seule puce « 6 » par rangée, avec un badge « ×N ». Les scénarios de la 24.1 sont
// conservés (mêmes attributs, mêmes valeurs émises), seule la façon de cibler une puce change.
describe('AttributesStep', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup() {
    TestBed.configureTestingModule({ imports: [AttributesStep] });
    const fixture = TestBed.createComponent(AttributesStep);
    fixture.componentRef.setInput('patterns', PATTERNS);
    fixture.detectChanges();
    return fixture;
  }
  type Fixture = ReturnType<typeof setup>;

  function selectPattern(fixture: Fixture, index: number) {
    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll(
      '.attributes-step__patterns button',
    );
    buttons[index].click();
    fixture.detectChanges();
  }
  const selectPolyvalent = (fixture: Fixture) => selectPattern(fixture, 1);

  /** Rangées d'attributs, dans l'ordre AGI, ESP, INT, VIG. */
  const rows = (fixture: Fixture): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.attr-slot'));
  /** La puce de valeur `value` dans la rangée `row`. */
  const chip = (fixture: Fixture, row: number, value: number): HTMLButtonElement =>
    rows(fixture)[row].querySelector(`.value-chip[data-value="${value}"]`) as HTMLButtonElement;
  const click = async (fixture: Fixture, row: number, value: number) => {
    chip(fixture, row, value).click();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const anySelected = (row: HTMLElement) =>
    [...row.querySelectorAll('.value-chip')].some((c) =>
      c.classList.contains('value-chip--selected'),
    );

  describe('Story 24.1 : choix du profil', () => {
    it('aucune grille de chips tant qu’aucun profil n’est sélectionné', async () => {
      const fixture = setup();
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('.attributes-step__grid')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Équilibré');
      expect(fixture.nativeElement.textContent).toContain('Polyvalent');
      expect(fixture.nativeElement.textContent).toContain('Spécialiste');
    });

    it('AC7 (31.4) — chaque profil porte ses valeurs par ordre décroissant en sous-titre', async () => {
      const fixture = setup();
      await fixture.whenStable();
      const details = Array.from(
        fixture.nativeElement.querySelectorAll('.choice-card__detail'),
      ) as HTMLElement[];
      expect(details.map((d) => d.textContent)).toEqual([
        '6 · 6 · 6 · 6',
        '8 · 6 · 6 · 4',
        '8 · 8 · 4 · 4',
      ]);
    });

    it('sélection d’un profil → affiche la grille de chips et le résumé des valeurs placées', async () => {
      const fixture = setup();
      await fixture.whenStable();

      selectPolyvalent(fixture);
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('.attributes-step__grid')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.attributes-step__banner').textContent).toContain(
        fillTone(GRIMOIRE_TONE['characters_wizard.attributes_banner_one'], {
          n: 0,
          total: 4,
        }).replace(/^— /, ''),
      );
    });

    it('changer de profil après une assignation partielle réinitialise l’assignation et réémet null', async () => {
      const fixture = setup();
      const emitted: unknown[] = [];
      fixture.componentInstance.attributesChange.subscribe((v) => emitted.push(v));
      await fixture.whenStable();

      selectPolyvalent(fixture);
      await fixture.whenStable();
      await click(fixture, 0, 8); // AGI ← 8

      selectPattern(fixture, 2); // specialiste
      await fixture.whenStable();

      expect(anySelected(rows(fixture)[0])).toBe(false);
      expect(emitted.at(-1)).toBeNull();
    });

    it('revue de code (2026-07-26) : changer de profil après une assignation COMPLÈTE (4/4) réinitialise aussi l’assignation et réémet null', async () => {
      const fixture = setup();
      const emitted: unknown[] = [];
      fixture.componentInstance.attributesChange.subscribe((v) => emitted.push(v));
      await fixture.whenStable();

      selectPolyvalent(fixture);
      await fixture.whenStable();
      await click(fixture, 0, 8); // AGI ← 8
      await click(fixture, 1, 6); // ESP ← 6
      await click(fixture, 2, 6); // INT ← 6
      await click(fixture, 3, 4); // VIG ← 4
      expect(emitted.at(-1)).toEqual({ AGI: 8, ESP: 6, INT: 6, VIG: 4 });

      selectPattern(fixture, 0); // equilibre
      await fixture.whenStable();

      for (const row of rows(fixture)) expect(anySelected(row)).toBe(false);
      expect(emitted.at(-1)).toBeNull();
    });

    it('recliquer sur le profil déjà sélectionné ne réinitialise PAS l’assignation en cours', async () => {
      const fixture = setup();
      await fixture.whenStable();
      selectPolyvalent(fixture);
      await fixture.whenStable();
      await click(fixture, 0, 8); // AGI ← 8

      selectPolyvalent(fixture); // reclic sur le même profil
      await fixture.whenStable();

      expect(chip(fixture, 0, 8).classList).toContain('value-chip--selected');
    });

    it('assigne les 4 valeurs du profil Spécialiste → émet le résultat complet', async () => {
      const fixture = setup();
      const emitted: unknown[] = [];
      fixture.componentInstance.attributesChange.subscribe((v) => emitted.push(v));
      await fixture.whenStable();

      selectPattern(fixture, 2); // specialiste [4,4,8,8]
      await fixture.whenStable();

      await click(fixture, 0, 4); // AGI ← 4
      await click(fixture, 1, 4); // ESP ← 4 (second exemplaire)
      await click(fixture, 2, 8); // INT ← 8
      await click(fixture, 3, 8); // VIG ← 8 (second exemplaire)

      expect(emitted.at(-1)).toEqual({ AGI: 4, ESP: 4, INT: 8, VIG: 8 });
    });

    it('restaure le profil ET l’assignation quand `attributes` correspond à un profil connu (retour en arrière)', async () => {
      TestBed.configureTestingModule({ imports: [AttributesStep] });
      const fixture = TestBed.createComponent(AttributesStep);
      fixture.componentRef.setInput('patterns', PATTERNS);
      // Correspond au profil Spécialiste [4,4,8,8].
      fixture.componentRef.setInput('attributes', { AGI: 4, ESP: 4, INT: 8, VIG: 8 });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.nativeElement.textContent).toContain('Profil');
      expect(fixture.nativeElement.textContent).toContain('Spécialiste');
      expect(chip(fixture as unknown as Fixture, 0, 4).classList).toContain('value-chip--selected');
      expect(chip(fixture as unknown as Fixture, 3, 8).classList).toContain('value-chip--selected');
      expect(fixture.nativeElement.querySelector('.attributes-step__banner').textContent).toContain(
        fillTone(GRIMOIRE_TONE['characters_wizard.attributes_banner_many'], {
          n: 4,
          total: 4,
        }).replace(/^— /, ''),
      );
    });

    it('aucun profil ne correspond aux valeurs entrantes (donnée legacy/incohérente) → aucun profil pré-sélectionné, pas de crash', async () => {
      TestBed.configureTestingModule({ imports: [AttributesStep] });
      const fixture = TestBed.createComponent(AttributesStep);
      fixture.componentRef.setInput('patterns', PATTERNS);
      fixture.componentRef.setInput('attributes', { AGI: 12, ESP: 4, INT: 4, VIG: 4 });
      expect(() => fixture.detectChanges()).not.toThrow();
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('.attributes-step__grid')).toBeNull();
    });
  });

  describe('assignation des chips (une fois un profil sélectionné)', () => {
    it("n'émet rien tant que les 4 attributs ne sont pas assignés", async () => {
      const fixture = setup();
      await fixture.whenStable();
      selectPolyvalent(fixture);
      await fixture.whenStable();

      const emitted: unknown[] = [];
      fixture.componentInstance.attributesChange.subscribe((v) => emitted.push(v));
      await click(fixture, 0, 8); // seulement AGI

      expect(emitted).toEqual([null]);
    });

    it('assigne les 4 valeurs (dont les deux 6) → émet le résultat complet', async () => {
      const fixture = setup();
      await fixture.whenStable();
      selectPolyvalent(fixture);
      await fixture.whenStable();

      const emitted: unknown[] = [];
      fixture.componentInstance.attributesChange.subscribe((v) => emitted.push(v));

      await click(fixture, 0, 8); // AGI ← 8
      await click(fixture, 1, 6); // ESP ← 6 (premier exemplaire)
      await click(fixture, 2, 6); // INT ← 6 (second exemplaire)
      await click(fixture, 3, 4); // VIG ← 4

      expect(emitted.at(-1)).toEqual({ AGI: 8, ESP: 6, INT: 6, VIG: 4 });
    });

    it('une valeur assignée à un attribut ne peut pas être réassignée ailleurs sans être libérée', async () => {
      const fixture = setup();
      await fixture.whenStable();
      selectPolyvalent(fixture);
      await fixture.whenStable();

      await click(fixture, 0, 8); // AGI ← 8

      // Le 8 (exemplaire unique) est épuisé dans les AUTRES rangées…
      expect(chip(fixture, 1, 8).disabled).toBe(true);
      // …mais reste actif (sélectionné) dans sa propre rangée.
      expect(chip(fixture, 0, 8).disabled).toBe(false);
      expect(chip(fixture, 0, 8).classList.contains('value-chip--selected')).toBe(true);
    });

    it('recliquer sur la valeur déjà sélectionnée la désélectionne (toggle) et la libère pour les autres attributs', async () => {
      const fixture = setup();
      await fixture.whenStable();
      selectPolyvalent(fixture);
      await fixture.whenStable();

      const emitted: unknown[] = [];
      fixture.componentInstance.attributesChange.subscribe((v) => emitted.push(v));

      await click(fixture, 0, 8);
      expect(chip(fixture, 0, 8).classList.contains('value-chip--selected')).toBe(true);
      expect(chip(fixture, 1, 8).disabled).toBe(true);

      await click(fixture, 0, 8); // reclic : désélection

      expect(chip(fixture, 0, 8).classList.contains('value-chip--selected')).toBe(false);
      expect(chip(fixture, 1, 8).disabled).toBe(false);
      expect(emitted.at(-1)).toBeNull();
    });

    it('désélectionner un chip alors que les 4 attributs sont assignés ne désélectionne QUE cet attribut, pas les 3 autres (même une fois le echo `attributes=undefined` du parent reçu en entrée)', async () => {
      const fixture = setup();
      await fixture.whenStable();
      selectPolyvalent(fixture);
      await fixture.whenStable();

      await click(fixture, 0, 8); // AGI ← 8
      await click(fixture, 1, 6); // ESP ← 6
      await click(fixture, 2, 6); // INT ← 6
      await click(fixture, 3, 4); // VIG ← 4

      await click(fixture, 0, 8); // désélectionne AGI seul

      // Le parent réel réagit à l'émission `null` en repassant `attributes` à `undefined` en entrée
      // (cf. character-wizard.ts `sheetData.update(... attributes: attrs ?? undefined)`) — simulé.
      fixture.componentRef.setInput('attributes', undefined);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(anySelected(rows(fixture)[0])).toBe(false);
      expect(anySelected(rows(fixture)[1])).toBe(true);
      expect(anySelected(rows(fixture)[2])).toBe(true);
      expect(chip(fixture, 3, 4).classList).toContain('value-chip--selected');
    });
  });

  // ── Story 31.4 — AttributePool (AC11) : plus de puces jumelles ────────────────────────────

  describe('AC11 — une puce par valeur distincte, avec compteur ×N', () => {
    it('AC11 — profil [8,4,6,6] : trois puces par rangée (8, 6, 4), par ordre décroissant', async () => {
      const fixture = setup();
      selectPolyvalent(fixture);
      await fixture.whenStable();
      for (const row of rows(fixture)) {
        const values = [...row.querySelectorAll('.value-chip')].map((c) =>
          c.getAttribute('data-value'),
        );
        expect(values).toEqual(['8', '6', '4']);
      }
    });

    it('AC11 — le badge ×N n’existe que pour une valeur multiple et décompte à chaque placement', async () => {
      const fixture = setup();
      selectPolyvalent(fixture);
      await fixture.whenStable();
      const count = (row: number, value: number) =>
        chip(fixture, row, value).querySelector('.value-chip__count')?.textContent?.trim() ?? null;

      expect(count(1, 6)).toBe('×2');
      expect(count(1, 8)).toBeNull(); // valeur unique : jamais de badge
      expect(count(1, 4)).toBeNull();

      await click(fixture, 0, 6); // AGI ← 6
      expect(count(1, 6)).toBe('×1');
      expect(count(0, 6)).toBe('×1'); // dans sa propre rangée aussi : exemplaires restant à placer

      await click(fixture, 1, 6); // ESP ← 6 : plus d'exemplaire
      expect(count(2, 6)).toBeNull();
    });

    it('AC11 — une valeur épuisée est grisée dans les AUTRES rangées, jamais dans la sienne', async () => {
      const fixture = setup();
      selectPolyvalent(fixture);
      await fixture.whenStable();
      await click(fixture, 0, 6);
      await click(fixture, 1, 6); // les deux 6 sont placés

      expect(chip(fixture, 2, 6).disabled).toBe(true);
      expect(chip(fixture, 3, 6).disabled).toBe(true);
      // Sa propre rangée : on peut reprendre sa valeur pour la retirer.
      expect(chip(fixture, 0, 6).disabled).toBe(false);
      expect(chip(fixture, 1, 6).disabled).toBe(false);
    });

    it('AC11 — nom accessible avec compteur : « 6, encore 2 à placer »', async () => {
      const fixture = setup();
      selectPolyvalent(fixture);
      await fixture.whenStable();
      expect(chip(fixture, 0, 6).getAttribute('aria-label')).toBe(
        fillTone(GRIMOIRE_TONE['characters_wizard.attributes_chip_remaining'], { value: 6, n: 2 }),
      );
      expect(chip(fixture, 0, 8).getAttribute('aria-label')).toBe('8');
    });

    it('AC11 — profil [6,6,6,6] : une seule puce « 6 » par rangée, badge ×4 décomptant jusqu’à épuisement', async () => {
      const fixture = setup();
      selectPattern(fixture, 0);
      await fixture.whenStable();
      expect(rows(fixture)[0].querySelectorAll('.value-chip').length).toBe(1);
      expect(chip(fixture, 1, 6).querySelector('.value-chip__count')?.textContent).toContain('×4');
      await click(fixture, 0, 6);
      await click(fixture, 1, 6);
      await click(fixture, 2, 6);
      expect(chip(fixture, 3, 6).querySelector('.value-chip__count')?.textContent).toContain('×1');
    });

    it('AC11 — changer la valeur d’une rangée libère l’exemplaire précédent', async () => {
      const fixture = setup();
      selectPolyvalent(fixture);
      await fixture.whenStable();
      await click(fixture, 0, 8); // AGI ← 8
      await click(fixture, 0, 4); // AGI ← 4 (au lieu de 8)

      expect(chip(fixture, 0, 4).classList).toContain('value-chip--selected');
      expect(chip(fixture, 0, 8).classList).not.toContain('value-chip--selected');
      expect(chip(fixture, 1, 8).disabled).toBe(false); // le 8 est de nouveau disponible
      expect(chip(fixture, 1, 4).disabled).toBe(true); // le 4 (unique) est pris
    });

    it('AC11/AC3 — pour chaque profil et chaque permutation, les valeurs émises sont exactement celles placées', async () => {
      const permutations = (arr: number[]): number[][] =>
        arr.length <= 1
          ? [arr]
          : arr.flatMap((v, i) =>
              permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [v, ...p]),
            );
      const keys = ['AGI', 'ESP', 'INT', 'VIG'] as const;
      for (const [patternIndex, values] of [
        [0, [6, 6, 6, 6]],
        [1, [8, 4, 6, 6]],
        [2, [4, 4, 8, 8]],
      ] as [number, number[]][]) {
        for (const perm of permutations(values)) {
          TestBed.resetTestingModule(); // une instance de TestBed par combinaison
          const fixture = setup();
          const emitted: unknown[] = [];
          fixture.componentInstance.attributesChange.subscribe((v) => emitted.push(v));
          selectPattern(fixture, patternIndex);
          await fixture.whenStable();
          for (let row = 0; row < 4; row++) await click(fixture, row, perm[row]);
          expect(emitted.at(-1), `${values} / ${perm}`).toEqual(
            Object.fromEntries(keys.map((k, i) => [k, perm[i]])),
          );
        }
      }
    });
  });
});
