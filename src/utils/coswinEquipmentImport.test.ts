import { describe, it, expect } from 'vitest';
import type { LocationItem } from '../types';
import { analyzeEquipmentRows, equipmentCompareKey, selectRowsToCreate } from './coswinEquipmentImport';

const loc = (id: string, name: string, code: string): LocationItem => ({ id, name, code, type: 'Site', equipmentCount: 0 });
const locations = [loc('L1', 'AG Type B SAFI', 'BAM_SAF_AG'), loc('L2', 'CV MARINA', 'BAM-MRN_CV')];
const row = (code: string, zone: string, name = 'X') => ({
  'Code équipement': code, "Description de l'équipement": name, Zone: zone, 'Description de la zone': 'z', 'Famille ': 'TE',
});

describe('lignes géographiques ignorées', () => {
  const base = { "Description de l'équipement": 'SAFI AGENCE', Zone: 'BAM_SAF_AG', 'Description de la zone': 'z' };
  it('ignore le type « 1. Géographique »', () => {
    const r = analyzeEquipmentRows([{ ...base, "Type d'équipement": '1. Géographique', 'Code équipement': 'BAM_SAF_AG' }, row('BAM-SAF_AG-TD-09', 'BAM_SAF_AG')], [], locations);
    expect(r.geographicRowsIgnored).toBe(1);
    expect(r.toCreate.map(n => n.code)).toEqual(['BAM-SAF_AG-TD-09']);
    expect(r.sites[0].fileCount).toBe(1);
  });
  it('ignore aussi une ligne dont le code est celui de la zone (sans colonne Type)', () => {
    const r = analyzeEquipmentRows([{ ...base, 'Code équipement': 'BAM-SAF_AG' }], [], locations);
    expect(r.geographicRowsIgnored).toBe(1);
    expect(r.toCreate).toHaveLength(0);
  });
});

describe('equipmentCompareKey', () => {
  it('confond - et _ et ignore la casse', () => {
    expect(equipmentCompareKey('bam-saf_ag-td-01')).toBe(equipmentCompareKey('BAM_SAF_AG_TD_01'));
  });
});

describe('analyzeEquipmentRows (aperçu, sans écriture)', () => {
  const existing = [
    { code: 'BAM-SAF_AG-TD-01', locationId: 'L1' },
    { code: 'BAM-SAF_AG-TD-02', locationId: 'L1' },
    { code: 'BAM-SAF_AG-OLD-09', locationId: 'L1' },
  ];
  const rows = [
    row('BAM-SAF_AG-TD-01', 'BAM_SAF_AG'),
    row('BAM-SAF_AG-TD-02', 'BAM_SAF_AG'),
    row('BAM-SAF_AG-APLC-01', 'BAM_SAF_AG', 'APPAREILLAGE'),
    row('BAM-SAF_AG-APLC-01', 'BAM_SAF_AG'),
    row('', 'BAM_SAF_AG'),
    row('BAM-XXX_AG-TD-01', 'BAM_XXX_AG'),
    row('BAM-MRN_CV-ECLIN-01', 'BAM-MRN_CV'),
  ];
  const r = analyzeEquipmentRows(rows, existing, locations);

  it('compte présents, nouveaux, doublons, lignes vides, site inconnu', () => {
    expect(r.totalRows).toBe(7);
    expect(r.alreadyInApp).toBe(2);
    expect(r.toCreate.map(n => n.code)).toEqual(['BAM-SAF_AG-APLC-01', 'BAM-MRN_CV-ECLIN-01']);
    expect(r.duplicateCodesInFile).toEqual(['BAM-SAF_AG-APLC-01']);
    expect(r.emptyCodeRows).toBe(1);
    expect(r.unknownSiteRows).toBe(1);
  });
  it('garde le code tel quel et rattache au bon site', () => {
    expect(r.toCreate[0]).toMatchObject({ code: 'BAM-SAF_AG-APLC-01', locationId: 'L1', name: 'APPAREILLAGE' });
    expect(r.toCreate[1].locationId).toBe('L2');
  });
  it('signale les codes de l\'app absents de l\'export, sans rien supprimer', () => {
    const safi = r.sites.find(s => s.siteKey === 'BAM_SAF_AG')!;
    expect(safi.absentFromFile).toEqual(['BAM-SAF_AG-OLD-09']);
    expect(safi).toMatchObject({ fileCount: 3, alreadyInApp: 2, toCreate: 1, known: true });
  });
  it('reconnaît un code existant écrit avec _ au lieu de -', () => {
    const r2 = analyzeEquipmentRows([row('BAM_SAF_AG_TD_01', 'BAM_SAF_AG')], existing, locations);
    expect(r2.alreadyInApp).toBe(1);
    expect(r2.toCreate).toHaveLength(0);
  });
  it('bloque si les colonnes obligatoires manquent', () => {
    const r3 = analyzeEquipmentRows([{ Foo: 1 }], existing, locations);
    expect(r3.missingHeaders).toEqual(['Code équipement', 'Zone']);
  });
});

describe('selectRowsToCreate (garde-fou avant écriture)', () => {
  const mk = (code: string) => ({ code, name: code, siteKey: 'BAM_SAF_AG', locationId: 'L1' });
  it('ignore les codes déjà présents (même écrits différemment) et les doublons', () => {
    const { toCreate, skipped } = selectRowsToCreate(
      [mk('BAM-SAF_AG-APLC-01'), mk('BAM_SAF_AG_TD_01'), mk('BAM-SAF_AG-APLC-01'), mk('BAM-SAF_AG-APLC-02')],
      [{ code: 'BAM-SAF_AG-TD-01' }]
    );
    expect(toCreate.map(r => r.code)).toEqual(['BAM-SAF_AG-APLC-01', 'BAM-SAF_AG-APLC-02']);
    expect(skipped).toBe(2);
  });
  it('liste vide = rien à créer', () => {
    expect(selectRowsToCreate([], []).toCreate).toEqual([]);
  });
});
