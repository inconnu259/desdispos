import type { CreateAvailabilityDto, DaySlot } from '@desdispos/shared';

export interface ConstraintFormValue {
  slot: DaySlot;
  kind: 'UNAVAILABLE' | 'AVAILABLE';
  type: 'PONCTUEL' | 'RECURRENT' | 'PLAGE';
  expiresAt: string; // only for RECURRENT; auto-computed otherwise
  startDate: string; // for PLAGE
  endDate: string; // for PLAGE
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Ajoute `months` mois à `date` en clampant au dernier jour du mois cible
 * (évite le débordement de setMonth, ex. 31 jan + 1 mois → 28 fév, pas 3 mars).
 */
export function addMonths(date: Date, months: number): string {
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDayOfTarget = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDayOfTarget));
  return toISODate(result);
}

export function buildConstraintDto(
  formValue: ConstraintFormValue,
  date: Date,
): CreateAvailabilityDto {
  const { slot, kind } = formValue;

  if (formValue.type === 'RECURRENT') {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const startDate = toISODate(date); // première occurrence = jour sélectionné
    const expiresAt = new Date(formValue.expiresAt + 'T23:59:59Z').toISOString();
    return {
      kind,
      slot,
      recurKind: 'RECURRING',
      dayOfWeek: utcDate.getUTCDay(),
      startDate,
      expiresAt,
    };
  }

  if (formValue.type === 'PONCTUEL') {
    const dateStr = toISODate(date);
    const expiresAt = new Date(dateStr + 'T23:59:59Z').toISOString();
    return { kind, slot, recurKind: 'PUNCTUAL', startDate: dateStr, endDate: dateStr, expiresAt };
  }

  // PLAGE: expiresAt auto = fin du endDate
  const expiresAt = new Date(formValue.endDate + 'T23:59:59Z').toISOString();
  return {
    kind,
    slot,
    recurKind: 'PUNCTUAL',
    startDate: formValue.startDate,
    endDate: formValue.endDate,
    expiresAt,
  };
}
