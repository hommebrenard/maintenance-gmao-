import { describe, it, expect } from 'vitest';
import { parseWoDateTime, lastActivityTime, sortByRecentActivity } from './reportDates';

describe('reportDates', () => {
  it('lit le format fr-FR avec ou sans virgule, et l\'ISO', () => {
    expect(parseWoDateTime('05/10/2026 10:12:20')?.getTime()).toBe(new Date(2026, 9, 5, 10, 12, 20).getTime());
    expect(parseWoDateTime('05/10/2026, 10:12')?.getTime()).toBe(new Date(2026, 9, 5, 10, 12, 0).getTime());
    expect(parseWoDateTime('2026-10-05T08:00:00Z')?.toISOString()).toBe('2026-10-05T08:00:00.000Z');
  });
  it('texte illisible ou vide → null', () => {
    expect(parseWoDateTime('')).toBeNull();
    expect(parseWoDateTime(undefined)).toBeNull();
    expect(parseWoDateTime('n/a')).toBeNull();
  });
  it('trie par vraie date : le 05/10 passe avant le 30/09 (le tri texte se trompait)', () => {
    const a = { id: 'a', updatedAt: '30/09/2026 09:00:00' };
    const b = { id: 'b', updatedAt: '05/10/2026 08:00:00' };
    expect(sortByRecentActivity([a, b]).map(o => o.id)).toEqual(['b', 'a']);
  });
  it('mélange fr-FR et ISO trié correctement ; sans date à la fin ; repli sur la création', () => {
    const fr: { id: string; updatedAt?: string; createdAt?: string } = { id: 'fr', updatedAt: '04/10/2026 10:00:00' };
    const iso: { id: string; updatedAt?: string; createdAt?: string } = { id: 'iso', updatedAt: '2026-10-05T07:00:00Z' };
    const none: { id: string; updatedAt?: string; createdAt?: string } = { id: 'none' };
    const onlyCreated: { id: string; updatedAt?: string; createdAt?: string } = { id: 'created', createdAt: '03/10/2026 10:00:00' };
    expect(sortByRecentActivity([none, fr, onlyCreated, iso]).map(o => o.id)).toEqual(['iso', 'fr', 'created', 'none']);
    expect(lastActivityTime(none)).toBe(0);
  });
});
