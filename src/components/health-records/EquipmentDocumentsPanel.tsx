import React, { useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import type { EquipmentDocument } from '../../types';
import { formatIsoDate } from '../../utils/equipmentDisplay';
import { documentCategoryLabel, formatFileSize } from '../../utils/healthRecordDisplay';
import { isHttpUrl } from '../../utils/scheduleControls';
import { addEquipmentDocuments, deleteEquipmentDocumentWithFile, openEquipmentDocument } from '../../lib/documents';
import { errorMessage, type ExtraState } from './useEquipmentExtras';
import { Dash, PanelState } from './PanelState';
import { DocumentUploadForm, type DocumentUploadValues } from './DocumentUploadForm';

interface Props {
  state: ExtraState<EquipmentDocument>;
  equipmentId: string;
  currentUserId: string;
  /** Managers uniquement (la RLS refuse de toute façon les autres). */
  canEdit: boolean;
  onItemsChange: (fn: (items: EquipmentDocument[]) => EquipmentDocument[]) => void;
}

/** Documents de l'équipement : ouverture des fichiers (lien signé) et des liens GED ; ajout et suppression réservés aux managers. */
export const EquipmentDocumentsPanel: React.FC<Props> = ({ state, equipmentId, currentUserId, canEdit, onItemsChange }) => {
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<EquipmentDocument | null>(null);

  const handleSubmit = async (v: DocumentUploadValues) => {
    setBusy(true);
    setFormError(null);
    try {
      const { docs, warning } = await addEquipmentDocuments({
        equipmentId, createdBy: currentUserId, name: v.name, category: v.category, file: v.file, externalUrl: v.url,
      });
      onItemsChange(items => [...docs, ...items]);
      setNotice(warning ?? null);
      setActionError(null);
      setFormOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const id = toDelete.id;
    setBusy(true);
    try {
      const { warning } = await deleteEquipmentDocumentWithFile(toDelete);
      onItemsChange(items => items.filter(i => i.id !== id));
      setNotice(warning ?? null);
      setActionError(null);
    } catch (err) {
      setActionError(`Suppression impossible : ${errorMessage(err)}`);
    } finally {
      setToDelete(null);
      setBusy(false);
    }
  };

  const open = async (d: EquipmentDocument) => {
    try {
      await openEquipmentDocument(d);
      setActionError(null);
    } catch (err) {
      setActionError(`Ouverture impossible : ${errorMessage(err)}`);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <FileText className="w-4 h-4 text-emerald-600" /> Documents ({state.loading ? '…' : state.items.length})
        </h3>
        {canEdit && !state.loading && !state.error && (
          <button
            type="button"
            onClick={() => { setFormError(null); setFormOpen(true); }}
            className="print:hidden flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter un document
          </button>
        )}
      </div>

      {actionError && <div className="mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{actionError}</div>}
      {notice && <div className="mb-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">{notice}</div>}

      <PanelState state={state} emptyText="Aucun document rattaché à cet équipement.">
        <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Nom</th>
                <th className="px-3 py-2 font-medium">Catégorie</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Ajouté le</th>
                <th className="px-3 py-2 font-medium">Taille</th>
                {canEdit && <th className="px-3 py-2 font-medium print:hidden text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {state.items.map(d => (
                <tr key={d.id}>
                  <td className="px-3 py-1.5 text-gray-900">
                    {d.storagePath ? (
                      <button type="button" onClick={() => open(d)} className="text-blue-600 hover:underline text-left">{d.name}</button>
                    ) : d.externalUrl && isHttpUrl(d.externalUrl) ? (
                      <a href={d.externalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{d.name}</a>
                    ) : (
                      d.name
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-gray-600">{documentCategoryLabel(d.category)}</td>
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{formatIsoDate(d.createdAt)}</td>
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{formatFileSize(d.sizeBytes) ?? (d.externalUrl ? 'Lien externe' : <Dash />)}</td>
                  {canEdit && (
                    <td className="px-3 py-1.5 text-right whitespace-nowrap print:hidden">
                      <button type="button" onClick={() => setToDelete(d)} className="font-semibold text-red-600 hover:underline">Supprimer</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>

      {toDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-3">
            <h3 className="text-base font-bold text-gray-900">Supprimer ce document ?</h3>
            <p className="text-sm text-gray-700">
              « {toDelete.name} ». Cette suppression est définitive
              {toDelete.storagePath ? " : le fichier est aussi effacé du stockage." : " : seul le lien enregistré est supprimé, le document reste dans la GED."}
            </p>
            {toDelete.controlId && (
              <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-2">Ce document est le compte rendu d'un contrôle réalisé : le contrôle est conservé, sans compte rendu.</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setToDelete(null)} disabled={busy} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg disabled:opacity-50">Annuler</button>
              <button type="button" onClick={handleDelete} disabled={busy} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
                {busy ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <DocumentUploadForm title="Ajouter un document" saving={busy} error={formError} onSubmit={handleSubmit} onCancel={() => { setFormOpen(false); setFormError(null); }} />
      )}
    </div>
  );
};
