import { describe, it, expect } from 'vitest';
import type { WorkOrder } from '../types';
import { EXPORT_HEADERS, toExportRow, buildCsv, coswinNumber, formatDateTimeFr, slugify, exportFileName } from './reportExport';

const base = (over: Partial<WorkOrder> = {}): WorkOrder => ({
  id: '1', code: 'OT-89521', title: 'MENSUEL TD', description: '', status: 'Ouvert', priority: 'Moyenne',
  type: 'Préventive', equipmentCode: 'BAM-FEZ_AG-TD-16', equipmentName: 'AR 1', location: 'Fès',
  dueDate: '2026-06-29', createdAt: '', updatedAt: '', interventionCode: 'PS-TD-1M-01', planNumber: '159',
  ...over,
} as WorkOrder);

describe('reportExport', () => {
  it('une ligne a autant de colonnes que l\'en-tête', () => {
    expect(toExportRow(base())).toHaveLength(EXPORT_HEADERS.length);
  });
  it('N° OT Coswin : rempli pour OT-…, vide pour NC-…', () => {
    expect(coswinNumber('OT-89521')).toBe('OT-89521');
    expect(coswinNumber('NC-Fès-JUIN2026-001')).toBe('');
    expect(coswinNumber('OT-261007-4821')).toBe(''); // OT créé dans l'application
    expect(coswinNumber(undefined)).toBe('');
  });
  it('famille, lot, fréquence, site, échéance au format français', () => {
    const r = toExportRow(base());
    const h = (n: string) => r[EXPORT_HEADERS.indexOf(n)];
    expect(h('Site')).toBe('Fès');
    expect(h('Famille')).toBe('TD');
    expect(h('Lot')).toBe('Électricité');
    expect(h('Fréquence')).toBe('M');
    expect(h("Date d'échéance")).toBe('29/06/2026');
    expect(h('N° de plan')).toBe('159');
  });
  it('date de clôture : vide sans closedAt, formatée avec', () => {
    const idx = EXPORT_HEADERS.indexOf('Date de clôture (système)');
    expect(toExportRow(base())[idx]).toBe('');
    expect(toExportRow(base({ closedAt: '2026-10-07T08:41:58.532913+00:00' }))[idx]).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    expect(formatDateTimeFr('pas une date')).toBe('');
  });
  it('CSV : BOM, séparateur ;, guillemets doublés, lignes CRLF', () => {
    const csv = buildCsv([base({ title: 'Test "cité"; avec point-virgule' })]);
    expect(csv.startsWith('\uFEFF"Code OT";')).toBe(true);
    expect(csv).toContain('"Test ""cité""; avec point-virgule"');
    expect(csv.split('\r\n')).toHaveLength(2);
  });
  it('nom de fichier : seuls les filtres actifs, sans accents ni espaces', () => {
    expect(slugify(' AG Type A AL HOCEIMA')).toBe('ag-type-a-al-hoceima');
    expect(exportFileName({}, '2026-10-07')).toBe('rapport-ot-2026-10-07.csv');
    expect(exportFileName({ site: 'Succursale régionale Type A FES', lot: 'Électricité', freq: 'M' }, '2026-10-07'))
      .toBe('rapport-ot-succursale-regionale-type-a-fes-electricite-m-2026-10-07.csv');
  });
});
