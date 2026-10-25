import { describe, it, expect } from 'vitest';
import { DUE_DELAY_DAYS, todayIso, isValidIsoDate, addDaysIso, proposedDueDate, formatIsoFr } from './requestDueDate';

describe('requestDueDate', () => {
  it('délais provisoires : +1 / +3 / +7 / +14 jours calendaires', () => {
    expect(DUE_DELAY_DAYS).toEqual({ Urgente: 1, Élevée: 3, Moyenne: 7, Faible: 14 });
  });
  it('le jour est celui du Maroc, pas celui de l\'appareil (23h30 UTC en été = 00h30 le lendemain à Casablanca)', () => {
    // Juillet : décalage de +1 h avec les règles actuelles comme avec les anciennes bases de fuseaux horaires,
    // donc le test ne dépend pas de la version de la base de fuseaux de la machine qui l'exécute.
    expect(todayIso(new Date('2026-07-15T23:30:00Z'))).toBe('2026-07-16');
    expect(todayIso(new Date('2026-07-15T12:00:00Z'))).toBe('2026-07-15');
    expect(todayIso(new Date('2026-10-25T12:00:00Z'))).toBe('2026-10-25');
  });
  it('proposition selon la priorité', () => {
    const now = new Date('2026-10-25T12:00:00Z');
    expect(proposedDueDate('Urgente', now)).toBe('2026-10-26');
    expect(proposedDueDate('Élevée', now)).toBe('2026-10-28');
    expect(proposedDueDate('Moyenne', now)).toBe('2026-11-01');
    expect(proposedDueDate('Faible', now)).toBe('2026-11-08');
  });
  it('passage de mois et d\'année', () => {
    expect(addDaysIso('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDaysIso('2028-02-27', 3)).toBe('2028-03-01');
  });
  it('validation : date inexistante ou mal formée refusée', () => {
    expect(isValidIsoDate('2026-10-25')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('25/10/2026')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
    expect(isValidIsoDate(undefined)).toBe(false);
  });
  it('affichage JJ/MM/AAAA', () => {
    expect(formatIsoFr('2026-11-01')).toBe('01/11/2026');
    expect(formatIsoFr(undefined)).toBe('—');
  });
});
