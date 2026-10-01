import { supabase } from '../supabaseClient';
import type { ControlResult, ScheduleControl } from '../../types';

// ---------------------------------------------------------------------------
// Table `schedule_controls` (créée le 30/09/2026) : un contrôle réalisé = date,
// organisme, verdict, observations. RLS : lecture ouverte aux authentifiés,
// INSERT/UPDATE/DELETE réservés à is_manager(). Suppression depuis l'interface : managers uniquement, avec confirmation.
// ---------------------------------------------------------------------------

interface ScheduleControlRow {
  id: string;
  schedule_id: string | null;
  equipment_id: string;
  title: string;
  performed_on: string;
  inspection_body: string | null;
  result: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

function rowToControl(row: ScheduleControlRow): ScheduleControl {
  return {
    id: row.id,
    scheduleId: row.schedule_id ?? undefined,
    equipmentId: row.equipment_id,
    title: row.title,
    performedOn: row.performed_on,
    inspectionBody: row.inspection_body ?? undefined,
    result: (row.result ?? undefined) as ControlResult | undefined,
    notes: row.notes ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

export interface ScheduleControlInput {
  /** YYYY-MM-DD */
  performedOn: string;
  inspectionBody?: string | null;
  result?: ControlResult | null;
  notes?: string | null;
}

const emptyToNull = (v: string | null | undefined) => (v === '' || v === undefined ? null : v);

function inputToRow(input: Partial<ScheduleControlInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.performedOn !== undefined) row.performed_on = input.performedOn;
  if (input.inspectionBody !== undefined) row.inspection_body = emptyToNull(input.inspectionBody);
  if (input.result !== undefined) row.result = input.result;
  if (input.notes !== undefined) row.notes = emptyToNull(input.notes);
  return row;
}

/** Contrôles réalisés d'un équipement, les plus récents d'abord. */
export async function fetchScheduleControls(equipmentId: string): Promise<ScheduleControl[]> {
  const { data, error } = await supabase
    .from('schedule_controls')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('performed_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as ScheduleControlRow[]) || []).map(rowToControl);
}

/** Enregistre un contrôle réalisé. Réservé aux managers. `title` = intitulé de l'échéance, recopié pour le garder si elle est supprimée. */
export async function createScheduleControl(
  input: ScheduleControlInput & { equipmentId: string; scheduleId: string; title: string },
  createdBy: string
): Promise<ScheduleControl> {
  const { data, error } = await supabase
    .from('schedule_controls')
    .insert({
      ...inputToRow(input),
      equipment_id: input.equipmentId,
      schedule_id: input.scheduleId,
      title: input.title,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToControl(data as ScheduleControlRow);
}

/** Corrige un contrôle (date, organisme, verdict, observations). Réservé aux managers. */
export async function updateScheduleControl(id: string, patch: Partial<ScheduleControlInput>): Promise<ScheduleControl> {
  const { data, error } = await supabase
    .from('schedule_controls')
    .update({ ...inputToRow(patch), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToControl(data as ScheduleControlRow);
}

/** Supprime un contrôle réalisé (managers). Les documents liés sont conservés (control_id passe à NULL). */
export async function deleteScheduleControl(id: string): Promise<void> {
  const { data, error } = await supabase.from('schedule_controls').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Suppression refusée ou contrôle introuvable.');
}
