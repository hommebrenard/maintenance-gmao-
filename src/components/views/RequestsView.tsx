import React, { useState } from 'react';
import { Plus, Search, Inbox, CheckCircle2, XCircle, Clock, X, AlertTriangle, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { MaintenanceRequest, WorkOrderPriority, Equipment, Technicien, WorkOrder, LocationItem } from '../../types';
import { RequestDetailModal } from './RequestDetailModal';
import { RequestImportModal } from './RequestImportModal';
import { buildImportContext, type RequestInsertRow } from '../../utils/importRequests';
import { displayState, DISPLAY_STATE_CLASS, indexWorkOrders } from '../../utils/requestDisplay';
import {
  EMPTY_FILTERS, STATE_ORDER, applyFilters, countByState, hasActiveFilters, paginate, sortRows, typeLabel,
  type RequestFilters, type RequestRowView, type SortKey, type SortSpec,
} from '../../utils/requestFilters';

interface RequestsViewProps {
  requests: MaintenanceRequest[];
  equipmentList: Equipment[];
  onAddRequest: (req: Omit<MaintenanceRequest, 'id' | 'createdAt' | 'status'>) => void;
  onApproveRequest: (id: string) => void;
  onRejectRequest: (id: string) => void;
  isManager?: boolean;
  techniciens?: Technicien[];
  workOrders?: WorkOrder[];
  locations?: LocationItem[];
  onImportRequests?: (rows: RequestInsertRow[]) => Promise<number>;
}

export const RequestsView: React.FC<RequestsViewProps> = ({
  requests,
  equipmentList,
  onAddRequest,
  onApproveRequest,
  onRejectRequest,
  isManager = false,
  techniciens = [],
  workOrders = [],
  locations = [],
  onImportRequests
}) => {
  const [filters, setFilters] = useState<RequestFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortSpec>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const updateFilters = (patch: Partial<RequestFilters>) => { setFilters(f => ({ ...f, ...patch })); setPage(1); };
  const toggleSort = (key: SortKey) => { setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'date' || key === 'priority' ? 'desc' : 'asc' }); setPage(1); };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const importContext = React.useMemo(
    () => (isImportOpen ? buildImportContext({ requests, equipment: equipmentList, locations, workOrders }) : null),
    [isImportOpen, requests, equipmentList, locations, workOrders]
  );
  const woByRequest = React.useMemo(() => indexWorkOrders(workOrders, requests), [workOrders, requests]);
  // Rapprochement à l'affichage : une demande importée avant l'équipement/le site est retrouvée par son code.
  const equipmentByCode = React.useMemo(() => new Map(equipmentList.map(e => [e.code, e] as [string, Equipment])), [equipmentList]);
  const locationByCode = React.useMemo(() => new Map(locations.filter(l => l.code).map(l => [l.code as string, l] as [string, LocationItem])), [locations]);
  const equipmentById = React.useMemo(() => new Map(equipmentList.map(e => [e.id, e] as [string, Equipment])), [equipmentList]);
  const findEquipment = (req: MaintenanceRequest): Equipment | undefined =>
    (req.equipmentId ? equipmentById.get(req.equipmentId) : undefined) ?? (req.equipmentCode ? equipmentByCode.get(req.equipmentCode) : undefined);
  const selectedRequest = selectedId ? requests.find(r => r.id === selectedId) : undefined;

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<WorkOrderPriority>('Moyenne');
  const [equipmentId, setEquipmentId] = useState('');
  const [requestedBy, setRequestedBy] = useState('');

  const equipmentLabel = (req: MaintenanceRequest): string | undefined => {
    const eq = (req.equipmentId ? equipmentById.get(req.equipmentId) : undefined) ?? (req.equipmentCode ? equipmentByCode.get(req.equipmentCode) : undefined);
    return eq ? `${eq.name} (${eq.code})` : req.equipmentName ?? req.equipmentCode;
  };

  const rows = React.useMemo<RequestRowView[]>(() => requests.map(req => {
    const wo = req.workOrderId ? woByRequest.get(req.workOrderId) : undefined;
    const eq = findEquipment(req);
    const label = equipmentLabel(req);
    const iso = req.createdAtIso ?? '';
    return {
      req, wo, state: displayState(req, wo), equipmentLabel: label,
      siteKey: req.siteCode ?? eq?.location ?? '', matched: !!eq,
      day: iso.slice(0, 10), ts: Date.parse(iso) || 0,
      hay: [req.title, req.requestedBy, label, req.code, req.dafNumber, req.otNumber, req.equipmentCode, req.interventionType, req.siteCode, wo?.code]
        .filter(Boolean).join(' ').toLowerCase(),
    };
  }), [requests, woByRequest, equipmentById, equipmentByCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const stateCounts = React.useMemo(() => countByState(rows), [rows]);
  const typeOptions = React.useMemo(() => Array.from(new Set(rows.map(r => r.req.interventionType).filter((v): v is string => !!v))).sort(), [rows]);
  const siteOptions = React.useMemo(() => Array.from(new Set(rows.map(r => r.siteKey).filter(Boolean))).sort(), [rows]);
  const filteredRows = React.useMemo(() => sortRows(applyFilters(rows, filters), sort), [rows, filters, sort]);
  const paged = paginate(filteredRows, page, pageSize);
  const pageRows = paged.items;
  const siteLabel = (key: string) => { const n = locationByCode.get(key)?.name; return n && n !== key ? `${n} (${key})` : key; };
  const sortTh = (key: SortKey, label: string) => (
    <th className="text-left px-3 py-2.5 font-semibold">
      <button onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-gray-800">
        {label}<span className="text-[10px]">{sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !equipmentId || !requestedBy.trim()) return;

    onAddRequest({
      title,
      description,
      priority,
      equipmentId,
      requestedBy: requestedBy.trim()
    });

    setTitle('');
    setDescription('');
    setEquipmentId('');
    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Demandes</h1>
            <p className="text-sm text-gray-500 mt-1">
              Examinez les demandes de maintenance entrantes avant de les convertir en ordres de travail.
            </p>
          </div>

          {isManager && onImportRequests && (
            <button onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <span>Importer depuis Coswin</span>
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm shadow-xs transition-colors self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle demande</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {STATE_ORDER.map(st => (
            <button key={st} onClick={() => updateFilters({ state: filters.state === st ? 'all' : st })}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${filters.state === st ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
              {st} <span className={filters.state === st ? 'opacity-90' : 'text-gray-400'}>({stateCounts[st]})</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] max-w-sm flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="N° DI, N° OT, équipement, demandeur, N° DAF…" value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={filters.priority} onChange={(e) => updateFilters({ priority: e.target.value as RequestFilters['priority'] })}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none">
            <option value="all">Priorité (Toutes)</option>
            <option value="Faible">Faible</option><option value="Moyenne">Moyenne</option>
            <option value="Élevée">Élevée</option><option value="Urgente">Urgente</option>
          </select>
          <select value={filters.type} onChange={(e) => updateFilters({ type: e.target.value })}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none max-w-[220px]">
            <option value="all">Type (Tous)</option>
            {typeOptions.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </select>
          <select value={filters.site} onChange={(e) => updateFilters({ site: e.target.value })}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none max-w-[220px]">
            <option value="all">Site (Tous)</option>
            {siteOptions.map(k => <option key={k} value={k}>{siteLabel(k)}</option>)}
          </select>
          <select value={filters.origin} onChange={(e) => updateFilters({ origin: e.target.value as RequestFilters['origin'] })}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none">
            <option value="all">Origine (Toutes)</option><option value="coswin">Coswin</option><option value="app">Application</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-600">Du
            <input type="date" value={filters.from} onChange={(e) => updateFilters({ from: e.target.value })} className="px-2 py-1 text-xs border border-gray-300 rounded-lg" />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-600">au
            <input type="date" value={filters.to} onChange={(e) => updateFilters({ to: e.target.value })} className="px-2 py-1 text-xs border border-gray-300 rounded-lg" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={filters.unmatchedOnly} onChange={(e) => updateFilters({ unmatchedOnly: e.target.checked })} />
            Équipement non rapproché
          </label>
          {hasActiveFilters(filters) && (
            <button onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <RotateCcw className="w-3.5 h-3.5" />Réinitialiser
            </button>
          )}
          <span className="text-xs text-gray-500 ml-auto">{filteredRows.length} demande(s) sur {requests.length}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 bg-gray-50/50">
        {requests.length > 0 && filteredRows.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center bg-white my-6 max-w-3xl mx-auto">
            <h3 className="text-base font-semibold text-gray-900">Aucune demande ne correspond aux filtres</h3>
            <button onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }} className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Réinitialiser les filtres</button>
          </div>
        ) : requests.length === 0 ? (
          /* Empty State Box matching Screenshot 2 */
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center bg-white my-6 max-w-4xl mx-auto shadow-2xs">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4 text-blue-500">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Aucune demande pour le moment</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Les demandes de maintenance entrantes apparaissent ici pour examen et approbation.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle demande</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <tr>
                  {sortTh('code', 'N° DI')}
                  {sortTh('date', 'Déclarée le')}
                  <th className="text-left px-3 py-2.5 font-semibold">Équipement</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Description</th>
                  {sortTh('priority', 'Priorité')}
                  <th className="text-left px-3 py-2.5 font-semibold">Type</th>
                  <th className="text-left px-3 py-2.5 font-semibold">N° DAF</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Demandeur</th>
                  {sortTh('state', 'État')}
                  <th className="text-left px-3 py-2.5 font-semibold">N° OT</th>
                  {isManager && <th className="px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ req, wo, state, equipmentLabel: eqLabel }) => {
                  return (
                    <tr key={req.id} onClick={() => setSelectedId(req.id)}
                      className="border-t border-gray-100 hover:bg-blue-50/40 cursor-pointer">
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-700 whitespace-nowrap">{req.code}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{req.createdAt}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-800 max-w-[220px] truncate">{eqLabel ?? '—'}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[260px] truncate">{req.title}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          req.priority === 'Urgente' ? 'bg-red-100 text-red-700 border-red-200' :
                          req.priority === 'Élevée' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-blue-100 text-blue-700 border-blue-200'
                        }`}>{req.priority}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap" title={typeLabel(req.interventionType)}>{req.interventionType ?? '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-gray-700 whitespace-nowrap">{req.dafNumber ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{req.requestedBy}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${DISPLAY_STATE_CLASS[state]}`}>{state}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">{wo?.code ?? (req.otNumber ? `OT-${req.otNumber}` : '—')}</td>
                      {isManager && (
                        <td className="px-3 py-2.5 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                          {req.status === 'En attente' && (
                            <div className="inline-flex items-center gap-1.5">
                              <button onClick={() => onApproveRequest(req.id)} title="Approuver & Créer OT"
                                className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /><span>Approuver</span>
                              </button>
                              <button onClick={() => onRejectRequest(req.id)} title="Rejeter"
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200">
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-100 bg-white text-xs text-gray-600">
              <span>
                {filteredRows.length === 0 ? 0 : (paged.page - 1) * pageSize + 1}–{Math.min(paged.page * pageSize, filteredRows.length)} sur {filteredRows.length}
              </span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1">Lignes
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="px-2 py-1 border border-gray-300 rounded-lg">
                    {[50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <button disabled={paged.page <= 1} onClick={() => setPage(1)} className="px-2 py-1 border border-gray-300 rounded-lg disabled:opacity-40">«</button>
                <button disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)} className="p-1 border border-gray-300 rounded-lg disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <span>Page {paged.page} / {paged.pages}</span>
                <button disabled={paged.page >= paged.pages} onClick={() => setPage(paged.page + 1)} className="p-1 border border-gray-300 rounded-lg disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                <button disabled={paged.page >= paged.pages} onClick={() => setPage(paged.pages)} className="px-2 py-1 border border-gray-300 rounded-lg disabled:opacity-40">»</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isImportOpen && importContext && onImportRequests && (
        <RequestImportModal context={importContext} onClose={() => setIsImportOpen(false)} onImport={onImportRequests} />
      )}

      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          equipment={findEquipment(selectedRequest)}
          locationName={selectedRequest.siteCode ? locationByCode.get(selectedRequest.siteCode)?.name : undefined}
          workOrder={selectedRequest.workOrderId ? woByRequest.get(selectedRequest.workOrderId) : undefined}
          isManager={isManager}
          onClose={() => setSelectedId(null)}
          onApprove={onApproveRequest}
          onReject={onRejectRequest}
        />
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Nouvelle demande de maintenance</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Titre de la demande *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Bruit d'usure roulement"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Description détaillée</label>
                <textarea
                  rows={3}
                  placeholder="Décrivez l'anomalie observée..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Priorité demandée</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Faible">Faible</option>
                    <option value="Moyenne">Moyenne</option>
                    <option value="Élevée">Élevée</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Équipement *</label>
                  <select
                    required
                    value={equipmentId}
                    onChange={(e) => setEquipmentId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner...</option>
                    {equipmentList.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.name} ({eq.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Demandé par (nom du rondier) *</label>
                <input
                  type="text"
                  required
                  list="rondiers-list"
                  placeholder="Nom et prénom"
                  value={requestedBy}
                  onChange={(e) => setRequestedBy(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <datalist id="rondiers-list">
                  {techniciens.filter(t => t.actif).map(t => (
                    <option key={t.id} value={t.nom} />
                  ))}
                </datalist>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Soumettre la demande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
