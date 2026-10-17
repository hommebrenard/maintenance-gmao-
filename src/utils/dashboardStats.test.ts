import { describe, it, expect } from 'vitest';
import type { LocationItem, MaintenanceRequest, WorkOrder } from '../types';
import { computeDashboard, computeDi, computeOt, computeSiteRows } from './dashboardStats';

const today = new Date('2026-10-17T10:00:00Z');
const wo = (id: string, status: WorkOrder['status'], dueDate: string, location = 'Site A') => ({ id, status, dueDate, location } as WorkOrder);
const req = (id: string, status: MaintenanceRequest['status'], extra: Partial<MaintenanceRequest> = {}) =>
  ({ id, status, siteCode: 'BAM-A_AG', ...extra } as MaintenanceRequest);
const locations = [
  { id: 'a', name: 'Site A', code: 'BAM_A_AG', type: 'Site', equipmentCount: 0 },
  { id: 'b', name: 'Site B', code: 'BAM_B_AG', type: 'Site', equipmentCount: 0 },
] as LocationItem[];

describe('dashboardStats', () => {
  it('OT : taux d\'achèvement hors annulés, annulation, échus non terminés', () => {
    const s = computeOt([wo('1', 'Terminé', '2026-05-01'), wo('2', 'Ouvert', '2026-05-01'), wo('3', 'Ouvert', '2026-12-01'), wo('4', 'Annulé', '2026-05-01')], today);
    expect(s.total).toBe(4);
    expect(s.completionRate).toBeCloseTo(1 / 3);
    expect(s.cancellationRate).toBe(0.25);
    expect(s.overdueNotDone).toBe(1);
  });
  it('OT : aucun OT → taux null (pas de division par zéro)', () => {
    expect(computeOt([], today).completionRate).toBeNull();
  });
  it('DI : taux de clôture hors annulées/rejetées, annulation, en attente > 30 j', () => {
    const requests = [
      req('1', 'Approuvée', { workOrderId: 'w1' }),                       // Clôturée (OT terminé)
      req('2', 'Approuvée', { workOrderId: 'w2' }),                       // Prise en charge
      req('3', 'Rejetée', { coswinState: '5. Annulée' }),                 // DI annulée
      req('4', 'Rejetée', { coswinState: '0. Créée' }),                   // Rejetée (locale)
      req('5', 'En attente', { declaredAt: '2026-09-01T08:00:00Z' }),     // > 30 j
      req('6', 'En attente', { declaredAt: '2026-10-10T08:00:00Z' }),     // récente
    ];
    const s = computeDi(requests, [wo('w1', 'Terminé', '2026-05-01'), wo('w2', 'Ouvert', '2026-05-01')], today);
    expect(s.total).toBe(6);
    expect(s.closed).toBe(1);
    expect(s.cancelled).toBe(1);
    expect(s.rejected).toBe(1);
    expect(s.closureRate).toBeCloseTo(1 / 4);
    expect(s.cancellationRate).toBeCloseTo(1 / 6);
    expect(s.pendingOver30Days).toBe(1);
  });
  it('filtre par site : OT par nom, DI par code de site (tirets = soulignés)', () => {
    const input = {
      locations,
      workOrders: [wo('1', 'Ouvert', '2026-05-01', 'Site A'), wo('2', 'Ouvert', '2026-05-01', 'Site B')],
      requests: [req('1', 'En attente'), req('2', 'En attente', { siteCode: 'BAM-B_AG' }), req('3', 'En attente', { siteCode: 'BAM-B_AG' })],
    };
    expect(computeDashboard(input, '', today)).toMatchObject({ ot: { total: 2 }, di: { total: 3 } });
    expect(computeDashboard(input, 'a', today)).toMatchObject({ ot: { total: 1 }, di: { total: 1 } });
    expect(computeDashboard(input, 'b', today)).toMatchObject({ ot: { total: 1 }, di: { total: 2 } });
    const rows = computeSiteRows(input, today);
    expect(rows.map(r => r.name)).toEqual(['Site B', 'Site A']);
  });
});
