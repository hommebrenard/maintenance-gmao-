import type { WorkOrder } from '../types';

// Journal d'import des OT (24/10/2026) — fonctions pures. Contexte : un écart de 683 OT entre deux mesures a dû être
// expliqué à la main (requête `created_at`). Le journal enregistre, à chaque import, ce qui a été lu et ce qui a été créé.

/** Ce que l'écran d'import sait au moment de valider. */
export interface ImportMeta {
  fileNames: string[];
  /** Lignes lues dans les fichiers, avant écartement des OT déjà en base. */
  rowsInFiles: number;
  /** OT nouveaux, donc à créer. */
  rowsNew: number;
  /** OT déjà en base et déjà complets, ignorés. */
  rowsIgnored: number;
}

/** Ligne de la table `import_log`. */
export interface ImportLogEntry {
  id: string;
  created_at: string;
  kind: string;
  file_names: string[];
  rows_in_files: number;
  rows_new: number;
  rows_created: number;
  rows_patched: number;
  rows_ignored: number;
}

/** Un import est « à vérifier » si le nombre d'OT créés diffère du nombre d'OT nouveaux annoncés. */
export const importMismatch = (e: Pick<ImportLogEntry, 'rows_new' | 'rows_created'>): number => e.rows_created - e.rows_new;

export interface RecentAdditions { total: number; last7: number; last30: number; withoutDate: number }

/** OT ajoutés en base ces 7 et 30 derniers jours, d'après la date de création en base (`createdAtIso`). */
export function recentAdditions(workOrders: Pick<WorkOrder, 'createdAtIso'>[], now: Date): RecentAdditions {
  const DAY = 86400000;
  const t = now.getTime();
  let last7 = 0, last30 = 0, withoutDate = 0;
  for (const w of workOrders) {
    const ms = w.createdAtIso ? Date.parse(w.createdAtIso) : NaN;
    if (Number.isNaN(ms)) { withoutDate++; continue; }
    if (ms > t - 7 * DAY) last7++;
    if (ms > t - 30 * DAY) last30++;
  }
  return { total: workOrders.length, last7, last30, withoutDate };
}
