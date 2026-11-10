import { TestBed } from '@angular/core/testing';
import { DestinyBoard, type DestinyBoardModel } from './destiny-board';

const MODEL: DestinyBoardModel = {
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
  absent: { text: '3 n’ont pas encore répondu', whoLabel: null },
  announcement: 'Créneau 2 sur 2, dimanche 25 octobre, matin, 1 oui',
  actions: null,
};

async function createBoard(model: DestinyBoardModel = MODEL) {
  await TestBed.configureTestingModule({ imports: [DestinyBoard] }).compileComponents();
  const fixture = TestBed.createComponent(DestinyBoard);
  fixture.componentRef.setInput('model', model);
  fixture.detectChanges();
  return fixture;
}

describe('DestinyBoard (Story 44.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('montre le titre, le sous-titre et les créneaux dans l’ordre reçu', async () => {
    const root: HTMLElement = (await createBoard()).nativeElement;
    expect(root.querySelector('.destiny-board__title')?.textContent).toContain('Soirée jeux');
    expect(root.querySelector('.destiny-board__subtitle')?.textContent).toContain(
      '2 réponses sur 5',
    );
    const labels = [...root.querySelectorAll('.destiny-board__slot-label')].map((e) =>
      e.textContent?.trim(),
    );
    expect(labels).toEqual(['sam. 24 oct. · Soir', 'dim. 25 oct. · Matin']);
  });

  it('« meilleur » seulement sur le créneau désigné, le courant est entouré et dit par aria-current', async () => {
    const root: HTMLElement = (await createBoard()).nativeElement;
    const rows = root.querySelectorAll<HTMLElement>('.destiny-board__slot');
    expect(root.querySelectorAll('.destiny-board__best')).toHaveLength(1);
    expect(rows[0].querySelector('.destiny-board__best')?.textContent).toContain('meilleur');
    expect(rows[1].classList).toContain('destiny-board__slot--current');
    expect(rows[1].getAttribute('aria-current')).toBe('true');
    expect(rows[0].getAttribute('aria-current')).toBeNull();
  });

  it('le titre est précédé du pictogramme destinee, décoratif', async () => {
    const root: HTMLElement = (await createBoard()).nativeElement;
    const icon = root.querySelector('.destiny-board__title app-icon')!;
    expect(icon.getAttribute('data-icon')).toBe('destinee');
    expect(icon.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('.destiny-board__title')!.textContent).not.toContain('✦');
  });

  it('la barre des oui est proportionnelle', async () => {
    const root: HTMLElement = (await createBoard()).nativeElement;
    const fills = root.querySelectorAll<HTMLElement>('.destiny-board__bar-fill');
    expect(fills[0].style.width).toBe('60%');
    expect(fills[1].style.width).toBe('20%');
  });

  it('toucher un créneau émet son optionId', async () => {
    const fixture = await createBoard();
    const chosen: string[] = [];
    fixture.componentInstance.slotChosen.subscribe((id) => chosen.push(id));
    fixture.nativeElement.querySelectorAll('.destiny-board__slot')[1].click();
    expect(chosen).toEqual(['b']);
  });

  it('l’annonce du créneau courant vit dans une région aria-live polie', async () => {
    const root: HTMLElement = (await createBoard()).nativeElement;
    const live = root.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain('Créneau 2 sur 2, dimanche 25 octobre, matin, 1 oui');
  });

  it('sans absent, aucune ligne ; avec « voir qui », le lien émet whoRequested', async () => {
    const none = await createBoard({ ...MODEL, absent: null });
    expect(none.nativeElement.querySelector('.destiny-board__absent')).toBeNull();
    TestBed.resetTestingModule();

    const withLink = await createBoard({
      ...MODEL,
      absent: { text: '3 n’ont pas encore répondu', whoLabel: 'voir qui' },
    });
    let emitted = 0;
    withLink.componentInstance.whoRequested.subscribe(() => emitted++);
    withLink.nativeElement.querySelector('.destiny-board__who').click();
    expect(emitted).toBe(1);
  });
});

describe('DestinyBoard — annonce portée par l’hôte (Story 44.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('sans `announce`, le plateau ne rend aucune région aria-live', async () => {
    await TestBed.configureTestingModule({ imports: [DestinyBoard] }).compileComponents();
    const fixture = TestBed.createComponent(DestinyBoard);
    fixture.componentRef.setInput('model', MODEL);
    fixture.componentRef.setInput('announce', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-live]')).toBeNull();
  });
});

describe("DestinyBoard — actions d'organisateur (Story 44.6)", () => {
  afterEach(() => TestBed.resetTestingModule());

  it('sans droit, aucune action', async () => {
    const root: HTMLElement = (await createBoard()).nativeElement;
    expect(root.querySelector('.destiny-board__actions')).toBeNull();
  });

  it('« Fixer la date… » et « Prolonger le vote » demandent chacun leur confirmation', async () => {
    const fixture = await createBoard({
      ...MODEL,
      actions: { fixLabel: 'Fixer la date…', extendLabel: 'Prolonger le vote' },
    });
    let fix = 0;
    let extend = 0;
    fixture.componentInstance.fixRequested.subscribe(() => fix++);
    fixture.componentInstance.extendRequested.subscribe(() => extend++);
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('.destiny-board__fix')!.click();
    root.querySelector<HTMLButtonElement>('.destiny-board__extend')!.click();
    expect(root.querySelector('.destiny-board__fix')!.textContent!.trim()).toBe('Fixer la date…');
    expect([fix, extend]).toEqual([1, 1]);
  });

  it('un seul droit : un seul bouton', async () => {
    const root: HTMLElement = (
      await createBoard({ ...MODEL, actions: { fixLabel: 'Fixer la date…', extendLabel: null } })
    ).nativeElement;
    expect(root.querySelector('.destiny-board__fix')).not.toBeNull();
    expect(root.querySelector('.destiny-board__extend')).toBeNull();
  });
});

describe('DestinyBoard — modifier et proposer ailleurs (Story 45.6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const WITH = {
    ...MODEL,
    actions: {
      fixLabel: null,
      extendLabel: null,
      modifyLabel: 'Modifier les dates',
      otherLabel: 'Proposer des dates pour un autre rendez-vous',
    },
  };

  it('montre « Modifier les dates » et, SOUS les actions, le lien « autre rendez-vous » — deux vrais boutons', async () => {
    const root: HTMLElement = (await createBoard(WITH)).nativeElement;
    const modify = root.querySelector<HTMLButtonElement>('.destiny-board__modify')!;
    const other = root.querySelector<HTMLButtonElement>('.destiny-board__other')!;
    expect(modify.textContent?.trim()).toBe('Modifier les dates');
    expect(other.textContent?.trim()).toBe('Proposer des dates pour un autre rendez-vous');
    expect(other.tagName).toBe('BUTTON');
    // Le lien n'est pas dans la rangée des boutons : il est sous elle.
    expect(root.querySelector('.destiny-board__actions')!.contains(other)).toBe(false);
  });

  it('chacun demande son action, sans rien écrire lui-même', async () => {
    const fixture = await createBoard(WITH);
    const modify = vi.fn();
    const other = vi.fn();
    fixture.componentInstance.modifyRequested.subscribe(modify);
    fixture.componentInstance.otherRequested.subscribe(other);
    const root: HTMLElement = fixture.nativeElement;

    root.querySelector<HTMLButtonElement>('.destiny-board__modify')!.click();
    root.querySelector<HTMLButtonElement>('.destiny-board__other')!.click();

    expect(modify).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it('sans libellé, aucun des deux : absents, jamais désactivés', async () => {
    const root: HTMLElement = (
      await createBoard({
        ...MODEL,
        actions: {
          fixLabel: 'Fixer la date…',
          extendLabel: null,
          modifyLabel: null,
          otherLabel: null,
        },
      })
    ).nativeElement;
    expect(root.querySelector('.destiny-board__modify')).toBeNull();
    expect(root.querySelector('.destiny-board__other')).toBeNull();
    expect(root.querySelector('.destiny-board__fix')).not.toBeNull();
  });
});
