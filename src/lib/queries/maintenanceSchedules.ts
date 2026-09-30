import { supabase } from '../supabaseClient';
import type { MaintenanceSchedule, MaintenanceFrequencyType } from '../../types';
import { computeScheduleStatus } from '../../utils/maintenanceSchedule';

// ---------------------------------------------------------------------------
// Table `maintenance_schedules` (créée le 28/09/2026, carnet de santé Phase 2).
// Échéances de maintenance d'un équipement ; `legal_requirement = true` pour les
// contrôles réglementaires. RLS : lecture ouverte aux authentifiés,
// INSERT/UPDATE/DELETE réservés à is_manager().
//
// `status` (CHECK ok/due_soon/overdue) est stocké mais vieillit avec le temps :
// à la lecture on le recalcule depuis `next_due_date` quand elle existe (sinon on
// garde la valeur stockée) ; à l'écriture d'une date on écrit aussi le statut
// calculé. Voir utils/maintenanceSchedule.ts pour la règle (seuil de 30 jours).
// ---------------------------------------------------------------------------

interface MaintenanceScheduleRow {
  id: string;
  equipment_id: string;
  title: string;
  frequency_label: string | null;
  frequency_type: string | null;
  interval_hours: number | null;
  interval_months: number | null;
  last_done_date: string | null;
  next_due_date: string | null;
  legal_requirement: boolean;
  assigned_to: string | null;
  inspection_body: string | null;
  control_points: string | null;
  safety_instructions: string | null;
  estimated_duration_minutes: number | null;
  status: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

function rowToSchedule(row: MaintenanceScheduleRow): MaintenanceSchedule {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    title: row.title,
    frequencyLabel: row.frequency_label ?? undefined,
    frequencyType: (row.frequency_type ?? undefined) as MaintenanceFrequencyType | undefined,
    intervalHours: row.interval_hours ?? undefined,
    intervalMonths: row.interval_months ?? undefined,
    lastDoneDate: row.last_done_date ?? undefined,
    nextDueDate: row.next_due_date ?? undefined,
    legalRequirement: row.legal_requirement,
    assignedTo: row.assigned_to ?? undefined,
    inspectionBody: row.inspection_body ?? undefined,
    controlPoints: row.control_points ?? undefined,
    safetyInstructions: row.safety_instructions ?? undefined,
    estimatedDurationMinutes: row.estimated_duration_minutes ?? undefined,
    status:
      computeScheduleStatus(row.next_due_date) ??
      ((row.status ?? undefined) as MaintenanceSchedule['status']),
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

export interface MaintenanceScheduleInput {
  title: string;
  frequencyLabel?: string | null;
  frequencyType?: MaintenanceFrequencyType | null;
  intervalHours?: number | null;
  intervalMonths?: number | null;
  /** YYYY-MM-DD ; '' ou null = non renseigné. */
  lastDoneDate?: string | null;
  nextDueDate?: string | null;
  legalRequirement?: boolean;
  assignedTo?: string | null;
  inspectionBody?: string | null;
  controlPoints?: string | null;
  safetyInstructions?: string | null;
  /** Minutes (> 0) ; null = non renseigné. */
  estimatedDurationMinutes?: number | null;
}

const emptyToNull = (v: string | null | undefined) => (v === '' || v === undefined ? null : v);

function inputToRow(input: Partial<MaintenanceScheduleInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.title !== undefined) row.title = input.title;
  if (input.frequencyLabel !== undefined) row.frequency_label = emptyToNull(input.frequencyLabel);
  if (input.frequencyType !== undefined) row.frequency_type = input.frequencyType;
  if (input.intervalHours !== undefined) row.interval_hours = input.intervalHours;
  if (input.intervalMonths !== undefined) row.interval_months = input.intervalMonths;
  if (input.lastDoneDate !== undefined) row.last_done_date = emptyToNull(input.lastDoneDate);
  if (input.nextDueDate !== undefined) {
    const due = emptyToNull(input.nextDueDate);
    row.next_due_date = due;
    row.status = computeScheduleStatus(due) ?? null;
  }
  if (input.legalRequirement !== undefined) row.legal_requirement = input.legalRequirement;
  if (input.assignedTo !== undefined) row.assigned_to = emptyToNull(input.assignedTo);
  if (input.inspectionBody !== undefined) row.inspection_body = emptyToNull(input.inspectionBody);
  if (input.controlPoints !== undefined) row.control_points = emptyToNull(input.controlPoints);
  if (input.safetyInstructions !== undefined) row.safety_instructions = emptyToNull(input.safetyInstructions);
  if (input.estimatedDurationMinutes !== undefined) row.estimated_duration_minutes = input.estimatedDurationMinutes;
  return row;
}

/** Échéances d'un équipement, les plus proches d'abord (sans date en dernier). */
export async function fetchMaintenanceSchedules(equipmentId: string): Promise<MaintenanceSchedule[]> {
  const { data, error } = await supabase
    .from('maintenance_schedules')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('next_due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return ((data as MaintenanceScheduleRow[]) || []).map(rowToSchedule);
}

/** Crée une échéance. Réservé aux managers. */
export async function createMaintenanceSchedule(
  input: MaintenanceScheduleInput & { equipmentId: string },
  createdBy: string
): Promise<MaintenanceSchedule> {
  const { data, error } = await supabase
    .from('maintenance_schedules')
    .insert({ ...inputToRow(input), equipment_id: input.equipmentId, created_by: createdBy })
    .select('*')
    .single();
  if (error) throw error;
  return rowToSchedule(data as MaintenanceScheduleRow);
}

/** Modifie une échéance (ex. après réalisation : lastDoneDate + nextDueDate). Réservé aux managers. */
export async function updateMaintenanceSchedule(
  id: string,
  patch: Partial<MaintenanceScheduleInput>
): Promise<MaintenanceSchedule> {
  const { data, error } = await supabase
    .from('maintenance_schedules')
    .update({ ...inputToRow(patch), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToSchedule(data as MaintenanceScheduleRow);
}

/** Supprime une échéance. Réservé aux managers (refus RLS détecté : voir equipmentDocuments.ts). */
export async function deleteMaintenanceSchedule(id: string): Promise<void> {
  const { data, error } = await supabase.from('maintenance_schedules').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Suppression refusée ou échéance introuvable.');
}
