import { TestBed } from '@angular/core/testing';
import type { CalendarLayerKey } from '@master-jdr/shared';
import { CalendarDisplayPanel } from './calendar-display-panel';

const KEYS: CalendarLayerKey[] = ['mes-indisponibilites', 'mes-disponibilites', 'mes-seances'];

async function createPanel(overrides: Record<string, unknown> = {}) {
  await TestBed.configureTestingModule({ imports: [CalendarDisplayPanel] }).compileComponents();
  const fixture = TestBed.createComponent(CalendarDisplayPanel);
  for (const [name, value] of Object.entries(overrides)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  return fixture;
}

describe('CalendarDisplayPanel', () => {
  afterEach(() => TestBed.resetTestingModule());

  /**
   * 🚨 Piège payé quatre stories de suite (36.9 n°18, 36.10 n°11, 36.11 n°20, 36.12 n°21) : un
   * `input.required` neuf fait tomber tous les appelants qui ne le passent pas encore. Ce test
   * verrouille l'absence d'obligation — le composant doit se rendre sans un seul input.
   */
  it('se rend sans aucun input — aucun input requis', async () => {
    const fixture = await createPanel();
    expect(fixture.nativeElement.querySelector('.display-panel')).toBeTruthy();
  });

  it('affiche l’intertitre « Ce que je vois » puis la bande de couches (AC2)', async () => {
    const fixture = await createPanel({ keys: KEYS, active: KEYS });
    const root = fixture.nativeElement;
    expect(root.querySelector('.display-panel__section-title').textContent.trim()).toBe(
      'Ce que je vois',
    );
    expect(root.querySelectorAll('app-calendar-layer-toggle .layer-chip')).toHaveLength(3);
  });

  /**
   * 🚨 AC12 — la Destinée et « Ajouter des dates » sont des MODES, pas des filtres : ils restent
   * frères de la barre et n'entrent jamais ici. Ce composant ne les connaît même pas ; le test
   * verrouille cette ignorance côté panneau, son pendant côté barre vit dans `calendar-view.spec`.
   */
  it('ne contient ni le contrôle Destinée ni l’armement de composition (AC12)', async () => {
    const fixture = await createPanel({ keys: KEYS, active: KEYS });
    const root = fixture.nativeElement;
    expect(root.querySelector('app-destiny-control')).toBeNull();
    expect(root.querySelector('.compose-arm')).toBeNull();
  });

  it('clic sur une couche émet layerToggled avec sa clé', async () => {
    const fixture = await createPanel({ keys: KEYS, active: KEYS });
    const emitted: CalendarLayerKey[] = [];
    fixture.componentInstance.layerToggled.subscribe((k) => emitted.push(k));

    fixture.nativeElement.querySelectorAll('.layer-chip')[0].click();

    expect(emitted).toEqual(['mes-indisponibilites']);
  });

  it('l’interrupteur de légende est présent et décoché par défaut (AC5)', async () => {
    const fixture = await createPanel({ keys: KEYS, active: KEYS });
    const toggle = fixture.nativeElement.querySelector('.display-panel__legend-toggle');
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.textContent.trim()).toBe('Afficher la légende');
  });

  it('clic sur l’interrupteur de légende émet legendToggled', async () => {
    const fixture = await createPanel({ keys: KEYS, active: KEYS });
    let toggled = false;
    fixture.componentInstance.legendToggled.subscribe(() => (toggled = true));

    fixture.nativeElement.querySelector('.display-panel__legend-toggle').click();

    expect(toggled).toBe(true);
  });

  it('légende visible → l’interrupteur porte aria-pressed="true"', async () => {
    const fixture = await createPanel({ keys: KEYS, active: KEYS, legendVisible: true });
    expect(
      fixture.nativeElement
        .querySelector('.display-panel__legend-toggle')
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  /**
   * D-4 — « Rétablir » vit à DEUX endroits : ici, chemin explicite, et sur la pastille de résumé,
   * raccourci contextuel. Le contrat dessine les deux (`contrat-ui-calendrier.html:609` et `:243`).
   */
  it('le bouton de rétablissement est toujours présent et émet resetRequested (D-4)', async () => {
    const fixture = await createPanel({ keys: KEYS, active: KEYS });
    const btn = fixture.nativeElement.querySelector('.display-panel__reset');
    expect(btn).toBeTruthy();

    let reset = false;
    fixture.componentInstance.resetRequested.subscribe(() => (reset = true));
    btn.click();

    expect(reset).toBe(true);
  });
});

const PARTIES = [
  { id: 'a', name: 'La Bande' },
  { id: 'b', name: 'Les Cendres' },
  { id: 'c', name: 'Soirée jeux' },
];

describe('CalendarDisplayPanel — le filtre par partie (Story 44.8)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('sans partie, aucune section', async () => {
    const fixture = await createPanel();
    expect(fixture.nativeElement.querySelector('.display-panel__parties')).toBeNull();
  });

  it('liste les parties par leur nom, cochées par défaut, avec le titre du thème', async () => {
    const fixture = await createPanel({ parties: PARTIES });
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
    const fixture = await createPanel({ parties: PARTIES, hiddenPartieIds: new Set(['b']) });
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
