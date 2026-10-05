import React, { useState } from 'react';
import { Plus, Search, Inbox, CheckCircle2, XCircle, Clock, X, AlertTriangle } from 'lucide-react';
import { MaintenanceRequest, WorkOrderPriority, Equipment, Technicien } from '../../types';

interface RequestsViewProps {
  requests: MaintenanceRequest[];
  equipmentList: Equipment[];
  onAddRequest: (req: Omit<MaintenanceRequest, 'id' | 'createdAt' | 'status'>) => void;
  onApproveRequest: (id: string) => void;
  onRejectRequest: (id: string) => void;
  isManager?: boolean;
  techniciens?: Technicien[];
}

export const RequestsView: React.FC<RequestsViewProps> = ({
  requests,
  equipmentList,
  onAddRequest,
  onApproveRequest,
  onRejectRequest,
  isManager = false,
  techniciens = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<WorkOrderPriority>('Moyenne');
  const [equipmentId, setEquipmentId] = useState('');
  const [requestedBy, setRequestedBy] = useState('');

  const equipmentLabel = (req: MaintenanceRequest): string | undefined => {
    const eq = req.equipmentId ? equipmentList.find(e => e.id === req.equipmentId) : undefined;
    return eq ? `${eq.name} (${eq.code})` : req.equipmentName;
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          req.requestedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ((equipmentLabel(req) ?? '').toLowerCase().includes(searchQuery.toLowerCase()));
    
    let matchesStatus = true;
    if (selectedStatus) {
      matchesStatus = req.status === selectedStatus;
    }

    let matchesPriority = true;
    if (selectedPriority !== 'all') {
      matchesPriority = req.priority === selectedPriority;
    }

    return matchesSearch && matchesStatus && matchesPriority;
  });

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

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm shadow-xs transition-colors self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle demande</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher des demandes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {['En attente', 'Approuvée', 'Rejetée'].map(status => (
            <button
              key={status}
              onClick={() => setSelectedStatus(selectedStatus === status ? null : status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                selectedStatus === status
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {status}
            </button>
          ))}

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none"
          >
            <option value="all">Priorité (Toutes)</option>
            <option value="Faible">Faible</option>
            <option value="Moyenne">Moyenne</option>
            <option value="Élevée">Élevée</option>
            <option value="Urgente">Urgente</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 bg-gray-50/50">
        {filteredRequests.length === 0 ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRequests.map(req => (
              <div key={req.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      req.priority === 'Urgente' ? 'bg-red-100 text-red-700 border-red-200' :
                      req.priority === 'Élevée' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                      'bg-blue-100 text-blue-700 border-blue-200'
                    }`}>
                      {req.priority}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                      req.status === 'En attente' ? 'bg-amber-50 text-amber-700' :
                      req.status === 'Approuvée' ? 'bg-green-50 text-green-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {req.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-900 text-base">{req.title}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2">{req.description}</p>
                </div>

                <div className="pt-3 border-t border-gray-100 space-y-2 text-xs text-gray-500">
                  {equipmentLabel(req) && (
                    <div>Équipement: <span className="font-semibold text-gray-800">{equipmentLabel(req)}</span></div>
                  )}
                  <div>Demandé par: <span className="font-semibold text-gray-800">{req.requestedBy}</span></div>
                  <div className="text-[11px] text-gray-400">{req.createdAt}</div>

                  {req.status === 'En attente' && isManager && (
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => onApproveRequest(req.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approuver & Créer OT</span>
                      </button>
                      <button
                        onClick={() => onRejectRequest(req.id)}
                        className="flex items-center justify-center p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200"
                        title="Rejeter"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
