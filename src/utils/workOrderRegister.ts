import type { WorkOrder, WorkOrderStatus, WorkOrderType } from '../types';

/** Filtres du registre d'entretien & dépannages d'un équipement. */
export interface RegisterFilters {
  /** 'recent' = année en cours (tous statuts) + OT non clos des années précédentes ; 'all' = tout ; sinon une année (« 2025 »). */
  period: string;
  status: 'all' | WorkOrderStatus;
  type: 'all' | WorkOrderType;
  query: string;
}

export const DEFAULT_REGISTER_FILTERS: RegisterFilters = { period: 'recent', status: 'all', type: 'all', query: '' };

export const REGISTER_STATUSES: WorkOrderStatus[] = ['Ouvert', 'En cours', 'En attente', 'Terminé', 'Annulé'];
export const REGISTER_TYPES: WorkOrderType[] = ['Préventive', 'Corrective', 'Inspection', 'Amélioration'];

const yearOf = (wo: WorkOrder) => (/^\d{4}/.test(wo.dueDate || '') ? wo.dueDate.slice(0, 4) : '');
const isClosed = (wo: WorkOrder) => wo.status === 'Terminé' || wo.status === 'Annulé';

/** Années présentes dans les OT, la plus récente d'abord. */
export function registerYears(wos: WorkOrder[]): string[] {
  return Array.from(new Set(wos.map(yearOf).filter(Boolean))).sort((a, b) => b.localeCompare(a));
}

export function isDefaultFilters(f: RegisterFilters): boolean {
  return f.period === DEFAULT_REGISTER_FILTERS.period && f.status === 'all' && f.type === 'all' && f.query.trim() === '';
}

/** Libellé de la période choisie (repris sur le PDF pour qu'on sache que la liste est filtrée). */
export function periodLabel(period: string, now: Date = new Date()): string {
  if (period === 'all') return 'Toutes les années';
  if (period === 'recent') return `Année ${now.getFullYear()} + non clos des années précédentes`;
  return `Année ${period}`;
}

export function filterRegister(wos: WorkOrder[], f: RegisterFilters, now: Date = new Date()): WorkOrder[] {
  const q = f.query.trim().toLowerCase();
  const currentYear = String(now.getFullYear());
  return wos.filter(wo => {
    if (f.period === 'recent') {
      if (yearOf(wo) !== currentYear && isClosed(wo)) return false;
    } else if (f.period !== 'all' && yearOf(wo) !== f.period) {
      return false;
    }
    if (f.status !== 'all' && wo.status !== f.status) return false;
    if (f.type !== 'all' && wo.type !== f.type) return false;
    if (q && !`${wo.code} ${wo.title}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
