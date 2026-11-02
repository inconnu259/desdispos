import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FieldEditPencil } from './field-edit-pencil';
import { fillTone } from '../../../../core/theme/tone-format';
import { TONE_MAP } from '../../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

async function createComponent(
  value: string | number = 'Lanterne',
  type: 'text' | 'number' = 'text',
) {
  await TestBed.configureTestingModule({
    imports: [FieldEditPencil],
  }).compileComponents();
  const fixture = TestBed.createComponent(FieldEditPencil);
  fixture.componentRef.setInput('label', "l'objet fétiche");
  fixture.componentRef.setInput('value', value);
  fixture.componentRef.setInput('type', type);
  fixture.detectChanges();
  return fixture;
}

describe('FieldEditPencil', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affiche le bouton crayon par défaut avec le bon aria-label', async () => {
    const fixture = await createComponent();

    const pencil = fixture.nativeElement.querySelector(
      '.field-edit-pencil__button',
    ) as HTMLButtonElement;
    expect(pencil).not.toBeNull();
    expect(pencil.getAttribute('aria-label')).toBe(
      fillTone(GRIMOIRE_TONE['characters_sheet.field_edit_aria'], { label: "l'objet fétiche" }),
    );
    expect(fixture.nativeElement.querySelector('.field-edit-pencil__form')).toBeNull();
  });

  it('clic sur le crayon → passe en mode édition, input pré-rempli avec value()', async () => {
    const fixture = await createComponent('Lanterne');

    (
      fixture.nativeElement.querySelector('.field-edit-pencil__button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      '.field-edit-pencil__input',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('Lanterne');
    expect(fixture.nativeElement.querySelector('.field-edit-pencil__button')).toBeNull();
  });

  it('"Valider" émet confirm avec la valeur du draft et repasse en mode lecture', async () => {
    const fixture = await createComponent('Lanterne');
    const emitted: (string | number)[] = [];
    fixture.componentInstance.confirm.subscribe((v) => emitted.push(v));

    (
      fixture.nativeElement.querySelector('.field-edit-pencil__button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      '.field-edit-pencil__input',
    ) as HTMLInputElement;
    input.value = 'Lanterne magique';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('.field-edit-pencil__confirm') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(emitted).toEqual(['Lanterne magique']);
    expect(fixture.nativeElement.querySelector('.field-edit-pencil__button')).not.toBeNull();
  });

  it('type="number" : "Valider" émet un nombre (cast depuis le draft)', async () => {
    const fixture = await createComponent(4, 'number');
    const emitted: (string | number)[] = [];
    fixture.componentInstance.confirm.subscribe((v) => emitted.push(v));

    (
      fixture.nativeElement.querySelector('.field-edit-pencil__button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      '.field-edit-pencil__input',
    ) as HTMLInputElement;
    input.value = '6';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('.field-edit-pencil__confirm') as HTMLButtonElement
    ).click();

    expect(emitted).toEqual([6]);
    expect(typeof emitted[0]).toBe('number');
  });

  it('type="number" : vider le champ puis "Valider" ne soumet rien (bloque, ne convertit pas silencieusement en 0 — revue de code)', async () => {
    const fixture = await createComponent(4, 'number');
    const emitted: (string | number)[] = [];
    fixture.componentInstance.confirm.subscribe((v) => emitted.push(v));

    (
      fixture.nativeElement.querySelector('.field-edit-pencil__button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      '.field-edit-pencil__input',
    ) as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('.field-edit-pencil__confirm') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    // Le formulaire reste ouvert (pas de retour en mode lecture) tant que la valeur est invalide.
    expect(fixture.nativeElement.querySelector('.field-edit-pencil__form')).not.toBeNull();
  });

  it('options fourni → input a un attribut list pointant vers un datalist avec une option par entrée', async () => {
    const fixture = await createComponent('arc');
    fixture.componentRef.setInput('options', [
      { key: 'arc', label: 'Arc' },
      { key: 'epee', label: 'Épée' },
    ]);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('.field-edit-pencil__button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      '.field-edit-pencil__input',
    ) as HTMLInputElement;
    const listId = input.getAttribute('list');
    expect(listId).toBeTruthy();
    const datalist = fixture.nativeElement.querySelector(`datalist#${listId}`);
    expect(datalist).not.toBeNull();
    const options = datalist!.querySelectorAll('option');
    expect(options.length).toBe(2);
    expect(options[0].getAttribute('value')).toBe('arc');
    expect(options[1].getAttribute('value')).toBe('epee');
  });

  it('options non fourni (défaut []) → pas d’attribut list, pas de datalist (régression)', async () => {
    const fixture = await createComponent('Lanterne');

    (
      fixture.nativeElement.querySelector('.field-edit-pencil__button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      '.field-edit-pencil__input',
    ) as HTMLInputElement;
    expect(input.getAttribute('list')).toBeNull();
    expect(fixture.nativeElement.querySelector('datalist')).toBeNull();
  });

  it('"Annuler" repasse en mode lecture sans émettre confirm', async () => {
    const fixture = await createComponent('Lanterne');
    const confirmSpy = vi.fn();
    fixture.componentInstance.confirm.subscribe(confirmSpy);

    (
      fixture.nativeElement.querySelector('.field-edit-pencil__button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      '.field-edit-pencil__input',
    ) as HTMLInputElement;
    input.value = 'Valeur abandonnée';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('.field-edit-pencil__cancel') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.field-edit-pencil__button')).not.toBeNull();

    // Ré-ouverture : le draft doit repartir de value(), pas de la valeur abandonnée.
    (
      fixture.nativeElement.querySelector('.field-edit-pencil__button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const reopenedInput = fixture.nativeElement.querySelector(
      '.field-edit-pencil__input',
    ) as HTMLInputElement;
    expect(reopenedInput.value).toBe('Lanterne');
  });

  it('lecture : pictogramme modifier ; édition : valider puis fermer, noms des boutons inchangés', async () => {
    const fixture = await createComponent();
    const el = fixture.nativeElement as HTMLElement;

    const pencil = el.querySelector('.field-edit-pencil__button') as HTMLButtonElement;
    expect(pencil.querySelector('app-icon')?.getAttribute('data-icon')).toBe('modifier');
    expect(pencil.getAttribute('aria-label')).toBe(
      fillTone(GRIMOIRE_TONE['characters_sheet.field_edit_aria'], { label: "l'objet fétiche" }),
    );

    pencil.click();
    fixture.detectChanges();

    const confirm = el.querySelector('.field-edit-pencil__confirm') as HTMLButtonElement;
    const cancel = el.querySelector('.field-edit-pencil__cancel') as HTMLButtonElement;
    expect(confirm.querySelector('app-icon')?.getAttribute('data-icon')).toBe('valider');
    expect(cancel.querySelector('app-icon')?.getAttribute('data-icon')).toBe('fermer');
    expect(confirm.getAttribute('aria-label')).toBe(GRIMOIRE_TONE['common.valider']);
    expect(cancel.getAttribute('aria-label')).toBe(GRIMOIRE_TONE['common.annuler']);
  });
});
