// Contrôle des échéances à l'import des OT (06/11/2026).
// Contexte : 67 OT d'un site étaient déjà en base avec une échéance d'avril alors que le fichier Coswin disait le 31/03.
// L'import ne lisait pas l'échéance des OT déjà en base : aucun écart n'était signalé. Fonctions pures, sans accès base.

/** Ligne du fichier : seul ce qui sert à la comparaison. */
export interface DueDateFileRow { code: string; dueDate: string }

/** OT déjà en base, tel que lu par `fetchExistingWorkOrdersCore`. */
export interface DueDateExisting { id: string; dueDate?: string; status?: string }

/** Statuts pour lesquels l'échéance n'est pas modifiable depuis l'import. */
export const LOCKED_STATUSES = ['termine', 'annule'];

export interface DueDateDifference {
  existingId: string;
  code: string;
  fileDate: string;
  baseDate: string;
  /** Clôturé ou annulé : affiché, mais non alignable. */
  locked: boolean;
}

export interface DueDateMonth {
  /** Mois de l'échéance du fichier, « AAAA-MM ». */
  month: string;
  inFile: number;
  /** Absents de la base : seront créés. */
  isNew: number;
  /** Déjà en base, même échéance que le fichier. */
  same: number;
  /** Déjà en base, échéance différente. */
  different: number;
}

export interface DueDateReport {
  totalInFile: number;
  totalNew: number;
  totalSame: number;
  totalDifferent: number;
  months: DueDateMonth[];
  differences: DueDateDifference[];
  /** Répartition des écarts : échéance du fichier → échéance en base. */
  pairs: { fileDate: string; baseDate: string; count: number }[];
}

/**
 * Compare, par code d'OT, l'échéance du fichier et celle de la base.
 * Un OT présent plusieurs fois dans le fichier est compté une fois (la première ligne fait foi).
 * Une échéance absente en base n'est pas un écart (rien à comparer) : l'OT compte comme « identique ».
 */
export function compareDueDates(rows: DueDateFileRow[], existing: Map<string, DueDateExisting>): DueDateReport {
  const seen = new Set<string>();
  const months = new Map<string, DueDateMonth>();
  const differences: DueDateDifference[] = [];
  const pairCount = new Map<string, number>();
  let totalInFile = 0, totalNew = 0, totalSame = 0;

  for (const row of rows) {
    if (!row.code || seen.has(row.code)) continue;
    seen.add(row.code);
    totalInFile += 1;
    const month = (row.dueDate || '').slice(0, 7) || 'sans date';
    const m = months.get(month) ?? { month, inFile: 0, isNew: 0, same: 0, different: 0 };
    m.inFile += 1;
    months.set(month, m);

    const base = existing.get(row.code);
    if (!base) { m.isNew += 1; totalNew += 1; continue; }
    const baseDate = (base.dueDate || '').slice(0, 10);
    const fileDate = (row.dueDate || '').slice(0, 10);
    if (!baseDate || !fileDate || baseDate === fileDate) { m.same += 1; totalSame += 1; continue; }
    m.different += 1;
    differences.push({
      existingId: base.id,
      code: row.code,
      fileDate,
      baseDate,
      locked: LOCKED_STATUSES.includes(base.status ?? ''),
    });
    const key = `${fileDate}|${baseDate}`;
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
  }

  differences.sort((a, b) => a.code.localeCompare(b.code));
  const pairs = Array.from(pairCount.entries())
    .map(([key, count]) => { const [fileDate, baseDate] = key.split('|'); return { fileDate, baseDate, count }; })
    .sort((a, b) => a.fileDate.localeCompare(b.fileDate) || a.baseDate.localeCompare(b.baseDate));

  return {
    totalInFile, totalNew, totalSame,
    totalDifferent: differences.length,
    months: Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)),
    differences,
    pairs,
  };
}

/** « 2026-03-31 » → « 31/03/2026 » (sans passer par Date : aucun effet de fuseau horaire). */
export function formatIsoDateFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Phrase de bilan quand il n'y a aucun écart (affichée après l'import). */
export function dueDateOkSummary(report: DueDateReport): string {
  const inBase = report.totalSame + report.totalDifferent;
  return inBase === 0
    ? 'Contrôle des échéances : aucun OT du fichier n\'était déjà en base.'
    : `Contrôle des échéances : ${inBase} OT déjà en base, toutes les échéances sont identiques au fichier.`;
}
