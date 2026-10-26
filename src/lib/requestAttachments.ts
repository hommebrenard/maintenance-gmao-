import { createRequestAttachment } from './queries/requestAttachments';
import { removeRequestFile, uploadRequestFile } from './storage';
import { compressImage } from '../utils/imageCompress';
import { extensionFor, isImageType, resolveMime } from '../utils/fileUpload';
import {
  REQUEST_FILE_MAX_BYTES, REQUEST_IMAGE_MAX_EDGE, REQUEST_IMAGE_QUALITY, storedMimeFor, validateRequestFile,
} from '../utils/requestAttachments';

export interface AttachmentFailure { name: string; message: string }
export interface AttachmentsResult { saved: number; failures: AttachmentFailure[] }

const messageOf = (err: unknown): string => {
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m ? m : 'erreur inconnue';
};

/**
 * Envoie les pièces jointes d'une demande DÉJÀ créée, un fichier à la fois : réduction des photos (1 280 px),
 * envoi dans le bucket, puis ligne en base ; si la ligne échoue, le fichier qu'on vient d'envoyer est retiré.
 * Un échec ne bloque pas les autres fichiers et n'annule jamais la demande : il est renvoyé dans `failures`.
 */
export async function addRequestAttachments(requestId: string, files: File[]): Promise<AttachmentsResult> {
  const failures: AttachmentFailure[] = [];
  let saved = 0;
  for (const file of files) {
    try {
      const invalid = validateRequestFile(file);
      if (invalid) throw new Error(invalid);
      const mime = storedMimeFor(resolveMime(file));
      let blob: Blob = file;
      if (isImageType(resolveMime(file))) {
        blob = await compressImage(file, { maxEdge: REQUEST_IMAGE_MAX_EDGE, quality: REQUEST_IMAGE_QUALITY });
      }
      if (blob.size > REQUEST_FILE_MAX_BYTES) throw new Error('Fichier trop volumineux (maximum 5 Mo).');
      const path = await uploadRequestFile(requestId, blob, extensionFor(mime), mime);
      try {
        await createRequestAttachment({
          requestId, storagePath: path, displayName: file.name.slice(0, 120) || 'fichier', mimeType: mime, sizeBytes: blob.size,
        });
        saved += 1;
      } catch (err) {
        await removeRequestFile(path).catch(() => undefined);
        throw err;
      }
    } catch (err) {
      failures.push({ name: file.name, message: messageOf(err) });
    }
  }
  return { saved, failures };
}
