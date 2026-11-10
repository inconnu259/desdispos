import type { DaySlot } from '@master-jdr/shared';

/** Déclaration de disponibilité telle que lue pour compter les libres d'un créneau (forme minimale
 *  d'`AvailabilityDeclaration`). */
export interface DeclaredAvailability {
  kind: 'UNAVAILABLE' | 'AVAILABLE';
  recurKind: 'RECURRING' | 'PUNCTUAL';
  dayOfWeek: number | null;
  slot: DaySlot;
  startDate: Date | null;
  endDate: Date | null;
  expiresAt: Date;
}

/** Une déclaration sur `FULL_DAY` couvre tous les créneaux, une déclaration précise le sien seul. */
function slotMatches(declared: DaySlot, wanted: DaySlot): boolean {
  return declared === 'FULL_DAY' || declared === wanted;
}

/** La déclaration vise-t-elle ce jour et ce créneau ? (jour UTC, mêmes règles que le calendrier). */
function matches(decl: DeclaredAvailability, date: Date, slot: DaySlot): boolean {
  if (!slotMatches(decl.slot, slot)) return false;
  if (decl.recurKind === 'RECURRING') {
    if (decl.dayOfWeek !== date.getUTCDay()) return false;
    if (decl.startDate && date < decl.startDate) return false;
    if (decl.endDate && date > decl.endDate) return false;
    return date <= decl.expiresAt;
  }
  if (!decl.startDate || !decl.endDate) return false;
  const t = date.getTime();
  return t >= decl.startDate.getTime() && t <= decl.endDate.getTime();
}

/** Le jour et le créneau tombent-ils dans la période couverte par une déclaration (inférence
 *  « disponible » du calendrier : ce qui n'est pas déclaré indisponible, dans la période où la
 *  personne s'est déclarée, est libre) ? */
function inCoveredPeriod(active: DeclaredAvailability[], date: Date, slot: DaySlot): boolean {
  return active.some((d) => {
    if (!slotMatches(d.slot, slot)) return false;
    if (d.recurKind === 'RECURRING') {
      if (d.startDate && date < d.startDate) return false;
      if (d.endDate && date > d.endDate) return false;
      return date <= d.expiresAt;
    }
    if (!d.startDate || !d.endDate) return false;
    return date >= d.startDate && date <= d.endDate;
  });
}

/**
 * La personne est-elle LIBRE sur ce créneau d'après ses disponibilités déclarées (Story 40.5) ? Même
 * lecture que le calendrier du groupe : une indisponibilité qui vise le créneau l'emporte ; sinon une
 * disponibilité qui le vise, ou une période déclarée qui le couvre, le rend libre ; sans déclaration,
 * on ne sait pas — et on ne compte pas la personne. `date` est le minuit UTC du jour.
 */
export function isFreeOn(
  declarations: DeclaredAvailability[],
  date: Date,
  slot: DaySlot,
  now: Date = new Date(),
): boolean {
  const active = declarations.filter((d) => d.expiresAt > now);
  if (active.some((d) => d.kind === 'UNAVAILABLE' && matches(d, date, slot))) return false;
  if (active.some((d) => d.kind === 'AVAILABLE' && matches(d, date, slot))) return true;
  return inCoveredPeriod(active, date, slot);
}
