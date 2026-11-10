import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { XpDistributionPanel } from './xp-distribution-panel';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { makeCharacterDto } from '../../../core/characters/character-dto.fixture';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function makeToneService() {
  return { tone: signal(TONE_MAP['grimoire-emeraude']) };
}

async function createFixture(createXpDistribution = vi.fn().mockResolvedValue({})) {
  await TestBed.configureTestingModule({
    imports: [XpDistributionPanel],
    providers: [
      provideAnimationsAsync(),
      { provide: ThemeToneService, useValue: makeToneService() },
      { provide: PartiesService, useValue: { createXpDistribution } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(XpDistributionPanel);
  fixture.componentRef.setInput('partieId', 'party-1');
  fixture.componentRef.setInput('characters', [
    makeCharacterDto({
      id: 'c1',
      userId: 'u1',
      xp: 50,
      sheetData: { narrative: { name: 'Fenn' } },
    }),
  ]);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, createXpDistribution };
}

describe('XpDistributionPanel', () => {
  afterEach(() => TestBed.resetTestingModule());

  // Revue de code 28.2 : l'affichage du nom du joueur à côté du personnage est le seul
  // comportement neuf de ce panneau, et n'était couvert par aucune assertion.
  it('chaque ligne affiche le personnage ET son joueur, via IdentityLabel (AC2/AC4)', async () => {
    const { el } = await createFixture();

    const label = el.querySelector('app-identity-label')!;
    expect(label).not.toBeNull();
    expect(label.querySelector('.identity-label__character')?.textContent?.trim()).toBe('Fenn');
    expect(label.querySelector('.identity-label__player')?.textContent?.trim()).toBe(
      'Alice au pays',
    );
    // Mode joint : la typographie seule porte la distinction, jamais une icône (EXPERIENCE §4.5).
    expect(label.querySelector('svg')).toBeNull();
  });

  it('calcul suggéré appliqué par défaut aux lignes non éditées manuellement', async () => {
    const { fixture, el } = await createFixture();
    const component = fixture.componentInstance;

    const difficultyInput = el.querySelector<HTMLInputElement>('input[type="number"]')!;
    difficultyInput.value = '5';
    difficultyInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component['suggestedAmount']()).toBe(200);
    expect(component['rows']()[0].amount).toBe(200);
  });

  it('montant éditable sans être écrasé par un recalcul ultérieur des 3 champs', async () => {
    const { fixture } = await createFixture();
    const component = fixture.componentInstance;

    component['setAmount']('c1', '999');
    component['setDifficulty']('5');
    fixture.detectChanges();

    expect(component['rows']()[0].amount).toBe(999);
  });

  it('bonus ajouté à un joueur n’affecte pas les autres', async () => {
    const { fixture } = await createFixture();
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('characters', [
      makeCharacterDto({ id: 'c1', userId: 'u1' }),
      makeCharacterDto({ id: 'c2', userId: 'u2' }),
    ]);
    fixture.detectChanges();

    component['setBonus']('c1', '50');
    fixture.detectChanges();

    const rows = component['rows']();
    expect(rows.find((r) => r.characterId === 'c1')?.bonus).toBe(50);
    expect(rows.find((r) => r.characterId === 'c2')?.bonus).toBe(0);
  });

  it('soumission appelle parties.createXpDistribution avec le payload attendu', async () => {
    const createXpDistribution = vi.fn().mockResolvedValue({});
    const { fixture } = await createFixture(createXpDistribution);
    const component = fixture.componentInstance;

    component['setAmount']('c1', '100');
    component['setBonus']('c1', '25');
    await component['submit']();

    expect(createXpDistribution).toHaveBeenCalledWith(
      'party-1',
      expect.objectContaining({
        entries: expect.arrayContaining([
          { characterId: 'c1', amount: 100 },
          { characterId: 'c1', amount: 25, isBonus: true },
        ]),
      }),
    );
  });

  it('avertissement affiché si un joueur franchit un seuil', async () => {
    const { fixture, el } = await createFixture();
    fixture.componentRef.setInput('characters', [
      makeCharacterDto({ id: 'c1', userId: 'u1', xp: 90 }),
    ]);
    fixture.detectChanges();
    fixture.componentInstance['setAmount']('c1', '50'); // 90 + 50 = 140 → franchit le seuil 100
    fixture.detectChanges();

    expect(el.textContent).toContain('franchira un niveau');
  });

  it('bonus négatif clampé à 0, jamais soumis (pas de suppression silencieuse d’XP)', async () => {
    const createXpDistribution = vi.fn().mockResolvedValue({});
    const { fixture } = await createFixture(createXpDistribution);
    const component = fixture.componentInstance;

    component['setAmount']('c1', '100');
    component['setBonus']('c1', '-30');
    expect(component['rows']()[0].bonus).toBe(0);

    await component['submit']();
    expect(createXpDistribution).toHaveBeenCalledWith(
      'party-1',
      expect.objectContaining({ entries: [{ characterId: 'c1', amount: 100 }] }),
    );
  });

  it('difficulté négative traitée comme non renseignée (pas de montant suggéré trompeur)', async () => {
    const { fixture } = await createFixture();
    const component = fixture.componentInstance;

    component['setDifficulty']('-5');

    expect(component['suggestedAmount']()).toBe(0);
  });

  it('soumission sans aucun personnage inclus affiche un message plutôt que de ne rien faire', async () => {
    const createXpDistribution = vi.fn();
    const { fixture } = await createFixture(createXpDistribution);
    const component = fixture.componentInstance;

    component['toggleIncluded']('c1'); // déclenché depuis included:true par défaut → false
    await component['submit']();

    expect(createXpDistribution).not.toHaveBeenCalled();
    expect(component['submitError']()).toContain(GRIMOIRE_TONE['parties.xp_select_one_error']);
  });
});
