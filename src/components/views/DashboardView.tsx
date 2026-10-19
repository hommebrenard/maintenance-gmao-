import React from 'react';
import type { LocationItem, MaintenanceRequest, WorkOrder } from '../../types';
import { computeDashboard, computeSiteRows, OT_STATUSES } from '../../utils/dashboardStats';
import { DISPLAY_STATE_CLASS } from '../../utils/requestDisplay';
import { STATE_ORDER } from '../../utils/requestFilters';
import { DI_AGE_DEFS, DI_PRIORITIES, computeDiHeatmap, diHeatToCsv, filterRequestsBySite, type DiAgeKey, type DiHeatItem, type DiPriorityKey } from '../../utils/diHeatmap';
import { COSWIN_STATE_LABEL, computeCompletionSplit, computeOverdueAging, filterWorkOrdersBySite, overdueToCsv, type AgingKey, type OverdueItem } from '../../utils/otAging';

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

const AGING_BAR: Record<AgingKey, string> = { d30: 'bg-amber-400', d90: 'bg-orange-500', d180: 'bg-red-500', d180p: 'bg-red-700' };
const PAGE = 100;

function downloadCsv(items: OverdueItem[], name: string, csv: string = overdueToCsv(items)) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function DashboardView({ workOrders, requests, locations }: Props) {
  const [site, setSite] = React.useState('');
  const sites = React.useMemo(() => locations.filter(l => l.type === 'Site').sort((a, b) => a.name.localeCompare(b.name, 'fr')), [locations]);
  const input = React.useMemo(() => ({ workOrders, requests, locations }), [workOrders, requests, locations]);
  const { di, ot } = React.useMemo(() => computeDashboard(input, site), [input, site]);
  const siteRows = React.useMemo(() => (site ? [] : computeSiteRows(input)), [input, site]);
  const siteName = sites.find(s => s.id === site)?.name;
  const scopedOts = React.useMemo(() => filterWorkOrdersBySite(workOrders, locations, site), [workOrders, locations, site]);
  const aging = React.useMemo(() => computeOverdueAging(scopedOts, new Date()), [scopedOts]);
  const split = React.useMemo(() => computeCompletionSplit(scopedOts), [scopedOts]);
  const [agingSel, setAgingSel] = React.useState<AgingKey | 'all' | null>(null);
  const [agingCov, setAgingCov] = React.useState<'all' | 'loaded' | 'notLoaded' | 'notCreated'>('all');
  const [agingLimit, setAgingLimit] = React.useState(PAGE);
  const selectAging = (k: AgingKey | 'all' | null) => { setAgingSel(k); setAgingLimit(PAGE); };
  const agingItems: OverdueItem[] = agingSel === null ? [] : agingSel === 'all'
    ? aging.buckets.flatMap(b => b.items).sort((a, b) => b.daysLate - a.daysLate)
    : aging.buckets.find(b => b.key === agingSel)?.items ?? [];
  const agingShown = agingItems.filter(i => agingCov === 'all' || i.coswin === agingCov);
  const scopedReqs = React.useMemo(() => filterRequestsBySite(requests, locations, site), [requests, locations, site]);
  const heat = React.useMemo(() => computeDiHeatmap(scopedReqs, workOrders, new Date()), [scopedReqs, workOrders]);
  const [heatSel, setHeatSel] = React.useState<{ p: DiPriorityKey; a: DiAgeKey } | null>(null);
  const [heatLimit, setHeatLimit] = React.useState(PAGE);
  const heatMax = Math.max(1, ...DI_PRIORITIES.flatMap(p => DI_AGE_DEFS.map(a => heat.cells[p.key][a.key].length)));
  const heatItems: DiHeatItem[] = heatSel ? heat.cells[heatSel.p][heatSel.a] : [];
  const agingLabel = agingSel === 'all' ? 'tous les retards' : aging.buckets.find(b => b.key === agingSel)?.label ?? '';

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
          <Kpi label="Échus non terminés" value={num(ot.overdueNotDone)} tone={ot.overdueNotDone ? 'warn' : 'neutral'} definition={`OT ni « Terminé » ni « Annulé » dont l'échéance est antérieure à aujourd'hui.${aging.notLoadedTotal ? ' Attention : ' + num(aging.notLoadedTotal) + ' de ces OT concernent des sites/mois dont l\'état Coswin n\'est pas chargé (voir « Retard par ancienneté »).' : ''}`} />
          <Kpi label="Clôturés dans Coswin, non régularisés" value={num(split.coswinUnregularized)} tone={split.coswinUnregularized ? 'warn' : 'neutral'} definition="OT « Terminé » via l'import Coswin, sans checklist ni visa renseignés dans l'application : clôture administrative, pas une preuve d'exécution." />
          <Kpi label="Achèvement hors clôtures Coswin non régularisées" value={pct(split.rateExcludingCoswin)} definition="(OT « Terminé » − clôturés dans Coswin non régularisés) ÷ (OT totaux − OT « Annulé »). À lire avec le taux d'achèvement ci-dessus, qui inclut ces clôtures administratives." />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Répartition par statut</div>
          <Bars total={ot.total} rows={OT_STATUSES.map(s => ({ label: s, value: ot.byStatus[s] }))} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Retard par ancienneté</h2>
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-[11px] leading-snug text-gray-500">
            OT ni « Terminé » ni « Annulé » dont l'échéance est dépassée, classés selon le nombre de jours de retard. Aucun OT n'est exclu automatiquement : un retard ancien peut être une clôture oubliée dans l'application ou un OT réellement en souffrance, à vérifier avant toute conclusion. Cliquez sur une tranche pour afficher la liste nominative.
          </p>
          {aging.notLoadedTotal > 0 && (
            <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-snug text-amber-900">
              <b>Retards calculés avant le chargement de l'état Coswin.</b> {num(aging.notLoadedTotal)} des {num(aging.total)} OT en retard ({pct(aging.total ? aging.notLoadedTotal / aging.total : null)}) appartiennent à des sites ou à des mois dont les clôtures Coswin n'ont pas encore été importées : ils peuvent déjà être terminés dans Coswin. <b>{num(aging.loadedTotal)}</b> seulement sont confirmés par un état Coswin chargé{aging.notCreatedTotal > 0 ? <>, et <b>{num(aging.notCreatedTotal)}</b> n'ont pas de numéro Coswin (OT « NC », non créés dans Coswin : leur retard ne dépend pas d'un import)</> : null}. Importez l'état Coswin (bouton « Clôture Coswin » de l'onglet Ordres de travail) avant de tirer une conclusion.
            </div>
          )}
          {aging.total === 0 ? (
            <p className="text-sm text-gray-500">Aucun OT en retard pour ce périmètre.</p>
          ) : (
            <div className="space-y-1">
              {aging.buckets.map(b => (
                <button key={b.key} type="button" onClick={() => selectAging(agingSel === b.key ? null : b.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${agingSel === b.key ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50'}`}>
                  <span className="w-36 shrink-0 text-gray-700">{b.label}</span>
                  <div className="h-3 flex-1 rounded bg-gray-100"><div className={`h-3 rounded ${AGING_BAR[b.key]}`} style={{ width: `${aging.total ? (b.items.length / aging.total) * 100 : 0}%` }} /></div>
                  <span className="w-44 shrink-0 text-right tabular-nums text-gray-700">{num(b.items.length)} <span className="text-gray-400">({pct(aging.total ? b.items.length / aging.total : null)}) · <span className="text-green-700">{num(b.items.filter(i => i.coswin === 'loaded').length)} confirmés</span></span></span>
                </button>
              ))}
              <div className="flex items-center justify-between px-2 pt-1 text-xs text-gray-600">
                <span>Total en retard : <b className="tabular-nums">{num(aging.total)}</b></span>
                <button type="button" onClick={() => selectAging(agingSel === 'all' ? null : 'all')} className="font-medium text-blue-600 hover:underline">{agingSel === 'all' ? 'Masquer la liste' : 'Voir tous les retards'}</button>
              </div>
            </div>
          )}
          {aging.withoutDueDate > 0 && (
            <p className="text-[11px] text-amber-700">{num(aging.withoutDueDate)} OT non terminés n'ont pas de date d'échéance : ils ne peuvent pas être classés par ancienneté.</p>
          )}
        </div>

        {agingSel !== null && agingItems.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <div className="text-sm font-semibold text-gray-800">OT en retard — {agingLabel} <span className="font-normal text-gray-500">({num(agingShown.length)})</span></div>
              <label className="text-xs text-gray-600">
                État Coswin
                <select value={agingCov} onChange={e => { setAgingCov(e.target.value as 'all' | 'loaded' | 'notLoaded' | 'notCreated'); setAgingLimit(PAGE); }} className="ml-2 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs">
                  <option value="all">Tous</option>
                  <option value="loaded">Chargé (retard confirmé)</option>
                  <option value="notLoaded">Non chargé (à confirmer)</option>
                  <option value="notCreated">Non créé dans Coswin (NC)</option>
                </select>
              </label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => downloadCsv(agingShown, `ot-en-retard-${new Date().toISOString().slice(0, 10)}.csv`)} className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">Exporter en CSV</button>
                <button type="button" onClick={() => selectAging(null)} className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">Fermer</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Titre</th><th className="px-3 py-2">Équipement</th><th className="px-3 py-2">Site</th><th className="px-3 py-2">Échéance</th><th className="px-3 py-2 text-right">Retard</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">Responsable</th><th className="px-3 py-2">État Coswin</th></tr>
                </thead>
                <tbody>
                  {agingShown.slice(0, agingLimit).map(({ wo, daysLate, coswin }) => (
                    <tr key={wo.id} className="border-t border-gray-100">
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-gray-700">{wo.code}</td>
                      <td className="max-w-xs truncate px-3 py-1.5 text-gray-900" title={wo.title}>{wo.title}</td>
                      <td className="max-w-[200px] truncate px-3 py-1.5 text-gray-600" title={wo.equipmentName}>{wo.equipmentName || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{wo.location || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-gray-600">{(wo.dueDate || '').slice(0, 10).split('-').reverse().join('/')}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-900">{num(daysLate)} j</td>
                      <td className="px-3 py-1.5 text-gray-600">{wo.status}</td>
                      <td className="px-3 py-1.5 text-gray-600">{wo.assignee || wo.planner || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-1.5"><span className={coswin === 'loaded' ? 'text-green-700' : coswin === 'notCreated' ? 'text-indigo-700' : 'text-amber-700'}>{COSWIN_STATE_LABEL[coswin]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {agingShown.length > agingLimit && (
              <div className="border-t border-gray-100 px-4 py-2 text-center">
                <button type="button" onClick={() => setAgingLimit(l => l + PAGE)} className="text-xs font-medium text-blue-600 hover:underline">Afficher les {Math.min(PAGE, agingShown.length - agingLimit)} suivants ({num(agingShown.length - agingLimit)} restants)</button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">DI sans OT par priorité et par âge</h2>
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-[11px] leading-snug text-gray-500">
            DI « En attente » ou « Prise en charge » qui n'ont ni OT lié dans l'application ni numéro d'OT Coswin. Sont exclues les DI annulées, rejetées et clôturées (dont « 17. Clôturée sans OT »). Âge = jours depuis la date de déclaration. Priorité = code Coswin U0 à U3. Cliquez sur une case pour afficher la liste nominative.
          </p>
          {heat.total === 0 ? (
            <p className="text-sm text-gray-500">Aucune DI sans OT pour ce périmètre.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead className="text-[11px] uppercase tracking-wide text-gray-500">
                  <tr><th className="px-2 py-1.5 text-left">Priorité</th>{DI_AGE_DEFS.map(a => <th key={a.key} className="px-2 py-1.5">{a.label}</th>)}<th className="px-2 py-1.5">Total</th></tr>
                </thead>
                <tbody>
                  {DI_PRIORITIES.map(p => {
                    const rowTotal = DI_AGE_DEFS.reduce((n, a) => n + heat.cells[p.key][a.key].length, 0);
                    return (
                      <tr key={p.key} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 text-left font-medium text-gray-700">{p.label}</td>
                        {DI_AGE_DEFS.map(a => {
                          const n = heat.cells[p.key][a.key].length;
                          const on = heatSel?.p === p.key && heatSel?.a === a.key;
                          return (
                            <td key={a.key} className="p-1">
                              <button type="button" disabled={n === 0} onClick={() => { setHeatSel(on ? null : { p: p.key, a: a.key }); setHeatLimit(PAGE); }}
                                className={`w-full rounded-md px-2 py-2 tabular-nums transition-colors ${n === 0 ? 'bg-gray-50 text-gray-300' : 'text-gray-900 hover:ring-2 hover:ring-blue-300'} ${on ? 'ring-2 ring-blue-500' : ''}`}
                                style={n === 0 ? undefined : { backgroundColor: `rgba(220, 38, 38, ${0.12 + 0.6 * (n / heatMax)})` }}>
                                {num(n)}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 font-semibold tabular-nums text-gray-800">{num(rowTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="text-xs text-gray-600">Total DI sans OT : <b className="tabular-nums">{num(heat.total)}</b></div>
          {heat.withoutDate > 0 && <p className="text-[11px] text-amber-700">{num(heat.withoutDate)} DI sans OT n'ont pas de date de déclaration : elles ne peuvent pas être classées par âge.</p>}
        </div>

        {heatSel && heatItems.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <div className="text-sm font-semibold text-gray-800">DI sans OT — {DI_PRIORITIES.find(p => p.key === heatSel.p)?.label} · {DI_AGE_DEFS.find(a => a.key === heatSel.a)?.label} <span className="font-normal text-gray-500">({num(heatItems.length)})</span></div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => downloadCsv([], `di-sans-ot-${heatSel.p}-${new Date().toISOString().slice(0, 10)}.csv`, diHeatToCsv(heatItems))} className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">Exporter en CSV</button>
                <button type="button" onClick={() => setHeatSel(null)} className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">Fermer</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr><th className="px-3 py-2">Code DI</th><th className="px-3 py-2">Titre</th><th className="px-3 py-2">Équipement</th><th className="px-3 py-2">Site</th><th className="px-3 py-2">Déclarée le</th><th className="px-3 py-2 text-right">Âge</th><th className="px-3 py-2">État Coswin</th></tr>
                </thead>
                <tbody>
                  {heatItems.slice(0, heatLimit).map(({ request: r, ageDays }) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-gray-700">{r.code || '—'}</td>
                      <td className="max-w-xs truncate px-3 py-1.5 text-gray-900" title={r.title}>{r.title}</td>
                      <td className="max-w-[200px] truncate px-3 py-1.5 text-gray-600">{r.equipmentCode || r.equipmentName || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.siteCode || r.location || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-gray-600">{(r.declaredAt || r.createdAtIso || '').slice(0, 10).split('-').reverse().join('/')}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-900">{num(ageDays)} j</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.coswinState || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {heatItems.length > heatLimit && (
              <div className="border-t border-gray-100 px-4 py-2 text-center">
                <button type="button" onClick={() => setHeatLimit(l => l + PAGE)} className="text-xs font-medium text-blue-600 hover:underline">Afficher les {Math.min(PAGE, heatItems.length - heatLimit)} suivantes ({num(heatItems.length - heatLimit)} restantes)</button>
              </div>
            )}
          </div>
        )}
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
