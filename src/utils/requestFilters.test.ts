import { describe, it, expect } from 'vitest';
import type { MaintenanceRequest } from '../types';
import { EMPTY_FILTERS, applyFilters, countByState, hasActiveFilters, paginate, sortRows, typeLabel, type RequestRowView } from './requestFilters';

type Opts = Omit<Partial<RequestRowView>, 'req'> & { req?: Partial<MaintenanceRequest> };

const row = (code: string, o: Opts = {}): RequestRowView => ({
  req: { id: code, code, title: 't', priority: 'Moyenne', origin: 'coswin', interventionType: 'CO', ...o.req } as MaintenanceRequest,
  state: o.state ?? 'En attente', siteKey: o.siteKey ?? 'S1', matched: o.matched ?? true,
  day: o.day ?? '2026-01-05', ts: o.ts ?? Date.parse(o.day ?? '2026-01-05'), hay: o.hay ?? code.toLowerCase(),
});

const rows = [
  row('DI1', { state: 'Clôturée', day: '2026-01-03', req: { priority: 'Urgente', interventionType: 'CSP' } }),
  row('DI2', { state: 'En attente', day: '2026-01-05', siteKey: 'S2', matched: false, hay: 'di2 thermostat' }),
  row('DI3', { state: 'En attente', day: '2026-02-01', req: { priority: 'Faible', origin: 'app', interventionType: undefined } }),
];

describe('requestFilters', () => {
  it('sans filtre : tout passe ; hasActiveFilters', () => {
    expect(applyFilters(rows, EMPTY_FILTERS)).toHaveLength(3);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, site: 'S1' })).toBe(true);
  });
  it('filtres combinés', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, state: 'En attente' }).map(r => r.req.code)).toEqual(['DI2', 'DI3']);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, priority: 'Urgente' }).map(r => r.req.code)).toEqual(['DI1']);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, type: 'CSP' }).map(r => r.req.code)).toEqual(['DI1']);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, site: 'S2' }).map(r => r.req.code)).toEqual(['DI2']);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, origin: 'app' }).map(r => r.req.code)).toEqual(['DI3']);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, unmatchedOnly: true }).map(r => r.req.code)).toEqual(['DI2']);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, search: 'THERMO' }).map(r => r.req.code)).toEqual(['DI2']);
  });
  it('période : bornes incluses', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, from: '2026-01-05', to: '2026-01-31' }).map(r => r.req.code)).toEqual(['DI2']);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, from: '2026-01-03', to: '2026-01-05' })).toHaveLength(2);
  });
  it('tri : date, priorité, état, code numérique', () => {
    expect(sortRows(rows, { key: 'date', dir: 'desc' }).map(r => r.req.code)).toEqual(['DI3', 'DI2', 'DI1']);
    expect(sortRows(rows, { key: 'priority', dir: 'desc' }).map(r => r.req.code)[0]).toBe('DI1');
    expect(sortRows(rows, { key: 'state', dir: 'asc' }).map(r => r.state)).toEqual(['En attente', 'En attente', 'Clôturée']);
    expect(sortRows([row('DI10'), row('DI9')], { key: 'code', dir: 'asc' }).map(r => r.req.code)).toEqual(['DI9', 'DI10']);
  });
  it('pagination : bornes et page hors limites', () => {
    const many = Array.from({ length: 120 }, (_, i) => i);
    expect(paginate(many, 1, 50)).toMatchObject({ page: 1, pages: 3 });
    expect(paginate(many, 3, 50).items).toHaveLength(20);
    expect(paginate(many, 99, 50).page).toBe(3);
    expect(paginate([], 1, 50)).toMatchObject({ page: 1, pages: 1, items: [] });
  });
  it('compteurs par état et libellés de type', () => {
    expect(countByState(rows)).toMatchObject({ 'En attente': 2, 'Clôturée': 1, 'Rejetée': 0 });
    expect(typeLabel('CSR')).toBe('CSR — Correctif - Suite ronde');
    expect(typeLabel('XYZ')).toBe('XYZ');
    expect(typeLabel(undefined)).toBe('');
  });
});
