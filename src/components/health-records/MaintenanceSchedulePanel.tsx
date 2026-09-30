import React, { useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import type { MaintenanceSchedule } from '../../types';
import { formatIsoDate } from '../../utils/equipmentDisplay';
import { hasControlDetails, scheduleFrequencyLabel, scheduleStatusBadgeClass, scheduleStatusLabel } from '../../utils/healthRecordDisplay';
import { formatDuration, sortSchedules } from '../../utils/maintenanceSchedule';
import {
  createMaintenanceSchedule, deleteMaintenanceSchedule, updateMaintenanceSchedule,
  type MaintenanceScheduleInput,
} from '../../lib/queries/maintenanceSchedules';
import { errorMessage, type ExtraState } from './useEquipmentExtras';
import { Dash, PanelState } from './PanelState';
import { MaintenanceScheduleForm } from './MaintenanceScheduleForm';

interface Props {
  state: ExtraState<MaintenanceSchedule>;
  equipmentId: string;
  currentUserId: string;
  /** Managers uniquement (la RLS refuse de toute façon les autres). */
  canEdit: boolean;
  onItemsChange: (fn: (items: MaintenanceSchedule[]) => MaintenanceSchedule[]) => void;
}

/** Échéances de maintenance de l'équipement ; ajout / modification / suppression pour les managers. */
export const MaintenanceSchedulePanel: React.FC<Props> = ({ state, equipmentId, currentUserId, canEdit, onItemsChange }) => {
  // formOpen : null = fermé, 'new' = création, sinon l'échéance en cours de modification.
  const [formOpen, setFormOpen] = useState<null | 'new' | MaintenanceSchedule>(null);
  const [toDelete, setToDelete] = useState<MaintenanceSchedule | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const closeForm = () => { setFormOpen(null); setFormError(null); };

  const handleSubmit = async (input: MaintenanceScheduleInput) => {
    setBusy(true);
    setFormError(null);
    try {
      if (formOpen && formOpen !== 'new') {
        const saved = await updateMaintenanceSchedule(formOpen.id, input);
        onItemsChange(items => sortSchedules(items.map(i => (i.id === saved.id ? saved : i))));
      } else {
        const created = await createMaintenanceSchedule({ ...input, equipmentId }, currentUserId);
        onItemsChange(items => sortSchedules([...items, created]));
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
      await deleteMaintenanceSchedule(toDelete.id);
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
          <CalendarClock className="w-4 h-4 text-emerald-600" /> Planification ({state.loading ? '…' : state.items.length})
        </h3>
        {canEdit && !state.loading && !state.error && (
          <button
            type="button"
            onClick={() => { setFormError(null); setFormOpen('new'); }}
            className="print:hidden flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter une échéance
          </button>
        )}
      </div>

      {actionError && (
        <div className="mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{actionError}</div>
      )}

      <PanelState state={state} emptyText="Aucune échéance enregistrée pour cet équipement.">
        <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Intitulé</th>
                <th className="px-3 py-2 font-medium">Périodicité</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Dernière réalisation</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Prochaine échéance</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                {canEdit && <th className="px-3 py-2 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {state.items.map(s => (
                <React.Fragment key={s.id}>
                <tr>
                  <td className="px-3 py-1.5 text-gray-900">
                    {s.title}
                    {s.legalRequirement && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-semibold">Réglementaire</span>
                    )}
                    {hasControlDetails(s) && (
                      <button type="button" onClick={() => toggleExpanded(s.id)} className="ml-2 text-[10px] font-semibold text-emerald-700 hover:underline">
                        {expanded.has(s.id) ? 'Détails ▲' : 'Détails ▼'}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-gray-600">{scheduleFrequencyLabel(s) ?? <Dash />}</td>
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{s.lastDoneDate ? formatIsoDate(s.lastDoneDate) : <Dash />}</td>
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{s.nextDueDate ? formatIsoDate(s.nextDueDate) : <Dash />}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${scheduleStatusBadgeClass(s.status)}`}>
                      {scheduleStatusLabel(s.status)}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-3 py-1.5 text-right whitespace-nowrap font-semibold space-x-3">
                      <button type="button" onClick={() => { setFormError(null); setFormOpen(s); }} className="text-blue-600 hover:underline">Modifier</button>
                      <button type="button" onClick={() => setToDelete(s)} className="text-red-600 hover:underline">Supprimer</button>
                    </td>
                  )}
                </tr>
                {expanded.has(s.id) && (
                  <tr className="bg-gray-50">
                    <td colSpan={canEdit ? 6 : 5} className="px-3 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        <div><span className="font-semibold text-gray-500">Organisme de contrôle : </span><span className="text-gray-900">{s.inspectionBody ?? <Dash />}</span></div>
                        <div><span className="font-semibold text-gray-500">Durée estimée : </span><span className="text-gray-900">{s.estimatedDurationMinutes ? formatDuration(s.estimatedDurationMinutes) : <Dash />}</span></div>
                        <div className="sm:col-span-2">
                          <span className="font-semibold text-gray-500 block">Points de contrôle</span>
                          {s.controlPoints ? <p className="text-gray-900 whitespace-pre-line">{s.controlPoints}</p> : <Dash />}
                        </div>
                        <div className="sm:col-span-2">
                          <span className="font-semibold text-gray-500 block">Consignes de sécurité / habilitations</span>
                          {s.safetyInstructions
                            ? <p className="text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2 whitespace-pre-line">{s.safetyInstructions}</p>
                            : <Dash />}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>

      {formOpen && (
        <MaintenanceScheduleForm
          key={formOpen === 'new' ? 'new' : formOpen.id}
          schedule={formOpen === 'new' ? undefined : formOpen}
          saving={busy}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {toDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-3">
            <h3 className="text-base font-bold text-gray-900">Supprimer cette échéance ?</h3>
            <p className="text-sm text-gray-700">
              « {toDelete.title} » — prochaine échéance : {toDelete.nextDueDate ? formatIsoDate(toDelete.nextDueDate) : 'Non renseigné'}.
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
