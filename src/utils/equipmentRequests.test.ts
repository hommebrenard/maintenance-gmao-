import { describe, it, expect } from 'vitest';
import type { MaintenanceRequest, WorkOrder } from '../types';
import { requestsForEquipment, linkedRequestRows, passportRequestRows, splitRequestRows, archivedSummary } from './equipmentRequests';

const r = (p: Partial<MaintenanceRequest>) => ({ id: p.code ?? 'x', title: 't', description: '', status: 'Approuvée', priority: 'Moyenne', requestedBy: '', createdAt: '', ...p } as MaintenanceRequest);
const eq = { id: 'E1', code: 'BAM-FEZ_AG-PMP-01' };

describe('equipmentRequests', () => {
  it('lien par id (demande de l\'application) ou par code (Coswin), insensible à la casse, plus récentes d\'abord', () => {
    const list = [
      r({ code: 'A', equipmentId: 'E1', createdAtIso: '2026-01-01T00:00:00Z' }),
      r({ code: 'B', equipmentCode: 'bam-fez_ag-pmp-01', createdAtIso: '2026-03-01T00:00:00Z' }),
      r({ code: 'C', equipmentId: 'E2', equipmentCode: 'AUTRE' }),
      r({ code: 'D' }),
    ];
    expect(requestsForEquipment(list, eq).map(x => x.code)).toEqual(['B', 'A']);
  });
  it('état affiché : DI annulée Coswin, clôturée selon l\'OT', () => {
    const list = [
      r({ code: 'A', equipmentCode: eq.code, status: 'Rejetée', coswinState: '5. Annulée', createdAtIso: '2026-02-01' }),
      r({ code: 'B', equipmentCode: eq.code, status: 'Approuvée', otState: 'T', createdAtIso: '2026-01-01' }),
    ];
    expect(linkedRequestRows(list, eq, [] as WorkOrder[]).map(x => x.state)).toEqual(['DI annulée', 'Clôturée']);
  });
  it('passeport : année en cours + non closes des années précédentes', () => {
    const list = [
      r({ code: 'A', equipmentCode: eq.code, status: 'Approuvée', otState: 'T', createdAtIso: '2026-03-01' }),   // 2026 clôturée : gardée
      r({ code: 'B', equipmentCode: eq.code, status: 'Approuvée', otState: 'T', createdAtIso: '2025-03-01' }),   // 2025 clôturée : exclue
      r({ code: 'C', equipmentCode: eq.code, status: 'Approuvée', otState: 'A', createdAtIso: '2025-05-01' }),   // 2025 non close : gardée
      r({ code: 'D', equipmentCode: eq.code, status: 'Rejetée', coswinState: '5. Annulée', createdAtIso: '2024-01-01' }), // 2024 annulée : exclue
    ];
    const rows = linkedRequestRows(list, eq, [] as WorkOrder[]);
    expect(passportRequestRows(rows, 2026).map(x => x.req.code).sort()).toEqual(['A', 'C']);
  });
  it('découpage : détaillées / archivées + résumé par année', () => {
    const list = [
      r({ code: 'A', equipmentCode: eq.code, status: 'Approuvée', otState: 'T', createdAtIso: '2026-03-01' }),
      r({ code: 'B', equipmentCode: eq.code, status: 'Approuvée', otState: 'T', createdAtIso: '2025-03-01' }),
      r({ code: 'C', equipmentCode: eq.code, status: 'Approuvée', otState: 'A', createdAtIso: '2025-05-01' }),
      r({ code: 'D', equipmentCode: eq.code, status: 'Rejetée', coswinState: '5. Annulée', createdAtIso: '2024-01-01' }),
    ];
    const { recent, archived } = splitRequestRows(linkedRequestRows(list, eq, [] as WorkOrder[]), 2026);
    expect(recent.length + archived.length).toBe(4);
    expect(archived.map(x => x.req.code)).toEqual(['B', 'D']);
    expect(archivedSummary(archived)).toEqual([{ year: '2025', codes: ['B'] }, { year: '2024', codes: ['D'] }]);
  });
  it('code vide : aucun lien parasite', () => {
    expect(requestsForEquipment([r({ code: 'A', equipmentCode: '' })], { id: 'E9', code: '' })).toEqual([]);
  });
});
