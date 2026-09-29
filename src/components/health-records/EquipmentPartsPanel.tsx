import React from 'react';
import { Package } from 'lucide-react';
import type { EquipmentPart } from '../../types';
import { formatPrice, formatQuantity, isLowStock } from '../../utils/healthRecordDisplay';
import type { ExtraState } from './useEquipmentExtras';
import { Dash, PanelState } from './PanelState';

/** Pièces de rechange rattachées à l'équipement (lecture seule ; indépendantes de l'inventaire général). */
export const EquipmentPartsPanel: React.FC<{ state: ExtraState<EquipmentPart> }> = ({ state }) => (
  <div>
    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
      <Package className="w-4 h-4 text-emerald-600" /> Pièces de rechange ({state.loading ? '…' : state.items.length})
    </h3>
    <PanelState state={state} emptyText="Aucune pièce rattachée à cet équipement.">
      <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Désignation</th>
              <th className="px-3 py-2 font-medium">Référence</th>
              <th className="px-3 py-2 font-medium">Fabricant</th>
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Seuil mini</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Prix unitaire</th>
              <th className="px-3 py-2 font-medium">Emplacement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {state.items.map(p => (
              <tr key={p.id}>
                <td className="px-3 py-1.5 text-gray-900">
                  {p.name}
                  {p.code && <div className="text-[10px] font-mono text-gray-400">{p.code}</div>}
                </td>
                <td className="px-3 py-1.5 text-gray-600">{p.reference ?? <Dash />}</td>
                <td className="px-3 py-1.5 text-gray-600">{p.manufacturer ?? <Dash />}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-gray-900">
                  {formatQuantity(p.stock)}{p.unit ? ` ${p.unit}` : ''}
                  {isLowStock(p) && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">Sous le seuil</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-gray-600">{p.minStock > 0 ? formatQuantity(p.minStock) : <Dash />}</td>
                <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{p.unitPrice !== undefined ? formatPrice(p.unitPrice) : <Dash />}</td>
                <td className="px-3 py-1.5 text-gray-600">{p.location ?? <Dash />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelState>
  </div>
);
