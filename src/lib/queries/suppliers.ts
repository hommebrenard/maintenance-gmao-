import { supabase } from '../supabaseClient';

// Table Supabase `suppliers` (id, name, ..., is_active). Distincte de la page « Fournisseurs »
// de l'app (gardée dans le navigateur) : ici, seulement la liste proposée sur la fiche équipement.

export interface SupplierOption {
  id: string;
  name: string;
}

/** Fournisseurs actifs (is_active non faux), par ordre alphabétique. */
export async function fetchSupplierOptions(): Promise<SupplierOption[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name')
    .neq('is_active', false)
    .order('name');
  if (error) throw error;
  return ((data as { id: string; name: string }[]) || []).filter(s => s.name);
}

/** Crée un fournisseur (nom seul). Soumis à la RLS : un refus remonte comme erreur. */
export async function createSupplierByName(name: string, createdBy?: string): Promise<SupplierOption> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ name: name.trim(), ...(createdBy ? { created_by: createdBy } : {}) })
    .select('id, name')
    .single();
  if (error) throw error;
  return data as SupplierOption;
}
