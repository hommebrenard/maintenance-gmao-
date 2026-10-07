import type { WorkOrder } from '../types';
import { familyKeyOf, frequencyOf, FREQUENCY_ORDER, FREQUENCY_LABELS } from './annualMatrix';
import { lotOfFamily, familyLabel, LOT_ORDER, type LotCode } from './equipmentFamilies';

/** Filtres de classement d'un OT (Rapports) : lot, famille d'équipement, fréquence H/M/T/S/A. '' = tous. */
export interface ClassFilters { lot: string; family: string; freq: string }
export const EMPTY_CLASS_FILTERS: ClassFilters = { lot: '', family: '', freq: '' };

/** Libellés courts des lots (les libellés d'écran de equipmentFamilies sont plus longs). */
export const LOT_SHORT_LABEL: Record<LotCode, string> = {
  ELEC: 'Électricité', FLUIDE: 'Fluides', CIRC: 'Circulation mécanique', DIVERS: 'Divers',
};
export const LOT_OPTIONS: { key: LotCode; label: string }[] = LOT_ORDER.map(k => ({ key: k, label: LOT_SHORT_LABEL[k] }));

export function matchesClassFilters(wo: WorkOrder, f: ClassFilters): boolean {
  if (!f.lot && !f.family && !f.freq) return true;
  const family = familyKeyOf(wo.equipmentCode);
  if (f.family && family !== f.family) return false;
  if (f.lot && lotOfFamily(family) !== f.lot) return false;
  if (f.freq && (frequencyOf(wo) || '') !== f.freq) return false;
  return true;
}

/** Familles et fréquences réellement présentes dans les OT ; les familles se restreignent au lot choisi. */
export function classOptions(orders: WorkOrder[], lot: string): {
  families: { key: string; label: string }[];
  freqs: { key: string; label: string }[];
} {
  const familyKeys = new Set<string>();
  const freqKeys = new Set<string>();
  for (const wo of orders) {
    const fam = familyKeyOf(wo.equipmentCode);
    if (!lot || lotOfFamily(fam) === lot) familyKeys.add(fam);
    const fq = frequencyOf(wo);
    if (fq) freqKeys.add(fq);
  }
  const families = Array.from(familyKeys)
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map(key => ({ key, label: familyLabel(key) ? `${key} — ${familyLabel(key)}` : key }));
  const freqs = FREQUENCY_ORDER.filter(k => freqKeys.has(k)).map(k => ({ key: k, label: FREQUENCY_LABELS[k] }));
  return { families, freqs };
}
