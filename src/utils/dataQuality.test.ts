import { describe, expect, it } from 'vitest';
import type { MaintenanceRequest, WorkOrder } from '../types';
import { computeQuality } from './dataQuality';

const di = (id: string, x: Partial<MaintenanceRequest> = {}): MaintenanceRequest => ({
  id, title: 't', description: '', status: 'En attente', priority: 'Moyenne', requestedBy: 'x', createdAt: '',
  code: 'DI00000114', declaredAt: '2026-01-01', equipmentId: 'e1', origin: 'coswin', priorityCode: 'U1', ...x,
});
const wo = (id: string, x: Partial<WorkOrder> = {}): WorkOrder => ({
  id, code: 'OT-100', title: 't', dueDate: '2026-01-01', equipmentId: 'e1', interventionCode: 'PS-1', ...x,
} as WorkOrder);
const get = (r: ReturnType<typeof computeQuality>, k: string) => r.find(c => c.key === k)!;

describe('nom de site', () => {
  it("affiche le nom de l'emplacement au lieu du code Coswin, avec repli sur le code", async () => {
    const { createSiteNameResolver } = await import('./siteLabel');
    const resolve = createSiteNameResolver([{ id: 'L1', name: 'Succursale régionale Type A FES', code: 'BAM_FEZ_AG', type: 'Site', equipmentCount: 0 }]);
    expect(resolve('BAM_FEZ_AG')).toBe('Succursale régionale Type A FES');
    expect(resolve('BAM_XXX_AG')).toBeUndefined();
    const r = computeQuality([di('1', { code: '%', siteCode: 'BAM_FEZ_AG' }), di('2', { code: '%', siteCode: 'BAM_XXX_AG' })], [], resolve);
    expect(r.find(c => c.key === 'di-code')!.items.map(i => i.site)).toEqual(['Succursale régionale Type A FES', 'BAM_XXX_AG']);
  });
});

describe('DI sans lien enregistré', () => {
  const codes = new Set(['TST-A-01', 'TST-A-02']);
  const reqs = [
    di('1', { code: 'DI00000001' }),
    di('2', { code: 'DI00000002', equipmentId: undefined, equipmentCode: ' tst-a-01 ' }),
    di('3', { code: 'DI00000003', equipmentId: undefined, plannedEquipmentCode: 'TST-A-02', equipmentCode: 'TST-ZZ-99' }),
    di('4', { code: 'DI00000004', equipmentId: undefined, equipmentCode: 'TST-ZZ-99' }),
    di('5', { code: 'DI00000005', equipmentId: undefined, plannedEquipmentCode: 'TST-ZZ-98', equipmentCode: 'TST-A-01' }),
    di('6', { code: 'DI00000006', equipmentId: undefined }),
  ];
  it('isole parmi les introuvables celles dont la fonction Coswin est IFBT', () => {
    const r = computeQuality([
      ...reqs,
      di('7', { code: 'DI00000007', equipmentId: undefined, equipmentCode: 'TST-LOC-1', functionCode: ' ifbt ' }),
      di('8', { code: 'DI00000008', equipmentId: undefined, equipmentCode: 'TST-LOC-2', functionCode: 'ELC_CFO' }),
      di('9', { code: 'DI00000009', equipmentId: undefined, equipmentCode: 'TST-A-01', functionCode: 'IFBT' }),
    ], [], undefined, codes);
    expect(get(r, 'di-noeq-ifbt').items.map(i => i.id)).toEqual(['7']);
    expect(get(r, 'di-noeq-missing').items.map(i => i.id)).toEqual(['4', '5', '6', '7', '8']);
  });
  it('sépare les DI retrouvées par code de celles dont le code est introuvable ou vide (planifié d\'abord)', () => {
    const r = computeQuality(reqs, [], undefined, codes);
    expect(get(r, 'di-noeq').items.map(i => i.id)).toEqual(['2', '3', '4', '5', '6']);
    expect(get(r, 'di-noeq-code').items.map(i => i.id)).toEqual(['2', '3']);
    expect(get(r, 'di-noeq-missing').items.map(i => i.id)).toEqual(['4', '5', '6']);
    expect(get(r, 'di-noeq-code').items.length + get(r, 'di-noeq-missing').items.length).toBe(get(r, 'di-noeq').items.length);
    expect(get(r, 'di-noeq-code').population).toBe(6);
  });
  it('sans liste d\'équipements, le contrôle reste celui du lien vide et aucune ligne de séparation n\'est ajoutée', () => {
    const r = computeQuality(reqs, []);
    expect(get(r, 'di-noeq').items.length).toBe(5);
    expect(r.some(c => c.key === 'di-noeq-code' || c.key === 'di-noeq-missing')).toBe(false);
    expect(computeQuality(reqs, [], undefined, new Set()).some(c => c.key === 'di-noeq-code')).toBe(false);
  });
});

describe('computeQuality', () => {
  it('repère les anomalies des DI', () => {
    const r = computeQuality([
      di('1'), di('2', { code: '%' }), di('3', { code: 'DI00000114' }),
      di('4', { code: 'DI00000200', declaredAt: undefined, equipmentId: undefined, priorityCode: '' }),
      di('5', { code: 'DI00000300', origin: 'app', priorityCode: undefined }),
    ], []);
    expect(get(r, 'di-code').items.map(i => i.id)).toEqual(['2']);
    expect(get(r, 'di-dup').items.map(i => i.id)).toEqual(['1', '3']);
    expect(get(r, 'di-nodate').items.map(i => i.id)).toEqual(['4']);
    expect(get(r, 'di-noeq').items.map(i => i.id)).toEqual(['4']);
    expect(get(r, 'di-noprio').items.map(i => i.id)).toEqual(['4']); // les DI créées dans l'app ne sont pas comptées
    expect(get(r, 'di-noprio').population).toBe(4);
  });
  it('repère les anomalies des OT', () => {
    const r = computeQuality([], [
      wo('a'), wo('b', { equipmentId: undefined }), wo('c', { dueDate: '' }),
      wo('d', { interventionCode: '' }), wo('e', { code: 'NC-AG KENITRA-FEV2026-001' }),
    ]);
    expect(get(r, 'ot-noeq').items.map(i => i.id)).toEqual(['b']);
    expect(get(r, 'ot-nodue').items.map(i => i.id)).toEqual(['c']);
    expect(get(r, 'ot-nogamme').items.map(i => i.id)).toEqual(['d']);
    expect(get(r, 'ot-nc').items.map(i => i.id)).toEqual(['e']);
  });
});
