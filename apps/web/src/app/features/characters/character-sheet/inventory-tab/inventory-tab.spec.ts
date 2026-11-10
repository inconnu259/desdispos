import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { InventoryTab } from './inventory-tab';
import { CharacterService } from '../../../../core/characters/character.service';
import { makeCharacterDto } from '../../../../core/characters/character-dto.fixture';
import { TONE_MAP } from '../../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function makeCharacterWithItems(
  items: { id: string; name: string; weight: number; addedBy: string }[],
  contenants: { id: string; name: string; weight: number; addedBy: string }[] = [],
  animaux: { id: string; name: string; addedBy: string }[] = [],
) {
  return makeCharacterDto({
    sheetData: { equipment: { individual: items, contenants, animaux } },
    derived: { PV: 16, PE: 12, Condition: 14, Initiative: 10, Encombrement: 9 },
  });
}

async function createComponent(characterSvc: Partial<CharacterService>, isOwner = true) {
  await TestBed.configureTestingModule({
    imports: [InventoryTab],
    providers: [{ provide: CharacterService, useValue: characterSvc }],
  }).compileComponents();
  const fixture = TestBed.createComponent(InventoryTab);
  fixture.componentRef.setInput('character', makeCharacterWithItems([]));
  fixture.componentRef.setInput('isOwner', isOwner);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('InventoryTab', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('rend la liste + EncumbranceBar avec le bon total', async () => {
    const characterSvc = { addInventoryItem: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [InventoryTab],
      providers: [{ provide: CharacterService, useValue: characterSvc }],
    }).compileComponents();
    const fixture = TestBed.createComponent(InventoryTab);
    fixture.componentRef.setInput(
      'character',
      makeCharacterWithItems([
        { id: 'item-1', name: 'Cape', weight: 1.2, addedBy: 'player' },
        { id: 'item-2', name: 'Sac', weight: 3, addedBy: 'player' },
      ]),
    );
    fixture.componentRef.setInput('isOwner', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Cape');
    expect(el.textContent).toContain('Sac');
    expect(el.textContent).toContain('4.2'); // 1.2 + 3
  });

  it('derived absent (attributs verrouillés, Story 31.6) : EncumbranceBar omis, aucune erreur', async () => {
    const characterSvc = { addInventoryItem: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [InventoryTab],
      providers: [{ provide: CharacterService, useValue: characterSvc }],
    }).compileComponents();
    const fixture = TestBed.createComponent(InventoryTab);
    fixture.componentRef.setInput('character', {
      ...makeCharacterWithItems([]),
      derived: undefined as never,
      hiddenFields: ['attributes', 'derived'],
    });
    fixture.componentRef.setInput('isOwner', true);
    expect(() => fixture.detectChanges()).not.toThrow();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-encumbrance-bar')).toBeNull();
  });

  it('equipment verrouillé (correctif, hiddenFields) : « Masqué par le MJ » sur la barre d’encombrement + les 3 sous-sections, jamais « vide »', async () => {
    const characterSvc = { addInventoryItem: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [InventoryTab],
      providers: [{ provide: CharacterService, useValue: characterSvc }],
    }).compileComponents();
    const fixture = TestBed.createComponent(InventoryTab);
    fixture.componentRef.setInput('character', {
      ...makeCharacterWithItems([]),
      hiddenFields: ['attributes', 'equipment', 'derived'],
    });
    fixture.componentRef.setInput('isOwner', false);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(
      (text.match(new RegExp(GRIMOIRE_TONE['evolution.hidden_marker'], 'g')) ?? []).length,
    ).toBe(4);
    expect(fixture.nativeElement.querySelector('app-encumbrance-bar')).toBeNull();
    expect(text).not.toContain("Aucun objet dans l'inventaire");
    expect(text).not.toContain('Aucun contenant pour le moment');
    expect(text).not.toContain('Aucun animal pour le moment');
  });

  it('correctif de revue : equipment SEUL verrouillé (attributes/derived visibles) — la barre d’encombrement affiche « Masqué par le MJ », jamais « 0 / limite »', async () => {
    const characterSvc = { addInventoryItem: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [InventoryTab],
      providers: [{ provide: CharacterService, useValue: characterSvc }],
    }).compileComponents();
    const fixture = TestBed.createComponent(InventoryTab);
    fixture.componentRef.setInput('character', {
      ...makeCharacterWithItems([]),
      hiddenFields: ['equipment'],
    });
    fixture.componentRef.setInput('isOwner', false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-encumbrance-bar')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['evolution.hidden_marker']);
  });

  it('equipment non verrouillé et vide : messages « vide » habituels conservés', async () => {
    const fixture = await createComponent({ addInventoryItem: vi.fn() });
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Masqué par le MJ');
  });

  it('formulaire d’ajout absent si isOwner=false', async () => {
    const fixture = await createComponent({ addInventoryItem: vi.fn() }, false);
    expect(fixture.nativeElement.querySelector('.inventory-tab__add-form')).toBeNull();
  });

  it('ajout appelle characterSvc.addInventoryItem avec le payload attendu et émet characterUpdated', async () => {
    const updated = makeCharacterWithItems([
      { id: 'item-1', name: 'Cape', weight: 1, addedBy: 'player' },
    ]);
    const characterSvc = { addInventoryItem: vi.fn().mockResolvedValue(updated) };
    const fixture = await createComponent(characterSvc);
    const comp = fixture.componentInstance as any;

    let emitted: unknown = null;
    comp.characterUpdated.subscribe((c: unknown) => (emitted = c));

    comp.newItemName.set('Cape');
    comp.newItemWeight.set(1);
    await comp.submitAdd();

    expect(characterSvc.addInventoryItem).toHaveBeenCalledWith('char1', {
      name: 'Cape',
      weight: 1,
    });
    expect(emitted).toEqual(updated);
  });

  it('édition appelle updateInventoryItem avec le bon itemId (pas un index)', async () => {
    const updated = makeCharacterWithItems([
      { id: 'item-2', name: 'Cape usée', weight: 1, addedBy: 'player' },
    ]);
    const characterSvc = { updateInventoryItem: vi.fn().mockResolvedValue(updated) };
    await TestBed.configureTestingModule({
      imports: [InventoryTab],
      providers: [{ provide: CharacterService, useValue: characterSvc }],
    }).compileComponents();
    const fixture = TestBed.createComponent(InventoryTab);
    fixture.componentRef.setInput(
      'character',
      makeCharacterWithItems([
        { id: 'item-1', name: 'Sac', weight: 3, addedBy: 'player' },
        { id: 'item-2', name: 'Cape', weight: 1, addedBy: 'player' },
      ]),
    );
    fixture.componentRef.setInput('isOwner', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance as any;

    // Édite le 2e objet (id 'item-2') — prouve que l'adressage se fait par id, pas par position.
    comp.startEdit({ id: 'item-2', name: 'Cape', weight: 1, addedBy: 'player' });
    comp.editName.set('Cape usée');
    await comp.submitEdit('item-2');

    expect(characterSvc.updateInventoryItem).toHaveBeenCalledWith('char1', 'item-2', {
      name: 'Cape usée',
      weight: 1,
    });
  });

  it('vider le champ poids en édition (NaN) remet le poids à 0, ne conserve pas l’ancien poids (régression revue de code)', async () => {
    const updated = makeCharacterWithItems([
      { id: 'item-1', name: 'Cape', weight: 0, addedBy: 'player' },
    ]);
    const characterSvc = { updateInventoryItem: vi.fn().mockResolvedValue(updated) };
    await TestBed.configureTestingModule({
      imports: [InventoryTab],
      providers: [{ provide: CharacterService, useValue: characterSvc }],
    }).compileComponents();
    const fixture = TestBed.createComponent(InventoryTab);
    fixture.componentRef.setInput(
      'character',
      makeCharacterWithItems([{ id: 'item-1', name: 'Cape', weight: 2, addedBy: 'player' }]),
    );
    fixture.componentRef.setInput('isOwner', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance as any;

    comp.startEdit({ id: 'item-1', name: 'Cape', weight: 2, addedBy: 'player' });
    comp.onEditWeightInput(NaN); // simule un <input type="number"> vidé par l'utilisateur
    await comp.submitEdit('item-1');

    expect(characterSvc.updateInventoryItem).toHaveBeenCalledWith('char1', 'item-1', {
      name: 'Cape',
      weight: 0,
    });
  });

  it('suppression appelle removeInventoryItem avec l’itemId', async () => {
    const updated = makeCharacterWithItems([]);
    const characterSvc = { removeInventoryItem: vi.fn().mockResolvedValue(updated) };
    await TestBed.configureTestingModule({
      imports: [InventoryTab],
      providers: [{ provide: CharacterService, useValue: characterSvc }],
    }).compileComponents();
    const fixture = TestBed.createComponent(InventoryTab);
    fixture.componentRef.setInput(
      'character',
      makeCharacterWithItems([{ id: 'item-1', name: 'Cape', weight: 1, addedBy: 'player' }]),
    );
    fixture.componentRef.setInput('isOwner', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance as any;

    await comp.removeItem('item-1');

    expect(characterSvc.removeInventoryItem).toHaveBeenCalledWith('char1', 'item-1');
  });

  it('erreur réseau à l’ajout affiche le message inline', async () => {
    const characterSvc = { addInventoryItem: vi.fn().mockRejectedValue(new Error('boom')) };
    const fixture = await createComponent(characterSvc);
    const comp = fixture.componentInstance as any;

    comp.newItemName.set('Cape');
    await comp.submitAdd();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['evolution.inventory_error']);
  });

  it('empty state si aucun objet', async () => {
    const fixture = await createComponent({ addInventoryItem: vi.fn() });
    expect(fixture.nativeElement.querySelector('.inventory-tab__empty')).not.toBeNull();
  });

  describe('édition MJ (Story 6.6)', () => {
    async function createMjComponent(
      characterSvc: Partial<CharacterService>,
      items: { id: string; name: string; weight: number; addedBy: string }[] = [
        { id: 'item-1', name: 'Corde', weight: 1, addedBy: 'player' },
      ],
    ) {
      await TestBed.configureTestingModule({
        imports: [InventoryTab],
        providers: [{ provide: CharacterService, useValue: characterSvc }],
      }).compileComponents();
      const fixture = TestBed.createComponent(InventoryTab);
      fixture.componentRef.setInput('character', makeCharacterWithItems(items));
      fixture.componentRef.setInput('isOwner', false);
      fixture.componentRef.setInput('viewerIsMj', true);
      fixture.detectChanges();
      await fixture.whenStable();
      return fixture;
    }

    it('MJ (viewerIsMj:true, isOwner:false) → pencil "Modifier" visible, "Supprimer" absent', async () => {
      const fixture = await createMjComponent({});

      expect(
        fixture.nativeElement.querySelectorAll(
          `.inventory-item-row button[aria-label="${GRIMOIRE_TONE['characters_sheet.item_edit_aria']}"]`,
        ).length,
      ).toBe(1);
      expect(
        fixture.nativeElement.querySelector('button[aria-label="Supprimer l\'objet"]'),
      ).toBeNull();
    });

    it('MJ → formulaire d’ajout MJ visible', async () => {
      const fixture = await createMjComponent({});
      expect(fixture.nativeElement.querySelector('.inventory-tab__mj-add-form')).not.toBeNull();
    });

    it('submitMjEdit() appelle setSheetField avec equipment.individual.<index correct>', async () => {
      const updated = makeCharacterWithItems([]);
      const characterSvc = {
        setSheetField: vi.fn().mockResolvedValue({ character: updated, warnings: [] }),
      };
      const fixture = await createMjComponent(characterSvc, [
        { id: 'item-1', name: 'Corde', weight: 1, addedBy: 'player' },
        { id: 'item-2', name: 'Sac', weight: 2, addedBy: 'player' },
      ]);
      const comp = fixture.componentInstance as any;

      comp.startEdit({ id: 'item-2', name: 'Sac', weight: 2, addedBy: 'player' });
      comp.editName.set('Sac renforcé');
      await comp.submitMjEdit('item-2');

      expect(characterSvc.setSheetField).toHaveBeenCalledWith('char1', 'equipment.individual.1', {
        name: 'Sac renforcé',
        weight: 2,
        id: 'item-2',
      });
    });

    it('submitMjAdd() appelle setSheetField avec equipment.individual.<longueur actuelle>', async () => {
      const updated = makeCharacterWithItems([]);
      const characterSvc = {
        setSheetField: vi.fn().mockResolvedValue({ character: updated, warnings: [] }),
      };
      const fixture = await createMjComponent(characterSvc, [
        { id: 'item-1', name: 'Corde', weight: 1, addedBy: 'player' },
      ]);
      const comp = fixture.componentInstance as any;

      comp.newItemName.set('Lettre scellée');
      comp.newItemWeight.set(0.1);
      await comp.submitMjAdd();

      expect(characterSvc.setSheetField).toHaveBeenCalledWith('char1', 'equipment.individual.1', {
        name: 'Lettre scellée',
        weight: 0.1,
      });
    });

    it('propriétaire (isOwner:true, viewerIsMj:false) → comportement inchangé, submitEdit/submitAdd toujours appelés (pas setSheetField)', async () => {
      const updated = makeCharacterWithItems([]);
      const characterSvc = {
        addInventoryItem: vi.fn().mockResolvedValue(updated),
        setSheetField: vi.fn(),
      };
      const fixture = await createComponent(characterSvc, true);
      const comp = fixture.componentInstance as any;

      comp.newItemName.set('Cape');
      await comp.submitAdd();

      expect(characterSvc.addInventoryItem).toHaveBeenCalled();
      expect(characterSvc.setSheetField).not.toHaveBeenCalled();
      expect(
        fixture.nativeElement.querySelectorAll(
          '.inventory-item-row button[aria-label="Supprimer l\'objet"]',
        ).length,
      ).toBe(0); // liste vide dans ce test — juste vérifie qu'aucune erreur de rendu MJ n'apparaît
      expect(fixture.nativeElement.querySelector('.inventory-tab__mj-add-form')).toBeNull();
    });
  });

  describe('Contenants (Story 14.2, FR7)', () => {
    it('rend la liste des contenants, poids inclus dans totalWeight()', async () => {
      const characterSvc = { addContenant: vi.fn() };
      await TestBed.configureTestingModule({
        imports: [InventoryTab],
        providers: [{ provide: CharacterService, useValue: characterSvc }],
      }).compileComponents();
      const fixture = TestBed.createComponent(InventoryTab);
      fixture.componentRef.setInput(
        'character',
        makeCharacterWithItems(
          [{ id: 'item-1', name: 'Cape', weight: 1, addedBy: 'player' }],
          [{ id: 'cont-1', name: 'Sac à dos', weight: 2, addedBy: 'player' }],
        ),
      );
      fixture.componentRef.setInput('isOwner', true);
      fixture.detectChanges();
      await fixture.whenStable();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Sac à dos');
      expect(el.textContent).toContain('3'); // 1 (individual) + 2 (contenant)
    });

    it('ajout propriétaire sans poids → ne soumet pas (poids obligatoire, AC3)', async () => {
      const characterSvc = { addContenant: vi.fn() };
      const fixture = await createComponent(characterSvc);
      const comp = fixture.componentInstance as any;

      comp.newContenantName.set('Sac');
      await comp.submitAddContenant();

      expect(characterSvc.addContenant).not.toHaveBeenCalled();
    });

    it('ajout appelle characterSvc.addContenant avec le payload attendu et émet characterUpdated', async () => {
      const updated = makeCharacterWithItems(
        [],
        [{ id: 'cont-1', name: 'Sac à dos', weight: 2, addedBy: 'player' }],
      );
      const characterSvc = { addContenant: vi.fn().mockResolvedValue(updated) };
      const fixture = await createComponent(characterSvc);
      const comp = fixture.componentInstance as any;

      let emitted: unknown = null;
      comp.characterUpdated.subscribe((c: unknown) => (emitted = c));

      comp.newContenantName.set('Sac à dos');
      comp.newContenantWeight.set(2);
      await comp.submitAddContenant();

      expect(characterSvc.addContenant).toHaveBeenCalledWith('char1', {
        name: 'Sac à dos',
        weight: 2,
      });
      expect(emitted).toEqual(updated);
    });

    it('onNewContenantWeightInput(0) → poids 0 accepté, ne soumet pas à undefined (régression revue de code)', async () => {
      const updated = makeCharacterWithItems(
        [],
        [{ id: 'cont-1', name: 'Boîte vide', weight: 0, addedBy: 'player' }],
      );
      const characterSvc = { addContenant: vi.fn().mockResolvedValue(updated) };
      const fixture = await createComponent(characterSvc);
      const comp = fixture.componentInstance as any;

      comp.newContenantName.set('Boîte vide');
      comp.onNewContenantWeightInput(0);
      await comp.submitAddContenant();

      expect(characterSvc.addContenant).toHaveBeenCalledWith('char1', {
        name: 'Boîte vide',
        weight: 0,
      });
    });

    it('édition avec poids vidé (NaN) → ne soumet pas, poids obligatoire non contourné (régression revue de code, AC3)', async () => {
      const characterSvc = { updateContenant: vi.fn() };
      await TestBed.configureTestingModule({
        imports: [InventoryTab],
        providers: [{ provide: CharacterService, useValue: characterSvc }],
      }).compileComponents();
      const fixture = TestBed.createComponent(InventoryTab);
      fixture.componentRef.setInput(
        'character',
        makeCharacterWithItems([], [{ id: 'cont-1', name: 'Sac', weight: 2, addedBy: 'player' }]),
      );
      fixture.componentRef.setInput('isOwner', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const comp = fixture.componentInstance as any;

      comp.startEditContenant({ id: 'cont-1', name: 'Sac', weight: 2, addedBy: 'player' });
      comp.onEditContenantWeightInput(NaN); // simule un <input type="number"> vidé
      await comp.submitEditContenant('cont-1');

      expect(characterSvc.updateContenant).not.toHaveBeenCalled();
    });

    it('édition MJ avec poids vidé (NaN) → ne soumet pas via setSheetField (régression revue de code, AC3)', async () => {
      const characterSvc = { setSheetField: vi.fn() };
      await TestBed.configureTestingModule({
        imports: [InventoryTab],
        providers: [{ provide: CharacterService, useValue: characterSvc }],
      }).compileComponents();
      const fixture = TestBed.createComponent(InventoryTab);
      fixture.componentRef.setInput(
        'character',
        makeCharacterWithItems([], [{ id: 'cont-1', name: 'Sac', weight: 2, addedBy: 'player' }]),
      );
      fixture.componentRef.setInput('isOwner', false);
      fixture.componentRef.setInput('viewerIsMj', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const comp = fixture.componentInstance as any;

      comp.startEditContenant({ id: 'cont-1', name: 'Sac', weight: 2, addedBy: 'player' });
      comp.onEditContenantWeightInput(NaN);
      await comp.submitMjEditContenant('cont-1');

      expect(characterSvc.setSheetField).not.toHaveBeenCalled();
    });

    it('édition appelle updateContenant avec le bon itemId', async () => {
      const updated = makeCharacterWithItems([]);
      const characterSvc = { updateContenant: vi.fn().mockResolvedValue(updated) };
      await TestBed.configureTestingModule({
        imports: [InventoryTab],
        providers: [{ provide: CharacterService, useValue: characterSvc }],
      }).compileComponents();
      const fixture = TestBed.createComponent(InventoryTab);
      fixture.componentRef.setInput(
        'character',
        makeCharacterWithItems([], [{ id: 'cont-1', name: 'Sac', weight: 2, addedBy: 'player' }]),
      );
      fixture.componentRef.setInput('isOwner', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const comp = fixture.componentInstance as any;

      comp.startEditContenant({ id: 'cont-1', name: 'Sac', weight: 2, addedBy: 'player' });
      comp.editContenantWeight.set(3);
      await comp.submitEditContenant('cont-1');

      expect(characterSvc.updateContenant).toHaveBeenCalledWith('char1', 'cont-1', {
        name: 'Sac',
        weight: 3,
      });
    });

    it('suppression appelle removeContenant avec l’itemId', async () => {
      const updated = makeCharacterWithItems([]);
      const characterSvc = { removeContenant: vi.fn().mockResolvedValue(updated) };
      const fixture = await createComponent(characterSvc);
      const comp = fixture.componentInstance as any;

      await comp.removeContenant('cont-1');

      expect(characterSvc.removeContenant).toHaveBeenCalledWith('char1', 'cont-1');
    });

    it('erreur réseau à l’ajout de contenant n’affecte pas l’état des objets (sections indépendantes)', async () => {
      const characterSvc = {
        addContenant: vi.fn().mockRejectedValue(new Error('boom')),
        addInventoryItem: vi.fn(),
      };
      const fixture = await createComponent(characterSvc);
      const comp = fixture.componentInstance as any;

      comp.newContenantName.set('Sac');
      comp.newContenantWeight.set(1);
      await comp.submitAddContenant();

      expect(comp.contenantError()).toBeTruthy();
      expect(comp.error()).toBeNull(); // signal d'erreur des objets non affecté
    });
  });

  describe('Animaux (Story 14.2, FR8)', () => {
    it('rend la liste des animaux, jamais de champ poids dans le DOM', async () => {
      const characterSvc = { addAnimal: vi.fn() };
      await TestBed.configureTestingModule({
        imports: [InventoryTab],
        providers: [{ provide: CharacterService, useValue: characterSvc }],
      }).compileComponents();
      const fixture = TestBed.createComponent(InventoryTab);
      fixture.componentRef.setInput(
        'character',
        makeCharacterWithItems([], [], [{ id: 'ani-1', name: 'Cheval', addedBy: 'player' }]),
      );
      fixture.componentRef.setInput('isOwner', true);
      fixture.detectChanges();
      await fixture.whenStable();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Cheval');
      expect(el.querySelector('.inventory-item-row__weight')).toBeNull();
    });

    it('ajout appelle characterSvc.addAnimal sans jamais de champ weight', async () => {
      const updated = makeCharacterWithItems(
        [],
        [],
        [{ id: 'ani-1', name: 'Cheval', addedBy: 'player' }],
      );
      const characterSvc = { addAnimal: vi.fn().mockResolvedValue(updated) };
      const fixture = await createComponent(characterSvc);
      const comp = fixture.componentInstance as any;

      comp.newAnimalName.set('Cheval');
      comp.newAnimalPrice.set('20 po');
      await comp.submitAddAnimal();

      expect(characterSvc.addAnimal).toHaveBeenCalledWith('char1', {
        name: 'Cheval',
        price: '20 po',
      });
      const callArg = characterSvc.addAnimal.mock.calls[0][1];
      expect(callArg).not.toHaveProperty('weight');
    });

    it('édition appelle updateAnimal avec le bon itemId, sans jamais de champ weight', async () => {
      const updated = makeCharacterWithItems([]);
      const characterSvc = { updateAnimal: vi.fn().mockResolvedValue(updated) };
      await TestBed.configureTestingModule({
        imports: [InventoryTab],
        providers: [{ provide: CharacterService, useValue: characterSvc }],
      }).compileComponents();
      const fixture = TestBed.createComponent(InventoryTab);
      fixture.componentRef.setInput(
        'character',
        makeCharacterWithItems([], [], [{ id: 'ani-1', name: 'Cheval', addedBy: 'player' }]),
      );
      fixture.componentRef.setInput('isOwner', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const comp = fixture.componentInstance as any;

      comp.startEditAnimal({ id: 'ani-1', name: 'Cheval', addedBy: 'player' });
      comp.editAnimalEffect.set('Rapide');
      await comp.submitEditAnimal('ani-1');

      expect(characterSvc.updateAnimal).toHaveBeenCalledWith('char1', 'ani-1', {
        name: 'Cheval',
        effect: 'Rapide',
      });
      const callArg = characterSvc.updateAnimal.mock.calls[0][2];
      expect(callArg).not.toHaveProperty('weight');
    });

    it('suppression appelle removeAnimal avec l’itemId', async () => {
      const updated = makeCharacterWithItems([]);
      const characterSvc = { removeAnimal: vi.fn().mockResolvedValue(updated) };
      const fixture = await createComponent(characterSvc);
      const comp = fixture.componentInstance as any;

      await comp.removeAnimal('ani-1');

      expect(characterSvc.removeAnimal).toHaveBeenCalledWith('char1', 'ani-1');
    });

    it('aucun champ poids dans le formulaire d’ajout de la section Animaux (DOM)', async () => {
      const fixture = await createComponent({ addAnimal: vi.fn() });
      const forms = fixture.nativeElement.querySelectorAll('.inventory-tab__section');
      const animauxSection = Array.from(forms).find((s: any) =>
        s.querySelector('h3')?.textContent?.includes('Animaux'),
      ) as HTMLElement;
      expect(animauxSection.querySelector('input[type="number"]')).toBeNull();
    });
  });
});
