import { TestBed } from '@angular/core/testing';
import { EncumbranceBar } from './encumbrance-bar';
import { TONE_MAP } from '../../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

describe('EncumbranceBar', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('poids sous la limite → label correct, pas de classe over-limit, pas de texte "Surchargé"', async () => {
    TestBed.configureTestingModule({ imports: [EncumbranceBar] });
    const fixture = TestBed.createComponent(EncumbranceBar);
    fixture.componentRef.setInput('totalWeight', 5);
    fixture.componentRef.setInput('limit', 9);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('5');
    expect(el.textContent).toContain('9');
    expect(el.querySelector('.encumbrance-bar--over')).toBeNull();
    expect(el.textContent).not.toContain(GRIMOIRE_TONE['evolution.inventory_overweight_label']);
  });

  it('poids au-dessus de la limite → classe over-limit + texte "Surchargé" présent', async () => {
    TestBed.configureTestingModule({ imports: [EncumbranceBar] });
    const fixture = TestBed.createComponent(EncumbranceBar);
    fixture.componentRef.setInput('totalWeight', 12);
    fixture.componentRef.setInput('limit', 9);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.encumbrance-bar--over')).not.toBeNull();
    expect(el.textContent).toContain(GRIMOIRE_TONE['evolution.inventory_overweight_label']);
  });

  it('poids exactement égal à la limite → pas surchargé (strictement supérieur requis)', async () => {
    TestBed.configureTestingModule({ imports: [EncumbranceBar] });
    const fixture = TestBed.createComponent(EncumbranceBar);
    fixture.componentRef.setInput('totalWeight', 9);
    fixture.componentRef.setInput('limit', 9);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.encumbrance-bar--over')).toBeNull();
  });

  it('surcharge → pictogramme avertissement avant le texte, sans caractère ⚠', async () => {
    TestBed.configureTestingModule({ imports: [EncumbranceBar] });
    const fixture = TestBed.createComponent(EncumbranceBar);
    fixture.componentRef.setInput('totalWeight', 12);
    fixture.componentRef.setInput('limit', 9);
    fixture.detectChanges();
    await fixture.whenStable();

    const flag = (fixture.nativeElement as HTMLElement).querySelector(
      '.encumbrance-bar__over-flag',
    ) as HTMLElement;
    expect(flag.querySelector('app-icon')?.getAttribute('data-icon')).toBe('avertissement');
    expect(flag.textContent).not.toContain('⚠');
  });
});
