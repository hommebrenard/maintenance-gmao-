import { describe, it, expect } from 'vitest';
import { computePageBreaks, computePageSlices } from './pdfPagination';

describe('computePageBreaks', () => {
  it('une seule page quand tout tient', () => {
    expect(computePageBreaks(800, 1000, [200, 500])).toEqual([800]);
  });
  it('coupe au dernier bloc qui tient entièrement dans la page', () => {
    // page de 1000 : blocs finissant à 400, 900, 1200 → coupe à 900, pas à 1000
    expect(computePageBreaks(1500, 1000, [400, 900, 1200, 1500])).toEqual([900, 1500]);
  });
  it('ne coupe jamais à l\'intérieur d\'un bloc (aucune fin de page ne tombe entre deux bornes)', () => {
    const blocks = [100, 250, 480, 700, 980, 1250, 1600, 1900, 2300, 2600];
    const ends = computePageBreaks(2600, 1000, blocks);
    for (const e of ends) expect(blocks).toContain(e);
  });
  it('bloc plus haut qu\'une page : coupe à la hauteur maximale plutôt que de boucler', () => {
    const ends = computePageBreaks(3000, 1000, [3000]);
    expect(ends).toEqual([1000, 2000, 3000]);
  });
  it('évite une page presque vide : ignore une coupure sous le seuil de remplissage', () => {
    // seul point de coupure à 100 (10 % de page) → on préfère remplir la page
    expect(computePageBreaks(1500, 1000, [100, 1500])).toEqual([1000, 1500]);
  });
  it('les positions renvoyées sont strictement croissantes et finissent au total', () => {
    const ends = computePageBreaks(5000, 900, [300, 800, 1500, 2600, 3100, 4200, 5000]);
    expect(ends[ends.length - 1]).toBe(5000);
    for (let i = 1; i < ends.length; i++) expect(ends[i]).toBeGreaterThan(ends[i - 1]);
  });
});

describe('computePageSlices', () => {
  const rows = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  const header = { headTop: 40, headBottom: 60, bottom: 900 };
  it('page 1 sans en-tête répété, pages suivantes avec', () => {
    const sl = computePageSlices(900, 350, rows, [header]);
    expect(sl[0].header).toBeUndefined();
    expect(sl.slice(1).every(x => x.header?.top === 40)).toBe(true);
  });
  it("l'en-tête réduit la place utile des pages suivantes", () => {
    const sl = computePageSlices(900, 350, rows, [header]);
    sl.slice(1).forEach(x => expect(x.end - x.start + 20).toBeLessThanOrEqual(350));
  });
  it('couvre tout le document sans trou', () => {
    const sl = computePageSlices(900, 350, rows, [header]);
    expect(sl[0].start).toBe(0);
    expect(sl[sl.length - 1].end).toBe(900);
    sl.slice(1).forEach((x, i) => expect(x.start).toBe(sl[i].end));
  });
  it('sans tableau : identique à une découpe simple', () => {
    expect(computePageSlices(900, 350, rows).map(x => x.end)).toEqual([300, 600, 900]);
  });
});
