import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';

// Export PDF 100% client (aucun serveur, aucune clé API) : capture l'élément
// DOM ciblé en image haute résolution puis la place sur une ou plusieurs
// pages A4. Utilisé pour le Carnet de santé et, à terme, toute fiche
// imprimable de l'app (compatible avec le déploiement statique GitHub Pages).

/**
 * Convertit les <img> externes de l'élément en data URL base64, pour éviter
 * qu'une image non chargée ou bloquée par CORS ne casse le rendu du canvas.
 */
async function inlineImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(async img => {
      if (!img.src || img.src.startsWith('data:')) return;
      try {
        const response = await fetch(img.src);
        if (!response.ok) throw new Error('Image inaccessible');
        const blob = await response.blob();
        await new Promise<void>(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => {
            img.src = reader.result as string;
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsDataURL(blob);
        });
      } catch {
        // Image non récupérable (ex. hors-ligne) : on laisse un espace vide
        // plutôt que de faire échouer tout l'export.
      }
    })
  );
}

/**
 * Génère un PDF A4 à partir d'un élément DOM et déclenche son téléchargement.
 * Découpe automatiquement sur plusieurs pages si le contenu dépasse une
 * page A4 (cas d'un carnet de santé avec beaucoup d'entrées, par exemple).
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await inlineImages(element);

    const elementWidth = element.offsetWidth || 800;
    const elementHeight = element.scrollHeight || element.offsetHeight;

    const imageData = await toJpeg(element, {
      quality: 0.95,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width: elementWidth,
      height: elementHeight,
      style: { margin: '0', transform: 'none' },
      // La capture DOM ne respecte pas les règles CSS @media print (contrairement
      // à window.print()) : les éléments marqués data-pdf-exclude (boutons, colonne
      // de navigation...) doivent être retirés explicitement ici.
      filter: node => !(node instanceof HTMLElement && node.dataset.pdfExclude === 'true'),
    });

    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Impossible de générer l'image du document"));
      image.src = imageData;
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const marginMm = 10;
    const availableWidthMm = pageWidthMm - marginMm * 2;
    const availableHeightMm = pageHeightMm - marginMm * 2;

    const mmPerPx = availableWidthMm / image.naturalWidth;
    const totalHeightMm = image.naturalHeight * mmPerPx;
    const pageHeightInPx = availableHeightMm / mmPerPx;

    if (totalHeightMm <= availableHeightMm) {
      // Tient sur une seule page.
      pdf.addImage(imageData, 'JPEG', marginMm, marginMm, availableWidthMm, totalHeightMm);
    } else {
      // Découpe en tranches successives, une par page A4.
      let sourceY = 0;
      let pageIndex = 0;
      while (sourceY < image.naturalHeight) {
        if (pageIndex > 0) pdf.addPage();

        const sliceHeightPx = Math.min(pageHeightInPx, image.naturalHeight - sourceY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = image.naturalWidth;
        sliceCanvas.height = sliceHeightPx;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(image, 0, sourceY, image.naturalWidth, sliceHeightPx, 0, 0, image.naturalWidth, sliceHeightPx);
          const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(sliceData, 'JPEG', marginMm, marginMm, availableWidthMm, sliceHeightPx * mmPerPx);
        }
        sourceY += sliceHeightPx;
        pageIndex++;
      }
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erreur lors de la génération du PDF' };
  }
}
