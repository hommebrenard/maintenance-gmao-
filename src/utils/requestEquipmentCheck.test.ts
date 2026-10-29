import { describe, it, expect } from 'vitest';
import { findSuspectEquipment, significantTokens, type EquipmentLite, type CheckableRow } from './requestEquipmentCheck';
import { TEST_EQUIPMENT, COSWIN_DI_SAMPLE } from './requestEquipmentCheck.fixture';

const equipment: EquipmentLite[] = TEST_EQUIPMENT.map(([code, name]) => ({ id: code, code, name, locationId: 'SITE' }));
const siteDi = COSWIN_DI_SAMPLE.filter(r => r[2] === 'TST_AG');
const rows: CheckableRow[] = siteDi.map(r => ({ code: r[0], title: r[1], equipment_id: r[3], location_id: 'SITE' }));

describe('contrôle de cohérence équipement des DI Coswin', () => {
  const suspects = findSuspectEquipment(rows, equipment);
  const byDi = new Map(suspects.map(s => [s.requestCode, s]));
  const corrected = siteDi.filter(r => r[3] !== r[4]);
  const unchanged = siteDi.filter(r => r[3] === r[4]);

  it('le jeu de données réel contient 16 DI corrigées à la main et 5 jugées justes', () => {
    expect(corrected.length).toBe(16);
    expect(unchanged.length).toBe(5);
  });

  it('signale les 16 DI mal rattachées et propose en premier l\u2019équipement corrigé par l\u2019utilisateur', () => {
    for (const r of corrected) {
      const s = byDi.get(r[0]);
      expect(s, r[0]).toBeDefined();
      expect(s!.suggestions[0].code, r[0]).toBe(r[4]);
      expect(s!.assigned.code).toBe(r[3]);
    }
    expect(suspects.length).toBe(16);
  });

  it('ne signale aucune des 5 DI correctement rattachées (dont le cas ambigu « ampoules / luminaires »)', () => {
    for (const r of unchanged) expect(byDi.has(r[0]), r[0]).toBe(false);
  });

  it('signale une divergence de puissance (onduleurs N3 et N4 : 20 KVA dans la DI, 10 KVA sur l\u2019équipement ; N5 : 20 KVA, cohérent)', () => {
    expect(byDi.get('DI00000003')!.powerNote).toContain('20 KVA');
    expect(byDi.get('DI00000004')!.powerNote).toContain('10 KVA');
    expect(byDi.get('DI00000005')!.powerNote).toBeUndefined();
  });

  it('ignore une DI dont l\u2019équipement n\u2019est pas rattaché à l\u2019application', () => {
    expect(findSuspectEquipment([{ code: 'X', title: 'ONDULEUR N1', equipment_id: null, location_id: 'SITE' }], equipment)).toEqual([]);
  });

  it('ne propose jamais un équipement d\u2019un autre site', () => {
    const moved = equipment.map(e => (e.code === 'TST-AG-OND-01' ? { ...e, locationId: 'AUTRE' } : e));
    const s = findSuspectEquipment(rows, moved).find(x => x.requestCode === 'DI00000001');
    expect(s!.suggestions.map(x => x.code)).not.toContain('TST-AG-OND-01');
  });

  it('mots significatifs : fautes de frappe, N05 = N5, mots-outils ignorés', () => {
    expect(significantTokens("BESOIN D'ENTRETIEN PREVENTIF CAISSON AIR NEUF N05 POUR LE MOIS D'octobre 2026")).toEqual(['caisson', 'air', 'neuf', 'n5']);
  });
});

describe('contrôle de cohérence : cas sans erreur', () => {
  it('une DI qui reprend la description de son propre équipement n\u2019est jamais signalée (tous les équipements du jeu de test)', () => {
    const own: CheckableRow[] = equipment.map(e => ({ code: `T-${e.code}`, title: `BESOIN D'ENTRETIEN PREVENTIF ${e.name}`, equipment_id: e.id, location_id: 'SITE' }));
    const flagged = findSuspectEquipment(own, equipment).map(s => `${s.assigned.code} -> ${s.suggestions[0].code}`);
    expect(flagged).toEqual([]);
  });
});

describe('contrôle de cohérence : DI courte et autre site', () => {
  const mk = (list: [string, string][]): EquipmentLite[] => list.map(([code, name]) => ({ id: code, code, name, locationId: 'B' }));
  const siteB = mk([
    ['B-OND-01', 'ONDULEUR N1 MARQUE: ZETA'], ['B-OND-02', 'ONDULEUR N2 MARQUE: ZETA'], ['B-PAC-01', 'POMPE A CHALEUR N1'], ['B-PAC-02', 'POMPE A CHALEUR N2'],
    ['B-APLC-01', 'ENSEMBLE APPAREILLAGES ELECTRIQUES MEZZANINE'], ['B-APLC-02', 'ENSEMBLE APPAREILLAGES ELECTRIQUES 3EME ETAGE'],
    ['B-SANT-01', 'ENSEMBLE EQUIPEMENTS SANITAIRE MEZZANINE'], ['B-CAN-01', 'CAISSON AIR NEUF N1'],
  ]);
  const T = (x: string) => `BESOIN D'ENTRETIEN PREVENTIF ${x} POUR LE MOIS D'OCTOBRE 2026`;

  it('fonctionne sur un autre site, sans règle propre à un site, même avec une description courte', () => {
    const r = findSuspectEquipment([
      { code: 'B1', title: T('ONDULEUR N2'), equipment_id: 'B-APLC-02', location_id: 'B' },
      { code: 'B2', title: T('POMPE A CHALEUR N1'), equipment_id: 'B-SANT-01', location_id: 'B' },
    ], siteB);
    expect(r.map(s => [s.requestCode, s.suggestions[0].code])).toEqual([['B1', 'B-OND-02'], ['B2', 'B-PAC-01']]);
  });

  it('ne signale pas une DI courte déjà bien rattachée', () => {
    expect(findSuspectEquipment([{ code: 'B3', title: T('ONDULEUR N2'), equipment_id: 'B-OND-02', location_id: 'B' }], siteB)).toEqual([]);
  });

  it('limite connue : si le vocabulaire diffère (UPS dans l\u2019équipement, ONDULEUR dans la DI), rien n\u2019est signalé', () => {
    const siteC = mk([['C-OND-03', 'UPS N3 10KVA'], ['C-APLC-01', 'ENSEMBLE APPAREILLAGES ELECTRIQUES RDC'], ['C-TE-01', 'TABLEAU ELECTRIQUE N1']]);
    expect(findSuspectEquipment([{ code: 'C1', title: T('ONDULEUR N3'), equipment_id: 'C-APLC-01', location_id: 'B' }], siteC.map(e => ({ ...e, locationId: 'C' })))).toEqual([]);
  });
});
