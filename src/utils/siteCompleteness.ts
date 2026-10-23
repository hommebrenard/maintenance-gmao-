import { EXPECTED_EQUIPMENT_BY_ZONE } from '../data/equipmentExpectedBySite';

// Complétude des équipements par site (23/10/2026) : compare le nombre d'équipements d'un emplacement dans
// l'app au nombre attendu dans Coswin (cartographie). Alerte seulement s'il en MANQUE : un site qui a plus
// d'équipements que la référence (équipement créé depuis un OT, ajout récent) n'est pas signalé.

export const normZoneCode = (code: string | null | undefined): string =>
  (code || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

export interface SiteCompleteness {
  expected: number | null; // null = site absent de la référence
  count: number;
  missing: number; // 0 si complet ou référence inconnue
  incomplete: boolean;
}

export function siteCompleteness(locationCode: string | null | undefined, count: number): SiteCompleteness {
  const expected = EXPECTED_EQUIPMENT_BY_ZONE[normZoneCode(locationCode)] ?? null;
  const missing = expected === null ? 0 : Math.max(0, expected - count);
  return { expected, count, missing, incomplete: missing > 0 };
}
