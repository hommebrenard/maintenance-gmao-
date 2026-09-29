import React from 'react';
import { HeartPulse, Plus, Loader2 } from 'lucide-react';
import type { HealthRecordEntry } from '../../types';
import { formatIsoDate } from '../../utils/equipmentDisplay';

interface HealthTimelineProps {
  entries: HealthRecordEntry[];
  isLoadingEntries: boolean;
  loadError: string | null;
  isAdding: boolean;
  isSaving: boolean;
  newEventType: string;
  newDescription: string;
  descriptionError: boolean;
  descriptionInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleAdding: () => void;
  onSelectRas: () => void;
  onSelectAnomalie: () => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * Carnet de santé (table `carnets_sante`) : formulaire RAS/Anomalie et liste des
 * entrées. Présentationnel : l'état, le lien profond du QR et l'enregistrement
 * restent dans HealthRecordsView (Phase 4a, aucun changement de comportement).
 */
export const HealthTimeline: React.FC<HealthTimelineProps> = ({
  entries,
  isLoadingEntries,
  loadError,
  isAdding,
  isSaving,
  newEventType,
  newDescription,
  descriptionError,
  descriptionInputRef,
  onToggleAdding,
  onSelectRas,
  onSelectAnomalie,
  onDescriptionChange,
  onSubmit,
}) => {
  return (
    <>
            {/* Historique du carnet de santé (table `carnets_sante`, réelle) */}
            <div className="mt-4 border border-gray-200 rounded-lg">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-gray-900">Carnet de santé ({entries.length})</h3>
                </div>
                <button
                  onClick={onToggleAdding}
                  data-pdf-exclude="true"
                  className="print:hidden flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter une entrée
                </button>
              </div>

              {isAdding && (
                <form onSubmit={onSubmit} data-pdf-exclude="true" className="print:hidden p-3 border-b border-gray-100 bg-gray-50 space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={onSelectRas}
                        aria-pressed={newEventType !== 'Anomalie'}
                        className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-md border ${
                          newEventType === 'Anomalie'
                            ? 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-600'
                        }`}
                      >
                        ✓ RAS
                      </button>
                      <button
                        type="button"
                        onClick={onSelectAnomalie}
                        aria-pressed={newEventType === 'Anomalie'}
                        className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-md border ${
                          newEventType === 'Anomalie'
                            ? 'text-red-700 bg-red-50 border-red-600'
                            : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        ⚠ Anomalie
                      </button>
                    </div>
                    <div className="flex-1">
                      <input
                        ref={descriptionInputRef}
                        type="text"
                        placeholder={newEventType === 'Anomalie' ? 'Décrire l\u2019anomalie...' : 'Note (optionnel)...'}
                        value={newDescription}
                        onChange={e => onDescriptionChange(e.target.value)}
                        aria-invalid={descriptionError}
                        className={`w-full text-xs border rounded-md px-2 py-1.5 ${
                          descriptionError ? 'border-red-500 focus:outline-red-500' : 'border-gray-200'
                        }`}
                      />
                      {descriptionError && (
                        <p className="text-[11px] text-red-600 mt-1">Merci de décrire l'anomalie avant d'enregistrer.</p>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50 w-full sm:w-auto"
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
                        <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                          {entry.eventType === 'Anomalie' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
                          )}
                          {entry.eventType}
                        </span>
                        <span className="text-gray-400">{formatIsoDate(entry.eventDate)}</span>
                      </div>
                      {entry.description && <div className="text-gray-600 mt-0.5">{entry.description}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
    </>
  );
};
