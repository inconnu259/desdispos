import { TestBed } from '@angular/core/testing';
import type { ContentEntryDto } from '@master-jdr/shared';
import { WeaponStep } from './weapon-step';
import { TONE_MAP } from '../../../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

const WEAPON_CATEGORIES: ContentEntryDto[] = [
  {
    key: 'arc',
    data: {
      label: 'Arc',
      description: 'Distance, mais difficiles à utiliser. Deux mains.',
      touchFormula: 'AGI+INT-2',
      damageFormula: 'AGI',
    },
  },
  {
    key: 'lance',
    data: {
      label: 'Lance',
      description: 'Armes meurtrières. Deux mains.',
      touchFormula: 'VIG+AGI',
      damageFormula: 'VIG+1',
    },
  },
  {
    key: 'mains-nues',
    data: {
      label: 'Mains nues',
      description: 'Armes de la dernière chance. Deux mains.',
      touchFormula: 'VIG+AGI',
      damageFormula: 'VIG-2',
    },
  },
];

const WEAPON_ITEMS: ContentEntryDto[] = [
  { key: 'arc-de-chasse', data: { label: 'Arc de chasse', categoryId: 'arc' } },
  { key: 'arc-court', data: { label: 'Arc court', categoryId: 'arc' } },
  { key: 'lance', data: { label: 'Lance', categoryId: 'lance' } },
  { key: 'mains-nues', data: { label: 'Mains nues', categoryId: 'mains-nues' } },
];

describe('WeaponStep', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup() {
    TestBed.configureTestingModule({ imports: [WeaponStep] });
    const fixture = TestBed.createComponent(WeaponStep);
    fixture.componentRef.setInput('weaponItems', WEAPON_ITEMS);
    fixture.componentRef.setInput('weaponCategories', WEAPON_CATEGORIES);
    fixture.detectChanges();
    return fixture;
  }

  function grids(fixture: ReturnType<typeof setup>): NodeListOf<HTMLElement> {
    return fixture.nativeElement.querySelectorAll('.weapon-step__grid');
  }

  function categoryButtons(fixture: ReturnType<typeof setup>): HTMLButtonElement[] {
    return Array.from(grids(fixture)[0].querySelectorAll('button'));
  }

  function itemButtons(fixture: ReturnType<typeof setup>): HTMLButtonElement[] {
    return Array.from(grids(fixture)[1]?.querySelectorAll('button') ?? []);
  }

  it('étape 1 : choisir une catégorie affiche sa description et les armes précises de cette catégorie (étape 2)', async () => {
    const fixture = setup();
    await fixture.whenStable();

    categoryButtons(fixture)[0].click(); // Arc
    fixture.detectChanges();
    await fixture.whenStable();

    // Revue de code 31.4 (AC2, décision utilisateur) : la description de la catégorie n'est plus en
    // ligne — une pastille ⓘ l'ouvre dans la surface de détail.
    expect(fixture.nativeElement.textContent).not.toContain(
      'Distance, mais difficiles à utiliser. Deux mains.',
    );
    const trigger = fixture.nativeElement.querySelector('.weapon-step__detail-trigger');
    expect(trigger.textContent).toContain('Arc');
    trigger.click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.detail-surface-panel .detail-surface-body').textContent,
    ).toContain('Distance, mais difficiles à utiliser. Deux mains.');
    const items = itemButtons(fixture);
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain('Arc de chasse');
    expect(items[1].textContent).toContain('Arc court');
    expect(items[2].textContent).toContain(GRIMOIRE_TONE['characters_wizard.weapon_custom_card']);
  });

  it('étape 2 : choisir une arme précise émet weaponIdChange et affiche Toucher/Dégâts résolus par catégorie', async () => {
    const fixture = setup();
    await fixture.whenStable();

    const emitted: (string | null)[] = [];
    fixture.componentInstance.weaponIdChange.subscribe((k: string | null) => emitted.push(k));

    categoryButtons(fixture)[0].click(); // Arc
    fixture.detectChanges();
    await fixture.whenStable();

    itemButtons(fixture)[0].click(); // Arc de chasse
    expect(emitted).toEqual([null, 'arc-de-chasse']);

    fixture.componentRef.setInput('weaponId', 'arc-de-chasse');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Arc de chasse');
    expect(fixture.nativeElement.textContent).toContain('AGI+INT-2');
  });

  it("choisir Mains nues n'affiche pas d'étape 2 et auto-assigne son unique weaponItem", async () => {
    const fixture = setup();
    await fixture.whenStable();

    const emitted: (string | null)[] = [];
    fixture.componentInstance.weaponIdChange.subscribe((k: string | null) => emitted.push(k));

    categoryButtons(fixture)[2].click(); // Mains nues
    fixture.detectChanges();
    await fixture.whenStable();

    expect(emitted).toEqual(['mains-nues']);
    expect(fixture.nativeElement.querySelectorAll('.weapon-step__grid').length).toBe(1);
  });

  it('changer de catégorie après avoir choisi une arme précise réinitialise le choix (émet null)', async () => {
    const fixture = setup();
    fixture.componentRef.setInput('weaponId', 'arc-de-chasse');
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: (string | null)[] = [];
    fixture.componentInstance.weaponIdChange.subscribe((k: string | null) => emitted.push(k));

    categoryButtons(fixture)[1].click(); // Lance
    expect(emitted).toEqual([null]);
  });

  it("retour en arrière sur l'étape : reconstruit la catégorie sélectionnée depuis weaponId", async () => {
    // Simule le cas réel (composant recréé par le @switch du conteneur avec weaponId déjà
    // renseigné) : l'input doit être positionné AVANT le premier detectChanges, sinon l'effet de
    // resynchronisation (qui ne s'exécute qu'une fois) se déclenche avec weaponId encore absent.
    TestBed.configureTestingModule({ imports: [WeaponStep] });
    const fixture = TestBed.createComponent(WeaponStep);
    fixture.componentRef.setInput('weaponItems', WEAPON_ITEMS);
    fixture.componentRef.setInput('weaponCategories', WEAPON_CATEGORIES);
    fixture.componentRef.setInput('weaponId', 'lance');
    fixture.detectChanges();
    await fixture.whenStable();

    const items = itemButtons(fixture);
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Lance');
    expect(items[1].textContent).toContain(GRIMOIRE_TONE['characters_wizard.weapon_custom_card']);
  });

  it('aucune catégorie sélectionnée → aucune étape 2 ni détail affichés', async () => {
    const fixture = setup();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('.weapon-step__grid').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.weapon-step__detail')).toBeNull();
    expect(fixture.nativeElement.querySelector('.weapon-step__category-description')).toBeNull();
  });

  describe('arme libre (Story 25.2)', () => {
    it('sélectionner "Créer une arme libre" affiche l\'input et efface weaponId', async () => {
      TestBed.configureTestingModule({ imports: [WeaponStep] });
      const fixture = TestBed.createComponent(WeaponStep);
      fixture.componentRef.setInput('weaponItems', WEAPON_ITEMS);
      fixture.componentRef.setInput('weaponCategories', WEAPON_CATEGORIES);
      fixture.componentRef.setInput('weaponId', 'arc-de-chasse');
      fixture.detectChanges();
      await fixture.whenStable();

      const emitted: (string | null)[] = [];
      fixture.componentInstance.weaponIdChange.subscribe((k: string | null) => emitted.push(k));

      itemButtons(fixture)[2].click(); // Créer une arme libre (catégorie déjà resynchronisée sur Arc)
      fixture.detectChanges();
      await fixture.whenStable();

      expect(emitted).toEqual([null]);
      expect(fixture.nativeElement.querySelector('#customWeaponName')).not.toBeNull();
    });

    it('taper un nom émet customWeaponChange avec { name, categoryId } de la catégorie courante', async () => {
      const fixture = setup();
      await fixture.whenStable();

      const emitted: ({ name: string; categoryId: string } | null)[] = [];
      fixture.componentInstance.customWeaponChange.subscribe(
        (c: { name: string; categoryId: string } | null) => emitted.push(c),
      );

      categoryButtons(fixture)[0].click(); // Arc
      fixture.detectChanges();
      itemButtons(fixture)[2].click(); // Créer une arme libre
      fixture.detectChanges();
      await fixture.whenStable();

      const input: HTMLInputElement = fixture.nativeElement.querySelector('#customWeaponName');
      input.value = 'Fléau maison';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(emitted.at(-1)).toEqual({ name: 'Fléau maison', categoryId: 'arc' });
    });

    it('choisir ensuite une arme du catalogue efface le customWeapon (émission null)', async () => {
      TestBed.configureTestingModule({ imports: [WeaponStep] });
      const fixture = TestBed.createComponent(WeaponStep);
      fixture.componentRef.setInput('weaponItems', WEAPON_ITEMS);
      fixture.componentRef.setInput('weaponCategories', WEAPON_CATEGORIES);
      fixture.componentRef.setInput('customWeapon', { name: 'Fléau maison', categoryId: 'arc' });
      fixture.detectChanges();
      await fixture.whenStable();

      const emitted: ({ name: string; categoryId: string } | null)[] = [];
      fixture.componentInstance.customWeaponChange.subscribe(
        (c: { name: string; categoryId: string } | null) => emitted.push(c),
      );

      itemButtons(fixture)[0].click(); // Arc de chasse (arme du catalogue)
      fixture.detectChanges();
      await fixture.whenStable();

      expect(emitted).toEqual([null]);
    });

    it('changer de catégorie après avoir créé une arme libre réinitialise l’état custom', async () => {
      const fixture = setup();
      fixture.componentRef.setInput('customWeapon', { name: 'Fléau maison', categoryId: 'arc' });
      fixture.detectChanges();
      await fixture.whenStable();

      const emitted: ({ name: string; categoryId: string } | null)[] = [];
      fixture.componentInstance.customWeaponChange.subscribe(
        (c: { name: string; categoryId: string } | null) => emitted.push(c),
      );

      categoryButtons(fixture)[1].click(); // Lance
      fixture.detectChanges();
      await fixture.whenStable();

      expect(emitted).toEqual([null]);
      expect(fixture.nativeElement.querySelector('#customWeaponName')).toBeNull();
    });

    it('retour en arrière avec customWeapon déjà renseigné resynchronise (input pré-rempli, bonne catégorie)', async () => {
      TestBed.configureTestingModule({ imports: [WeaponStep] });
      const fixture = TestBed.createComponent(WeaponStep);
      fixture.componentRef.setInput('weaponItems', WEAPON_ITEMS);
      fixture.componentRef.setInput('weaponCategories', WEAPON_CATEGORIES);
      fixture.componentRef.setInput('customWeapon', { name: 'Fléau maison', categoryId: 'lance' });
      fixture.detectChanges();
      await fixture.whenStable();

      const input: HTMLInputElement = fixture.nativeElement.querySelector('#customWeaponName');
      expect(input.value).toBe('Fléau maison');
      expect(fixture.nativeElement.textContent).toContain('Fléau maison');
      expect(fixture.nativeElement.textContent).toContain('VIG+AGI'); // formules héritées de Lance
    });
  });
});
