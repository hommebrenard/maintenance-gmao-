import type { ReviewItem, ReviewFileRow } from './requestSyncReview';

/**
 * Export des écarts pour l'administrateur Coswin : DI verrouillées dont l'équipement Coswin
 * diffère de l'équipement réel (celui du verrou). Les verrous « alignés » (Coswin d'accord) ne sont pas listés.
 * Équipement Coswin = premier code renseigné du fichier (planifié, sinon source), comme la synchronisation.
 */
export const GAP_COLUMNS = ['N° de DI', 'Description', 'Équipement Coswin', 'Équipement réel'] as const;
export interface GapRow { 'N° de DI': string; 'Description': string; 'Équipement Coswin': string; 'Équipement réel': string }

export function buildGapRows(items: ReviewItem[], fileRows: ReviewFileRow[]): GapRow[] {
  const byCode = new Map(fileRows.map(r => [r.code, r]));
  return items
    .filter(i => i.state === 'verrou_stable' || i.state === 'verrou_change_coswin')
    .map(i => {
      const f = byCode.get(i.code);
      const coswin = f?.planned_equipment_code?.trim() || f?.equipment_code?.trim() || '';
      return { 'N° de DI': i.code, 'Description': i.title ?? '', 'Équipement Coswin': coswin, 'Équipement réel': i.oldEquipment?.code ?? '' };
    })
    .sort((a, b) => a['N° de DI'].localeCompare(b['N° de DI']));
}

/** Une cellule qui commencerait par = + - @ serait lue comme une formule par Excel : on la neutralise. */
const cell = (v: string): string => {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV séparé par « ; » (Excel français), avec BOM UTF-8 pour les accents. */
export function gapRowsToCsv(rows: GapRow[]): string {
  const lines = [GAP_COLUMNS.join(';'), ...rows.map(r => GAP_COLUMNS.map(c => cell(r[c])).join(';'))];
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
