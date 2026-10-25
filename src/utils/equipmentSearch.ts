import type { Equipment } from '../types';
import { familyKeyOf } from './annualMatrix';

/** Minuscules, sans accents, « - », « _ » et espaces confondus : « bam_fez » trouve « BAM-FEZ ». */
export function normSearch(s: string | undefined | null): string {
  return (s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[-_\s]+/g, ' ').trim();
}

export interface EquipmentSearchOptions {
  /** Restreint à un site (`locationId`). Vide = tous les sites. */
  siteId?: string;
  query?: string;
  limit?: number;
}

/**
 * Recherche d'équipement pour le formulaire de demande : tous les mots saisis doivent apparaître
 * dans le code, le nom ou la famille. Les codes qui COMMENCENT par la saisie passent en premier.
 * Sans site ni saisie : aucun résultat (on ne liste jamais les 4 695 équipements).
 */
export function searchEquipment(list: Equipment[], opts: EquipmentSearchOptions): Equipment[] {
  const limit = opts.limit ?? 30;
  const q = normSearch(opts.query);
  if (!opts.siteId && !q) return [];
  const tokens = q ? q.split(' ') : [];
  const scored: { eq: Equipment; rank: number }[] = [];
  for (const eq of list) {
    if (opts.siteId && eq.locationId !== opts.siteId) continue;
    const code = normSearch(eq.code);
    const hay = `${code} ${normSearch(eq.name)} ${normSearch(familyKeyOf(eq.code))}`;
    if (!tokens.every(t => hay.includes(t))) continue;
    scored.push({ eq, rank: q && code.startsWith(q) ? 0 : 1 });
  }
  scored.sort((a, b) => a.rank - b.rank || a.eq.code.localeCompare(b.eq.code, 'fr', { numeric: true }));
  return scored.slice(0, limit).map(s => s.eq);
}
