import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { CreneauCard } from './creneau-card';
import type { AvailableSlotDto } from '@master-jdr/shared';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function makeSlot(overrides: Partial<AvailableSlotDto> = {}): AvailableSlotDto {
  return {
    date: '2026-07-04',
    slot: 'MORNING',
    members: [
      { userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays', status: 'AVAILABLE' },
      { userId: 'u2', pseudo: 'Bob', displayName: 'Bobby', status: 'AVAILABLE' },
    ],
    durationSlots: 1,
    ...overrides,
  };
}

describe('CreneauCard', () => {
  let fixture: ComponentFixture<CreneauCard>;
  let el: HTMLElement;

  function create(slot: AvailableSlotDto): void {
    fixture = TestBed.createComponent(CreneauCard);
    fixture.componentRef.setInput('slot', slot);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CreneauCard] });
  });

  it('affiche la date et le label MORNING → "Matin"', () => {
    create(makeSlot({ date: '2026-07-04', slot: 'MORNING' }));
    expect(el.textContent).toContain('juillet');
    expect(el.textContent).toContain('Matin');
  });

  it('Story 47.6 — une fenêtre de plusieurs créneaux s’écrit sur une ligne « début → fin »', () => {
    create(makeSlot({ date: '2026-07-04', slot: 'AFTERNOON', durationSlots: 2 }));
    const range = el.querySelector('.creneau-card__range')!;
    expect(range.textContent).toContain('après-midi');
    expect(range.textContent).toContain('→');
    expect(range.textContent).toContain('soir');
    expect(el.querySelector('.creneau-card__slot')).toBeNull();
  });

  it('Story 47.6 — une fenêtre d’un créneau garde ses deux lignes jour et créneau', () => {
    create(makeSlot({ date: '2026-07-04', slot: 'AFTERNOON', durationSlots: 1 }));
    expect(el.querySelector('.creneau-card__range')).toBeNull();
    expect(el.querySelector('.creneau-card__slot')!.textContent).toContain('Après-midi');
  });

  it('affiche le tag "Guilde complète" quand tous les membres sont AVAILABLE', () => {
    create(
      makeSlot({
        members: [
          { userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays', status: 'AVAILABLE' },
          { userId: 'u2', pseudo: 'Bob', displayName: 'Bobby', status: 'AVAILABLE' },
        ],
      }),
    );
    expect(el.textContent).toContain(GRIMOIRE_TONE['calendar.card_full_guild']);
  });

  it("affiche l'alerte avec le nom affiché interpolé pour chaque membre UNKNOWN", () => {
    create(
      makeSlot({
        members: [
          { userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays', status: 'AVAILABLE' },
          { userId: 'u2', pseudo: 'Bob', displayName: 'Bobby', status: 'UNKNOWN' },
        ],
      }),
    );
    expect(el.textContent).not.toContain('Guilde complète');
    const alertList = el.querySelector('.creneau-card__alerts');
    expect(alertList).toBeTruthy();
    expect(alertList!.textContent).toContain('Bobby');
  });

  it('chaque membre est rendu via IdentityLabel (icône silhouette + nom affiché, pas le pseudo)', () => {
    create(makeSlot());
    const members = el.querySelectorAll('.creneau-card__member');
    expect(members.length).toBe(2);
    expect(members[0].querySelector('svg')).not.toBeNull();
    expect(members[0].textContent).toContain('Alice au pays');
    expect(members[0].textContent).not.toContain('Bobby');
  });

  it('deux membres avec le même displayName → le pseudo de chacun est affiché en complément (AC3)', () => {
    create(
      makeSlot({
        members: [
          { userId: 'u1', pseudo: 'Alice', displayName: 'Même Nom', status: 'AVAILABLE' },
          { userId: 'u2', pseudo: 'Bob', displayName: 'Même Nom', status: 'AVAILABLE' },
        ],
      }),
    );
    const members = el.querySelectorAll('.creneau-card__member');
    expect(members[0].querySelector('.identity-label__pseudo')?.textContent?.trim()).toBe(
      '(Alice)',
    );
    expect(members[1].querySelector('.identity-label__pseudo')?.textContent?.trim()).toBe('(Bob)');
  });

  it('aucune collision → aucun pseudo affiché (AC3)', () => {
    create(makeSlot());
    expect(el.querySelector('.identity-label__pseudo')).toBeNull();
  });
});

// Story 46.2 — la carte d'une fenêtre de l'automate se sélectionne (vue nominative du MJ seulement).
describe('CreneauCard — sélection (Story 46.2)', () => {
  let fixture: ComponentFixture<CreneauCard>;
  let el: HTMLElement;

  function create(inputs: Record<string, unknown>): void {
    fixture = TestBed.createComponent(CreneauCard);
    fixture.componentRef.setInput('slot', makeSlot());
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('non sélectionnable : ni bouton d’en-tête, ni action, un tap ne fait rien', () => {
    create({});
    const spy = vi.fn();
    fixture.componentInstance.selectToggled.subscribe(spy);
    expect(el.querySelector('.creneau-card__select')).toBeNull();
    el.querySelector<HTMLElement>('.creneau-card')!.click();
    expect(spy).not.toHaveBeenCalled();
    expect(el.querySelector('.creneau-card__actions')).toBeNull();
  });

  it('sélectionnable : l’en-tête est un bouton aria-pressed, la date et le créneau restent lisibles', () => {
    create({ selectable: true });
    const button = el.querySelector<HTMLButtonElement>('.creneau-card__select')!;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.querySelector('.creneau-card__date')).not.toBeNull();
    expect(button.querySelector('.creneau-card__slot')!.textContent).toContain('Matin');
  });

  it('un tap sur la carte et un clic sur le bouton demandent chacun UNE bascule', () => {
    create({ selectable: true });
    const spy = vi.fn();
    fixture.componentInstance.selectToggled.subscribe(spy);

    el.querySelector<HTMLElement>('.creneau-card__member')!.click();
    expect(spy).toHaveBeenCalledTimes(1);
    el.querySelector<HTMLButtonElement>('.creneau-card__select')!.click();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('sélectionnée : contour, aria-pressed, les deux actions actives', () => {
    create({ selectable: true, selected: true });
    expect(el.querySelector('.creneau-card')!.classList).toContain('creneau-card--selected');
    expect(el.querySelector('.creneau-card__select')!.getAttribute('aria-pressed')).toBe('true');
    const actions = [...el.querySelectorAll<HTMLButtonElement>('.creneau-card__action')];
    expect(actions.map((a) => a.textContent!.trim())).toEqual(['Ajouter au vote', 'Masquer']);
    expect(actions.every((a) => a.getAttribute('aria-disabled') === null)).toBe(true);
  });

  it('« Masquer » demande le masquage, sans basculer la sélection ni demander l’ajout', () => {
    create({ selectable: true, selected: true });
    const hide = vi.fn();
    const add = vi.fn();
    const toggled = vi.fn();
    fixture.componentInstance.hideRequested.subscribe(hide);
    fixture.componentInstance.addRequested.subscribe(add);
    fixture.componentInstance.selectToggled.subscribe(toggled);
    el.querySelectorAll<HTMLButtonElement>('.creneau-card__action')[1].click();
    expect(hide).toHaveBeenCalledTimes(1);
    expect(add).not.toHaveBeenCalled();
    expect(toggled).not.toHaveBeenCalled();
  });

  it('une carte de fenêtre masquée : 55 %, « Démasquer », ni sélection ni « Ajouter / Masquer »', () => {
    create({ hiddenWindow: true });
    const show = vi.fn();
    fixture.componentInstance.showRequested.subscribe(show);
    expect(el.querySelector('.creneau-card')!.classList).toContain('creneau-card--hidden');
    const actions = [...el.querySelectorAll<HTMLButtonElement>('.creneau-card__action')];
    expect(actions.map((a) => a.textContent!.trim())).toEqual(['Démasquer']);
    actions[0].click();
    expect(show).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.creneau-card__select')).toBeNull();
  });

  it('sans composer à armer (canAdd faux) : « Ajouter au vote » est désactivé et ne demande rien', () => {
    create({ selectable: true, selected: true, canAdd: false });
    const add = vi.fn();
    fixture.componentInstance.addRequested.subscribe(add);
    const button = el.querySelector<HTMLButtonElement>('.creneau-card__action--primary')!;
    expect(button.getAttribute('aria-disabled')).toBe('true');
    button.click();
    expect(add).not.toHaveBeenCalled();
  });

  it('« Ajouter au vote » demande l’ajout, sans basculer la sélection', () => {
    create({ selectable: true, selected: true });
    const add = vi.fn();
    const toggled = vi.fn();
    fixture.componentInstance.addRequested.subscribe(add);
    fixture.componentInstance.selectToggled.subscribe(toggled);
    el.querySelector<HTMLButtonElement>('.creneau-card__action--primary')!.click();
    expect(add).toHaveBeenCalledTimes(1);
    expect(toggled).not.toHaveBeenCalled();
  });

  it('non sélectionnée : pas d’actions', () => {
    create({ selectable: true, selected: false });
    expect(el.querySelector('.creneau-card__actions')).toBeNull();
  });
});

describe('CreneauCard — pictogrammes de disponibilité (story 51.5)', () => {
  it('les trois statuts ont trois dessins distincts (oui / partiel / non), le nom accessible reste le statut', () => {
    TestBed.configureTestingModule({ imports: [CreneauCard] });
    const fixture = TestBed.createComponent(CreneauCard);
    fixture.componentRef.setInput(
      'slot',
      makeSlot({
        members: [
          { userId: 'u1', pseudo: 'Alice', displayName: 'Alice', status: 'AVAILABLE' },
          { userId: 'u2', pseudo: 'Bob', displayName: 'Bob', status: 'UNKNOWN' },
          { userId: 'u3', pseudo: 'Carl', displayName: 'Carl', status: 'UNAVAILABLE' },
        ],
      }),
    );
    fixture.detectChanges();
    const statuses = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.creneau-card__status'),
    );
    expect(statuses.map((s) => s.getAttribute('aria-label'))).toEqual([
      'AVAILABLE',
      'UNKNOWN',
      'UNAVAILABLE',
    ]);
    expect(statuses.map((s) => s.querySelector('app-icon')!.getAttribute('data-icon'))).toEqual([
      'dispo-oui',
      'dispo-partiel',
      'dispo-non',
    ]);
    expect(statuses.map((s) => s.textContent!.trim())).toEqual(['', '', '']);
  });
});
