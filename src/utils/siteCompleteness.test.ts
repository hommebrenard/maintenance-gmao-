import { describe, it, expect } from 'vitest';
import { EXPECTED_EQUIPMENT_BY_ZONE } from '../data/equipmentExpectedBySite';
import { siteCompleteness, normZoneCode } from './siteCompleteness';

describe('référentiel attendu par site', () => {
  it('compte 5 103 équipements techniques au total', () => {
    expect(Object.values(EXPECTED_EQUIPMENT_BY_ZONE).reduce((a, b) => a + b, 0)).toBe(5103);
  });
  it('reprend les sites vérifiés sur captures du 23/10', () => {
    expect(EXPECTED_EQUIPMENT_BY_ZONE.BAM_LYN_AG).toBe(94);
    expect(EXPECTED_EQUIPMENT_BY_ZONE.BAM_HCM_AG).toBe(73);
    expect(EXPECTED_EQUIPMENT_BY_ZONE.BAM_ORZ_HB).toBe(87);
    expect(EXPECTED_EQUIPMENT_BY_ZONE.BAM_ESR_CV).toBe(47);
  });
});

describe('siteCompleteness', () => {
  it('normalise tiret / tiret bas / casse', () => {
    expect(normZoneCode(' bam-mrn_cv ')).toBe('BAM_MRN_CV');
  });
  it('site complet : rien à signaler', () => {
    expect(siteCompleteness('BAM_LYN_AG', 94)).toEqual({ expected: 94, count: 94, missing: 0, incomplete: false });
  });
  it('site incomplet : indique ce qui manque (code avec tiret accepté)', () => {
    const r = siteCompleteness('BAM-HCM_AG', 66);
    expect(r.missing).toBe(7);
    expect(r.incomplete).toBe(true);
  });
  it('plus d\'équipements que la référence : pas d\'alerte', () => {
    expect(siteCompleteness('BAM_LYN_AG', 100).incomplete).toBe(false);
  });
  it('site absent de la référence : pas d\'alerte', () => {
    expect(siteCompleteness('BAM_XXX_CV', 0)).toEqual({ expected: null, count: 0, missing: 0, incomplete: false });
  });
});
