import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { MaintenanceSchedule, MaintenanceFrequencyType } from '../../types';
import type { MaintenanceScheduleInput } from '../../lib/queries/maintenanceSchedules';
import { addMonthsToIsoDate, isValidIsoDate, minutesToHHMM, parseDurationHHMM } from '../../utils/maintenanceSchedule';
import { hasControlDetails } from '../../utils/healthRecordDisplay';
import { formatIsoDate } from '../../utils/equipmentDisplay';

interface Props {
  /** Échéance à modifier ; absente = création. */
  schedule?: MaintenanceSchedule;
  saving: boolean;
  error: string | null;
  onSubmit: (input: MaintenanceScheduleInput) => void;
  onCancel: () => void;
}

type FreqChoice = 'none' | MaintenanceFrequencyType;

/** Prochaine échéance proposée = dernière réalisation + N mois (périodicité calendaire uniquement). */
function suggest(last: string, freq: FreqChoice, months: string): string | undefined {
  if (freq !== 'calendar') return undefined;
  return addMonthsToIsoDate(last, Number(months));
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
const labelCls = 'block text-xs font-semibold text-gray-700 mb-1';

/** Formulaire (fenêtre) d'ajout / modification d'une échéance de maintenance — managers uniquement. */
export const MaintenanceScheduleForm: React.FC<Props> = ({ schedule, saving, error, onSubmit, onCancel }) => {
  const [title, setTitle] = useState(schedule?.title ?? '');
  const [legal, setLegal] = useState(schedule?.legalRequirement ?? false);
  const [freq, setFreq] = useState<FreqChoice>(schedule?.frequencyType ?? 'none');
  const [months, setMonths] = useState(schedule?.intervalMonths ? String(schedule.intervalMonths) : '');
  const [hours, setHours] = useState(schedule?.intervalHours ? String(schedule.intervalHours) : '');
  const [label, setLabel] = useState(schedule?.frequencyLabel ?? '');
  const [last, setLast] = useState(schedule?.lastDoneDate?.slice(0, 10) ?? '');
  const [next, setNext] = useState(schedule?.nextDueDate?.slice(0, 10) ?? '');
  // true dès que l'utilisateur tape lui-même la prochaine échéance : on ne l'écrase plus.
  const [nextEdited, setNextEdited] = useState(false);
  const [nextIsSuggested, setNextIsSuggested] = useState(false);
  const [inspectionBody, setInspectionBody] = useState(schedule?.inspectionBody ?? '');
  const [duration, setDuration] = useState(schedule?.estimatedDurationMinutes ? minutesToHHMM(schedule.estimatedDurationMinutes) : '');
  const [controlPoints, setControlPoints] = useState(schedule?.controlPoints ?? '');
  const [safety, setSafety] = useState(schedule?.safetyInstructions ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  // Détails du contrôle : visibles pour un contrôle réglementaire, ou dès qu'une valeur existe déjà (jamais perdue en silence).
  const showDetails = legal || (schedule ? hasControlDetails(schedule) : false);

  const applySuggestion = (l: string, f: FreqChoice, m: string) => {
    if (nextEdited) return;
    const s = suggest(l, f, m);
    if (s) {
      setNext(s);
      setNextIsSuggested(true);
    }
  };

  const suggestion = suggest(last, freq, months);
  const canReapply = nextEdited && suggestion && suggestion !== next;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setLocalError("L'intitulé est obligatoire.");
    if (last && !isValidIsoDate(last)) return setLocalError('Dernière réalisation : date invalide.');
    if (next && !isValidIsoDate(next)) return setLocalError('Prochaine échéance : date invalide.');
    if (last && next && next < last) return setLocalError('La prochaine échéance ne peut pas précéder la dernière réalisation.');
    let intervalMonths: number | null = null;
    let intervalHours: number | null = null;
    if (freq === 'calendar') {
      intervalMonths = Number(months);
      if (!Number.isInteger(intervalMonths) || intervalMonths < 1 || intervalMonths > 240) {
        return setLocalError('Périodicité : indiquez un nombre entier de mois entre 1 et 240.');
      }
    } else if (freq === 'hours') {
      intervalHours = Number(hours);
      if (!Number.isInteger(intervalHours) || intervalHours < 1) {
        return setLocalError("Périodicité : indiquez un nombre entier d'heures supérieur à 0.");
      }
    }
    let estimatedDurationMinutes: number | null = null;
    if (duration.trim()) {
      const parsed = parseDurationHHMM(duration);
      if (parsed === undefined) return setLocalError('Durée estimée : format HH:MM attendu, supérieur à 00:00 (ex. 03:00).');
      estimatedDurationMinutes = parsed;
    }
    setLocalError(null);
    onSubmit({
      title: title.trim(),
      legalRequirement: legal,
      frequencyLabel: label.trim() || null,
      frequencyType: freq === 'none' ? null : freq,
      intervalMonths,
      intervalHours,
      lastDoneDate: last || null,
      nextDueDate: next || null,
      inspectionBody: inspectionBody.trim() || null,
      controlPoints: controlPoints.trim() || null,
      safetyInstructions: safety.trim() || null,
      estimatedDurationMinutes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-gray-900">{schedule ? "Modifier l'échéance" : 'Ajouter une échéance'}</h3>
          <button type="button" onClick={onCancel} aria-label="Fermer" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Intitulé *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. Contrôle périodique ascenseur" className={inputCls} />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={legal} onChange={e => setLegal(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
            Contrôle réglementaire
          </label>

          <div>
            <label className={labelCls}>Périodicité</label>
            <div className="flex gap-2">
              <select
                value={freq}
                onChange={e => {
                  const f = e.target.value as FreqChoice;
                  setFreq(f);
                  applySuggestion(last, f, months);
                }}
                className={inputCls}
              >
                <option value="none">Non définie</option>
                <option value="calendar">Tous les N mois</option>
                <option value="hours">Toutes les N heures</option>
              </select>
              {freq === 'calendar' && (
                <input
                  type="number" min={1} max={240} step={1} inputMode="numeric" value={months} placeholder="Mois"
                  onChange={e => { setMonths(e.target.value); applySuggestion(last, freq, e.target.value); }}
                  className={`${inputCls} w-28`}
                />
              )}
              {freq === 'hours' && (
                <input
                  type="number" min={1} step={1} inputMode="numeric" value={hours} placeholder="Heures"
                  onChange={e => setHours(e.target.value)}
                  className={`${inputCls} w-28`}
                />
              )}
            </div>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Libellé affiché (facultatif), ex. Annuelle" className={`${inputCls} mt-2`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Dernière réalisation</label>
              <input
                type="date" value={last}
                onChange={e => { setLast(e.target.value); applySuggestion(e.target.value, freq, months); }}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Prochaine échéance</label>
              <input
                type="date" value={next}
                onChange={e => { setNext(e.target.value); setNextEdited(true); setNextIsSuggested(false); }}
                className={inputCls}
              />
            </div>
          </div>
          {nextIsSuggested && !nextEdited && (
            <p className="text-[11px] text-emerald-700 -mt-2">Proposée : dernière réalisation + {months} mois. Vous pouvez la corriger.</p>
          )}
          {canReapply && (
            <button type="button" onClick={() => { setNext(suggestion!); setNextEdited(false); setNextIsSuggested(true); }} className="text-[11px] font-semibold text-emerald-700 hover:underline -mt-2">
              Utiliser la date proposée ({formatIsoDate(suggestion)})
            </button>
          )}

          {showDetails && (
            <div className="space-y-3 border border-gray-200 rounded-lg p-3 bg-gray-50">
              <p className="text-xs font-bold text-gray-700">Détails du contrôle (facultatif)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Organisme de contrôle / prestataire</label>
                  <input type="text" value={inspectionBody} onChange={e => setInspectionBody(e.target.value)} placeholder="Ex. APAVE" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Durée estimée (HH:MM)</label>
                  <input type="text" inputMode="numeric" value={duration} onChange={e => setDuration(e.target.value)} placeholder="Ex. 03:00" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Points de contrôle (un par ligne)</label>
                <textarea rows={4} value={controlPoints} onChange={e => setControlPoints(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Consignes de sécurité / habilitations</label>
                <textarea rows={3} value={safety} onChange={e => setSafety(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          {(localError || error) && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{localError ?? error}</div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg disabled:opacity-50">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {saving ? 'Enregistrement…' : schedule ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
