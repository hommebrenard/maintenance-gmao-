import { describe, it, expect } from 'vitest';
import { isExcelFileName, EXCEL_ACCEPT } from './excelFileGuard';

describe('isExcelFileName', () => {
  it('accepte .xlsx et .xls, majuscules et espaces compris', () => {
    for (const n of ['demande maj du 30-10-2026.xlsx', 'export.XLSX', 'export.xls', ' export.xlsx '])
      expect(isExcelFileName(n)).toBe(true);
  });
  it('refuse .csv, autres formats et noms sans extension valide', () => {
    for (const n of ['demande maj du 30-10-2026.csv', 'export.CSV', 'export.txt', 'export.xlsx.csv', 'xlsx', ''])
      expect(isExcelFileName(n)).toBe(false);
  });
  it('le sélecteur ne propose pas .csv', () => { expect(EXCEL_ACCEPT).not.toContain('csv'); });
});
