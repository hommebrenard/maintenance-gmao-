import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Layers, 
  QrCode, 
  Pencil, 
  Trash2, 
  X, 
  CheckCircle2, 
  AlertOctagon, 
  PauseCircle, 
  ChevronDown, 
  Wrench,
  Building,
  Truck,
  FileText
} from 'lucide-react';
import { Equipment, OperationalStatus, EquipmentCriticality, WorkOrder } from '../../types';

interface EquipmentViewProps {
  equipmentList: Equipment[];
  workOrders?: WorkOrder[];
  onAddEquipment: (eq: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt' | 'workOrdersCount'>) => void;
  onUpdateStatus: (id: string, status: OperationalStatus) => void;
  onDeleteEquipment: (id: string) => void;
  onEditEquipment: (id: string, updated: Partial<Equipment>) => void;
  onSyncFromWorkOrders?: () => void;
}

export const EquipmentView: React.FC<EquipmentViewProps> = ({
  equipmentList,
  workOrders = [],
  onAddEquipment,
  onUpdateStatus,
  onDeleteEquipment,
  onEditEquipment,
  onSyncFromWorkOrders
}) => {
  const [selectedId, setSelectedId] = useState<string>(equipmentList[0]?.id || '');
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const newEquipmentFromWOCount = useMemo(() => {
    const existingCodes = new Set(equipmentList.map(e => e.code));
    const seen = new Set<string>();
    workOrders.forEach(w => {
      const code = w.equipmentCode;
      if (code && !existingCodes.has(code)) seen.add(code);
    });
    return seen.size;
  }, [workOrders, equipmentList]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (loc: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(loc)) next.delete(loc);
      else next.add(loc);
      return next;
    });
  };

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<OperationalStatus>('En service');
  const [criticality, setCriticality] = useState<EquipmentCriticality>('Normal');
  const [location, setLocation] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [description, setDescription] = useState('');

  const selectedEquipment = equipmentList.find(e => e.id === selectedId) || equipmentList[0];

  const filteredList = equipmentList.filter(eq => {
    const matchesSearch = eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          eq.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          eq.manufacturer.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter) {
      matchesStatus = eq.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    onAddEquipment({
      code,
      name,
      status,
      criticality,
      location: location || '—',
      supplier: supplier || '—',
      manufacturer: manufacturer || '—',
      model: model || '—',
      serialNumber: serialNumber || '—',
      description: description || '—'
    });

    setName('');
    setCode('');
    setIsAddModalOpen(false);
  };

  const openEdit = () => {
    if (!selectedEquipment) return;
    setName(selectedEquipment.name);
    setCode(selectedEquipment.code);
    setStatus(selectedEquipment.status);
    setCriticality(selectedEquipment.criticality);
    setLocation(selectedEquipment.location);
    setManufacturer(selectedEquipment.manufacturer);
    setModel(selectedEquipment.model);
    setSerialNumber(selectedEquipment.serialNumber);
    setSupplier(selectedEquipment.supplier);
    setDescription(selectedEquipment.description);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment) return;

    onEditEquipment(selectedEquipment.id, {
      name,
      code,
      status,
      criticality,
      location,
      manufacturer,
      model,
      serialNumber,
      supplier,
      description,
      updatedAt: new Date().toLocaleString('fr-FR')
    });

    setIsEditModalOpen(false);
  };

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col">
      {/* Header matching Screenshot 7 */}
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Équipements</h1>
            <p className="text-sm text-gray-500 mt-1">
              Suivez les équipements, les machines et leur état opérationnel.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 p-1 rounded-lg text-xs font-medium border border-gray-200">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
                }`}
              >
                Liste
              </button>
              <button
                onClick={() => setViewMode('tree')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  viewMode === 'tree' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
                }`}
              >
                Arborescence
              </button>
            </div>

            {onSyncFromWorkOrders && newEquipmentFromWOCount > 0 && (
              <button
                onClick={onSyncFromWorkOrders}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium rounded-lg text-sm shadow-2xs transition-colors"
                title="Créer une fiche équipement pour chaque code équipement trouvé dans vos OT importés mais absent de cette liste"
              >
                <Layers className="w-4 h-4" />
                <span>Générer depuis les OT ({newEquipmentFromWOCount})</span>
              </button>
            )}

            <button
              onClick={() => {
                setName('');
                setCode(`EQ-${Math.floor(100 + Math.random() * 900)}`);
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvel équipement</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher des équipements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {['En service', 'Arrêt planifié', 'Arrêt non planifié'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(statusFilter === st ? null : st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                statusFilter === st
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {st}
            </button>
          ))}

          <select className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none">
            <option value="">Criticité ∨</option>
          </select>
          <select className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none">
            <option value="">Fournisseur ∨</option>
          </select>
          <select className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none">
            <option value="">Emplacement ∨</option>
          </select>
        </div>
      </div>

      {/* Split Main Body matching Screenshot 7 */}
      <div className="flex-1 flex overflow-hidden bg-gray-50/20">
        {/* Left Equipment List Pane */}
        <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto shrink-0">
          {viewMode === 'list' ? (
            <div className="divide-y divide-gray-100">
              {filteredList.map(eq => {
                const isSelected = eq.id === (selectedEquipment?.id);
                return (
                  <div
                    key={eq.id}
                    onClick={() => setSelectedId(eq.id)}
                    className={`p-4 cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 leading-tight">{eq.name}</h4>
                        <span className="text-xs font-mono text-gray-500">{eq.code}</span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      eq.status === 'En service' ? 'bg-green-100 text-green-700' :
                      eq.status === 'Arrêt planifié' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {eq.status}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Tree view: grouped by emplacement */
            <div className="py-1">
              {Object.entries(
                filteredList.reduce<Record<string, typeof filteredList>>((acc, eq) => {
                  const key = eq.location?.trim() || 'Sans emplacement';
                  (acc[key] = acc[key] || []).push(eq);
                  return acc;
                }, {})
              ).sort(([a], [b]) => a.localeCompare(b)).map(([loc, items]) => {
                const isCollapsed = collapsedGroups.has(loc);
                return (
                  <div key={loc} className="border-b border-gray-100">
                    <button
                      type="button"
                      onClick={() => toggleGroup(loc)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-left"
                    >
                      <span className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase">
                        <Building className="w-3.5 h-3.5 text-gray-400" />
                        {loc}
                        <span className="font-normal text-gray-400 normal-case">({items.length})</span>
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                    {!isCollapsed && items.map(eq => {
                      const isSelected = eq.id === (selectedEquipment?.id);
                      return (
                        <div
                          key={eq.id}
                          onClick={() => setSelectedId(eq.id)}
                          className={`pl-8 pr-4 py-3 cursor-pointer flex items-center justify-between transition-colors border-t border-gray-50 ${
                            isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Layers className="w-4 h-4 text-blue-500 shrink-0" />
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-gray-900 leading-tight truncate">{eq.name}</h4>
                              <span className="text-[11px] font-mono text-gray-500">{eq.code}</span>
                            </div>
                          </div>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${
                            eq.status === 'En service' ? 'bg-green-100 text-green-700' :
                            eq.status === 'Arrêt planifié' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {eq.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Detail Card matching Screenshot 7 */}
        {selectedEquipment ? (
          <div className="flex-1 p-6 overflow-y-auto bg-gray-50/40">
            <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-6 space-y-6 max-w-5xl mx-auto">
              {/* Header section of detail */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-gray-100 pb-5">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedEquipment.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
                      {selectedEquipment.status}
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-full">
                      {selectedEquipment.criticality}
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-mono font-semibold bg-gray-100 text-gray-700 rounded-full">
                      {selectedEquipment.code}
                    </span>
                  </div>
                </div>

                {/* Top Action buttons: QR Code, Modifier, Supprimer */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsQrModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-2xs"
                  >
                    <QrCode className="w-4 h-4 text-gray-500" />
                    <span>QR code</span>
                  </button>
                  <button
                    onClick={openEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-2xs"
                  >
                    <Pencil className="w-4 h-4 text-gray-500" />
                    <span>Modifier</span>
                  </button>
                  <button
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-gray-300 rounded-lg hover:bg-red-50 shadow-2xs"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                    <span>Supprimer</span>
                  </button>
                </div>
              </div>

              {/* ÉTAT OPÉRATIONNEL Dropdown block */}
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-2">
                <label className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                  ÉTAT OPÉRATIONNEL
                </label>
                <div className="max-w-xs">
                  <select
                    value={selectedEquipment.status}
                    onChange={(e) => onUpdateStatus(selectedEquipment.id, e.target.value as OperationalStatus)}
                    className="w-full px-3 py-2 text-sm font-semibold bg-white border border-blue-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="En service">En service</option>
                    <option value="Arrêt planifié">Arrêt planifié</option>
                    <option value="Arrêt non planifié">Arrêt non planifié</option>
                  </select>
                </div>
              </div>

              {/* Grid of Specification fields matching Screenshot 7 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-8 text-sm pt-2">
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">CODE ÉQUIPEMENT</span>
                  <span className="font-semibold text-gray-900">{selectedEquipment.code}</span>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">ÉTAT OPÉRATIONNEL</span>
                  <span className="font-semibold text-gray-900">{selectedEquipment.status}</span>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">CRITICITÉ</span>
                  <span className="font-semibold text-gray-900">{selectedEquipment.criticality}</span>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">EMPLACEMENT</span>
                  <span className="text-gray-900">{selectedEquipment.location || '—'}</span>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">FOURNISSEUR</span>
                  <span className="text-gray-900">{selectedEquipment.supplier || '—'}</span>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">FABRICANT</span>
                  <span className="text-gray-900 font-medium">{selectedEquipment.manufacturer || 'ATLAS COPCO'}</span>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">MODÈLE</span>
                  <span className="text-gray-900">{selectedEquipment.model || '—'}</span>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">NUMÉRO DE SÉRIE</span>
                  <span className="text-gray-900">{selectedEquipment.serialNumber || '—'}</span>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">CRÉÉ LE</span>
                  <span className="text-gray-900">{selectedEquipment.createdAt}</span>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">MIS À JOUR LE</span>
                  <span className="text-gray-900">{selectedEquipment.updatedAt}</span>
                </div>

                <div className="md:col-span-3">
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">DESCRIPTION</span>
                  <span className="text-gray-700 leading-relaxed">{selectedEquipment.description || '—'}</span>
                </div>
              </div>

              {/* Sub-section: Ordres de travail rattachés */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  Ordres de travail ({selectedEquipment.workOrdersCount})
                </h3>
                <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-xs text-gray-500">
                  {selectedEquipment.workOrdersCount === 0 ? (
                    'Aucun ordre de travail rattaché à cet équipement pour le moment.'
                  ) : (
                    'Vidange et entretien filtres compresseur (OT-1001) — En cours'
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Sélectionnez un équipement dans la liste pour afficher ses caractéristiques.
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {isQrModalOpen && selectedEquipment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xs w-full p-6 text-center space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Code QR Équipement</h3>
            <div className="w-48 h-48 mx-auto bg-gray-100 border-2 border-gray-300 rounded-lg flex flex-col items-center justify-center p-2">
              {/* Generated QR Placeholder visualization */}
              <div className="w-36 h-36 bg-contain bg-center bg-no-repeat" style={{
                backgroundImage: `url('https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=GMAO-EQUIPMENT-${selectedEquipment.code}')`
              }} />
            </div>
            <div className="text-xs font-mono font-bold text-gray-800">{selectedEquipment.code}</div>
            <p className="text-xs text-gray-500">Scannez ce QR code pour accéder directement à la fiche technique ou signaler une panne.</p>
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="w-full py-2 bg-blue-600 text-white font-medium text-sm rounded-lg"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Add Equipment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Nouvel équipement</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: compresseur"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: AC-100"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Fabricant</label>
                  <input
                    type="text"
                    placeholder="Ex: ATLAS COPCO"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Modèle</label>
                  <input
                    type="text"
                    placeholder="Ex: GA-37"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Numéro de série</label>
                  <input
                    type="text"
                    placeholder="Ex: SN-987234"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Emplacement</label>
                  <input
                    type="text"
                    placeholder="Ex: Atelier Principal"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Equipment Modal */}
      {isEditModalOpen && selectedEquipment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Modifier l'équipement</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Statut</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as OperationalStatus)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="En service">En service</option>
                    <option value="Arrêt planifié">Arrêt planifié</option>
                    <option value="Arrêt non planifié">Arrêt non planifié</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Criticité</label>
                  <select
                    value={criticality}
                    onChange={(e) => setCriticality(e.target.value as EquipmentCriticality)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Faible">Faible</option>
                    <option value="Normal">Normal</option>
                    <option value="Élevée">Élevée</option>
                    <option value="Critique">Critique</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Fabricant</label>
                  <input
                    type="text"
                    placeholder="Ex: ATLAS COPCO"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Modèle</label>
                  <input
                    type="text"
                    placeholder="Ex: GA-37"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Numéro de série</label>
                  <input
                    type="text"
                    placeholder="Ex: SN-987234"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Fournisseur</label>
                  <input
                    type="text"
                    placeholder="Ex: Distributeur local"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Emplacement</label>
                <input
                  type="text"
                  placeholder="Ex: Atelier Principal"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmation de suppression */}
      {isDeleteConfirmOpen && selectedEquipment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Supprimer l'équipement ?</h3>
                <p className="text-xs text-gray-500">{selectedEquipment.name}</p>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              Voulez-vous vraiment supprimer cet équipement ({selectedEquipment.code}) ? Cette action est irréversible.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteEquipment(selectedEquipment.id);
                  setIsDeleteConfirmOpen(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-sm flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Oui, supprimer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
