import type { LocationItem, MaintenanceRequest, WorkOrder, WorkOrderStatus } from '../types';
import { displayState, indexWorkOrders, type RequestDisplayState } from './requestDisplay';
import { canonicalSiteKey, STATE_ORDER } from './requestFilters';
import { createSiteMatcher } from './siteNormalization';

/**
 * Tableau de bord OT et DI — définitions (affichées telles quelles dans l'écran) :
 * - DI « annulées » = état affiché « DI annulée » (annulée dans Coswin) + « OT annulé ». Les « Rejetées » (décision locale) sont comptées à part.
 * - Taux de clôture des DI = DI clôturées / (DI totales − annulées − rejetées).
 * - Taux d'annulation des DI = (DI annulée + OT annulé) / DI totales.
 * - DI en attente > 30 j = DI « En attente » dont la date de déclaration remonte à plus de 30 jours.
 * - Taux d'achèvement des OT = OT « Terminé » / (OT totaux − OT « Annulé »).
 * - Taux d'annulation des OT = OT « Annulé » / OT totaux.
 * - OT échus non terminés = OT ni « Terminé » ni « Annulé » dont l'échéance est antérieure à aujourd'hui.
 */
export const OT_STATUSES: WorkOrderStatus[] = ['Ouvert', 'En cours', 'En attente', 'Terminé', 'Annulé'];

export interface DiStats {
  total: number;
  byState: Record<RequestDisplayState, number>;
  closed: number;
  cancelled: number;
  rejected: number;
  closureRate: number | null;
  cancellationRate: number | null;
  pendingOver30Days: number;
}
export interface OtStats {
  total: number;
  byStatus: Record<WorkOrderStatus, number>;
  completionRate: number | null;
  cancellationRate: number | null;
  overdueNotDone: number;
}
export interface DashboardResult { di: DiStats; ot: OtStats }
export interface SiteRow { name: string; code: string; ot: number; otCompletionRate: number | null; di: number; diClosureRate: number | null }

const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);
const DAY = 86_400_000;

function declaredTime(r: MaintenanceRequest): number {
  const t = Date.parse(r.declaredAt || r.createdAtIso || '');
  return Number.isNaN(t) ? NaN : t;
}

export function computeDi(requests: MaintenanceRequest[], workOrders: WorkOrder[], today: Date): DiStats {
  const byState = Object.fromEntries(STATE_ORDER.map(s => [s, 0])) as Record<RequestDisplayState, number>;
  const linked = indexWorkOrders(workOrders, requests);
  let pendingOver30Days = 0;
  for (const r of requests) {
    const state = displayState(r, r.workOrderId ? linked.get(r.workOrderId) : undefined);
    byState[state] += 1;
    if (state === 'En attente') {
      const t = declaredTime(r);
      if (!Number.isNaN(t) && today.getTime() - t > 30 * DAY) pendingOver30Days += 1;
    }
  }
  const total = requests.length;
  const cancelled = byState['DI annulée'] + byState['OT annulé'];
  const rejected = byState['Rejetée'];
  const closed = byState['Clôturée'];
  return {
    total, byState, closed, cancelled, rejected,
    closureRate: ratio(closed, total - cancelled - rejected),
    cancellationRate: ratio(cancelled, total),
    pendingOver30Days,
  };
}

export function computeOt(workOrders: WorkOrder[], today: Date): OtStats {
  const byStatus = Object.fromEntries(OT_STATUSES.map(s => [s, 0])) as Record<WorkOrderStatus, number>;
  const todayIso = today.toISOString().slice(0, 10);
  let overdueNotDone = 0;
  for (const w of workOrders) {
    if (w.status in byStatus) byStatus[w.status] += 1;
    if (w.status !== 'Terminé' && w.status !== 'Annulé' && w.dueDate && w.dueDate.slice(0, 10) < todayIso) overdueNotDone += 1;
  }
  const total = workOrders.length;
  return {
    total, byStatus,
    completionRate: ratio(byStatus['Terminé'], total - byStatus['Annulé']),
    cancellationRate: ratio(byStatus['Annulé'], total),
    overdueNotDone,
  };
}

/** `site` = id d'un emplacement de type « Site », ou '' pour tous les sites. */
export function computeDashboard(
  input: { workOrders: WorkOrder[]; requests: MaintenanceRequest[]; locations: LocationItem[] },
  site: string,
  today: Date = new Date(),
): DashboardResult {
  const loc = site ? input.locations.find(l => l.id === site) : undefined;
  if (!loc) return { di: computeDi(input.requests, input.workOrders, today), ot: computeOt(input.workOrders, today) };
  const matchOt = createSiteMatcher(loc.name, input.locations);
  const key = canonicalSiteKey(loc.code);
  const ots = input.workOrders.filter(matchOt);
  const reqs = input.requests.filter(r => key !== '' && canonicalSiteKey(r.siteCode) === key);
  return { di: computeDi(reqs, input.workOrders, today), ot: computeOt(ots, today) };
}

/** Une ligne par site (vue d'ensemble) ; les sites sans OT ni DI sont omis. */
export function computeSiteRows(
  input: { workOrders: WorkOrder[]; requests: MaintenanceRequest[]; locations: LocationItem[] },
  today: Date = new Date(),
): SiteRow[] {
  const rows: SiteRow[] = [];
  for (const l of input.locations.filter(x => x.type === 'Site')) {
    const r = computeDashboard(input, l.id, today);
    if (r.ot.total + r.di.total === 0) continue;
    rows.push({ name: l.name, code: l.code ?? '', ot: r.ot.total, otCompletionRate: r.ot.completionRate, di: r.di.total, diClosureRate: r.di.closureRate });
  }
  return rows.sort((a, b) => b.ot + b.di - (a.ot + a.di));
}
