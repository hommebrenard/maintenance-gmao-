import { jsPDF } from 'jspdf';
import type { RequestFilters, RequestRowView } from './requestFilters';
import { describeFilters, formatRequestDate } from './requestExport';

const W = 297, H = 210, M = 10, CW = W - 2 * M, BOTTOM = H - 14, FS = 7.5, LH = 3.3;
const COLS: { label: string; w: number; get: (r: RequestRowView) => string; lines: number }[] = [
  { label: 'N° DI', w: 23, lines: 1, get: r => r.req.code ?? '' },
  { label: 'Déclarée le', w: 27, lines: 1, get: r => formatRequestDate(r.req.createdAtIso, r.req.origin) },
  { label: 'État', w: 22, lines: 1, get: r => r.state },
  { label: 'Priorité', w: 15, lines: 1, get: r => r.req.priority },
  { label: 'Type', w: 12, lines: 1, get: r => r.req.interventionType ?? '' },
  { label: 'Équipement', w: 50, lines: 2, get: r => r.equipmentLabel ?? '' },
  { label: 'Site', w: 26, lines: 2, get: r => r.siteKey },
  { label: 'Demandeur', w: 22, lines: 2, get: r => r.req.requestedBy ?? '' },
  { label: 'N° OT', w: 20, lines: 1, get: r => (r.req.otNumber ? `OT-${r.req.otNumber}` : '') },
  { label: 'Titre', w: 60, lines: 2, get: r => r.req.title ?? '' },
];
export const LIST_VISAS = ['Établi par', 'Visa du responsable'];
const VISA_H = 22;

/** Texte tenant sur au plus `max` lignes (la fin est remplacée par « … »). */
function fit(doc: jsPDF, text: string, w: number, max: number): string[] {
  const lines: string[] = doc.splitTextToSize(text || '', w - 2);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept[max - 1] = kept[max - 1].replace(/.{0,2}$/, '') + '…';
  return kept;
}

/** Liste filtrée en PDF A4 paysage : en-tête avec les filtres, tableau (en-tête répété à chaque page,
 *  une ligne n'est jamais coupée), puis cadres de visas toujours entiers. */
export function renderRequestListPdf(rows: RequestRowView[], filters: RequestFilters, total: number, printedAt = new Date()): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  let y = M;

  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(20);
  doc.text("Liste des demandes d'intervention", M, y + 5);
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(110);
  doc.text(`Imprimée le ${printedAt.toLocaleString('fr-FR')}`, W - M, y + 5, { align: 'right' });
  y += 9;
  const active = describeFilters(filters, total, rows.length).slice(2).map(([k, v]) => `${k} : ${v}`);
  doc.setTextColor(40).setFontSize(9);
  const summary = `${rows.length} demande(s) sur ${total}` + (active.length ? `   —   Filtres : ${active.join(' ; ')}` : '   —   Aucun filtre');
  const sumLines: string[] = doc.splitTextToSize(summary, CW);
  doc.text(sumLines, M, y + 3);
  y += sumLines.length * 4 + 3;

  const drawHead = () => {
    doc.setFillColor(235, 235, 235).rect(M, y, CW, 6, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(FS).setTextColor(50);
    let x = M;
    for (const c of COLS) { doc.text(c.label.toUpperCase(), x + 1, y + 4); x += c.w; }
    y += 6;
  };
  const newPage = () => { doc.addPage(); y = M; drawHead(); };
  drawHead();

  doc.setFont('helvetica', 'normal').setFontSize(FS);
  for (const r of rows) {
    doc.setFont('helvetica', 'normal').setFontSize(FS);
    const cells = COLS.map(c => fit(doc, c.get(r), c.w, c.lines));
    const h = Math.max(...cells.map(l => l.length)) * LH + 2;
    if (y + h > BOTTOM) newPage();
    doc.setTextColor(20);
    let x = M;
    COLS.forEach((c, i) => { doc.text(cells[i], x + 1, y + 3.3); x += c.w; });
    y += h;
    doc.setDrawColor(215).line(M, y, W - M, y);
  }
  if (rows.length === 0) { doc.setTextColor(120).text('Aucune demande ne correspond aux filtres.', M + 1, y + 5); y += 8; }

  // Visas : bloc entier, jamais séparé de son titre.
  if (y + 6 + VISA_H > BOTTOM) newPage();
  y += 5;
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(40).text('VISAS', M, y + 3);
  y += 5;
  const bw = (CW - 4) / 2;
  LIST_VISAS.forEach((label, i) => {
    const x = M + i * (bw + 4);
    doc.setDrawColor(150).rect(x, y, bw, VISA_H);
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(70).text(label.toUpperCase(), x + 2, y + 4);
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(130).text('Nom, date et signature', x + 2, y + VISA_H - 2);
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p).setFont('helvetica', 'normal').setFontSize(8).setTextColor(130);
    doc.text(`Liste des demandes — page ${p}/${pages}`, W / 2, H - 6, { align: 'center' });
  }
  return doc;
}

export function exportRequestListToPdf(rows: RequestRowView[], filters: RequestFilters, total: number): string {
  const name = `demandes-${new Date().toISOString().slice(0, 10)}.pdf`;
  renderRequestListPdf(rows, filters, total).save(name);
  return name;
}

export function printRequestList(rows: RequestRowView[], filters: RequestFilters, total: number): void {
  const url = String(renderRequestListPdf(rows, filters, total).output('bloburl'));
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  frame.src = url;
  frame.onload = () => {
    try { frame.contentWindow?.focus(); frame.contentWindow?.print(); }
    catch { window.open(url, '_blank'); }
  };
  document.body.appendChild(frame);
  setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 120000);
}
