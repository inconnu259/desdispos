import { TestBed } from '@angular/core/testing';
import { CalendarDisplayPanel } from './calendar-display-panel';

const PARTIES = [
  { id: 'a', name: 'La Bande' },
  { id: 'b', name: 'Les Cendres' },
  { id: 'c', name: 'Soirée jeux' },
];

async function create(inputs: Record<string, unknown> = {}) {
  await TestBed.configureTestingModule({ imports: [CalendarDisplayPanel] }).compileComponents();
  const fixture = TestBed.createComponent(CalendarDisplayPanel);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture;
}

describe('CalendarDisplayPanel — le filtre par partie (Story 44.8)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('sans partie, aucune section', async () => {
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('.display-panel__parties')).toBeNull();
  });

  it('liste les parties par leur nom, cochées par défaut, avec le titre du thème', async () => {
    const fixture = await create({ parties: PARTIES });
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.display-panel__parties legend')!.textContent!.trim()).toBe(
      'Seulement ces rendez-vous',
    );
    const rows = Array.from(root.querySelectorAll<HTMLLabelElement>('.display-panel__partie'));
    expect(rows.map((r) => r.textContent!.trim())).toEqual([
      'La Bande',
      'Les Cendres',
      'Soirée jeux',
    ]);
    expect(
      Array.from(root.querySelectorAll<HTMLInputElement>('.display-panel__partie input')).map(
        (i) => i.checked,
      ),
    ).toEqual([true, true, true]);
  });

  it('une partie masquée est décochée ; cocher ou décocher émet son identifiant', async () => {
    const fixture = await create({ parties: PARTIES, hiddenPartieIds: new Set(['b']) });
    const root: HTMLElement = fixture.nativeElement;
    const inputs = Array.from(
      root.querySelectorAll<HTMLInputElement>('.display-panel__partie input'),
    );
    expect(inputs.map((i) => i.checked)).toEqual([true, false, true]);

    const toggled: string[] = [];
    fixture.componentInstance.partieToggled.subscribe((id) => toggled.push(id));
    inputs[0].click();
    inputs[1].click();
    expect(toggled).toEqual(['a', 'b']);
  });
});
