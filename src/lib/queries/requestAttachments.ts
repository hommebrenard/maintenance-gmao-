import { supabase } from '../supabaseClient';

// Table `request_attachments` (sql/25) : une ligne = un fichier du bucket privé `request-files`.
// RLS : lecture = demandeur et managers ; insertion = demandeur (15 min après la création, 5 max) ; suppression = managers.

export interface RequestAttachment {
  id: string;
  requestId: string;
  storagePath: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface Row {
  id: string; request_id: string; storage_path: string; display_name: string;
  mime_type: string; size_bytes: number; created_at: string;
}

const rowTo = (r: Row): RequestAttachment => ({
  id: r.id, requestId: r.request_id, storagePath: r.storage_path, displayName: r.display_name,
  mimeType: r.mime_type, sizeBytes: r.size_bytes, createdAt: r.created_at,
});

export async function fetchRequestAttachments(requestId: string): Promise<RequestAttachment[]> {
  const { data, error } = await supabase
    .from('request_attachments').select('*').eq('request_id', requestId).order('created_at', { ascending: true });
  if (error) throw error;
  return ((data as Row[]) || []).map(rowTo);
}

export async function createRequestAttachment(input: {
  requestId: string; storagePath: string; displayName: string; mimeType: string; sizeBytes: number;
}): Promise<RequestAttachment> {
  const { data, error } = await supabase
    .from('request_attachments')
    .insert({
      request_id: input.requestId, storage_path: input.storagePath, display_name: input.displayName,
      mime_type: input.mimeType, size_bytes: input.sizeBytes,
    })
    .select('*').single();
  if (error) throw error;
  return rowTo(data as Row);
}
