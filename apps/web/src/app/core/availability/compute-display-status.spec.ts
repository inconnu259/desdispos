import { describe, expect, it } from 'vitest';
import { computeDisplayStatus } from './compute-display-status';
import type { AvailabilityDeclarationDto } from '@desdispos/shared';

const NOW = new Date('2026-06-30T12:00:00Z');
const WED = new Date('2026-07-01T00:00:00Z'); // getUTCDay() === 3 (Wednesday)
const NEXT_WED = new Date('2026-07-08T00:00:00Z'); // mercredi suivant
const AUG_WED = new Date('2026-08-05T00:00:00Z'); // mercredi en août
const FAR = new Date('2027-01-01T00:00:00Z');

function decl(overrides: Partial<AvailabilityDeclarationDto> = {}): AvailabilityDeclarationDto {
  return {
    id: 'test-id',
    userId: 'user-1',
    kind: 'UNAVAILABLE',
    recurKind: 'RECURRING',
    dayOfWeek: 3,
    slot: 'EVENING',
    startDate: null,
    endDate: null,
    expiresAt: FAR.toISOString(),
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe('computeDisplayStatus', () => {
  it('UNAVAILABLE RECURRING matching date+slot → UNAVAILABLE', () => {
    expect(computeDisplayStatus(WED, 'EVENING', [decl()], NOW)).toBe('UNAVAILABLE');
  });

  it('AVAILABLE explicit matching → AVAILABLE', () => {
    expect(computeDisplayStatus(WED, 'EVENING', [decl({ kind: 'AVAILABLE' })], NOW)).toBe(
      'AVAILABLE',
    );
  });

  it('UNAVAILABLE beats AVAILABLE on same slot', () => {
    expect(
      computeDisplayStatus(
        WED,
        'EVENING',
        [decl({ kind: 'AVAILABLE' }), decl({ kind: 'UNAVAILABLE' })],
        NOW,
      ),
    ).toBe('UNAVAILABLE');
  });

  it('no exact match → UNKNOWN (positive inference removed)', () => {
    // Decl is for EVENING on Wednesdays — query is MORNING; no exact match → UNKNOWN
    expect(computeDisplayStatus(WED, 'MORNING', [decl({ slot: 'EVENING' })], NOW)).toBe('UNKNOWN');
  });

  it('date outside covered period → UNKNOWN', () => {
    const punctual = decl({
      recurKind: 'PUNCTUAL',
      dayOfWeek: null,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      slot: 'MORNING',
    });
    expect(computeDisplayStatus(WED, 'MORNING', [punctual], NOW)).toBe('UNKNOWN');
  });

  it('expired declaration ignored → UNKNOWN', () => {
    const expired = decl({ expiresAt: new Date('2026-06-01T00:00:00Z').toISOString() });
    expect(computeDisplayStatus(WED, 'EVENING', [expired], NOW)).toBe('UNKNOWN');
  });

  it('RECURRING before startDate → UNKNOWN', () => {
    // La déclaration commence mercredi prochain — ce mercredi ne doit pas être coloré
    const d = decl({ startDate: '2026-07-08' });
    expect(computeDisplayStatus(WED, 'EVENING', [d], NOW)).toBe('UNKNOWN');
  });

  it('RECURRING after expiresAt → UNKNOWN', () => {
    // La déclaration expire fin juillet — un mercredi d'août ne doit pas être coloré
    const d = decl({ startDate: '2026-07-01', expiresAt: '2026-07-31T23:59:59Z' });
    expect(computeDisplayStatus(AUG_WED, 'EVENING', [d], NOW)).toBe('UNKNOWN');
  });

  it('RECURRING within [startDate, expiresAt] → UNAVAILABLE', () => {
    // La déclaration couvre juillet-décembre — le mercredi suivant est dans la plage
    const d = decl({ startDate: '2026-07-01', expiresAt: '2026-12-31T23:59:59Z' });
    expect(computeDisplayStatus(NEXT_WED, 'EVENING', [d], NOW)).toBe('UNAVAILABLE');
  });

  it('FULL_DAY UNAVAILABLE matches any specific slot', () => {
    const fullDay = decl({ slot: 'FULL_DAY', kind: 'UNAVAILABLE' });
    expect(computeDisplayStatus(WED, 'MORNING', [fullDay], NOW)).toBe('UNAVAILABLE');
    expect(computeDisplayStatus(WED, 'AFTERNOON', [fullDay], NOW)).toBe('UNAVAILABLE');
    expect(computeDisplayStatus(WED, 'EVENING', [fullDay], NOW)).toBe('UNAVAILABLE');
  });

  it('FULL_DAY AVAILABLE covers all specific slots', () => {
    const fullDay = decl({ slot: 'FULL_DAY', kind: 'AVAILABLE' });
    expect(computeDisplayStatus(WED, 'MORNING', [fullDay], NOW)).toBe('AVAILABLE');
    expect(computeDisplayStatus(WED, 'AFTERNOON', [fullDay], NOW)).toBe('AVAILABLE');
    expect(computeDisplayStatus(WED, 'EVENING', [fullDay], NOW)).toBe('AVAILABLE');
  });

  it('PUNCTUAL MORNING AVAILABLE : AFTERNOON et EVENING restent UNKNOWN (pas de cross-slot)', () => {
    const morning = decl({
      kind: 'AVAILABLE',
      recurKind: 'PUNCTUAL',
      dayOfWeek: null,
      slot: 'MORNING',
      startDate: '2026-07-01',
      endDate: '2026-07-01',
      expiresAt: '2026-07-01T23:59:59Z',
    });
    expect(computeDisplayStatus(WED, 'MORNING', [morning], NOW)).toBe('AVAILABLE');
    expect(computeDisplayStatus(WED, 'AFTERNOON', [morning], NOW)).toBe('UNKNOWN');
    expect(computeDisplayStatus(WED, 'EVENING', [morning], NOW)).toBe('UNKNOWN');
  });

  it('déclaration MORNING : ne couvre pas AFTERNOON sur le même jour RECURRING', () => {
    const morningDecl = decl({ slot: 'MORNING', kind: 'UNAVAILABLE' });
    expect(computeDisplayStatus(WED, 'MORNING', [morningDecl], NOW)).toBe('UNAVAILABLE');
    expect(computeDisplayStatus(WED, 'AFTERNOON', [morningDecl], NOW)).toBe('UNKNOWN');
    expect(computeDisplayStatus(WED, 'EVENING', [morningDecl], NOW)).toBe('UNKNOWN');
  });

  // ── Tests modèle SPLIT : endDate tronque la série ────────────────────────

  it('RECURRING with endDate — after endDate → UNKNOWN (modèle SPLIT R1)', () => {
    // R1 après un split : couvre [Jul 1, Jul 8] — le mercredi Jul 8 (WED2) est la borne
    const r1 = decl({ startDate: '2026-07-01', endDate: '2026-07-08' });
    // WED = Jul 1 → dans la plage → UNAVAILABLE
    expect(computeDisplayStatus(WED, 'EVENING', [r1], NOW)).toBe('UNAVAILABLE');
    // NEXT_WED = Jul 8 → borne incluse → UNAVAILABLE
    expect(computeDisplayStatus(NEXT_WED, 'EVENING', [r1], NOW)).toBe('UNAVAILABLE');
    // AUG_WED = Aug 5 → après endDate → UNKNOWN (R1 ne doit plus couvrir ce jour)
    expect(computeDisplayStatus(AUG_WED, 'EVENING', [r1], NOW)).toBe('UNKNOWN');
  });

  it('SPLIT: Rmod AVAILABLE sur le jour J masque R1 UNAVAILABLE (endDate=J-7)', () => {
    // Simule un split sur NEXT_WED (Jul 8) : R1 endDate=WED(Jul 1), Rmod AVAILABLE sur Jul 8
    const r1 = decl({ startDate: '2026-07-01', endDate: '2026-07-01', kind: 'UNAVAILABLE' });
    const rmod = decl({
      recurKind: 'PUNCTUAL',
      dayOfWeek: null,
      startDate: '2026-07-08',
      endDate: '2026-07-08',
      expiresAt: '2026-07-08T23:59:59Z',
      kind: 'AVAILABLE',
    });
    // NEXT_WED = Jul 8 : R1 s'arrête Jul 1, Rmod couvre Jul 8 → AVAILABLE doit gagner
    expect(computeDisplayStatus(NEXT_WED, 'EVENING', [r1, rmod], NOW)).toBe('AVAILABLE');
    // WED = Jul 1 : couvert par R1 seulement → UNAVAILABLE
    expect(computeDisplayStatus(WED, 'EVENING', [r1, rmod], NOW)).toBe('UNAVAILABLE');
  });

  it('SPLIT: R2 UNAVAILABLE ne couvre pas les jours avant startDate', () => {
    // R2 après un split : couvre [Jul 8, …] — WED (Jul 1) est avant → UNKNOWN
    const r2 = decl({ startDate: '2026-07-08' });
    expect(computeDisplayStatus(WED, 'EVENING', [r2], NOW)).toBe('UNKNOWN');
    expect(computeDisplayStatus(NEXT_WED, 'EVENING', [r2], NOW)).toBe('UNAVAILABLE');
  });
});
