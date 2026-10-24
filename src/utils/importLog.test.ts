import { describe, it, expect } from 'vitest';
import { importMismatch, recentAdditions } from './importLog';

const now = new Date('2026-10-24T12:00:00Z');
const iso = (d: string) => `${d}T08:00:00Z`;

describe('recentAdditions', () => {
  const wos = [
    { createdAtIso: iso('2026-10-24') },
    { createdAtIso: iso('2026-10-24') },
    { createdAtIso: iso('2026-10-20') },
    { createdAtIso: iso('2026-10-10') },
    { createdAtIso: iso('2026-09-01') },
    {},
    { createdAtIso: 'pas une date' },
  ];
  it('compte le total, les 7 derniers jours et les 30 derniers jours', () => {
    const r = recentAdditions(wos, now);
    expect(r.total).toBe(7);
    expect(r.last7).toBe(3);   // 24/10 ×2 et 20/10
    expect(r.last30).toBe(4);  // + 10/10 ; le 01/09 est hors fenêtre
  });
  it('compte à part les OT sans date de création lisible', () => {
    expect(recentAdditions(wos, now).withoutDate).toBe(2);
  });
  it('liste vide : tout à zéro', () => {
    expect(recentAdditions([], now)).toEqual({ total: 0, last7: 0, last30: 0, withoutDate: 0 });
  });
});

describe('importMismatch', () => {
  it('0 quand le nombre créé égale le nombre nouveau', () => {
    expect(importMismatch({ rows_new: 2426, rows_created: 2426 })).toBe(0);
  });
  it('négatif quand des OT annoncés n\'ont pas été créés', () => {
    expect(importMismatch({ rows_new: 100, rows_created: 90 })).toBe(-10);
  });
});
