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

/** Tableau dont l'en-tête (thead) doit être répété en haut de chaque page où il continue. Positions en px du document. */
export interface RepeatHeader { headTop: number; headBottom: number; bottom: number }
export interface PageSlice { start: number; end: number; header?: { top: number; bottom: number } }

/**
 * Comme computePageBreaks, mais retourne aussi, pour chaque page qui démarre au milieu d'un
 * tableau, l'en-tête à redessiner en haut de page (sa hauteur est retirée de la place utile).
 */
export function computePageSlices(
  totalPx: number,
  pagePx: number,
  candidates: number[],
  headers: RepeatHeader[] = [],
  minFill = 0.3
): PageSlice[] {
  const sorted = [...candidates].sort((a, b) => a - b);
  const slices: PageSlice[] = [];
  let start = 0;
  while (start < totalPx - 0.5) {
    const h = headers.find(x => x.headBottom <= start + 0.5 && start < x.bottom - 0.5);
    const headH = h ? h.headBottom - h.headTop : 0;
    const avail = Math.max(pagePx * minFill, pagePx - headH);
    const header = h ? { top: h.headTop, bottom: h.headBottom } : undefined;
    const limit = start + avail;
    if (limit >= totalPx) {
      slices.push({ start, end: totalPx, header });
      break;
    }
    let cut = limit;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const c = sorted[i];
      if (c <= limit && c > start + avail * minFill) {
        cut = c;
        break;
      }
    }
    slices.push({ start, end: cut, header });
    start = cut;
  }
  return slices;
}
