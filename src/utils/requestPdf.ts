import { jsPDF } from 'jspdf';
import type { MaintenanceRequest, Equipment, WorkOrder } from '../types';
import { displayState } from './requestDisplay';
import { responsibleOf } from './workOrderResponsible';
import { formatDateFr } from './reportTable';
import { formatDateTimeFr } from './reportExport';
import { typeLabel } from './requestFilters';

export interface PdfSection { title: string; fields: { label: string; value: string; wide?: boolean }[] }

export interface RequestPdfInput {
  request: MaintenanceRequest;
  equipment?: Equipment;
  locationName?: string;
  workOrder?: WorkOrder;
}

const dash = (v?: string | null): string => (v && String(v).trim() ? String(v).trim() : '—');

/** Contenu de la fiche, identique à celui de l'écran (mêmes champs, mêmes règles). */
export function buildRequestSections({ request: r, equipment, locationName, workOrder }: RequestPdfInput): PdfSection[] {
  const coswin = r.origin === 'coswin';
  const sections: PdfSection[] = [];
  sections.push({ title: 'Demande', fields: [
    { label: 'N° de DI', value: dash(r.code) },
    { label: 'Demandeur', value: dash(r.requestedBy) },
    { label: 'Priorité demandée', value: dash(r.priority) },
    { label: "Description de l'incident", value: [r.title, r.description].filter(Boolean).join('\n') || '—', wide: true },
    { label: 'Équipement source', wide: true, value: equipment ? `${equipment.code} — ${equipment.name}` : dash(r.equipmentName ?? (r.equipmentCode ? `${r.equipmentCode} (non rattaché à un équipement de l'application)` : '')) },
    { label: 'Site', value: dash(equipment?.location || locationName || r.location || (r.siteCode ? `${r.siteCode} (hors application)` : '')) },
    { label: 'Date de déclaration', value: dash(r.declaredAt ? formatDateTimeFr(r.declaredAt, coswin) : r.createdAt) },
    { label: 'Date de fin prévue', value: dash(r.dueDate ? formatDateFr(r.dueDate) : '') },
    { label: 'Date de décision', value: dash(formatDateTimeFr(r.decidedAt)) },
  ] });

  if (workOrder) {
    sections.push({ title: 'Informations OT', fields: [
      { label: "N° d'OT", value: dash(workOrder.code) },
      { label: 'État OT', value: dash(workOrder.status) },
      { label: 'Intervenant', value: dash(responsibleOf(workOrder)) },
      { label: 'Échéance', value: dash(workOrder.dueDate ? formatDateFr(workOrder.dueDate) : '') },
      { label: 'Date de clôture (système)', value: dash(formatDateTimeFr(workOrder.closedAt)) },
    ] });
  } else if (r.otNumber) {
    sections.push({ title: 'Informations OT (Coswin)', fields: [
      { label: "N° d'OT (Coswin)", value: `OT-${r.otNumber}` },
      { label: 'État OT', value: dash(r.otStateLabel ?? r.otState) },
      { label: 'Début prévu', value: dash(r.plannedStart ? formatDateFr(r.plannedStart) : '') },
      { label: 'Date de fin', value: dash(r.otEndDate ? formatDateFr(r.otEndDate) : '') },
    ] });
  } else {
    sections.push({ title: 'Informations OT', fields: [{ wide: true, label: 'OT', value:
      r.status === 'En attente' ? "Aucun OT : la demande n'est pas encore décidée." :
      r.status === 'Rejetée' ? 'Aucun OT : la demande a été rejetée.' : 'OT introuvable dans la période chargée.' }] });
  }

  if (coswin) {
    sections.push({ title: 'Données Coswin (import)', fields: [
      { label: 'État Coswin', value: dash(r.coswinState) },
      { label: "Type d'intervention", value: dash(typeLabel(r.interventionType)) },
      { label: 'N° DAF', value: dash(r.dafNumber) },
      { label: 'QSE - type', value: dash(r.qseType) },
      { label: 'Priorité Coswin', value: dash(r.priorityCode) },
      { label: 'Fonction', value: dash([r.functionLabel, r.functionCode].filter(Boolean).join(' / ')) },
      { label: 'Superviseur', value: dash(r.supervisorName) },
      { label: 'Centre de charges', value: dash(r.costCenter) },
      { label: "N° d'intervention", value: dash(r.interventionCode) },
      { label: 'Date de création Coswin', value: dash(formatDateTimeFr(r.coswinCreatedAt, true)) },
      { label: 'Visa', value: dash(r.visa) },
    ] });
  }
  return sections;
}

const M = 15, W = 210, H = 297, CW = W - 2 * M, GAP = 4, BOTTOM = H - 15;
const LINE = 4.4;
const ROWGAP = 1.5;

interface Cell { f: PdfSection['fields'][number]; x: number; w: number; lines: string[]; h: number }
interface Row { cells: Cell[]; h: number }

/** Mise en rangées d'une section (mesurée avant dessin, pour ne jamais la couper en deux). */
function layoutSection(doc: jsPDF, s: PdfSection): { rows: Row[]; height: number } {
  const colW = (CW - 2 * GAP) / 3;
  const rows: Row[] = [];
  let cur: Row = { cells: [], h: 0 };
  const flush = () => { if (cur.cells.length) rows.push(cur); cur = { cells: [], h: 0 }; };
  doc.setFont('helvetica', 'normal').setFontSize(10);
  for (const f of s.fields) {
    const w = f.wide ? CW : colW;
    const lines: string[] = doc.splitTextToSize(f.value, w - 4);
    const h = 9 + lines.length * LINE;
    if (f.wide) flush();
    else if (cur.cells.length === 3) flush();
    cur.cells.push({ f, x: f.wide ? M : M + cur.cells.length * (colW + GAP), w, lines, h });
    cur.h = Math.max(cur.h, h);
    if (f.wide) flush();
  }
  flush();
  return { rows, height: 6 + rows.reduce((a, r) => a + r.h + ROWGAP, 0) + 2 };
}

const VISA_BOX_H = 24;
export const VISAS = ['Visa du demandeur', 'Décision et visa du responsable'];
const VISA_BLOCK_H = 6 + 5 + VISA_BOX_H + 2;

/** Dessine la fiche (A4 portrait, sobre, sans logo) et renvoie le document.
 *  Règle d'impression : une section ou le bloc de visas n'est jamais coupé entre deux pages ;
 *  s'il ne tient pas dans la place restante, il passe en entier à la page suivante. */
export function renderRequestPdf(input: RequestPdfInput, printedAt = new Date()): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const state = displayState(input.request, input.workOrder);
  let y = M;

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(20);
  doc.text("Demande d'intervention", M, y + 5);
  doc.setFontSize(11).text(`${input.request.code ?? ''}  —  ${state}`, W - M, y + 5, { align: 'right' });
  y += 9;
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(110);
  doc.text(`Imprimée le ${printedAt.toLocaleString('fr-FR')}`, M, y + 2);
  y += 5;
  doc.setDrawColor(150).line(M, y, W - M, y);
  y += 5;

  const ensure = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); y = M; } };

  for (const s of buildRequestSections(input)) {
    const { rows, height } = layoutSection(doc, s);
    if (height <= BOTTOM - M) ensure(height); // la section tient sur une page : on la garde entière
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(40);
    ensure(14);
    doc.text(s.title.toUpperCase(), M, y + 3);
    y += 5;
    for (const r of rows) {
      ensure(r.h + ROWGAP); // (section plus haute qu'une page : on coupe entre deux rangées seulement)
      for (const c of r.cells) {
        doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(110);
        doc.text(c.f.label.toUpperCase(), c.x, y + 3);
        doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(20);
        doc.setDrawColor(200).rect(c.x, y + 4.5, c.w, 2 + c.lines.length * LINE + 1);
        doc.text(c.lines, c.x + 2, y + 9.2);
      }
      y += r.h + ROWGAP;
    }
    y += 2;
  }

  // Bloc de visas : toujours entier, jamais séparé de son titre.
  ensure(VISA_BLOCK_H);
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(40);
  doc.text('VISAS', M, y + 3);
  y += 6;
  const bw = (CW - GAP) / 2;
  VISAS.forEach((label, i) => {
    const x = M + i * (bw + GAP);
    doc.setDrawColor(150).rect(x, y, bw, VISA_BOX_H);
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(70);
    doc.text(label.toUpperCase(), x + 2, y + 4);
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(130);
    doc.text('Nom, date et signature', x + 2, y + VISA_BOX_H - 2);
  });
  y += VISA_BOX_H + 2;

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p).setFont('helvetica', 'normal').setFontSize(8).setTextColor(130);
    doc.text(`${input.request.code ?? ''} — page ${p}/${pages}`, W / 2, H - 8, { align: 'center' });
  }
  return doc;
}

const fileName = (r: MaintenanceRequest) => `${(r.code ?? 'demande').replace(/[^\w.-]+/g, '_')}.pdf`;

/** Téléchargement du PDF. */
export function exportRequestToPdf(input: RequestPdfInput): string {
  const name = fileName(input.request);
  renderRequestPdf(input).save(name);
  return name;
}

/** Impression : le même PDF est chargé dans un cadre invisible puis envoyé à l'imprimante ;
 *  si le navigateur refuse, il s'ouvre dans un onglet (d'où on peut imprimer). */
export function printRequestPdf(input: RequestPdfInput): void {
  const url = String(renderRequestPdf(input).output('bloburl'));
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
