import { fitWithin } from './fileUpload';

/**
 * Réduit une image dans le navigateur avant l'envoi (téléphone : photos de 5 à 15 Mo -> quelques centaines de Ko).
 * Sortie toujours en JPEG (fond blanc pour les PNG transparents). L'orientation EXIF est respectée.
 */
export async function compressImage(file: Blob, opts: { maxEdge: number; quality: number }): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, opts.maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Impossible de préparer l'image.");
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', opts.quality));
    if (!blob) throw new Error("Impossible de compresser l'image.");
    return blob;
  } finally {
    bitmap.close();
  }
}
