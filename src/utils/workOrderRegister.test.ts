import { describe, it, expect } from 'vitest';
import { DEFAULT_REGISTER_FILTERS, filterRegister, isDefaultFilters, periodLabel, registerYears } from './workOrderRegister';

const wo = (code: string, dueDate: string, status: string, type = 'Préventive', title = 'PREVENTIF HEBDO') =>
  ({ id: code, code, dueDate, status, type, title }) as never;
const now = new Date('2026-10-01');
const list = [
  wo('OT-1', '2026-06-01', 'Ouvert'),
  wo('OT-2', '2026-05-01', 'Terminé'),
  wo('OT-3', '2025-03-01', 'Ouvert'),
  wo('OT-4', '2025-02-01', 'Terminé', 'Corrective', 'FUITE HUILE'),
  wo('OT-5', '', 'Ouvert'),
];

describe('registre OT : filtres', () => {
  it('liste les années, la plus récente d\'abord', () => {
    expect(registerYears(list)).toEqual(['2026', '2025']);
  });
  it('par défaut : année en cours + OT non clos', () => {
    expect(filterRegister(list, DEFAULT_REGISTER_FILTERS, now).map(w => w.code)).toEqual(['OT-1', 'OT-2', 'OT-3', 'OT-5']);
  });
  it('toutes les années', () => {
    expect(filterRegister(list, { ...DEFAULT_REGISTER_FILTERS, period: 'all' }, now)).toHaveLength(5);
  });
  it('une année précise', () => {
    expect(filterRegister(list, { ...DEFAULT_REGISTER_FILTERS, period: '2025' }, now).map(w => w.code)).toEqual(['OT-3', 'OT-4']);
  });
  it('statut, type et recherche se combinent', () => {
    const f = { ...DEFAULT_REGISTER_FILTERS, period: 'all', status: 'Terminé' as const, type: 'Corrective' as const, query: 'huile' };
    expect(filterRegister(list, f, now).map(w => w.code)).toEqual(['OT-4']);
    expect(filterRegister(list, { ...DEFAULT_REGISTER_FILTERS, period: 'all', query: 'ot-2' }, now).map(w => w.code)).toEqual(['OT-2']);
  });
  it('détecte les filtres par défaut et libelle la période', () => {
    expect(isDefaultFilters(DEFAULT_REGISTER_FILTERS)).toBe(true);
    expect(isDefaultFilters({ ...DEFAULT_REGISTER_FILTERS, query: 'x' })).toBe(false);
    expect(periodLabel('recent', now)).toBe('Année 2026 + OT non clos');
    expect(periodLabel('all')).toBe('Toutes les années');
    expect(periodLabel('2025')).toBe('Année 2025');
  });
});
