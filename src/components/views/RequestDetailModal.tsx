import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, XCircle, Printer, Download, HeartPulse } from 'lucide-react';
import type { MaintenanceRequest, Equipment, WorkOrder } from '../../types';
import { displayState, DISPLAY_STATE_CLASS, requestAlert, decisionOrigin } from '../../utils/requestDisplay';
import { responsibleOf } from '../../utils/workOrderResponsible';
import { formatDateFr } from '../../utils/reportTable';
import { formatDateTimeFr } from '../../utils/reportExport';
import { exportRequestToPdf, printRequestPdf } from '../../utils/requestPdf';
import { proposedDueDate, isValidIsoDate, formatIsoFr } from '../../utils/requestDueDate';
import { RequestAttachmentsBlock } from './RequestAttachmentsBlock';

interface Props {
  request: MaintenanceRequest;
  equipment?: Equipment;
  locationName?: string;
  workOrder?: WorkOrder;
  isManager: boolean;
  /** Compte connecté : sert à autoriser le demandeur à lier SES pièces jointes au carnet (la base revérifie). */
  currentUserId?: string;
  onClose: () => void;
  /** `dueDate` : date de fin RETENUE par le responsable (AAAA-MM-JJ), devient l'échéance de l'OT créé. */
  onApprove: (id: string, dueDate?: string) => void;
  onReject: (id: string, reason?: string) => void;
  /** Enregistre le motif d'une demande rejetée / annulée (responsable). */
  onSaveReason?: (id: string, reason: string) => void;
  /** Ouvre le carnet de santé de l'équipement reconnu. */
  onOpenHealthRecord?: (equipmentId: string) => void;
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
export const RequestDetailModal: React.FC<Props> = ({ request, equipment, locationName, workOrder, isManager, currentUserId, onClose, onApprove, onReject, onSaveReason, onOpenHealthRecord }) => {
  // Rejet avec motif obligatoire ; saisie / correction du motif d'une demande déjà rejetée ou annulée (responsable).
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [reasonDraft, setReasonDraft] = useState(request.rejectionReason ?? '');
  // Date de fin retenue : préremplie avec la proposition de la demande (ou calculée d'après la priorité), modifiable.
  const initialDue = () => request.proposedDueDate ?? proposedDueDate(request.priority);
  const [chosenDue, setChosenDue] = useState(initialDue);
  useEffect(() => { setChosenDue(initialDue()); }, [request.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setReasonDraft(request.rejectionReason ?? ''); }, [request.id, request.rejectionReason]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const state = displayState(request, workOrder);
  const canDecide = isManager && request.status === 'En attente';
  const alert = requestAlert(request);
  const origin = decisionOrigin(request);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-gray-900">Demande d'intervention</h3>
            <span className="font-mono text-sm text-gray-600">{request.code}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${DISPLAY_STATE_CLASS[state]}`}>{state}</span>
          </div>
          <div className="flex items-center gap-3">
            {equipment && onOpenHealthRecord && (
            <button onClick={() => { onOpenHealthRecord(equipment.id); onClose(); }} title="Ouvrir le carnet de santé de l'équipement"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              <HeartPulse className="w-4 h-4" /><span>Carnet de santé</span>
            </button>
          )}
          <button onClick={() => exportRequestToPdf({ request, equipment, locationName, workOrder })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <Download className="w-3.5 h-3.5" /><span>Télécharger PDF</span>
            </button>
            <button onClick={() => printRequestPdf({ request, equipment, locationName, workOrder })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <Printer className="w-3.5 h-3.5" /><span>Imprimer</span>
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fermer"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {alert && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span aria-hidden>⚠</span><span><strong>OT actif.</strong> {alert}</span>
            </div>
          )}
          {origin && (
            <fieldset className="border border-gray-200 rounded-lg px-4 pb-4 pt-1">
              <legend className="px-2 text-xs font-semibold text-gray-500 uppercase">Décision</legend>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Origine" value={origin === 'coswin' ? `Annulée dans Coswin (état « ${request.coswinState ?? '5'} »)` : "Rejetée dans l'application"} />
                <div className="md:col-span-2">
                  <div className="text-[11px] font-semibold text-gray-500 uppercase mb-1">Motif</div>
                  {isManager && onSaveReason ? (
                    <div className="space-y-2">
                      <textarea value={reasonDraft} onChange={e => setReasonDraft(e.target.value)} rows={2}
                        placeholder={origin === 'coswin' ? "Motif d'annulation (absent de l'export Coswin : à saisir si connu)" : 'Motif du rejet'}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      {reasonDraft.trim() !== (request.rejectionReason ?? '').trim() && (
                        <button onClick={() => onSaveReason(request.id, reasonDraft)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Enregistrer le motif</button>
                      )}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-sm rounded-md border bg-gray-50 border-gray-200 min-h-[36px] whitespace-pre-wrap">
                      {request.rejectionReason || <span className="text-gray-400">{origin === 'coswin' ? "Non renseigné (l'export Coswin ne fournit pas le motif)" : 'Non renseigné'}</span>}
                    </div>
                  )}
                </div>
              </div>
            </fieldset>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="N° de DI" value={request.code} mono />
            <Field label="Demandeur" value={request.requestedBy} />
            <Field label="Priorité demandée" value={request.priority} />
            {request.requesterEmail && <Field label="Courriel du demandeur" value={request.requesterEmail} />}
            {request.proposedDueDate && <Field label="Date de fin proposée (à la saisie)" value={formatIsoFr(request.proposedDueDate)} />}
            {request.origin !== 'coswin' && request.dueDate && <Field label="Date de fin retenue (responsable)" value={formatIsoFr(request.dueDate)} highlight />}
          </div>

          <Field label="Description de l'incident" highlight value={
            <div>
              <div className="font-semibold">{request.title}</div>
              {request.description && <div className="mt-1 whitespace-pre-wrap">{request.description}</div>}
            </div>
          } />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Field label={request.plannedEquipmentCode ? 'Équipement planifié (lié — carnet de santé)' : 'Équipement'} highlight value={equipment ? `${equipment.code} — ${equipment.name}` : (request.equipmentName ?? ((request.plannedEquipmentCode || request.equipmentCode) ? `${request.plannedEquipmentCode || request.equipmentCode} (non rattaché à un équipement de l'application)` : ''))} />
              {request.equipmentCode && (!equipment || equipment.code !== request.equipmentCode) && (
                <div className="mt-2"><Field label="Équipement source (Coswin)" value={request.equipmentCode} /></div>
              )}
            </div>
            <Field label="Site" value={equipment?.location || locationName || request.location || (request.siteCode ? `${request.siteCode} (hors application)` : '')} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Date de déclaration" value={request.declaredAt ? formatDateTimeFr(request.declaredAt, request.origin === 'coswin') : request.createdAt} />
            {request.dueDate && <Field label="Date de fin prévue" value={formatDateFr(request.dueDate)} />}
            <Field label="Date de décision" value={formatDateTimeFr(request.decidedAt)} />
          </div>

          {request.origin !== 'coswin' && (
            <RequestAttachmentsBlock
              requestId={request.id}
              equipmentId={request.equipmentId}
              equipmentLabel={equipment ? `${equipment.code} — ${equipment.name}` : request.equipmentName}
              requestedBy={request.requestedBy}
              origin={request.origin}
              currentUserId={currentUserId}
              isManager={isManager}
            />
          )}

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
                 state === 'DI annulée' ? 'Aucun OT : la demande est annulée dans Coswin.' :
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
          <div className="px-6 py-4 border-t border-gray-200 space-y-3">
            {!rejecting && (
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="due-retained" className="text-[11px] font-semibold text-gray-500 uppercase">Date de fin retenue (échéance de l'OT) *</label>
                <input id="due-retained" type="date" value={chosenDue} onChange={e => setChosenDue(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" />
                <span className="text-xs text-gray-500">Proposée : {formatIsoFr(request.proposedDueDate ?? proposedDueDate(request.priority))}</span>
              </div>
            )}
            {rejecting && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase mb-1 block">Motif du rejet *</label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} autoFocus
                  placeholder="Ex : doublon de DI00001234, hors périmètre du contrat…"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              {!rejecting ? (
                <button onClick={() => setRejecting(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100">
                  <XCircle className="w-4 h-4" /><span>Rejeter</span>
                </button>
              ) : (
                <>
                  <button onClick={() => { setRejecting(false); setRejectReason(''); }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Annuler</button>
                  <button disabled={rejectReason.trim().length < 3} onClick={() => { onReject(request.id, rejectReason.trim()); onClose(); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    <XCircle className="w-4 h-4" /><span>Confirmer le rejet</span>
                  </button>
                </>
              )}
              {!rejecting && (
                <button disabled={!isValidIsoDate(chosenDue)} onClick={() => { onApprove(request.id, chosenDue); onClose(); }}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  <CheckCircle2 className="w-4 h-4" /><span>Approuver & Créer OT</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
