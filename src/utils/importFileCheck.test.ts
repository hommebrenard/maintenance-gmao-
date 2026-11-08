import { describe, it, expect } from 'vitest';
import { checkImportFiles, findUnknownZones } from './importFileCheck';

const locations = [
  { name: 'CV MDIQ', code: 'BAM_MDQ_CV' },
  { name: 'CV MARINA', code: 'BAM-MRN_CV' },
  { name: 'Musée FES', code: 'BAM_FEZ_MU' },
];

describe('checkImportFiles', () => {
  it('ne signale rien quand le nom du fichier correspond au site des lignes', () => {
    const r = checkImportFiles([{ fileName: 'pmp cv mdiq juin 2026.xlsx', entities: ['BAM_MDQ_CV', 'BAM_MDQ_CV'], hasNcRows: true }], locations);
    expect(r).toEqual([]);
  });

  it('signale un fichier nommé MDIQ dont les lignes sont de Marina', () => {
    const r = checkImportFiles([{ fileName: 'pmp cv mdiq juin 2026.xlsx', entities: ['BAM-MRN_CV'], hasNcRows: true }], locations);
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('site_mismatch');
    expect(r[0].message).toContain('CV MARINA');
  });

  it('tolère tiret / tiret bas dans le code Zone', () => {
    const r = checkImportFiles([{ fileName: 'pmp cv marina juin 2026.xlsx', entities: ['BAM_MRN_CV'], hasNcRows: false }], locations);
    expect(r).toEqual([]);
  });

  it('signale un nom sans espaces seulement si le fichier contient des OT NC', () => {
    const avecNc = checkImportFiles([{ fileName: 'cv_mdiq_juin_2026.xlsx', entities: ['BAM_MDQ_CV'], hasNcRows: true }], locations);
    const sansNc = checkImportFiles([{ fileName: 'cv_mdiq_juin_2026.xlsx', entities: ['BAM_MDQ_CV'], hasNcRows: false }], locations);
    expect(avecNc.map(i => i.kind)).toEqual(['name_not_standard']);
    expect(avecNc[0].blocking).toBe(true);
    expect(avecNc[0].message).toContain('Rien n\'est chargé');
    expect(sansNc).toEqual([]);
  });

  it('bloque une zone qui ne correspond à aucun emplacement, avec le nombre de lignes (cas Taza du 05/11/2026)', () => {
    const r = checkImportFiles([{ fileName: 'pmp cv mdiq juin 2026.xlsx', entities: ['BAM', 'BAM', 'BAM_MDQ_CV'], hasNcRows: false }], locations);
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('zone_unknown');
    expect(r[0].blocking).toBe(true);
    expect(r[0].message).toContain('« BAM » (2 lignes)');
    expect(r[0].message).not.toContain('MDQ_CV');
  });

  it('bloque aussi quand le nom du fichier ne suit pas le modèle', () => {
    const r = checkImportFiles([{ fileName: 'export.xlsx', entities: ['BAM'], hasNcRows: false }], locations);
    expect(r.map(i => i.kind)).toEqual(['zone_unknown']);
  });

  it('ne bloque pas quand la liste des emplacements est vide (pas encore chargée)', () => {
    expect(checkImportFiles([{ fileName: 'pmp cv mdiq juin 2026.xlsx', entities: ['BAM'], hasNcRows: false }], [])).toEqual([]);
  });

  it('l\'alerte de site incohérent reste non bloquante', () => {
    const r = checkImportFiles([{ fileName: 'pmp cv mdiq juin 2026.xlsx', entities: ['BAM-MRN_CV'], hasNcRows: true }], locations);
    expect(r.map(i => i.kind)).toEqual(['site_mismatch']);
    expect(r.every(i => !i.blocking)).toBe(true);
  });

  it('ignore les accents : « MUSEE FES » dans le nom = « Musée FES » (cas réel du 24/10/2026)', () => {
    const r = checkImportFiles([{ fileName: 'PMP MUSEE FES  Avril  2026.xlsx', entities: ['BAM_FEZ_MU'], hasNcRows: true }], locations);
    expect(r).toEqual([]);
  });
});

describe('findUnknownZones', () => {
  it('ignore les zones vides et tolère tiret / tiret bas / casse', () => {
    expect(findUnknownZones(['', '  ', 'bam-mrn_cv', 'BAM_MDQ_CV'], locations)).toEqual([]);
  });
  it('compte les lignes par zone inconnue', () => {
    expect(findUnknownZones(['BAM', 'XYZ', 'BAM', 'BAM_MDQ_CV'], locations)).toEqual([{ entity: 'BAM', count: 2 }, { entity: 'XYZ', count: 1 }]);
  });
});
