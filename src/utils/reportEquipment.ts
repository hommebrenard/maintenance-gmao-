import type { Equipment, WorkOrder } from '../types';
import { familyKeyOf } from './annualMatrix';
import { lotOfFamily, LotCode } from './equipmentFamilies';

/** Onglet « État des équipements » du module Rapports : lignes, synthèse, filtres et tri (fonctions pures). */

export type EquipSortKey =
  | 'code' | 'name' | 'family' | 'lot' | 'location' | 'status' | 'criticality' | 'openWo' | 'totalWo';

export interface EquipmentRow {
  eq: Equipment;
  family: string;
  lot: LotCode;
  /** OT rattachés à l'équipement, tous statuts confondus. */
  totalWo: number;
  /** OT ni terminés ni annulés (Ouvert / En cours / En attente). */
  openWo: number;
}

export interface EquipmentRowsResult {
  rows: EquipmentRow[];
  /** OT sans équipement identifiable (pas d'id ni de code connu) : absents des compteurs du tableau. */
  orphanWoCount: number;
}

const OPEN_STATUSES = new Set(['Ouvert', 'En cours', 'En attente']);
const CRIT_RANK: Record<string, number> = { Faible: 1, Normal: 2, Élevée: 3, Critique: 4 };
const STATUS_RANK: Record<string, number> = { 'En service': 1, 'Arrêt planifié': 2, 'Arrêt non planifié': 3 };

/** Rattache chaque OT à son équipement (par id, sinon par code) en un seul passage. */
export function buildEquipmentRows(equipment: Equipment[], workOrders: WorkOrder[]): EquipmentRowsResult {
  const byId = new Map<string, EquipmentRow>();
  const byCode = new Map<string, EquipmentRow>();
  const rows: EquipmentRow[] = equipment.map(eq => {
    const family = familyKeyOf(eq.code);
    const row: EquipmentRow = { eq, family, lot: lotOfFamily(family), totalWo: 0, openWo: 0 };
    byId.set(eq.id, row);
    if (eq.code) byCode.set(eq.code, row);
    return row;
  });
  let orphanWoCount = 0;
  for (const w of workOrders) {
    const row = (w.equipmentId && byId.get(w.equipmentId)) || (w.equipmentCode && byCode.get(w.equipmentCode)) || undefined;
    if (!row) { orphanWoCount++; continue; }
    row.totalWo++;
    if (OPEN_STATUSES.has(w.status)) row.openWo++;
  }
  return { rows, orphanWoCount };
}

export interface EquipmentSummary {
  total: number;
  inService: number;
  plannedStop: number;
  unplannedStop: number;
  /** Criticité Élevée ou Critique ET arrêt non planifié. */
  criticalDown: number;
  /** Équipements sans aucun OT rattaché. */
  withoutWo: number;
}

export function isCriticalDown(r: EquipmentRow): boolean {
  return r.eq.status === 'Arrêt non planifié' && (r.eq.criticality === 'Critique' || r.eq.criticality === 'Élevée');
}

export function summarizeEquipment(rows: EquipmentRow[]): EquipmentSummary {
  return {
    total: rows.length,
    inService: rows.filter(r => r.eq.status === 'En service').length,
    plannedStop: rows.filter(r => r.eq.status === 'Arrêt planifié').length,
    unplannedStop: rows.filter(r => r.eq.status === 'Arrêt non planifié').length,
    criticalDown: rows.filter(isCriticalDown).length,
    withoutWo: rows.filter(r => r.totalWo === 0).length,
  };
}

export interface EquipmentFilters {
  search: string;
  lot: string;
  family: string;
  status: string;
  criticality: string;
  quick: '' | 'withoutWo' | 'criticalDown';
}

export const EMPTY_EQUIPMENT_FILTERS: EquipmentFilters = { search: '', lot: '', family: '', status: '', criticality: '', quick: '' };

export function filterEquipmentRows(rows: EquipmentRow[], f: EquipmentFilters): EquipmentRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter(r => {
    if (f.lot && r.lot !== f.lot) return false;
    if (f.family && r.family !== f.family) return false;
    if (f.status && r.eq.status !== f.status) return false;
    if (f.criticality && r.eq.criticality !== f.criticality) return false;
    if (f.quick === 'withoutWo' && r.totalWo !== 0) return false;
    if (f.quick === 'criticalDown' && !isCriticalDown(r)) return false;
    if (q && ![r.eq.code, r.eq.name, r.eq.location].some(v => (v || '').toLowerCase().includes(q))) return false;
    return true;
  });
}

function sortValue(r: EquipmentRow, key: EquipSortKey): string | number {
  switch (key) {
    case 'code': return r.eq.code || '';
    case 'name': return r.eq.name || '';
    case 'family': return r.family === 'AUTRES' ? '' : r.family;
    case 'lot': return r.lot;
    case 'location': return r.eq.location || '';
    case 'status': return STATUS_RANK[r.eq.status] ?? 99;
    case 'criticality': return CRIT_RANK[r.eq.criticality] ?? 99;
    case 'openWo': return r.openWo;
    case 'totalWo': return r.totalWo;
  }
}

/** Tri stable ; les valeurs vides vont toujours en fin de liste, quel que soit le sens. */
export function sortEquipmentRows(rows: EquipmentRow[], key: EquipSortKey, dir: 'asc' | 'desc'): EquipmentRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const va = sortValue(a.r, key);
      const vb = sortValue(b.r, key);
      const ea = va === '' || va === 99, eb = vb === '' || vb === 99;
      if (ea !== eb) return ea ? 1 : -1;
      const c = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'fr', { numeric: true, sensitivity: 'base' });
      return c !== 0 ? c * sign : a.i - b.i;
    })
    .map(x => x.r);
}
