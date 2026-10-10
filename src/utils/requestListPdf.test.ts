import { describe, it, expect } from 'vitest';
import type { MaintenanceRequest } from '../types';
import { EMPTY_FILTERS, type RequestRowView } from './requestFilters';
import { jsPDF } from 'jspdf';
import { renderRequestListPdf, LIST_VISAS, wrapCell, MAX_CELL_LINES } from './requestListPdf';

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
    expect(n).toBeLessThan(30);
  });
  it('liste vide : PDF valide', () => {
    expect(renderRequestListPdf([], EMPTY_FILTERS, 10).getNumberOfPages()).toBe(1);
  });
  it('texte long : renvoyé à la ligne en entier, sans « … » (sous le garde-fou)', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' }).setFontSize(7.5);
    const t = 'Nous vous signalons une fuite au niveau de la canalisation d\'eau potable des WC situés dans le local Guichet VIP';
    const lines = wrapCell(doc, t, 62);
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.join(' ')).toBe(t);
    expect(wrapCell(doc, 'mot '.repeat(2000), 62)).toHaveLength(MAX_CELL_LINES);
  });
  it('titre interne du PDF renseigné (plus de « Sans titre » dans le navigateur)', () => {
    const doc = renderRequestListPdf([row(1)], EMPTY_FILTERS, 1);
    expect(String(doc.output()).includes("/Title (Liste des demandes d'intervention)")).toBe(true);
  });
});
