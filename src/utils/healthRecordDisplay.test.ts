import { describe, it, expect } from 'vitest';
import type { MaintenanceSchedule, HealthRecordEntry } from '../types';
import {
  scheduleStatusLabel, scheduleFrequencyLabel, summarizeLegalControl, pickNextDue, summarizeAnomalies,
  documentCategoryLabel, formatFileSize, isLowStock, formatPrice,
} from './healthRecordDisplay';

const sch = (o: Partial<MaintenanceSchedule>): MaintenanceSchedule => ({
  id: 'x', equipmentId: 'e', title: 'T', legalRequirement: false, createdAt: '2026-01-01', ...o,
});
const entry = (o: Partial<HealthRecordEntry>): HealthRecordEntry => ({
  id: 'x', equipmentId: 'e', eventDate: '2026-09-01', eventType: 'Ronde', description: '', status: '', createdAt: '', ...o,
});

describe('scheduleStatusLabel / scheduleFrequencyLabel', () => {
  it('libellés de statut, et « Non renseigné » sans statut', () => {
    expect(scheduleStatusLabel('overdue')).toBe('En retard');
    expect(scheduleStatusLabel('due_soon')).toBe('Échéance proche');
    expect(scheduleStatusLabel('ok')).toBe('À jour');
    expect(scheduleStatusLabel(undefined)).toBe('Non renseigné');
  });
  it('périodicité : libellé saisi > intervalle dérivé > undefined', () => {
    expect(scheduleFrequencyLabel(sch({ frequencyLabel: ' Annuelle ' }))).toBe('Annuelle');
    expect(scheduleFrequencyLabel(sch({ frequencyType: 'hours', intervalHours: 500 }))).toBe('Toutes les 500 h');
    expect(scheduleFrequencyLabel(sch({ frequencyType: 'calendar', intervalMonths: 6 }))).toBe('Tous les 6 mois');
    expect(scheduleFrequencyLabel(sch({ frequencyType: 'calendar', intervalMonths: 1 }))).toBe('Tous les mois');
    expect(scheduleFrequencyLabel(sch({}))).toBeUndefined();
  });
});

describe('summarizeLegalControl', () => {
  it('null s\'il n\'y a aucune échéance réglementaire (les autres échéances sont ignorées)', () => {
    expect(summarizeLegalControl([])).toBeNull();
    expect(summarizeLegalControl([sch({ legalRequirement: false, status: 'overdue' })])).toBeNull();
  });
  it('retient le pire statut, puis la date la plus proche', () => {
    const r = summarizeLegalControl([
      sch({ title: 'A', legalRequirement: true, status: 'ok', nextDueDate: '2027-01-01' }),
      sch({ title: 'B', legalRequirement: true, status: 'overdue', nextDueDate: '2026-09-20' }),
      sch({ title: 'C', legalRequirement: true, status: 'overdue', nextDueDate: '2026-08-01' }),
      sch({ title: 'D', legalRequirement: false, status: 'overdue', nextDueDate: '2020-01-01' }),
    ]);
    expect(r).toMatchObject({ status: 'overdue', title: 'C', date: '2026-08-01', count: 3 });
  });
  it('sans date d\'échéance : statut indéfini (jamais inventé)', () => {
    const r = summarizeLegalControl([sch({ title: 'A', legalRequirement: true })]);
    expect(r?.status).toBeUndefined();
    expect(r?.date).toBeUndefined();
  });
});

describe('pickNextDue / summarizeAnomalies', () => {
  it('prochaine échéance = date la plus ancienne ; null sans date', () => {
    expect(pickNextDue([sch({ title: 'A' })])).toBeNull();
    expect(pickNextDue([sch({ title: 'A', nextDueDate: '2026-12-01' }), sch({ title: 'B', nextDueDate: '2026-10-01' })])?.title).toBe('B');
  });
  it('compte uniquement les anomalies, avec la date de la dernière', () => {
    const r = summarizeAnomalies([
      entry({ eventType: 'Ronde', eventDate: '2026-09-29' }),
      entry({ eventType: 'Anomalie', eventDate: '2026-09-10' }),
      entry({ eventType: 'Anomalie', eventDate: '2026-09-26' }),
    ]);
    expect(r).toEqual({ count: 2, lastDate: '2026-09-26' });
    expect(summarizeAnomalies([entry({})])).toEqual({ count: 0, lastDate: undefined });
  });
});

describe('documents, pièces, formats', () => {
  it('catégorie de document', () => {
    expect(documentCategoryLabel('certificate')).toBe('Certificat');
    expect(documentCategoryLabel(undefined)).toBe('Non classé');
  });
  it('taille de fichier', () => {
    expect(formatFileSize(undefined)).toBeUndefined();
    expect(formatFileSize(512)).toBe('512 o');
    expect(formatFileSize(2048)).toBe('2 Ko');
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2,5 Mo');
  });
  it('stock bas : seuil 0 = jamais d\'alerte ; stock <= seuil = alerte', () => {
    expect(isLowStock({ stock: 0, minStock: 0 })).toBe(false);
    expect(isLowStock({ stock: 5, minStock: 5 })).toBe(true);
    expect(isLowStock({ stock: 6, minStock: 5 })).toBe(false);
    expect(isLowStock({ stock: 1, minStock: 2 })).toBe(true);
  });
  it('prix à 2 décimales', () => {
    expect(formatPrice(12.5).replace(/\s/g, '')).toBe('12,50');
  });
});
