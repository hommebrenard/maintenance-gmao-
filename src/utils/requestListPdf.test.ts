import { describe, it, expect } from 'vitest';
import type { MaintenanceRequest } from '../types';
import { EMPTY_FILTERS, type RequestRowView } from './requestFilters';
import { renderRequestListPdf, LIST_VISAS } from './requestListPdf';

const row = (i: number): RequestRowView => ({
  req: { id: String(i), code: `DI${String(i).padStart(8, '0')}`, title: 'Titre assez long '.repeat(8), description: '', priority: 'Moyenne', requestedBy: 'AB', status: 'En attente', createdAt: '', origin: 'coswin', createdAtIso: '2026-01-05T16:39:00+00:00', otNumber: '80437', interventionType: 'CSR' } as MaintenanceRequest,
  state: 'Clôturée', siteKey: 'BAM_TNG_AG', matched: true, day: '2026-01-05', ts: 0, hay: '', equipmentLabel: 'ECLAIRAGE INTERIEUR VILLA 29 (BAM-TNG_CV-ECLIN-18)',
});

describe('requestListPdf', () => {
  it('petite liste : 1 page paysage avec visas', () => {
    const doc = renderRequestListPdf([row(1), row(2)], { ...EMPTY_FILTERS, type: 'CSR' }, 2812);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
    expect(LIST_VISAS).toHaveLength(2);
  });
  it('longue liste : plusieurs pages, jamais plus que nécessaire', () => {
    const rows = Array.from({ length: 300 }, (_, i) => row(i + 1));
    const n = renderRequestListPdf(rows, EMPTY_FILTERS, 300).getNumberOfPages();
    expect(n).toBeGreaterThan(3);
    expect(n).toBeLessThan(20);
  });
  it('liste vide : PDF valide', () => {
    expect(renderRequestListPdf([], EMPTY_FILTERS, 10).getNumberOfPages()).toBe(1);
  });
});
