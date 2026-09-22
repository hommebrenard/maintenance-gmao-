import { supabase } from '../supabaseClient';
import type { HealthRecordEntry } from '../../types';

// ---------------------------------------------------------------------------
// Table `carnets_sante` (créée le 22/09/2026, chantier carnet de santé) :
// une ligne = un événement (maintenance, réparation, inspection, contrôle
// réglementaire...) rattaché à un équipement via `equipment_id` (FK, ON
// DELETE CASCADE). RLS : lecture ouverte aux authentifiés, écriture réservée
// à `is_manager()` (même convention que equipment/gamme_plans/locations).
// ---------------------------------------------------------------------------

interface HealthRecordRow {
  id: string;
  equipment_id: string;
  event_date: string;
  event_type: string;
  description: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

function rowToEntry(row: HealthRecordRow): HealthRecordEntry {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    eventDate: row.event_date,
    eventType: row.event_type,
    description: row.description ?? '',
    status: row.status ?? '',
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

/** Récupère les entrées du carnet de santé d'un équipement, les plus récentes d'abord. */
export async function fetchHealthRecords(equipmentId: string): Promise<HealthRecordEntry[]> {
  const { data, error } = await supabase
    .from('carnets_sante')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('event_date', { ascending: false });

  if (error) throw error;
  return (data as HealthRecordRow[]).map(rowToEntry);
}

/** Crée une entrée de carnet de santé pour un équipement. */
export async function createHealthRecord(
  entry: { equipmentId: string; eventType: string; description?: string; status?: string; eventDate?: string },
  createdBy: string
): Promise<HealthRecordEntry> {
  const { data, error } = await supabase
    .from('carnets_sante')
    .insert({
      equipment_id: entry.equipmentId,
      event_type: entry.eventType,
      description: entry.description ?? '',
      status: entry.status ?? 'Terminé',
      ...(entry.eventDate ? { event_date: entry.eventDate } : {}),
      created_by: createdBy,
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToEntry(data as HealthRecordRow);
}
