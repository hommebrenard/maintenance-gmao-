import React from 'react';
import { FileText } from 'lucide-react';
import type { EquipmentDocument } from '../../types';
import { formatIsoDate } from '../../utils/equipmentDisplay';
import { documentCategoryLabel, formatFileSize } from '../../utils/healthRecordDisplay';
import type { ExtraState } from './useEquipmentExtras';
import { Dash, PanelState } from './PanelState';

/** Documents rattachés à l'équipement (lecture seule ; l'ajout et le téléchargement viennent avec le stockage de fichiers). */
export const EquipmentDocumentsPanel: React.FC<{ state: ExtraState<EquipmentDocument> }> = ({ state }) => (
  <div>
    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
      <FileText className="w-4 h-4 text-emerald-600" /> Documents ({state.loading ? '…' : state.items.length})
    </h3>
    <PanelState state={state} emptyText="Aucun document rattaché à cet équipement.">
      <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Nom</th>
              <th className="px-3 py-2 font-medium">Catégorie</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Ajouté le</th>
              <th className="px-3 py-2 font-medium">Taille</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {state.items.map(d => (
              <tr key={d.id}>
                <td className="px-3 py-1.5 text-gray-900">{d.name}</td>
                <td className="px-3 py-1.5 text-gray-600">{documentCategoryLabel(d.category)}</td>
                <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{formatIsoDate(d.createdAt)}</td>
                <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{formatFileSize(d.sizeBytes) ?? <Dash />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelState>
  </div>
);
