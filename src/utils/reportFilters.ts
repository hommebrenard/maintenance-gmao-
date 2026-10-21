import type { WorkOrder } from '../types';
import { familyKeyOf, frequencyOf, FREQUENCY_ORDER, FREQUENCY_LABELS } from './annualMatrix';
import { contractLotOfFamily, subLotOfFamily, familyLabel, CONTRACT_LOT_ORDER, CONTRACT_LOT_LABELS } from './equipmentFamilies';

/** Filtres de classement d'un OT (Rapports) : lot, famille d'équipement, fréquence H/M/T/S/A. '' = tous. */
export interface ClassFilters { lot: string; subLot: string; family: string; freq: string }
export const EMPTY_CLASS_FILTERS: ClassFilters = { lot: '', subLot: '', family: '', freq: '' };

/** Lots du contrat (mêmes libellés que le tableau de bord et la matrice annuelle). */
export const LOT_OPTIONS: { key: string; label: string }[] = CONTRACT_LOT_ORDER.map(k => ({ key: k, label: CONTRACT_LOT_LABELS[k] }));

export function matchesClassFilters(wo: WorkOrder, f: ClassFilters): boolean {
  if (!f.lot && !f.subLot && !f.family && !f.freq) return true;
  const family = familyKeyOf(wo.equipmentCode);
  if (f.family && family !== f.family) return false;
  if (f.lot && contractLotOfFamily(family) !== f.lot) return false;
  if (f.subLot && subLotOfFamily(family) !== f.subLot) return false;
  if (f.freq && (frequencyOf(wo) || '') !== f.freq) return false;
  return true;
}

/** Familles et fréquences réellement présentes dans les OT ; les familles se restreignent au lot choisi. */
export function classOptions(orders: WorkOrder[], lot: string, equipmentCodes: (string | undefined)[] = []): {
  families: { key: string; label: string }[];
  freqs: { key: string; label: string }[];
} {
  const familyKeys = new Set<string>();
  const freqKeys = new Set<string>();
  for (const wo of orders) {
    const fam = familyKeyOf(wo.equipmentCode);
    if (!lot || contractLotOfFamily(fam) === lot) familyKeys.add(fam);
    const fq = frequencyOf(wo);
    if (fq) freqKeys.add(fq);
  }
  // Familles d'équipements sans aucun OT : elles doivent aussi être filtrables dans « État des équipements ».
  for (const code of equipmentCodes) {
    const fam = familyKeyOf(code);
    if (!lot || contractLotOfFamily(fam) === lot) familyKeys.add(fam);
  }
  const families = Array.from(familyKeys)
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map(key => ({
      key,
      label: key === 'AUTRES' ? 'Autres (code non reconnu)' : familyLabel(key) ? `${key} — ${familyLabel(key)}` : key,
    }));
  const freqs = FREQUENCY_ORDER.filter(k => freqKeys.has(k)).map(k => ({ key: k, label: FREQUENCY_LABELS[k] }));
  return { families, freqs };
}
