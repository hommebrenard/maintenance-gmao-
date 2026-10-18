import { describe, it, expect } from 'vitest';
import { analyzeClosureRows, normalizeOtCode, toIsoDate } from './coswinClosure';

const row = (o: Record<string, unknown>) => ({ "N° d'OT": 85830, 'État OT': 'T', 'Date de début': new Date(2026, 1, 9, 9), 'Date de fin': new Date(2026, 1, 9, 14), ...o });

describe('normalizeOtCode', () => {
  it('accepte numéro, texte et préfixe OT-', () => {
    expect(normalizeOtCode(85830)).toBe('OT-85830');
    expect(normalizeOtCode('85830')).toBe('OT-85830');
    expect(normalizeOtCode(' ot-85830 ')).toBe('OT-85830');
  });
  it('refuse le vide et les codes non numériques', () => {
    expect(normalizeOtCode('')).toBeNull();
    expect(normalizeOtCode('NC-AG KENITRA-FEV2026-001')).toBeNull();
  });
});

describe('toIsoDate', () => {
  it('lit Date, série Excel, jj/mm/aaaa et ISO', () => {
    expect(toIsoDate(new Date(2026, 1, 9, 14))).toBe('2026-02-09');
    expect(toIsoDate(new Date(2026, 1, 9, 0, 0, 0))).toBe('2026-02-09');
    expect(toIsoDate(46062)).toBe('2026-02-09');
    expect(toIsoDate('09/02/2026 14:00')).toBe('2026-02-09');
    expect(toIsoDate('2026-02-09')).toBe('2026-02-09');
  });
  it('refuse une date impossible ou vide', () => {
    expect(toIsoDate('31/02/2026')).toBeNull();
    expect(toIsoDate('')).toBeNull();
  });
});

describe('analyzeClosureRows', () => {
  it('retient les OT « T » avec leur date de fin', () => {
    const r = analyzeClosureRows([row({}), row({ "N° d'OT": 85829 })]);
    expect(r.items).toEqual([
      { code: 'OT-85830', closed_on: '2026-02-09', start_on: '2026-02-09' },
      { code: 'OT-85829', closed_on: '2026-02-09', start_on: '2026-02-09' },
    ]);
  });
  it('laisse ouverts les autres états (ex. A) et les liste', () => {
    const r = analyzeClosureRows([row({}), row({ "N° d'OT": 85881, 'État OT': 'A', 'Date de fin': '' })]);
    expect(r.items).toHaveLength(1);
    expect(r.otherStates).toEqual([{ state: 'A', count: 1, codes: ['OT-85881'] }]);
  });
  it('écarte un « T » sans date de fin lisible', () => {
    const r = analyzeClosureRows([row({ 'Date de fin': '' })]);
    expect(r.items).toHaveLength(0);
    expect(r.withoutEndDate).toEqual(['OT-85830']);
  });
  it('écarte une fin avant le début ou dans le futur', () => {
    const today = new Date(2026, 9, 18);
    const r = analyzeClosureRows([
      row({ 'Date de fin': new Date(2026, 1, 8, 14) }),
      row({ "N° d'OT": 85829, 'Date de fin': new Date(2027, 0, 5, 14) }),
      row({ "N° d'OT": 85828 }),
    ], today);
    expect(r.suspectDates).toEqual(['OT-85830', 'OT-85829']);
    expect(r.items.map(i => i.code)).toEqual(['OT-85828']);
  });
  it('compte les lignes sans N° valide et les doublons', () => {
    const r = analyzeClosureRows([row({ "N° d'OT": '' }), row({}), row({})]);
    expect(r.invalid).toBe(1);
    expect(r.duplicates).toBe(1);
    expect(r.items).toHaveLength(1);
  });
  it('signale les en-têtes manquants (apostrophe typographique tolérée)', () => {
    expect(analyzeClosureRows([{ Code: 1 }]).missingHeaders).toEqual(["N° d'OT", 'État OT', 'Date de fin']);
    const ok = analyzeClosureRows([{ 'N° d’OT': 85830, 'Etat OT': 't', 'Date de fin': '09/02/2026' }]);
    expect(ok.missingHeaders).toEqual([]);
    expect(ok.items[0].code).toBe('OT-85830');
  });
});
