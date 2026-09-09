import { supabase } from '../supabaseClient';
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority, WorkOrderType } from '../../types';

// ---------------------------------------------------------------------------
// Basé sur le schéma RÉEL de `work_orders` (confirmé le 08/09/2026).
//
// PÉRIMÈTRE VOLONTAIREMENT LIMITÉ aux champs "cœur" décidé avec l'utilisateur :
// id, code, title, description, status, priority, type, equipmentId/Code/Name,
// location, assignee, dueDate, createdAt, updatedAt.
//
// RESTENT EN localStorage POUR L'INSTANT (pas de mapping fiable en base sans
// clarification supplémentaire — à faire dans une prochaine session dédiée) :
// - `tasks` (checklist avec completed/comment/isAnomaly) : `work_order_procedures`
//   existe mais sa structure (procedure_id + step_results jsonb + is_completed
//   global) ne correspond pas clairement à une checklist item par item.
// - `intervenantsLogs` ({id, name, timeSpent}) : `work_order_history` existe
//   mais c'est un journal d'audit générique (action/old_value/new_value), pas
//   une liste d'intervenants avec temps passé.
// - `planner`, `planNumber`, `interventionCode`, `entity`, `visa` : aucun
//   équivalent en base.
// - `startDate`/`startTime`/`endDate`/`endTime` : la base a `scheduled_start`/
//   `actual_start`/`actual_end` (timestamptz combinés), pas de mapping direct
//   décidé pour l'instant.
//
// Mapping enum validé avec l'utilisateur (voir cadrage) :
//   work_order_status   : ouvert/en_cours/en_attente/termine/annule
//                          <-> Ouvert/En cours/En attente/Terminé/Annulé
//   work_order_priority : basse/moyenne/haute/urgente
//                          <-> Faible/Moyenne/Élevée/Urgente
//   work_order_type     : corrective/preventive/amelioration/inspection
//                          <-> Corrective/Préventive/Amélioration/Inspection
//
// Jointures : equipment_id -> equipment(code,name), location_id -> locations(name),
// assigned_to -> profiles(full_name). Attention : `work_orders` a DEUX colonnes
// uuid vers `profiles` (assigned_to ET created_by) — le hint `!assigned_to`
// dans le select ci-dessous sert à désambiguïser la jointure. À vérifier au
// premier test que Supabase ne renvoie pas une erreur d'ambiguïté malgré tout
// (auquel cas il faudra utiliser le nom exact de la contrainte FK à la place).
// ---------------------------------------------------------------------------

type WorkOrderStatusRow = 'ouvert' | 'en_cours' | 'en_attente' | 'termine' | 'annule';
type WorkOrderPriorityRow = 'basse' | 'moyenne' | 'haute' | 'urgente';
type WorkOrderTypeRow = 'corrective' | 'preventive' | 'amelioration' | 'inspection';

interface WorkOrderRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: WorkOrderTypeRow;
  priority: WorkOrderPriorityRow;
  status: WorkOrderStatusRow;
  equipment_id: string | null;
  location_id: string | null;
  due_date: string;
  created_at: string;
  updated_at: string;
  equipment: { code: string; name: string } | null;
  locations: { name: string } | null;
  profiles: { full_name: string } | null; // via hint !assigned_to
}

const STATUS_ROW_TO_APP: Record<WorkOrderStatusRow, WorkOrderStatus> = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  en_attente: 'En attente',
  termine: 'Terminé',
  annule: 'Annulé',
};
const STATUS_APP_TO_ROW: Record<WorkOrderStatus, WorkOrderStatusRow> = {
  Ouvert: 'ouvert',
  'En cours': 'en_cours',
  'En attente': 'en_attente',
  Terminé: 'termine',
  Annulé: 'annule',
};

const PRIORITY_ROW_TO_APP: Record<WorkOrderPriorityRow, WorkOrderPriority> = {
  basse: 'Faible',
  moyenne: 'Moyenne',
  haute: 'Élevée',
  urgente: 'Urgente',
};
const PRIORITY_APP_TO_ROW: Record<WorkOrderPriority, WorkOrderPriorityRow> = {
  Faible: 'basse',
  Moyenne: 'moyenne',
  Élevée: 'haute',
  Urgente: 'urgente',
};

const TYPE_ROW_TO_APP: Record<WorkOrderTypeRow, WorkOrderType> = {
  corrective: 'Corrective',
  preventive: 'Préventive',
  amelioration: 'Amélioration',
  inspection: 'Inspection',
};
const TYPE_APP_TO_ROW: Record<WorkOrderType, WorkOrderTypeRow> = {
  Corrective: 'corrective',
  Préventive: 'preventive',
  Amélioration: 'amelioration',
  Inspection: 'inspection',
};

function rowToWorkOrder(row: WorkOrderRow): WorkOrder {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description ?? '',
    status: STATUS_ROW_TO_APP[row.status],
    priority: PRIORITY_ROW_TO_APP[row.priority],
    type: TYPE_ROW_TO_APP[row.type],
    equipmentId: row.equipment_id ?? undefined,
    equipmentCode: row.equipment?.code,
    equipmentName: row.equipment?.name,
    location: row.locations?.name ?? '',
    assignee: row.profiles?.full_name ?? '',
       dueDate: row.due_date ? row.due_date.slice(0, 10) : row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Récupère tous les ordres de travail, champs cœur uniquement. */
export async function fetchWorkOrders(): Promise<WorkOrder[]> {
  const { data, error } = await supabase
    .from('work_orders')
    .select('*, equipment(code,name), locations(name), profiles!assigned_to(full_name)')
    .order('due_date', { ascending: false });

  if (error) throw error;
  return (data as unknown as WorkOrderRow[]).map(rowToWorkOrder);
}

// ---------------------------------------------------------------------------
// Écritures — champs cœur uniquement (voir note en tête de fichier).
// ---------------------------------------------------------------------------

interface WorkOrderWritableRow {
  code?: string;
  title?: string;
  description?: string;
  type?: WorkOrderTypeRow;
  priority?: WorkOrderPriorityRow;
  status?: WorkOrderStatusRow;
  equipment_id?: string;
  location_id?: string;
  due_date?: string;
}

function workOrderToRow(wo: Partial<WorkOrder>): WorkOrderWritableRow {
  const row: WorkOrderWritableRow = {};
  if (wo.code !== undefined) row.code = wo.code;
  if (wo.title !== undefined) row.title = wo.title;
  if (wo.description !== undefined) row.description = wo.description;
  if (wo.type !== undefined) row.type = TYPE_APP_TO_ROW[wo.type];
  if (wo.priority !== undefined) row.priority = PRIORITY_APP_TO_ROW[wo.priority];
  if (wo.status !== undefined) row.status = STATUS_APP_TO_ROW[wo.status];
  if (wo.equipmentId !== undefined) row.equipment_id = wo.equipmentId;
  if (wo.dueDate !== undefined) row.due_date = wo.dueDate;
  return row;
}

/**
 * Crée un nouvel OT (champs cœur uniquement — voir note en tête de fichier :
 * tasks/intervenantsLogs/visa/planner/etc. ne sont PAS envoyés à Supabase et
 * restent gérés côté app via le stockage `localStorage` séparé prévu pour ces
 * champs). `code` doit être fourni par l'appelant.
 */
export async function createWorkOrder(wo: Partial<WorkOrder> & { code: string; title: string; dueDate: string }, createdBy: string): Promise<WorkOrder> {
  const { data, error } = await supabase
  .from('work_orders')
  .insert({ ...workOrderToRow(wo), created_by: createdBy }) 
  .select('*, equipment(code,name), locations(name), profiles!assigned_to(full_name)')
  .single();

  if (error) throw error;
  return rowToWorkOrder(data as unknown as WorkOrderRow);
}

/**
 * Crée plusieurs OT en une seule requête (utilisé par l'import CSV en masse
 * d'un planning). Mêmes limites que `createWorkOrder` : champs cœur uniquement.
 */
export async function createWorkOrdersBulk(items: (Partial<WorkOrder> & { code: string; title: string; dueDate: string })[]): Promise<WorkOrder[]> {
  if (items.length === 0) return [];
  const { data, error } = await supabase
    .from('work_orders')
    .insert(items.map(item => ({ ...workOrderToRow(item), created_by: createdBy })))
    .select('*, equipment(code,name), locations(name), profiles!assigned_to(full_name)');

  if (error) throw error;
  return (data as unknown as WorkOrderRow[]).map(rowToWorkOrder);
}

/**
 * Met à jour un OT existant (champs cœur uniquement, ex. changement de statut).
 * ATTENTION : la policy RLS `wo_update_assigned_or_manager` peut restreindre
 * qui a le droit de faire cette mise à jour (voir note en tête de fichier) —
 * à tester avec un compte non-manager avant de généraliser.
 */
export async function updateWorkOrder(id: string, patch: Partial<WorkOrder>): Promise<WorkOrder> {
  const { data, error } = await supabase
    .from('work_orders')
    .update(workOrderToRow(patch))
    .eq('id', id)
    .select('*, equipment(code,name), locations(name), profiles!assigned_to(full_name)')
    .single();

  if (error) throw error;
  return rowToWorkOrder(data as unknown as WorkOrderRow);
}

// ---------------------------------------------------------------------------
// Exemple d'intégration dans App.tsx (à adapter, ne remplace pas le code actuel) :
// Ajout created_by sur createWorkOrder/createWorkOrdersBulk
//   const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
//   const [isLoadingWorkOrders, setIsLoadingWorkOrders] = useState(true);
//
//   useEffect(() => {
//     fetchWorkOrders()
//       .then(setWorkOrders)
//       .catch(err => console.error('Erreur chargement OT:', err))
//       .finally(() => setIsLoadingWorkOrders(false));
//   }, []);
// ---------------------------------------------------------------------------
