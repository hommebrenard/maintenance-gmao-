import React, { useEffect } from 'react';
import { X, CheckCircle2, XCircle } from 'lucide-react';
import type { MaintenanceRequest, Equipment, WorkOrder } from '../../types';
import { displayState, DISPLAY_STATE_CLASS } from '../../utils/requestDisplay';
import { responsibleOf } from '../../utils/workOrderResponsible';
import { formatDateFr } from '../../utils/reportTable';
import { formatDateTimeFr } from '../../utils/reportExport';

interface Props {
  request: MaintenanceRequest;
  equipment?: Equipment;
  locationName?: string;
  workOrder?: WorkOrder;
  isManager: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const Field: React.FC<{ label: string; value?: React.ReactNode; highlight?: boolean; mono?: boolean }> = ({ label, value, highlight, mono }) => (
  <div>
    <div className="text-[11px] font-semibold text-gray-500 uppercase mb-1">{label}</div>
    <div className={`px-3 py-2 text-sm rounded-md border min-h-[36px] break-words ${highlight ? 'bg-yellow-50 border-yellow-300 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-800'} ${mono ? 'font-mono text-xs' : ''}`}>
      {value || <span className="text-gray-400">—</span>}
    </div>
  </div>
);

/** Fiche de demande d'intervention (lecture) : champs de la demande + bloc « Informations OT ». */
export const RequestDetailModal: React.FC<Props> = ({ request, equipment, locationName, workOrder, isManager, onClose, onApprove, onReject }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const state = displayState(request, workOrder);
  const canDecide = isManager && request.status === 'En attente';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-gray-900">Demande d'intervention</h3>
            <span className="font-mono text-sm text-gray-600">{request.code}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${DISPLAY_STATE_CLASS[state]}`}>{state}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="N° de DI" value={request.code} mono />
            <Field label="Demandeur" value={request.requestedBy} />
            <Field label="Priorité demandée" value={request.priority} />
          </div>

          <Field label="Description de l'incident" highlight value={
            <div>
              <div className="font-semibold">{request.title}</div>
              {request.description && <div className="mt-1 whitespace-pre-wrap">{request.description}</div>}
            </div>
          } />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Field label="Équipement source" highlight value={equipment ? `${equipment.code} — ${equipment.name}` : (request.equipmentName ?? (request.equipmentCode ? `${request.equipmentCode} (non rattaché à un équipement de l'application)` : ''))} />
            </div>
            <Field label="Site" value={equipment?.location || locationName || request.location || (request.siteCode ? `${request.siteCode} (hors application)` : '')} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Date de déclaration" value={request.declaredAt ? formatDateTimeFr(request.declaredAt, request.origin === 'coswin') : request.createdAt} />
            {request.dueDate && <Field label="Date de fin prévue" value={formatDateFr(request.dueDate)} />}
            <Field label="Date de décision" value={formatDateTimeFr(request.decidedAt)} />
          </div>

          <fieldset className="border border-gray-200 rounded-lg p-4">
            <legend className="px-2 text-xs font-semibold text-gray-500 uppercase">Informations OT</legend>
            {workOrder ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="N° d'OT" value={workOrder.code} mono />
                <Field label="État OT" value={workOrder.status} />
                <Field label="Intervenant" value={responsibleOf(workOrder)} />
                <Field label="Échéance" value={workOrder.dueDate ? formatDateFr(workOrder.dueDate) : ''} />
                <Field label="Date de clôture (système)" value={formatDateTimeFr(workOrder.closedAt)} />
              </div>
            ) : request.otNumber ? (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="N° d'OT (Coswin)" value={`OT-${request.otNumber}`} mono />
                  <Field label="État OT" value={request.otStateLabel ?? request.otState} />
                  <Field label="Début prévu" value={request.plannedStart ? formatDateFr(request.plannedStart) : ''} />
                  <Field label="Date de fin" value={request.otEndDate ? formatDateFr(request.otEndDate) : ''} />
                </div>
                <p className="mt-3 text-xs text-gray-500">Cet OT vient de Coswin : il n'existe pas dans l'application, les informations sont celles du fichier importé.</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {request.status === 'En attente' ? "Aucun OT : la demande n'est pas encore décidée." :
                 request.status === 'Rejetée' ? 'Aucun OT : la demande a été rejetée.' :
                 "OT introuvable dans la période chargée."}
              </p>
            )}
          </fieldset>

          {request.origin === 'coswin' && (
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="px-2 text-xs font-semibold text-gray-500 uppercase">Données Coswin (import)</legend>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="État Coswin" value={request.coswinState} />
                <Field label="Type d'intervention" value={request.interventionType} />
                <Field label="N° DAF" value={request.dafNumber} mono />
                <Field label="QSE - type" value={request.qseType} />
                <Field label="Priorité Coswin" value={request.priorityCode} />
                <Field label="Fonction" value={[request.functionLabel, request.functionCode].filter(Boolean).join(' · ')} />
                <Field label="Superviseur" value={request.supervisorName} />
                <Field label="Centre de charges" value={request.costCenter} />
                <Field label="N° d'intervention" value={request.interventionCode} mono />
                <Field label="Date de création Coswin" value={formatDateTimeFr(request.coswinCreatedAt, true)} />
                <Field label="Visa" value={request.visa} />
              </div>
            </fieldset>
          )}
        </div>

        {canDecide && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <button onClick={() => { onReject(request.id); onClose(); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100">
              <XCircle className="w-4 h-4" /><span>Rejeter</span>
            </button>
            <button onClick={() => { onApprove(request.id); onClose(); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
              <CheckCircle2 className="w-4 h-4" /><span>Approuver & Créer OT</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
