import { describe, it, expect } from 'vitest';
import { findSuspectEquipment, significantTokens, type EquipmentLite, type CheckableRow } from './requestEquipmentCheck';
import { FES_EQUIPMENT, COSWIN_DI_SAMPLE } from './requestEquipmentCheck.fixture';

const equipment: EquipmentLite[] = FES_EQUIPMENT.map(([code, name]) => ({ id: code, code, name, locationId: 'FES' }));
const fes = COSWIN_DI_SAMPLE.filter(r => r[2] === 'BAM_FEZ_AG');
const rows: CheckableRow[] = fes.map(r => ({ code: r[0], title: r[1], equipment_id: r[3], location_id: 'FES' }));

describe('contrôle de cohérence équipement des DI Coswin', () => {
  const suspects = findSuspectEquipment(rows, equipment);
  const byDi = new Map(suspects.map(s => [s.requestCode, s]));
  const corrected = fes.filter(r => r[3] !== r[4]);
  const unchanged = fes.filter(r => r[3] === r[4]);

  it('le jeu de données réel contient 16 DI corrigées à la main et 5 jugées justes à Fès', () => {
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

  it('signale une divergence de puissance (onduleurs N3 et N4 : 20 KVA dans la DI, 10 KVA sur l\u2019équipement)', () => {
    expect(byDi.get('DI00003365')!.powerNote).toContain('20 KVA');
    expect(byDi.get('DI00003366')!.powerNote).toContain('10 KVA');
    expect(byDi.get('DI00003367')!.powerNote).toBeUndefined();
  });

  it('ignore une DI dont l\u2019équipement n\u2019est pas rattaché à l\u2019application', () => {
    expect(findSuspectEquipment([{ code: 'X', title: 'ONDULEUR N1', equipment_id: null, location_id: 'FES' }], equipment)).toEqual([]);
  });

  it('ne propose jamais un équipement d\u2019un autre site', () => {
    const moved = equipment.map(e => (e.code === 'BAM-FEZ_AG-OND-01' ? { ...e, locationId: 'AUTRE' } : e));
    const s = findSuspectEquipment(rows, moved).find(x => x.requestCode === 'DI00003362');
    expect(s!.suggestions.map(x => x.code)).not.toContain('BAM-FEZ_AG-OND-01');
  });

  it('mots significatifs : fautes de frappe, N05 = N5, mots-outils ignorés', () => {
    expect(significantTokens("BESOIN D'ENTRETIEN PREVENTIF CAISSON AIR NEUF N05 POUR LE MOIS D'octobre 2026")).toEqual(['caisson', 'air', 'neuf', 'n5']);
  });
});

describe('contrôle de cohérence : cas sans erreur', () => {
  it('une DI qui reprend la description de son propre équipement n\u2019est jamais signalée (156 équipements de Fès)', () => {
    const own: CheckableRow[] = equipment.map(e => ({ code: `T-${e.code}`, title: `BESOIN D'ENTRETIEN PREVENTIF ${e.name}`, equipment_id: e.id, location_id: 'FES' }));
    const flagged = findSuspectEquipment(own, equipment).map(s => `${s.assigned.code} -> ${s.suggestions[0].code}`);
    expect(flagged).toEqual([]);
  });
});
