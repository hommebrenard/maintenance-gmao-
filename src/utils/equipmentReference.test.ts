import { describe, it, expect } from 'vitest';
import { EQUIPMENT_FAMILY_REF, EQUIPMENT_FAMILY_REF_COUNT } from '../data/equipmentReference';
import { familyKeyOf } from './annualMatrix';
import { FAMILIES, contractLotOfFamily, subLotOfFamily } from './equipmentFamilies';

describe('référentiel équipement → famille Coswin (cartographie du 22/10/2026)', () => {
  it("contient les 2 734 équipements dont la famille Coswin diffère du code", () => {
    expect(Object.keys(EQUIPMENT_FAMILY_REF).length).toBe(EQUIPMENT_FAMILY_REF_COUNT);
    expect(EQUIPMENT_FAMILY_REF_COUNT).toBe(2734);
  });
  it('lit la famille Coswin, pas le segment du code', () => {
    expect(familyKeyOf('BAM-FEZ_AG-TD-16')).toBe('TE');          // TD → TE
    expect(familyKeyOf('BAM-KNT_AG-PRAUT-01')).toBe('C-ACC');     // PRAUT → C-ACC
    expect(familyKeyOf('BAM-RAK_AG-SPT-G-01')).toBe('SPT');       // segment « G » illisible
    expect(familyKeyOf('BAM-CAB_CV-SANI11-A6')).toBe('SANT');     // pas de segment lisible
    expect(familyKeyOf('BAM-CAB_CV-TD-I11-A6')).toBe('TE');
    expect(familyKeyOf('BAM-CAB_CV-PISC-VI')).toBe('PISC');
  });
  it('repli sur le segment du code pour un équipement absent du référentiel', () => {
    expect(familyKeyOf('BAM-X-ASC-01')).toBe('ASC');
    expect(familyKeyOf('sans format')).toBe('AUTRES');
  });
  it('les OT de CAB_CV ne sont plus hors contrat', () => {
    expect(contractLotOfFamily(familyKeyOf('BAM-CAB_CV-SANI11-A6'))).toBe('FLUIDE');
    expect(contractLotOfFamily(familyKeyOf('BAM-CAB_CV-TD-I11-A6'))).toBe('ELECTRICITE');
  });
  it('toute famille du référentiel est connue, a un lot et un sous-lot (jamais « Non classé »)', () => {
    for (const fam of new Set(Object.values(EQUIPMENT_FAMILY_REF))) {
      expect(FAMILIES[fam], fam).toBeDefined();
      expect(contractLotOfFamily(fam), fam).not.toBe('NON_CLASSE');
      expect(subLotOfFamily(fam), fam).not.toBe('Autres familles');
    }
  });
  it('une famille absente du référentiel est « Non classé »', () => {
    expect(contractLotOfFamily('ZZZ')).toBe('NON_CLASSE');
    expect(contractLotOfFamily('AUTRES')).toBe('NON_CLASSE');
    expect(contractLotOfFamily('IFBT')).toBe('HORS_CONTRAT');
  });
});
