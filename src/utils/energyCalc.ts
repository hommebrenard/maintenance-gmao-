// Calculs de l'onglet Compteurs (relevés énergétiques par site).
// Règles : consommation = différence entre deux relevés CONSÉCUTIFS (même d'un mois à l'autre) ;
// une baisse d'index n'est jamais masquée : consommation non calculée et anomalie signalée ;
// les durées se calculent à partir des dates (jamais saisies) et ne dépendent pas du fuseau de la machine.

export const CONTRACT_COS_PHI = 0.9; // seuil contractuel
export const COS_PHI_MARGIN = 0.93; // en dessous : « marge faible »

export type CounterKey = 'elecHc' | 'elecHp' | 'elecPeak' | 'reactive' | 'water' | 'irrigation';
export const COUNTER_KEYS: CounterKey[] = ['elecHc', 'elecHp', 'elecPeak', 'reactive', 'water', 'irrigation'];
const ELEC_KEYS: CounterKey[] = ['elecHc', 'elecHp', 'elecPeak', 'reactive'];

export const COUNTER_LABELS: Record<CounterKey, string> = {
  elecHc: 'Actif heures creuses',
  elecHp: 'Actif heures pleines',
  elecPeak: 'Actif heures de pointe',
  reactive: 'Réactif',
  water: 'Eau',
  irrigation: 'Eau d\u2019arrosage',
};

export interface EnergyReading {
  id: string;
  locationId: string;
  date: string; // YYYY-MM-DD (jour local du site)
  time?: string | null;
  conditions?: string | null;
  elecHc: number | null;
  elecHp: number | null;
  elecPeak: number | null;
  reactive: number | null;
  water: number | null;
  irrigation: number | null;
  fuelPct: number | null;
  tempC: number | null;
  humidityPct: number | null;
  notes?: string | null;
  source: 'manual' | 'import' | 'telemetry';
  status: 'a_valider' | 'valide';
}

export interface SiteSettings {
  hasIrrigation: boolean;
  irrigationSource: 'puits' | 'eau_recyclee' | 'reseau_potable' | 'autre' | null;
  hasClimate: boolean;
  tempMinC: number | null;
  tempMaxC: number | null;
  humidityMinPct: number | null;
  humidityMaxPct: number | null;
  fuelCapacityL: number | null;
  readingFrequency: 'quotidien' | 'hebdomadaire';
  elecMultiplier: number;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  hasIrrigation: false, irrigationSource: null, hasClimate: false,
  tempMinC: null, tempMaxC: null, humidityMinPct: null, humidityMaxPct: null,
  fuelCapacityL: null, readingFrequency: 'quotidien', elecMultiplier: 1,
};

export interface Anomaly { counter: CounterKey; kind: 'baisse' | 'manquant' }
export interface Interval {
  date: string;
  prevDate: string;
  days: number;
  deltas: Record<CounterKey, number | null>;
  anomalies: Anomaly[];
}

/** Nombre de jours entre deux dates YYYY-MM-DD, sans dépendre du fuseau. */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** Intervalles entre relevés consécutifs (triés par date). `multiplier` : coefficient des index électriques (défaut 1). */
export function computeIntervals(readings: EnergyReading[], multiplier = 1): Interval[] {
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
  const out: Interval[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const deltas = {} as Record<CounterKey, number | null>;
    const anomalies: Anomaly[] = [];
    for (const k of COUNTER_KEYS) {
      const a = prev[k];
      const b = cur[k];
      if (b == null) {
        deltas[k] = null;
        if (a != null) anomalies.push({ counter: k, kind: 'manquant' });
      } else if (a == null) {
        deltas[k] = null; // première valeur connue : sert de base, pas une anomalie
      } else if (b < a) {
        deltas[k] = null;
        anomalies.push({ counter: k, kind: 'baisse' });
      } else {
        deltas[k] = (b - a) * (ELEC_KEYS.includes(k) ? multiplier : 1);
      }
    }
    out.push({ date: cur.date, prevDate: prev.date, days: daysBetween(prev.date, cur.date), deltas, anomalies });
  }
  return out;
}

/** cos φ = actif / √(actif² + réactif²), sur la même période. */
export function cosPhi(actifKwh: number | null, reactiveKvarh: number | null): number | null {
  if (actifKwh == null || reactiveKvarh == null || actifKwh <= 0) return null;
  return actifKwh / Math.sqrt(actifKwh * actifKwh + reactiveKvarh * reactiveKvarh);
}

export type CosPhiStatus = 'conforme' | 'marge_faible' | 'non_conforme' | 'inconnu';
export function cosPhiStatus(c: number | null): CosPhiStatus {
  if (c == null) return 'inconnu';
  if (c >= COS_PHI_MARGIN) return 'conforme';
  if (c >= CONTRACT_COS_PHI) return 'marge_faible';
  return 'non_conforme';
}

export interface MonthSummary {
  totals: Record<CounterKey, number | null>;
  actifKwh: number | null;
  cosPhi: number | null;
  daysCovered: number;
  intervalCount: number;
  anomalyCount: number;
}

/** Consommations des intervalles dont la date de fin tombe dans le mois (`YYYY-MM`). */
export function summarizeMonth(intervals: Interval[], month: string): MonthSummary {
  const inMonth = intervals.filter(i => i.date.startsWith(month));
  const totals = {} as Record<CounterKey, number | null>;
  for (const k of COUNTER_KEYS) {
    const vals = inMonth.map(i => i.deltas[k]).filter((v): v is number => v != null);
    totals[k] = vals.length ? vals.reduce((s, v) => s + v, 0) : null;
  }
  const act = [totals.elecHc, totals.elecHp, totals.elecPeak].filter((v): v is number => v != null);
  const actifKwh = act.length ? act.reduce((s, v) => s + v, 0) : null;
  return {
    totals,
    actifKwh,
    cosPhi: cosPhi(actifKwh, totals.reactive),
    daysCovered: inMonth.reduce((s, i) => s + i.days, 0),
    intervalCount: inMonth.length,
    anomalyCount: inMonth.reduce((s, i) => s + i.anomalies.length, 0),
  };
}

/** Jours ouvrés (lundi à vendredi) du mois jusqu'à `upTo` inclus (jours fériés non gérés). */
export function weekdaysInMonth(month: string, upTo?: string): number {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= last; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    if (upTo && iso > upTo) break;
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}
