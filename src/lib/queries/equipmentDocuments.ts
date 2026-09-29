import { supabase } from '../supabaseClient';
import type { EquipmentDocument, EquipmentDocumentCategory } from '../../types';

// ---------------------------------------------------------------------------
// Table `equipment_documents` (créée le 28/09/2026, carnet de santé Phase 2).
// Une ligne = un fichier stocké dans le bucket privé `equipment-files`
// (chemin equipment/{equipmentId}/...). RLS : lecture ouverte aux authentifiés,
// INSERT/UPDATE/DELETE réservés à is_manager().
// Ce module ne gère QUE les lignes : l'upload/suppression du fichier dans le
// bucket relève de la Phase 5 (supprimer une ligne ici laisse le fichier).
// ---------------------------------------------------------------------------

interface EquipmentDocumentRow {
  id: string;
  equipment_id: string;
  name: string;
  category: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

function rowToDocument(row: EquipmentDocumentRow): EquipmentDocument {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    name: row.name,
    category: (row.category ?? undefined) as EquipmentDocumentCategory | undefined,
    storagePath: row.storage_path,
    mimeType: row.mime_type ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

/** Documents d'un équipement, les plus récents d'abord. */
export async function fetchEquipmentDocuments(equipmentId: string): Promise<EquipmentDocument[]> {
  const { data, error } = await supabase
    .from('equipment_documents')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as EquipmentDocumentRow[]) || []).map(rowToDocument);
}

/** Enregistre un document (le fichier doit déjà être dans le bucket). Réservé aux managers. */
export async function createEquipmentDocument(
  input: {
    equipmentId: string;
    name: string;
    storagePath: string;
    category?: EquipmentDocumentCategory;
    mimeType?: string;
    sizeBytes?: number;
  },
  createdBy: string
): Promise<EquipmentDocument> {
  const { data, error } = await supabase
    .from('equipment_documents')
    .insert({
      equipment_id: input.equipmentId,
      name: input.name,
      storage_path: input.storagePath,
      category: input.category ?? null,
      mime_type: input.mimeType ?? null,
      size_bytes: input.sizeBytes ?? null,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToDocument(data as EquipmentDocumentRow);
}

/** Renomme / recatégorise un document. Réservé aux managers. */
export async function updateEquipmentDocument(
  id: string,
  patch: Partial<{ name: string; category: EquipmentDocumentCategory | null }>
): Promise<EquipmentDocument> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.category !== undefined) row.category = patch.category;
  const { data, error } = await supabase
    .from('equipment_documents')
    .update(row)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToDocument(data as EquipmentDocumentRow);
}

/**
 * Supprime la ligne d'un document. Réservé aux managers : pour un autre rôle,
 * la RLS ne renvoie pas d'erreur mais aucune ligne — on la détecte ici.
 */
export async function deleteEquipmentDocument(id: string): Promise<void> {
  const { data, error } = await supabase.from('equipment_documents').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Suppression refusée ou document introuvable.');
}
