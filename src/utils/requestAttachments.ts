// Règles pures des pièces jointes d'une demande (photos, PDF) : formats, tailles, nombre maximal.
import { isImageType, resolveMime } from './fileUpload';

export const REQUEST_FILES_MAX = 5;
export const REQUEST_FILE_MAX_BYTES = 5 * 1024 * 1024; // fichier stocké (PDF tel quel, photo après réduction)
export const REQUEST_IMAGE_RAW_MAX_BYTES = 30 * 1024 * 1024; // photo brute acceptée avant réduction
export const REQUEST_IMAGE_MAX_EDGE = 1280;
export const REQUEST_IMAGE_QUALITY = 0.72;

type FileLike = { name: string; type: string; size: number };

/** null si le fichier est acceptable ; sinon le message à afficher. */
export function validateRequestFile(file: FileLike): string | null {
  const mime = resolveMime(file);
  if (mime === 'application/pdf') {
    return file.size > REQUEST_FILE_MAX_BYTES ? 'PDF trop volumineux (maximum 5 Mo).' : null;
  }
  if (isImageType(mime)) {
    return file.size > REQUEST_IMAGE_RAW_MAX_BYTES ? 'Photo trop volumineuse (maximum 30 Mo).' : null;
  }
  return 'Format non pris en charge : photo (JPEG, PNG, WebP) ou PDF uniquement.';
}

/** Trie les fichiers choisis : acceptés (dans la limite de 5 au total, sans doublon) et messages de refus. */
export function pickRequestFiles<T extends FileLike>(current: T[], incoming: T[]): { accepted: T[]; rejected: string[] } {
  const accepted: T[] = [];
  const rejected: string[] = [];
  for (const file of incoming) {
    const invalid = validateRequestFile(file);
    if (invalid) { rejected.push(`${file.name} : ${invalid}`); continue; }
    if ([...current, ...accepted].some(f => f.name === file.name && f.size === file.size)) {
      rejected.push(`${file.name} : déjà ajouté.`);
      continue;
    }
    if (current.length + accepted.length >= REQUEST_FILES_MAX) {
      rejected.push(`${file.name} : ${REQUEST_FILES_MAX} fichiers au maximum par demande.`);
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

/** Type enregistré : les photos sont toujours réencodées en JPEG, les PDF restent des PDF. */
export function storedMimeFor(mime: string): 'application/pdf' | 'image/jpeg' {
  return mime === 'application/pdf' ? 'application/pdf' : 'image/jpeg';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
