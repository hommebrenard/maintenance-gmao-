import React from 'react';
import { CalendarClock } from 'lucide-react';
import type { MaintenanceSchedule } from '../../types';
import { formatIsoDate } from '../../utils/equipmentDisplay';
import { scheduleFrequencyLabel, scheduleStatusBadgeClass, scheduleStatusLabel } from '../../utils/healthRecordDisplay';
import type { ExtraState } from './useEquipmentExtras';
import { Dash, PanelState } from './PanelState';

/** Échéances de maintenance de l'équipement (lecture seule). */
export const MaintenanceSchedulePanel: React.FC<{ state: ExtraState<MaintenanceSchedule> }> = ({ state }) => (
  <div>
    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
      <CalendarClock className="w-4 h-4 text-emerald-600" /> Planification ({state.loading ? '…' : state.items.length})
    </h3>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {state.items.map(s => (
              <tr key={s.id}>
                <td className="px-3 py-1.5 text-gray-900">
                  {s.title}
                  {s.legalRequirement && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-semibold">Réglementaire</span>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelState>
  </div>
);
