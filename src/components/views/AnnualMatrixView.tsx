import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { WorkOrder } from '../../types';
import { buildAnnualMatrix, buildFamilyOptions, availableYears, frequencyOf, FREQUENCY_LABELS, FREQUENCY_ORDER, type CellState, type MatrixMode, type MatrixRow } from '../../utils/annualMatrix';

interface Props {
  /** OT déjà filtrés par la page (recherche, site, statut, priorité). */
  orders: WorkOrder[];
  todayStr: string;
  onOpenOrder: (wo: WorkOrder) => void;
  /** Filtre de site de la page (partagé : changer ici change aussi le filtre du haut de page). */
  siteFilter: string;
  siteNames: string[];
  onSiteChange: (site: string) => void;
  /** Zone Nord/Sud du site de l'OT (undefined si le site n'a pas de zone). */
  zoneOf: (wo: WorkOrder) => 'Nord' | 'Sud' | undefined;
  /** Zone Nord/Sud d'un site (par son nom) : sert à n'afficher que les sites de la zone choisie. */
  siteZoneOf: (siteName: string) => 'Nord' | 'Sud' | undefined;
}

type RowFilter = 'all' | 'overdue' | 'open' | 'closed';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const PAGE = 50;

const CELL_STYLE: Record<CellState, string> = {
  none: 'bg-gray-50 text-gray-300',
  done: 'bg-green-100 text-green-800 border-green-200',
  partial: 'bg-amber-100 text-amber-800 border-amber-200',
  overdue: 'bg-red-100 text-red-700 border-red-200 font-semibold',
  pending: 'bg-blue-50 text-blue-700 border-blue-200',
};

export const AnnualMatrixView: React.FC<Props> = ({ orders, todayStr, onOpenOrder, siteFilter, siteNames, onSiteChange, zoneOf, siteZoneOf }) => {
  const years = useMemo(() => availableYears(orders), [orders]);
  const currentYear = Number(todayStr.slice(0, 4));
  const [year, setYear] = useState<number>(() => (years.includes(currentYear) ? currentYear : years[0] ?? currentYear));
  const [mode, setMode] = useState<MatrixMode>('week');
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');
  const [zone, setZone] = useState<'all' | 'Nord' | 'Sud'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [freqFilter, setFreqFilter] = useState<string>('all');
  const [familyFilter, setFamilyFilter] = useState<string>('all');
  const [equipQuery, setEquipQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<{ rowKey: string; month: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLTableCellElement>(null);

  // Filtres propres à la vue : zone du site et type d'OT (appliqués avant le calcul des totaux).
  const scopedBase = useMemo(
    () => orders.filter(o => (zone === 'all' || zoneOf(o) === zone) && (typeFilter === 'all' || o.type === typeFilter)),
    [orders, zone, typeFilter, zoneOf]
  );
  const scoped = useMemo(
    () => (freqFilter === 'all' ? scopedBase : scopedBase.filter(o => (frequencyOf(o) ?? '•') === freqFilter)),
    [scopedBase, freqFilter]
  );
  const matrix = useMemo(() => buildAnnualMatrix(scoped, year, todayStr, mode), [scoped, year, todayStr, mode]);

  // Filtres de lignes (famille, état, recherche) : ils pilotent à la fois les lignes affichées,
  // les totaux (en-tête, ligne Total, colonne Année) et les effectifs du menu des fréquences.
  const eq = equipQuery.trim().toLowerCase();
  const rowPasses = (r: MatrixRow) =>
    (familyFilter === 'all' || r.family === familyFilter) &&
    (rowFilter === 'all' ||
      (rowFilter === 'overdue' && r.overdue > 0) ||
      (rowFilter === 'open' && r.done < r.total) ||
      (rowFilter === 'closed' && r.done === r.total)) &&
    (!eq || r.label.toLowerCase().includes(eq) || r.code.toLowerCase().includes(eq));

  // Nombre d'OT par fréquence (année affichée, sans le filtre de fréquence lui-même).
  const freqCounts = useMemo(() => {
    const counts: Record<string, number> = { total: 0, '•': 0 };
    FREQUENCY_ORDER.forEach(f => { counts[f] = 0; });
    for (const row of buildAnnualMatrix(scopedBase, year, todayStr, mode).rows.filter(rowPasses)) {
      for (const c of row.cells) for (const o of c.orders) {
        counts[frequencyOf(o) ?? '•'] += 1;
        counts.total += 1;
      }
    }
    return counts;
  }, [scopedBase, year, todayStr, mode, familyFilter, rowFilter, eq]); // eslint-disable-line react-hooks/exhaustive-deps
  const familyOptions = useMemo(() => buildFamilyOptions(matrix.rows), [matrix.rows]);
  const cur = matrix.currentIndex;
  const isWeek = mode === 'week';

  // Place la colonne courante au centre de l'écran (utile avec 53 semaines).
  const centerCurrent = (smooth = false) => {
    const box = scrollRef.current, th = currentRef.current;
    if (!box || !th) return;
    box.scrollTo({ left: Math.max(0, th.offsetLeft - box.clientWidth / 2 + th.clientWidth / 2), behavior: smooth ? 'smooth' : 'auto' });
  };
  useEffect(() => { centerCurrent(); }, [mode, year, matrix.rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const scrollByPage = (dir: -1 | 1) => {
    const box = scrollRef.current;
    if (box) box.scrollBy({ left: dir * box.clientWidth * 0.7, behavior: 'smooth' });
  };

  // Échap ferme la liste des OT d'une case.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  // Sites proposés : uniquement ceux de la zone choisie (« Tous les sites » = tous les sites de cette zone).
  const zoneSiteNames = useMemo(
    () => (zone === 'all' ? siteNames : siteNames.filter(n => siteZoneOf(n) === zone)),
    [siteNames, zone, siteZoneOf]
  );
  const changeZone = (z: 'all' | 'Nord' | 'Sud') => {
    setZone(z);
    if (z !== 'all' && siteFilter !== 'all' && siteZoneOf(siteFilter) !== z) onSiteChange('all');
    setSelected(null);
  };

  // Groupes de colonnes par mois (ligne d'en-tête du mode semaines).
  const monthGroups = useMemo(() => {
    const groups: { monthIndex: number; span: number }[] = [];
    matrix.columns.forEach(c => {
      const last = groups[groups.length - 1];
      if (last && last.monthIndex === c.monthIndex) last.span += 1;
      else groups.push({ monthIndex: c.monthIndex, span: 1 });
    });
    return groups;
  }, [matrix.columns]);
  const colName = (i: number) => (isWeek ? `Semaine ${matrix.columns[i].label}` : MONTHS[i]);
  const CUR = 'border-l-2 border-l-blue-600';
  const rows = matrix.rows.filter(rowPasses);
  // Totaux recalculés sur les équipements réellement affichés (et non sur toute la base).
  const colTotals = matrix.columns.map((_, i) => rows.reduce(
    (acc, r) => ({ total: acc.total + r.cells[i].total, done: acc.done + r.cells[i].done }), { total: 0, done: 0 }));
  const grand = rows.reduce(
    (acc, r) => ({ total: acc.total + r.total, done: acc.done + r.done, overdue: acc.overdue + r.overdue }),
    { total: 0, done: 0, overdue: 0 });
  const grandPercent = grand.total ? Math.round((grand.done / grand.total) * 100) : 0;
  const visible = showAll ? rows : rows.slice(0, PAGE);
  const detailRow = selected ? matrix.rows.find(r => r.key === selected.rowKey) : null;
  const detailCell = detailRow && selected ? detailRow.cells[selected.month] : null;

  const goYear = (delta: number) => { setYear(y => y + delta); setSelected(null); };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-4 sm:p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => goYear(-1)} className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50" aria-label="Année précédente"><ChevronLeft className="w-4 h-4" /></button>
          <h3 className="text-lg font-bold text-gray-900 w-16 text-center">{year}</h3>
          <button onClick={() => goYear(1)} className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50" aria-label="Année suivante"><ChevronRight className="w-4 h-4" /></button>
          <span className="text-xs text-gray-500 ml-2">
            {grand.done}/{grand.total} OT clôturés ({grandPercent} %)
            {grand.overdue > 0 && <span className="text-red-600 font-semibold"> · {grand.overdue} en retard</span>}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={() => scrollByPage(-1)} className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50" aria-label="Défiler vers la gauche"><ChevronLeft className="w-4 h-4" /></button>
            {cur !== null && (
              <button onClick={() => centerCurrent(true)} className="px-2.5 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-xs font-medium hover:bg-amber-100">
                Aujourd'hui ({isWeek ? `S${matrix.columns[cur].label}` : MONTHS[cur]})
              </button>
            )}
            <button onClick={() => scrollByPage(1)} className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50" aria-label="Défiler vers la droite"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs border border-gray-200">
            {(['week', 'month'] as MatrixMode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setSelected(null); }}
                className={`px-3 py-1 rounded-md font-medium ${mode === m ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>
                {m === 'week' ? 'Semaines' : 'Mois'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select value={siteFilter} onChange={e => { onSiteChange(e.target.value); setSelected(null); }} className="border border-gray-300 rounded-lg px-2 py-1.5 bg-white font-medium">
          <option value="all">{zone === 'all' ? 'Tous les sites' : `Tous les sites (Zone ${zone})`}</option>
          {zoneSiteNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={zone} onChange={e => changeZone(e.target.value as 'all' | 'Nord' | 'Sud')} className="border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
          <option value="all">Toutes zones</option>
          <option value="Nord">Zone Nord</option>
          <option value="Sud">Zone Sud</option>
        </select>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setSelected(null); }} className="border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
          <option value="all">Tous types d'OT</option>
          <option value="Préventive">Préventive</option>
          <option value="Corrective">Corrective</option>
          <option value="Inspection">Inspection</option>
          <option value="Amélioration">Amélioration</option>
        </select>
        <select value={freqFilter} onChange={e => { setFreqFilter(e.target.value); setSelected(null); }} className="border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
          <option value="all">Toutes fréquences ({freqCounts.total} OT)</option>
          {FREQUENCY_ORDER.map(f => <option key={f} value={f}>{FREQUENCY_LABELS[f]} ({f}) — {freqCounts[f]} OT</option>)}
          {freqCounts['•'] > 0 && <option value="•">Non renseignée (•) — {freqCounts['•']} OT</option>}
        </select>
        <select value={familyFilter} onChange={e => { setFamilyFilter(e.target.value); setShowAll(false); setSelected(null); }} className="border border-gray-300 rounded-lg px-2 py-1.5 bg-white max-w-[220px]">
          <option value="all">Tous les équipements ({matrix.rows.length})</option>
          {familyOptions.map(o => <option key={o.key} value={o.key}>{o.label} — {o.count}</option>)}
        </select>
        <select value={rowFilter} onChange={e => { setRowFilter(e.target.value as RowFilter); setShowAll(false); }} className="border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
          <option value="all">Tous les états</option>
          <option value="overdue">Avec retard</option>
          <option value="open">Non entièrement clôturés</option>
          <option value="closed">Entièrement clôturés</option>
        </select>
        <input value={equipQuery} onChange={e => { setEquipQuery(e.target.value); setShowAll(false); }} placeholder="Équipement ou code…" className="border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white w-40" />
        {(siteFilter !== 'all' || zone !== 'all' || typeFilter !== 'all' || freqFilter !== 'all' || familyFilter !== 'all' || rowFilter !== 'all' || equipQuery) && (
          <button onClick={() => { onSiteChange('all'); setZone('all'); setTypeFilter('all'); setFreqFilter('all'); setFamilyFilter('all'); setRowFilter('all'); setEquipQuery(''); setSelected(null); }} className="text-blue-600 font-medium hover:underline">Réinitialiser</button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-gray-600">
        {([['done', 'Tout clôturé'], ['partial', 'Partiel'], ['overdue', 'En retard'], ['pending', 'À venir'], ['none', 'Aucun OT']] as [CellState, string][]).map(([s, l]) => (
          <span key={s} className="flex items-center gap-1.5"><span className={`inline-block w-3 h-3 rounded border ${CELL_STYLE[s]}`} />{l}</span>
        ))}
        <span className="text-gray-500">Fréquence : {FREQUENCY_ORDER.map(f => `${f} = ${FREQUENCY_LABELS[f].toLowerCase()}`).join(' · ')} · • = non renseignée</span>
        {cur !== null && <span className="flex items-center gap-1.5"><span className="inline-block w-0.5 h-3 bg-blue-600" />{isWeek ? `Semaine en cours (S${matrix.columns[cur].label})` : 'Mois en cours'}</span>}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">Aucun équipement ne correspond aux filtres pour {year}.</p>
      ) : (
        <div ref={scrollRef} className="overflow-auto max-h-[70vh] border border-gray-200 rounded-lg">
          <table className="text-xs border-separate border-spacing-0 min-w-full">
            <thead>
              {isWeek && (
                <tr>
                  <th className="sticky left-0 top-0 z-40 h-6 bg-gray-50 border-b border-gray-200" />
                  {monthGroups.map((g, i) => (
                    <th key={i} colSpan={g.span} className="sticky top-0 z-30 h-6 bg-gray-50 px-1 py-1 border-b border-l border-gray-200 font-semibold text-gray-600 text-center">{MONTHS[g.monthIndex]}</th>
                  ))}
                  <th className="sticky top-0 z-30 h-6 bg-gray-50 border-b border-gray-200" />
                </tr>
              )}
              <tr>
                <th className={`sticky left-0 ${isWeek ? 'top-6' : 'top-0'} z-40 bg-gray-50 text-left px-3 py-2 min-w-[150px] sm:min-w-[260px] border-b border-gray-200 font-semibold text-gray-600`}>Équipement et localisation</th>
                {matrix.columns.map((c, i) => (
                  <th key={i} ref={i === cur ? currentRef : undefined}
                    className={`sticky ${isWeek ? 'top-6' : 'top-0'} z-30 px-1 py-2 border-b border-gray-200 font-semibold ${isWeek ? 'min-w-[30px]' : 'min-w-[46px]'} ${i === cur ? `bg-blue-600 text-white ${CUR}` : 'bg-gray-50 text-gray-600'}`}>
                    {isWeek ? `S${c.label}` : c.label}
                  </th>
                ))}
                <th className={`sticky ${isWeek ? 'top-6' : 'top-0'} z-30 bg-gray-50 px-2 py-2 min-w-[70px] border-b border-gray-200 font-semibold text-gray-600`}>Année</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(row => (
                <tr key={row.key}>
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-b border-gray-100 min-w-[150px] sm:min-w-[260px] max-w-[300px] align-top">
                    <div className="font-medium text-gray-900 leading-tight break-words">{row.label}</div>
                    <div className="text-[10px] text-gray-500 break-all">{row.code}</div>
                    {row.location && <div className="text-[10px] text-gray-400 leading-tight break-words">{row.location}</div>}
                  </td>
                  {row.cells.map((c, m) => (
                    <td key={m} className={`px-0.5 py-1 border-b border-gray-100 text-center ${m === cur ? `${CUR} bg-blue-50/40` : ''}`}>
                      {c.total === 0 ? (
                        <span className="text-gray-300">·</span>
                      ) : (
                        <button
                          onClick={() => (c.total === 1 ? onOpenOrder(c.orders[0]) : setSelected({ rowKey: row.key, month: m }))}
                          title={`${colName(m)} : ${c.total} OT, ${c.done} clôturé(s) · fréquence ${c.freqs.join(' ')}${c.total === 1 ? ' · cliquer pour ouvrir l\'OT' : ''}`}
                          className={`w-full rounded border px-1 py-1 ${CELL_STYLE[c.state]} ${selected?.rowKey === row.key && selected.month === m ? 'ring-2 ring-blue-500' : ''}`}
                        >
                          {isWeek ? (
                            <span className="font-bold tracking-tight text-[11px]">{c.freqs.join('')}</span>
                          ) : (
                            <>
                              <span>{c.done}/{c.total}</span>
                              <span className="block text-[9px] font-bold opacity-80 leading-none">{c.freqs.join('')}</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1 border-b border-gray-100 text-center">
                    <div className="font-semibold text-gray-800">{row.done}/{row.total}</div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                      <div className={`h-full ${row.overdue > 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${row.percent}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 bottom-0 z-30 bg-gray-50 px-3 py-2 font-semibold text-gray-700">Total</td>
                {colTotals.map((t, m) => (
                  <td key={m} className={`sticky bottom-0 z-20 bg-gray-50 px-1 py-2 text-center text-gray-700 font-medium ${m === cur ? CUR : ''}`}>{t.total ? (isWeek ? t.total : `${t.done}/${t.total}`) : '·'}</td>
                ))}
                <td className="sticky bottom-0 z-20 bg-gray-50 px-2 py-2 text-center font-semibold text-gray-800">{grand.done}/{grand.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {rows.length > PAGE && (
        <div className="text-center">
          <button onClick={() => setShowAll(v => !v)} className="text-xs text-blue-600 font-medium hover:underline">
            {showAll ? 'Réduire la liste' : `Voir tout (${rows.length} équipements)`}
          </button>
        </div>
      )}

      {detailRow && detailCell && selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={() => setSelected(null)}>
          <div role="dialog" aria-modal="true" className="bg-white w-full sm:max-w-lg max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">{detailRow.label} — {colName(selected.month)} {year}</div>
                <div className="text-xs text-gray-500">{detailCell.done}/{detailCell.total} OT clôturés · touchez un OT pour l'ouvrir</div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Fermer"><X className="w-4 h-4" /></button>
            </div>
            <ul className="divide-y divide-gray-200 text-xs">
              {detailCell.orders.map(o => {
                const late = o.status !== 'Terminé' && o.dueDate < todayStr;
                return (
                  <li key={o.id}>
                    <button onClick={() => { setSelected(null); onOpenOrder(o); }} className="w-full text-left py-2 flex items-center justify-between gap-3 hover:bg-gray-50 px-1 rounded">
                      <span className="min-w-0">
                        <span className="font-mono text-gray-500"><span className="font-bold text-blue-700 mr-1">{frequencyOf(o) ?? '•'}</span>{o.code}</span>
                        <span className="block text-gray-800">{o.title}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={late ? 'text-red-600 font-semibold' : 'text-gray-500'}>{o.dueDate.split('-').reverse().join('/')}</span>
                        <span className="block text-gray-600">{o.status}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
