import { describe, it, expect } from 'vitest';
import { computeIntervals, summarizeMonth, cosPhi, cosPhiStatus, daysBetween, weekdaysInMonth, type EnergyReading } from './energyCalc';

const base: EnergyReading = {
  id: '', locationId: 'L', date: '', elecHc: null, elecHp: null, elecPeak: null, reactive: null,
  water: null, irrigation: null, fuelPct: null, tempC: null, humidityPct: null, source: 'import', status: 'a_valider',
};
const r = (date: string, p: Partial<EnergyReading>): EnergyReading => ({ ...base, id: date, date, ...p });

// Relevés réels d'août 2026 (S30 à S33), plus le relevé de fin juillet pour l'eau (52 854).
const august: EnergyReading[] = [
  r('2026-07-26', { water: 52854 }),
  r('2026-08-02', { elecHc: 6545026, elecHp: 2314473, elecPeak: 1551514, reactive: 4441784, water: 52857 }),
  r('2026-08-09', { elecHc: 6554673, elecHp: 2318203, elecPeak: 1553732, reactive: 4448040, water: 52873 }),
  r('2026-08-16', { elecHc: 6562077, elecHp: 2320970, elecPeak: 1555517, reactive: 4451991, water: 52886 }),
  r('2026-08-23', { elecHc: 6570095, elecHp: 2324288, elecPeak: 1557617, reactive: 4459622, water: 52896 }),
];

describe('energyCalc', () => {
  it('calcule les consommations d\u2019août depuis S30 (25 069 + 9 815 + 6 103 = 40 987 kWh)', () => {
    const s = summarizeMonth(computeIntervals(august), '2026-08');
    expect(s.totals.elecHc).toBe(25069);
    expect(s.totals.elecHp).toBe(9815);
    expect(s.totals.elecPeak).toBe(6103);
    expect(s.actifKwh).toBe(40987);
    expect(s.totals.reactive).toBe(17838);
    expect(s.totals.water).toBe(42); // 3 + 16 + 13 + 10, avec le relevé de fin juillet
    expect(s.anomalyCount).toBe(0);
    expect(s.daysCovered).toBe(28);
  });

  it('cos φ d\u2019août = 0,917 (marge faible entre 0,90 et 0,93)', () => {
    const s = summarizeMonth(computeIntervals(august), '2026-08');
    expect(s.cosPhi).toBeCloseTo(0.917, 3);
    expect(cosPhiStatus(s.cosPhi)).toBe('marge_faible');
  });

  it('statuts du cos φ', () => {
    expect(cosPhiStatus(0.95)).toBe('conforme');
    expect(cosPhiStatus(0.93)).toBe('conforme');
    expect(cosPhiStatus(0.9)).toBe('marge_faible');
    expect(cosPhiStatus(0.89)).toBe('non_conforme');
    expect(cosPhiStatus(null)).toBe('inconnu');
    expect(cosPhi(0, 10)).toBeNull();
  });

  it('une baisse d\u2019index est signalée et non calculée (jamais masquée en 0)', () => {
    const list = [r('2026-08-02', { water: 52896 }), r('2026-08-03', { water: 52890 }), r('2026-08-04', { water: 52900 })];
    const iv = computeIntervals(list);
    expect(iv[0].deltas.water).toBeNull();
    expect(iv[0].anomalies).toEqual([{ counter: 'water', kind: 'baisse' }]);
    expect(iv[1].deltas.water).toBe(10);
    expect(summarizeMonth(iv, '2026-08').anomalyCount).toBe(1);
  });

  it('un relevé couvrant plusieurs jours garde sa durée (lundi = 3 jours)', () => {
    const iv = computeIntervals([r('2026-10-23', { water: 100 }), r('2026-10-26', { water: 130 })]);
    expect(iv[0].days).toBe(3);
    expect(iv[0].deltas.water).toBe(30);
  });

  it('la consommation à cheval sur deux mois est rattachée au mois du relevé de fin', () => {
    const iv = computeIntervals([r('2026-07-31', { water: 100 }), r('2026-08-03', { water: 112 })]);
    expect(summarizeMonth(iv, '2026-08').totals.water).toBe(12);
    expect(summarizeMonth(iv, '2026-07').totals.water).toBeNull();
  });

  it('valeur manquante après une valeur connue = anomalie ; compteur jamais mesuré = pas d\u2019anomalie', () => {
    const iv = computeIntervals([r('2026-08-02', { water: 10, irrigation: null }), r('2026-08-03', { water: null, irrigation: null })]);
    expect(iv[0].anomalies).toEqual([{ counter: 'water', kind: 'manquant' }]);
  });

  it('le coefficient multiplicateur ne s\u2019applique qu\u2019à l\u2019électricité', () => {
    const iv = computeIntervals([r('2026-08-02', { elecHc: 100, water: 10 }), r('2026-08-03', { elecHc: 110, water: 15 })], 40);
    expect(iv[0].deltas.elecHc).toBe(400);
    expect(iv[0].deltas.water).toBe(5);
  });

  it('dates et jours ouvrés indépendants du fuseau', () => {
    expect(daysBetween('2026-08-02', '2026-08-23')).toBe(21);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(weekdaysInMonth('2026-10')).toBe(22);
    expect(weekdaysInMonth('2026-10', '2026-10-28')).toBe(20);
  });
});
