import type { LocationItem, MaintenanceRequest, WorkOrder } from '../types';
import { displayState, indexWorkOrders } from './requestDisplay';
import { canonicalSiteKey } from './requestFilters';
import type { SiteNameResolver } from './siteLabel';

/**
 * DI sans OT par priorité et par âge — définitions (affichées dans l'écran) :
 * - DI sans OT = DI à l'état affiché « En attente » ou « Prise en charge » qui n'a ni OT lié dans l'application ni numéro d'OT Coswin.
 *   Sont exclues : DI annulées, rejetées, clôturées (dont « 17. Clôturée sans OT »).
 * - Âge = nombre de jours entre la date de déclaration (à défaut, la date de création) et aujourd'hui.
 * - Priorité = code Coswin U0 à U3 lu au début du champ « Priorité Coswin » ; « Non renseignée » sinon.
 */
export type DiAgeKey = 'a7' | 'a30' | 'a90' | 'a90p';
export type DiPriorityKey = 'U0' | 'U1' | 'U2' | 'U3' | 'NA';
export interface DiHeatItem { request: MaintenanceRequest; ageDays: number; priority: DiPriorityKey }
export interface DiHeatmapResult {
  total: number;
  withoutDate: number;
  cells: Record<DiPriorityKey, Record<DiAgeKey, DiHeatItem[]>>;
}

const DAY = 86_400_000;
export const DI_AGE_DEFS: { key: DiAgeKey; label: string; min: number; max: number }[] = [
  { key: 'a7', label: '0 à 7 j', min: 0, max: 7 },
  { key: 'a30', label: '8 à 30 j', min: 8, max: 30 },
  { key: 'a90', label: '31 à 90 j', min: 31, max: 90 },
  { key: 'a90p', label: 'Plus de 90 j', min: 91, max: Infinity },
];
export const DI_PRIORITIES: { key: DiPriorityKey; label: string }[] = [
  { key: 'U0', label: 'U0' }, { key: 'U1', label: 'U1' }, { key: 'U2', label: 'U2' }, { key: 'U3', label: 'U3' },
  { key: 'NA', label: 'Non renseignée' },
];

export function parsePriority(code?: string): DiPriorityKey {
  const m = /^\s*U\s*([0-3])/i.exec(code ?? '');
  return m ? (`U${m[1]}` as DiPriorityKey) : 'NA';
}

export function filterRequestsBySite(requests: MaintenanceRequest[], locations: LocationItem[], site: string): MaintenanceRequest[] {
  const loc = site ? locations.find(l => l.id === site) : undefined;
  if (!loc) return requests;
  const key = canonicalSiteKey(loc.code);
  return requests.filter(r => key !== '' && canonicalSiteKey(r.siteCode) === key);
}

export function computeDiHeatmap(requests: MaintenanceRequest[], workOrders: WorkOrder[], today: Date): DiHeatmapResult {
  const cells = Object.fromEntries(DI_PRIORITIES.map(p => [p.key, Object.fromEntries(DI_AGE_DEFS.map(a => [a.key, [] as DiHeatItem[]]))])) as DiHeatmapResult['cells'];
  const linked = indexWorkOrders(workOrders, requests);
  const todayMs = Date.parse(today.toISOString().slice(0, 10));
  let total = 0;
  let withoutDate = 0;
  for (const r of requests) {
    if (r.workOrderId || (r.otNumber ?? '').trim()) continue;
    const state = displayState(r, r.workOrderId ? linked.get(r.workOrderId) : undefined);
    if (state !== 'En attente' && state !== 'Prise en charge') continue;
    const t = Date.parse((r.declaredAt || r.createdAtIso || '').slice(0, 10));
    if (Number.isNaN(t)) { withoutDate += 1; continue; }
    const ageDays = Math.max(0, Math.round((todayMs - t) / DAY));
    const age = DI_AGE_DEFS.find(a => ageDays >= a.min && ageDays <= a.max);
    if (!age) continue;
    const priority = parsePriority(r.priorityCode);
    cells[priority][age.key].push({ request: r, ageDays, priority });
    total += 1;
  }
  for (const p of DI_PRIORITIES) for (const a of DI_AGE_DEFS) cells[p.key][a.key].sort((x, y) => y.ageDays - x.ageDays);
  return { total, withoutDate, cells };
}

const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
export function diHeatToCsv(items: DiHeatItem[], siteName?: SiteNameResolver): string {
  const head = ['Code DI', 'Titre', 'Équipement', 'Site', 'Priorité', 'Déclarée le', 'Âge (jours)', 'État Coswin'];
  const rows = items.map(({ request: r, ageDays, priority }) => [
    r.code ?? '', r.title ?? '', r.equipmentCode || r.equipmentName || '', siteName?.(r.siteCode) ?? (r.siteCode || r.location || ''), priority,
    (r.declaredAt || r.createdAtIso || '').slice(0, 10), String(ageDays), r.coswinState ?? '',
  ].map(esc).join(';'));
  return '\ufeff' + [head.map(esc).join(';'), ...rows].join('\n');
}
