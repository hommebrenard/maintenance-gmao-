import React from 'react';
import { Gauge, Plus, Settings, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { LocationItem } from '../../types';
import {
  computeIntervals, summarizeMonth, cosPhiStatus, weekdaysInMonth, DEFAULT_SETTINGS, COUNTER_LABELS,
  type EnergyReading, type SiteSettings, type CounterKey, type CosPhiStatus,
} from '../../utils/energyCalc';
import {
  fetchEnergyReadings, createEnergyReading, correctEnergyReading, validateEnergyReadings,
  fetchSiteSettings, saveSiteSettings, energyErrorMessage,
} from '../../lib/queries/energy';

const nf = (v: number | null, d = 0) => (v == null ? '—' : v.toLocaleString('fr-FR', { maximumFractionDigits: d }));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtDate = (iso: string) => iso.split('-').reverse().join('/');
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const shiftMonth = (m: string, n: number) => { const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

const COS_STYLE: Record<CosPhiStatus, { cls: string; label: string }> = {
  conforme: { cls: 'bg-emerald-100 text-emerald-800', label: 'Conforme (≥ 0,93)' },
  marge_faible: { cls: 'bg-amber-100 text-amber-800', label: 'Marge faible (0,90 à 0,93)' },
  non_conforme: { cls: 'bg-red-100 text-red-800', label: 'Sous le seuil contractuel 0,90' },
  inconnu: { cls: 'bg-gray-100 text-gray-600', label: 'Non calculable' },
};

interface FormState { date: string; conditions: string; elecHc: string; elecHp: string; elecPeak: string; reactive: string; water: string; irrigation: string; fuelPct: string; tempC: string; humidityPct: string; notes: string; reason: string }
const EMPTY: FormState = { date: '', conditions: '', elecHc: '', elecHp: '', elecPeak: '', reactive: '', water: '', irrigation: '', fuelPct: '', tempC: '', humidityPct: '', notes: '', reason: '' };
const s = (v: number | null | undefined) => (v == null ? '' : String(v));
const toForm = (r: EnergyReading): FormState => ({ ...EMPTY, date: r.date, conditions: r.conditions ?? '', elecHc: s(r.elecHc), elecHp: s(r.elecHp), elecPeak: s(r.elecPeak), reactive: s(r.reactive), water: s(r.water), irrigation: s(r.irrigation), fuelPct: s(r.fuelPct), tempC: s(r.tempC), humidityPct: s(r.humidityPct), notes: r.notes ?? '' });
/** '' → null ; nombre invalide → NaN. */
const parse = (t: string): number | null => { const x = t.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.'); if (x === '') return null; const n = Number(x); return Number.isFinite(n) ? n : NaN; };

export function MetersView({ locations, isManager }: { locations: LocationItem[]; isManager: boolean }) {
  const sites = React.useMemo(() => locations.filter(l => l.type === 'Site').sort((a, b) => a.name.localeCompare(b.name, 'fr')), [locations]);
  const [locationId, setLocationId] = React.useState('');
  const [month, setMonth] = React.useState(today().slice(0, 7));
  const [tab, setTab] = React.useState<'index' | 'conso'>('index');
  const [readings, setReadings] = React.useState<EnergyReading[]>([]);
  const [settings, setSettings] = React.useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<{ id: string | null; values: FormState } | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);

  const load = React.useCallback(async (id: string) => {
    setLoading(true); setError(null);
    try {
      const [r, st] = await Promise.all([fetchEnergyReadings(id), fetchSiteSettings(id)]);
      setReadings(r); setSettings(st);
    } catch (e) { setError(energyErrorMessage(e)); setReadings([]); setSettings(DEFAULT_SETTINGS); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { if (locationId) void load(locationId); }, [locationId, load]);

  const intervals = React.useMemo(() => computeIntervals(readings, settings.elecMultiplier), [readings, settings.elecMultiplier]);
  const monthReadings = readings.filter(r => r.date.startsWith(month));
  const monthIntervals = intervals.filter(i => i.date.startsWith(month));
  const sum = React.useMemo(() => summarizeMonth(intervals, month), [intervals, month]);
  const cosStatus = cosPhiStatus(sum.cosPhi);
  const pending = monthReadings.filter(r => r.status === 'a_valider');
  const t = today();
  const expected = settings.readingFrequency === 'quotidien' ? weekdaysInMonth(month, month === t.slice(0, 7) ? t : undefined) : null;

  const onValidateMonth = async () => {
    try { await validateEnergyReadings(pending.map(r => r.id)); await load(locationId); } catch (e) { setError(energyErrorMessage(e)); }
  };

  const counters: CounterKey[] = ['elecHc', 'elecHp', 'elecPeak', 'reactive', 'water', ...(settings.hasIrrigation ? ['irrigation' as CounterKey] : [])];
  const th = 'px-3 py-2 text-xs font-semibold text-gray-800 border border-gray-300';
  const td = 'px-3 py-1.5 text-right font-mono text-xs text-gray-900 border border-gray-200 whitespace-nowrap';

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-gray-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Compteurs</h1>
            <p className="text-sm text-gray-500 mt-1">Relevés d'électricité, d'eau et de gazoil par site ; consommations calculées entre relevés consécutifs.</p>
          </div>
          {isManager && locationId && (
            <div className="flex gap-2">
              <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg text-sm"><Settings className="w-4 h-4" />Réglages du site</button>
              <button onClick={() => setForm({ id: null, values: { ...EMPTY, date: t } })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm"><Plus className="w-4 h-4" />Nouveau relevé</button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={locationId} onChange={e => setLocationId(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white min-w-64">
            <option value="">Choisir un site…</option>
            {sites.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <div className="flex items-center gap-1 text-sm">
            <button onClick={() => setMonth(shiftMonth(month, -1))} className="px-2 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50" aria-label="Mois précédent">‹</button>
            <span className="px-3 font-semibold text-gray-900 capitalize w-36 text-center">{monthLabel(month)}</span>
            <button onClick={() => setMonth(shiftMonth(month, 1))} className="px-2 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50" aria-label="Mois suivant">›</button>
          </div>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            <button onClick={() => setTab('index')} className={`px-3 py-1.5 ${tab === 'index' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>Feuille des index</button>
            <button onClick={() => setTab('conso')} className={`px-3 py-1.5 ${tab === 'conso' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>Consommations</button>
          </div>
          {isManager && pending.length > 0 && <button onClick={onValidateMonth} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-emerald-300 text-emerald-800 bg-emerald-50 rounded-lg hover:bg-emerald-100"><CheckCircle2 className="w-4 h-4" />Valider le mois ({pending.length})</button>}
        </div>
      </div>

      <div className="flex-1 p-6 bg-gray-50/30 space-y-5">
        {error && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">{error}</p>}
        {!locationId && (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center bg-white max-w-3xl mx-auto">
            <Gauge className="w-8 h-8 text-blue-500 mx-auto mb-3" /><h3 className="text-lg font-semibold text-gray-900">Choisissez un site</h3>
            <p className="text-sm text-gray-500 mt-1">Les relevés sont enregistrés par site.</p>
          </div>
        )}
        {locationId && loading && <p className="text-sm text-gray-500">Chargement des relevés…</p>}
        {locationId && !loading && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white border border-gray-200 rounded-xl p-4"><div className="text-xs text-gray-500">Électricité active du mois</div><div className="text-xl font-bold text-gray-900">{nf(sum.actifKwh)} <span className="text-xs font-normal text-gray-500">kWh</span></div></div>
              <div className="bg-white border border-gray-200 rounded-xl p-4"><div className="text-xs text-gray-500">Eau du mois</div><div className="text-xl font-bold text-gray-900">{nf(sum.totals.water, 1)} <span className="text-xs font-normal text-gray-500">m³</span></div>{settings.hasIrrigation && <div className="text-xs text-gray-500 mt-1">Arrosage : {nf(sum.totals.irrigation, 1)} m³ (série séparée)</div>}</div>
              <div className="bg-white border border-gray-200 rounded-xl p-4"><div className="text-xs text-gray-500">cos φ du mois (estimé)</div><div className="text-xl font-bold text-gray-900">{sum.cosPhi == null ? '—' : sum.cosPhi.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</div><span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${COS_STYLE[cosStatus].cls}`}>{COS_STYLE[cosStatus].label}</span></div>
              <div className="bg-white border border-gray-200 rounded-xl p-4"><div className="text-xs text-gray-500">Relevés du mois</div><div className="text-xl font-bold text-gray-900">{monthReadings.length}{expected != null && <span className="text-xs font-normal text-gray-500"> / {expected} jours ouvrés</span>}</div>{sum.anomalyCount > 0 && <div className="text-xs text-amber-700 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{sum.anomalyCount} anomalie(s) d'index</div>}</div>
            </div>
            {monthReadings.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center bg-white"><p className="text-sm text-gray-600">Aucun relevé pour {monthLabel(month)}.</p></div>
            ) : tab === 'index' ? (
              <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={`${th} bg-sky-100`}>Date</th><th className={`${th} bg-yellow-100`}>Conditions</th>
                      <th className={`${th} bg-cyan-100`}>Actif creuses (kWh)</th><th className={`${th} bg-cyan-100`}>Actif pleines (kWh)</th><th className={`${th} bg-cyan-100`}>Actif pointe (kWh)</th><th className={`${th} bg-cyan-100`}>Réactif (kVARh)</th>
                      <th className={`${th} bg-orange-100`}>Eau (m³)</th>
                      {settings.hasIrrigation && <th className={`${th} bg-orange-100`}>Arrosage (m³)</th>}
                      <th className={`${th} bg-pink-100`}>Gazoil (%)</th>
                      {settings.hasClimate && <><th className={`${th} bg-lime-100`}>Temp. (°C)</th><th className={`${th} bg-lime-100`}>Humidité (%)</th></>}
                      <th className={`${th} bg-gray-100`}>Statut</th>{isManager && <th className={`${th} bg-gray-100`} />}
                    </tr>
                  </thead>
                  <tbody>
                    {monthReadings.map(r => (
                      <tr key={r.id}>
                        <td className={`${td} text-left font-semibold`}>{fmtDate(r.date)}</td><td className={`${td} text-left font-sans max-w-56 truncate`} title={r.conditions ?? ''}>{r.conditions ?? ''}</td>
                        <td className={td}>{nf(r.elecHc)}</td><td className={td}>{nf(r.elecHp)}</td><td className={td}>{nf(r.elecPeak)}</td><td className={td}>{nf(r.reactive)}</td>
                        <td className={td}>{nf(r.water, 1)}</td>{settings.hasIrrigation && <td className={td}>{nf(r.irrigation, 1)}</td>}
                        <td className={td}>{nf(r.fuelPct, 1)}</td>
                        {settings.hasClimate && <><td className={td}>{nf(r.tempC, 1)}</td><td className={td}>{nf(r.humidityPct, 1)}</td></>}
                        <td className={`${td} font-sans`}>{r.status === 'valide' ? <span className="text-emerald-700">Validé</span> : <span className="text-amber-700">À valider</span>}</td>
                        {isManager && <td className={`${td} font-sans`}><button onClick={() => setForm({ id: r.id, values: toForm(r) })} className="text-blue-600 hover:underline">Corriger</button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
                <table className="w-full border-collapse text-sm">
                  <thead><tr><th className={`${th} bg-sky-100`}>Relevé du</th><th className={`${th} bg-sky-100`}>Depuis le</th><th className={`${th} bg-sky-100`}>Jours</th>{counters.map(k => <th key={k} className={`${th} bg-cyan-100`}>{COUNTER_LABELS[k]}</th>)}<th className={`${th} bg-gray-100`}>Anomalies</th></tr></thead>
                  <tbody>
                    {monthIntervals.map(i => (
                      <tr key={i.date}>
                        <td className={`${td} text-left font-semibold`}>{fmtDate(i.date)}</td><td className={`${td} text-left`}>{fmtDate(i.prevDate)}</td><td className={td}>{i.days}</td>
                        {counters.map(k => <td key={k} className={td}>{nf(i.deltas[k], 1)}</td>)}
                        <td className={`${td} text-left font-sans text-amber-700`}>{i.anomalies.map(a => `${COUNTER_LABELS[a.counter]} : ${a.kind === 'baisse' ? 'baisse d\u2019index' : 'valeur manquante'}`).join(' ; ')}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-100 font-bold"><td className={`${td} text-left font-sans`} colSpan={3}>CONSO du mois</td>{counters.map(k => <td key={k} className={td}>{nf(sum.totals[k], 1)}</td>)}<td className={td} /></tr>
                  </tbody>
                </table>
                {monthIntervals.length === 0 && <p className="p-4 text-xs text-gray-500">Un seul relevé ce mois-ci et aucun relevé précédent : pas encore de consommation calculable.</p>}
              </div>
            )}
            <p className="text-[11px] text-gray-500 max-w-4xl">Consommation = différence entre deux relevés consécutifs, rattachée au mois du relevé de fin. Une baisse d'index n'est jamais corrigée automatiquement : elle est signalée et la consommation correspondante n'est pas calculée. cos φ = actif ÷ √(actif² + réactif²) sur la période ; seuil contractuel 0,90, valeur estimée.</p>
          </>
        )}
      </div>

      {form && locationId && <ReadingModal settings={settings} readings={readings} initial={form} locationId={locationId} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await load(locationId); }} />}
      {showSettings && locationId && <SettingsModal initial={settings} onClose={() => setShowSettings(false)} onSaved={async () => { setShowSettings(false); await load(locationId); }} locationId={locationId} />}
    </div>
  );
}

function Field({ label, unit, value, onChange }: { label: string; unit?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-700 mb-1">{label}{unit && <span className="font-normal text-gray-400"> ({unit})</span>}</span>
      <input inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono" />
    </label>
  );
}

function ReadingModal({ settings, readings, initial, locationId, onClose, onSaved }: {
  settings: SiteSettings; readings: EnergyReading[]; initial: { id: string | null; values: FormState }; locationId: string; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [v, setV] = React.useState<FormState>(initial.values);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof FormState) => (x: string) => setV(p => ({ ...p, [k]: x }));
  const isEdit = initial.id != null;

  const nums = { elecHc: parse(v.elecHc), elecHp: parse(v.elecHp), elecPeak: parse(v.elecPeak), reactive: parse(v.reactive), water: parse(v.water), irrigation: parse(v.irrigation), fuelPct: parse(v.fuelPct), tempC: parse(v.tempC), humidityPct: parse(v.humidityPct) };
  const invalid = Object.entries(nums).filter(([, n]) => n != null && Number.isNaN(n)).map(([k]) => k);
  // Relevé précédent (dernier relevé de date antérieure) pour prévenir d'une baisse d'index avant l'enregistrement.
  const prev = v.date ? [...readings].filter(r => r.date < v.date && r.id !== initial.id).sort((a, b) => b.date.localeCompare(a.date))[0] : undefined;
  const drops = prev ? (['elecHc', 'elecHp', 'elecPeak', 'reactive', 'water', 'irrigation'] as CounterKey[]).filter(k => { const n = nums[k]; const p = prev[k]; return typeof n === 'number' && !Number.isNaN(n) && p != null && n < p; }) : [];

  const save = async () => {
    setErr(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) { setErr('Date du relevé obligatoire.'); return; }
    if (invalid.length) { setErr('Une valeur n\u2019est pas un nombre.'); return; }
    if (isEdit && !v.reason.trim()) { setErr('Motif de la correction obligatoire.'); return; }
    const hasAny = Object.values(nums).some(n => n != null);
    if (!hasAny) { setErr('Renseignez au moins une valeur.'); return; }
    const payload = { locationId, date: v.date, time: null, conditions: v.conditions.trim() || null, ...nums, notes: v.notes.trim() || null } as Omit<EnergyReading, 'id' | 'status' | 'source'>;
    setBusy(true);
    try { if (isEdit) await correctEnergyReading(initial.id as string, payload, v.reason); else await createEnergyReading(payload); await onSaved(); }
    catch (e) { setErr(energyErrorMessage(e)); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900">{isEdit ? 'Corriger un relevé' : 'Nouveau relevé'}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-xs font-semibold text-gray-700 mb-1">Date du relevé</span><input type="date" value={v.date} onChange={e => set('date')(e.target.value)} disabled={isEdit} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100" /></label>
          <label className="block"><span className="block text-xs font-semibold text-gray-700 mb-1">Conditions extérieures (facultatif)</span><input value={v.conditions} onChange={e => set('conditions')(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Actif creuses" unit="kWh" value={v.elecHc} onChange={set('elecHc')} /><Field label="Actif pleines" unit="kWh" value={v.elecHp} onChange={set('elecHp')} />
          <Field label="Actif pointe" unit="kWh" value={v.elecPeak} onChange={set('elecPeak')} /><Field label="Réactif" unit="kVARh" value={v.reactive} onChange={set('reactive')} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Eau" unit="m³" value={v.water} onChange={set('water')} />
          {settings.hasIrrigation && <Field label="Eau d'arrosage" unit="m³" value={v.irrigation} onChange={set('irrigation')} />}
          <Field label="Gazoil (niveau)" unit="%" value={v.fuelPct} onChange={set('fuelPct')} />
          {settings.hasClimate && <><Field label="Température" unit="°C" value={v.tempC} onChange={set('tempC')} /><Field label="Humidité" unit="%" value={v.humidityPct} onChange={set('humidityPct')} /></>}
        </div>
        <label className="block"><span className="block text-xs font-semibold text-gray-700 mb-1">Observations (facultatif)</span><input value={v.notes} onChange={e => set('notes')(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></label>
        {isEdit && <label className="block"><span className="block text-xs font-semibold text-gray-700 mb-1">Motif de la correction (obligatoire)</span><input value={v.reason} onChange={e => set('reason')(e.target.value)} className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg" /></label>}
        {drops.length > 0 && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Baisse d'index par rapport au relevé du {fmtDate(prev!.date)} : {drops.map(k => COUNTER_LABELS[k]).join(', ')}. Le relevé sera enregistré et signalé ; la consommation correspondante ne sera pas calculée.</p>}
        {err && <p className="text-xs text-red-700">{err}</p>}
        <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Annuler</button>
          <button onClick={save} disabled={busy} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">{isEdit ? 'Enregistrer la correction' : 'Enregistrer le relevé'}</button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ initial, locationId, onClose, onSaved }: { initial: SiteSettings; locationId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [v, setV] = React.useState<SiteSettings>(initial);
  const [txt, setTxt] = React.useState({ tmin: s(initial.tempMinC), tmax: s(initial.tempMaxC), hmin: s(initial.humidityMinPct), hmax: s(initial.humidityMaxPct), cuve: s(initial.fuelCapacityL), mult: String(initial.elecMultiplier) });
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const save = async () => {
    const p = { tmin: parse(txt.tmin), tmax: parse(txt.tmax), hmin: parse(txt.hmin), hmax: parse(txt.hmax), cuve: parse(txt.cuve), mult: parse(txt.mult) };
    if (Object.values(p).some(x => Number.isNaN(x))) { setErr('Une valeur n\u2019est pas un nombre.'); return; }
    if (p.mult == null || p.mult <= 0) { setErr('Le coefficient multiplicateur doit être supérieur à 0 (1 par défaut).'); return; }
    setBusy(true);
    try {
      await saveSiteSettings(locationId, { ...v, tempMinC: p.tmin, tempMaxC: p.tmax, humidityMinPct: p.hmin, humidityMaxPct: p.hmax, fuelCapacityL: p.cuve, elecMultiplier: p.mult });
      await onSaved();
    } catch (e) { setErr(energyErrorMessage(e)); setBusy(false); }
  };
  const chk = 'rounded border-gray-300';
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Réglages du site</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className={chk} checked={v.hasIrrigation} onChange={e => setV({ ...v, hasIrrigation: e.target.checked })} />Ce site a un compteur d'arrosage (série séparée de l'eau)</label>
        {v.hasIrrigation && <label className="block text-sm"><span className="block text-xs font-semibold text-gray-700 mb-1">Source de l'arrosage</span><select value={v.irrigationSource ?? ''} onChange={e => setV({ ...v, irrigationSource: (e.target.value || null) as SiteSettings['irrigationSource'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"><option value="">Non précisée</option><option value="puits">Puits</option><option value="eau_recyclee">Eau recyclée (fournisseur)</option><option value="reseau_potable">Réseau d'eau potable</option><option value="autre">Autre</option></select></label>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className={chk} checked={v.hasClimate} onChange={e => setV({ ...v, hasClimate: e.target.checked })} />Ce site relève la température et l'hygrométrie</label>
        {v.hasClimate && <div className="grid grid-cols-2 gap-3"><Field label="Température min" unit="°C" value={txt.tmin} onChange={x => setTxt({ ...txt, tmin: x })} /><Field label="Température max" unit="°C" value={txt.tmax} onChange={x => setTxt({ ...txt, tmax: x })} /><Field label="Humidité min" unit="%" value={txt.hmin} onChange={x => setTxt({ ...txt, hmin: x })} /><Field label="Humidité max" unit="%" value={txt.hmax} onChange={x => setTxt({ ...txt, hmax: x })} /></div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Capacité de la cuve gazoil (laisser vide si inconnue)" unit="L" value={txt.cuve} onChange={x => setTxt({ ...txt, cuve: x })} />
          <Field label="Coefficient multiplicateur des index électriques" value={txt.mult} onChange={x => setTxt({ ...txt, mult: x })} />
        </div>
        <label className="block text-sm"><span className="block text-xs font-semibold text-gray-700 mb-1">Fréquence des relevés eau et électricité</span><select value={v.readingFrequency} onChange={e => setV({ ...v, readingFrequency: e.target.value as SiteSettings['readingFrequency'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"><option value="quotidien">Quotidien (jours ouvrés)</option><option value="hebdomadaire">Hebdomadaire</option></select></label>
        {err && <p className="text-xs text-red-700">{err}</p>}
        <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Annuler</button>
          <button onClick={save} disabled={busy} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
