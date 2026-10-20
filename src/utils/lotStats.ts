import type { MaintenanceRequest, WorkOrder } from '../types';
import { familyKeyOf } from './annualMatrix';
import { CONTRACT_LOT_ORDER, FAMILIES, contractLotOfFamily, subLotOfFamily, type ContractLot } from './equipmentFamilies';
import { computeDiHeatmap } from './diHeatmap';
import { computeOverdueAging } from './otAging';
import { classifyIfbtDescription, type IfbtSub } from './ifbtDescription';

/**
 * État par lot de contrat — définitions (affichées dans l'écran) :
 * - Lots du contrat : « Électricité » et « Fluide ». L'IFBT et les familles hors contrat ou absentes du référentiel sont « Hors contrat ou non classé ».
 * - Lot d'un OT = lot de la famille de son équipement (3e segment du code équipement). Un OT sans code équipement exploitable est « non classé ».
 * - Lot d'une DI = lot de sa fonction Coswin (renseignée à 100 %), à défaut celui de la famille de l'équipement (planifié d'abord).
 *   Une DI dont la fonction et la famille donnent deux lots de contrat différents est comptée « en contradiction » : elle n'est jamais déplacée.
 * - OT en retard = même définition que « Retard par ancienneté » ; OT terminés = statut « Terminé » ; base = OT hors « Annulé ».
 * - DI sans OT > 90 j = même définition que la heatmap (colonne « Plus de 90 j », toutes priorités).
 */
export type { ContractLot };

/** Règles de lecture du code « Fonction » Coswin (nomenclature Coswin du 20/10/2026), dans l'ordre. */
const FUNCTION_RULES: [RegExp, ContractLot][] = [
  [/^(ELC[_-]|E-CFO-|CFO(-|$)|CFA(-|$)|AEL$|SON$|PSL$)/, 'ELECTRICITE'],
  [/^(FLD[_-]|F-PLB-|F-CVCD-|PLB[_-]|CVC-|CLM$|CHB$|PIS|PI-RIA$)/, 'FLUIDE'],
];

/** Lot de contrat d'un code « Fonction » Coswin ; null si le code est vide, 'HORS_CONTRAT' s'il n'est dans aucun lot (ex. IFBT, BAT_*). */
export function contractLotOfFunction(code?: string): ContractLot | null {
  const c = (code ?? '').trim().toUpperCase();
  if (!c) return null;
  for (const [re, lot] of FUNCTION_RULES) if (re.test(c)) return lot;
  return 'HORS_CONTRAT';
}

export function contractLotOfWorkOrder(wo: WorkOrder): ContractLot {
  return contractLotOfFamily(familyKeyOf(wo.equipmentCode));
}

export interface RequestLot {
  lot: ContractLot; source: 'function' | 'equipment' | 'none' | 'description' | 'override'; conflict: boolean;
  /** Seulement pour les DI de fonction IFBT reclassées d'après leur description. */
  sub?: IfbtSub; check?: boolean;
}
export function contractLotOfRequest(r: MaintenanceRequest): RequestLot {
  let fromFn = contractLotOfFunction(r.functionCode);
  // Fonction « IFBT » : trop souvent saisie à tort (électricité, fluide). Le lot se déduit de la description (voir ifbtDescription.ts).
  let ifbt: ReturnType<typeof classifyIfbtDescription> | null = null;
  if ((r.functionCode ?? '').trim().toUpperCase() === 'IFBT') {
    ifbt = classifyIfbtDescription(r.code, `${r.title ?? ''} ${r.description ?? ''}`);
    fromFn = ifbt.lot;
  }
  const code = (r.plannedEquipmentCode || r.equipmentCode || '').trim();
  const fam = code ? familyKeyOf(code) : '';
  const fromEq: ContractLot | null = fam && fam !== 'AUTRES' && FAMILIES[fam] ? contractLotOfFamily(fam) : null;
  if (fromFn) {
    // Contradiction : deux lots du contrat différents (un lot « hors contrat » côté équipement n'est pas une preuve contraire).
    const conflict = fromEq !== null && fromEq !== 'HORS_CONTRAT' && fromFn !== 'HORS_CONTRAT' && fromEq !== fromFn;
    if (ifbt) return { lot: fromFn, source: ifbt.source, conflict, sub: ifbt.sub, check: ifbt.check };
    return { lot: fromFn, source: 'function', conflict };
  }
  if (fromEq) return { lot: fromEq, source: 'equipment', conflict: false };
  return { lot: 'HORS_CONTRAT', source: 'none', conflict: false };
}

export const filterWorkOrdersByLot = (ots: WorkOrder[], lot: ContractLot | ''): WorkOrder[] =>
  lot ? ots.filter(w => contractLotOfWorkOrder(w) === lot) : ots;
export const filterRequestsByLot = (reqs: MaintenanceRequest[], lot: ContractLot | ''): MaintenanceRequest[] =>
  lot ? reqs.filter(r => contractLotOfRequest(r).lot === lot) : reqs;

export interface SubLotRow { label: string; ot: number; overdue: number; done: number }
export interface LotRow {
  lot: ContractLot;
  ot: number; otBase: number; otOverdue: number; otDone: number; otOther: number;
  di: number; diNoOtOver90: number; diConflicts: number;
  /** DI de fonction IFBT reclassées dans ce lot d'après leur description (lots Électricité et Fluide). */
  diReclassified: number;
  /** DI IFBT « à vérifier » (deux domaines possibles ou mot ambigu) et « à examiner » (non classables). */
  diToCheck: number; diToExamine: number;
  /** Hors contrat : répartition des DI IFBT par sous-catégorie (Bâtiment, Serrurerie, Divers, À examiner). */
  diHorsSubs: Record<string, number>;
  subLots: SubLotRow[];
}
export interface ReviewItem { code: string; title: string; lot: ContractLot; sub?: IfbtSub; check: boolean }
export interface LotResult { rows: LotRow[]; unknownFamilies: { family: string; ot: number }[]; unclassifiedOt: number; review: ReviewItem[] }

export function computeLotRows(ots: WorkOrder[], reqs: MaintenanceRequest[], allWorkOrders: WorkOrder[], today: Date): LotResult {
  const overdueIds = new Set(computeOverdueAging(ots, today).buckets.flatMap(b => b.items.map(i => i.wo.id)));
  const heat = computeDiHeatmap(reqs, allWorkOrders, today);
  const over90 = new Set(Object.values(heat.cells).flatMap(byAge => byAge.a90p.map(i => i.request.id)));
  const rows = new Map<ContractLot, LotRow>(CONTRACT_LOT_ORDER.map(l => [l, { lot: l, ot: 0, otBase: 0, otOverdue: 0, otDone: 0, otOther: 0, di: 0, diNoOtOver90: 0, diConflicts: 0, diReclassified: 0, diToCheck: 0, diToExamine: 0, diHorsSubs: {}, subLots: [] }]));
  const subs = new Map<string, SubLotRow>();
  const unknown = new Map<string, number>();
  let unclassifiedOt = 0;
  const review: ReviewItem[] = [];
  for (const w of ots) {
    const fam = familyKeyOf(w.equipmentCode);
    const lot = contractLotOfFamily(fam);
    const row = rows.get(lot)!;
    row.ot += 1;
    if (!FAMILIES[fam]) { unknown.set(fam, (unknown.get(fam) ?? 0) + 1); unclassifiedOt += 1; }
    const sk = `${lot}|${subLotOfFamily(fam)}`;
    const sub = subs.get(sk) ?? { label: subLotOfFamily(fam), ot: 0, overdue: 0, done: 0 };
    sub.ot += 1;
    subs.set(sk, sub);
    if (w.status === 'Annulé') continue;
    row.otBase += 1;
    if (w.status === 'Terminé') { row.otDone += 1; sub.done += 1; }
    else if (overdueIds.has(w.id)) { row.otOverdue += 1; sub.overdue += 1; }
    else row.otOther += 1;
  }
  for (const r of reqs) {
    const c = contractLotOfRequest(r);
    const row = rows.get(c.lot)!;
    row.di += 1;
    if (c.conflict) row.diConflicts += 1;
    if (c.source === 'description' || c.source === 'override') {
      if (c.lot === 'HORS_CONTRAT') row.diHorsSubs[c.sub ?? 'Divers'] = (row.diHorsSubs[c.sub ?? 'Divers'] ?? 0) + 1;
      else row.diReclassified += 1;
      if (c.check) {
        if (c.sub === 'À examiner') row.diToExamine += 1; else row.diToCheck += 1;
        review.push({ code: r.code ?? r.id, title: r.title, lot: c.lot, sub: c.sub, check: true });
      }
    }
    if (over90.has(r.id)) row.diNoOtOver90 += 1;
  }
  for (const [k, v] of subs) rows.get(k.split('|')[0] as ContractLot)!.subLots.push(v);
  for (const row of rows.values()) row.subLots.sort((a, b) => b.ot - a.ot);
  return {
    rows: CONTRACT_LOT_ORDER.map(l => rows.get(l)!),
    unknownFamilies: [...unknown].map(([family, ot]) => ({ family, ot })).sort((a, b) => b.ot - a.ot),
    unclassifiedOt,
    review,
  };
}
