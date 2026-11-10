import { TestBed } from '@angular/core/testing';
import type { GameSystemContentDto } from '@master-jdr/shared';
import type { DerivedStats, RyuutamaSheetData } from '@master-jdr/game-rules';
import { WizardSummary } from './wizard-summary';

const CONTENT: GameSystemContentDto = {
  class: [
    { key: 'chasseur', data: { label: 'Chasseur' } },
    { key: 'artisan', data: { label: 'Artisan' } },
  ],
  type: [
    { key: 'technique', data: { label: 'Technique' } },
    { key: 'magie', data: { label: 'Magie' } },
  ],
  season: [{ key: 'ete', data: { label: 'Été' } }],
  spell: [
    { key: 'cloche', data: { name: 'Cloche d’alarme' } },
    { key: 'benediction', data: { name: 'Bénédiction' } },
  ],
  weaponItem: [{ key: 'dague', data: { label: 'Dague' } }],
  equipmentItem: [
    { key: 'corde', data: { label: 'Corde', priceGold: 50 } },
    { key: 'rations', data: { label: 'Rations', priceGold: 10 } },
  ],
};

const STATS = { PV: 8, PE: 12, Condition: 10, Initiative: 14, Encombrement: 7 } as DerivedStats;

function mount(sheetData: Partial<RyuutamaSheetData>, derived: DerivedStats | null = null) {
  TestBed.configureTestingModule({ imports: [WizardSummary] });
  const fixture = TestBed.createComponent(WizardSummary);
  fixture.componentRef.setInput('sheetData', sheetData);
  fixture.componentRef.setInput('derived', derived);
  fixture.componentRef.setInput('content', CONTENT);
  fixture.detectChanges();
  return fixture;
}
const root = (f: { nativeElement: HTMLElement }) => f.nativeElement;
const dl = (f: { nativeElement: HTMLElement }) =>
  Array.from(root(f).querySelectorAll('.wizard-summary__rows dt')).map((dt) => [
    dt.textContent?.trim(),
    dt.nextElementSibling?.textContent?.trim(),
  ]);

describe('WizardSummary (Story 31.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('au départ : « Voyageur », l’aide sur les statistiques, aucune ligne, aucun panier', () => {
    const fixture = mount({ startingEquipment: [] });
    expect(root(fixture).querySelector('.wizard-summary__title')!.textContent).toContain(
      'Voyageur',
    );
    expect(root(fixture).querySelector('.wizard-summary__hint')).not.toBeNull();
    expect(root(fixture).querySelector('.wizard-summary__rows')).toBeNull();
    expect(root(fixture).querySelector('.wizard-summary__cart')).toBeNull();
  });

  it('se remplit au fil des étapes : classe, type, arme — libellés résolus depuis le catalogue', () => {
    const fixture = mount({ classId: 'chasseur', typeId: 'technique', weaponId: 'dague' });
    expect(dl(fixture)).toEqual([
      ['Classe', 'Chasseur'],
      ['Type', 'Technique'],
      ['Arme', 'Dague'],
    ]);
  });

  it('type Magie : la saison et les sorts s’ajoutent', () => {
    const fixture = mount({
      classId: 'chasseur',
      typeId: 'magie',
      magicSeason: 'ete',
      knownRitualSpells: ['cloche', 'benediction'],
    });
    expect(dl(fixture)).toEqual([
      ['Classe', 'Chasseur'],
      ['Type', 'Magie'],
      ['Saison', 'Été'],
      ['Sorts', 'Cloche d’alarme, Bénédiction'],
    ]);
  });

  it('la spécialité de l’Artisan apparaît', () => {
    const fixture = mount({ classId: 'artisan', specialtyTypeId: 'Cordonnerie' });
    expect(dl(fixture)).toContainEqual(['Spécialité', 'Cordonnerie']);
  });

  it('les valeurs d’attributs et les pastilles apparaissent une fois les attributs posés', () => {
    const fixture = mount({ attributes: { AGI: 6, ESP: 6, INT: 8, VIG: 4 } }, STATS);
    const attrs = Array.from(root(fixture).querySelectorAll('.wizard-summary__attr')).map((a) =>
      a.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(attrs).toEqual(['AGI6', 'ESP6', 'INT8', 'VIG4']);
    expect(root(fixture).querySelectorAll('.stat-pill').length).toBe(5);
    expect(root(fixture).querySelector('.wizard-summary__hint')).toBeNull();
  });

  it('le nom saisi devient le titre ; les champs narratifs vides ne rendent rien', () => {
    const fixture = mount({ narrative: { name: 'Éléa', age: '27', homeTown: 'Vallombre' } });
    expect(root(fixture).querySelector('.wizard-summary__title')!.textContent).toContain('Éléa');
    expect(dl(fixture)).toEqual([
      ['Âge', '27'],
      ['Village', 'Vallombre'],
    ]);
  });

  it('les pastilles passent à la ligne (conteneur flex-wrap)', () => {
    const fixture = mount({ attributes: { AGI: 6, ESP: 6, INT: 8, VIG: 4 } }, STATS);
    // Le style est encapsulé dans le composant : on vérifie la classe qui porte le `flex-wrap`.
    expect(root(fixture).querySelector('.wizard-summary__pills')).not.toBeNull();
  });

  it('le Panier liste l’équipement (quantité, libellé), le total et la pastille de compte', () => {
    const fixture = mount({
      startingEquipment: [
        { key: 'corde', quantity: 2 },
        { key: 'rations', quantity: 4 },
      ],
    });
    const lines = Array.from(root(fixture).querySelectorAll('.wizard-summary__cart li')).map((li) =>
      li.querySelector('span')?.textContent?.trim(),
    );
    expect(lines).toEqual(['2× Corde', '4× Rations']);
    expect(root(fixture).querySelector('.wizard-summary__total')!.textContent).toContain('140 Po');
    expect(root(fixture).textContent).toContain('· 6');
  });

  it('« Retirer » supprime la ligne entière et réémet la sélection restante', () => {
    const fixture = mount({
      startingEquipment: [
        { key: 'corde', quantity: 2 },
        { key: 'rations', quantity: 4 },
      ],
    });
    const emitted: { key: string; quantity: number }[][] = [];
    fixture.componentInstance.equipmentChange.subscribe((s) => emitted.push(s));
    root(fixture).querySelector<HTMLButtonElement>('.wizard-summary__remove')!.click();
    expect(emitted).toEqual([[{ key: 'rations', quantity: 4 }]]);
  });

  it('une clé d’équipement absente du catalogue est ignorée, sans erreur', () => {
    const fixture = mount({ startingEquipment: [{ key: 'inconnu', quantity: 1 }] });
    expect(root(fixture).querySelector('.wizard-summary__cart')).toBeNull();
  });
});
