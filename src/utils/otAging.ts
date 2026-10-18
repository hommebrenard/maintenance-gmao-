import type { LocationItem, WorkOrder } from '../types';
import { createSiteMatcher } from './siteNormalization';

/**
 * Retard des OT par ancienneté et clôture administrative Coswin — définitions (affichées dans l'écran) :
 * - OT en retard = OT ni « Terminé » ni « Annulé » dont l'échéance est antérieure à aujourd'hui.
 * - Ancienneté du retard = nombre de jours entre l'échéance et aujourd'hui (tranches : 1-30, 31-90, 91-180, > 180 j).
 * - Aucun OT n'est exclu automatiquement : un retard ancien reste un retard à examiner (clôture oubliée dans l'application, ou OT réellement en souffrance).
 * - État Coswin « chargé » : pour un site et un mois d'échéance donnés, au moins un OT a été clôturé par l'import Coswin. Tant qu'il ne l'est pas, un OT « Ouvert » en retard peut déjà être terminé dans Coswin : son retard n'est pas confirmé.
 * - OT « NC » = OT planifié dans l'application mais non créé dans Coswin (code « NC… ») : aucun état Coswin n'existe pour lui, son retard ne dépend pas d'un import Coswin.
 * - OT clôturé dans Coswin, non régularisé = OT « Terminé » via l'import Coswin, sans checklist ni visa renseignés dans l'application.
 */
export type AgingKey = 'd30' | 'd90' | 'd180' | 'd180p';
export type CoswinState = 'loaded' | 'notLoaded' | 'notCreated';
export interface OverdueItem { wo: WorkOrder; daysLate: number; coswin: CoswinState }
export interface AgingBucket { key: AgingKey; label: string; min: number; max: number; items: OverdueItem[] }
export interface AgingResult { total: number; buckets: AgingBucket[]; withoutDueDate: number; loadedTotal: number; notLoadedTotal: number; notCreatedTotal: number }

const DAY = 86_400_000;
export const AGING_DEFS: { key: AgingKey; label: string; min: number; max: number }[] = [
  { key: 'd30', label: '1 à 30 jours', min: 1, max: 30 },
  { key: 'd90', label: '31 à 90 jours', min: 31, max: 90 },
  { key: 'd180', label: '91 à 180 jours', min: 91, max: 180 },
  { key: 'd180p', label: 'Plus de 180 jours', min: 181, max: Infinity },
];

const isNotCreated = (w: WorkOrder) => /^(?:OT-)?NC/i.test((w.code || '').trim());
const coverageKey = (w: WorkOrder) => `${w.location ?? ''}|${(w.dueDate || '').slice(0, 7)}`;
/** Couples « site | mois d'échéance » dont l'état Coswin a été chargé (au moins un OT clôturé par l'import Coswin). */
export function computeCoswinCoverage(workOrders: WorkOrder[]): Set<string> {
  const set = new Set<string>();
  for (const w of workOrders) if (w.closureSource === 'coswin') set.add(coverageKey(w));
  return set;
}

export function computeOverdueAging(workOrders: WorkOrder[], today: Date, coverage: Set<string> = computeCoswinCoverage(workOrders)): AgingResult {
  const todayMs = Date.parse(today.toISOString().slice(0, 10));
  const buckets: AgingBucket[] = AGING_DEFS.map(d => ({ ...d, items: [] }));
  let withoutDueDate = 0;
  let total = 0;
  let loadedTotal = 0;
  let notCreatedTotal = 0;
  for (const wo of workOrders) {
    if (wo.status === 'Terminé' || wo.status === 'Annulé') continue;
    const due = Date.parse((wo.dueDate || '').slice(0, 10));
    if (Number.isNaN(due)) { withoutDueDate += 1; continue; }
    const daysLate = Math.round((todayMs - due) / DAY);
    if (daysLate < 1) continue;
    const b = buckets.find(x => daysLate >= x.min && daysLate <= x.max);
    if (b) {
      const coswin: CoswinState = isNotCreated(wo) ? 'notCreated' : coverage.has(coverageKey(wo)) ? 'loaded' : 'notLoaded';
      b.items.push({ wo, daysLate, coswin });
      total += 1;
      if (coswin === 'loaded') loadedTotal += 1;
      else if (coswin === 'notCreated') notCreatedTotal += 1;
    }
  }
  for (const b of buckets) b.items.sort((x, y) => y.daysLate - x.daysLate);
  return { total, buckets, withoutDueDate, loadedTotal, notCreatedTotal, notLoadedTotal: total - loadedTotal - notCreatedTotal };
}

/** `site` = id d'un emplacement de type « Site », ou '' pour tous les sites (même règle que le tableau de bord). */
export function filterWorkOrdersBySite(workOrders: WorkOrder[], locations: LocationItem[], site: string): WorkOrder[] {
  const loc = site ? locations.find(l => l.id === site) : undefined;
  return loc ? workOrders.filter(createSiteMatcher(loc.name, locations)) : workOrders;
}

const isCoswinUnregularized = (w: WorkOrder) => w.closureSource === 'coswin' && !w.closureRegularizedAt;

export interface CompletionSplit {
  denominator: number;            // OT totaux − OT « Annulé »
  done: number;                   // OT « Terminé » (toutes provenances)
  coswinUnregularized: number;    // dont clôturés dans Coswin sans checklist ni visa
  rateAll: number | null;
  rateExcludingCoswin: number | null;
}
export function computeCompletionSplit(workOrders: WorkOrder[]): CompletionSplit {
  let cancelled = 0, done = 0, coswinUnregularized = 0;
  for (const w of workOrders) {
    if (w.status === 'Annulé') cancelled += 1;
    else if (w.status === 'Terminé') { done += 1; if (isCoswinUnregularized(w)) coswinUnregularized += 1; }
  }
  const denominator = workOrders.length - cancelled;
  return {
    denominator, done, coswinUnregularized,
    rateAll: denominator > 0 ? done / denominator : null,
    rateExcludingCoswin: denominator > 0 ? (done - coswinUnregularized) / denominator : null,
  };
}

export const COSWIN_STATE_LABEL: Record<CoswinState, string> = { loaded: 'Chargé', notLoaded: 'Non chargé', notCreated: 'Non créé dans Coswin (NC)' };
const csvCell = (v: string | number | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
/** CSV (séparateur « ; », BOM UTF-8) lisible directement dans Excel. */
export function overdueToCsv(items: OverdueItem[]): string {
  const head = ['Code', 'Titre', 'Équipement', 'Site', 'Échéance', 'Retard (jours)', 'Statut', 'Responsable', 'État Coswin'];
  const rows = items.map(({ wo, daysLate, coswin }) => [wo.code, wo.title, wo.equipmentName, wo.location, (wo.dueDate || '').slice(0, 10), daysLate, wo.status, wo.assignee ?? wo.planner, COSWIN_STATE_LABEL[coswin]]);
  return '\uFEFF' + [head, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
}
