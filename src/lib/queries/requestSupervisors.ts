import { supabase } from '../supabaseClient';

/** Liste des superviseurs proposés dans le formulaire de demande : alimentée par les managers. */
export interface Supervisor { id: string; name: string; active: boolean }

interface Row { id: string; name: string; active: boolean }
const toSupervisor = (r: Row): Supervisor => ({ id: r.id, name: r.name, active: r.active });

export async function fetchSupervisors(): Promise<Supervisor[]> {
  const { data, error } = await supabase.from('request_supervisors').select('*').order('name');
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toSupervisor);
}

export async function addSupervisor(name: string): Promise<Supervisor> {
  const { data, error } = await supabase.from('request_supervisors').insert({ name: name.trim() }).select('*').single();
  if (error) throw error;
  return toSupervisor(data as Row);
}

export async function setSupervisorActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('request_supervisors').update({ active }).eq('id', id);
  if (error) throw error;
}
