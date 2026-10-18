import { supabase } from '../supabaseClient';
import type { ClosureItem } from '../../utils/coswinClosure';

export interface ClosureDetail { code: string; closed_on: string; status: string }
export interface ClosureResult {
  lot: string; applique: boolean; lignes_recues: number; introuvables: number; deja_termines: number;
  annules_ignores: number; a_cloturer: number; a_decider: number; clotures: number;
  detail_300_premiers: ClosureDetail[]; introuvables_100_premiers: string[]; a_decider_100_premiers: { code: string; status: string }[];
}

/**
 * Clôture Coswin des OT (fonction SQL réservée au responsable, une seule transaction).
 * apply = false : aperçu chiffré sans écriture ; apply = true : clôture + historique du lot.
 */
export async function closeWorkOrdersFromCoswin(items: ClosureItem[], lot: string, apply: boolean): Promise<ClosureResult> {
  const { data, error } = await supabase.rpc('close_work_orders_from_coswin', { p_rows: items, p_lot: lot, p_apply: apply });
  if (error) throw error;
  return data as ClosureResult;
}

/** Retour arrière d'un lot : les OT clôturés par ce lot repassent à leur statut d'origine. */
export async function revertCoswinClosure(lot: string): Promise<{ lot: string; rouverts: number }> {
  const { data, error } = await supabase.rpc('revert_coswin_closure', { p_lot: lot });
  if (error) throw error;
  return data as { lot: string; rouverts: number };
}
