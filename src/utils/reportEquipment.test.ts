import { describe, it, expect } from 'vitest';
import {
  buildEquipmentRows, summarizeEquipment, filterEquipmentRows, sortEquipmentRows, EMPTY_EQUIPMENT_FILTERS,
} from './reportEquipment';

const eq = (o: any) => ({ id: o.code, name: o.code, status: 'En service', criticality: 'Normal', location: 'Kénitra', ...o }) as any;
const wo = (o: any) => ({ id: o.code, status: 'Ouvert', ...o }) as any;

const EQUIPMENT = [
  eq({ code: 'BAM-KNT_AG-ASC-01', criticality: 'Critique', status: 'Arrêt non planifié' }),
  eq({ code: 'BAM-KNT_AG-OND-01', criticality: 'Élevée', status: 'Arrêt non planifié' }),
  eq({ code: 'BAM-KNT_AG-SPT-01', criticality: 'Faible', status: 'Arrêt planifié' }),
  eq({ code: 'BAM-KNT_AG-ECLEX-01' }),
];
const ORDERS = [
  wo({ code: 'A', equipmentCode: 'BAM-KNT_AG-ASC-01' }),
  wo({ code: 'B', equipmentCode: 'BAM-KNT_AG-ASC-01', status: 'Terminé' }),
  wo({ code: 'C', equipmentId: 'BAM-KNT_AG-OND-01' }),
  wo({ code: 'D', equipmentCode: 'INCONNU-01' }),
  wo({ code: 'E' }),
  wo({ code: 'F', equipmentCode: 'BAM-KNT_AG-SPT-01', status: 'Annulé' }),
];

describe('reportEquipment', () => {
  it('rattache les OT par id puis par code, compte ouverts / total et les OT orphelins', () => {
    const { rows, orphanWoCount } = buildEquipmentRows(EQUIPMENT, ORDERS);
    const get = (c: string) => rows.find(r => r.eq.code === c)!;
    expect([get('BAM-KNT_AG-ASC-01').totalWo, get('BAM-KNT_AG-ASC-01').openWo]).toEqual([2, 1]);
    expect([get('BAM-KNT_AG-OND-01').totalWo, get('BAM-KNT_AG-OND-01').openWo]).toEqual([1, 1]);
    expect([get('BAM-KNT_AG-SPT-01').totalWo, get('BAM-KNT_AG-SPT-01').openWo]).toEqual([1, 0]);
    expect(get('BAM-KNT_AG-ECLEX-01').totalWo).toBe(0);
    expect(orphanWoCount).toBe(2);
  });

  it('déduit famille et lot depuis le code (éclairage extérieur = Électricité)', () => {
    const { rows } = buildEquipmentRows(EQUIPMENT, []);
    expect(rows.map(r => [r.family, r.lot])).toEqual([['ASC', 'CIRC'], ['OND', 'ELEC'], ['SPT', 'FLUIDE'], ['ECLEX', 'ELEC']]);
  });

  it('synthèse : critiques à l\'arrêt (Élevée ou Critique + arrêt non planifié) et équipements sans OT', () => {
    const s = summarizeEquipment(buildEquipmentRows(EQUIPMENT, ORDERS).rows);
    expect(s).toEqual({ total: 4, inService: 1, plannedStop: 1, unplannedStop: 2, criticalDown: 2, withoutWo: 1 });
  });

  it('filtres : lot, famille, statut, criticité, filtres rapides et recherche', () => {
    const { rows } = buildEquipmentRows(EQUIPMENT, ORDERS);
    const f = (o: any) => filterEquipmentRows(rows, { ...EMPTY_EQUIPMENT_FILTERS, ...o }).map(r => r.eq.code);
    expect(f({ lot: 'ELEC' })).toEqual(['BAM-KNT_AG-OND-01', 'BAM-KNT_AG-ECLEX-01']);
    expect(f({ family: 'SPT' })).toEqual(['BAM-KNT_AG-SPT-01']);
    expect(f({ status: 'Arrêt planifié' })).toEqual(['BAM-KNT_AG-SPT-01']);
    expect(f({ criticality: 'Faible' })).toEqual(['BAM-KNT_AG-SPT-01']);
    expect(f({ quick: 'withoutWo' })).toEqual(['BAM-KNT_AG-ECLEX-01']);
    expect(f({ quick: 'criticalDown' })).toEqual(['BAM-KNT_AG-ASC-01', 'BAM-KNT_AG-OND-01']);
    expect(f({ search: 'ond-01' })).toEqual(['BAM-KNT_AG-OND-01']);
    expect(f({ lot: 'ELEC', quick: 'criticalDown' })).toEqual(['BAM-KNT_AG-OND-01']);
  });

  it('tri par criticité et par OT ouverts, sens inversé, valeurs vides en fin', () => {
    const { rows } = buildEquipmentRows(EQUIPMENT, ORDERS);
    const codes = (k: any, d: any) => sortEquipmentRows(rows, k, d).map(r => r.eq.code.slice(-6));
    expect(codes('criticality', 'desc')[0]).toBe('ASC-01');
    expect(codes('criticality', 'asc')[0]).toBe('SPT-01');
    expect(codes('openWo', 'desc').slice(0, 2)).toEqual(['ASC-01', 'OND-01']);
    const withBlank = buildEquipmentRows([...EQUIPMENT, eq({ code: 'SANS-FAMILLE' })], []).rows;
    expect(sortEquipmentRows(withBlank, 'family', 'asc').at(-1)!.eq.code).toBe('SANS-FAMILLE');
    expect(sortEquipmentRows(withBlank, 'family', 'desc').at(-1)!.eq.code).toBe('SANS-FAMILLE');
  });
});
