import { supabase } from '../supabaseClient';

// Table Supabase `suppliers` : source unique des fournisseurs (page « Fournisseurs » ET liste
// proposée sur la fiche équipement). Lecture : tout utilisateur connecté ; écriture : is_manager().

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

export interface SupplierRecord {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
  isActive: boolean;
}

export interface SupplierInput {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
}

const COLS = 'id, name, contact_name, email, phone, notes, is_active';

function rowToRecord(r: any): SupplierRecord {
  return {
    id: r.id,
    name: r.name ?? '',
    contactName: r.contact_name ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    notes: r.notes ?? '',
    isActive: r.is_active !== false,
  };
}

const nullIfEmpty = (v: string) => (v.trim() === '' ? null : v.trim());

function inputToRow(i: SupplierInput) {
  return {
    name: i.name.trim(),
    contact_name: nullIfEmpty(i.contactName),
    email: nullIfEmpty(i.email),
    phone: nullIfEmpty(i.phone),
    notes: nullIfEmpty(i.notes),
  };
}

/** Tous les fournisseurs (actifs et désactivés), par ordre alphabétique. */
export async function fetchSuppliers(): Promise<SupplierRecord[]> {
  const { data, error } = await supabase.from('suppliers').select(COLS).order('name');
  if (error) throw error;
  return ((data as any[]) || []).map(rowToRecord);
}

export async function createSupplier(input: SupplierInput, createdBy?: string): Promise<SupplierRecord> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...inputToRow(input), ...(createdBy ? { created_by: createdBy } : {}) })
    .select(COLS)
    .single();
  if (error) throw error;
  return rowToRecord(data);
}

export async function updateSupplier(id: string, input: SupplierInput): Promise<SupplierRecord> {
  const { data, error } = await supabase
    .from('suppliers')
    .update({ ...inputToRow(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLS)
    .single();
  if (error) throw error;
  return rowToRecord(data);
}

/** Désactive / réactive un fournisseur (jamais de suppression : il peut être lié à des équipements). */
export async function setSupplierActive(id: string, isActive: boolean): Promise<SupplierRecord> {
  const { data, error } = await supabase
    .from('suppliers')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLS)
    .single();
  if (error) throw error;
  return rowToRecord(data);
}
