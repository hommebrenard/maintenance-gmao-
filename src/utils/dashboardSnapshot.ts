import type { LocationItem, MaintenanceRequest, WorkOrder } from '../types';
import { computeDi, computeOt } from './dashboardStats';
import { computeDiHeatmap, filterRequestsBySite } from './diHeatmap';
import { computeFunnel } from './diFunnel';
import { computeQuality } from './dataQuality';
import { computeCompletionSplit, computeOverdueAging, filterWorkOrdersBySite } from './otAging';
import { canonicalSiteKey } from './requestFilters';

/**
 * Instantané mensuel : photo figée des indicateurs du tableau de bord (tous les sites + total).
 * Chaque indicateur reprend exactement le calcul de l'écran (mêmes fonctions, mêmes définitions).
 * `goodWhen` indique le sens favorable d'une évolution (pour colorer l'écart) ; 'neutral' = pas de jugement.
 */
export interface IndicatorDef { key: string; label: string; group: 'DI' | 'OT' | 'Qualité'; goodWhen: 'down' | 'up' | 'neutral' }
export interface IndicatorValue { value: number; denominator: number | null }
export type IndicatorValues = Record<string, IndicatorValue>;
export interface SnapshotRow { site_key: string; site_name: string; indicator: string; value: number; denominator: number | null }

export const INDICATORS: IndicatorDef[] = [
  { key: 'di_total', label: 'DI totales', group: 'DI', goodWhen: 'neutral' },
  { key: 'di_recues', label: 'DI reçues (hors rejetées et annulées)', group: 'DI', goodWhen: 'neutral' },
  { key: 'di_avec_ot', label: 'DI avec OT (sur DI reçues)', group: 'DI', goodWhen: 'up' },
  { key: 'di_ot_cloture', label: 'DI dont OT clôturé (sur DI avec OT)', group: 'DI', goodWhen: 'up' },
  { key: 'di_sans_ot', label: 'DI sans OT (en attente ou prise en charge)', group: 'DI', goodWhen: 'down' },
  { key: 'di_sans_ot_plus90', label: 'DI sans OT de plus de 90 jours', group: 'DI', goodWhen: 'down' },
  { key: 'di_sans_ot_u0_plus90', label: 'DI sans OT U0 de plus de 90 jours', group: 'DI', goodWhen: 'down' },
  { key: 'di_attente_plus30j', label: 'DI en attente depuis plus de 30 jours', group: 'DI', goodWhen: 'down' },
  { key: 'di_cloture_sans_ot', label: 'DI clôturées sans OT', group: 'DI', goodWhen: 'neutral' },
  { key: 'ot_total', label: 'OT totaux', group: 'OT', goodWhen: 'neutral' },
  { key: 'ot_termines', label: 'OT terminés (sur OT hors annulés)', group: 'OT', goodWhen: 'up' },
  { key: 'ot_clotures_coswin_non_regul', label: 'OT clôturés Coswin non régularisés', group: 'OT', goodWhen: 'down' },
  { key: 'ot_echus', label: 'OT échus non terminés', group: 'OT', goodWhen: 'down' },
  { key: 'ot_retard_30', label: 'Retard de 1 à 30 jours', group: 'OT', goodWhen: 'down' },
  { key: 'ot_retard_90', label: 'Retard de 31 à 90 jours', group: 'OT', goodWhen: 'down' },
  { key: 'ot_retard_180', label: 'Retard de 91 à 180 jours', group: 'OT', goodWhen: 'down' },
  { key: 'ot_retard_180p', label: 'Retard de plus de 180 jours', group: 'OT', goodWhen: 'down' },
  { key: 'q_di_sans_equipement', label: 'DI sans équipement lié', group: 'Qualité', goodWhen: 'down' },
  { key: 'q_di_sans_priorite', label: 'DI Coswin sans priorité', group: 'Qualité', goodWhen: 'down' },
  { key: 'q_di_code_invalide', label: 'DI au code invalide', group: 'Qualité', goodWhen: 'down' },
  { key: 'q_ot_nc', label: 'OT « NC » (sans numéro Coswin)', group: 'Qualité', goodWhen: 'down' },
];

const v = (value: number, denominator: number | null = null): IndicatorValue => ({ value, denominator });

/** Indicateurs d'un périmètre : `requests` et `workOrders` sont déjà filtrés par site ; `allWorkOrders` sert à retrouver l'OT lié d'une DI. */
export function computeIndicators(requests: MaintenanceRequest[], workOrders: WorkOrder[], allWorkOrders: WorkOrder[], today: Date): IndicatorValues {
  const di = computeDi(requests, allWorkOrders, today);
  const ot = computeOt(workOrders, today);
  const funnel = computeFunnel(requests, allWorkOrders);
  const heat = computeDiHeatmap(requests, allWorkOrders, today);
  const aging = computeOverdueAging(workOrders, today);
  const split = computeCompletionSplit(workOrders);
  const quality = computeQuality(requests, workOrders);
  const q = (key: string) => quality.find(c => c.key === key)!;
  const bucket = (key: string) => aging.buckets.find(b => b.key === key)?.items.length ?? 0;
  const plus90 = (['U0', 'U1', 'U2', 'U3', 'NA'] as const).reduce((n, p) => n + heat.cells[p].a90p.length, 0);
  return {
    di_total: v(di.total), di_recues: v(funnel.recues), di_avec_ot: v(funnel.avecOt, funnel.recues), di_ot_cloture: v(funnel.otCloture, funnel.avecOt),
    di_sans_ot: v(heat.total), di_sans_ot_plus90: v(plus90), di_sans_ot_u0_plus90: v(heat.cells.U0.a90p.length),
    di_attente_plus30j: v(di.pendingOver30Days), di_cloture_sans_ot: v(funnel.clotureSansOt),
    ot_total: v(ot.total), ot_termines: v(split.done, split.denominator), ot_clotures_coswin_non_regul: v(split.coswinUnregularized), ot_echus: v(ot.overdueNotDone),
    ot_retard_30: v(bucket('d30')), ot_retard_90: v(bucket('d90')), ot_retard_180: v(bucket('d180')), ot_retard_180p: v(bucket('d180p')),
    q_di_sans_equipement: v(q('di-noeq').items.length, q('di-noeq').population), q_di_sans_priorite: v(q('di-noprio').items.length, q('di-noprio').population),
    q_di_code_invalide: v(q('di-code').items.length, q('di-code').population), q_ot_nc: v(q('ot-nc').items.length, q('ot-nc').population),
  };
}

/** Clé du périmètre : 'ALL' ou code canonique du site (repli : id). */
export const siteScopeKey = (loc: Pick<LocationItem, 'id' | 'code'>): string => canonicalSiteKey(loc.code) || loc.id;

/** Lignes à enregistrer : un jeu d'indicateurs pour « tous les sites » puis un par site ayant au moins une DI ou un OT. */
export function computeAllSnapshotRows(
  input: { workOrders: WorkOrder[]; requests: MaintenanceRequest[]; locations: LocationItem[] }, today: Date,
): SnapshotRow[] {
  const rows: SnapshotRow[] = [];
  const push = (site_key: string, site_name: string, values: IndicatorValues) => {
    for (const def of INDICATORS) rows.push({ site_key, site_name, indicator: def.key, value: values[def.key].value, denominator: values[def.key].denominator });
  };
  push('ALL', 'Tous les sites', computeIndicators(input.requests, input.workOrders, input.workOrders, today));
  const seen = new Set<string>(['ALL']);
  for (const loc of input.locations.filter(l => l.type === 'Site')) {
    const key = siteScopeKey(loc);
    if (seen.has(key)) continue;
    const reqs = filterRequestsBySite(input.requests, input.locations, loc.id);
    const ots = filterWorkOrdersBySite(input.workOrders, input.locations, loc.id);
    if (reqs.length + ots.length === 0) continue;
    seen.add(key);
    push(key, loc.name, computeIndicators(reqs, ots, input.workOrders, today));
  }
  return rows;
}

export const currentPeriod = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export interface CompareRow { def: IndicatorDef; before: IndicatorValue | null; now: IndicatorValue; delta: number | null }
export function compareWithSnapshot(snapshot: IndicatorValues | null, live: IndicatorValues): CompareRow[] {
  return INDICATORS.map(def => {
    const before = snapshot?.[def.key] ?? null;
    return { def, before, now: live[def.key], delta: before ? live[def.key].value - before.value : null };
  });
}
