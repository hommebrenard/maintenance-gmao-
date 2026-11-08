import { describe, it, expect } from 'vitest';
import { normalizeZoneCode, makeOrderLocationResolver, resolveOrderLocationId } from './orderLocation';

// Jeu fictif : aucune donnée réelle.
const CODES = new Map<string, string>([
  ['TEST_SITE_A', 'id-a'],
  ['TEST_SITE_B', 'id-b'],
  ['TEST_SITE_C', 'id-c'],
]);

describe('normalizeZoneCode', () => {
  it('tiret = tiret bas, casse et espaces ignorés', () => {
    expect(normalizeZoneCode(' test-site_a ')).toBe('TEST_SITE_A');
    expect(normalizeZoneCode('TEST  SITE_A')).toBe('TEST SITE_A');
  });
  it('accents et espaces insécables ignorés', () => {
    expect(normalizeZoneCode('Tést\u00a0Site')).toBe('TEST SITE');
  });
  it('vide ou absent', () => {
    expect(normalizeZoneCode(undefined)).toBe('');
    expect(normalizeZoneCode(null)).toBe('');
    expect(normalizeZoneCode('   ')).toBe('');
  });
});

describe('resolveOrderLocationId', () => {
  it('code identique', () => {
    expect(resolveOrderLocationId('TEST_SITE_A', CODES)).toBe('id-a');
  });
  it('code Coswin avec tiret, emplacement avec tiret bas', () => {
    expect(resolveOrderLocationId('TEST-SITE_B', CODES)).toBe('id-b');
  });
  it('code de l\'emplacement avec tiret, Zone avec tiret bas', () => {
    const m = new Map([['TEST-SITE_D', 'id-d']]);
    expect(resolveOrderLocationId('TEST_SITE_D', m)).toBe('id-d');
  });
  it('code inconnu, vide ou absent : undefined', () => {
    expect(resolveOrderLocationId('TEST_SITE_Z', CODES)).toBeUndefined();
    expect(resolveOrderLocationId('BAM', CODES)).toBeUndefined();
    expect(resolveOrderLocationId('', CODES)).toBeUndefined();
    expect(resolveOrderLocationId(undefined, CODES)).toBeUndefined();
  });
  it('code ambigu (deux emplacements après normalisation) : jamais deviné', () => {
    const m = new Map([['TEST-X', 'id-1'], ['TEST_X', 'id-2']]);
    expect(resolveOrderLocationId('TEST_X', m)).toBeUndefined();
  });
  it('deux écritures du même emplacement (même id) : pas ambigu', () => {
    const m = new Map([['TEST-X', 'id-1'], ['TEST_X', 'id-1']]);
    expect(resolveOrderLocationId('TEST-X', m)).toBe('id-1');
  });
  it('le résolveur se réutilise sur plusieurs lignes', () => {
    const r = makeOrderLocationResolver(CODES);
    expect(['TEST-SITE_A', 'TEST_SITE_C', 'inconnu'].map(r)).toEqual(['id-a', 'id-c', undefined]);
  });
});
