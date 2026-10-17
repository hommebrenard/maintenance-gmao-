import React from 'react';
import type { LocationItem, MaintenanceRequest, WorkOrder } from '../../types';
import { computeDashboard, computeSiteRows, OT_STATUSES } from '../../utils/dashboardStats';
import { DISPLAY_STATE_CLASS } from '../../utils/requestDisplay';
import { STATE_ORDER } from '../../utils/requestFilters';

interface Props { workOrders: WorkOrder[]; requests: MaintenanceRequest[]; locations: LocationItem[] }

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1).replace('.', ',')} %`);
const num = (n: number) => n.toLocaleString('fr-FR');

function Kpi({ label, value, definition, tone = 'neutral' }: { label: string; value: string; definition: string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const color = tone === 'ok' ? 'text-green-700' : tone === 'warn' ? 'text-amber-700' : 'text-gray-900';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
      <p className="mt-2 text-[11px] leading-snug text-gray-500">{definition}</p>
    </div>
  );
}

function Bars({ rows, total }: { rows: { label: string; value: number; cls?: string }[]; total: number }) {
  return (
    <div className="space-y-1.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-3 text-xs">
          <span className={`w-28 shrink-0 rounded px-2 py-0.5 text-center ${r.cls ?? 'bg-gray-100 text-gray-700'}`}>{r.label}</span>
          <div className="h-2 flex-1 rounded bg-gray-100"><div className="h-2 rounded bg-blue-500" style={{ width: `${total ? (r.value / total) * 100 : 0}%` }} /></div>
          <span className="w-20 shrink-0 text-right tabular-nums text-gray-700">{num(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardView({ workOrders, requests, locations }: Props) {
  const [site, setSite] = React.useState('');
  const sites = React.useMemo(() => locations.filter(l => l.type === 'Site').sort((a, b) => a.name.localeCompare(b.name, 'fr')), [locations]);
  const input = React.useMemo(() => ({ workOrders, requests, locations }), [workOrders, requests, locations]);
  const { di, ot } = React.useMemo(() => computeDashboard(input, site), [input, site]);
  const siteRows = React.useMemo(() => (site ? [] : computeSiteRows(input)), [input, site]);
  const siteName = sites.find(s => s.id === site)?.name;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500">Ordres de travail et demandes d'intervention{siteName ? ` — ${siteName}` : ' — tous les sites'}.</p>
        </div>
        <label className="text-xs text-gray-600">
          Site
          <select value={site} onChange={e => setSite(e.target.value)} className="ml-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm">
            <option value="">Tous les sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Demandes d'intervention (DI)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="DI totales" value={num(di.total)} definition="Toutes les demandes chargées dans l'application, importées de Coswin ou créées ici." />
          <Kpi label="Taux de clôture" value={pct(di.closureRate)} tone="ok" definition="DI clôturées ÷ (DI totales − annulées − rejetées)." />
          <Kpi label="Taux d'annulation" value={pct(di.cancellationRate)} definition="(« DI annulée » + « OT annulé ») ÷ DI totales. Les DI rejetées dans l'application sont comptées à part." />
          <Kpi label="En attente > 30 jours" value={num(di.pendingOver30Days)} tone={di.pendingOver30Days ? 'warn' : 'neutral'} definition="DI à l'état « En attente » déclarées il y a plus de 30 jours." />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Répartition par état affiché</div>
          <Bars total={di.total} rows={STATE_ORDER.map(s => ({ label: s, value: di.byState[s], cls: DISPLAY_STATE_CLASS[s] }))} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Ordres de travail (OT)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="OT totaux" value={num(ot.total)} definition="Tous les OT chargés dans l'application (préventifs, correctifs, importés)." />
          <Kpi label="Taux d'achèvement" value={pct(ot.completionRate)} tone="ok" definition="OT « Terminé » ÷ (OT totaux − OT « Annulé »)." />
          <Kpi label="Taux d'annulation" value={pct(ot.cancellationRate)} definition="OT « Annulé » ÷ OT totaux." />
          <Kpi label="Échus non terminés" value={num(ot.overdueNotDone)} tone={ot.overdueNotDone ? 'warn' : 'neutral'} definition="OT ni « Terminé » ni « Annulé » dont l'échéance est antérieure à aujourd'hui." />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Répartition par statut</div>
          <Bars total={ot.total} rows={OT_STATUSES.map(s => ({ label: s, value: ot.byStatus[s] }))} />
        </div>
      </section>

      {!site && siteRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Par site</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr><th className="px-3 py-2">Site</th><th className="px-3 py-2 text-right">OT</th><th className="px-3 py-2 text-right">Achèvement OT</th><th className="px-3 py-2 text-right">DI</th><th className="px-3 py-2 text-right">Clôture DI</th></tr>
              </thead>
              <tbody>
                {siteRows.map(r => (
                  <tr key={r.code || r.name} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-900">{r.name}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{num(r.ot)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pct(r.otCompletionRate)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{num(r.di)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pct(r.diClosureRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
