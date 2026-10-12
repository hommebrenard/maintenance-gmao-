import React, { useState } from 'react';
import { Inbox } from 'lucide-react';
import { DISPLAY_STATE_CLASS, requestAlert } from '../../utils/requestDisplay';
import type { LinkedRequestRow } from '../../utils/equipmentRequests';

const PAGE_SIZE = 20;

/** Demandes d'intervention (DI) de l'équipement : lecture seule, complète le registre des OT. */
export const LinkedRequestsTable: React.FC<{ rows: LinkedRequestRow[] }> = ({ rows }) => {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const shown = rows.slice(0, limit);
  return (
    <div data-pdf-block className="border border-gray-200 rounded-lg mt-4">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
        <Inbox className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-bold text-gray-900">Demandes d'intervention ({rows.length})</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-sm text-gray-500">Aucune demande d'intervention pour cet équipement.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">N° DI</th>
                <th className="px-3 py-2 text-left font-semibold">Déclarée le</th>
                <th className="px-3 py-2 text-left font-semibold">Description</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">État</th>
                <th className="px-3 py-2 text-left font-semibold">N° OT</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ req, state }) => (
                <tr key={req.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{req.code ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{req.createdAt}</td>
                  <td className="px-3 py-2 text-gray-800 max-w-[22rem] truncate" title={req.title}>{req.title}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{req.interventionType ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`font-medium px-2 py-0.5 rounded-md ${DISPLAY_STATE_CLASS[state]}`}>{state}</span>
                    {requestAlert(req) && <span title={requestAlert(req) ?? ''} className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">⚠ OT actif</span>}
                  </td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap text-gray-600">{req.otNumber ? `OT-${req.otNumber}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > limit && (
        <div data-pdf-exclude="true" className="px-3 py-2 border-t border-gray-100">
          <button type="button" onClick={() => setLimit(l => l + PAGE_SIZE)} className="text-xs font-semibold text-blue-600 hover:underline">Voir plus ({rows.length - limit})</button>
        </div>
      )}
    </div>
  );
};
