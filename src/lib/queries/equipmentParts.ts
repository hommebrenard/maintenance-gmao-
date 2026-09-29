import { supabase } from '../supabaseClient';
import type { EquipmentPart } from '../../types';

// ---------------------------------------------------------------------------
// Table `equipment_parts` (créée le 28/09/2026, carnet de santé Phase 2) :
// pièces de rechange rattachées à UN équipement. Indépendante de `inventory`
// (InventoryView non touchée). RLS : lecture ouverte aux authentifiés,
// INSERT/UPDATE/DELETE réservés à is_manager().
// `stock` et `min_stock` sont NOT NULL (défaut 0) ; les autres champs sont
// optionnels (« non renseigné »).
// ---------------------------------------------------------------------------

interface EquipmentPartRow {
  id: string;
  equipment_id: string;
  code: string | null;
  name: string;
  reference: string | null;
  manufacturer: string | null;
  stock: number;
  min_stock: number;
  unit: string | null;
  unit_price: number | null;
  location: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

function rowToPart(row: EquipmentPartRow): EquipmentPart {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    code: row.code ?? undefined,
    name: row.name,
    reference: row.reference ?? undefined,
    manufacturer: row.manufacturer ?? undefined,
    stock: Number(row.stock),
    minStock: Number(row.min_stock),
    unit: row.unit ?? undefined,
    unitPrice: row.unit_price === null || row.unit_price === undefined ? undefined : Number(row.unit_price),
    location: row.location ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

export interface EquipmentPartInput {
  name: string;
  code?: string | null;
  reference?: string | null;
  manufacturer?: string | null;
  stock?: number;
  minStock?: number;
  unit?: string | null;
  unitPrice?: number | null;
  location?: string | null;
}

const emptyToNull = (v: string | null | undefined) => (v === '' || v === undefined ? null : v);

function inputToRow(input: Partial<EquipmentPartInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.code !== undefined) row.code = emptyToNull(input.code);
  if (input.reference !== undefined) row.reference = emptyToNull(input.reference);
  if (input.manufacturer !== undefined) row.manufacturer = emptyToNull(input.manufacturer);
  if (input.stock !== undefined) row.stock = input.stock;
  if (input.minStock !== undefined) row.min_stock = input.minStock;
  if (input.unit !== undefined) row.unit = emptyToNull(input.unit);
  if (input.unitPrice !== undefined) row.unit_price = input.unitPrice;
  if (input.location !== undefined) row.location = emptyToNull(input.location);
  return row;
}

/** Pièces d'un équipement, triées par nom. */
export async function fetchEquipmentParts(equipmentId: string): Promise<EquipmentPart[]> {
  const { data, error } = await supabase
    .from('equipment_parts')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('name', { ascending: true });
  if (error) throw error;
  return ((data as EquipmentPartRow[]) || []).map(rowToPart);
}

/** Ajoute une pièce à un équipement. Réservé aux managers. */
export async function createEquipmentPart(
  input: EquipmentPartInput & { equipmentId: string },
  createdBy: string
): Promise<EquipmentPart> {
  const { data, error } = await supabase
    .from('equipment_parts')
    .insert({ ...inputToRow(input), equipment_id: input.equipmentId, created_by: createdBy })
    .select('*')
    .single();
  if (error) throw error;
  return rowToPart(data as EquipmentPartRow);
}

/** Modifie une pièce (stock, seuil, prix...). Réservé aux managers. */
export async function updateEquipmentPart(id: string, patch: Partial<EquipmentPartInput>): Promise<EquipmentPart> {
  const { data, error } = await supabase
    .from('equipment_parts')
    .update({ ...inputToRow(patch), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToPart(data as EquipmentPartRow);
}

/** Supprime une pièce. Réservé aux managers (refus RLS détecté : voir equipmentDocuments.ts). */
export async function deleteEquipmentPart(id: string): Promise<void> {
  const { data, error } = await supabase.from('equipment_parts').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Suppression refusée ou pièce introuvable.');
}
