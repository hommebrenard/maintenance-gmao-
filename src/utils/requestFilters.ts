import type { MaintenanceRequest, WorkOrder, WorkOrderPriority } from '../types';
import type { RequestDisplayState } from './requestDisplay';

/** Types d'intervention Coswin (code → libellé). */
export const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  CAT: 'Correctif - Assistance technique', CCR: 'Correctif - Contrôle réglementaire', CDC: 'Correctif - Demande du client',
  CO: 'Correctif', CSP: 'Correctif - Suite au préventif', CSR: 'Correctif - Suite ronde', DAF: 'Correctif - DAF',
  PS: 'Préventif systématique', QSE: 'Qualité Sécurité Environnement', RD: 'Ronde', TEB: 'Travaux entretien bâtiment', TN: 'Travaux neuf',
};
export const typeLabel = (code?: string): string => (!code ? '' : INTERVENTION_TYPE_LABELS[code] ? `${code} — ${INTERVENTION_TYPE_LABELS[code]}` : code);

export const STATE_ORDER: RequestDisplayState[] = ['En attente', 'Prise en charge', 'En cours', 'Clôturée', 'Rejetée', 'OT annulé'];
const PRIORITY_RANK: Record<WorkOrderPriority, number> = { Faible: 0, Moyenne: 1, Élevée: 2, Urgente: 3 };

/** Une ligne prête à filtrer/trier/afficher (calculée une fois par changement de données). */
export interface RequestRowView {
  req: MaintenanceRequest;
  wo?: WorkOrder;
  state: RequestDisplayState;
  equipmentLabel?: string;
  siteKey: string;      // code de site (Coswin) ou nom du site de l'équipement ; '' si inconnu
  matched: boolean;     // équipement retrouvé dans l'application
  day: string;          // AAAA-MM-JJ de la date affichée « Déclarée le »
  ts: number;
  hay: string;          // texte de recherche en minuscules
}

export interface RequestFilters {
  search: string;
  state: RequestDisplayState | 'all';
  priority: WorkOrderPriority | 'all';
  type: string;          // code ou 'all'
  site: string;          // siteKey ou 'all'
  origin: 'app' | 'coswin' | 'all';
  from: string;          // AAAA-MM-JJ ou ''
  to: string;
  unmatchedOnly: boolean;
}
/** Texte de recherche d'une demande : on y met aussi « OT-<n°> » tel qu'affiché (la base stocke le n° sans préfixe). */
export function buildSearchText(req: MaintenanceRequest, equipmentLabel?: string, woCode?: string): string {
  return [req.title, req.requestedBy, equipmentLabel, req.code, req.dafNumber, req.otNumber, req.otNumber ? `OT-${req.otNumber}` : '',
    req.equipmentCode, req.interventionType, req.siteCode, woCode].filter(Boolean).join(' ').toLowerCase();
}

/** Compteurs par état : suivent tous les filtres actifs SAUF le filtre d'état lui-même. */
export function stateCountsFor(rows: RequestRowView[], f: RequestFilters): Record<RequestDisplayState, number> {
  return countByState(applyFilters(rows, { ...f, state: 'all' }));
}

export const EMPTY_FILTERS: RequestFilters = {
  search: '', state: 'all', priority: 'all', type: 'all', site: 'all', origin: 'all', from: '', to: '', unmatchedOnly: false,
};
export const hasActiveFilters = (f: RequestFilters): boolean => JSON.stringify(f) !== JSON.stringify(EMPTY_FILTERS);

export function applyFilters(rows: RequestRowView[], f: RequestFilters): RequestRowView[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter(r =>
    (!q || r.hay.includes(q)) &&
    (f.state === 'all' || r.state === f.state) &&
    (f.priority === 'all' || r.req.priority === f.priority) &&
    (f.type === 'all' || (r.req.interventionType ?? '') === f.type) &&
    (f.site === 'all' || r.siteKey === f.site) &&
    (f.origin === 'all' || (r.req.origin ?? 'app') === f.origin) &&
    (!f.from || r.day >= f.from) &&
    (!f.to || r.day <= f.to) &&
    (!f.unmatchedOnly || !r.matched));
}

export type SortKey = 'code' | 'date' | 'priority' | 'state';
export interface SortSpec { key: SortKey; dir: 'asc' | 'desc' }

export function sortRows(rows: RequestRowView[], s: SortSpec): RequestRowView[] {
  const m = s.dir === 'asc' ? 1 : -1;
  const cmp = (a: RequestRowView, b: RequestRowView): number => {
    switch (s.key) {
      case 'code': return a.req.code.localeCompare(b.req.code, 'fr', { numeric: true });
      case 'priority': return PRIORITY_RANK[a.req.priority] - PRIORITY_RANK[b.req.priority];
      case 'state': return STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state);
      default: return a.ts - b.ts;
    }
  };
  return [...rows].sort((a, b) => m * cmp(a, b) || b.ts - a.ts);
}

export function paginate<T>(rows: T[], page: number, size: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { items: rows.slice((p - 1) * size, p * size), page: p, pages };
}

export function countByState(rows: RequestRowView[]): Record<RequestDisplayState, number> {
  const c = Object.fromEntries(STATE_ORDER.map(s => [s, 0])) as Record<RequestDisplayState, number>;
  for (const r of rows) c[r.state] += 1;
  return c;
}
