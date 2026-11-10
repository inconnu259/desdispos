import { TestBed } from '@angular/core/testing';
import type { CalendarLayerKey } from '@desdispos/shared';
import { CalendarLayerToggle } from './calendar-layer-toggle';

async function createToggle(keys: CalendarLayerKey[], active: CalendarLayerKey[]) {
  await TestBed.configureTestingModule({ imports: [CalendarLayerToggle] }).compileComponents();
  const fixture = TestBed.createComponent(CalendarLayerToggle);
  fixture.componentRef.setInput('keys', keys);
  fixture.componentRef.setInput('active', active);
  fixture.detectChanges();
  return fixture;
}

describe('CalendarLayerToggle', () => {
  afterEach(() => TestBed.resetTestingModule());

  const KEYS: CalendarLayerKey[] = ['mes-disponibilites', 'mes-indisponibilites'];

  it('affiche un bouton par couche fournie, libellé via theme.tone()', async () => {
    const fixture = await createToggle(KEYS, KEYS);
    const buttons = fixture.nativeElement.querySelectorAll('.layer-chip');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent.trim()).toBe('Mes disponibilités');
  });

  it('une couche active porte la classe --active et aria-pressed="true"', async () => {
    const fixture = await createToggle(KEYS, ['mes-disponibilites']);
    const buttons = fixture.nativeElement.querySelectorAll('.layer-chip');
    expect(buttons[0].classList.contains('layer-chip--active')).toBe(true);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].classList.contains('layer-chip--active')).toBe(false);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('clic sur une couche émet layerToggled avec sa clé', async () => {
    const fixture = await createToggle(KEYS, KEYS);
    const emitted: CalendarLayerKey[] = [];
    fixture.componentInstance.layerToggled.subscribe((k) => emitted.push(k));

    fixture.nativeElement.querySelectorAll('.layer-chip')[0].click();

    expect(emitted).toEqual(['mes-disponibilites']);
  });

  /**
   * ⚠️ Story 36.14 — les deux tests du bouton « Rétablir » ne sont pas supprimés, ils ont
   * DÉMÉNAGÉ avec lui : ils vivent dans `calendar-display-panel.spec.ts` (chemin explicite) et
   * dans `calendar-view.spec.ts` (pastille de résumé, D-4). Ce qui reste vrai ici, et que ce test
   * verrouille, c'est que le bandeau ne le porte plus.
   */
  it('ne porte plus le bouton de rétablissement — il est remonté dans le panneau (D-4)', async () => {
    const fixture = await createToggle(KEYS, KEYS);
    expect(fixture.nativeElement.querySelector('.layer-toggle__reset')).toBeNull();
  });

  it('se rend sans aucun input — aucun input requis', async () => {
    await TestBed.configureTestingModule({ imports: [CalendarLayerToggle] }).compileComponents();
    const fixture = TestBed.createComponent(CalendarLayerToggle);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.layer-toggle')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.layer-chip')).toHaveLength(0);
  });
});
