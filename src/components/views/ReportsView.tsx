import React, { useState, useMemo } from 'react';
import { BarChart3, Calendar, Download, Plus, TrendingUp, TrendingDown, Minus, X, ArrowUp, ArrowDown, Search, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { WorkOrder, Equipment } from '../../types';
import { parseWoDateTime, sortByRecentActivity } from '../../utils/reportDates';
import { responsibleOf } from '../../utils/workOrderResponsible';
import { DetailSortKey, formatDateFr, toDetailRow, sortDetailRows, matchesDetailSearch } from '../../utils/reportTable';
import {
  EquipSortKey, EquipmentFilters, EMPTY_EQUIPMENT_FILTERS, buildEquipmentRows, summarizeEquipment,
  filterEquipmentRows, sortEquipmentRows,
} from '../../utils/reportEquipment';
import { buildCsv, exportFileName } from '../../utils/reportExport';
import { ClassFilters, matchesClassFilters, classOptions, LOT_OPTIONS } from '../../utils/reportFilters';
import { LOT_ORDER, LOT_LABELS, LOT_BADGE, familyLabel, lotOfFamily } from '../../utils/equipmentFamilies';
import { familyKeyOf } from '../../utils/annualMatrix';

interface ReportsViewProps {
  workOrders: WorkOrder[];
  equipmentList: Equipment[];
}

const formatLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDays = (d: Date, days: number): Date => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const downloadCSV = (rows: WorkOrder[], fileName: string) => {
  const csvContent = buildCsv(rows);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const ReportsView: React.FC<ReportsViewProps> = ({ workOrders, equipmentList }) => {
  const [activeTab, setActiveTab] = useState<'work-orders' | 'equipment' | 'details' | 'activity' | 'export'>('work-orders');
  const [detailsSearch, setDetailsSearch] = useState('');
  const [detailsSort, setDetailsSort] = useState<{ key: DetailSortKey; dir: 'asc' | 'desc' }>({ key: 'dueDate', dir: 'asc' });
  const [detailsLimit, setDetailsLimit] = useState(100);
  // Onglet « État des équipements » : filtres propres, tri et pagination (comme « Détails »).
  const [equipFilters, setEquipFilters] = useState<EquipmentFilters>(EMPTY_EQUIPMENT_FILTERS);
  const [equipSort, setEquipSort] = useState<{ key: EquipSortKey; dir: 'asc' | 'desc' }>({ key: 'criticality', dir: 'desc' });
  const [equipLimit, setEquipLimit] = useState(100);
  const [period, setPeriod] = useState('365');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [freqFilter, setFreqFilter] = useState('');
  const classFilters: ClassFilters = { lot: lotFilter, family: familyFilter, freq: freqFilter };
  const { families: familyOptions, freqs: freqOptions } = useMemo(() => classOptions(workOrders, lotFilter), [workOrders, lotFilter]);

  // --- Options disponibles pour les filtres, dérivées des données réelles ---
  const assigneeOptions = useMemo(() => Array.from(new Set(workOrders.map(w => responsibleOf(w)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr')) as string[], [workOrders]);
  const locationOptions = useMemo(() => Array.from(new Set(workOrders.map(w => w.location).filter(Boolean))) as string[], [workOrders]);
  const typeOptions = useMemo(() => Array.from(new Set(workOrders.map(w => w.type).filter(Boolean))) as string[], [workOrders]);
  const statusOptions = ['Ouvert', 'En cours', 'En attente', 'Terminé'];
  const priorityOptions = ['Faible', 'Moyenne', 'Élevée', 'Urgente'];

  const hasActiveFilters = !!(assigneeFilter || locationFilter || priorityFilter || typeFilter || statusFilter || lotFilter || familyFilter || freqFilter);
  const clearFilters = () => {
    setAssigneeFilter(''); setLocationFilter(''); setPriorityFilter(''); setTypeFilter(''); setStatusFilter('');
    setLotFilter(''); setFamilyFilter(''); setFreqFilter('');
  };

  // --- Fenêtre de dates selon la période choisie (basée sur la date d'échéance) ---
  const periodDays = Number(period);
  const todayStr = formatLocalDate(new Date());
  const periodStartStr = formatLocalDate(addDays(new Date(), -periodDays));
  // Fenêtre précédente de même longueur, pour calculer une tendance réelle
  const prevPeriodStartStr = formatLocalDate(addDays(new Date(), -periodDays * 2));
  const prevPeriodEndStr = periodStartStr;

  const inPeriod = (wo: WorkOrder) => wo.dueDate >= periodStartStr && wo.dueDate <= todayStr;
  const inPrevPeriod = (wo: WorkOrder) => wo.dueDate >= prevPeriodStartStr && wo.dueDate < prevPeriodEndStr;

  const applyCommonFilters = (wo: WorkOrder) => {
    if (assigneeFilter && responsibleOf(wo) !== assigneeFilter) return false;
    if (locationFilter && wo.location !== locationFilter) return false;
    if (priorityFilter && wo.priority !== priorityFilter) return false;
    if (typeFilter && wo.type !== typeFilter) return false;
    if (statusFilter && wo.status !== statusFilter) return false;
    if (!matchesClassFilters(wo, classFilters)) return false;
    return true;
  };

  const filteredOrders = useMemo(
    () => workOrders.filter(w => inPeriod(w) && applyCommonFilters(w)),
    [workOrders, periodStartStr, todayStr, assigneeFilter, locationFilter, priorityFilter, typeFilter, statusFilter, lotFilter, familyFilter, freqFilter]
  );

  const prevPeriodOrders = useMemo(
    () => workOrders.filter(w => inPrevPeriod(w) && applyCommonFilters(w)),
    [workOrders, prevPeriodStartStr, prevPeriodEndStr, assigneeFilter, locationFilter, priorityFilter, typeFilter, statusFilter, lotFilter, familyFilter, freqFilter]
  );

  // --- KPIs ---
  const totalCount = filteredOrders.length;
  const prevTotalCount = prevPeriodOrders.length;
  const totalTrendPct = prevTotalCount > 0 ? Math.round(((totalCount - prevTotalCount) / prevTotalCount) * 100) : null;

  const doneCount = filteredOrders.filter(w => w.status === 'Terminé').length;
  const resolutionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const prevDoneCount = prevPeriodOrders.filter(w => w.status === 'Terminé').length;
  const prevResolutionRate = prevTotalCount > 0 ? Math.round((prevDoneCount / prevTotalCount) * 100) : null;
  const resolutionTrendPts = prevResolutionRate !== null ? resolutionRate - prevResolutionRate : null;

  // MTTR calculé sur les OT réellement marqués "Terminé" avec un historique de dates exploitable
  // (createdAt -> updatedAt). Beaucoup d'OT importés n'ont pas cette info : le calcul ne porte
  // que sur ceux qui l'ont, et affiche clairement "Non disponible" sinon (pas de valeur inventée).
  const mttrHours = useMemo(() => {
    const durations: number[] = [];
    filteredOrders.filter(w => w.status === 'Terminé').forEach(w => {
      const start = parseWoDateTime(w.createdAt);
      const end = parseWoDateTime(w.updatedAt);
      if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime()) && end.getTime() > start.getTime()) {
        durations.push((end.getTime() - start.getTime()) / 3600000);
      }
    });
    if (durations.length === 0) return null;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }, [filteredOrders]);

  // Seul le filtre de site (locationFilter) a un sens pour les équipements :
  // assigneeFilter/priorityFilter/typeFilter/statusFilter sont des concepts
  // propres aux ordres de travail (un équipement n'a ni "assigné à", ni
  // "priorité", ni "statut d'OT"). Sans ce filtrage, changer de site dans les
  // filtres ne changeait jamais la liste/les compteurs d'équipements affichés.
  const filteredEquipmentList = useMemo(
    () => equipmentList.filter(e => {
      if (locationFilter && e.location !== locationFilter) return false;
      if (lotFilter || familyFilter) {
        const fam = familyKeyOf(e.code);
        if (familyFilter && fam !== familyFilter) return false;
        if (lotFilter && lotOfFamily(fam) !== lotFilter) return false;
      }
      return true;
    }),
    [equipmentList, locationFilter, lotFilter, familyFilter]
  );

  const activeEquipmentCount = filteredEquipmentList.filter(e => e.status === 'En service').length;
  const plannedStopCount = filteredEquipmentList.filter(e => e.status === 'Arrêt planifié').length;
  const unplannedStopCount = filteredEquipmentList.filter(e => e.status === 'Arrêt non planifié').length;

  // --- Données des graphiques (respectent les filtres + la période) ---
  const priorityData = [
    { name: 'Urgente', value: filteredOrders.filter(w => w.priority === 'Urgente').length, color: '#EF4444' },
    { name: 'Élevée', value: filteredOrders.filter(w => w.priority === 'Élevée').length, color: '#F59E0B' },
    { name: 'Moyenne', value: filteredOrders.filter(w => w.priority === 'Moyenne').length, color: '#3B82F6' },
    { name: 'Faible', value: filteredOrders.filter(w => w.priority === 'Faible').length, color: '#10B981' },
  ].filter(p => p.value > 0);

  const statusData = [
    { name: 'Ouvert', count: filteredOrders.filter(w => w.status === 'Ouvert').length },
    { name: 'En cours', count: filteredOrders.filter(w => w.status === 'En cours').length },
    { name: 'En attente', count: filteredOrders.filter(w => w.status === 'En attente').length },
    { name: 'Terminé', count: filteredOrders.filter(w => w.status === 'Terminé').length },
  ];

  const TrendBadge: React.FC<{ value: number | null; suffix?: string; invert?: boolean }> = ({ value, suffix = '%', invert = false }) => {
    if (value === null) return <span className="text-xs text-gray-400 font-medium mt-1 block">Pas de période précédente comparable</span>;
    const isUp = value > 0;
    const isFlat = value === 0;
    const good = invert ? !isUp : isUp;
    const colorClass = isFlat ? 'text-gray-500' : good ? 'text-green-600' : 'text-rose-600';
    const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
    return (
      <span className={`text-xs font-medium mt-1 flex items-center gap-1 ${colorClass}`}>
        <Icon className="w-3 h-3" />
        {isUp ? '+' : ''}{value}{suffix} vs période précédente
      </span>
    );
  };

  const periodLabel = { '7': '7 derniers jours', '30': '30 derniers jours', '90': '90 derniers jours', '365': '12 derniers mois' }[period] || period;

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Rapports</h1>
            <p className="text-sm text-gray-500 mt-1">
              Vue d'ensemble opérationnelle de vos processus de maintenance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700">
              <Calendar className="w-4 h-4 text-gray-500" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-transparent focus:outline-none text-xs font-semibold"
              >
                <option value="7">7 derniers jours</option>
                <option value="30">30 derniers jours</option>
                <option value="90">90 derniers jours</option>
                <option value="365">12 derniers mois</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="mt-6 flex items-center gap-6 border-b border-gray-200 -mb-5">
          {[
            { id: 'work-orders', label: 'Ordres de travail' },
            { id: 'equipment', label: 'État des équipements' },
            { id: 'details', label: 'Détails du rapport' },
            { id: 'activity', label: 'Activité récente' },
            { id: 'export', label: 'Exporter' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Row */}
      <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-2">
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
        >
          <option value="">Intervenant</option>
          {assigneeOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
        >
          <option value="">Emplacement</option>
          {locationOptions.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
        >
          <option value="">Priorité</option>
          {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
        >
          <option value="">Type</option>
          {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
        >
          <option value="">Statut</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={lotFilter}
          onChange={(e) => { setLotFilter(e.target.value); setFamilyFilter(''); }}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
        >
          <option value="">Lot</option>
          {LOT_OPTIONS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
        </select>

        <select
          value={familyFilter}
          onChange={(e) => setFamilyFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none max-w-[200px]"
        >
          <option value="">Famille</option>
          {familyOptions.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>

        <select
          value={freqFilter}
          onChange={(e) => setFreqFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
        >
          <option value="">Fréquence</option>
          {freqOptions.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
            <span>Effacer les filtres</span>
          </button>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {totalCount} résultat{totalCount > 1 ? 's' : ''} sur {periodLabel}
        </span>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 bg-gray-50/30">
        {filteredOrders.length === 0 && activeTab !== 'equipment' ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center bg-white my-6 max-w-4xl mx-auto shadow-2xs">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4 text-blue-500">
              <BarChart3 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Aucun ordre de travail sur cette période</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Choisissez une période plus large, retirez des filtres, ou créez des ordres de travail pour voir les tendances et les répartitions ici.
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-w-6xl mx-auto">

            {activeTab === 'work-orders' && (
              <>
                {/* Metric KPI cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <button type="button" onClick={() => setActiveTab('details')} title="Voir la liste de ces OT"
                    className="text-left bg-white p-5 rounded-xl border border-gray-200 shadow-2xs hover:border-blue-400 hover:shadow-md transition cursor-pointer">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Total Ordres de travail</span>
                    <div className="text-3xl font-bold text-gray-900 mt-2">{totalCount}</div>
                    <TrendBadge value={totalTrendPct} />
                  </button>

                  <button type="button" onClick={() => { setStatusFilter('Terminé'); setActiveTab('details'); }} title="Voir les OT terminés"
                    className="text-left bg-white p-5 rounded-xl border border-gray-200 shadow-2xs hover:border-blue-400 hover:shadow-md transition cursor-pointer">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Taux de résolution</span>
                    <div className="text-3xl font-bold text-gray-900 mt-2">{resolutionRate}%</div>
                    <TrendBadge value={resolutionTrendPts} suffix=" pts" />
                  </button>

                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Temps moyen de réparation (MTTR)</span>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      {mttrHours !== null ? `${mttrHours.toFixed(1)}h` : 'N/A'}
                    </div>
                    <span className="text-xs text-gray-400 font-medium mt-1 block">
                      {mttrHours !== null ? 'Basé sur les OT Terminé avec dates exploitables' : 'Aucun OT Terminé avec dates exploitables'}
                    </span>
                  </div>

                  <button type="button" onClick={() => setActiveTab('equipment')} title="Voir l'état des équipements"
                    className="text-left bg-white p-5 rounded-xl border border-gray-200 shadow-2xs hover:border-blue-400 hover:shadow-md transition cursor-pointer">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Équipements actifs</span>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      {activeEquipmentCount}/{filteredEquipmentList.length}
                    </div>
                    <div className="text-xs text-amber-600 font-medium mt-1">
                      {plannedStopCount + unplannedStopCount > 0
                        ? `${plannedStopCount} en arrêt planifié, ${unplannedStopCount} en arrêt non planifié`
                        : 'Aucun arrêt en cours'}
                    </div>
                  </button>
                </div>

                {/* Charts section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-2xs">
                    <h3 className="text-sm font-bold text-gray-900">Répartition par statut</h3>
                    <p className="text-xs text-gray-400 mb-4">Cliquer sur une barre pour voir les OT.</p>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusData}>
                          <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                          <YAxis stroke="#9CA3AF" fontSize={12} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} cursor="pointer"
                            onClick={(d: { name?: string }) => { if (d?.name) { setStatusFilter(d.name); setActiveTab('details'); } }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-2xs">
                    <h3 className="text-sm font-bold text-gray-900">Répartition par priorité</h3>
                    <p className="text-xs text-gray-400 mb-4">Cliquer sur une part pour voir les OT.</p>
                    <div className="h-64 flex items-center justify-center">
                      {priorityData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={priorityData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label
                              cursor="pointer"
                              onClick={(d: { name?: string }) => { if (d?.name) { setPriorityFilter(d.name); setActiveTab('details'); } }}
                            >
                              {priorityData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-sm text-gray-400">Aucune donnée de priorité</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'equipment' && (() => {
              // Rattachement OT → équipement calculé UNE fois (id puis code). Les OT pris en compte sont ceux de
              // la période et des filtres du haut (Intervenant, Emplacement, Priorité, Type, Statut).
              const { rows: allRows, orphanWoCount } = buildEquipmentRows(equipmentList, filteredOrders);
              const siteRows = allRows.filter(r =>
                (!locationFilter || r.eq.location === locationFilter) &&
                (!lotFilter || r.lot === lotFilter) &&
                (!familyFilter || r.family === familyFilter));
              const summary = summarizeEquipment(siteRows);
              const filtered = filterEquipmentRows(siteRows, equipFilters);
              const rows = sortEquipmentRows(filtered, equipSort.key, equipSort.dir);
              const visible = rows.slice(0, equipLimit);
              const families = Array.from(new Set(siteRows.map(r => r.family))).sort();
              const setFilter = (patch: Partial<EquipmentFilters>) => { setEquipFilters(prev => ({ ...prev, ...patch })); setEquipLimit(100); };
              const toggleQuick = (q: 'withoutWo' | 'criticalDown') => setFilter({ quick: equipFilters.quick === q ? '' : q });
              const hasFilter = JSON.stringify(equipFilters) !== JSON.stringify(EMPTY_EQUIPMENT_FILTERS);
              const columns: { key: EquipSortKey; label: string; hide?: boolean; right?: boolean }[] = [
                { key: 'code', label: 'Code' },
                { key: 'name', label: 'Équipement' },
                { key: 'family', label: 'Famille', hide: true },
                { key: 'lot', label: 'Lot', hide: true },
                { key: 'location', label: 'Site' },
                { key: 'status', label: 'Statut actuel' },
                { key: 'criticality', label: 'Criticité' },
                { key: 'openWo', label: 'OT ouverts', right: true },
                { key: 'totalWo', label: 'OT total', hide: true, right: true },
              ];
              const toggleSort = (key: EquipSortKey) => {
                setEquipSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
                setEquipLimit(100);
              };
              const selectCls = 'py-1.5 px-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none';
              return (
                <div className="space-y-6">
                  {orphanWoCount > 0 && (
                    <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>
                        {orphanWoCount} OT sur {filteredOrders.length} ne sont rattachés à aucun équipement connu : ils ne sont comptés dans aucune ligne du tableau ci-dessous.
                      </span>
                    </div>
                  )}

                  <p className="text-[11px] text-gray-500">
                    Les colonnes « OT ouverts », « OT total » et le filtre « Sans OT » tiennent compte de la période et des filtres du haut
                    (Intervenant, Priorité, Type, Statut, Fréquence). Les filtres Emplacement, Lot et Famille du haut s'appliquent aussi à la liste. Le statut et la criticité des équipements, eux, ne dépendent pas des autres filtres.
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Équipements</span>
                      <div className="text-3xl font-bold text-gray-900 mt-2">{summary.total}</div>
                      <div className="text-[11px] text-gray-400 mt-1">{summary.withoutWo} sans OT</div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-xs font-semibold text-gray-500 uppercase">En service</span>
                      <div className="text-3xl font-bold text-green-600 mt-2">{summary.inService}</div>
                      <div className="text-[11px] text-gray-400 mt-1">statut actuel</div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Arrêt planifié</span>
                      <div className="text-3xl font-bold text-amber-600 mt-2">{summary.plannedStop}</div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Arrêt non planifié</span>
                      <div className="text-3xl font-bold text-rose-600 mt-2">{summary.unplannedStop}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleQuick('criticalDown')}
                      title="Criticité Élevée ou Critique et arrêt non planifié. Cliquer pour filtrer le tableau."
                      className={`text-left bg-white p-5 rounded-xl border shadow-2xs hover:bg-rose-50/40 ${equipFilters.quick === 'criticalDown' ? 'border-rose-400 ring-2 ring-rose-200' : 'border-gray-200'}`}
                    >
                      <span className="text-xs font-semibold text-gray-500 uppercase">Critiques à l'arrêt</span>
                      <div className="text-3xl font-bold text-rose-700 mt-2">{summary.criticalDown}</div>
                      <div className="text-[11px] text-gray-400 mt-1">Élevée / Critique</div>
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-gray-900">
                        Liste des équipements ({rows.length}{rows.length !== siteRows.length ? ` sur ${siteRows.length}` : ''})
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <select value={equipFilters.lot} onChange={(e) => setFilter({ lot: e.target.value })} className={selectCls} aria-label="Lot">
                          <option value="">Tous les lots</option>
                          {LOT_ORDER.map(l => <option key={l} value={l}>{LOT_LABELS[l]}</option>)}
                        </select>
                        <select value={equipFilters.family} onChange={(e) => setFilter({ family: e.target.value })} className={selectCls} aria-label="Famille">
                          <option value="">Toutes les familles</option>
                          {families.map(f => <option key={f} value={f}>{f === 'AUTRES' ? 'Autres (code non reconnu)' : `${f}${familyLabel(f) ? ` — ${familyLabel(f)}` : ''}`}</option>)}
                        </select>
                        <select value={equipFilters.status} onChange={(e) => setFilter({ status: e.target.value })} className={selectCls} aria-label="Statut">
                          <option value="">Tous les statuts</option>
                          <option value="En service">En service</option>
                          <option value="Arrêt planifié">Arrêt planifié</option>
                          <option value="Arrêt non planifié">Arrêt non planifié</option>
                        </select>
                        <select value={equipFilters.criticality} onChange={(e) => setFilter({ criticality: e.target.value })} className={selectCls} aria-label="Criticité">
                          <option value="">Toutes criticités</option>
                          <option value="Critique">Critique</option>
                          <option value="Élevée">Élevée</option>
                          <option value="Normal">Normal</option>
                          <option value="Faible">Faible</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => toggleQuick('withoutWo')}
                          title="Équipements sans aucun OT rattaché : trous possibles dans le plan préventif"
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${equipFilters.quick === 'withoutWo' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        >
                          Sans OT ({summary.withoutWo})
                        </button>
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={equipFilters.search}
                            onChange={(e) => setFilter({ search: e.target.value })}
                            placeholder="Code, équipement, site…"
                            className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg w-52 max-w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        {hasFilter && (
                          <button type="button" onClick={() => { setEquipFilters(EMPTY_EQUIPMENT_FILTERS); setEquipLimit(100); }} className="text-xs font-semibold text-blue-700 hover:underline">
                            Réinitialiser
                          </button>
                        )}
                      </div>
                    </div>
                    {siteRows.length === 0 ? (
                      <p className="text-sm text-gray-400 p-6 text-center">Aucun équipement enregistré.</p>
                    ) : (
                      <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0">
                            <tr>
                              {columns.map(c => (
                                <th key={c.key} className={`px-4 py-2 whitespace-nowrap ${c.right ? 'text-right' : 'text-left'} ${c.hide ? 'hidden md:table-cell' : ''}`}>
                                  <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">
                                    {c.label}
                                    {equipSort.key === c.key && (equipSort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                                  </button>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {visible.map(r => (
                              <tr key={r.eq.id} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-2 font-mono text-gray-600 whitespace-nowrap">{r.eq.code || '—'}</td>
                                <td className="px-4 py-2 font-medium text-gray-800 max-w-[260px] truncate">{r.eq.name}</td>
                                <td className="px-4 py-2 text-gray-600 hidden md:table-cell">{r.family === 'AUTRES' ? '—' : r.family}</td>
                                <td className="px-4 py-2 hidden md:table-cell">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${LOT_BADGE[r.lot]}`}>{LOT_LABELS[r.lot].split(' (')[0]}</span>
                                </td>
                                <td className="px-4 py-2 text-gray-500">{r.eq.location || '—'}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                                    r.eq.status === 'En service' ? 'bg-green-100 text-green-700' :
                                    r.eq.status === 'Arrêt planifié' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                  }`}>
                                    {r.eq.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-gray-500">{r.eq.criticality}</td>
                                <td className="px-4 py-2 text-right font-semibold text-gray-700">{r.openWo}</td>
                                <td className="px-4 py-2 text-right text-gray-500 hidden md:table-cell">{r.totalWo}</td>
                              </tr>
                            ))}
                            {visible.length === 0 && (
                              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">Aucun équipement ne correspond.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {rows.length > equipLimit && (
                      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                        <span>{visible.length} affichés sur {rows.length}</span>
                        <button type="button" onClick={() => setEquipLimit(l => l + 200)} className="px-3 py-1.5 font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                          Afficher 200 de plus
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {activeTab === 'details' && (() => {
              const rows = sortDetailRows(
                filteredOrders.map(toDetailRow).filter(r => matchesDetailSearch(r, detailsSearch)),
                detailsSort.key,
                detailsSort.dir
              );
              const visible = rows.slice(0, detailsLimit);
              const columns: { key: DetailSortKey; label: string }[] = [
                { key: 'code', label: 'Code' },
                { key: 'title', label: 'Titre' },
                { key: 'equipment', label: 'Équipement' },
                { key: 'lot', label: 'Lot' },
                { key: 'family', label: 'Famille' },
                { key: 'freq', label: 'Fréq.' },
                { key: 'status', label: 'Statut' },
                { key: 'priority', label: 'Priorité' },
                { key: 'responsible', label: 'Intervenant' },
                { key: 'location', label: 'Emplacement' },
                { key: 'dueDate', label: 'Échéance' },
              ];
              const toggleSort = (key: DetailSortKey) => {
                setDetailsSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
                setDetailsLimit(100);
              };
              return (
                <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-gray-900">
                      Détails du rapport ({rows.length}{rows.length !== filteredOrders.length ? ` sur ${filteredOrders.length}` : ''} OT)
                    </h3>
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={detailsSearch}
                        onChange={(e) => { setDetailsSearch(e.target.value); setDetailsLimit(100); }}
                        placeholder="Code, titre, équipement, site…"
                        className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg w-64 max-w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0">
                        <tr>
                          {columns.map(c => (
                            <th key={c.key} className="px-4 py-2 text-left whitespace-nowrap">
                              <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">
                                {c.label}
                                {detailsSort.key === c.key && (detailsSort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map(r => (
                          <tr key={r.wo.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-2 font-mono text-gray-600 whitespace-nowrap">{r.wo.code}</td>
                            <td className="px-4 py-2 font-medium text-gray-800 max-w-xs truncate">{r.wo.title}</td>
                            <td className="px-4 py-2 text-gray-600 max-w-[200px] truncate">{r.wo.equipmentName || '—'}</td>
                            <td className="px-4 py-2 text-gray-600">{r.lot}</td>
                            <td className="px-4 py-2 text-gray-600">{r.family === 'AUTRES' ? '—' : r.family}</td>
                            <td className="px-4 py-2 text-gray-600">{r.freq || '—'}</td>
                            <td className="px-4 py-2 text-gray-600">{r.wo.status}</td>
                            <td className="px-4 py-2 text-gray-600">{r.wo.priority}</td>
                            <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{r.responsible || '—'}</td>
                            <td className="px-4 py-2 text-gray-600">{r.wo.location || '—'}</td>
                            <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{formatDateFr(r.wo.dueDate)}</td>
                          </tr>
                        ))}
                        {visible.length === 0 && (
                          <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">Aucun OT ne correspond.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > detailsLimit && (
                    <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                      <span>{visible.length} affichés sur {rows.length}</span>
                      <button
                        type="button"
                        onClick={() => setDetailsLimit(l => l + 200)}
                        className="px-3 py-1.5 font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                      >
                        Afficher 200 de plus
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {activeTab === 'activity' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-900">Activité récente</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Les 20 OT les plus récemment modifiés, quelle que soit leur échéance (la période ne s'applique pas ici ; les autres filtres oui).</p>
                </div>
                <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                  {sortByRecentActivity(workOrders.filter(applyCommonFilters))
                    .slice(0, 20)
                    .map(w => (
                      <div key={w.id} className="px-5 py-3 flex items-center justify-between text-xs hover:bg-gray-50">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{w.title}</p>
                          <p className="text-gray-400">{w.code} · {responsibleOf(w) || 'Non assigné'}</p>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            w.status === 'Terminé' ? 'bg-green-100 text-green-700' :
                            w.status === 'En cours' ? 'bg-blue-100 text-blue-700' :
                            w.status === 'En attente' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {w.status}
                          </span>
                          <p className="text-gray-400 mt-1">{w.updatedAt || w.createdAt || '—'}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {activeTab === 'export' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-8 text-center max-w-lg mx-auto">
                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4 text-blue-500">
                  <Download className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Exporter les résultats filtrés</h3>
                <p className="text-sm text-gray-500 mt-1 mb-5">
                  {filteredOrders.length} ordre(s) de travail seront exportés au format CSV (19 colonnes : site, famille, lot, fréquence, N° OT Coswin, dates…), en tenant compte de la période et des filtres actuellement appliqués. La date de clôture est posée automatiquement par la base ; elle est vide pour un OT non clos.
                </p>
                <button
                  onClick={() => downloadCSV(filteredOrders, exportFileName({ site: locationFilter, lot: lotFilter ? LOT_OPTIONS.find(l => l.key === lotFilter)?.label : '', family: familyFilter, freq: freqFilter }, formatLocalDate(new Date())))}
                  disabled={filteredOrders.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Télécharger le CSV
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};
