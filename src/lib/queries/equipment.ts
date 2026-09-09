import { supabase } from '../supabaseClient';
import type { Equipment, OperationalStatus, EquipmentCriticality } from '../../types';

// ---------------------------------------------------------------------------
// Basé sur le schéma RÉEL de la table `equipment` (confirmé le 08/09/2026 via
// information_schema + pg_enum, table encore vide en production).
//
// Écarts connus avec le type app `Equipment` (voir cadrage) :
// - `location` / `supplier` sont des UUID (FK) en base, pas du texte libre.
//   On résout leur nom via une jointure Supabase (`locations(name)`,
//   `suppliers(name)`) directement dans le select, donc l'app continue de
//   recevoir des chaînes lisibles sans rien changer côté UI.
// - `status` est un enum Postgres (`equipment_status`) avec 4 valeurs
//   (operationnel / en_panne / en_maintenance / hors_service) alors que
//   l'app n'en a que 3. Mapping validé avec l'utilisateur :
//     operationnel   -> 'En service'
//     en_maintenance -> 'Arrêt planifié'
//     en_panne       -> 'Arrêt non planifié'
//     hors_service   -> 'Arrêt non planifié'
//   Attention : ce mapping est à sens unique pour la lecture. À l'écriture,
//   'Arrêt non planifié' est traduit par défaut en `hors_service` (voir
//   `statusAppToRow`) — si l'app doit un jour distinguer en_panne de
//   hors_service, il faudra étendre le type app en conséquence.
// - Pas de colonne `manufacturer` en base : la colonne la plus proche est
//   `brand`, utilisée ici comme équivalent (à confirmer si besoin).
// - `criticality` est un simple `text` libre en base (pas un enum) : aucune
//   valeur imposée, les 4 valeurs de l'app passent telles quelles.
// - `workOrdersCount` n'est pas une colonne stockée : renvoyé à 0 pour
//   l'instant (nécessitera une requête agrégée séparée si affiché quelque
//   part de critique).
//
// Étape actuelle : LECTURE SEULE (fetchEquipment). Les fonctions d'écriture
// sont fournies mais ne gèrent PAS encore la résolution location/supplier
// (elles écrivent uniquement les champs qui ont un équivalent direct) —
// à finaliser une fois la lecture validée en prod, comme prévu dans l'ordre
// de mise en œuvre du cadrage.
// ---------------------------------------------------------------------------

type EquipmentStatusRow = 'operationnel' | 'en_panne' | 'en_maintenance' | 'hors_service';

// Forme brute d'une ligne de la table Supabase `equipment`, avec les
// jointures locations/suppliers demandées dans le select.
interface EquipmentRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  location_id: string | null;
  supplier_id: string | null;
  status: EquipmentStatusRow;
  criticality: string | null;
  created_at: string;
  updated_at: string;
  locations: { name: string } | null;
  suppliers: { name: string } | null;
}

function statusRowToApp(status: EquipmentStatusRow): OperationalStatus {
  switch (status) {
    case 'operationnel':
      return 'En service';
    case 'en_maintenance':
      return 'Arrêt planifié';
    case 'en_panne':
    case 'hors_service':
      return 'Arrêt non planifié';
  }
}

function statusAppToRow(status: OperationalStatus): EquipmentStatusRow {
  switch (status) {
    case 'En service':
      return 'operationnel';
    case 'Arrêt planifié':
      return 'en_maintenance';
    case 'Arrêt non planifié':
      // Choix par défaut (voir note en tête de fichier) : pas de distinction
      // panne / hors service côté app pour l'instant.
      return 'hors_service';
  }
}

// Conversion ligne Supabase (+ jointures) -> type applicatif (camelCase).
function rowToEquipment(row: EquipmentRow, workOrdersCount = 0): Equipment {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: statusRowToApp(row.status),
    criticality: (row.criticality ?? 'Normal') as EquipmentCriticality,
    location: row.locations?.name ?? '',
    supplier: row.suppliers?.name ?? '',
    manufacturer: row.brand ?? '',
    model: row.model ?? '',
    serialNumber: row.serial_number ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    description: row.description ?? '',
    workOrdersCount,
  };
}

/** Récupère tous les équipements, avec le nom d'emplacement et de fournisseur déjà résolus. */
export async function fetchEquipment(): Promise<Equipment[]> {
  const { data, error } = await supabase
    .from('equipment')
    .select('*, locations(name), suppliers(name)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as EquipmentRow[]).map(row => rowToEquipment(row));
}

// ---------------------------------------------------------------------------
// Écritures — champs directs uniquement pour l'instant (voir note en tête de
// fichier : location_id/supplier_id pas encore résolus depuis un nom texte).
// ---------------------------------------------------------------------------

interface EquipmentWritableRow {
  code?: string;
  name?: string;
  description?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  status?: EquipmentStatusRow;
  criticality?: string;
}

function equipmentToRow(eq: Partial<Equipment>): EquipmentWritableRow {
  const row: EquipmentWritableRow = {};
  if (eq.code !== undefined) row.code = eq.code;
  if (eq.name !== undefined) row.name = eq.name;
  if (eq.description !== undefined) row.description = eq.description;
  if (eq.manufacturer !== undefined) row.brand = eq.manufacturer;
  if (eq.model !== undefined) row.model = eq.model;
  if (eq.serialNumber !== undefined) row.serial_number = eq.serialNumber;
  if (eq.status !== undefined) row.status = statusAppToRow(eq.status);
  if (eq.criticality !== undefined) row.criticality = eq.criticality;
  return row;
}

/**
 * Crée un nouvel équipement (champs directs uniquement, pas location/supplier
 * pour l'instant — voir note en tête de fichier). `code` doit être fourni par
 * l'appelant (l'app génère déjà ses propres codes lisibles).
 */
export async function createEquipment(eq: Partial<Equipment> & { code: string; name: string }): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipment')
    .insert(equipmentToRow(eq))
    .select('*, locations(name), suppliers(name)')
    .single();

  if (error) throw error;
  return rowToEquipment(data as unknown as EquipmentRow);
}

/**
 * Crée plusieurs équipements en une seule requête (utilisé par l'import CSV en
 * masse — ex. auto-création des fiches équipement manquantes détectées dans un
 * planning importé). Retourne les lignes créées, dans l'ordre reçu par Supabase
 * (pas nécessairement l'ordre d'entrée).
 */
export async function createEquipmentBulk(items: (Partial<Equipment> & { code: string; name: string })[]): Promise<Equipment[]> {
  if (items.length === 0) return [];
  const { data, error } = await supabase
    .from('equipment')
    .insert(items.map(equipmentToRow))
    .select('*, locations(name), suppliers(name)');

  if (error) throw error;
  return (data as unknown as EquipmentRow[]).map(row => rowToEquipment(row));
}

/** Met à jour un équipement existant (champs directs uniquement, pas location/supplier). */
export async function updateEquipment(id: string, patch: Partial<Equipment>): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipment')
    .update(equipmentToRow(patch))
    .eq('id', id)
    .select('*, locations(name), suppliers(name)')
    .single();

  if (error) throw error;
  return rowToEquipment(data as unknown as EquipmentRow);
}

/** Supprime un équipement. */
export async function deleteEquipment(id: string): Promise<void> {
  const { error } = await supabase.from('equipment').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Exemple d'intégration dans App.tsx (à adapter, ne remplace pas le code actuel) :
//
//   const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
//   const [isLoadingEquipment, setIsLoadingEquipment] = useState(true);
//
//   useEffect(() => {
//     fetchEquipment()
//       .then(setEquipmentList)
//       .catch(err => console.error('Erreur chargement équipements:', err))
//       .finally(() => setIsLoadingEquipment(false));
//   }, []);
// ---------------------------------------------------------------------------
