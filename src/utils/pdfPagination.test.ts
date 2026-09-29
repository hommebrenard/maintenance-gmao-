import { describe, it, expect } from 'vitest';
import { computePageBreaks } from './pdfPagination';

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
