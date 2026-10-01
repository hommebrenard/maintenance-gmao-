import { supabase } from './supabaseClient';

// Stockage Supabase (étape 5b, 30/09/2026).
// - `equipment-files` : bucket PRIVÉ (comptes rendus, documents) -> accès par liens signés de courte durée.
// - `equipment-photos` : bucket PUBLIC (photos d'équipements) -> lien permanent stocké dans equipment.photo_url.
// Écriture réservée aux managers (policies RLS du stockage).

export const DOCS_BUCKET = 'equipment-files';
export const PHOTOS_BUCKET = 'equipment-photos';

/** Envoie un fichier dans le bucket privé. Chemin = equipment/{equipmentId}/{uuid}.{ext} (jamais le nom d'origine). */
export async function uploadDocumentFile(equipmentId: string, blob: Blob, ext: string, contentType: string): Promise<string> {
  const path = `equipment/${equipmentId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

/** Retire un fichier qu'on vient d'envoyer quand l'enregistrement de sa ligne a échoué (jamais un fichier existant). */
export async function removeDocumentFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(DOCS_BUCKET).remove([path]);
  if (error) throw error;
}

/** Lien signé de courte durée (secondes) pour ouvrir un fichier du bucket privé. */
export async function getDocumentSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Lien d'accès au document indisponible.");
  return data.signedUrl;
}

/**
 * Envoie la photo d'un équipement (une seule par équipement : remplace la précédente) et renvoie son lien public.
 * `?v=` change à chaque envoi pour contourner le cache du navigateur.
 */
export async function uploadEquipmentPhoto(equipmentId: string, blob: Blob): Promise<string> {
  const path = `${equipmentId}/photo.jpg`;
  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
