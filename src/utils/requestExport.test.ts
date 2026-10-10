import { describe, it, expect } from 'vitest';
import type { MaintenanceRequest } from '../types';
import { EMPTY_FILTERS, type RequestRowView } from './requestFilters';
import { EXPORT_COLUMNS, buildExportRows, describeFilters, formatRequestDate, periodLabel } from './requestExport';

const row = (o: Partial<MaintenanceRequest>, extra: Partial<RequestRowView> = {}): RequestRowView => ({
  req: { id: 'x', code: 'DI00000001', title: 'Fuite', description: 'd', priority: 'Moyenne', requestedBy: 'A', status: 'En attente', createdAt: '', origin: 'coswin', ...o } as MaintenanceRequest,
  state: 'En attente', siteKey: 'S1', matched: true, day: '2026-01-05', ts: 0, hay: '', ...extra,
});

describe('requestExport', () => {
  it('date Coswin : heure murale non convertie', () => {
    expect(formatRequestDate('2026-01-05T08:30:00+00:00', 'coswin')).toBe('2026-01-05 08:30');
    expect(formatRequestDate(undefined, 'coswin')).toBe('');
  });
  it('une ligne par demande, toutes les colonnes, N° OT avec préfixe, ordre conservé', () => {
    const out = buildExportRows([row({ code: 'DI2', otNumber: '80437', interventionType: 'CSR' }), row({ code: 'DI1', origin: 'app' })]);
    expect(out.map(r => r['N° DI'])).toEqual(['DI2', 'DI1']);
    expect(Object.keys(out[0])).toEqual([...EXPORT_COLUMNS]);
    expect(out[0]['N° OT']).toBe('OT-80437');
    expect(out[0]['Type']).toBe('CSR — Correctif - Suite ronde');
    expect(out[1]['Origine']).toBe('Application');
    expect(out[1]['N° OT']).toBe('');
  });
  it('résumé des filtres : seuls les filtres actifs apparaissent', () => {
    const lines = describeFilters({ ...EMPTY_FILTERS, type: 'CSR', unmatchedOnly: true }, 2812, 40);
    expect(lines.map(l => l[0])).toEqual(['Export des demandes', 'Demandes exportées', 'Type', 'Équipement non rapproché']);
    expect(lines[1][1]).toBe('40 sur 2812');
  });
  it('période : bornes des filtres si posées, sinon dates des lignes', () => {
    const rs = [row({}, { day: '2026-03-10' }), row({}, { day: '2023-09-19' }), row({}, { day: '2026-10-07' })];
    expect(periodLabel(rs, { from: '', to: '' })).toBe('du 19/09/2023 au 07/10/2026');
    expect(periodLabel(rs, { from: '2026-01-01', to: '2026-06-30' })).toBe('du 01/01/2026 au 30/06/2026');
    expect(periodLabel(rs, { from: '2026-01-01', to: '' })).toBe('du 01/01/2026 au 07/10/2026');
    expect(periodLabel([], { from: '2026-01-01', to: '' })).toBe('à partir du 01/01/2026');
    expect(periodLabel([], { from: '', to: '' })).toBe('');
  });
});
