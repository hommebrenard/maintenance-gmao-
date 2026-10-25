import { supabase } from '../supabaseClient';
import type { MaintenanceRequest, RequestStatus, WorkOrderPriority } from '../../types';
import type { RequestInsertRow } from '../../utils/importRequests';

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
  requester_email?: string | null;
  work_order_id: string | null;
  approval_date?: string | null;
  created_at: string;
  origin?: 'app' | 'coswin' | null;
  coswin_state?: string | null; intervention_type?: string | null; qse_type?: string | null; daf_number?: string | null;
  declared_at?: string | null; due_date?: string | null; proposed_due_date?: string | null; priority_code?: string | null; ot_number?: string | null;
  ot_state?: string | null; ot_state_label?: string | null; function_label?: string | null; function_code?: string | null;
  supervisor_name?: string | null; cost_center?: string | null; planned_start?: string | null; ot_end_date?: string | null;
  coswin_created_at?: string | null; visa?: string | null; equipment_code?: string | null; planned_equipment_code?: string | null; intervention_code?: string | null;
  site_code?: string | null; rejection_reason?: string | null;
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
    requestedBy: row.requester_name ?? '', requesterEmail: row.requester_email ?? undefined,
    workOrderId: row.work_order_id,
    decidedAt: row.approval_date ?? undefined,
    origin: row.origin ?? 'app',
    coswinState: row.coswin_state ?? undefined, interventionType: row.intervention_type ?? undefined,
    qseType: row.qse_type ?? undefined, dafNumber: row.daf_number ?? undefined, declaredAt: row.declared_at ?? undefined,
    dueDate: row.due_date ?? undefined, proposedDueDate: row.proposed_due_date ?? undefined, priorityCode: row.priority_code ?? undefined, otNumber: row.ot_number ?? undefined,
    otState: row.ot_state ?? undefined, otStateLabel: row.ot_state_label ?? undefined,
    functionLabel: row.function_label ?? undefined, functionCode: row.function_code ?? undefined,
    supervisorName: row.supervisor_name ?? undefined, costCenter: row.cost_center ?? undefined,
    plannedStart: row.planned_start ?? undefined, otEndDate: row.ot_end_date ?? undefined,
    coswinCreatedAt: row.coswin_created_at ?? undefined, visa: row.visa ?? undefined,
    equipmentCode: row.equipment_code ?? undefined, plannedEquipmentCode: row.planned_equipment_code ?? undefined, interventionCode: row.intervention_code ?? undefined,
    siteCode: row.site_code ?? undefined, rejectionReason: row.rejection_reason ?? undefined,
    createdAtIso: row.created_at,
    createdAt: new Date(row.created_at).toLocaleString('fr-FR', row.origin === 'coswin' ? { timeZone: 'UTC' } : undefined),
  };
}

/** Demandes visibles par l'utilisateur (la RLS filtre), plus récentes d'abord. */
export async function fetchMaintenanceRequests(): Promise<MaintenanceRequest[]> {
  // Plafond Supabase de 1000 lignes par requête : lecture paginée (ordre stable created_at puis id).
  const PAGE = 1000;
  const all: RequestRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data as RequestRow[]) || [];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all.map(rowToRequest);
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
  /** Date de déclaration (ISO complet). Par défaut : maintenant. */
  declaredAt?: string;
  /** Date de fin prévue proposée, AAAA-MM-JJ (colonne `proposed_due_date`). */
  proposedDueDate?: string;
  /** Source de constatation = type d'intervention Coswin (code, colonne `intervention_type`). */
  interventionType?: string;
  dafNumber?: string;
  supervisorName?: string;
  requesterEmail?: string;
}

/** Nombre d'essais si deux demandes tirent le même code DEM-… le même jour (index UNIQUE sur `code`). */
const CODE_ATTEMPTS = 3;

function isDuplicateCodeError(err: any): boolean {
  return err?.code === '23505' && /code/i.test(`${err?.message ?? ''} ${err?.details ?? ''}`);
}

export async function createMaintenanceRequest(input: NewRequestInput, userId: string): Promise<MaintenanceRequest> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
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
        declared_at: input.declaredAt ?? new Date().toISOString(),
        proposed_due_date: input.proposedDueDate ?? null,
        intervention_type: input.interventionType || null,
        daf_number: input.dafNumber?.trim() || null,
        supervisor_name: input.supervisorName || null,
        requester_email: input.requesterEmail?.trim() || null,
      })
      .select('*')
      .single();
    if (!error) return rowToRequest(data as RequestRow);
    if (!isDuplicateCodeError(error)) throw error;
    lastError = error;
  }
  throw lastError;
}

export interface RequestDecision {
  status: RequestStatus;
  approvedBy: string;
  workOrderId?: string;
  /** Motif (rejet) : colonne `rejection_reason`. */
  rejectionReason?: string;
  /** Date de fin RETENUE (AAAA-MM-JJ), colonne `due_date` : à n'envoyer que pour une demande de l'app (origine « app »). */
  dueDate?: string;
}

/** Approuve ou rejette une demande (is_manager). 0 ligne modifiée = refus RLS. */
export async function decideMaintenanceRequest(id: string, d: RequestDecision): Promise<void> {
  const patch: Record<string, unknown> = {
    status: STATUS_APP_TO_ROW[d.status],
    approved_by: d.approvedBy,
    approval_date: new Date().toISOString(),
  };
  if (d.workOrderId) patch.work_order_id = d.workOrderId;
  if (d.rejectionReason) patch.rejection_reason = d.rejectionReason;
  if (d.dueDate) patch.due_date = d.dueDate;
  const { data, error } = await supabase
    .from('maintenance_requests')
    .update(patch)
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Modification refusée ou demande introuvable.');
}

/** Enregistre ou efface le motif d'une demande rejetée/annulée (is_manager). Ne touche ni au statut ni à la décision. */
export async function updateRequestRejectionReason(id: string, reason: string): Promise<void> {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .update({ rejection_reason: reason.trim() || null })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Modification refusée ou demande introuvable.');
}

/**
 * Import Coswin (option B) : INSERT ... ON CONFLICT (code) DO NOTHING par lots de 200. Une demande déjà présente
 * n'est jamais modifiée. Droits : INSERT si requested_by = auth.uid() (le responsable qui importe).
 */
export async function importMaintenanceRequests(rows: RequestInsertRow[], userId: string): Promise<void> {
  const importedAt = new Date().toISOString();
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200).map(r => ({ ...r, requested_by: userId, imported_at: importedAt }));
    const { error } = await supabase.from('maintenance_requests').upsert(batch, { onConflict: 'code', ignoreDuplicates: true });
    if (error) throw error;
  }
}

export interface SyncChangeDetail { code: string; champ: string; ancienne: string | null; nouvelle: string | null }
export interface SyncResult {
  lot: string; applique: boolean; lignes_recues: number; absentes_en_base: number; di_modifiees: number; champs_modifies: number;
  statuts_modifies: number; en_attente_resolues: number; regressions_vers_en_attente: number; statuts_proteges_decision_locale: number;
  detail_300_premiers: SyncChangeDetail[];
}

/**
 * Synchronisation Coswin des DI EXISTANTES (fonction SQL réservée au responsable, une seule transaction).
 * apply = false : aperçu chiffré sans aucune écriture ; apply = true : écrit + historique des modifications.
 */
export async function syncMaintenanceRequests(payload: Record<string, string | null>[], batchId: string, apply: boolean): Promise<SyncResult> {
  const { data, error } = await supabase.rpc('sync_maintenance_requests', { p_rows: payload, p_batch_id: batchId, p_apply: apply });
  if (error) throw error;
  return data as SyncResult;
}
