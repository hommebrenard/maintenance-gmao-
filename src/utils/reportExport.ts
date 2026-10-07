import type { WorkOrder } from '../types';
import { toDetailRow, formatDateFr } from './reportTable';

/** Libellés courts des lots pour l'export (les libellés d'écran sont plus longs). */
const LOT_EXPORT_LABEL: Record<string, string> = {
  ELEC: 'Électricité',
  FLUIDE: 'Fluides',
  CIRC: 'Circulation mécanique',
  DIVERS: 'Divers',
};

export const EXPORT_HEADERS = [
  'Code OT', 'N° OT Coswin', 'Site', 'Code équipement', 'Équipement', 'Famille', 'Lot', 'Fréquence',
  'Titre', 'Type', 'Statut', 'Priorité', 'Intervenant', "Code d'intervention", 'N° de plan',
  "Date d'échéance", 'Début (saisi)', 'Fin (saisie)', 'Date de clôture (système)',
];

/** "2026-06-29" → "29/06/2026" ; vide → "" (contrairement à formatDateFr qui renvoie "—"). */
const dateFr = (v?: string | null): string => (v ? formatDateFr(v) : '');

/** Horodatage ISO → "07/10/2026 08:41" (heure locale du navigateur) ; vide ou invalide → "". */
export function formatDateTimeFr(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** N° d'OT Coswin = vrai numéro (OT-…). Les codes NC-… (non communiqué) n'en ont pas : vide. */
export function coswinNumber(code?: string): string {
  return code && /^OT-/i.test(code) ? code : '';
}

export function toExportRow(wo: WorkOrder): string[] {
  const r = toDetailRow(wo);
  return [
    wo.code || '', coswinNumber(wo.code), wo.location || '', wo.equipmentCode || '', wo.equipmentName || '',
    r.family, LOT_EXPORT_LABEL[r.lot] ?? r.lot, r.freq,
    wo.title || '', wo.type || '', wo.status || '', wo.priority || '', r.responsible,
    wo.interventionCode || '', wo.planNumber || '',
    dateFr(wo.dueDate), dateFr(wo.startDate), dateFr(wo.endDate), formatDateTimeFr(wo.closedAt),
  ];
}

/** CSV séparateur « ; », BOM UTF-8 (ouverture directe dans Excel), guillemets doublés. */
export function buildCsv(rows: WorkOrder[]): string {
  const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
  const lines = [EXPORT_HEADERS, ...rows.map(toExportRow)].map(cols => cols.map(esc).join(';'));
  return '\uFEFF' + lines.join('\r\n');
}
