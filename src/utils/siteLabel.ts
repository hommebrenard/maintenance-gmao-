import type { LocationItem } from '../types';
import { canonicalSiteKey } from './requestFilters';

/**
 * Nom lisible d'un site à partir de son code Coswin (ex. BAM_FEZ_AG → « Succursale régionale Type A FES »).
 * Le nom est celui de l'emplacement configuré dans l'application ; renvoie undefined si le code ne correspond à aucun site.
 */
export type SiteNameResolver = (code?: string | null) => string | undefined;

export function createSiteNameResolver(locations: LocationItem[]): SiteNameResolver {
  const byKey = new Map<string, string>();
  for (const l of locations) {
    if (l.type !== 'Site') continue;
    const k = canonicalSiteKey(l.code);
    if (k && !byKey.has(k)) byKey.set(k, l.name);
  }
  return code => { const k = canonicalSiteKey(code); return k ? byKey.get(k) : undefined; };
}
