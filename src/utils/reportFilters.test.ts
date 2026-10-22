import { describe, it, expect } from 'vitest';
import type { WorkOrder } from '../types';
import { matchesClassFilters, classOptions, EMPTY_CLASS_FILTERS } from './reportFilters';

const wo = (equipmentCode: string, interventionCode: string): WorkOrder =>
  ({ id: equipmentCode + interventionCode, code: 'OT-1', title: 'T', equipmentCode, interventionCode, status: 'Ouvert', dueDate: '2026-06-01' } as WorkOrder);

const td = wo('BAM-FEZ_AG-TD-16', 'PS-TD-1M-01');   // Électricité, mensuelle
const asc = wo('BAM-FEZ_AG-ASC-02', 'PS-ASC-1H-01'); // Électricité (sous-lot Appareils élévateurs), hebdomadaire
const pmp = wo('BAM-KNT_AG-PMP-03', 'PS-PMP-1T-01'); // Fluide, trimestrielle

describe('reportFilters', () => {
  it('sans filtre, tout passe', () => {
    expect([td, asc, pmp].every(w => matchesClassFilters(w, EMPTY_CLASS_FILTERS))).toBe(true);
  });
  it('filtre par lot', () => {
    expect(matchesClassFilters(td, { lot: 'ELECTRICITE', subLot: '', family: '', freq: '' })).toBe(true);
    expect(matchesClassFilters(asc, { lot: 'ELECTRICITE', subLot: '', family: '', freq: '' })).toBe(true); // ASC rejoint l'Électricité (lots du contrat)
    expect(matchesClassFilters(asc, { lot: 'FLUIDE', subLot: '', family: '', freq: '' })).toBe(false);
    expect(matchesClassFilters(pmp, { lot: 'FLUIDE', subLot: '', family: '', freq: '' })).toBe(true);
  });
  it('filtre par famille et par fréquence', () => {
    expect(matchesClassFilters(asc, { lot: '', subLot: '', family: 'ASC', freq: '' })).toBe(true);
    expect(matchesClassFilters(td, { lot: '', subLot: '', family: 'ASC', freq: '' })).toBe(false);
    expect(matchesClassFilters(asc, { lot: '', subLot: '', family: '', freq: 'H' })).toBe(true);
    expect(matchesClassFilters(td, { lot: '', subLot: '', family: '', freq: 'H' })).toBe(false);
  });
  it('filtres combinés (ET)', () => {
    expect(matchesClassFilters(td, { lot: 'ELECTRICITE', subLot: '', family: 'TE', freq: 'M' })).toBe(true);
    expect(matchesClassFilters(td, { lot: 'ELECTRICITE', subLot: '', family: 'TE', freq: 'T' })).toBe(false);
  });
  it('options : familles restreintes au lot, fréquences dans l\'ordre H→A', () => {
    const all = classOptions([td, asc, pmp], '');
    expect(all.families.map(f => f.key)).toEqual(['ASC', 'PMP', 'TE']);
    expect(all.freqs.map(f => f.key)).toEqual(['H', 'M', 'T']);
    expect(classOptions([td, asc, pmp], 'ELECTRICITE').families.map(f => f.key)).toEqual(['ASC', 'TE']);
  });
  it('options : inclut les familles d\'équipements sans OT', () => {
    const o = classOptions([td], '', ['BAM-FEZ_AG-EXT-01', 'bizarre']);
    expect(o.families.map(f => f.key)).toEqual(['AUTRES', 'EXT', 'TE']);
    expect(classOptions([td], 'FLUIDE', ['BAM-FEZ_AG-EXT-01']).families.map(f => f.key)).toEqual(['EXT']);
  });
  it('filtre par sous-lot (Appareils élévateurs = ancienne « circulation mécanique »)', () => {
    expect(matchesClassFilters(asc, { lot: '', subLot: 'Appareils élévateurs', family: '', freq: '' })).toBe(true);
    expect(matchesClassFilters(td, { lot: '', subLot: 'Appareils élévateurs', family: '', freq: '' })).toBe(false);
    expect(matchesClassFilters(asc, { lot: 'FLUIDE', subLot: 'Appareils élévateurs', family: '', freq: '' })).toBe(false);
  });
});
