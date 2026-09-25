// Liens profonds (hash) vers le Carnet de santé, sans React Router.
//
//   #health-records/<equipmentId>                  -> ouvre la fiche (lecture)
//   #health-records/<equipmentId>/nouvelle-entree  -> ouvre la fiche avec le
//                                                     formulaire d'ajout déjà déplié
//
// Tout autre format (segment inconnu, id vide) est ignoré : l'app s'ouvre
// normalement, sans lien profond.

export const NEW_ENTRY_SEGMENT = 'nouvelle-entree';

export interface HealthRecordsDeepLink {
  equipmentId: string;
  openAddForm: boolean;
}

export function parseHealthRecordsHash(hash: string): HealthRecordsDeepLink | null {
  const match = hash.match(/^#health-records\/([^/?#]+)(?:\/(nouvelle-entree))?\/?$/);
  if (!match) return null;
  let equipmentId = match[1];
  try {
    equipmentId = decodeURIComponent(equipmentId);
  } catch {
    // id non décodable : on garde la valeur brute
  }
  if (!equipmentId.trim()) return null;
  return { equipmentId, openAddForm: match[2] === NEW_ENTRY_SEGMENT };
}
