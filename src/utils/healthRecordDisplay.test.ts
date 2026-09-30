import { describe, it, expect } from 'vitest';
import type { MaintenanceSchedule, HealthRecordEntry, WorkOrder } from '../types';
import {
  scheduleStatusLabel, scheduleFrequencyLabel, summarizeLegalControl, pickNextDue, summarizeAnomalies, computeNextDue,
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

describe('computeNextDue (Prochaine échéance : Planification + OT préventifs ouverts)', () => {
  const today = new Date(2026, 8, 30); // 30/09/2026
  const wo = (o: Partial<WorkOrder>): WorkOrder => ({
    id: 'w', code: 'OT-1', title: 'Prev', description: '', status: 'Ouvert', priority: 'Moyenne', type: 'Préventive',
    dueDate: '2026-10-05', createdAt: '', updatedAt: '', ...o,
  });

  it('rien du tout => next null, 0 retard', () => {
    expect(computeNextDue([], [], today)).toEqual({ next: null, overdueCount: 0 });
    expect(computeNextDue([sch({})], [wo({ dueDate: '' })], today)).toEqual({ next: null, overdueCount: 0 });
  });
  it('la plus proche À VENIR, source affichée ; aujourd\'hui compte comme à venir', () => {
    const r = computeNextDue(
      [sch({ title: 'Plan', nextDueDate: '2026-11-15' })],
      [wo({ code: 'OT-9', dueDate: '2026-10-05' }), wo({ code: 'OT-8', dueDate: '2026-09-30' })],
      today
    );
    expect(r.next).toMatchObject({ date: '2026-09-30', source: 'ot', code: 'OT-8', status: 'due_soon' });
    expect(r.overdueCount).toBe(0);
  });
  it('les retards ne sont jamais « prochaine » : comptés à part', () => {
    const r = computeNextDue(
      [sch({ title: 'Plan', nextDueDate: '2026-05-01' })],
      [wo({ dueDate: '2026-05-18' }), wo({ dueDate: '2026-12-01', code: 'OT-F' })],
      today
    );
    expect(r.next).toMatchObject({ date: '2026-12-01', code: 'OT-F', status: 'ok' });
    expect(r.overdueCount).toBe(2);
  });
  it('uniquement des retards => next null mais retards comptés', () => {
    expect(computeNextDue([], [wo({ dueDate: '2026-01-01' })], today)).toEqual({ next: null, overdueCount: 1 });
  });
  it('ignore OT clos/annulés et OT non préventifs', () => {
    const r = computeNextDue([], [
      wo({ status: 'Terminé' }), wo({ status: 'Annulé' }), wo({ type: 'Corrective' }),
    ], today);
    expect(r).toEqual({ next: null, overdueCount: 0 });
  });
  it('à date égale, la Planification passe avant l\'OT', () => {
    const r = computeNextDue([sch({ title: 'Plan', nextDueDate: '2026-10-05' })], [wo({ dueDate: '2026-10-05' })], today);
    expect(r.next?.source).toBe('planification');
  });
});
