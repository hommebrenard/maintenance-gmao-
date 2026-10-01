import React, { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import type { WorkOrder } from '../../types';
import { getWorkOrderStatusBadgeClass, formatIsoDate } from '../../utils/equipmentDisplay';
import {
  DEFAULT_REGISTER_FILTERS, REGISTER_STATUSES, REGISTER_TYPES, filterRegister, isDefaultFilters, periodLabel, registerYears,
  type RegisterFilters,
} from '../../utils/workOrderRegister';

const PAGE_SIZE = 20;
const selectCls = 'px-2 py-1 text-xs border border-gray-300 rounded-md bg-white';

interface LinkedWorkOrdersTableProps {
  linkedWorkOrders: WorkOrder[];
  /** Aperçu du PDF : toutes les lignes filtrées (pas de pagination « Voir plus »). */
  showAll?: boolean;
}

/** Registre chronologique d'entretien & dépannages : les OT réels liés à l'équipement. */
export const LinkedWorkOrdersTable: React.FC<LinkedWorkOrdersTableProps> = ({ linkedWorkOrders, showAll = false }) => {
  const [filters, setFilters] = useState<RegisterFilters>(DEFAULT_REGISTER_FILTERS);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const years = useMemo(() => registerYears(linkedWorkOrders), [linkedWorkOrders]);
  const filtered = useMemo(() => filterRegister(linkedWorkOrders, filters), [linkedWorkOrders, filters]);
  const shown = showAll ? filtered : filtered.slice(0, limit);
  const change = (patch: Partial<RegisterFilters>) => { setFilters(f => ({ ...f, ...patch })); setLimit(PAGE_SIZE); };
  const filtersActive = !isDefaultFilters(filters);
  const total = linkedWorkOrders.length;
  const countLabel = filtered.length === total ? `${total}` : `${filtered.length} sur ${total}`;
  return (
    <>
            {/* Registre des interventions (réel) */}
            <div data-pdf-block className="border border-gray-200 rounded-lg">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-bold text-gray-900">2. Registre chronologique d'entretien & dépannages ({countLabel})</h3>
              </div>
              {total > 0 && (
                <div data-pdf-exclude="true" className="print:hidden px-3 py-2 border-b border-gray-100 flex flex-wrap items-center gap-2">
                  <select aria-label="Période" value={filters.period} onChange={e => change({ period: e.target.value })} className={selectCls}>
                    <option value="recent">{periodLabel('recent')}</option>
                    <option value="all">Toutes les années</option>
                    {years.map(y => <option key={y} value={y}>Année {y}</option>)}
                  </select>
                  <select aria-label="Statut" value={filters.status} onChange={e => change({ status: e.target.value as RegisterFilters['status'] })} className={selectCls}>
                    <option value="all">Tous les statuts</option>
                    {REGISTER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select aria-label="Type" value={filters.type} onChange={e => change({ type: e.target.value as RegisterFilters['type'] })} className={selectCls}>
                    <option value="all">Tous les types</option>
                    {REGISTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    type="search" aria-label="Rechercher un OT" placeholder="N° d'OT ou intitulé…" value={filters.query}
                    onChange={e => change({ query: e.target.value })}
                    className="flex-1 min-w-[8rem] px-2 py-1 text-xs border border-gray-300 rounded-md"
                  />
                  {filtersActive && (
                    <button type="button" onClick={() => change(DEFAULT_REGISTER_FILTERS)} className="text-xs font-semibold text-blue-600 hover:underline">Réinitialiser</button>
                  )}
                </div>
              )}
              {total > 0 && (
                <p className="px-3 py-1 text-[10px] text-gray-500 border-b border-gray-100">
                  Affichage : {periodLabel(filters.period)}
                  {filters.status !== 'all' ? ` · ${filters.status}` : ''}
                  {filters.type !== 'all' ? ` · ${filters.type}` : ''}
                  {filters.query.trim() ? ` · « ${filters.query.trim()} »` : ''}
                  {' '}— {filtered.length} sur {total} OT
                </p>
              )}
              {linkedWorkOrders.length === 0 ? (
                <div className="p-4 text-xs text-gray-400">Aucune intervention enregistrée pour cet équipement.</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-xs text-gray-500">Aucun OT ne correspond à ces filtres. Choisissez « Toutes les années » ou cliquez sur « Réinitialiser ».</div>
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
                      {shown.map(wo => (
                        <tr key={wo.id} data-pdf-block>
                          <td className="px-3 py-1.5 font-medium text-gray-900 whitespace-nowrap">{wo.code}</td>
                          <td className="px-3 py-1.5 text-gray-700">{wo.title}</td>
                          <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{formatIsoDate(wo.dueDate)}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded-full font-semibold ${getWorkOrderStatusBadgeClass(wo.status)}`}>{wo.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!showAll && filtered.length > shown.length && (
                    <div data-pdf-exclude="true" className="print:hidden p-2 text-center border-t border-gray-100">
                      <button type="button" onClick={() => setLimit(l => l + PAGE_SIZE)} className="text-xs font-semibold text-blue-600 hover:underline">
                        Voir plus ({filtered.length - shown.length} restants)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
    </>
  );
};
