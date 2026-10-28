import { supabase } from '../supabaseClient';
import { DEFAULT_SETTINGS, type EnergyReading, type SiteSettings } from '../../utils/energyCalc';

// Tables `energy_readings` et `energy_site_settings` (script sql/27). Lecture : tout compte connecté ; écriture : managers.

const COLS = 'id, location_id, reading_date, reading_time, conditions, elec_hc_kwh, elec_hp_kwh, elec_peak_kwh, reactive_kvarh, water_m3, irrigation_m3, fuel_pct, temp_c, humidity_pct, notes, source, status';

const num = (v: unknown): number | null => (v == null ? null : Number(v));

function rowToReading(r: Record<string, unknown>): EnergyReading {
  return {
    id: r.id as string,
    locationId: r.location_id as string,
    date: r.reading_date as string,
    time: (r.reading_time as string | null) ?? null,
    conditions: (r.conditions as string | null) ?? null,
    elecHc: num(r.elec_hc_kwh), elecHp: num(r.elec_hp_kwh), elecPeak: num(r.elec_peak_kwh), reactive: num(r.reactive_kvarh),
    water: num(r.water_m3), irrigation: num(r.irrigation_m3), fuelPct: num(r.fuel_pct),
    tempC: num(r.temp_c), humidityPct: num(r.humidity_pct),
    notes: (r.notes as string | null) ?? null,
    source: r.source as EnergyReading['source'],
    status: r.status as EnergyReading['status'],
  };
}

function readingToRow(x: Omit<EnergyReading, 'id' | 'status' | 'source'>) {
  return {
    location_id: x.locationId, reading_date: x.date, reading_time: x.time ?? null, conditions: x.conditions || null,
    elec_hc_kwh: x.elecHc, elec_hp_kwh: x.elecHp, elec_peak_kwh: x.elecPeak, reactive_kvarh: x.reactive,
    water_m3: x.water, irrigation_m3: x.irrigation, fuel_pct: x.fuelPct, temp_c: x.tempC, humidity_pct: x.humidityPct,
    notes: x.notes || null,
  };
}

/** Message lisible pour les erreurs Supabase courantes. */
export function energyErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === '23505') return 'Un relevé existe déjà pour ce site à cette date.';
  if (err?.code === '42501' || /row-level security/i.test(err?.message ?? '')) return 'Droits insuffisants (réservé aux managers).';
  if (err?.code === '42P01') return 'Tables Compteurs absentes : le script sql/27 a-t-il été exécuté ?';
  return err?.message ?? 'Erreur inconnue.';
}

export async function fetchEnergyReadings(locationId: string): Promise<EnergyReading[]> {
  const { data, error } = await supabase
    .from('energy_readings').select(COLS).eq('location_id', locationId)
    .order('reading_date', { ascending: true }).limit(5000);
  if (error) throw error;
  return (data ?? []).map(rowToReading);
}

export async function createEnergyReading(x: Omit<EnergyReading, 'id' | 'status' | 'source'>): Promise<EnergyReading> {
  const { data, error } = await supabase
    .from('energy_readings').insert({ ...readingToRow(x), source: 'manual' }).select(COLS).single();
  if (error) throw error;
  return rowToReading(data as Record<string, unknown>);
}

/** Correction : le motif est obligatoire (contrôlé aussi par la base) et alimente l'historique. */
export async function correctEnergyReading(id: string, x: Omit<EnergyReading, 'id' | 'status' | 'source'>, reason: string): Promise<EnergyReading> {
  const { data, error } = await supabase
    .from('energy_readings').update({ ...readingToRow(x), change_reason: reason.trim() }).eq('id', id).select(COLS).single();
  if (error) throw error;
  return rowToReading(data as Record<string, unknown>);
}

export async function validateEnergyReadings(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('energy_readings').update({ status: 'valide' }).in('id', ids);
  if (error) throw error;
}

export async function fetchSiteSettings(locationId: string): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from('energy_site_settings')
    .select('has_irrigation, irrigation_source, has_climate, temp_min_c, temp_max_c, humidity_min_pct, humidity_max_pct, fuel_capacity_l, reading_frequency, elec_multiplier')
    .eq('location_id', locationId).maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_SETTINGS;
  return {
    hasIrrigation: !!data.has_irrigation, irrigationSource: data.irrigation_source ?? null, hasClimate: !!data.has_climate,
    tempMinC: num(data.temp_min_c), tempMaxC: num(data.temp_max_c),
    humidityMinPct: num(data.humidity_min_pct), humidityMaxPct: num(data.humidity_max_pct),
    fuelCapacityL: num(data.fuel_capacity_l),
    readingFrequency: data.reading_frequency === 'hebdomadaire' ? 'hebdomadaire' : 'quotidien',
    elecMultiplier: num(data.elec_multiplier) ?? 1,
  };
}

export async function saveSiteSettings(locationId: string, s: SiteSettings): Promise<void> {
  const { error } = await supabase.from('energy_site_settings').upsert({
    location_id: locationId, has_irrigation: s.hasIrrigation, irrigation_source: s.hasIrrigation ? s.irrigationSource : null,
    has_climate: s.hasClimate, temp_min_c: s.tempMinC, temp_max_c: s.tempMaxC,
    humidity_min_pct: s.humidityMinPct, humidity_max_pct: s.humidityMaxPct, fuel_capacity_l: s.fuelCapacityL,
    reading_frequency: s.readingFrequency, elec_multiplier: s.elecMultiplier, updated_at: new Date().toISOString(),
  }, { onConflict: 'location_id' });
  if (error) throw error;
}
