import type { LocationItem } from '../types';

/** État d'intégration d'un site (colonne `locations.integration_status`). */
export type IntegrationStatus = 'a_preparer' | 'en_integration' | 'operationnel';

export const INTEGRATION_STATUSES: IntegrationStatus[] = ['a_preparer', 'en_integration', 'operationnel'];

export const INTEGRATION_LABELS: Record<IntegrationStatus, string> = {
  a_preparer: 'À préparer',
  en_integration: 'En intégration',
  operationnel: 'Opérationnel',
};

/** Valeur inconnue ou absente = « opérationnel » (comportement historique, défaut de la base). */
export function normalizeIntegrationStatus(value: unknown): IntegrationStatus {
  return INTEGRATION_STATUSES.includes(value as IntegrationStatus) ? (value as IntegrationStatus) : 'operationnel';
}

export function isSiteOperational(loc: Pick<LocationItem, 'integrationStatus'> | undefined): boolean {
  return !loc || normalizeIntegrationStatus(loc.integrationStatus) === 'operationnel';
}

/** Ids et noms des sites NON opérationnels. */
export function hiddenSiteKeys(locations: LocationItem[]): { ids: Set<string>; names: Set<string> } {
  const ids = new Set<string>();
  const names = new Set<string>();
  locations.forEach(l => {
    if (!isSiteOperational(l)) {
      ids.add(l.id);
      names.add(l.name);
    }
  });
  return { ids, names };
}

/** Nombre de sites non opérationnels (pour la case « Inclure… »). */
export function countNonOperational(locations: LocationItem[]): number {
  return locations.filter(l => !isSiteOperational(l)).length;
}

/**
 * Filtre une liste (équipements, OT…) sur les sites opérationnels.
 * Un élément sans site connu reste visible. `includeAll` = tout garder.
 */
export function filterBySiteIntegration<T extends { locationId?: string; location?: string }>(
  items: T[],
  locations: LocationItem[],
  includeAll: boolean
): T[] {
  if (includeAll) return items;
  const { ids, names } = hiddenSiteKeys(locations);
  if (ids.size === 0) return items;
  return items.filter(it => {
    if (it.locationId) return !ids.has(it.locationId);
    if (it.location) return !names.has(it.location);
    return true;
  });
}
