import { describe, it, expect } from 'vitest';
import { checkImportFiles } from './importFileCheck';

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
    expect(sansNc).toEqual([]);
  });

  it('ignore une zone inconnue de la liste des emplacements (pas de fausse alerte)', () => {
    const r = checkImportFiles([{ fileName: 'pmp cv mdiq juin 2026.xlsx', entities: ['BAM_XXX_CV'], hasNcRows: true }], locations);
    expect(r).toEqual([]);
  });

  it('ignore les accents : « MUSEE FES » dans le nom = « Musée FES » (cas réel du 24/10/2026)', () => {
    const r = checkImportFiles([{ fileName: 'PMP MUSEE FES  Avril  2026.xlsx', entities: ['BAM_FEZ_MU'], hasNcRows: true }], locations);
    expect(r).toEqual([]);
  });
});
