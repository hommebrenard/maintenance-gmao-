import { supabase } from '../supabaseClient';
import type { MaintenanceRequest, RequestStatus, WorkOrderPriority } from '../../types';

// Table `maintenance_requests` (RLS : INSERT si requested_by = auth.uid(),
// SELECT si demandeur ou is_manager(), UPDATE is_manager() ; pas de DELETE).
// Colonne `requester_name` ajoutée le 05/10/2026 : nom du rondier, le compte
// technicien étant partagé.

type StatusRow = 'en_attente' | 'approuvee' | 'rejetee';
type PriorityRow = 'basse' | 'moyenne' | 'haute' | 'urgente';

const STATUS_ROW_TO_APP: Record<StatusRow, RequestStatus> = {
  en_attente: 'En attente',
  approuvee: 'Approuvée',
  rejetee: 'Rejetée',
};
const STATUS_APP_TO_ROW: Record<RequestStatus, StatusRow> = {
  'En attente': 'en_attente',
  'Approuvée': 'approuvee',
  'Rejetée': 'rejetee',
};
const PRIORITY_ROW_TO_APP: Record<PriorityRow, WorkOrderPriority> = {
  basse: 'Faible',
  moyenne: 'Moyenne',
  haute: 'Élevée',
  urgente: 'Urgente',
};
const PRIORITY_APP_TO_ROW: Record<WorkOrderPriority, PriorityRow> = {
  Faible: 'basse',
  Moyenne: 'moyenne',
  Élevée: 'haute',
  Urgente: 'urgente',
};

interface RequestRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  priority: PriorityRow | null;
  status: StatusRow | null;
  equipment_id: string | null;
  location_id: string | null;
  requester_name: string | null;
  work_order_id: string | null;
  approval_date?: string | null;
  created_at: string;
}

function rowToRequest(row: RequestRow): MaintenanceRequest {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description ?? '',
    status: STATUS_ROW_TO_APP[row.status ?? 'en_attente'],
    priority: PRIORITY_ROW_TO_APP[row.priority ?? 'moyenne'],
    equipmentId: row.equipment_id ?? undefined,
    locationId: row.location_id ?? undefined,
    requestedBy: row.requester_name ?? '',
    workOrderId: row.work_order_id,
    decidedAt: row.approval_date ?? undefined,
    createdAt: new Date(row.created_at).toLocaleString('fr-FR'),
  };
}

/** Demandes visibles par l'utilisateur (la RLS filtre), plus récentes d'abord. */
export async function fetchMaintenanceRequests(): Promise<MaintenanceRequest[]> {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as RequestRow[]) || []).map(rowToRequest);
}

/** Code lisible DEM-AAAAMMJJ-NNNN (colonne `code` obligatoire en base). */
export function generateRequestCode(now: Date = new Date()): string {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `DEM-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export interface NewRequestInput {
  title: string;
  description: string;
  priority: WorkOrderPriority;
  equipmentId: string;
  locationId?: string;
  requesterName: string;
}

export async function createMaintenanceRequest(input: NewRequestInput, userId: string): Promise<MaintenanceRequest> {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .insert({
      code: generateRequestCode(),
      title: input.title,
      description: input.description || null,
      priority: PRIORITY_APP_TO_ROW[input.priority],
      equipment_id: input.equipmentId,
      location_id: input.locationId ?? null,
      requested_by: userId,
      requester_name: input.requesterName,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToRequest(data as RequestRow);
}

export interface RequestDecision {
  status: RequestStatus;
  approvedBy: string;
  workOrderId?: string;
}

/** Approuve ou rejette une demande (is_manager). 0 ligne modifiée = refus RLS. */
export async function decideMaintenanceRequest(id: string, d: RequestDecision): Promise<void> {
  const patch: Record<string, unknown> = {
    status: STATUS_APP_TO_ROW[d.status],
    approved_by: d.approvedBy,
    approval_date: new Date().toISOString(),
  };
  if (d.workOrderId) patch.work_order_id = d.workOrderId;
  const { data, error } = await supabase
    .from('maintenance_requests')
    .update(patch)
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Modification refusée ou demande introuvable.');
}
