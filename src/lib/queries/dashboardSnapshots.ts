import { supabase } from '../supabaseClient';
import type { IndicatorValues, SnapshotRow } from '../../utils/dashboardSnapshot';

export interface SnapshotHeader { id: string; period: string; taken_at: string; note: string | null }

/** Enregistre l'instantané d'un mois (fonction SQL réservée au responsable, une seule transaction). replace = true remplace celui du mois. */
export async function saveDashboardSnapshot(period: string, rows: SnapshotRow[], note: string | null, replace: boolean): Promise<{ period: string; rows: number; replaced: boolean }> {
  const { data, error } = await supabase.rpc('save_dashboard_snapshot', { p_period: period, p_rows: rows, p_note: note, p_replace: replace });
  if (error) throw error;
  return data as { period: string; rows: number; replaced: boolean };
}

export async function fetchSnapshots(): Promise<SnapshotHeader[]> {
  const { data, error } = await supabase.from('dashboard_snapshots').select('id, period, taken_at, note').order('period', { ascending: false }).limit(60);
  if (error) throw error;
  return (data ?? []) as SnapshotHeader[];
}

/** Valeurs d'un instantané pour un seul périmètre (une vingtaine de lignes : reste très en dessous de la limite de 1 000 lignes). */
export async function fetchSnapshotScope(snapshotId: string, siteKey: string): Promise<IndicatorValues> {
  const { data, error } = await supabase.from('dashboard_snapshot_values').select('indicator, value, denominator').eq('snapshot_id', snapshotId).eq('site_key', siteKey);
  if (error) throw error;
  const out: IndicatorValues = {};
  for (const r of (data ?? []) as { indicator: string; value: number | string; denominator: number | string | null }[]) {
    out[r.indicator] = { value: Number(r.value), denominator: r.denominator === null ? null : Number(r.denominator) };
  }
  return out;
}

/** Rôle de l'utilisateur connecté (table profiles) : le bouton d'enregistrement n'est proposé qu'au responsable ou à l'admin. */
export async function fetchMyRole(): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const id = u.user?.id;
  if (!id) return null;
  const { data, error } = await supabase.from('profiles').select('role').eq('id', id).maybeSingle();
  if (error) return null;
  return (data as { role?: string } | null)?.role ?? null;
}
