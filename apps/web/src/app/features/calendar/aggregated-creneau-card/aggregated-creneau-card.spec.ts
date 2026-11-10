import { TestBed } from '@angular/core/testing';
import type { AggregatedSlotDto } from '@master-jdr/shared';
import { AggregatedCreneauCard } from './aggregated-creneau-card';

// Story 51.5 — les compteurs de disponibilité se disent par la FORME du dessin (oui / partiel / non),
// plus par la couleur d'un emoji ; les nombres et les `title` restent.

function makeSlot(overrides: Partial<AggregatedSlotDto> = {}): AggregatedSlotDto {
  return {
    date: '2026-07-04',
    slot: 'MORNING',
    available: 3,
    unknown: 1,
    unavailable: 2,
    total: 6,
    ...overrides,
  };
}

describe('AggregatedCreneauCard — pictogrammes des compteurs (story 51.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function create(slot: AggregatedSlotDto): HTMLElement {
    TestBed.configureTestingModule({ imports: [AggregatedCreneauCard] });
    const fixture = TestBed.createComponent(AggregatedCreneauCard);
    fixture.componentRef.setInput('slot', slot);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('trois noms distincts : dispo-oui, dispo-partiel, dispo-non, avec leurs nombres', () => {
    const el = create(makeSlot());
    const counters = Array.from(el.querySelectorAll('.agg-card__counts > span[title]'));
    expect(counters.map((c) => c.querySelector('app-icon')!.getAttribute('data-icon'))).toEqual([
      'dispo-oui',
      'dispo-partiel',
      'dispo-non',
    ]);
    expect(counters.map((c) => c.textContent!.trim())).toEqual(['3', '1', '2']);
    expect(counters.every((c) => (c.getAttribute('title') ?? '') !== '')).toBe(true);
    expect(el.textContent).not.toMatch(/[✅⚠❌]/u);
  });

  it('sans refus, le compteur « non » n’est pas rendu', () => {
    const el = create(makeSlot({ unavailable: 0 }));
    const names = Array.from(el.querySelectorAll('app-icon')).map((i) =>
      i.getAttribute('data-icon'),
    );
    expect(names).toEqual(['dispo-oui', 'dispo-partiel']);
  });
});
