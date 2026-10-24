import { TestBed } from '@angular/core/testing';
import type { DestinyBoardModel } from '../destiny-board/destiny-board';
import { DestinySheet, type DestinySheetModel } from './destiny-sheet';

const BOARD: DestinyBoardModel = {
  title: 'Soirée jeux',
  subtitle: 'Fin du vote ven. 30 oct. · 2 réponses sur 5',
  slotsAria: 'Créneaux candidats',
  bestLabel: 'meilleur',
  slots: [
    {
      optionId: 'a',
      label: 'sam. 24 oct. · Soir',
      yesText: '3 oui',
      ratio: 0.6,
      best: true,
      current: false,
    },
    {
      optionId: 'b',
      label: 'dim. 25 oct. · Matin',
      yesText: '1 oui',
      ratio: 0.2,
      best: false,
      current: true,
    },
  ],
  absent: { text: '3 n’ont pas encore répondu', whoLabel: 'voir qui' },
  announcement: 'Créneau 2 sur 2, dimanche 25 octobre, matin, 1 oui',
};

const MODEL: DestinySheetModel = {
  region: 'Destinée : Soirée jeux',
  title: 'Soirée jeux',
  summary: '2 / 2 · dim. 25 oct. matin · 1 oui · fin du vote ven. 30 oct.',
  state: 'organizer',
  stateLabel: 'Organisateur',
  datesLabel: 'Voir les 2 dates',
  hideLabel: 'Replier',
  collapseAria: 'Replier le plateau de la destinée',
  announcement: BOARD.announcement,
  board: BOARD,
};

async function createSheet(expanded = false) {
  await TestBed.configureTestingModule({ imports: [DestinySheet] }).compileComponents();
  const fixture = TestBed.createComponent(DestinySheet);
  fixture.componentRef.setInput('model', MODEL);
  fixture.componentRef.setInput('expanded', expanded);
  fixture.detectChanges();
  return fixture;
}

describe('DestinySheet (Story 44.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('est une région nommée « Destinée : … », sans fond assombri ni piège de focus', async () => {
    const root: HTMLElement = (await createSheet()).nativeElement;
    const region = root.querySelector('[role="region"]')!;
    expect(region.getAttribute('aria-label')).toBe('Destinée : Soirée jeux');
    expect(region.getAttribute('aria-modal')).toBeNull();
    expect(root.querySelector('.cdk-overlay-backdrop, [cdkTrapFocus]')).toBeNull();
  });

  it('replié : le titre, le résumé, la pastille d’état et « Voir les N dates », sans le plateau', async () => {
    const root: HTMLElement = (await createSheet()).nativeElement;
    expect(root.querySelector('.destiny-sheet__title')?.textContent).toContain('Soirée jeux');
    expect(root.querySelector('.destiny-sheet__summary')?.textContent).toContain(
      '2 / 2 · dim. 25 oct. matin · 1 oui',
    );
    expect(root.querySelector('.destiny-sheet__pill')?.textContent?.trim()).toBe('Organisateur');
    expect(root.querySelector('.destiny-sheet__toggle')?.textContent).toContain('Voir les 2 dates');
    expect(root.querySelector('app-destiny-board')).toBeNull();
  });

  it('la poignée et le bouton portent aria-expanded et aria-controls', async () => {
    const root: HTMLElement = (await createSheet()).nativeElement;
    for (const sel of ['.destiny-sheet__handle', '.destiny-sheet__toggle']) {
      const el = root.querySelector(sel)!;
      expect(el.getAttribute('aria-expanded'), sel).toBe('false');
      const controlled = el.getAttribute('aria-controls')!;
      expect(root.querySelector(`#${controlled}`), sel).not.toBeNull();
    }
    // Replié, la poignée se nomme par son texte, pas par une étiquette qui le masquerait.
    expect(root.querySelector('.destiny-sheet__handle')!.getAttribute('aria-label')).toBeNull();
  });

  it('la poignée comme « Voir les N dates » demandent la bascule', async () => {
    const fixture = await createSheet();
    let toggled = 0;
    fixture.componentInstance.toggled.subscribe(() => toggled++);
    fixture.nativeElement.querySelector('.destiny-sheet__handle').click();
    fixture.nativeElement.querySelector('.destiny-sheet__toggle').click();
    expect(toggled).toBe(2);
  });

  it('déplié : le plateau complet, « Replier », aria-expanded vrai, poignée nommée', async () => {
    const root: HTMLElement = (await createSheet(true)).nativeElement;
    expect(root.querySelector('app-destiny-board')).not.toBeNull();
    expect(root.querySelectorAll('.destiny-board__slot')).toHaveLength(2);
    expect(root.querySelector('.destiny-sheet__toggle')?.textContent).toContain('Replier');
    expect(root.querySelector('.destiny-sheet__toggle')!.getAttribute('aria-expanded')).toBe(
      'true',
    );
    const handle = root.querySelector('.destiny-sheet__handle')!;
    expect(handle.getAttribute('aria-expanded')).toBe('true');
    expect(handle.getAttribute('aria-label')).toBe('Replier le plateau de la destinée');
    expect(root.querySelector('.destiny-sheet__summary')).toBeNull();
  });

  it('une seule région aria-live, déplié ou non', async () => {
    for (const expanded of [false, true]) {
      const root: HTMLElement = (await createSheet(expanded)).nativeElement;
      const live = root.querySelectorAll('[aria-live]');
      expect(live, `expanded=${expanded}`).toHaveLength(1);
      expect(live[0].textContent).toContain('Créneau 2 sur 2');
      TestBed.resetTestingModule();
    }
  });

  it('toucher un créneau et « voir qui » remontent', async () => {
    const fixture = await createSheet(true);
    const chosen: string[] = [];
    let who = 0;
    fixture.componentInstance.slotChosen.subscribe((id) => chosen.push(id));
    fixture.componentInstance.whoRequested.subscribe(() => who++);
    fixture.nativeElement.querySelectorAll('.destiny-board__slot')[0].click();
    fixture.nativeElement.querySelector('.destiny-board__who').click();
    expect(chosen).toEqual(['a']);
    expect(who).toBe(1);
  });
});
