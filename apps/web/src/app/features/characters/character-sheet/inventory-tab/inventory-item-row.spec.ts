import { TestBed } from '@angular/core/testing';
import { InventoryItemRow } from './inventory-item-row';
import { TONE_MAP } from '../../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

describe('InventoryItemRow', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affiche le nom et le poids', async () => {
    TestBed.configureTestingModule({ imports: [InventoryItemRow] });
    const fixture = TestBed.createComponent(InventoryItemRow);
    fixture.componentRef.setInput('item', {
      id: 'item-1',
      name: 'Cape',
      weight: 1.2,
      addedBy: 'player',
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Cape');
    expect(el.textContent).toContain('1.2');
  });

  it('badge "ajouté par le MJ" visible seulement si addedBy === "mj"', async () => {
    TestBed.configureTestingModule({ imports: [InventoryItemRow] });
    const fixture = TestBed.createComponent(InventoryItemRow);
    fixture.componentRef.setInput('item', {
      id: 'item-1',
      name: 'Cape',
      weight: 1,
      addedBy: 'player',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.inventory-item-row__badge')).toBeNull();

    fixture.componentRef.setInput('item', {
      id: 'item-2',
      name: 'Lettre',
      weight: 0,
      addedBy: 'mj',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.inventory-item-row__badge')).not.toBeNull();
  });

  it('boutons éditer/supprimer absents si editable=false', async () => {
    TestBed.configureTestingModule({ imports: [InventoryItemRow] });
    const fixture = TestBed.createComponent(InventoryItemRow);
    fixture.componentRef.setInput('item', {
      id: 'item-1',
      name: 'Cape',
      weight: 1,
      addedBy: 'player',
    });
    fixture.componentRef.setInput('editable', false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
  });

  it('clic éditer/supprimer émet les events attendus quand editable=true et removable=true (propriétaire)', async () => {
    TestBed.configureTestingModule({ imports: [InventoryItemRow] });
    const fixture = TestBed.createComponent(InventoryItemRow);
    fixture.componentRef.setInput('item', {
      id: 'item-1',
      name: 'Cape',
      weight: 1,
      addedBy: 'player',
    });
    fixture.componentRef.setInput('editable', true);
    fixture.componentRef.setInput('removable', true);
    fixture.detectChanges();
    await fixture.whenStable();

    let edited = false;
    let removed = false;
    fixture.componentInstance.edit.subscribe(() => (edited = true));
    fixture.componentInstance.remove.subscribe(() => (removed = true));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    (buttons[0] as HTMLButtonElement).click();
    (buttons[1] as HTMLButtonElement).click();

    expect(edited).toBe(true);
    expect(removed).toBe(true);
  });

  it('weight absent (animal) → aucun élément de poids rendu (Story 14.2, FR8)', async () => {
    TestBed.configureTestingModule({ imports: [InventoryItemRow] });
    const fixture = TestBed.createComponent(InventoryItemRow);
    fixture.componentRef.setInput('item', {
      id: 'ani-1',
      name: 'Cheval',
      addedBy: 'player',
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.inventory-item-row__weight')).toBeNull();
  });

  it('price/effect renseignés → affichés ; absents → aucun élément vide/orphelin (Story 14.2)', async () => {
    TestBed.configureTestingModule({ imports: [InventoryItemRow] });
    const fixture = TestBed.createComponent(InventoryItemRow);
    fixture.componentRef.setInput('item', {
      id: 'item-1',
      name: 'Sac',
      weight: 2,
      price: '5 po',
      effect: 'Contient 10 objets',
      addedBy: 'player',
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.inventory-item-row__price')?.textContent).toBe(
      '5 po',
    );
    expect(fixture.nativeElement.querySelector('.inventory-item-row__effect')?.textContent).toBe(
      'Contient 10 objets',
    );

    fixture.componentRef.setInput('item', {
      id: 'item-2',
      name: 'Corde',
      weight: 1,
      addedBy: 'player',
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.inventory-item-row__price')).toBeNull();
    expect(fixture.nativeElement.querySelector('.inventory-item-row__effect')).toBeNull();
  });

  it('removable=false → bouton "Supprimer" absent même si editable=true (MJ : édite mais ne supprime pas)', async () => {
    TestBed.configureTestingModule({ imports: [InventoryItemRow] });
    const fixture = TestBed.createComponent(InventoryItemRow);
    fixture.componentRef.setInput('item', {
      id: 'item-1',
      name: 'Cape',
      weight: 1,
      addedBy: 'player',
    });
    fixture.componentRef.setInput('editable', true);
    fixture.componentRef.setInput('removable', false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector(
        `button[aria-label="${GRIMOIRE_TONE['characters_sheet.item_edit_aria']}"]`,
      ),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Supprimer l\'objet"]'),
    ).toBeNull();
  });

  it('les boutons modifier et supprimer portent les pictogrammes modifier et supprimer, sans second nom', async () => {
    TestBed.configureTestingModule({ imports: [InventoryItemRow] });
    const fixture = TestBed.createComponent(InventoryItemRow);
    fixture.componentRef.setInput('item', {
      id: 'item-1',
      name: 'Cape',
      weight: 1,
      addedBy: 'player',
    });
    fixture.componentRef.setInput('editable', true);
    fixture.componentRef.setInput('removable', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.map((b) => b.querySelector('app-icon')?.getAttribute('data-icon'))).toEqual([
      'modifier',
      'supprimer',
    ]);
    // Le nom du bouton reste son aria-label : l'icône est décorative.
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      GRIMOIRE_TONE['characters_sheet.item_edit_aria'],
      GRIMOIRE_TONE['characters_sheet.item_remove_aria'],
    ]);
    expect(buttons[0].querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
