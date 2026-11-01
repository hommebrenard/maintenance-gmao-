import { describe, it, expect } from 'vitest';
import { buildGapRows, gapRowsToCsv } from './requestSyncGapExport';
import type { ReviewItem, ReviewFileRow } from './requestSyncReview';

// Données entièrement fictives.
const item = (code: string, state: ReviewItem['state'], oldCode?: string, title = 'ONDULEUR N1'): ReviewItem =>
  ({ code, title, state, held: false, oldEquipment: oldCode ? { id: oldCode, code: oldCode } : undefined });
const row = (code: string, planned: string | null, source: string | null): ReviewFileRow =>
  ({ code, title: 'x', site_code: 'TST-SITE-A', planned_equipment_code: planned, equipment_code: source });

describe('buildGapRows', () => {
  it('ne liste que les verrous dont Coswin diffère, triés par N° de DI', () => {
    const items = [
      item('D3', 'verrou_stable', 'TST-A-OND-01'), item('D1', 'verrou_change_coswin', 'TST-A-OND-02'),
      item('D2', 'verrou_aligne', 'TST-A-OND-01'), item('D4', 'conforme', 'TST-A-OND-01'), item('D5', 'nouveau_conflit', 'TST-A-OND-01'),
    ];
    const files = [row('D1', 'TST-A-EXT-01', null), row('D2', 'TST-A-OND-01', null), row('D3', 'TST-A-EXT-01', null)];
    const r = buildGapRows(items, files);
    expect(r.map(x => x['N° de DI'])).toEqual(['D1', 'D3']);
    expect(r[0]).toMatchObject({ 'Équipement Coswin': 'TST-A-EXT-01', 'Équipement réel': 'TST-A-OND-02' });
  });
  it('équipement Coswin = planifié, sinon source', () => {
    const r = buildGapRows([item('D1', 'verrou_stable', 'TST-A-OND-01'), item('D2', 'verrou_stable', 'TST-A-OND-01')],
      [row('D1', 'TST-A-EXT-01', 'TST-A-POM-01'), row('D2', null, 'TST-A-POM-01')]);
    expect(r.map(x => x['Équipement Coswin'])).toEqual(['TST-A-EXT-01', 'TST-A-POM-01']);
  });
  it('aucun écart : liste vide', () => { expect(buildGapRows([item('D1', 'conforme')], [row('D1', 'A', null)])).toEqual([]); });
});

describe('gapRowsToCsv', () => {
  it('BOM, séparateur « ; », en-têtes et lignes', () => {
    const csv = gapRowsToCsv(buildGapRows([item('D1', 'verrou_stable', 'TST-A-OND-01')], [row('D1', 'TST-A-EXT-01', null)]));
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv.slice(1).split('\r\n')).toEqual(['N° de DI;Description;Équipement Coswin;Équipement réel', 'D1;ONDULEUR N1;TST-A-EXT-01;TST-A-OND-01', '']);
  });
  it('guillemets, point-virgule et formule neutralisés', () => {
    const csv = gapRowsToCsv([{ 'N° de DI': 'D1', 'Description': '=CMD;"a"', 'Équipement Coswin': 'X', 'Équipement réel': 'Y' }]);
    expect(csv.split('\r\n')[1]).toBe('D1;"\'=CMD;""a""";X;Y');
  });
});
