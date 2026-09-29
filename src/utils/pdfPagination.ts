/**
 * Calcule où couper un long document sur plusieurs pages, sans jamais couper
 * un bloc en deux (ligne de tableau, entrée de carnet, cartouche de visas...).
 *
 * @param totalPx     hauteur totale du document
 * @param pagePx      hauteur utile d'une page (même unité)
 * @param candidates  positions (bas des blocs insécables) où une coupure est permise
 * @param minFill     part minimale d'une page à remplir avant d'accepter une coupure
 *                    (évite une page presque vide si un gros bloc suit)
 * @returns positions de fin de chaque page ; la dernière vaut toujours totalPx.
 *          Si aucun point de coupure acceptable n'existe (bloc plus haut qu'une
 *          page), la page est coupée à sa hauteur maximale.
 */
export function computePageBreaks(
  totalPx: number,
  pagePx: number,
  candidates: number[],
  minFill = 0.3
): number[] {
  const sorted = [...candidates].sort((a, b) => a - b);
  const ends: number[] = [];
  let start = 0;
  while (start < totalPx - 0.5) {
    const limit = start + pagePx;
    if (limit >= totalPx) {
      ends.push(totalPx);
      break;
    }
    let cut = limit;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const c = sorted[i];
      if (c <= limit && c > start + pagePx * minFill) {
        cut = c;
        break;
      }
    }
    ends.push(cut);
    start = cut;
  }
  return ends;
}
