import type { WorkOrder } from '../types';

/** État d'une case équipement × mois. */
export type CellState = 'none' | 'done' | 'partial' | 'overdue' | 'pending';

export type MatrixMode = 'month' | 'week';

/** Colonne de la matrice (un mois ou une semaine ISO). */
export interface MatrixColumn {
  label: string;      // « Jan » ou « 12 » (numéro de semaine)
  monthIndex: number; // 0..11 (pour une semaine : mois de son jeudi)
}

export interface MatrixCell {
  total: number;
  done: number;
  state: CellState;
  orders: WorkOrder[];
  /** Fréquences (H, M, T, S, A) des OT de la case, sans doublon ; « • » = fréquence inconnue. */
  freqs: string[];
}

export type FrequencyLetter = 'H' | 'M' | 'T' | 'S' | 'A';
export const FREQUENCY_ORDER: FrequencyLetter[] = ['H', 'M', 'T', 'S', 'A'];
export const FREQUENCY_LABELS: Record<FrequencyLetter, string> = {
  H: 'Hebdomadaire', M: 'Mensuelle', T: 'Trimestrielle', S: 'Semestrielle', A: 'Annuelle',
};
const FREQUENCY_WORDS: [RegExp, FrequencyLetter][] = [
  [/HEBDOMADAIRE/, 'H'], [/MENSUEL/, 'M'], [/TRIMESTRIEL/, 'T'], [/SEMESTRIEL/, 'S'], [/ANNUEL/, 'A'],
];

/**
 * Fréquence d'un OT préventif : lue dans le code d'intervention de la gamme
 * (PS-ASC-1H-01 → H, PS-TD-1T-01 → T), sinon dans le titre (« … MENSUEL … »).
 * undefined si rien ne permet de la déterminer (ex. OT correctif).
 */
export function frequencyOf(wo: Pick<WorkOrder, 'interventionCode' | 'title'>): FrequencyLetter | undefined {
  const m = /-\d*([HMTSA])-\d+$/i.exec((wo.interventionCode || '').trim());
  if (m) return m[1].toUpperCase() as FrequencyLetter;
  const title = (wo.title || '').toUpperCase();
  for (const [re, letter] of FREQUENCY_WORDS) if (re.test(title)) return letter;
  return undefined;
}

export interface MatrixRow {
  key: string;
  label: string;
  code: string;
  location: string;
  cells: MatrixCell[]; // une case par colonne (12 mois, ou 52/53 semaines)
  total: number;
  done: number;
  overdue: number;
  percent: number; // 0..100
}

export interface AnnualMatrix {
  mode: MatrixMode;
  columns: MatrixColumn[];
  /** Index de la colonne qui contient `today` (null si `today` n'est pas dans l'année affichée). */
  currentIndex: number | null;
  rows: MatrixRow[];
  monthTotals: { total: number; done: number }[]; // un total par colonne
  grand: { total: number; done: number; overdue: number; percent: number };
}

const NO_EQUIPMENT = 'Sans équipement';

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const DAY_MS = 86400000;

function utcFromStr(d: string): number {
  return Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
}

/** Semaine ISO 8601 (lundi = premier jour) d'une date AAAA-MM-JJ. */
export function isoWeekOf(d: string): { year: number; week: number } {
  const t = utcFromStr(d);
  const day = new Date(t).getUTCDay() || 7; // lundi=1 … dimanche=7
  const thursday = t + (4 - day) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  return { year, week: Math.floor((thursday - jan1) / (7 * DAY_MS)) + 1 };
}

/** Colonnes « semaines » d'une année ISO : 52 ou 53, chaque semaine rattachée au mois de son jeudi. */
export function weekColumns(year: number): MatrixColumn[] {
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Day = new Date(jan4).getUTCDay() || 7;
  const week1Monday = jan4 - (jan4Day - 1) * DAY_MS;
  const count = isoWeekOf(`${year}-12-28`).week; // le 28/12 est toujours dans la dernière semaine ISO
  return Array.from({ length: count }, (_, i) => {
    const thursday = week1Monday + (i * 7 + 3) * DAY_MS;
    return { label: String(i + 1), monthIndex: new Date(thursday).getUTCMonth() };
  });
}

function equipmentKey(wo: WorkOrder): string {
  return wo.equipmentId || wo.equipmentCode || wo.equipmentName || NO_EQUIPMENT;
}

/**
 * Construit la matrice annuelle : une ligne par équipement, une colonne par mois d'échéance.
 * - Les OT « Annulé » sont ignorés.
 * - « Terminé » = clôturé ; tout autre statut dont l'échéance est passée = en retard.
 * - `today` au format AAAA-MM-JJ.
 */
export function buildAnnualMatrix(orders: WorkOrder[], year: number, today: string, mode: MatrixMode = 'month'): AnnualMatrix {
  const columns: MatrixColumn[] = mode === 'week'
    ? weekColumns(year)
    : MONTH_LABELS.map((label, monthIndex) => ({ label, monthIndex }));
  const nCols = columns.length;

  const indexOf = (date: string): number => {
    if (!date || date.length < 10) return -1;
    if (mode === 'month') return date.startsWith(`${year}-`) ? Number(date.slice(5, 7)) - 1 : -1;
    const w = isoWeekOf(date);
    return w.year === year ? w.week - 1 : -1;
  };
  const currentIndex = (() => { const i = indexOf(today); return i >= 0 && i < nCols ? i : null; })();

  const map = new Map<string, MatrixRow>();

  for (const wo of orders) {
    if (wo.status === 'Annulé' || !wo.dueDate) continue;
    const month = indexOf(wo.dueDate);
    if (!(month >= 0 && month < nCols)) continue;

    const key = equipmentKey(wo);
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        label: wo.equipmentName || wo.equipmentCode || NO_EQUIPMENT,
        code: wo.equipmentCode || '',
        location: wo.location || '',
        cells: Array.from({ length: nCols }, () => ({ total: 0, done: 0, state: 'none' as CellState, orders: [], freqs: [] as string[] })),
        total: 0, done: 0, overdue: 0, percent: 0,
      };
      map.set(key, row);
    }
    const cell = row.cells[month];
    cell.total += 1;
    cell.orders.push(wo);
    row.total += 1;
    if (wo.status === 'Terminé') {
      cell.done += 1;
      row.done += 1;
    } else if (wo.dueDate < today) {
      row.overdue += 1;
    }
  }

  const monthTotals = Array.from({ length: nCols }, () => ({ total: 0, done: 0 }));
  let gTotal = 0, gDone = 0, gOverdue = 0;

  const rows = [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true }));
  for (const row of rows) {
    row.cells.forEach((cell, m) => {
      cell.orders.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.code.localeCompare(b.code));
      if (cell.total === 0) cell.state = 'none';
      else if (cell.done === cell.total) cell.state = 'done';
      else if (cell.orders.some(o => o.status !== 'Terminé' && o.dueDate < today)) cell.state = 'overdue';
      else if (cell.done > 0) cell.state = 'partial';
      else cell.state = 'pending';
      const letters = new Set<string>(cell.orders.map(o => frequencyOf(o) ?? '•'));
      cell.freqs = [...FREQUENCY_ORDER, '•'].filter(l => letters.has(l));
      monthTotals[m].total += cell.total;
      monthTotals[m].done += cell.done;
    });
    row.percent = row.total ? Math.round((row.done / row.total) * 100) : 0;
    gTotal += row.total; gDone += row.done; gOverdue += row.overdue;
  }

  return {
    mode,
    columns,
    currentIndex,
    rows,
    monthTotals,
    grand: { total: gTotal, done: gDone, overdue: gOverdue, percent: gTotal ? Math.round((gDone / gTotal) * 100) : 0 },
  };
}

/** Années qui ont au moins un OT (échéance), de la plus récente à la plus ancienne. */
export function availableYears(orders: WorkOrder[]): number[] {
  const set = new Set<number>();
  for (const wo of orders) {
    const y = Number((wo.dueDate || '').slice(0, 4));
    if (y >= 2000 && y <= 2100) set.add(y);
  }
  return [...set].sort((a, b) => b - a);
}
