import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { ControlResult, MaintenanceSchedule, ScheduleControl } from '../../types';
import { addMonthsToIsoDate, isValidIsoDate } from '../../utils/maintenanceSchedule';
import { CONTROL_RESULTS, controlResultLabel, isHttpUrl } from '../../utils/scheduleControls';
import { formatIsoDate } from '../../utils/equipmentDisplay';

export interface ScheduleControlFormValues {
  performedOn: string;
  inspectionBody: string | null;
  result: ControlResult | null;
  notes: string | null;
  /** Lien GED du compte rendu (http/https) et son intitulé, si renseignés. */
  docUrl: string | null;
  docName: string | null;
  /** Création uniquement : mettre à jour la dernière réalisation / prochaine échéance de l'échéance. */
  updateSchedule: boolean;
  nextDueDate: string | null;
}

interface Props {
  schedule: MaintenanceSchedule;
  /** Contrôle à corriger ; absent = enregistrement d'un nouveau contrôle réalisé. */
  control?: ScheduleControl;
  saving: boolean;
  error: string | null;
  onSubmit: (values: ScheduleControlFormValues) => void;
  onCancel: () => void;
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
const labelCls = 'block text-xs font-semibold text-gray-700 mb-1';

/** Formulaire « Contrôle réalisé » (création) ou « Modifier le contrôle » — managers uniquement. */
export const ScheduleControlForm: React.FC<Props> = ({ schedule, control, saving, error, onSubmit, onCancel }) => {
  const isEdit = !!control;
  const [performedOn, setPerformedOn] = useState(control?.performedOn?.slice(0, 10) ?? '');
  const [body, setBody] = useState(control?.inspectionBody ?? schedule.inspectionBody ?? '');
  const [result, setResult] = useState<ControlResult | ''>(control?.result ?? '');
  const [notes, setNotes] = useState(control?.notes ?? '');
  const [docUrl, setDocUrl] = useState('');
  const [docName, setDocName] = useState('');
  const [next, setNext] = useState(schedule.nextDueDate?.slice(0, 10) ?? '');
  const [nextEdited, setNextEdited] = useState(false);
  const [nextIsSuggested, setNextIsSuggested] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const months = schedule.frequencyType === 'calendar' ? schedule.intervalMonths : undefined;
  const lastDone = schedule.lastDoneDate?.slice(0, 10);
  // Un contrôle plus ancien que la dernière réalisation est de l'historique : il ne modifie pas l'échéance.
  const isLatest = isValidIsoDate(performedOn) && (!lastDone || performedOn >= lastDone);
  const updateSchedule = !isEdit && isLatest;

  const applySuggestion = (date: string) => {
    if (nextEdited || !months) return;
    const s = addMonthsToIsoDate(date, months);
    if (s) {
      setNext(s);
      setNextIsSuggested(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidIsoDate(performedOn)) return setLocalError('Date du contrôle : obligatoire.');
    if (docUrl.trim() && !isHttpUrl(docUrl)) return setLocalError('Lien du compte rendu : adresse http:// ou https:// attendue.');
    if (updateSchedule && next) {
      if (!isValidIsoDate(next)) return setLocalError('Prochaine échéance : date invalide.');
      if (next < performedOn) return setLocalError('La prochaine échéance ne peut pas précéder la date du contrôle.');
    }
    setLocalError(null);
    onSubmit({
      performedOn,
      inspectionBody: body.trim() || null,
      result: result || null,
      notes: notes.trim() || null,
      docUrl: docUrl.trim() || null,
      docName: docName.trim() || null,
      updateSchedule,
      nextDueDate: updateSchedule ? next || null : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">{isEdit ? 'Modifier le contrôle' : 'Enregistrer un contrôle réalisé'}</h3>
            <p className="text-xs text-gray-500">{schedule.title}</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Fermer" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date du contrôle *</label>
              <input
                type="date" value={performedOn}
                onChange={e => { setPerformedOn(e.target.value); applySuggestion(e.target.value); }}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Verdict du contrôleur</label>
              <select value={result} onChange={e => setResult(e.target.value as ControlResult | '')} className={inputCls}>
                <option value="">Non renseigné</option>
                {CONTROL_RESULTS.map(r => <option key={r} value={r}>{controlResultLabel(r)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Organisme de contrôle / prestataire</label>
            <input type="text" value={body} onChange={e => setBody(e.target.value)} placeholder="Ex. APAVE" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Observations</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Réserves, anomalies relevées, délai de levée…" className={inputCls} />
          </div>

          <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
            <p className="text-xs font-bold text-gray-700">Compte rendu du contrôleur (lien GED, facultatif)</p>
            <input type="text" inputMode="url" value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://…" className={inputCls} />
            <input type="text" value={docName} onChange={e => setDocName(e.target.value)} placeholder="Intitulé du document (facultatif)" className={inputCls} />
            <p className="text-[11px] text-gray-500">Le dépôt d'un fichier PDF arrivera avec l'étape suivante.</p>
          </div>

          {!isEdit && (
            isLatest ? (
              <div>
                <label className={labelCls}>Prochaine échéance (mise à jour de l'échéance)</label>
                <input
                  type="date" value={next}
                  onChange={e => { setNext(e.target.value); setNextEdited(true); setNextIsSuggested(false); }}
                  className={inputCls}
                />
                {nextIsSuggested && !nextEdited && (
                  <p className="text-[11px] text-emerald-700 mt-1">Proposée : date du contrôle + {months} mois. Vous pouvez la corriger.</p>
                )}
                {!months && (
                  <p className="text-[11px] text-gray-500 mt-1">Périodicité non calendaire : indiquez la prochaine échéance si elle est connue.</p>
                )}
                <p className="text-[11px] text-gray-500 mt-1">La dernière réalisation de l'échéance passera au {performedOn ? formatIsoDate(performedOn) : 'jour du contrôle'}.</p>
              </div>
            ) : isValidIsoDate(performedOn) ? (
              <p className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-2">
                Ce contrôle est antérieur à la dernière réalisation : il est ajouté à l'historique, l'échéance n'est pas modifiée.
              </p>
            ) : null
          )}
          {isEdit && (
            <p className="text-[11px] text-gray-500">La dernière réalisation et la prochaine échéance ne sont pas modifiées ici (utilisez « Modifier » sur l'échéance).</p>
          )}

          {(localError || error) && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{localError ?? error}</div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg disabled:opacity-50">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Enregistrer le contrôle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
