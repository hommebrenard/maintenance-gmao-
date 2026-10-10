import * as XLSX from 'xlsx';
import type { RequestFilters, RequestRowView } from './requestFilters';
import { typeLabel } from './requestFilters';

/** Date « murale » Coswin (offset +00:00, jamais convertie) ; heure locale pour les demandes de l'application.
 *  Format AAAA-MM-JJ HH:mm (triable dans Excel). */
export function formatRequestDate(iso: string | undefined, origin?: 'app' | 'coswin'): string {
  if (!iso) return '';
  if (origin === 'coswin') return iso.slice(0, 16).replace('T', ' ');
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('sv-SE').slice(0, 16);
}

/** Même date au format français JJ/MM/AAAA HH:mm (PDF, comme à l'écran). */
export function formatRequestDateFr(iso: string | undefined, origin?: 'app' | 'coswin'): string {
  const v = formatRequestDate(iso, origin);
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : v;
}

export const EXPORT_COLUMNS = [
  'N° DI', 'Déclarée le', 'État', 'Priorité', 'Type', 'Équipement', 'Site', 'Demandeur', 'Titre', 'Description',
  'N° OT', 'État OT', 'N° DAF', 'Superviseur', 'Fonction', 'Début prévu', 'Fin OT', 'Origine', 'État Coswin',
] as const;

/** Une ligne d'export par demande, dans l'ordre exact des lignes reçues (donc du tri affiché). */
export function buildExportRows(rows: RequestRowView[]): Record<string, string>[] {
  return rows.map(({ req, state, equipmentLabel, siteKey }) => ({
    'N° DI': req.code ?? '',
    'Déclarée le': formatRequestDate(req.createdAtIso, req.origin),
    'État': state,
    'Priorité': req.priority,
    'Type': typeLabel(req.interventionType),
    'Équipement': equipmentLabel ?? '',
    'Site': siteKey,
    'Demandeur': req.requestedBy ?? '',
    'Titre': req.title ?? '',
    'Description': req.description ?? '',
    'N° OT': req.otNumber ? `OT-${req.otNumber}` : '',
    'État OT': req.otStateLabel ?? req.otState ?? '',
    'N° DAF': req.dafNumber ?? '',
    'Superviseur': req.supervisorName ?? '',
    'Fonction': req.functionLabel ?? '',
    'Début prévu': req.plannedStart ?? '',
    'Fin OT': req.otEndDate ?? '',
    'Origine': req.origin === 'coswin' ? 'Coswin' : 'Application',
    'État Coswin': req.coswinState ?? '',
  }));
}

const frDay = (d: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d);

/** Période couverte par la sélection : bornes des filtres « Du / Au » si elles sont posées,
 *  sinon (ou pour la borne manquante) première et dernière date de déclaration des lignes. Vide s'il n'y a aucune date. */
export function periodLabel(rows: RequestRowView[], f: Pick<RequestFilters, 'from' | 'to'>): string {
  const days = rows.map(r => r.day).filter(Boolean).sort();
  const from = f.from || days[0] || '';
  const to = f.to || days[days.length - 1] || '';
  if (!from && !to) return '';
  if (from && to) return `du ${frDay(from)} au ${frDay(to)}`;
  return from ? `à partir du ${frDay(from)}` : `jusqu'au ${frDay(to)}`;
}

/** Résumé lisible des filtres actifs (feuille « Filtres » de l'export). */
export function describeFilters(f: RequestFilters, total: number, selected: number): string[][] {
  const out: string[][] = [['Export des demandes', new Date().toLocaleString('fr-FR')], ['Demandes exportées', `${selected} sur ${total}`]];
  const add = (label: string, v: string) => { if (v) out.push([label, v]); };
  add('Recherche', f.search.trim());
  add('État', f.state === 'all' ? '' : f.state);
  add('Priorité', f.priority === 'all' ? '' : f.priority);
  add('Type', f.type === 'all' ? '' : f.type);
  add('Site', f.site === 'all' ? '' : f.site);
  add('Origine', f.origin === 'all' ? '' : f.origin === 'coswin' ? 'Coswin' : 'Application');
  add('Du', f.from ? frDay(f.from) : ''); add('Au', f.to ? frDay(f.to) : '');
  add('Équipement non rapproché', f.unmatchedOnly ? 'oui' : '');
  return out;
}

export function exportRequestsToXlsx(rows: RequestRowView[], filters: RequestFilters, total: number): string {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(buildExportRows(rows), { header: [...EXPORT_COLUMNS] });
  ws['!cols'] = EXPORT_COLUMNS.map(c => ({ wch: c === 'Description' || c === 'Titre' ? 40 : c === 'Équipement' ? 30 : 16 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Demandes');
  const info = describeFilters(filters, total, rows.length);
  const period = periodLabel(rows, filters);
  if (period) info.splice(2, 0, ['Période', period]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), 'Filtres');
  const name = `demandes-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, name);
  return name;
}
