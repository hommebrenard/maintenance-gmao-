import React, { useState } from 'react';
import { Inbox } from 'lucide-react';
import { DISPLAY_STATE_CLASS, requestAlert } from '../../utils/requestDisplay';
import { archivedSummary, type LinkedRequestRow } from '../../utils/equipmentRequests';

const PAGE_SIZE = 20;

/** Demandes d'intervention (DI) de l'équipement : lecture seule, complète le registre des OT. */
export const LinkedRequestsTable: React.FC<{
  rows: LinkedRequestRow[];
  /** DI closes des années précédentes : repliées (écran) ou résumées par année (PDF). */
  archived?: LinkedRequestRow[];
  archivedMode?: 'toggle' | 'summary';
  showAll?: boolean;
}> = ({ rows, archived = [], archivedMode = 'toggle', showAll = false }) => {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [showArchived, setShowArchived] = useState(false);
  const total = rows.length + archived.length;
  const list = archivedMode === 'toggle' && showArchived ? [...rows, ...archived] : rows;
  const shown = showAll ? list : list.slice(0, limit);
  const note = archived.length === 0
    ? null
    : archivedMode === 'summary'
      ? `${rows.length} DI détaillées (année en cours + non closes) · ${archived.length} DI closes des années précédentes résumées ci-dessous`
      : `${rows.length} DI détaillées (année en cours + non closes) · ${archived.length} DI closes des années précédentes ${showArchived ? 'affichées' : 'masquées'}`;
  return (
    <div data-pdf-block className="border border-gray-200 rounded-lg mt-4">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
        <Inbox className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-bold text-gray-900">Demandes d'intervention ({total})</h3>
      </div>
      {note && <p className="px-3 py-1 text-[10px] text-gray-500 border-b border-gray-100">{note}</p>}
      {total === 0 ? (
        <p className="px-3 py-4 text-sm text-gray-500">Aucune demande d'intervention pour cet équipement.</p>
      ) : list.length === 0 ? (
        <p className="px-3 py-3 text-xs text-gray-500">Aucune DI de l'année en cours ou non close.</p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full table-fixed text-xs">
            <colgroup>
              <col style={{ width: '15%' }} />
              <col style={{ width: '12%' }} />
              <col />
              <col style={{ width: '7%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
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
                  <td className="px-3 py-2 font-mono align-top whitespace-nowrap">{req.code ?? '—'}</td>
                  <td className="px-3 py-2 align-top text-gray-600">{(req.createdAt ?? '').replace(/(\d{2}:\d{2}):\d{2}$/, '$1')}</td>
                  <td className="px-3 py-2 align-top text-gray-800 whitespace-normal break-words">{req.title}</td>
                  <td className="px-3 py-2 align-top">{req.interventionType ?? '—'}</td>
                  <td className="px-3 py-2 align-top">
                    <span className={`inline-block whitespace-nowrap font-medium px-2 py-0.5 rounded-md ${DISPLAY_STATE_CLASS[state]}`}>{state}</span>
                    {requestAlert(req) && <span title={requestAlert(req) ?? ''} className="inline-block whitespace-nowrap mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">⚠ OT actif</span>}
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-gray-600 whitespace-nowrap">{req.otNumber ? `OT-${req.otNumber}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {archivedMode === 'summary' && archived.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-600 leading-snug">
          {archivedSummary(archived).map(({ year, codes }) => (
            <p key={year} className="mb-1 last:mb-0"><span className="font-semibold text-gray-800">{year} — {codes.length} DI :</span> <span className="font-mono">{codes.join(', ')}</span></p>
          ))}
        </div>
      )}
      {archivedMode === 'toggle' && archived.length > 0 && (
        <div data-pdf-exclude="true" className="px-3 py-2 border-t border-gray-100">
          <button type="button" onClick={() => setShowArchived(v => !v)} className="text-xs font-semibold text-blue-600 hover:underline">
            {showArchived ? 'Masquer' : 'Afficher'} les {archived.length} DI closes des années précédentes
          </button>
        </div>
      )}
      {!showAll && list.length > limit && (
        <div data-pdf-exclude="true" className="px-3 py-2 border-t border-gray-100">
          <button type="button" onClick={() => setLimit(l => l + PAGE_SIZE)} className="text-xs font-semibold text-blue-600 hover:underline">Voir plus ({list.length - limit})</button>
        </div>
      )}
    </div>
  );
};
