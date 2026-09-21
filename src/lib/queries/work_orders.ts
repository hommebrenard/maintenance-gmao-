import { supabase } from '../supabaseClient';
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority, WorkOrderType } from '../../types';
import {
  extrasToRow,
  rowToExtras,
  identityToRow,
  rowToIdentity,
  type WorkOrderExtrasRow,
  type WorkOrderIdentityRow,
  type WorkOrderIdentityWrite,
} from '../../utils/workOrderExtras';

// ---------------------------------------------------------------------------
// Basé sur le schéma RÉEL de `work_orders` (confirmé le 08/09/2026).
//
// PÉRIMÈTRE VOLONTAIREMENT LIMITÉ aux champs "cœur" décidé avec l'utilisateur :
// id, code, title, description, status, priority, type, equipmentId/Code/Name,
// location, assignee, dueDate, createdAt, updatedAt.
//
// ENREGISTRÉS EN BASE DEPUIS LE 20/09/2026 (colonnes ajoutées à `work_orders`,
// voir src/utils/workOrderExtras.ts) : `tasks` (jsonb, checklist avec
// completed/comment/isAnomaly), `intervenants_logs` (jsonb), `visa`,
// `start_date`/`end_date` (date), `start_time`/`end_time` (text 'HH:MM').
// L'import en masse (createWorkOrdersBulk) n'écrit PAS ces colonnes : la
// checklist d'un OT importé se recalcule à l'affichage depuis la Gamme.
//
// ENREGISTRÉS EN BASE DEPUIS LE 21/09/2026 : `interventionCode`
// (`intervention_code`), `planNumber` (`plan_number`), `entity` (`entity`), tous
// en text. Contrairement aux champs ci-dessus, l'import en masse LES écrit
// (valeurs vides non écrites : NULL = pas de valeur).
//
// RESTENT EN localStorage POUR L'INSTANT : rien d'autre que la copie de secours
// des champs ci-dessus (à retirer dans un pas de nettoyage ultérieur).
// - `planner` : colonne `text` ajoutée en base le 14/09/2026 — lu/écrit
//   réellement depuis cette date (n'est plus dépendant du localStorage/du
//   navigateur, voir WO_EXTRA_FIELDS dans App.tsx).
//   (Les anciennes colonnes `scheduled_start`/`actual_start`/`actual_end`
//   restent inutilisées : les 4 champs date/heure de l'app ont leurs propres
//   colonnes.)
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

interface WorkOrderRow extends WorkOrderExtrasRow, WorkOrderIdentityRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: WorkOrderTypeRow;
  priority: WorkOrderPriorityRow;
  status: WorkOrderStatusRow;
  equipment_id: string | null;
  location_id: string | null;
  planner: string | null;
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
    planner: row.planner ?? undefined,
    dueDate: row.due_date ? row.due_date.slice(0, 10) : row.due_date,
        createdAt: row.created_at ? new Date(row.created_at).toLocaleString('fr-FR') : row.created_at,
    updatedAt: row.updated_at ? new Date(row.updated_at).toLocaleString('fr-FR') : row.updated_at,
    // Checklist, intervenants, visa, dates/heures : NULL en base => absent.
    ...rowToExtras(row),
    // Code d'intervention, n° de plan, entité : NULL en base => absent.
    ...rowToIdentity(row),
  };
}

/** Récupère tous les ordres de travail (champs cœur + checklist/visa/temps). */
export async function fetchWorkOrders(): Promise<WorkOrder[]> {
  // Supabase/PostgREST plafonne à 1000 lignes par requête par défaut.
  // On paginate par lots de 1000 jusqu'à avoir tout récupéré.
  const PAGE_SIZE = 1000;
  const allRows: WorkOrderRow[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('work_orders')
      .select('*, equipment(code,name), locations(name), profiles!assigned_to(full_name)')
      .order('due_date', { ascending: false })
      .range(from, to);

    if (error) throw error;
    const rows = (data as unknown as WorkOrderRow[]) || [];
    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) break;
    page += 1;
  }

  return allRows.map(rowToWorkOrder);
}

/**
 * Vérifie, parmi une liste de codes d'OT (typiquement extraits d'un fichier
 * CSV avant import), lesquels existent déjà en base. Utilisé par la modale
 * d'import pour avertir l'utilisateur AVANT toute écriture, plutôt que de le
 * laisser découvrir le problème via l'erreur Postgres 23505 (contrainte
 * unique `work_orders_code_key`) rencontrée le 12/09/2026 lors d'un réimport.
 *
 * Découpe la requête par lots de 200 codes pour rester sous les limites de
 * longueur d'URL du filtre `.in()` de PostgREST sur les gros fichiers.
 */
export async function fetchExistingWorkOrderCodes(codes: string[]): Promise<Set<string>> {
  const uniqueCodes = Array.from(new Set(codes.filter((c): c is string => Boolean(c && c.trim()))));
  if (uniqueCodes.length === 0) return new Set();

  const CHUNK_SIZE = 200;
  const existing = new Set<string>();

  for (let i = 0; i < uniqueCodes.length; i += CHUNK_SIZE) {
    const chunk = uniqueCodes.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('work_orders')
      .select('code')
      .in('code', chunk);

    if (error) throw error;
    (data as { code: string }[] | null)?.forEach(row => existing.add(row.code));
  }

  return existing;
}

/**
 * Ajouté le 18/09/2026 — cause racine du cas OT-106146 (Meknès) : un
 * réimport avec un N° d'OT déjà en base était jusqu'ici entièrement ignoré
 * (voir fetchExistingWorkOrderCodes), même quand le fichier réimporté
 * apportait des champs que la version en base n'avait jamais eus (import
 * initial fait avant que le site source ait fini d'assigner
 * équipement/planificateur à cet OT).
 *
 * Cette fonction récupère, pour les codes déjà en base, uniquement les 3
 * champs cœur concernés (equipment_id/location_id/planner) + l'id, pour
 * permettre un complément CIBLÉ : ne combler que ce qui est vide, ne
 * jamais toucher un champ déjà renseigné (import précédent OU édition
 * manuelle via le formulaire — voir handleEditWorkOrder).
 */
export async function fetchExistingWorkOrdersCore(
  codes: string[]
): Promise<Map<string, { id: string; equipmentId?: string; locationId?: string; planner?: string }>> {
  const uniqueCodes = Array.from(new Set(codes.filter((c): c is string => Boolean(c && c.trim()))));
  const result = new Map<string, { id: string; equipmentId?: string; locationId?: string; planner?: string }>();
  if (uniqueCodes.length === 0) return result;

  const CHUNK_SIZE = 200;
  for (let i = 0; i < uniqueCodes.length; i += CHUNK_SIZE) {
    const chunk = uniqueCodes.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('work_orders')
      .select('id, code, equipment_id, location_id, planner')
      .in('code', chunk);

    if (error) throw error;
    (data as { id: string; code: string; equipment_id: string | null; location_id: string | null; planner: string | null }[] | null)?.forEach(row => {
      result.set(row.code, {
        id: row.id,
        equipmentId: row.equipment_id ?? undefined,
        locationId: row.location_id ?? undefined,
        planner: row.planner ?? undefined
      });
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Écritures — champs cœur uniquement (voir note en tête de fichier).
// ---------------------------------------------------------------------------

interface WorkOrderWritableRow extends WorkOrderIdentityWrite {
  code?: string;
  title?: string;
  description?: string;
  type?: WorkOrderTypeRow;
  priority?: WorkOrderPriorityRow;
  status?: WorkOrderStatusRow;
  equipment_id?: string;
  location_id?: string;
  planner?: string;
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
  if (wo.locationId !== undefined) row.location_id = wo.locationId;
  if (wo.planner !== undefined) row.planner = wo.planner;
  if (wo.dueDate !== undefined) row.due_date = wo.dueDate;
  // Code d'intervention / n° de plan / entité (depuis le 21/09/2026) : écrits
  // aussi par l'import en masse ; les valeurs vides ne sont pas écrites.
  return { ...row, ...identityToRow(wo) };
}

/**
 * Crée un nouvel OT (champs cœur + code d'intervention/n° de plan/entité +
 * checklist/intervenants/visa/dates-heures s'ils sont fournis). `code` doit être
 * fourni par l'appelant.
 */
export async function createWorkOrder(wo: Partial<WorkOrder> & { code: string; title: string; dueDate: string }, createdBy: string): Promise<WorkOrder> {
  const { data, error } = await supabase
  .from('work_orders')
  .insert({ ...workOrderToRow(wo), ...extrasToRow(wo), created_by: createdBy }) 
  .select('*, equipment(code,name), locations(name), profiles!assigned_to(full_name)')
  .single();

  if (error) throw error;
  return rowToWorkOrder(data as unknown as WorkOrderRow);
}

/**
 * Crée plusieurs OT en une seule requête (utilisé par l'import CSV en masse
 * d'un planning). Champs cœur + code d'intervention/n° de plan/entité : on
 * n'écrit volontairement PAS la checklist (`tasks`) copiée de la Gamme à
 * l'import, qui se recalcule à l'affichage et figerait sinon des rattachements
 * « à vérifier ».
 */
export async function createWorkOrdersBulk(items: (Partial<WorkOrder> & { code: string; title: string; dueDate: string })[], createdBy: string): Promise<WorkOrder[]> {
  if (items.length === 0) return [];
  const { data, error } = await supabase
    .from('work_orders')
    .insert(items.map(item => ({ ...workOrderToRow(item), created_by: createdBy })))
    .select('*, equipment(code,name), locations(name), profiles!assigned_to(full_name)');

  if (error) throw error;
  return (data as unknown as WorkOrderRow[]).map(rowToWorkOrder);
}

/**
 * Met à jour un OT existant (champs cœur + checklist/intervenants/visa/dates-heures
 * présents dans le patch ; un champ absent du patch n'est jamais effacé).
 * ATTENTION : la policy RLS `wo_update_assigned_or_manager` peut restreindre
 * qui a le droit de faire cette mise à jour (voir note en tête de fichier) —
 * à tester avec un compte non-manager avant de généraliser.
 */
export async function updateWorkOrder(id: string, patch: Partial<WorkOrder>): Promise<WorkOrder> {
  const { data, error } = await supabase
    .from('work_orders')
    .update({ ...workOrderToRow(patch), ...extrasToRow(patch) })
    .eq('id', id)
    .select('*, equipment(code,name), locations(name), profiles!assigned_to(full_name)')
    .single();

  if (error) throw error;
  return rowToWorkOrder(data as unknown as WorkOrderRow);
}

/**
 * Rattrapage ponctuel (21/09/2026) de `intervention_code`, `plan_number` et
 * `entity` pour un OT importé avant l'existence de ces colonnes : la valeur ne
 * vit que dans le localStorage d'un navigateur. Volontairement léger (pas de
 * jointures en retour) car appelé pour des centaines d'OT, et JAMAIS en
 * écrasement : chaque colonne envoyée doit encore être NULL en base au moment
 * de l'écriture (`.is(col, null)`) — si un autre poste l'a renseignée entre-temps,
 * la ligne est laissée telle quelle. Renvoie false s'il n'y avait rien à envoyer.
 */
export async function backfillWorkOrderIdentity(id: string, patch: Partial<WorkOrder>): Promise<boolean> {
  const row = identityToRow(patch);
  const columns = Object.keys(row);
  if (columns.length === 0) return false;

  let query = supabase.from('work_orders').update(row).eq('id', id);
  for (const column of columns) query = query.is(column, null);

  const { error } = await query;
  if (error) throw error;
  return true;
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
