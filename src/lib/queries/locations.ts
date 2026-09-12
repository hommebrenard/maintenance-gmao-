import { supabase } from '../supabaseClient';

/**
 * Retourne une correspondance code Zone -> id de `locations`, en ignorant les
 * lignes dont `code` est vide/NULL (sites pas encore configurés).
 */
export async function fetchLocationCodeMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, code')
    .not('code', 'is', null);

  if (error) throw error;

  const map = new Map<string, string>();
  (data as { id: string; code: string | null }[] | null || []).forEach(row => {
    if (row.code) map.set(row.code, row.id);
  });
  return map;
}
