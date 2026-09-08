import React, { useState, useMemo } from 'react';
import { BarChart3, Calendar, Download, Plus, TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { WorkOrder, Equipment } from '../../types';

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

// Parse "DD/MM/YYYY, HH:MM:SS" or "DD/MM/YYYY HH:MM:SS" (toLocaleString('fr-FR') output)
const parseFrDateTime = (s?: string): Date | null => {
  if (!s) return null;
  const match = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[, ]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (!match) return null;
  const [, day, month, year, h, min, sec] = match;
  const d = new Date(Number(year), Number(month) - 1, Number(day), Number(h), Number(min), Number(sec || '0'));
  return isNaN(d.getTime()) ? null : d;
};

const downloadCSV = (rows: WorkOrder[]) => {
  const headers = ['Code', 'Titre', 'Statut', 'Priorité', 'Type', 'Assigné à', 'Emplacement', 'Équipement', 'Date d\'échéance'];
  const escape = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(';'),
    ...rows.map(w => [
      w.code, w.title, w.status, w.priority, w.type, w.assignee || '', w.location || '', w.equipmentName || '', w.dueDate
    ].map(v => escape(String(v ?? ''))).join(';'))
  ];
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport-ordres-de-travail-${formatLocalDate(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const ReportsView: React.FC<ReportsViewProps> = ({ workOrders, equipmentList }) => {
  const [activeTab, setActiveTab] = useState<'work-orders' | 'equipment' | 'details' | 'activity' | 'export'>('work-orders');
  const [period, setPeriod] = useState('365');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // --- Options disponibles pour les filtres, dérivées des données réelles ---
  const assigneeOptions = useMemo(() => Array.from(new Set(workOrders.map(w => w.assignee).filter(Boolean))) as string[], [workOrders]);
  const locationOptions = useMemo(() => Array.from(new Set(workOrders.map(w => w.location).filter(Boolean))) as string[], [workOrders]);
  const typeOptions = useMemo(() => Array.from(new Set(workOrders.map(w => w.type).filter(Boolean))) as string[], [workOrders]);
  const statusOptions = ['Ouvert', 'En cours', 'En attente', 'Terminé'];
  const priorityOptions = ['Faible', 'Moyenne', 'Élevée', 'Urgente'];

  const hasActiveFilters = !!(assigneeFilter || locationFilter || priorityFilter || typeFilter || statusFilter);
  const clearFilters = () => {
    setAssigneeFilter(''); setLocationFilter(''); setPriorityFilter(''); setTypeFilter(''); setStatusFilter('');
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
    if (assigneeFilter && wo.assignee !== assigneeFilter) return false;
    if (locationFilter && wo.location !== locationFilter) return false;
    if (priorityFilter && wo.priority !== priorityFilter) return false;
    if (typeFilter && wo.type !== typeFilter) return false;
    if (statusFilter && wo.status !== statusFilter) return false;
    return true;
  };

  const filteredOrders = useMemo(
    () => workOrders.filter(w => inPeriod(w) && applyCommonFilters(w)),
    [workOrders, periodStartStr, todayStr, assigneeFilter, locationFilter, priorityFilter, typeFilter, statusFilter]
  );

  const prevPeriodOrders = useMemo(
    () => workOrders.filter(w => inPrevPeriod(w) && applyCommonFilters(w)),
    [workOrders, prevPeriodStartStr, prevPeriodEndStr, assigneeFilter, locationFilter, priorityFilter, typeFilter, statusFilter]
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
      const start = parseFrDateTime(w.createdAt) || (w.createdAt ? new Date(w.createdAt) : null);
      const end = parseFrDateTime(w.updatedAt) || (w.updatedAt ? new Date(w.updatedAt) : null);
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
    () => locationFilter ? equipmentList.filter(e => e.location === locationFilter) : equipmentList,
    [equipmentList, locationFilter]
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
          <option value="">Assigné à</option>
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
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Total Ordres de travail</span>
                    <div className="text-3xl font-bold text-gray-900 mt-2">{totalCount}</div>
                    <TrendBadge value={totalTrendPct} />
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Taux de résolution</span>
                    <div className="text-3xl font-bold text-gray-900 mt-2">{resolutionRate}%</div>
                    <TrendBadge value={resolutionTrendPts} suffix=" pts" />
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Temps moyen de réparation (MTTR)</span>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      {mttrHours !== null ? `${mttrHours.toFixed(1)}h` : 'N/A'}
                    </div>
                    <span className="text-xs text-gray-400 font-medium mt-1 block">
                      {mttrHours !== null ? 'Basé sur les OT Terminé avec dates exploitables' : 'Aucun OT Terminé avec dates exploitables'}
                    </span>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Équipements actifs</span>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      {activeEquipmentCount}/{filteredEquipmentList.length}
                    </div>
                    <div className="text-xs text-amber-600 font-medium mt-1">
                      {plannedStopCount + unplannedStopCount > 0
                        ? `${plannedStopCount} en arrêt planifié, ${unplannedStopCount} en arrêt non planifié`
                        : 'Aucun arrêt en cours'}
                    </div>
                  </div>
                </div>

                {/* Charts section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-2xs">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Répartition par statut</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusData}>
                          <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                          <YAxis stroke="#9CA3AF" fontSize={12} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-2xs">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Répartition par priorité</h3>
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

            {activeTab === 'equipment' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                    <span className="text-xs font-semibold text-gray-500 uppercase">En service</span>
                    <div className="text-3xl font-bold text-green-600 mt-2">{activeEquipmentCount}</div>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Arrêt planifié</span>
                    <div className="text-3xl font-bold text-amber-600 mt-2">{plannedStopCount}</div>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Arrêt non planifié</span>
                    <div className="text-3xl font-bold text-rose-600 mt-2">{unplannedStopCount}</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-200">
                    <h3 className="text-sm font-bold text-gray-900">Liste des équipements ({filteredEquipmentList.length})</h3>
                  </div>
                  {filteredEquipmentList.length === 0 ? (
                    <p className="text-sm text-gray-400 p-6 text-center">Aucun équipement enregistré.</p>
                  ) : (
                    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left">Nom</th>
                            <th className="px-4 py-2 text-left">Emplacement</th>
                            <th className="px-4 py-2 text-left">Statut</th>
                            <th className="px-4 py-2 text-left">Criticité</th>
                            <th className="px-4 py-2 text-right">OT liés</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEquipmentList.map(eq => {
                            const linkedCount = workOrders.filter(w => w.equipmentId === eq.id || (eq.code && w.equipmentCode === eq.code)).length;
                            return (
                              <tr key={eq.id} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium text-gray-800">{eq.name}</td>
                                <td className="px-4 py-2 text-gray-500">{eq.location || '—'}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    eq.status === 'En service' ? 'bg-green-100 text-green-700' :
                                    eq.status === 'Arrêt planifié' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                  }`}>
                                    {eq.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-gray-500">{eq.criticality}</td>
                                <td className="px-4 py-2 text-right font-semibold text-gray-700">{linkedCount}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'details' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">Détails du rapport ({filteredOrders.length} OT)</h3>
                  {filteredOrders.length > 200 && (
                    <span className="text-[11px] text-gray-400">Affichage limité aux 200 premiers — affinez les filtres pour cibler</span>
                  )}
                </div>
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Code</th>
                        <th className="px-4 py-2 text-left">Titre</th>
                        <th className="px-4 py-2 text-left">Statut</th>
                        <th className="px-4 py-2 text-left">Priorité</th>
                        <th className="px-4 py-2 text-left">Assigné à</th>
                        <th className="px-4 py-2 text-left">Emplacement</th>
                        <th className="px-4 py-2 text-left">Échéance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.slice(0, 200).map(w => (
                        <tr key={w.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono text-gray-600">{w.code}</td>
                          <td className="px-4 py-2 font-medium text-gray-800 max-w-xs truncate">{w.title}</td>
                          <td className="px-4 py-2 text-gray-600">{w.status}</td>
                          <td className="px-4 py-2 text-gray-600">{w.priority}</td>
                          <td className="px-4 py-2 text-gray-600">{w.assignee || '—'}</td>
                          <td className="px-4 py-2 text-gray-600">{w.location || '—'}</td>
                          <td className="px-4 py-2 text-gray-600">{w.dueDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-900">Activité récente</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Les 20 OT les plus récemment modifiés, parmi les résultats filtrés.</p>
                </div>
                <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                  {[...filteredOrders]
                    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
                    .slice(0, 20)
                    .map(w => (
                      <div key={w.id} className="px-5 py-3 flex items-center justify-between text-xs hover:bg-gray-50">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{w.title}</p>
                          <p className="text-gray-400">{w.code} · {w.assignee || 'Non assigné'}</p>
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
                  {filteredOrders.length} ordre(s) de travail seront exportés au format CSV, en tenant compte de la période et des filtres actuellement appliqués.
                </p>
                <button
                  onClick={() => downloadCSV(filteredOrders)}
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
