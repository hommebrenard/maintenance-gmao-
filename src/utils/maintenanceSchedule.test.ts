import { describe, it, expect } from 'vitest';
import { computeScheduleStatus, DUE_SOON_DAYS } from './maintenanceSchedule';

const TODAY = new Date(2026, 8, 29, 15, 30); // 29/09/2026, l'heure ne compte pas

describe('computeScheduleStatus', () => {
  it('renvoie undefined quand la date est absente ou illisible (pas de valeur fictive)', () => {
    expect(computeScheduleStatus(undefined, TODAY)).toBeUndefined();
    expect(computeScheduleStatus(null, TODAY)).toBeUndefined();
    expect(computeScheduleStatus('', TODAY)).toBeUndefined();
    expect(computeScheduleStatus('pas-une-date', TODAY)).toBeUndefined();
  });
  it('overdue si la date est passée (hier)', () => {
    expect(computeScheduleStatus('2026-09-28', TODAY)).toBe('overdue');
  });
  it("due_soon le jour même et jusqu'au seuil inclus", () => {
    expect(computeScheduleStatus('2026-09-29', TODAY)).toBe('due_soon');
    expect(computeScheduleStatus('2026-10-29', TODAY)).toBe('due_soon'); // +30 j
    expect(DUE_SOON_DAYS).toBe(30);
  });
  it('ok au-delà du seuil', () => {
    expect(computeScheduleStatus('2026-10-30', TODAY)).toBe('ok'); // +31 j
  });
});
