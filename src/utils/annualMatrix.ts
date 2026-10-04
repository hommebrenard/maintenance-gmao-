import type { WorkOrder } from '../types';
import { familyLabel, lotOfFamily, type LotCode } from './equipmentFamilies';

/** État d'une case équipement × mois. */
export type CellState = 'none' | 'done' | 'reserve' | 'partial' | 'overdue' | 'pending';

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
  /** Nombre d'OT de la case ayant au moins une action signalée en anomalie. */
  anomalies: number;
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
  /** Famille d'équipement : segment « type » du code (BAM-KNT_AG-ASC-01 → ASC). */
  family: string;
  /** Lot de la famille (ELEC, FLUIDE, CIRC, DIVERS) : voir equipmentFamilies.ts. */
  lot: LotCode;
  location: string;
  cells: MatrixCell[]; // une case par colonne (12 mois, ou 52/53 semaines)
  total: number;
  done: number;
  overdue: number;
  anomalies: number;
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

/** Un OT a une anomalie dès qu'une de ses actions est signalée en anomalie (case « Anomalie » de la checklist). */
export function hasAnomaly(wo: Pick<WorkOrder, 'tasks'>): boolean {
  return !!wo.tasks?.some(t => t.isAnomaly);
}

/** Statut d'exécution d'un OT pour le filtre « Statut » de la matrice. */
export type StatusBucket = 'done' | 'progress' | 'overdue' | 'planned';
export const STATUS_ORDER: StatusBucket[] = ['done', 'progress', 'overdue', 'planned'];
export const STATUS_LABELS: Record<StatusBucket, string> = {
  done: 'Réalisé (clôturé)', progress: 'En cours', overdue: 'En retard', planned: 'Planifié (à venir)',
};

/** Terminé → réalisé ; sinon échéance passée → en retard ; sinon « En cours » ; sinon planifié. */
export function statusBucketOf(wo: Pick<WorkOrder, 'status' | 'dueDate'>, today: string): StatusBucket {
  if (wo.status === 'Terminé') return 'done';
  if (wo.dueDate && wo.dueDate < today) return 'overdue';
  return wo.status === 'En cours' ? 'progress' : 'planned';
}

/** Segment « type » d'un code équipement : BAM-KNT_AG-ASC-01 → ASC ; « AUTRES » si le code n'a pas ce format. */
export function familyKeyOf(code?: string): string {
  const m = /-([A-Z0-9]+)-\d+\s*$/i.exec((code || '').trim());
  return m ? m[1].toUpperCase() : 'AUTRES';
}

/** Nom d'équipement sans numéro, marque ni caractéristiques : « ASCENSEUR N1 MARQUE: X » → « ASCENSEUR ». */
export function cleanFamilyName(label: string): string {
  const head = label.toUpperCase().split(/MARQUE|:|,/)[0];
  const words: string[] = [];
  for (const w of head.trim().split(/\s+/)) {
    if (!w || /\d/.test(w) || w === 'N' || w === 'N°') break;
    words.push(w);
  }
  return words.join(' ');
}

export interface FamilyOption { key: string; label: string; count: number }

/** Familles présentes dans les lignes (avec le nombre d'équipements), libellé déduit des noms. */
export function buildFamilyOptions(rows: Pick<MatrixRow, 'family' | 'label'>[]): FamilyOption[] {
  const groups = new Map<string, string[]>();
  for (const r of rows) {
    const list = groups.get(r.family) ?? [];
    list.push(cleanFamilyName(r.label));
    groups.set(r.family, list);
  }
  const options: FamilyOption[] = [];
  for (const [key, names] of groups) {
    const known = familyLabel(key);
    if (known) { options.push({ key, label: `${known} (${key})`, count: names.length }); continue; }
    const freq = new Map<string, number>();
    names.filter(Boolean).forEach(n => freq.set(n, (freq.get(n) ?? 0) + 1));
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0];
    let name = top ? top[0] : '';
    if (top && top[1] < names.length * 0.4) {
      // noms trop variés : on garde les mots communs à tous (ex. « ECLAIRAGE INTERIEUR »)
      const split = [...freq.keys()].map(n => n.split(' '));
      const common: string[] = [];
      for (let i = 0; i < split[0].length && split.every(w => w[i] === split[0][i]); i++) common.push(split[0][i]);
      if (common.length) name = common.join(' ');
    }
    options.push({ key, label: name ? `${name} (${key})` : key, count: names.length });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
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
        family: familyKeyOf(wo.equipmentCode),
        lot: lotOfFamily(familyKeyOf(wo.equipmentCode)),
        location: wo.location || '',
        cells: Array.from({ length: nCols }, () => ({ total: 0, done: 0, state: 'none' as CellState, orders: [], anomalies: 0, freqs: [] as string[] })),
        total: 0, done: 0, overdue: 0, anomalies: 0, percent: 0,
      };
      map.set(key, row);
    }
    const cell = row.cells[month];
    cell.total += 1;
    cell.orders.push(wo);
    row.total += 1;
    if (hasAnomaly(wo)) { cell.anomalies += 1; row.anomalies += 1; }
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
      else if (cell.done === cell.total) cell.state = cell.anomalies > 0 ? 'reserve' : 'done';
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
