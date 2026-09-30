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

import { addMonthsToIsoDate, isValidIsoDate, sortSchedules, parseDurationHHMM, minutesToHHMM, formatDuration } from './maintenanceSchedule';
import type { MaintenanceSchedule } from '../types';

describe('addMonthsToIsoDate / isValidIsoDate / sortSchedules', () => {
  it('ajoute des mois en ramenant le jour à la fin du mois si besoin', () => {
    expect(addMonthsToIsoDate('2026-09-30', 12)).toBe('2027-09-30');
    expect(addMonthsToIsoDate('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonthsToIsoDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToIsoDate('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsToIsoDate('2026-12-31', 6)).toBe('2027-06-30');
  });
  it('refuse les entrées invalides (undefined, jamais de valeur inventée)', () => {
    expect(addMonthsToIsoDate('', 3)).toBeUndefined();
    expect(addMonthsToIsoDate('2026-02-30', 3)).toBeUndefined();
    expect(addMonthsToIsoDate('2026-09-30', 0)).toBeUndefined();
    expect(addMonthsToIsoDate('2026-09-30', 1.5)).toBeUndefined();
    expect(addMonthsToIsoDate('2026-09-30', NaN)).toBeUndefined();
  });
  it('isValidIsoDate', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate(undefined)).toBe(false);
  });
  it('tri : échéance la plus proche d\'abord, sans date en dernier', () => {
    const s = (id: string, d?: string) => ({ id, nextDueDate: d }) as MaintenanceSchedule;
    expect(sortSchedules([s('a'), s('b', '2026-12-01'), s('c', '2026-10-01')]).map(i => i.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('durée estimée HH:MM', () => {
  it('parse en minutes, refuse invalide ou nul', () => {
    expect(parseDurationHHMM('03:00')).toBe(180);
    expect(parseDurationHHMM(' 3:30 ')).toBe(210);
    expect(parseDurationHHMM('00:45')).toBe(45);
    expect(parseDurationHHMM('00:00')).toBeUndefined();
    expect(parseDurationHHMM('3h')).toBeUndefined();
    expect(parseDurationHHMM('02:75')).toBeUndefined();
    expect(parseDurationHHMM('')).toBeUndefined();
  });
  it('formats de saisie et d\'affichage', () => {
    expect(minutesToHHMM(210)).toBe('03:30');
    expect(formatDuration(210)).toBe('3 h 30');
    expect(formatDuration(180)).toBe('3 h 00');
  });
});
