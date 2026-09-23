import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, HeartPulse, QrCode, Image as ImageIcon, Printer, Download, ClipboardList, Plus, Loader2, ShieldCheck } from 'lucide-react';
import { Equipment, WorkOrder, HealthRecordEntry } from '../../types';
import {
  getLinkedWorkOrders,
  getOperationalStatusBadgeClass,
  getWorkOrderStatusBadgeClass,
  formatIsoDate,
} from '../../utils/equipmentDisplay';
import { fetchHealthRecords, createHealthRecord } from '../../lib/queries/healthRecords';
import { exportElementToPdf } from '../../utils/pdfExport';

const NotSet: React.FC = () => <span className="text-gray-400">Non renseigné</span>;

interface HealthRecordsViewProps {
  equipmentList: Equipment[];
  workOrders: WorkOrder[];
  currentUserId: string;
}

// Chantier « carnet de santé » (22/09/2026) : vue dédiée listant tous les
// équipements, chacun avec sa fiche d'identité réelle (colonnes déjà en base :
// category, brand/model/serialNumber, qr_code, photo_url, notes...) et son
// registre chronologique d'interventions (vrais OT liés, via
// getLinkedWorkOrders — même logique que la fiche équipement classique).
// Volontairement PAS de section « Synthèse de santé / conformité
// réglementaire » avec des chiffres inventés (indice de fiabilité, DESP...) :
// aucune donnée réelle ne les alimente aujourd'hui (voir échange du 22/09).
export const HealthRecordsView: React.FC<HealthRecordsViewProps> = ({ equipmentList, workOrders, currentUserId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Entrées du carnet de santé (table `carnets_sante`) de l'équipement
  // sélectionné — chargées à la demande, pas dans l'état global de App.tsx
  // (chantier borné, pas besoin de tout précharger pour l'instant).
  const [entries, setEntries] = useState<HealthRecordEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newEventType, setNewEventType] = useState('Maintenance préventive');
  const [newDescription, setNewDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const printableRef = useRef<HTMLDivElement>(null);

  const filteredList = useMemo(
    () =>
      [...equipmentList]
        .filter(
          eq =>
            eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            eq.code.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [equipmentList, searchQuery]
  );

  const selected = filteredList.find(e => e.id === selectedId) || filteredList[0];

  const linkedWorkOrders = useMemo(
    () => (selected ? getLinkedWorkOrders(selected, workOrders) : []),
    [selected, workOrders]
  );

  useEffect(() => {
    if (!selected) return;
    setIsLoadingEntries(true);
    setLoadError(null);
    fetchHealthRecords(selected.id)
      .then(setEntries)
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Erreur de chargement'))
      .finally(() => setIsLoadingEntries(false));
  }, [selected?.id]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !newEventType.trim()) return;
    setIsSaving(true);
    try {
      const created = await createHealthRecord(
        { equipmentId: selected.id, eventType: newEventType.trim(), description: newDescription.trim() },
        currentUserId
      );
      setEntries(prev => [created, ...prev]);
      setNewDescription('');
      setIsAdding(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur d\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!printableRef.current || !selected) return;
    setIsExportingPdf(true);
    setPdfError(null);
    try {
      const result = await exportElementToPdf(
        printableRef.current,
        `Carnet_Sante_${selected.code}_${new Date().toISOString().slice(0, 10)}`
      );
      if (!result.success) setPdfError(result.error || 'Erreur lors de la génération du PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Liste */}
      <div className="print:hidden w-80 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-2">
            <HeartPulse className="w-4 h-4 text-emerald-600" />
            Carnets de santé
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher un équipement..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredList.map(eq => (
            <button
              key={eq.id}
              onClick={() => setSelectedId(eq.id)}
              className={`w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50 ${
                selected?.id === eq.id ? 'bg-emerald-50 border-l-2 border-l-emerald-600' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-900 truncate">{eq.name}</div>
              <div className="text-xs text-gray-500">{eq.code}</div>
            </button>
          ))}
          {filteredList.length === 0 && (
            <div className="p-4 text-xs text-gray-400 text-center">Aucun équipement</div>
          )}
        </div>
      </div>

      {/* Fiche */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="text-sm text-gray-400">Sélectionnez un équipement.</div>
        ) : (
          <div className="max-w-4xl">
            <div className="flex items-center justify-end gap-2 mb-3" data-pdf-exclude="true">
              {pdfError && <span className="text-xs text-red-600 mr-auto">{pdfError}</span>}
              <button
                onClick={() => window.print()}
                className="print:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimer
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="print:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
              >
                {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Télécharger PDF
              </button>
            </div>

            <div ref={printableRef} className="bg-white">
              {/* En-tête fiche d'identité, façon passeport machine */}
              <div className="border-2 border-gray-800 rounded-lg p-4 bg-gray-50 flex items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-gray-800 text-white font-mono px-2 py-0.5 rounded text-xs font-bold">{selected.code}</span>
                    <h1 className="text-base font-bold text-gray-900">{selected.name}</h1>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getOperationalStatusBadgeClass(selected.status)}`}>
                      {selected.status}
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs mt-1">
                    {selected.manufacturer || <NotSet />}
                    {selected.model ? ` — ${selected.model}` : ''}
                  </p>
                  <p className="text-gray-500 text-[11px] font-mono mt-0.5">
                    N° série : {selected.serialNumber || 'Non renseigné'} | Emplacement : {selected.location || 'Non renseigné'}
                  </p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2 text-emerald-700">
                  <ShieldCheck className="w-5 h-5" />
                  <div>
                    <span className="block text-gray-400 text-[10px]">Date d'émission :</span>
                    <span className="font-semibold text-gray-800 text-xs">
                      {new Date().toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              {/* Photo */}
              <div className="col-span-1 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center h-40">
                {selected.photoUrl ? (
                  <img src={selected.photoUrl} alt={selected.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-gray-300 flex flex-col items-center gap-1">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-[11px]">Aucune photo</span>
                  </div>
                )}
              </div>

              {/* Identité */}
              <div className="col-span-2 border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm">
                {[
                  ['Catégorie', selected.category],
                  ['Constructeur', selected.manufacturer],
                  ['Modèle', selected.model],
                  ['N° de série', selected.serialNumber],
                  ['Emplacement', selected.location],
                  ['Notes', selected.notes],
                ].map(([label, value]) => (
                  <div key={label} className="flex px-3 py-1.5">
                    <span className="w-32 shrink-0 text-gray-500">{label} :</span>
                    <span className="text-gray-900">{value ? value : <NotSet />}</span>
                  </div>
                ))}
                <div className="flex px-3 py-1.5 items-center">
                  <span className="w-32 shrink-0 text-gray-500 flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5" /> QR code :
                  </span>
                  <span className="text-gray-900">{selected.qrCode ? selected.qrCode : <NotSet />}</span>
                </div>
              </div>
            </div>

            {/* Registre des interventions (réel) */}
            <div className="border border-gray-200 rounded-lg">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-bold text-gray-900">Registre chronologique des interventions ({linkedWorkOrders.length})</h3>
              </div>
              {linkedWorkOrders.length === 0 ? (
                <div className="p-4 text-xs text-gray-400">Aucune intervention enregistrée pour cet équipement.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium">OT</th>
                      <th className="text-left px-3 py-1.5 font-medium">Intitulé</th>
                      <th className="text-left px-3 py-1.5 font-medium">Échéance</th>
                      <th className="text-left px-3 py-1.5 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {linkedWorkOrders.map(wo => (
                      <tr key={wo.id}>
                        <td className="px-3 py-1.5 font-medium text-gray-900">{wo.code}</td>
                        <td className="px-3 py-1.5 text-gray-700">{wo.title}</td>
                        <td className="px-3 py-1.5 text-gray-500">{formatIsoDate(wo.dueDate)}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded-full font-semibold ${getWorkOrderStatusBadgeClass(wo.status)}`}>{wo.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Historique du carnet de santé (table `carnets_sante`, réelle) */}
            <div className="mt-4 border border-gray-200 rounded-lg">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-gray-900">Carnet de santé ({entries.length})</h3>
                </div>
                <button
                  onClick={() => setIsAdding(v => !v)}
                  data-pdf-exclude="true"
                  className="print:hidden flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter une entrée
                </button>
              </div>

              {isAdding && (
                <form onSubmit={handleAddEntry} data-pdf-exclude="true" className="print:hidden p-3 border-b border-gray-100 bg-gray-50 space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={newEventType}
                      onChange={e => setNewEventType(e.target.value)}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1.5"
                    >
                      <option>Maintenance préventive</option>
                      <option>Réparation</option>
                      <option>Inspection</option>
                      <option>Contrôle réglementaire</option>
                      <option>Anomalie</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Description..."
                      value={newDescription}
                      onChange={e => setNewDescription(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5"
                    />
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Enregistrer'}
                    </button>
                  </div>
                </form>
              )}

              {isLoadingEntries ? (
                <div className="p-4 text-xs text-gray-400 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement...
                </div>
              ) : loadError ? (
                <div className="p-4 text-xs text-red-600">{loadError}</div>
              ) : entries.length === 0 ? (
                <div className="p-4 text-xs text-gray-400">Aucune entrée enregistrée pour cet équipement.</div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {entries.map(entry => (
                    <li key={entry.id} className="px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">{entry.eventType}</span>
                        <span className="text-gray-400">{formatIsoDate(entry.eventDate)}</span>
                      </div>
                      {entry.description && <div className="text-gray-600 mt-0.5">{entry.description}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

              {/* Visas */}
              <div className="mt-4 pt-4 border-t-2 border-gray-200 grid grid-cols-2 gap-6 text-[11px]">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <span className="font-bold text-gray-700 block mb-1">Visa Responsable Maintenance :</span>
                  <p className="text-gray-500 text-[10px] italic">Signature & cachet :</p>
                  <div className="h-10 mt-2 border-b border-dashed border-gray-300" />
                </div>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <span className="font-bold text-gray-700 block mb-1">Visa Contrôle Qualité / HSE :</span>
                  <p className="text-gray-500 text-[10px] italic">Signature & cachet :</p>
                  <div className="h-10 mt-2 border-b border-dashed border-gray-300" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
