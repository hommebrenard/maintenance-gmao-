import { describe, it, expect, afterEach } from 'vitest';
import type { LocationItem } from '../types';
import { familyKeyOf, setEquipmentFamilies } from './annualMatrix';
import { analyzeEquipmentRows } from './coswinEquipmentImport';

afterEach(() => { setEquipmentFamilies([]); });

describe('familyKeyOf avec la colonne equipment.coswin_family', () => {
  it('sans famille en base : table statique, puis segment du code (comportement inchangé)', () => {
    expect(familyKeyOf('BAM-CAB_CV-API12-A11')).toBe('APLC');   // table statique (le segment donnerait AUTRES)
    expect(familyKeyOf('BAM-XX_YY-ABC-01')).toBe('ABC');        // segment du code
    expect(familyKeyOf('code illisible')).toBe('AUTRES');
  });
  it('la famille en base passe avant la table statique et le segment', () => {
    setEquipmentFamilies([{ code: 'BAM-CAB_CV-API12-A11', coswinFamily: 'zzz' }, { code: 'BAM-XX_YY-ABC-01', coswinFamily: 'DEF' }]);
    expect(familyKeyOf('BAM-CAB_CV-API12-A11')).toBe('ZZZ');
    expect(familyKeyOf('BAM-XX_YY-ABC-01')).toBe('DEF');
  });
  it('« - » et « _ » sont confondus, comme à l\'import', () => {
    setEquipmentFamilies([{ code: 'BAM-XX_YY-ABC-01', coswinFamily: 'DEF' }]);
    expect(familyKeyOf('BAM_XX_YY_ABC_01')).toBe('DEF');
  });
  it('une famille vide en base est ignorée (repli)', () => {
    setEquipmentFamilies([{ code: 'BAM-XX_YY-ABC-01', coswinFamily: '  ' }, { code: 'BAM-XX_YY-ABC-02' }]);
    expect(familyKeyOf('BAM-XX_YY-ABC-01')).toBe('ABC');
  });
  it('setEquipmentFamilies renvoie true seulement si la correspondance change', () => {
    const list = [{ code: 'BAM-XX_YY-ABC-01', coswinFamily: 'DEF' }];
    expect(setEquipmentFamilies(list)).toBe(true);
    expect(setEquipmentFamilies([...list])).toBe(false);
    expect(setEquipmentFamilies([{ code: 'BAM-XX_YY-ABC-01', coswinFamily: 'GHI' }])).toBe(true);
    expect(setEquipmentFamilies([])).toBe(true);
    expect(setEquipmentFamilies([])).toBe(false);
  });
});

describe('import Coswin d\'équipements : colonne « Famille »', () => {
  const locations: LocationItem[] = [{ id: 'L1', name: 'AG Type B SAFI', code: 'BAM_SAF_AG', type: 'Site', equipmentCount: 0 }];
  const base = { "Description de l'équipement": 'X', Zone: 'BAM_SAF_AG', 'Description de la zone': 'z' };
  it('lit le code famille (en majuscules) des équipements à créer', () => {
    const r = analyzeEquipmentRows([{ ...base, 'Code équipement': 'BAM-SAF_AG-TD-09', 'Famille ': ' te ' }], [], locations);
    expect(r.toCreate[0].coswinFamily).toBe('TE');
  });
  it('pas de famille quand la colonne est vide ou absente', () => {
    const r = analyzeEquipmentRows([
      { ...base, 'Code équipement': 'BAM-SAF_AG-TD-09', 'Famille ': '' },
      { ...base, 'Code équipement': 'BAM-SAF_AG-TD-10' },
    ], [], locations);
    expect(r.toCreate.map(x => x.coswinFamily)).toEqual([undefined, undefined]);
  });
});
