// Création automatique des fiches équipement à partir des lignes d'un import de planning.
// Fonctions pures (sans Supabase ni React) pour pouvoir les tester.
//
// Correctif du 21/09/2026 : à l'import, `wo.location` contient désormais le NOM officiel du
// site (résolu par `normalizeSiteName` avec la liste des emplacements), alors que le code Zone
// brut du fichier (ex. BAM_FEZ_AG) est dans `wo.entity`. L'ancienne résolution cherchait le
// NOM dans une table indexée par CODE : elle ne trouvait rien, et chaque équipement créé par un
// import restait « sans emplacement » (`location_id` NULL).
import { Equipment, WorkOrder } from '../types';
import { extractBrandFromDescription } from './equipmentDisplay';

/**
 * Retrouve l'id d'emplacement d'une ligne d'import : code Zone brut (`entity`) d'abord, puis
 * `location` traité comme un code, puis `location` traité comme un nom d'emplacement.
 * Insensible à la casse et aux espaces autour ; renvoie undefined si rien ne correspond
 * (l'équipement est alors créé sans emplacement, comme avant).
 */
export function resolveImportLocationId(
  row: { entity?: string; location?: string },
  codeToId: Map<string, string>,
  nameToId: Map<string, string> = new Map()
): string | undefined {
  const norm = (s?: string) => (s || '').trim().toUpperCase();
  const codes = new Map<string, string>();
  codeToId.forEach((id, code) => { if (code) codes.set(norm(code), id); });
  const names = new Map<string, string>();
  nameToId.forEach((id, name) => { if (name) names.set(norm(name), id); });

  const entity = norm(row.entity);
  if (entity && codes.has(entity)) return codes.get(entity);
  const location = norm(row.location);
  if (location && codes.has(location)) return codes.get(location);
  if (location && names.has(location)) return names.get(location);
  return undefined;
}

/**
 * Fiches équipement à créer pour les codes équipement des lignes importées qui n'existent pas
 * encore (une fiche par code, la première ligne rencontrée décide du nom et du site).
 */
export function buildNewEquipmentsFromImport(
  rows: WorkOrder[],
  existingCodes: Set<string>,
  codeToLocationId: Map<string, string>,
  nameToLocationId: Map<string, string> = new Map(),
  now: string = new Date().toISOString()
): Equipment[] {
  const seen = new Map<string, WorkOrder>();
  rows.forEach(w => {
    if (w.equipmentCode && !existingCodes.has(w.equipmentCode) && !seen.has(w.equipmentCode)) {
      seen.set(w.equipmentCode, w);
    }
  });
  return Array.from(seen.values()).map(w => ({
    id: `eq-${w.equipmentCode}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    code: w.equipmentCode as string,
    name: w.equipmentName || (w.equipmentCode as string),
    status: 'En service',
    criticality: 'Normal',
    location: w.location || '',
    locationId: resolveImportLocationId(w, codeToLocationId, nameToLocationId),
    supplier: '',
    // §4.2 point 6 (22/09/2026) : le nom importé contient parfois « MARQUE: XXX »
    // (ex. « VENTILO CONVECTEUR N10 MARQUE: TRANE ») — préremplissage automatique
    // du fabricant à la création, jamais une réécriture du nom lui-même.
    manufacturer: extractBrandFromDescription(w.equipmentName),
    model: '',
    serialNumber: '',
    createdAt: now,
    updatedAt: now,
    description: '',
    workOrdersCount: 0
  }));
}
