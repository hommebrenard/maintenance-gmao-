import { describe, it, expect } from 'vitest';
import { parseCount, parsePrice, sortParts } from './equipmentParts';
import type { EquipmentPart } from '../types';

describe('parseCount', () => {
  it('accepte les entiers positifs ou nuls', () => {
    expect(parseCount('0')).toBe(0);
    expect(parseCount(' 12 ')).toBe(12);
  });
  it('refuse décimaux, négatifs, texte, vide', () => {
    for (const t of ['1.5', '1,5', '-3', 'abc', '', '1234567890']) expect(parseCount(t)).toBeUndefined();
  });
});

describe('parsePrice', () => {
  it('accepte virgule ou point, 2 décimales max', () => {
    expect(parsePrice('12,50')).toBe(12.5);
    expect(parsePrice('12.5')).toBe(12.5);
    expect(parsePrice('0')).toBe(0);
    expect(parsePrice('100')).toBe(100);
  });
  it('refuse négatif, 3 décimales, texte, vide', () => {
    for (const t of ['-1', '1,234', 'dix', '', '1,2,3']) expect(parsePrice(t)).toBeUndefined();
  });
});

describe('sortParts', () => {
  it('trie par désignation en ignorant casse et accents', () => {
    const p = (name: string) => ({ name }) as EquipmentPart;
    expect(sortParts([p('Roulement'), p('courroie'), p('Écrou'), p('Bague')]).map(x => x.name)).toEqual(['Bague', 'courroie', 'Écrou', 'Roulement']);
  });
});
