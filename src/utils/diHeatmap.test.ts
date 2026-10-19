import { describe, expect, it } from 'vitest';
import type { MaintenanceRequest } from '../types';
import { computeDiHeatmap, diHeatToCsv, parsePriority } from './diHeatmap';

const TODAY = new Date('2026-10-19T10:00:00Z');
const di = (id: string, extra: Partial<MaintenanceRequest> = {}): MaintenanceRequest => ({
  id, title: `DI ${id}`, description: '', status: 'En attente', priority: 'Moyenne', requestedBy: 'x', createdAt: '', code: id,
  declaredAt: '2026-10-15', priorityCode: 'U2', ...extra,
});

describe('parsePriority', () => {
  it('lit U0 à U3 au début du champ, sinon NA', () => {
    expect(parsePriority('U0 - Urgence')).toBe('U0');
    expect(parsePriority(' u3')).toBe('U3');
    expect(parsePriority('U4')).toBe('NA');
    expect(parsePriority(undefined)).toBe('NA');
  });
});

describe('computeDiHeatmap', () => {
  it('classe par priorité et âge, et exclut les DI avec OT, annulées, rejetées et clôturées', () => {
    const reqs = [
      di('a', { declaredAt: '2026-10-15' }),                       // 4 j, U2
      di('b', { declaredAt: '2026-09-01', priorityCode: 'U0' }),   // 48 j, U0
      di('c', { declaredAt: '2026-05-01', priorityCode: undefined }), // 171 j, NA
      di('d', { workOrderId: 'w1' }),                              // OT lié : exclue
      di('e', { otNumber: '86000', status: 'Approuvée' as never }),// OT Coswin : exclue
      di('f', { status: 'Rejetée', coswinState: '5. Annulée' }),   // annulée : exclue
      di('g', { status: 'Rejetée' }),                              // rejetée : exclue
      di('h', { status: 'Approuvée' as never, coswinState: '17. Clôturée sans OT' }), // clôturée : exclue
      di('i', { declaredAt: undefined, createdAtIso: undefined }), // sans date
      di('j', { status: 'Approuvée' as never, declaredAt: '2026-10-19' }), // prise en charge sans OT, 0 j
    ];
    const r = computeDiHeatmap(reqs, [], TODAY);
    expect(r.total).toBe(4);
    expect(r.withoutDate).toBe(1);
    expect(r.cells.U2.a7.map(i => i.request.id)).toEqual(['a', 'j']); // triées par âge décroissant
    expect(r.cells.U0.a90.map(i => i.request.id)).toEqual(['b']);
    expect(r.cells.NA.a90p.map(i => i.request.id)).toEqual(['c']);
  });
  it('exporte le nom du site quand il est connu', () => {
    const r = computeDiHeatmap([di('a', { siteCode: 'BAM_FEZ_AG' })], [], TODAY);
    const csv = diHeatToCsv(r.cells.U2.a7, code => (code === 'BAM_FEZ_AG' ? 'Succursale régionale Type A FES' : undefined));
    expect(csv).toContain('"Succursale régionale Type A FES"');
    expect(csv).not.toContain('"BAM_FEZ_AG"');
  });
  it('exporte un CSV avec en-tête', () => {
    const r = computeDiHeatmap([di('a')], [], TODAY);
    const csv = diHeatToCsv(r.cells.U2.a7);
    expect(csv.split('\n')).toHaveLength(2);
    expect(csv).toContain('"a"');
  });
});
