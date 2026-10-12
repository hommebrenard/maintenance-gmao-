/**
 * Écriture localStorage « au mieux » : un quota dépassé (≈ 5 Mo partagés par tout le domaine) ou un
 * stockage indisponible ne doit JAMAIS faire planter l'application.
 *
 * - `dropOnFail = true`  : pour un simple CACHE (la vraie donnée est dans Supabase) → la clé périmée est supprimée.
 * - `dropOnFail = false` (défaut) : pour une donnée qui n'existe QUE dans le navigateur → l'ancienne valeur
 *   est conservée, jamais supprimée.
 * Retourne true si l'écriture a réussi.
 */
export function safeSetItem(key: string, value: string, dropOnFail = false): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`Stockage local « ${key} » non enregistré (quota ou stockage indisponible) :`, err);
    if (dropOnFail) {
      try { localStorage.removeItem(key); } catch { /* rien de plus à faire */ }
    }
    return false;
  }
}
