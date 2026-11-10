import { eventClosure, eventIsOpen, type EventOpenInput } from './event-is-open';

describe('eventClosure et eventIsOpen (Story 49.1)', () => {
  const today = '2026-10-30';
  const day = (key: string) => new Date(`${key}T00:00:00.000Z`);
  const base: EventOpenInput = {
    cancelledAt: null,
    startDate: day('2026-11-05'),
    endDate: day('2026-11-05'),
    isolated: false,
    partieClosedAt: null,
  };

  it('eventClosure : l’annulation l’emporte sur la fin, qui l’emporte sur l’ouverture', () => {
    expect(eventClosure({ cancelled: true, finished: true })).toBe('CANCELLED');
    expect(eventClosure({ cancelled: false, finished: true })).toBe('ENDED');
    expect(eventClosure({ cancelled: false, finished: false })).toBeNull();
  });

  it('à venir, aujourd’hui ou sans date : ouverte', () => {
    expect(eventIsOpen(base, today)).toBe(true);
    expect(eventIsOpen({ ...base, startDate: day(today), endDate: day(today) }, today)).toBe(true);
    expect(eventIsOpen({ ...base, startDate: null, endDate: null }, today)).toBe(true);
  });

  it('annulée : fermée, même à venir', () => {
    expect(eventIsOpen({ ...base, cancelledAt: new Date() }, today)).toBe(false);
  });

  it('passée (la fin de plage, à défaut le début, est avant aujourd’hui) : fermée', () => {
    expect(
      eventIsOpen({ ...base, startDate: day('2026-10-29'), endDate: day('2026-10-29') }, today),
    ).toBe(false);
    expect(eventIsOpen({ ...base, startDate: day('2026-10-29'), endDate: null }, today)).toBe(
      false,
    );
    // Une plage commencée hier et finie demain reste ouverte.
    expect(
      eventIsOpen({ ...base, startDate: day('2026-10-29'), endDate: day('2026-10-31') }, today),
    ).toBe(true);
  });

  it('rencontre isolée close : fermée ; la clôture d’une partie de groupe ne ferme rien', () => {
    expect(eventIsOpen({ ...base, isolated: true, partieClosedAt: new Date() }, today)).toBe(false);
    expect(eventIsOpen({ ...base, isolated: false, partieClosedAt: new Date() }, today)).toBe(true);
  });
});
