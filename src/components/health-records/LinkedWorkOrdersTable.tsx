import React from 'react';
import { ClipboardList } from 'lucide-react';
import type { WorkOrder } from '../../types';
import { getWorkOrderStatusBadgeClass, formatIsoDate } from '../../utils/equipmentDisplay';

interface LinkedWorkOrdersTableProps {
  linkedWorkOrders: WorkOrder[];
}

/** Registre chronologique d'entretien & dépannages : les OT réels liés à l'équipement. */
export const LinkedWorkOrdersTable: React.FC<LinkedWorkOrdersTableProps> = ({ linkedWorkOrders }) => {
  return (
    <>
            {/* Registre des interventions (réel) */}
            <div className="border border-gray-200 rounded-lg">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-bold text-gray-900">2. Registre chronologique d'entretien & dépannages ({linkedWorkOrders.length})</h3>
              </div>
              {linkedWorkOrders.length === 0 ? (
                <div className="p-4 text-xs text-gray-400">Aucune intervention enregistrée pour cet équipement.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium">OT</th>
                        <th className="text-left px-3 py-1.5 font-medium">Intitulé</th>
                        <th className="text-left px-3 py-1.5 font-medium">Échéance</th>
                        <th className="text-left px-3 py-1.5 font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {linkedWorkOrders.map(wo => (
                        <tr key={wo.id}>
                          <td className="px-3 py-1.5 font-medium text-gray-900">{wo.code}</td>
                          <td className="px-3 py-1.5 text-gray-700">{wo.title}</td>
                          <td className="px-3 py-1.5 text-gray-500">{formatIsoDate(wo.dueDate)}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded-full font-semibold ${getWorkOrderStatusBadgeClass(wo.status)}`}>{wo.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
    </>
  );
};
