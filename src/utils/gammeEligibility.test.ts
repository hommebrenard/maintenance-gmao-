import { describe, it, expect } from 'vitest';
import { skipsAutoGamme, gammesForWorkOrder } from './gammeEligibility';

const G = [{ planCode: 'PS-TD-1T-01' }] as any[];

describe('gammeEligibility', () => {
  it('correctif sans code d\'intervention → pas de gamme auto', () => {
    expect(skipsAutoGamme({ type: 'Corrective' })).toBe(true);
    expect(skipsAutoGamme({ type: 'Corrective', interventionCode: '  ' })).toBe(true);
    expect(gammesForWorkOrder({ type: 'Corrective' }, G)).toEqual([]);
  });
  it('correctif avec code d\'intervention → gammes conservées', () => {
    expect(gammesForWorkOrder({ type: 'Corrective', interventionCode: 'PS-ASC-1H-01' }, G)).toBe(G);
  });
  it('préventif → gammes conservées', () => {
    expect(skipsAutoGamme({ type: 'Préventive' as any })).toBe(false);
    expect(gammesForWorkOrder({ type: 'Préventive' as any }, G)).toBe(G);
  });
});
