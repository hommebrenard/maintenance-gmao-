import React, { useState } from 'react';
import { Package, Plus } from 'lucide-react';
import type { EquipmentPart } from '../../types';
import { formatPrice, formatQuantity, isLowStock } from '../../utils/healthRecordDisplay';
import { sortParts } from '../../utils/equipmentParts';
import {
  createEquipmentPart, deleteEquipmentPart, updateEquipmentPart, type EquipmentPartInput,
} from '../../lib/queries/equipmentParts';
import { errorMessage, type ExtraState } from './useEquipmentExtras';
import { Dash, PanelState } from './PanelState';
import { EquipmentPartForm } from './EquipmentPartForm';

interface Props {
  state: ExtraState<EquipmentPart>;
  equipmentId: string;
  currentUserId: string;
  /** Managers uniquement (la RLS refuse de toute façon les autres). */
  canEdit: boolean;
  onItemsChange: (fn: (items: EquipmentPart[]) => EquipmentPart[]) => void;
}

/** Pièces de rechange rattachées à l'équipement (indépendantes de l'inventaire général) ; écriture réservée aux managers. */
export const EquipmentPartsPanel: React.FC<Props> = ({ state, equipmentId, currentUserId, canEdit, onItemsChange }) => {
  // formOpen : null = fermé, 'new' = création, sinon la pièce en cours de modification.
  const [formOpen, setFormOpen] = useState<null | 'new' | EquipmentPart>(null);
  const [toDelete, setToDelete] = useState<EquipmentPart | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const closeForm = () => { setFormOpen(null); setFormError(null); };

  const handleSubmit = async (input: EquipmentPartInput) => {
    setBusy(true);
    setFormError(null);
    try {
      if (formOpen && formOpen !== 'new') {
        const saved = await updateEquipmentPart(formOpen.id, input);
        onItemsChange(items => sortParts(items.map(i => (i.id === saved.id ? saved : i))));
      } else {
        const created = await createEquipmentPart({ ...input, equipmentId }, currentUserId);
        onItemsChange(items => sortParts([...items, created]));
      }
      setActionError(null);
      setFormOpen(null);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteEquipmentPart(toDelete.id);
      const id = toDelete.id;
      onItemsChange(items => items.filter(i => i.id !== id));
      setActionError(null);
      setToDelete(null);
    } catch (err) {
      setActionError(errorMessage(err));
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Package className="w-4 h-4 text-emerald-600" /> Pièces de rechange ({state.loading ? '…' : state.items.length})
        </h3>
        {canEdit && !state.loading && !state.error && (
          <button
            type="button"
            onClick={() => { setFormError(null); setFormOpen('new'); }}
            className="print:hidden flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter une pièce
          </button>
        )}
      </div>

      {actionError && (
        <div className="mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{actionError}</div>
      )}

      <PanelState state={state} emptyText="Aucune pièce rattachée à cet équipement.">
        <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Désignation</th>
                <th className="px-3 py-2 font-medium">Référence</th>
                <th className="px-3 py-2 font-medium">Fabricant</th>
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Seuil mini</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Prix unitaire</th>
                <th className="px-3 py-2 font-medium">Emplacement</th>
                {canEdit && <th className="px-3 py-2 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {state.items.map(p => (
                <tr key={p.id}>
                  <td className="px-3 py-1.5 text-gray-900">
                    {p.name}
                    {p.code && <div className="text-[10px] font-mono text-gray-400">{p.code}</div>}
                  </td>
                  <td className="px-3 py-1.5 text-gray-600">{p.reference ?? <Dash />}</td>
                  <td className="px-3 py-1.5 text-gray-600">{p.manufacturer ?? <Dash />}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-gray-900">
                    {formatQuantity(p.stock)}{p.unit ? ` ${p.unit}` : ''}
                    {isLowStock(p) && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">Sous le seuil</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-gray-600">{p.minStock > 0 ? formatQuantity(p.minStock) : <Dash />}</td>
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{p.unitPrice !== undefined ? formatPrice(p.unitPrice) : <Dash />}</td>
                  <td className="px-3 py-1.5 text-gray-600">{p.location ?? <Dash />}</td>
                  {canEdit && (
                    <td className="px-3 py-1.5 text-right whitespace-nowrap font-semibold space-x-3">
                      <button type="button" onClick={() => { setFormError(null); setFormOpen(p); }} className="text-blue-600 hover:underline">Modifier</button>
                      <button type="button" onClick={() => setToDelete(p)} className="text-red-600 hover:underline">Supprimer</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>

      {formOpen && (
        <EquipmentPartForm
          key={formOpen === 'new' ? 'new' : formOpen.id}
          part={formOpen === 'new' ? undefined : formOpen}
          saving={busy}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {toDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-3">
            <h3 className="text-base font-bold text-gray-900">Supprimer cette pièce ?</h3>
            <p className="text-sm text-gray-700">
              « {toDelete.name} » — stock : {formatQuantity(toDelete.stock)}{toDelete.unit ? ` ${toDelete.unit}` : ''}.
              Cette suppression est définitive.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setToDelete(null)} disabled={busy} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg disabled:opacity-50">Annuler</button>
              <button type="button" onClick={handleDelete} disabled={busy} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
                {busy ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
