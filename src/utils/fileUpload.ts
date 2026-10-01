// Règles pures de dépôt de fichiers (étape 5b, 30/09/2026) : formats, tailles, noms.
// Le navigateur réduit les photos avant l'envoi (voir imageCompress.ts) ; les PDF ne sont pas modifiés.

export const DOC_MAX_BYTES = 10 * 1024 * 1024; // PDF et images (après réduction)
export const IMAGE_RAW_MAX_BYTES = 30 * 1024 * 1024; // photo brute acceptée avant réduction
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024; // photo d'équipement après réduction

export const DOC_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const isImageType = (mime: string) => IMAGE_MIME_TYPES.includes(mime);

/** Type du fichier ; si le navigateur n'en donne pas (fréquent sur Android), on le déduit de l'extension. */
export function resolveMime(file: { name: string; type: string }): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_MIME[ext] ?? '';
}

/** Dimensions réduites pour tenir dans un carré de `maxEdge` px, sans jamais agrandir. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

const formatMb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} Mo`;

/** null si le fichier est acceptable pour un compte rendu / document ; sinon le message à afficher. */
export function validateDocumentFile(file: { name: string; type: string; size: number }): string | null {
  const mime = resolveMime(file);
  if (!(DOC_MIME_TYPES as readonly string[]).includes(mime)) {
    return 'Format non pris en charge : PDF, JPEG, PNG ou WebP uniquement.';
  }
  if (isImageType(mime)) {
    return file.size > IMAGE_RAW_MAX_BYTES ? `Image trop volumineuse (maximum ${formatMb(IMAGE_RAW_MAX_BYTES)}).` : null;
  }
  return file.size > DOC_MAX_BYTES ? `PDF trop volumineux (maximum ${formatMb(DOC_MAX_BYTES)}).` : null;
}

/** null si le fichier est acceptable comme photo d'équipement. */
export function validatePhotoFile(file: { name: string; type: string; size: number }): string | null {
  if (!isImageType(resolveMime(file))) return 'Format non pris en charge : JPEG, PNG ou WebP uniquement.';
  return file.size > IMAGE_RAW_MAX_BYTES ? `Image trop volumineuse (maximum ${formatMb(IMAGE_RAW_MAX_BYTES)}).` : null;
}

/** Extension du fichier stocké : les images sont toujours réencodées en JPEG. */
export function extensionFor(mime: string): 'pdf' | 'jpg' {
  return mime === 'application/pdf' ? 'pdf' : 'jpg';
}

export function nameWithoutExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  return (i > 0 ? filename.slice(0, i) : filename).trim();
}
