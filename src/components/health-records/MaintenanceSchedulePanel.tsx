import React, { useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import type { EquipmentDocument, MaintenanceSchedule, ScheduleControl } from '../../types';
import { formatIsoDate } from '../../utils/equipmentDisplay';
import { hasControlDetails, scheduleFrequencyLabel, scheduleStatusBadgeClass, scheduleStatusLabel } from '../../utils/healthRecordDisplay';
import { formatDuration, sortSchedules } from '../../utils/maintenanceSchedule';
import { controlResultBadgeClass, controlResultLabel, isHttpUrl, sortControls } from '../../utils/scheduleControls';
import {
  createMaintenanceSchedule, deleteMaintenanceSchedule, updateMaintenanceSchedule,
  type MaintenanceScheduleInput,
} from '../../lib/queries/maintenanceSchedules';
import { createScheduleControl, updateScheduleControl } from '../../lib/queries/scheduleControls';
import { addEquipmentDocuments, openEquipmentDocument } from '../../lib/documents';
import { errorMessage, type ExtraState } from './useEquipmentExtras';
import { Dash, PanelState } from './PanelState';
import { MaintenanceScheduleForm } from './MaintenanceScheduleForm';
import { ScheduleControlForm, type ScheduleControlFormValues } from './ScheduleControlForm';
import { DocumentUploadForm, type DocumentUploadValues } from './DocumentUploadForm';

interface Props {
  state: ExtraState<MaintenanceSchedule>;
  controls: ScheduleControl[];
  documents: EquipmentDocument[];
  equipmentId: string;
  currentUserId: string;
  /** Managers uniquement (la RLS refuse de toute façon les autres). */
  canEdit: boolean;
  onItemsChange: (fn: (items: MaintenanceSchedule[]) => MaintenanceSchedule[]) => void;
  onControlsChange: (fn: (items: ScheduleControl[]) => ScheduleControl[]) => void;
  onDocumentsChange: (fn: (items: EquipmentDocument[]) => EquipmentDocument[]) => void;
}

/** Liste des contrôles réalisés avec verdict et comptes rendus (liens GED). */
const ControlList: React.FC<{
  controls: ScheduleControl[];
  documents: EquipmentDocument[];
  canEdit: boolean;
  onEdit: (c: ScheduleControl) => void;
  onAddDoc: (c: ScheduleControl) => void;
  onOpenDoc: (d: EquipmentDocument) => void;
}> = ({ controls, documents, canEdit, onEdit, onAddDoc, onOpenDoc }) => (
  <div className="space-y-2">
    {controls.map(c => {
      const docs = documents.filter(d => d.controlId === c.id);
      return (
        <div key={c.id} className="border border-gray-200 rounded-lg bg-white p-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-bold text-gray-900">{formatIsoDate(c.performedOn)}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${controlResultBadgeClass(c.result)}`}>
              {controlResultLabel(c.result)}
            </span>
            <span className="text-gray-600">{c.inspectionBody ?? 'Organisme : Non renseigné'}</span>
            {canEdit && (
              <span className="ml-auto space-x-3 font-semibold">
                <button type="button" onClick={() => onAddDoc(c)} className="text-emerald-700 hover:underline">Ajouter un document</button>
                <button type="button" onClick={() => onEdit(c)} className="text-blue-600 hover:underline">Modifier</button>
              </span>
            )}
          </div>
          {c.notes && <p className="mt-1 text-gray-800 whitespace-pre-line">{c.notes}</p>}
          <div className="mt-1 text-gray-600">
            {docs.length === 0 ? (
              <span>Compte rendu : Non renseigné</span>
            ) : (
              docs.map(d => (
                <div key={d.id}>
                  Compte rendu :{' '}
                  {d.storagePath ? (
                    <button type="button" onClick={() => onOpenDoc(d)} className="text-blue-600 hover:underline">{d.name}</button>
                  ) : d.externalUrl && isHttpUrl(d.externalUrl) ? (
                    <a href={d.externalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{d.name}</a>
                  ) : (
                    <span className="text-gray-900">{d.name}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      );
    })}
  </div>
);

/** Échéances de maintenance de l'équipement ; ajout / modification / suppression et contrôles réalisés pour les managers. */
export const MaintenanceSchedulePanel: React.FC<Props> = ({
  state, controls, documents, equipmentId, currentUserId, canEdit, onItemsChange, onControlsChange, onDocumentsChange,
}) => {
  // formOpen : null = fermé, 'new' = création, sinon l'échéance en cours de modification.
  const [formOpen, setFormOpen] = useState<null | 'new' | MaintenanceSchedule>(null);
  const [toDelete, setToDelete] = useState<MaintenanceSchedule | null>(null);
  // controlForm : contrôle à enregistrer (échéance) ou à corriger (échéance + contrôle).
  const [controlForm, setControlForm] = useState<null | { schedule: MaintenanceSchedule; control?: ScheduleControl }>(null);
  // docForm : contrôle auquel on ajoute un document (fichier et/ou lien).
  const [docForm, setDocForm] = useState<ScheduleControl | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const closeForm = () => { setFormOpen(null); setFormError(null); };
  const closeControlForm = () => { setControlForm(null); setFormError(null); };

  const scheduleIds = new Set(state.items.map(s => s.id));
  const controlsOf = (scheduleId: string) => controls.filter(c => c.scheduleId === scheduleId);
  // Contrôles dont l'échéance a été supprimée : conservés, donc affichés à part (jamais cachés).
  const orphanControls = controls.filter(c => !c.scheduleId || !scheduleIds.has(c.scheduleId));
  const hasDetails = (s: MaintenanceSchedule) => hasControlDetails(s) || controlsOf(s.id).length > 0;

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

  /** Ajoute le fichier et/ou le lien GED du compte rendu ; renvoie un avertissement si l'ajout échoue. */
  const addReportDocuments = async (control: ScheduleControl, v: ScheduleControlFormValues): Promise<string | null> => {
    if (!v.docUrl && !v.docFile) return null;
    try {
      const { docs, warning } = await addEquipmentDocuments({
        equipmentId,
        createdBy: currentUserId,
        name: v.docName ?? undefined,
        category: 'report',
        controlId: control.id,
        file: v.docFile,
        externalUrl: v.docUrl,
      });
      onDocumentsChange(items => [...docs, ...items]);
      return warning ?? null;
    } catch (err) {
      return `Le compte rendu n'a pas pu être enregistré (${errorMessage(err)}). Vous pouvez le rajouter avec « Ajouter un document » sur le contrôle.`;
    }
  };

  /** Ajout d'un document sur un contrôle existant. */
  const handleDocSubmit = async (v: DocumentUploadValues) => {
    if (!docForm) return;
    setBusy(true);
    setFormError(null);
    try {
      const { docs, warning } = await addEquipmentDocuments({
        equipmentId, createdBy: currentUserId, name: v.name, category: 'report', controlId: docForm.id, file: v.file, externalUrl: v.url,
      });
      onDocumentsChange(items => [...docs, ...items]);
      setNotice(warning ?? null);
      setActionError(null);
      setDocForm(null);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openDoc = async (d: EquipmentDocument) => {
    try {
      await openEquipmentDocument(d);
      setActionError(null);
    } catch (err) {
      setActionError(`Ouverture impossible : ${errorMessage(err)}`);
    }
  };

  const handleControlSubmit = async (v: ScheduleControlFormValues) => {
    if (!controlForm) return;
    const { schedule, control } = controlForm;
    setBusy(true);
    setFormError(null);
    const warnings: string[] = [];
    try {
      let saved: ScheduleControl;
      if (control) {
        saved = await updateScheduleControl(control.id, {
          performedOn: v.performedOn, inspectionBody: v.inspectionBody, result: v.result, notes: v.notes,
        });
        onControlsChange(items => sortControls(items.map(i => (i.id === saved.id ? saved : i))));
      } else {
        saved = await createScheduleControl(
          {
            equipmentId, scheduleId: schedule.id, title: schedule.title, performedOn: v.performedOn,
            inspectionBody: v.inspectionBody, result: v.result, notes: v.notes,
          },
          currentUserId
        );
        onControlsChange(items => sortControls([...items, saved]));
      }
      const linkWarning = await addReportDocuments(saved, v);
      if (linkWarning) warnings.push(linkWarning);
      if (v.updateSchedule) {
        try {
          const updated = await updateMaintenanceSchedule(schedule.id, { lastDoneDate: v.performedOn, nextDueDate: v.nextDueDate });
          onItemsChange(items => sortSchedules(items.map(i => (i.id === updated.id ? updated : i))));
        } catch (err) {
          warnings.push(`Le contrôle est enregistré, mais l'échéance n'a pas pu être mise à jour (${errorMessage(err)}). Modifiez-la avec « Modifier ».`);
        }
      }
      setActionError(null);
      setNotice(warnings.length ? warnings.join(' ') : null);
      setControlForm(null);
      setExpanded(prev => new Set(prev).add(schedule.id));
    } catch (err) {
      // Échec de l'enregistrement du contrôle lui-même : rien n'a été écrit, le formulaire reste ouvert.
      setFormError(errorMessage(err));
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
      {notice && (
        <div className="mb-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">{notice}</div>
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
                    {hasDetails(s) && (
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
                      {s.legalRequirement && (
                        <button type="button" onClick={() => { setFormError(null); setControlForm({ schedule: s }); }} className="text-emerald-700 hover:underline">Contrôle réalisé</button>
                      )}
                      <button type="button" onClick={() => { setFormError(null); setFormOpen(s); }} className="text-blue-600 hover:underline">Modifier</button>
                      <button type="button" onClick={() => setToDelete(s)} className="text-red-600 hover:underline">Supprimer</button>
                    </td>
                  )}
                </tr>
                {expanded.has(s.id) && (
                  <tr className="bg-gray-50">
                    <td colSpan={canEdit ? 6 : 5} className="px-3 py-3 space-y-3">
                      {hasControlDetails(s) && (
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
                      )}
                      {controlsOf(s.id).length > 0 && (
                        <div>
                          <span className="text-xs font-semibold text-gray-500 block mb-1">Contrôles réalisés ({controlsOf(s.id).length})</span>
                          <ControlList
                            controls={controlsOf(s.id)} documents={documents} canEdit={canEdit}
                            onEdit={c => { setFormError(null); setControlForm({ schedule: s, control: c }); }}
                            onAddDoc={c => { setFormError(null); setDocForm(c); }}
                            onOpenDoc={openDoc}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>

      {orphanControls.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-bold text-gray-700 mb-1">Contrôles sans échéance associée ({orphanControls.length})</h4>
          <p className="text-[11px] text-gray-500 mb-2">L'échéance correspondante a été supprimée : les contrôles et leurs comptes rendus sont conservés.</p>
          <ControlList controls={orphanControls} documents={documents} canEdit={false} onEdit={() => undefined} onAddDoc={() => undefined} onOpenDoc={openDoc} />
        </div>
      )}

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

      {controlForm && (
        <ScheduleControlForm
          key={controlForm.control?.id ?? `new-${controlForm.schedule.id}`}
          schedule={controlForm.schedule}
          control={controlForm.control}
          saving={busy}
          error={formError}
          onSubmit={handleControlSubmit}
          onCancel={closeControlForm}
        />
      )}

      {docForm && (
        <DocumentUploadForm
          title="Ajouter un document au contrôle"
          categoryFixed="report"
          saving={busy}
          error={formError}
          onSubmit={handleDocSubmit}
          onCancel={() => { setDocForm(null); setFormError(null); }}
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
            {controlsOf(toDelete.id).length > 0 && (
              <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-2">
                Ses {controlsOf(toDelete.id).length} contrôle(s) réalisé(s) et leurs comptes rendus sont conservés.
              </p>
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
    </div>
  );
};
