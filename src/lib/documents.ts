import type { EquipmentDocument, EquipmentDocumentCategory } from '../types';
import { createEquipmentDocument } from './queries/equipmentDocuments';
import { getDocumentSignedUrl, removeDocumentFile, uploadDocumentFile } from './storage';
import { compressImage } from '../utils/imageCompress';
import { DOC_MAX_BYTES, extensionFor, isImageType, nameWithoutExtension, resolveMime, validateDocumentFile } from '../utils/fileUpload';
import { isHttpUrl } from '../utils/scheduleControls';

export interface AddDocumentInput {
  equipmentId: string;
  createdBy: string;
  /** Intitulé ; à défaut, le nom du fichier sans extension. */
  name?: string;
  category?: EquipmentDocumentCategory;
  /** Contrôle réalisé auquel rattacher le document (compte rendu). */
  controlId?: string;
  file?: File | null;
  /** Lien GED (http/https), à la place ou en plus du fichier. */
  externalUrl?: string | null;
}

/**
 * Ajoute un document : fichier (envoyé d'abord, puis ligne enregistrée) et/ou lien GED.
 * Si l'enregistrement de la ligne échoue, le fichier qu'on vient d'envoyer est retiré (pas d'orphelin).
 * `warning` : le fichier est bien enregistré mais pas le lien (l'utilisateur peut le rajouter).
 */
export async function addEquipmentDocuments(input: AddDocumentInput): Promise<{ docs: EquipmentDocument[]; warning?: string }> {
  const { equipmentId, createdBy, file, externalUrl, category, controlId } = input;
  if (!file && !externalUrl) throw new Error('Choisissez un fichier ou indiquez un lien.');
  if (externalUrl && !isHttpUrl(externalUrl)) throw new Error('Lien : adresse http:// ou https:// attendue.');
  const baseName = input.name?.trim() || (file ? nameWithoutExtension(file.name) : '');
  if (!baseName) throw new Error('Indiquez un intitulé.');

  const docs: EquipmentDocument[] = [];
  let warning: string | undefined;

  if (file) {
    const invalid = validateDocumentFile(file);
    if (invalid) throw new Error(invalid);
    let blob: Blob = file;
    let mime = resolveMime(file);
    if (isImageType(mime)) {
      blob = await compressImage(file, { maxEdge: 2000, quality: 0.8 });
      mime = 'image/jpeg';
      if (blob.size > DOC_MAX_BYTES) throw new Error('Image trop volumineuse même après réduction.');
    }
    const path = await uploadDocumentFile(equipmentId, blob, extensionFor(mime), mime);
    try {
      docs.push(
        await createEquipmentDocument(
          { equipmentId, name: baseName, storagePath: path, mimeType: mime, sizeBytes: blob.size, category, controlId },
          createdBy
        )
      );
    } catch (err) {
      await removeDocumentFile(path).catch(() => undefined);
      throw err;
    }
  }

  if (externalUrl) {
    try {
      docs.push(
        await createEquipmentDocument(
          { equipmentId, name: file ? `${baseName} (lien GED)` : baseName, externalUrl, category, controlId },
          createdBy
        )
      );
    } catch (err) {
      if (docs.length === 0) throw err;
      warning = `Le fichier est enregistré, mais pas le lien GED (${err instanceof Error ? err.message : 'erreur'}). Vous pouvez le rajouter.`;
    }
  }
  return { docs, warning };
}

/** Ouvre un document dans un nouvel onglet : lien signé de courte durée pour un fichier, lien direct pour la GED. */
export async function openEquipmentDocument(doc: EquipmentDocument): Promise<void> {
  if (doc.storagePath) {
    // Onglet ouvert tout de suite (geste de l'utilisateur), adresse renseignée ensuite : évite le blocage des popups.
    const tab = window.open('', '_blank');
    try {
      const url = await getDocumentSignedUrl(doc.storagePath);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (err) {
      tab?.close();
      throw err;
    }
  } else if (doc.externalUrl && isHttpUrl(doc.externalUrl)) {
    window.open(doc.externalUrl, '_blank', 'noopener,noreferrer');
  }
}
