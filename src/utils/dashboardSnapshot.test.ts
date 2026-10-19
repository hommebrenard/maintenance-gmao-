import { describe, expect, it } from 'vitest';
import type { LocationItem, MaintenanceRequest, WorkOrder } from '../types';
import { INDICATORS, compareWithSnapshot, computeAllSnapshotRows, computeIndicators, currentPeriod, periodLabel } from './dashboardSnapshot';

const di = (id: string, x: Partial<MaintenanceRequest> = {}): MaintenanceRequest => ({
  id, title: 't', description: '', status: 'En attente', priority: 'Moyenne', requestedBy: 'x', createdAt: '',
  code: `DI0000${id}`, declaredAt: '2026-01-01', equipmentId: 'e1', origin: 'coswin', priorityCode: 'U0', siteCode: 'BAM_KNT_AG', ...x,
});
const wo = (id: string, x: Partial<WorkOrder> = {}): WorkOrder => ({
  id, code: `OT-${id}`, title: 't', status: 'Ouvert', dueDate: '2026-10-01', equipmentId: 'e1', interventionCode: 'PS-1', location: 'AG Type A KENITRA', ...x,
} as WorkOrder);
const TODAY = new Date('2026-10-19T10:00:00Z');

describe('computeIndicators', () => {
  it('fournit tous les indicateurs déclarés, avec des valeurs finies', () => {
    const v = computeIndicators([di('1'), di('2', { status: 'Rejetée' })], [wo('1'), wo('2', { status: 'Terminé' })], [wo('1'), wo('2', { status: 'Terminé' })], TODAY);
    for (const d of INDICATORS) expect(Number.isFinite(v[d.key]?.value), d.key).toBe(true);
    expect(v.di_total.value).toBe(2);
    expect(v.di_recues.value).toBe(1);
    expect(v.ot_total.value).toBe(2);
    expect(v.ot_termines).toEqual({ value: 1, denominator: 2 });
    expect(v.ot_echus.value).toBe(1);
    expect(v.ot_retard_30.value + v.ot_retard_90.value + v.ot_retard_180.value + v.ot_retard_180p.value).toBe(1);
  });
  it("cohérence avec l'entonnoir et la heatmap : sans OT = en attente + prise en charge sans OT", () => {
    const v = computeIndicators([di('1'), di('2'), di('3', { otNumber: '86000', otState: 'E', status: 'Approuvée' as never })], [], [], TODAY);
    expect(v.di_sans_ot.value).toBe(2);
    expect(v.di_avec_ot).toEqual({ value: 1, denominator: 3 });
  });
});

describe('computeAllSnapshotRows', () => {
  it('produit le total puis un jeu par site non vide, sans clé en double', () => {
    const locations: LocationItem[] = [
      { id: 'L1', name: 'AG Type A KENITRA', code: 'BAM_KNT_AG', type: 'Site', equipmentCount: 0 },
      { id: 'L2', name: 'Site vide', code: 'BAM_VID_AG', type: 'Site', equipmentCount: 0 },
    ];
    const rows = computeAllSnapshotRows({ workOrders: [wo('1')], requests: [di('1')], locations }, TODAY);
    const keys = [...new Set(rows.map(r => r.site_key))];
    expect(keys[0]).toBe('ALL');
    expect(keys).toHaveLength(2);                       // le site sans DI ni OT est omis
    expect(rows.length).toBe(keys.length * INDICATORS.length);
    const pairs = rows.map(r => `${r.site_key}|${r.indicator}`);
    expect(new Set(pairs).size).toBe(pairs.length);     // clé primaire (instantané, site, indicateur) respectée
  });
});

describe('périodes et comparaison', () => {
  it('formate la période courante et son libellé', () => {
    expect(currentPeriod(new Date(2026, 9, 19))).toBe('2026-10');
    expect(periodLabel('2026-10')).toMatch(/octobre 2026/);
  });
  it("calcule l'écart entre l'instantané et aujourd'hui, ou null sans instantané", () => {
    const live = Object.fromEntries(INDICATORS.map(d => [d.key, { value: 10, denominator: null }]));
    const snap = Object.fromEntries(INDICATORS.map(d => [d.key, { value: 7, denominator: null }]));
    expect(compareWithSnapshot(snap, live)[0].delta).toBe(3);
    expect(compareWithSnapshot(null, live)[0].delta).toBeNull();
  });
});
