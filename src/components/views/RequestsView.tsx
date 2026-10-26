import React, { useEffect, useRef, useState } from 'react';
import { EquipmentPicker } from './EquipmentPicker';
import { INTERVENTION_TYPES } from '../../data/interventionTypes';
import { PRIORITY_CHOICES } from '../../data/requestPriorities';
import { isValidOptionalEmail } from '../../utils/requestForm';
import { pickRequestFiles, formatFileSize, REQUEST_FILES_MAX } from '../../utils/requestAttachments';
import { fetchSupervisors, addSupervisor, setSupervisorActive, type Supervisor } from '../../lib/queries/requestSupervisors';
import { proposedDueDate, isValidIsoDate, formatIsoFr, todayIso } from '../../utils/requestDueDate';
import { Plus, Search, Inbox, CheckCircle2, XCircle, Clock, X, AlertTriangle, ChevronLeft, ChevronRight, RotateCcw, Download, Printer, FileText, Camera, Paperclip } from 'lucide-react';
import { MaintenanceRequest, WorkOrderPriority, Equipment, Technicien, WorkOrder, LocationItem } from '../../types';
import { RequestDetailModal } from './RequestDetailModal';
import { RequestImportModal } from './RequestImportModal';
import { RequestSyncModal } from './RequestSyncModal';
import type { SyncResult } from '../../lib/queries/maintenanceRequests';
import { buildImportContext, type RequestInsertRow } from '../../utils/importRequests';
import { exportRequestListToPdf, printRequestList } from '../../utils/requestListPdf';
import { exportRequestsToXlsx } from '../../utils/requestExport';
import { displayState, DISPLAY_STATE_CLASS, indexWorkOrders, requestAlert } from '../../utils/requestDisplay';
import {
  EMPTY_FILTERS, NO_SITE, STATE_ORDER, applyFilters, canonicalSiteKey, buildSearchText, stateCountsFor, hasActiveFilters, paginate, sortRows, typeLabel,
  type RequestFilters, type RequestRowView, type SortKey, type SortSpec,
} from '../../utils/requestFilters';

interface RequestsViewProps {
  requests: MaintenanceRequest[];
  equipmentList: Equipment[];
  onAddRequest: (req: Omit<MaintenanceRequest, 'id' | 'createdAt' | 'status'> & { attachments?: File[] }) => void | Promise<void>;
  onApproveRequest: (id: string, dueDate?: string) => void;
  onRejectRequest: (id: string, reason?: string) => void;
  onSaveRejectionReason?: (id: string, reason: string) => void;
  onOpenHealthRecord?: (equipmentId: string) => void;
  isManager?: boolean;
  currentUserId?: string;
  techniciens?: Technicien[];
  workOrders?: WorkOrder[];
  locations?: LocationItem[];
  onImportRequests?: (rows: RequestInsertRow[]) => Promise<number>;
  onSyncRequests?: (payload: Record<string, string | null>[], batchId: string, apply: boolean) => Promise<SyncResult>;
}

export const RequestsView: React.FC<RequestsViewProps> = ({
  requests,
  equipmentList,
  onAddRequest,
  onApproveRequest,
  onRejectRequest,
  isManager = false,
  currentUserId,
  techniciens = [],
  workOrders = [],
  locations = [],
  onImportRequests,
  onSyncRequests,
  onSaveRejectionReason,
  onOpenHealthRecord
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
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const importContext = React.useMemo(
    () => ((isImportOpen || isSyncOpen) ? buildImportContext({ requests, equipment: equipmentList, locations, workOrders }) : null),
    [isImportOpen, isSyncOpen, requests, equipmentList, locations, workOrders]
  );
  const woByRequest = React.useMemo(() => indexWorkOrders(workOrders, requests), [workOrders, requests]);
  // Rapprochement à l'affichage : une demande importée avant l'équipement/le site est retrouvée par son code.
  const equipmentByCode = React.useMemo(() => new Map(equipmentList.map(e => [e.code, e] as [string, Equipment])), [equipmentList]);
  const locationByKey = React.useMemo(() => new Map(locations.filter(l => l.code).map(l => [canonicalSiteKey(l.code), l] as [string, LocationItem])), [locations]);
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
  const [submitting, setSubmitting] = useState(false);
  const [interventionType, setInterventionType] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [dafNumber, setDafNumber] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachNotice, setAttachNotice] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ''; // permet de rechoisir le même fichier
    const { accepted, rejected } = pickRequestFiles(attachments, picked);
    if (accepted.length) setAttachments(prev => [...prev, ...accepted]);
    setAttachNotice(rejected.join('\n'));
  };
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [showSupervisors, setShowSupervisors] = useState(false);
  const [newSupervisor, setNewSupervisor] = useState('');
  useEffect(() => { fetchSupervisors().then(setSupervisors).catch(() => setSupervisors([])); }, []);
  const emailOk = isValidOptionalEmail(requesterEmail);
  // Date proposée : recalculée à chaque changement de priorité (lecture seule pour le rondier).
  const dueProposal = React.useMemo(() => proposedDueDate(priority), [priority, isModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  // Le rondier peut ajuster la date : elle reste une PROPOSITION (le responsable fixe la date retenue à l'approbation).
  const [dueDraft, setDueDraft] = useState('');
  const [dueTouched, setDueTouched] = useState(false);
  useEffect(() => { if (!dueTouched) setDueDraft(dueProposal); }, [dueProposal, dueTouched]);
  const dueToSend = isValidIsoDate(dueDraft) ? dueDraft : dueProposal;

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
      siteKey: canonicalSiteKey(req.siteCode || eq?.location), matched: !!eq,
      day: iso.slice(0, 10), ts: Date.parse(iso) || 0,
      hay: buildSearchText(req, label, wo?.code),
    };
  }), [requests, woByRequest, equipmentById, equipmentByCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const stateCounts = React.useMemo(() => stateCountsFor(rows, filters), [rows, filters]);
  const typeOptions = React.useMemo(() => Array.from(new Set(rows.map(r => r.req.interventionType).filter((v): v is string => !!v))).sort(), [rows]);
  const siteOptions = React.useMemo(() => Array.from(new Set(rows.map(r => r.siteKey).filter(Boolean))).sort(), [rows]);
  const filteredRows = React.useMemo(() => sortRows(applyFilters(rows, filters), sort), [rows, filters, sort]);
  const paged = paginate(filteredRows, page, pageSize);
  const pageRows = paged.items;
  const hasNoSite = React.useMemo(() => rows.some(r => !r.siteKey), [rows]);
  const siteLabel = (key: string) => { const n = locationByKey.get(key)?.name; return n && n !== key ? `${n} (${key})` : key; };
  const sortTh = (key: SortKey, label: string) => (
    <th className="text-left px-3 py-2.5 font-semibold">
      <button onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-gray-800">
        {label}<span className="text-[10px]">{sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );

  // Remise à zéro complète du formulaire (appelée à CHAQUE ouverture : rien ne survit d'une saisie à l'autre).
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('Moyenne');
    setEquipmentId('');
    setRequestedBy('');
    setDueTouched(false);
    setInterventionType('');
    setSupervisorName('');
    setRequesterEmail('');
    setDafNumber('');
    setAttachments([]);
    setAttachNotice('');
  };
  const openModal = () => { resetForm(); setIsModalOpen(true); };
  const closeModal = () => { resetForm(); setIsModalOpen(false); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !title.trim() || !equipmentId || !requestedBy.trim() || !interventionType || !emailOk) return;
    setSubmitting(true);
    Promise.resolve(onAddRequest({
      title: title.trim(),
      description,
      priority,
      equipmentId,
      requestedBy: requestedBy.trim(),
      declaredAt: new Date().toISOString(),
      proposedDueDate: dueToSend,
      interventionType,
      dafNumber: dafNumber.trim() || undefined,
      supervisorName: supervisorName || undefined,
      requesterEmail: requesterEmail.trim() || undefined,
      attachments,
    })).finally(() => { setSubmitting(false); closeModal(); });

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
              <span className="font-medium text-gray-700"> {requests.length} demande(s) au total.</span>
            </p>
          </div>

          {isManager && (
            <button onClick={() => setShowSupervisors(true)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Superviseurs</button>
          )}
          {isManager && onImportRequests && (
            <button onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <span>Importer depuis Coswin</span>
            </button>
          )}
          {isManager && onSyncRequests && (
            <button onClick={() => setIsSyncOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <span>Synchroniser avec Coswin</span>
            </button>
          )}
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm shadow-xs transition-colors self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle demande</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button onClick={() => updateFilters({ state: 'all' })}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${filters.state === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            Toutes <span className={filters.state === 'all' ? 'opacity-90' : 'text-gray-400'}>({STATE_ORDER.reduce((n, st) => n + stateCounts[st], 0)})</span>
          </button>
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
            {hasNoSite && <option value={NO_SITE}>Site non précisé</option>}
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
          <button onClick={() => exportRequestsToXlsx(filteredRows, filters, requests.length)} disabled={filteredRows.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 ml-auto">
            <Download className="w-3.5 h-3.5" />Excel ({filteredRows.length})
          </button>
          <button onClick={() => exportRequestListToPdf(filteredRows, filters, requests.length)} disabled={filteredRows.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <FileText className="w-3.5 h-3.5" />PDF
          </button>
          <button onClick={() => printRequestList(filteredRows, filters, requests.length)} disabled={filteredRows.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <Printer className="w-3.5 h-3.5" />Imprimer
          </button>
          <span className="text-xs text-gray-500">{filteredRows.length} demande(s) sur {requests.length}</span>
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
              onClick={openModal}
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
                        {requestAlert(req) && (
                          <span title={requestAlert(req) ?? ''} className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">⚠ OT actif</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">{wo?.code ?? (req.otNumber ? `OT-${req.otNumber}` : '—')}</td>
                      {isManager && (
                        <td className="px-3 py-2.5 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                          {req.status === 'En attente' && (
                            <div className="inline-flex items-center gap-1.5">
                              <button onClick={() => setSelectedId(req.id)} title="Ouvre la fiche : choisir la date de fin retenue puis approuver"
                                className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /><span>Approuver</span>
                              </button>
                              <button onClick={() => setSelectedId(req.id)} title="Rejeter : ouvre la fiche pour saisir le motif"
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
      {isSyncOpen && importContext && onSyncRequests && (
        <RequestSyncModal context={importContext} requests={requests} onClose={() => setIsSyncOpen(false)} onSync={onSyncRequests} />
      )}

      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          equipment={findEquipment(selectedRequest)}
          locationName={selectedRequest.siteCode ? locationByKey.get(canonicalSiteKey(selectedRequest.siteCode))?.name : undefined}
          workOrder={selectedRequest.workOrderId ? woByRequest.get(selectedRequest.workOrderId) : undefined}
          isManager={isManager}
          currentUserId={currentUserId}
          onClose={() => setSelectedId(null)}
          onApprove={onApproveRequest}
          onReject={onRejectRequest}
          onSaveReason={onSaveRejectionReason}
          onOpenHealthRecord={onOpenHealthRecord}
        />
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Nouvelle demande de maintenance</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Description de l'incident *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex : fuite d'eau sous bac à condensats"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Équipement *</label>
                <EquipmentPicker equipmentList={equipmentList} locations={locations} value={equipmentId} onChange={setEquipmentId} />
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

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Source de constatation *</label>
                <select
                  required
                  value={interventionType}
                  onChange={(e) => setInterventionType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choisir…</option>
                  {INTERVENTION_TYPES.map(t => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Priorité demandée</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {PRIORITY_CHOICES.map(p => <option key={p.value} value={p.value}>{p.label} ({p.coswinCode})</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="due-proposed" className="block text-xs font-semibold text-gray-700 uppercase mb-1">Date de fin prévue (proposition)</label>
                <input
                  id="due-proposed"
                  type="date"
                  min={todayIso()}
                  value={dueDraft}
                  onChange={(e) => { setDueDraft(e.target.value); setDueTouched(true); }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Suggérée d'après la priorité : <span className="font-semibold text-gray-700">{formatIsoFr(dueProposal)}</span>
                  {dueTouched && dueDraft !== dueProposal && (
                    <button type="button" onClick={() => { setDueTouched(false); setDueDraft(dueProposal); }} className="ml-2 text-blue-700 underline">rétablir</button>
                  )}
                  {' '}— le responsable fixe la date définitive à l'approbation.
                </p>
                <p className="mt-1 text-xs text-gray-500">Date de déclaration : <span className="font-semibold text-gray-700">{formatIsoFr(todayIso())}</span> (automatique)</p>
              </div>

              <details className="group">
                <summary className="cursor-pointer text-xs font-semibold text-blue-700 uppercase select-none">Détails complémentaires (facultatif)</summary>
                <div className="mt-2 space-y-3">
                  <textarea
                    rows={3}
                    placeholder="Symptôme observé, accès, précautions…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">Superviseur</label>
                    <select value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">Aucun</option>
                      {supervisors.filter(sv => sv.active).map(sv => <option key={sv.id} value={sv.name}>{sv.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">Courriel du demandeur</label>
                    <input type="email" value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)} placeholder="nom@exemple.ma"
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 ${emailOk ? 'border-gray-300' : 'border-red-400'}`} />
                    {!emailOk && <p className="mt-1 text-xs text-red-600">Adresse courriel invalide.</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">N° DAF (dossier financier / devis)</label>
                    <input type="text" maxLength={50} value={dafNumber} onChange={(e) => setDafNumber(e.target.value)} placeholder="Ex : DAF-2026-104"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </details>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Photos / documents (facultatif)</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={submitting || attachments.length >= REQUEST_FILES_MAX} onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                    <Camera className="w-4 h-4" />Prendre une photo
                  </button>
                  <button type="button" disabled={submitting || attachments.length >= REQUEST_FILES_MAX} onClick={() => filesInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                    <Paperclip className="w-4 h-4" />Joindre un document
                  </button>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickFiles} />
                <input ref={filesInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={onPickFiles} />
                <p className="mt-1 text-[11px] text-gray-400">Photos ou PDF, {REQUEST_FILES_MAX} fichiers au maximum. À ajouter maintenant : impossible après l'envoi.</p>
                {attachments.length > 0 && (
                  <ul className="mt-2 divide-y divide-gray-100 border border-gray-200 rounded-lg">
                    {attachments.map((f, i) => (
                      <li key={`${f.name}-${f.size}-${i}`} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                        <span className="truncate text-gray-800">{f.name} <span className="text-xs text-gray-400">{formatFileSize(f.size)}</span></span>
                        <button type="button" disabled={submitting} onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                          className="shrink-0 text-gray-400 hover:text-red-600 disabled:opacity-50" aria-label={`Retirer ${f.name}`}><X className="w-4 h-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}
                {attachNotice && <p className="mt-1 text-xs text-red-600 whitespace-pre-line">{attachNotice}</p>}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || !equipmentId || !interventionType || !emailOk}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Envoi…' : 'Soumettre la demande'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSupervisors && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowSupervisors(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900">Superviseurs proposés dans le formulaire</h3>
              <button onClick={() => setShowSupervisors(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form className="flex gap-2 mb-3" onSubmit={e => {
              e.preventDefault();
              const name = newSupervisor.trim();
              if (!name) return;
              addSupervisor(name).then(sv => { setSupervisors(prev => [...prev, sv].sort((a, b) => a.name.localeCompare(b.name, 'fr'))); setNewSupervisor(''); })
                .catch(() => alert("Ajout impossible (nom déjà présent ou droits insuffisants)."));
            }}>
              <input value={newSupervisor} onChange={e => setNewSupervisor(e.target.value)} placeholder="Nom du superviseur"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg" />
              <button type="submit" className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Ajouter</button>
            </form>
            <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {supervisors.length === 0 && <li className="py-3 text-sm text-gray-500">Aucun superviseur pour le moment.</li>}
              {supervisors.map(sv => (
                <li key={sv.id} className="flex items-center justify-between py-2 text-sm">
                  <span className={sv.active ? 'text-gray-900' : 'text-gray-400 line-through'}>{sv.name}</span>
                  <button className="text-xs text-blue-700 underline" onClick={() =>
                    setSupervisorActive(sv.id, !sv.active).then(() => setSupervisors(prev => prev.map(x => x.id === sv.id ? { ...x, active: !x.active } : x)))
                      .catch(() => alert('Modification impossible (droits insuffisants).'))}>
                    {sv.active ? 'Désactiver' : 'Réactiver'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
