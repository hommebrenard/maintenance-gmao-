// Dates d'OT pour l'onglet Rapports. `createdAt`/`updatedAt` arrivent en texte
// fr-FR ("05/10/2026 10:12:20", mis en forme au chargement) ou en ISO ; les
// comparer comme du texte classe par jour du mois d'abord (le 30/09 passait
// devant le 05/10). On les convertit donc en vraies dates avant de trier.

/** "JJ/MM/AAAA[, ]HH:MM[:SS]" (fr-FR), sinon ISO ("AAAA-MM-JJ[...]"). null si illisible. */
export function parseWoDateTime(s?: string | null): Date | null {
  if (!s) return null;
  const fr = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[, ]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (fr) {
    const [, day, month, year, h, min, sec] = fr;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(h || '0'), Number(min || '0'), Number(sec || '0'));
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(s);
  return isNaN(iso.getTime()) ? null : iso;
}

/** Instant de dernière activité d'un OT (dernière modification, sinon création) ; 0 si inconnu. */
export function lastActivityTime(wo: { updatedAt?: string | null; createdAt?: string | null }): number {
  const d = parseWoDateTime(wo.updatedAt) || parseWoDateTime(wo.createdAt);
  return d ? d.getTime() : 0;
}

/** Copie triée de la plus récente à la plus ancienne activité (OT sans date à la fin). */
export function sortByRecentActivity<T extends { updatedAt?: string | null; createdAt?: string | null }>(orders: T[]): T[] {
  return [...orders].sort((a, b) => lastActivityTime(b) - lastActivityTime(a));
}
