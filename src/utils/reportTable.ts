import type { WorkOrder } from '../types';
import { frequencyOf, familyKeyOf } from './annualMatrix';
import { lotOfFamily } from './equipmentFamilies';
import { responsibleOf } from './workOrderResponsible';

export type DetailSortKey =
  | 'code' | 'title' | 'equipment' | 'lot' | 'family' | 'freq'
  | 'status' | 'priority' | 'responsible' | 'location' | 'dueDate';

const FREQ_ORDER: Record<string, number> = { H: 1, M: 2, T: 3, S: 4, A: 5 };

/** "2026-06-29" → "29/06/2026" ; autre format ou vide : renvoyé tel quel / "—". */
export function formatDateFr(iso?: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export interface DetailRow {
  wo: WorkOrder;
  family: string;
  lot: string;
  freq: string;
  responsible: string;
}

/** Colonnes dérivées d'un OT (famille/lot depuis le code équipement, fréquence H/M/T/S/A). */
export function toDetailRow(wo: WorkOrder): DetailRow {
  const family = familyKeyOf(wo.equipmentCode);
  return { wo, family, lot: lotOfFamily(family), freq: frequencyOf(wo) || '', responsible: responsibleOf(wo) };
}

function sortValue(r: DetailRow, key: DetailSortKey): string | number {
  const w = r.wo;
  switch (key) {
    case 'code': return w.code || '';
    case 'title': return w.title || '';
    case 'equipment': return w.equipmentName || '';
    case 'lot': return r.lot;
    case 'family': return r.family;
    case 'freq': return r.freq ? FREQ_ORDER[r.freq] ?? 9 : 99;
    case 'status': return w.status || '';
    case 'priority': return w.priority || '';
    case 'responsible': return r.responsible;
    case 'location': return w.location || '';
    case 'dueDate': return w.dueDate || '';
  }
}

/** Tri stable ; les valeurs vides vont toujours en fin de liste, quel que soit le sens. */
export function sortDetailRows(rows: DetailRow[], key: DetailSortKey, dir: 'asc' | 'desc'): DetailRow[] {
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

/** Recherche plein texte simple sur code, titre, équipement, site et intervenant. */
export function matchesDetailSearch(r: DetailRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const w = r.wo;
  return [w.code, w.title, w.equipmentName, w.equipmentCode, w.location, r.responsible]
    .some(v => (v || '').toLowerCase().includes(q));
}
