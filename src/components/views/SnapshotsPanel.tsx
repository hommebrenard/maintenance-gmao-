import React from 'react';
import { fetchMyRole, fetchSnapshotScope, fetchSnapshots, saveDashboardSnapshot, type SnapshotHeader } from '../../lib/queries/dashboardSnapshots';
import { compareWithSnapshot, currentPeriod, periodLabel, type IndicatorValues, type SnapshotRow } from '../../utils/dashboardSnapshot';

interface Props {
  live: IndicatorValues;                 // indicateurs du périmètre affiché, calculés maintenant
  scopeKey: string;                      // 'ALL' ou clé du site affiché
  scopeLabel: string;
  buildRows: () => SnapshotRow[];        // calcule tous les sites au moment du clic
}
const num = (n: number) => n.toLocaleString('fr-FR');
const fmt = (x: { value: number; denominator: number | null } | null) => x === null ? '—' : x.denominator !== null ? `${num(x.value)} sur ${num(x.denominator)}` : num(x.value);

export function SnapshotsPanel({ live, scopeKey, scopeLabel, buildRows }: Props) {
  const [role, setRole] = React.useState<string | null>(null);
  const [snaps, setSnaps] = React.useState<SnapshotHeader[]>([]);
  const [selected, setSelected] = React.useState('');
  const [snapValues, setSnapValues] = React.useState<IndicatorValues | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const isManager = role === 'responsable' || role === 'admin';
  const period = currentPeriod(new Date());
  const existing = snaps.find(s => s.period === period);

  const reload = React.useCallback(async () => {
    try { const list = await fetchSnapshots(); setSnaps(list); setSelected(cur => cur && list.some(s => s.id === cur) ? cur : (list[0]?.id ?? '')); }
    catch (e) { setMsg({ ok: false, text: `Lecture des instantanés impossible : ${(e as Error).message}` }); }
  }, []);
  React.useEffect(() => { void fetchMyRole().then(setRole); void reload(); }, [reload]);
  React.useEffect(() => {
    if (!selected) { setSnapValues(null); return; }
    let live = true;
    fetchSnapshotScope(selected, scopeKey).then(v => { if (live) setSnapValues(Object.keys(v).length ? v : null); }).catch(() => { if (live) setSnapValues(null); });
    return () => { live = false; };
  }, [selected, scopeKey]);

  const save = async () => {
    const replace = !!existing;
    if (replace && !window.confirm(`Un instantané existe déjà pour ${periodLabel(period)}. Le remplacer par l'état d'aujourd'hui ?`)) return;
    setBusy(true); setMsg(null);
    try {
      const res = await saveDashboardSnapshot(period, buildRows(), null, replace);
      setMsg({ ok: true, text: `Instantané de ${periodLabel(period)} ${res.replaced ? 'remplacé' : 'enregistré'} (${num(res.rows)} valeurs).` });
      await reload();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const rows = compareWithSnapshot(snapValues, live);
  const sel = snaps.find(s => s.id === selected);
  const tone = (goodWhen: string, d: number) => d === 0 || goodWhen === 'neutral' ? 'text-gray-600' : (goodWhen === 'down') === (d < 0) ? 'text-green-700' : 'text-red-700';

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-800">Instantanés mensuels</h2>
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] leading-snug text-gray-500">
          Un instantané est une photo figée des indicateurs de tous les sites, enregistrée une fois par mois. L'historique commence au premier instantané : un mois non enregistré ne peut pas être reconstitué. Aucune donnée de l'application n'est modifiée.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {isManager ? (
            <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {busy ? 'Enregistrement…' : existing ? `Remplacer l'instantané de ${periodLabel(period)}` : `Enregistrer l'instantané de ${periodLabel(period)}`}
            </button>
          ) : <span className="text-[11px] text-gray-500">L'enregistrement est réservé au responsable.</span>}
          {snaps.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-gray-600">Comparer avec
              <select value={selected} onChange={e => setSelected(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs">
                {snaps.map(s => <option key={s.id} value={s.id}>{periodLabel(s.period)}</option>)}
              </select>
            </label>
          )}
        </div>
        {msg && <p className={`text-xs ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}
        {snaps.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun instantané enregistré pour l'instant.</p>
        ) : !snapValues ? (
          <p className="text-sm text-gray-500">Cet instantané ne contient pas de valeurs pour « {scopeLabel} » (site absent ou sans DI ni OT à cette date).</p>
        ) : (
          <div className="overflow-x-auto">
            <p className="mb-1 text-[11px] text-gray-500">Périmètre : {scopeLabel}. Instantané de {sel ? periodLabel(sel.period) : ''}{sel ? `, pris le ${new Date(sel.taken_at).toLocaleDateString('fr-FR')}` : ''}, comparé à l'état d'aujourd'hui.</p>
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-gray-500">
                <tr><th className="px-2 py-1.5">Indicateur</th><th className="px-2 py-1.5 text-right">Instantané</th><th className="px-2 py-1.5 text-right">Aujourd'hui</th><th className="px-2 py-1.5 text-right">Écart</th></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.def.key} className="border-t border-gray-100">
                    <td className="px-2 py-1.5 text-gray-800"><span className="mr-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{r.def.group}</span>{r.def.label}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-600">{fmt(r.before)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-900">{fmt(r.now)}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${r.delta === null ? 'text-gray-400' : tone(r.def.goodWhen, r.delta)}`}>{r.delta === null ? '—' : `${r.delta > 0 ? '+' : ''}${num(r.delta)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
