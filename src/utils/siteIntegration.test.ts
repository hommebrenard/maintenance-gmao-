import { describe, it, expect } from 'vitest';
import type { LocationItem } from '../types';
import {
  normalizeIntegrationStatus,
  isSiteOperational,
  filterBySiteIntegration,
  countNonOperational,
} from './siteIntegration';

const loc = (id: string, name: string, s?: LocationItem['integrationStatus']): LocationItem => ({
  id, name, type: 'Site', equipmentCount: 0, integrationStatus: s,
});
const sites = [loc('1', 'Safi', 'operationnel'), loc('2', 'Nador', 'a_preparer'), loc('3', 'Fès')];

describe('siteIntegration', () => {
  it('valeur inconnue ou absente = opérationnel', () => {
    expect(normalizeIntegrationStatus(undefined)).toBe('operationnel');
    expect(normalizeIntegrationStatus('xx')).toBe('operationnel');
    expect(normalizeIntegrationStatus('en_integration')).toBe('en_integration');
  });
  it('isSiteOperational', () => {
    expect(isSiteOperational(sites[0])).toBe(true);
    expect(isSiteOperational(sites[1])).toBe(false);
    expect(isSiteOperational(sites[2])).toBe(true);
  });
  it('compte les sites non opérationnels', () => {
    expect(countNonOperational(sites)).toBe(1);
  });
  it('masque les éléments des sites non opérationnels (par id puis par nom)', () => {
    const items = [
      { id: 'a', locationId: '1' }, { id: 'b', locationId: '2' },
      { id: 'c', location: 'Nador' }, { id: 'd', location: 'Safi' }, { id: 'e' },
    ];
    expect(filterBySiteIntegration(items, sites, false).map(i => i.id)).toEqual(['a', 'd', 'e']);
  });
  it('includeAll garde tout', () => {
    const items = [{ id: 'b', locationId: '2' }];
    expect(filterBySiteIntegration(items, sites, true)).toHaveLength(1);
  });
});
