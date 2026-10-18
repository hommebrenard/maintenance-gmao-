/**
 * Clôture des OT depuis un export Coswin (état « T » = terminé).
 * Coswin ne porte ni checklist ni visa : la clôture n'est justifiée que par l'état « T ».
 * Fonctions pures (aucun accès base) — le rapprochement et l'écriture sont faits par la fonction SQL
 * `close_work_orders_from_coswin`.
 */

export interface ClosureItem { code: string; closed_on: string; start_on: string | null }
export interface ClosureReport {
  totalRows: number;
  /** En-têtes obligatoires introuvables (le fichier n'est alors pas exploitable). */
  missingHeaders: string[];
  /** Lignes à l'état « T » avec N° d'OT et date de fin valides. */
  items: ClosureItem[];
  /** Lignes à l'état « T » sans date de fin lisible (non retenues). */
  withoutEndDate: string[];
  /** Lignes « T » dont la date de fin est antérieure au début ou dans le futur (non retenues). */
  suspectDates: string[];
  /** Lignes dont l'état n'est pas « T » (ex. « A ») : OT laissés ouverts. */
  otherStates: { state: string; count: number; codes: string[] }[];
  /** Lignes sans N° d'OT exploitable. */
  invalid: number;
  duplicates: number;
}

const norm = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

const HEADERS = { code: "n° d'ot", state: 'etat ot', end: 'date de fin', start: 'date de debut' } as const;

/** « 85830 », 85830 ou « OT-85830 » → « OT-85830 » ; sinon null. */
export function normalizeOtCode(v: unknown): string | null {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return null;
  if (/^OT-\d+$/.test(s)) return s;
  if (/^\d+(\.0+)?$/.test(s)) return `OT-${s.replace(/\.0+$/, '')}`;
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Date Excel (Date, numéro de série, « jj/mm/aaaa [hh:mm] » ou ISO) → « AAAA-MM-JJ » ; sinon null. */
export function toIsoDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    // +6 h : évite le décalage d'un jour des dates à minuit selon le fuseau du navigateur.
    const d = new Date(v.getTime() + 6 * 3600 * 1000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (typeof v === 'number' && isFinite(v) && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return valid(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  return null;
}
function valid(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : null;
}

export function analyzeClosureRows(raw: Record<string, unknown>[], today: Date = new Date()): ClosureReport {
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const report: ClosureReport = { totalRows: raw.length, missingHeaders: [], items: [], withoutEndDate: [], suspectDates: [], otherStates: [], invalid: 0, duplicates: 0 };
  if (raw.length === 0) return report;

  const keyOf: Record<string, string> = {};
  for (const k of Object.keys(raw[0])) keyOf[norm(k)] = k;
  const col = (h: string) => keyOf[h];
  if (!col(HEADERS.code)) report.missingHeaders.push("N° d'OT");
  if (!col(HEADERS.state)) report.missingHeaders.push('État OT');
  if (!col(HEADERS.end)) report.missingHeaders.push('Date de fin');
  if (report.missingHeaders.length > 0) return report;

  const byCode = new Map<string, ClosureItem>();
  const others = new Map<string, string[]>();
  for (const row of raw) {
    const code = normalizeOtCode(row[col(HEADERS.code)]);
    if (!code) { report.invalid++; continue; }
    const state = String(row[col(HEADERS.state)] ?? '').trim().toUpperCase();
    if (state !== 'T') {
      const label = state || '(vide)';
      others.set(label, [...(others.get(label) ?? []), code]);
      continue;
    }
    const closed = toIsoDate(row[col(HEADERS.end)]);
    if (!closed) { report.withoutEndDate.push(code); continue; }
    const start = col(HEADERS.start) ? toIsoDate(row[col(HEADERS.start)]) : null;
    if (closed > todayIso || (start && closed < start)) { report.suspectDates.push(code); continue; }
    if (byCode.has(code)) report.duplicates++;
    byCode.set(code, { code, closed_on: closed, start_on: start });
  }
  report.items = [...byCode.values()];
  report.otherStates = [...others.entries()].map(([state, codes]) => ({ state, count: codes.length, codes }));
  return report;
}
