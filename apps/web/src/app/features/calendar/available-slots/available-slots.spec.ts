import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { AvailableSlotsPanel } from './available-slots';
import type { AvailableSlotDto } from '@master-jdr/shared';

const SLOT: AvailableSlotDto = {
  date: '2026-07-04',
  slot: 'MORNING',
  members: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays', status: 'AVAILABLE' }],
  durationSlots: 1,
};

describe('AvailableSlotsPanel', () => {
  let fixture: ComponentFixture<AvailableSlotsPanel>;
  let el: HTMLElement;

  function create(opts: {
    slots?: AvailableSlotDto[];
    loading?: boolean;
    error?: string | null;
  }): void {
    fixture = TestBed.createComponent(AvailableSlotsPanel);
    fixture.componentRef.setInput('slots', opts.slots ?? []);
    fixture.componentRef.setInput('loading', opts.loading ?? false);
    fixture.componentRef.setInput('error', opts.error ?? null);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AvailableSlotsPanel] });
  });

  it('affiche le spinner/squelette quand loading=true', () => {
    create({ loading: true });
    expect(el.querySelector('.available-slots__loading')).toBeTruthy();
    expect(el.querySelector('.available-slots__empty')).toBeFalsy();
    expect(el.querySelector('.available-slots__list')).toBeFalsy();
  });

  it('affiche empty.no_slots quand slots=[] et pas de loading', () => {
    create({ slots: [] });
    expect(el.querySelector('.available-slots__empty')).toBeTruthy();
    expect(el.querySelector('.available-slots__list')).toBeFalsy();
  });

  it('affiche un CreneauCard par slot quand slots non vide', () => {
    create({ slots: [SLOT, { ...SLOT, slot: 'AFTERNOON' }] });
    const cards = el.querySelectorAll('app-creneau-card');
    expect(cards.length).toBe(2);
    expect(el.querySelector('.available-slots__empty')).toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 36.8, AC9 — « Fenêtres de la destinée » reste la LECTURE LONGUE
//
// Cette section ne livre RIEN de neuf : la différenciation par rôle existe depuis la 30.6. Elle
// la verrouille, parce que la story 36.8 vient d'ajouter un `members?` optionnel à
// `AggregatedSlotDto` — ce qui a rendu le discriminant historique (`'members' in s`) ambigu. Sans
// ces tests, un joueur pourrait un jour se voir servir la carte nominative sans que rien ne
// tombe.
// ─────────────────────────────────────────────────────────────────────────────

describe('AvailableSlotsPanel — la lecture longue par rôle (Story 36.8, AC9)', () => {
  let fixture: ComponentFixture<AvailableSlotsPanel>;
  let el: HTMLElement;

  function create(slots: unknown[]): void {
    fixture = TestBed.createComponent(AvailableSlotsPanel);
    fixture.componentRef.setInput('slots', slots);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('error', null);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AvailableSlotsPanel] });
  });

  it('MJ — la carte NOMMÉE, avec les membres et leur statut', () => {
    create([SLOT]);
    expect(el.querySelector('app-creneau-card')).toBeTruthy();
    expect(el.querySelector('app-aggregated-creneau-card')).toBeFalsy();
  });

  it('🚨 Joueur — la carte AGRÉGÉE, aucune identité, même si la charge utile porte des compteurs', () => {
    create([
      {
        date: '2026-07-04',
        slot: 'MORNING',
        available: 2,
        unavailable: 1,
        unknown: 1,
        total: 4,
      },
    ]);

    expect(el.querySelector('app-aggregated-creneau-card')).toBeTruthy();
    expect(el.querySelector('app-creneau-card')).toBeFalsy();
    expect(el.textContent).not.toContain('Alice');
  });

  it('🚨 le discriminant ne se laisse plus tromper par un `members` optionnel sur l’agrégat', () => {
    // Exactement la forme que `GET /parties/:id/heatmap` sert désormais au MJ (Story 36.8) : des
    // agrégats ET des identités. Ce n'est PAS un `AvailableSlotDto` — c'est un agrégat enrichi, et
    // ce panneau doit continuer de le lire comme tel. Avec l'ancien test `'members' in s`, il
    // aurait basculé sur la carte nominative et lu `s.members` sans garantie.
    create([
      {
        date: '2026-07-04',
        slot: 'MORNING',
        available: 1,
        unavailable: 0,
        unknown: 1,
        total: 2,
        members: [
          { userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays', status: 'AVAILABLE' },
        ],
      },
    ]);

    expect(el.querySelector('app-aggregated-creneau-card')).toBeTruthy();
    expect(el.querySelector('app-creneau-card')).toBeFalsy();
  });
});

// Story 46.1 — le titre porte le nombre de fenêtres ; sous 768 px il devient un bouton qui replie la liste.
describe('AvailableSlotsPanel — titre et repli (Story 46.1)', () => {
  let fixture: ComponentFixture<AvailableSlotsPanel>;
  let el: HTMLElement;

  function create(inputs: Record<string, unknown>): void {
    fixture = TestBed.createComponent(AvailableSlotsPanel);
    fixture.componentRef.setInput('slots', [SLOT, { ...SLOT, slot: 'AFTERNOON' }]);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [AvailableSlotsPanel] }));

  it('le titre dit « Éphémérides · 2 », sans bouton quand la liste n’est pas repliable', () => {
    create({});
    expect(el.querySelector('.available-slots__title')!.textContent!.trim()).toBe(
      'Éphémérides · 2',
    );
    expect(el.querySelector('.available-slots__fold')).toBeNull();
  });

  it('pendant le chargement, le titre n’annonce pas encore de nombre', () => {
    create({ loading: true });
    expect(el.querySelector('.available-slots__title')!.textContent!.trim()).toBe('Éphémérides');
  });

  it('repliable : un bouton pleine largeur aria-expanded, la liste visible quand elle est dépliée', () => {
    create({ foldable: true, folded: false });
    const fold = el.querySelector<HTMLButtonElement>('.available-slots__fold')!;
    expect(fold.getAttribute('aria-expanded')).toBe('true');
    expect(fold.textContent).toContain('Éphémérides · 2');
    expect(el.querySelectorAll('app-creneau-card')).toHaveLength(2);
    expect(fold.querySelector('app-icon')!.getAttribute('data-icon')).toBe('replier');
  });

  it('repliée : seul le titre reste, aria-expanded=false, et le clic demande de basculer', () => {
    create({ foldable: true, folded: true });
    const fold = el.querySelector<HTMLButtonElement>('.available-slots__fold')!;
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('.available-slots__list')).toBeNull();
    expect(fold.querySelector('app-icon')!.getAttribute('data-icon')).toBe('deplier');
    expect(el.querySelector('.available-slots__empty')).toBeNull();

    let toggled = 0;
    fixture.componentInstance.foldToggled.subscribe(() => toggled++);
    fold.click();
    expect(toggled).toBe(1);
  });

  it('« repliée » n’a aucun effet quand la liste n’est pas repliable (≥ 768 px)', () => {
    create({ foldable: false, folded: true });
    expect(el.querySelectorAll('app-creneau-card')).toHaveLength(2);
  });
});

// Story 46.2 — sélectionner une fenêtre de l'automate : la vue nominative du MJ seulement.
describe('AvailableSlotsPanel — sélection d’une fenêtre (Story 46.2)', () => {
  let fixture: ComponentFixture<AvailableSlotsPanel>;
  let el: HTMLElement;
  const OTHER: AvailableSlotDto = { ...SLOT, slot: 'AFTERNOON' };

  function create(inputs: Record<string, unknown>, slots: unknown[] = [SLOT, OTHER]): void {
    fixture = TestBed.createComponent(AvailableSlotsPanel);
    fixture.componentRef.setInput('slots', slots);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [AvailableSlotsPanel] }));

  it('la carte dont la clé est celle de la sélection est marquée, les autres non', () => {
    create({ selectable: true, selectedKey: '2026-07-04|MORNING' });
    const cards = [...el.querySelectorAll('.creneau-card')];
    expect(cards[0].classList).toContain('creneau-card--selected');
    expect(cards[1].classList).not.toContain('creneau-card--selected');
  });

  it('toucher une carte émet la fenêtre ; retoucher la sélectionnée émet null', () => {
    create({ selectable: true, selectedKey: null });
    const emitted: unknown[] = [];
    fixture.componentInstance.slotSelected.subscribe((s) => emitted.push(s));
    el.querySelectorAll<HTMLButtonElement>('.creneau-card__select')[1].click();
    expect(emitted).toEqual([OTHER]);

    fixture.componentRef.setInput('selectedKey', '2026-07-04|AFTERNOON');
    fixture.detectChanges();
    el.querySelectorAll<HTMLButtonElement>('.creneau-card__select')[1].click();
    expect(emitted).toEqual([OTHER, null]);
  });

  it('vue des joueurs (cartes agrégées) : rien à sélectionner', () => {
    create({ selectable: true }, [
      { date: '2026-07-04', slot: 'MORNING', total: 2, available: 2, unavailable: 0 },
    ]);
    expect(el.querySelector('app-aggregated-creneau-card')).not.toBeNull();
    expect(el.querySelector('.creneau-card__select')).toBeNull();
  });
});

// Story 46.4 — les fenêtres masquées : un lien en pied de liste, puis chacune avec « Démasquer ».
describe('AvailableSlotsPanel — fenêtres masquées (Story 46.4)', () => {
  let fixture: ComponentFixture<AvailableSlotsPanel>;
  let el: HTMLElement;
  const HIDDEN: AvailableSlotDto = { ...SLOT, date: '2026-07-09', hidden: true };

  function create(inputs: Record<string, unknown>): void {
    fixture = TestBed.createComponent(AvailableSlotsPanel);
    fixture.componentRef.setInput('slots', [SLOT]);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [AvailableSlotsPanel] }));

  it('sans masquée : pas de lien', () => {
    create({});
    expect(el.querySelector('.available-slots__hidden-toggle')).toBeNull();
  });

  it('avec une masquée : le lien (aria-expanded) la montre, sans la compter dans le titre', () => {
    create({ hiddenSlots: [HIDDEN] });
    expect(el.querySelector('.available-slots__title')!.textContent!.trim()).toBe(
      'Éphémérides · 1',
    );
    const toggle = el.querySelector<HTMLButtonElement>('.available-slots__hidden-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent!.trim()).toBe('Afficher les 1 masquées');

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent!.trim()).toBe('Replier les masquées');
    expect(
      el.querySelectorAll('.available-slots__list--hidden .creneau-card--hidden'),
    ).toHaveLength(1);
  });

  it('« Démasquer » émet la fenêtre ; « Masquer » de la carte sélectionnée aussi', () => {
    create({ hiddenSlots: [HIDDEN], selectable: true, selectedKey: '2026-07-04|MORNING' });
    const shown: unknown[] = [];
    const hid: unknown[] = [];
    fixture.componentInstance.showRequested.subscribe((s) => shown.push(s));
    fixture.componentInstance.hideRequested.subscribe((s) => hid.push(s));

    el.querySelectorAll<HTMLButtonElement>('.creneau-card__action')[1].click();
    expect(hid).toEqual([SLOT]);

    el.querySelector<HTMLButtonElement>('.available-slots__hidden-toggle')!.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>(
      '.available-slots__list--hidden .creneau-card__action',
    )!.click();
    expect(shown).toEqual([HIDDEN]);
  });

  it('repliée (sous 768 px) : le lien disparaît avec la liste', () => {
    create({ hiddenSlots: [HIDDEN], foldable: true, folded: true });
    expect(el.querySelector('.available-slots__hidden-toggle')).toBeNull();
  });
});
