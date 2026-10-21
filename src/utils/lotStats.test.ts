import { describe, expect, it } from 'vitest';
import type { MaintenanceRequest, WorkOrder } from '../types';
import { CONTRACT_LOT_LABELS, contractLotOfFamily, subLotOfFamily } from './equipmentFamilies';
import { computeLotRows, contractLotOfFunction, contractLotOfRequest, contractLotOfWorkOrder, filterRequestsByLot, filterWorkOrdersByLot } from './lotStats';

const TODAY = new Date('2026-10-20T10:00:00Z');
const ot = (id: string, equipmentCode: string, extra: Partial<WorkOrder> = {}): WorkOrder => ({
  id, code: `OT-${id}`, title: id, description: '', status: 'Ouvert', priority: 'Moyenne', type: 'Préventif' as never,
  equipmentCode, dueDate: '2026-12-01', createdAt: '', updatedAt: '', ...extra,
} as WorkOrder);
const di = (id: string, extra: Partial<MaintenanceRequest> = {}): MaintenanceRequest => ({
  id, title: id, description: '', status: 'En attente', priority: 'Moyenne', requestedBy: 'x', createdAt: '', code: id, declaredAt: '2026-10-15', ...extra,
});

describe('lots du contrat (équipements)', () => {
  it('deux lots de contrat : électricité (dont appareils élévateurs, cuisine) et fluide ; IFBT hors contrat', () => {
    expect(['OND', 'ASC', 'MTC', 'TPR', 'PRAUT', 'SNOR', 'EQCUIS', 'ECLIN'].map(contractLotOfFamily)).toEqual(Array(8).fill('ELECTRICITE'));
    expect(['SANT', 'PMP', 'PAC', 'EXT', 'GEG', 'DSEF', 'SANTI5', 'COMP'].map(contractLotOfFamily)).toEqual(Array(8).fill('FLUIDE'));
    expect(['IFBT', 'EXI', 'PDI', 'INCONNU'].map(contractLotOfFamily)).toEqual(Array(4).fill('HORS_CONTRAT'));
    // LAV et FRD = famille Coswin EQCUIS (cuisine, couverte par le contrat)
    expect(['LAV', 'FRD', 'CUIS', 'TE', 'APLC', 'TRSF', 'C-ACC', 'BRAUT', 'ECLS'].map(contractLotOfFamily)).toEqual(Array(9).fill('ELECTRICITE'));
    expect(['RESAS', 'RESEP'].map(contractLotOfFamily)).toEqual(['FLUIDE', 'FLUIDE']);
    expect(CONTRACT_LOT_LABELS.HORS_CONTRAT).toMatch(/Hors contrat/);
  });
  it('sous-lots validés le 20/10/2026', () => {
    expect(subLotOfFamily('ASC')).toBe('Appareils élévateurs');
    expect(subLotOfFamily('TPR')).toBe('Appareils élévateurs');
    expect(subLotOfFamily('PRAUT')).toBe('Portes automatiques');
    expect(subLotOfFamily('GEG')).toBe('CVCD · Production thermique');
    expect(subLotOfFamily('SAI12')).toBe('Plomberie · Sanitaire');
    expect(subLotOfFamily('IFBT')).toBe('Hors contrat ou non classé');
  });
  it('détaille chaque sous-lot par famille (libellé Coswin, TD et TE fusionnés)', () => {
    const o = [ot('1', 'BAM-X-TD-01'), ot('2', 'BAM-X-TD-02'), ot('3', 'BAM-X-OND-01')];
    const r3 = computeLotRows(o, [], o, TODAY);
    const sl = r3.rows.find(x => x.lot === 'ELECTRICITE')!.subLots[0];
    expect(sl.families).toEqual([{ label: 'Tableau électrique', ot: 2 }, { label: 'Onduleur', ot: 1 }]);
  });
  it('sous-lots des familles Coswin validés le 21/10/2026', () => {
    for (const f of ['TE', 'APLC', 'TRSF']) expect(subLotOfFamily(f)).toBe('Tableaux, transformateurs, onduleurs et groupes électrogènes');
    for (const f of ['C-ACC', 'BRAUT']) expect(subLotOfFamily(f)).toBe('Portes automatiques');
    for (const f of ['CUIS', 'FRD', 'LAV']) expect(subLotOfFamily(f)).toBe('Cuisine');
    for (const f of ['RESAS', 'RESEP']) expect(subLotOfFamily(f)).toBe('Plomberie · Assainissement');
    expect(subLotOfFamily('COMP')).toBe('Plomberie · Air comprimé');
    expect(subLotOfFamily('CHDR')).toBe('CVCD · Production thermique');
  });
  it('lot d\'un OT par la famille de son équipement', () => {
    expect(contractLotOfWorkOrder(ot('1', 'BAM-KNT_AG-ASC-01'))).toBe('ELECTRICITE');
    expect(contractLotOfWorkOrder(ot('2', 'BAM-KNT_AG-SPT-12'))).toBe('FLUIDE');
    expect(contractLotOfWorkOrder(ot('3', ''))).toBe('HORS_CONTRAT');
  });
});

describe('lot d\'une DI (fonction Coswin)', () => {
  it('lit les 13 valeurs de fonction observées', () => {
    const elec = ['ELC_CFO', 'ELC-CFO', 'E-CFO-ECLN', 'E-CFO-APLC', 'E-CFO-ECUI', 'E-CFO-ECLX'];
    const fluide = ['FLD_PLB', 'FLD-PLB', 'F-PLB-SANT', 'FLD_CVCD', 'FLD-CVCD', 'F-CVCD-SPT'];
    elec.forEach(c => expect(contractLotOfFunction(c)).toBe('ELECTRICITE'));
    fluide.forEach(c => expect(contractLotOfFunction(c)).toBe('FLUIDE'));
    expect(contractLotOfFunction('IFBT')).toBe('HORS_CONTRAT');
    expect(contractLotOfFunction('BAT_GO')).toBe('HORS_CONTRAT');
    expect(contractLotOfFunction('PI-EXI')).toBe('HORS_CONTRAT');
    expect(contractLotOfFunction('PI-RIA')).toBe('FLUIDE');
    expect(contractLotOfFunction('  ')).toBeNull();
  });
  it('fonction d\'abord, équipement en repli, contradiction signalée sans déplacer la DI', () => {
    expect(contractLotOfRequest(di('a', { functionCode: 'FLD_CVCD' }))).toEqual({ lot: 'FLUIDE', source: 'function', conflict: false });
    expect(contractLotOfRequest(di('b', { equipmentCode: 'BAM-KNT_AG-SPT-01' }))).toEqual({ lot: 'FLUIDE', source: 'equipment', conflict: false });
    expect(contractLotOfRequest(di('c', { functionCode: 'ELC_CFO', plannedEquipmentCode: 'BAM-FEZ_AG-SPT-26' }))).toEqual({ lot: 'ELECTRICITE', source: 'function', conflict: true });
    expect(contractLotOfRequest(di('d', { functionCode: 'IFBT', equipmentCode: 'BAM-FEZ_AG-SPT-26' })).conflict).toBe(false);
    expect(contractLotOfRequest(di('e'))).toEqual({ lot: 'HORS_CONTRAT', source: 'none', conflict: false });
  });
});

describe('DI de fonction IFBT reclassées par description', () => {
  const r = (code: string, title: string) => di(code, { code, title, functionCode: 'IFBT', declaredAt: '2026-06-01' });
  const reqs = [r('X1', 'Fuite au niveau du chauffe-eau'), r('X2', 'Onduleur en panne'), r('X3', 'Serrure endommagée'), r('X4', 'Machine en arrêt'), r('X5', 'Préparation de la haute saison'), r('X6', 'Climatiseurs hors service et lampes grillées')];
  const res = computeLotRows([], reqs, [], TODAY);
  const by = Object.fromEntries(res.rows.map(x => [x.lot, x]));
  it('chaque DI IFBT va dans le lot de sa description', () => {
    expect(by.FLUIDE).toMatchObject({ di: 2, diReclassified: 2, diToCheck: 1 });
    expect(by.ELECTRICITE).toMatchObject({ di: 1, diReclassified: 1, diToCheck: 0 });
    expect(by.HORS_CONTRAT).toMatchObject({ di: 3, diToExamine: 1, diHorsSubs: { Serrurerie: 1, 'À examiner': 1, Divers: 1 } });
  });
  it('liste les DI à vérifier ou à examiner, sans les cacher', () => {
    expect(res.review.map(x => x.code).sort()).toEqual(['X4', 'X6']);
  });
  it('seule la fonction IFBT est relue : une DI ELC_CFO garde son lot', () => {
    expect(contractLotOfRequest(di('Y', { functionCode: 'ELC_CFO', title: 'Fuite au niveau du chauffe-eau' })).lot).toBe('ELECTRICITE');
  });
});

describe('computeLotRows', () => {
  const ots = [
    ot('1', 'BAM-X-ASC-01', { dueDate: '2026-06-01' }),                      // électricité, en retard
    ot('2', 'BAM-X-OND-01', { status: 'Terminé' }),                          // électricité, terminé
    ot('3', 'BAM-X-SPT-01', { dueDate: '2026-09-01' }),                      // fluide, en retard
    ot('4', 'BAM-X-SANT-01', { status: 'Annulé' }),                          // fluide, annulé : hors base
    ot('5', 'BAM-X-SANT-02'),                                                // fluide, non échu
    ot('6', 'BAM-X-ZZZ-01'),                                                 // famille inconnue
  ];
  const reqs = [
    di('d1', { functionCode: 'ELC_CFO', declaredAt: '2026-06-01' }),         // élec, > 90 j sans OT
    di('d2', { functionCode: 'FLD_PLB', declaredAt: '2026-10-15' }),         // fluide, récente
    di('d3', { functionCode: 'IFBT', declaredAt: '2026-01-01' }),            // hors contrat, > 90 j
    di('d4', { functionCode: 'ELC_CFO', plannedEquipmentCode: 'BAM-X-SPT-02', declaredAt: '2026-10-10' }), // contradiction
  ];
  const res = computeLotRows(ots, reqs, ots, TODAY);
  const by = Object.fromEntries(res.rows.map(r => [r.lot, r]));
  it('compte les OT par lot avec la base hors annulés', () => {
    expect(by.ELECTRICITE).toMatchObject({ ot: 2, otBase: 2, otOverdue: 1, otOverdueConfirmed: 0, otOverdueUnconfirmed: 1, otOverdueNotCreated: 0, otDone: 1, otOther: 0 });
    expect(by.FLUIDE).toMatchObject({ ot: 3, otBase: 2, otOverdue: 1, otOverdueConfirmed: 0, otOverdueUnconfirmed: 1, otOverdueNotCreated: 0, otDone: 0, otOther: 1 });
    expect(by.HORS_CONTRAT).toMatchObject({ ot: 1, otBase: 1 });
    expect(res.rows.reduce((n, r) => n + r.ot, 0)).toBe(ots.length);
  });
  it('compte les DI par lot, sans OT > 90 j et contradictions', () => {
    expect(by.ELECTRICITE).toMatchObject({ di: 2, diNoOtOver90: 1, diConflicts: 1 });
    expect(by.FLUIDE).toMatchObject({ di: 1, diNoOtOver90: 0 });
    expect(by.HORS_CONTRAT).toMatchObject({ di: 1, diNoOtOver90: 1 });
    expect(res.rows.reduce((n, r) => n + r.di, 0)).toBe(reqs.length);
  });
  it('détaille les sous-lots et liste les familles absentes du référentiel', () => {
    expect(by.ELECTRICITE.subLots.map(s => s.label).sort()).toEqual(['Appareils élévateurs', 'Tableaux, transformateurs, onduleurs et groupes électrogènes']);
    expect(by.ELECTRICITE.subLots.find(s => s.label === 'Appareils élévateurs')).toMatchObject({ ot: 1, overdue: 1, overdueConfirmed: 0, done: 0 });
    expect(res.unknownFamilies).toEqual([{ family: 'ZZZ', ot: 1 }]);
    expect(res.unclassifiedOt).toBe(1);
  });
  it('sépare les retards confirmés (état Coswin chargé), à confirmer et NC', () => {
    const L = 'SITE_A';
    const ots2 = [
      ot('a', 'BAM-X-ASC-01', { dueDate: '2026-06-10', location: L }),                                   // élec, retard, site|mois couvert → confirmé
      ot('b', 'BAM-X-OND-01', { dueDate: '2026-06-20', status: 'Terminé', closureSource: 'coswin', location: L } as never), // couvre SITE_A|2026-06
      ot('c', 'BAM-X-SPT-01', { dueDate: '2026-07-10', location: L }),                                   // fluide, retard, mois non couvert → à confirmer
      ot('d', 'BAM-X-SPT-02', { dueDate: '2026-06-05', location: L, code: 'NC-1' }),                     // fluide, retard, sans n° Coswin → NC
    ];
    const r2 = computeLotRows(ots2, [], ots2, TODAY);
    const b2 = Object.fromEntries(r2.rows.map(x => [x.lot, x]));
    expect(b2.ELECTRICITE).toMatchObject({ otOverdue: 1, otOverdueConfirmed: 1, otOverdueUnconfirmed: 0, otOverdueNotCreated: 0 });
    expect(b2.FLUIDE).toMatchObject({ otOverdue: 2, otOverdueConfirmed: 0, otOverdueUnconfirmed: 1, otOverdueNotCreated: 1 });
  });
  it('filtres par lot', () => {
    expect(filterWorkOrdersByLot(ots, 'FLUIDE').map(w => w.id)).toEqual(['3', '4', '5']);
    expect(filterWorkOrdersByLot(ots, '')).toHaveLength(6);
    expect(filterRequestsByLot(reqs, 'ELECTRICITE').map(r => r.id)).toEqual(['d1', 'd4']);
  });
});
