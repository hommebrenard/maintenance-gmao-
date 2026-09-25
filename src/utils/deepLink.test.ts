import { describe, it, expect } from 'vitest';
import { parseHealthRecordsHash } from './deepLink';

describe('parseHealthRecordsHash', () => {
  it('lit un lien de fiche simple', () => {
    expect(parseHealthRecordsHash('#health-records/abc-123')).toEqual({
      equipmentId: 'abc-123',
      openAddForm: false,
    });
  });

  it('lit un lien de nouvelle entrée', () => {
    expect(parseHealthRecordsHash('#health-records/abc-123/nouvelle-entree')).toEqual({
      equipmentId: 'abc-123',
      openAddForm: true,
    });
  });

  it('tolère un slash final', () => {
    expect(parseHealthRecordsHash('#health-records/abc-123/')?.openAddForm).toBe(false);
    expect(parseHealthRecordsHash('#health-records/abc-123/nouvelle-entree/')?.openAddForm).toBe(true);
  });

  it('décode un id encodé', () => {
    expect(parseHealthRecordsHash('#health-records/a%20b')?.equipmentId).toBe('a b');
  });

  it('garde la valeur brute si le décodage échoue', () => {
    expect(parseHealthRecordsHash('#health-records/%E0%A4%A')?.equipmentId).toBe('%E0%A4%A');
  });

  it('ignore les formats inconnus', () => {
    expect(parseHealthRecordsHash('')).toBeNull();
    expect(parseHealthRecordsHash('#work-orders')).toBeNull();
    expect(parseHealthRecordsHash('#health-records')).toBeNull();
    expect(parseHealthRecordsHash('#health-records/')).toBeNull();
    expect(parseHealthRecordsHash('#health-records/abc/autre-chose')).toBeNull();
    expect(parseHealthRecordsHash('#health-records/abc/nouvelle-entree/plus')).toBeNull();
  });
});
