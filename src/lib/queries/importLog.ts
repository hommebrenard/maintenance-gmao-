import { supabase } from '../supabaseClient';
import type { ImportLogEntry, ImportMeta } from '../../utils/importLog';

/** Enregistre une ligne du journal d'import (table `import_log`, script sql/15). Appelée sans bloquer l'import. */
export async function logImport(kind: string, meta: ImportMeta, rowsCreated: number, rowsPatched: number, userId: string): Promise<void> {
  const { error } = await supabase.from('import_log').insert({
    kind,
    created_by: userId,
    file_names: meta.fileNames,
    rows_in_files: meta.rowsInFiles,
    rows_new: meta.rowsNew,
    rows_created: rowsCreated,
    rows_patched: rowsPatched,
    rows_ignored: meta.rowsIgnored,
  });
  if (error) throw error;
}

export async function fetchImportLog(limit = 10): Promise<ImportLogEntry[]> {
  const { data, error } = await supabase
    .from('import_log')
    .select('id, created_at, kind, file_names, rows_in_files, rows_new, rows_created, rows_patched, rows_ignored')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ImportLogEntry[];
}
