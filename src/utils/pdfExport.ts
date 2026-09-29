import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';
import { computePageBreaks } from './pdfPagination';

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

export interface PdfExportOptions {
  /**
   * Largeur de capture en px CSS. Si fournie, le document est recopié hors écran
   * à cette largeur avant capture : la mise en page (colonnes, grilles) est alors
   * identique quel que soit l'appareil — un téléphone donne le même PDF qu'un PC.
   */
  captureWidth?: number;
}

// Plafond de pixels du canvas de capture (limite pratique des navigateurs mobiles,
// ~16 M de pixels) : au-delà, la résolution est réduite au lieu d'échouer.
const MAX_CAPTURE_PIXELS = 16_000_000;

/** Positions (bas, en px CSS depuis le haut du document) des blocs marqués data-pdf-block. */
function collectBreakCandidates(root: HTMLElement): number[] {
  const rootTop = root.getBoundingClientRect().top;
  return Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-block]')).map(
    el => el.getBoundingClientRect().bottom - rootTop
  );
}

/**
 * Génère un PDF A4 à partir d'un élément DOM et déclenche son téléchargement.
 * Découpe sur plusieurs pages si le contenu dépasse une page A4, en coupant
 * entre les blocs marqués `data-pdf-block` (jamais au milieu d'une ligne).
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  options: PdfExportOptions = {}
): Promise<{ success: boolean; error?: string }> {
  let host: HTMLElement | null = null;
  try {
    let target = element;
    if (options.captureWidth) {
      host = document.createElement('div');
      host.style.cssText = `position:fixed;left:-100000px;top:0;width:${options.captureWidth}px;background:#fff;pointer-events:none;`;
      const clone = element.cloneNode(true) as HTMLElement;
      // Éléments d'interface (boutons, formulaires) : retirés avant de mesurer la hauteur.
      clone.querySelectorAll('[data-pdf-exclude="true"]').forEach(n => n.remove());
      clone.style.width = `${options.captureWidth}px`;
      clone.style.margin = '0';
      host.appendChild(clone);
      document.body.appendChild(host);
      // Deux images d'attente : le navigateur applique la mise en page à la nouvelle largeur.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      target = clone;
    }

    await inlineImages(target);

    const elementWidth = target.offsetWidth || 800;
    const elementHeight = target.scrollHeight || target.offsetHeight;
    const breakCandidates = collectBreakCandidates(target);
    const pixelRatio = Math.min(2, Math.sqrt(MAX_CAPTURE_PIXELS / (elementWidth * elementHeight)));

    const imageData = await toJpeg(target, {
      quality: 0.95,
      pixelRatio,
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
      // Découpe en tranches, une par page A4, coupées entre deux blocs.
      const scale = image.naturalWidth / elementWidth;
      const ends = computePageBreaks(
        image.naturalHeight,
        pageHeightInPx,
        breakCandidates.map(c => c * scale)
      ).map(e => Math.round(e));

      let sourceY = 0;
      ends.forEach((end, pageIndex) => {
        const sliceHeightPx = Math.max(1, end - sourceY);
        if (pageIndex > 0) pdf.addPage();
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
        sourceY = end;
      });
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erreur lors de la génération du PDF' };
  } finally {
    host?.remove();
  }
}
