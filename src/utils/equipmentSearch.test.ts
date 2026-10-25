import { describe, it, expect } from 'vitest';
import type { Equipment } from '../types';
import { normSearch, searchEquipment } from './equipmentSearch';

const mk = (id: string, code: string, name: string, locationId: string): Equipment => ({ id, code, name, locationId } as Equipment);
const LIST = [
  mk('1', 'BAM-FEZ_AG-TD-16', 'AR 1', 'fes'),
  mk('2', 'BAM-FEZ_AG-TD-17', 'AR 2', 'fes'),
  mk('3', 'BAM-STT_AG-ARCM-01', 'ARMOIRE DE CLIMATISATION N1', 'settat'),
  mk('4', 'BAM-STT_AG-ARCM-02', 'Armoire climatisation N2', 'settat'),
  mk('5', 'BAM-RAK_AG-SPT-80', 'ANNULÉ', 'rabat'),
];

describe('equipmentSearch', () => {
  it('normalisation : accents, casse, « - » et « _ » confondus', () => {
    expect(normSearch('  BAM_FEZ-AG  Éléc ')).toBe('bam fez ag elec');
  });
  it('sans site ni saisie : aucun résultat', () => {
    expect(searchEquipment(LIST, {})).toEqual([]);
  });
  it('un site seul : tous ses équipements, triés par code', () => {
    expect(searchEquipment(LIST, { siteId: 'fes' }).map(e => e.id)).toEqual(['1', '2']);
  });
  it('recherche dans tous les sites par code ou nom, sans accent', () => {
    expect(searchEquipment(LIST, { query: 'climatisation' }).map(e => e.id)).toEqual(['3', '4']);
    expect(searchEquipment(LIST, { query: 'annule' }).map(e => e.id)).toEqual(['5']);
    expect(searchEquipment(LIST, { query: 'bam_stt arcm 02' }).map(e => e.id)).toEqual(['4']);
  });
  it('site + saisie : seulement ce site', () => {
    expect(searchEquipment(LIST, { siteId: 'fes', query: 'ar' }).map(e => e.id)).toEqual(['1', '2']);
    expect(searchEquipment(LIST, { siteId: 'settat', query: 'td' })).toEqual([]);
  });
  it('limite', () => {
    expect(searchEquipment(LIST, { query: 'bam', limit: 2 })).toHaveLength(2);
  });
});
