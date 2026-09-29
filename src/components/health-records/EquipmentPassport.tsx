import React from 'react';
import { QrCode, Image as ImageIcon } from 'lucide-react';
import type { Equipment, WorkOrder } from '../../types';
import { getOperationalStatusBadgeClass, formatIsoDate } from '../../utils/equipmentDisplay';
import { NotSet } from './NotSet';

interface EquipmentPassportProps {
  selected: Equipment;
  qrDataUrl: string | null;
  lastCompletedWorkOrder: WorkOrder | null;
}

/**
 * Passeport machine : bandeau d'identité (code, nom, statut, QR), synthèse de
 * santé & conformité, photo et tableau d'identité. Extrait tel quel de
 * HealthRecordsView (Phase 4a, 29/09/2026) — aucun changement de rendu.
 */
export const EquipmentPassport: React.FC<EquipmentPassportProps> = ({ selected, qrDataUrl, lastCompletedWorkOrder }) => {
  return (
    <>
              {/* En-tête fiche d'identité, façon passeport machine */}
              <div data-pdf-block className="border-2 border-gray-800 rounded-lg p-4 bg-gray-50 flex flex-col @lg:flex-row @lg:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-gray-800 text-white font-mono px-2 py-0.5 rounded text-xs font-bold">{selected.code}</span>
                    <h1 className="text-base font-bold text-gray-900">{selected.name}</h1>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getOperationalStatusBadgeClass(selected.status)}`}>
                      {selected.status}
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs mt-1">
                    {selected.manufacturer || <NotSet />}
                    {selected.model ? ` — ${selected.model}` : ''}
                  </p>
                  <p className="text-gray-500 text-[11px] font-mono mt-0.5">
                    N° série : {selected.serialNumber || 'Non renseigné'} | Emplacement : {selected.location || 'Non renseigné'}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <div className="w-28 h-28 bg-white border border-gray-300 rounded flex flex-col items-center justify-center p-1 text-center">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt={`QR code ${selected.code}`} className="w-full h-full object-contain" />
                    ) : (
                      <QrCode className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div className="text-right">
                    <span className="block text-gray-400 text-[10px]">Date d'émission :</span>
                    <span className="font-semibold text-gray-800 text-xs">
                      {new Date().toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 1 : Synthèse de santé & Conformité réglementaire.
                  1-1 et 1-2 n'ont aucune donnée réelle derrière aujourd'hui
                  (pas de formule de fiabilité, pas de suivi réglementaire en
                  base) : affichées honnêtement "Non renseigné", à reprendre
                  dans une prochaine étape plutôt que d'inventer un chiffre. */}
              <div data-pdf-block className="mb-4">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-1 mb-2.5">
                  1. Synthèse de santé & Conformité réglementaire
                </h3>
                <div className="grid grid-cols-1 @xl:grid-cols-3 gap-3">
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <span className="text-[10px] font-semibold text-gray-500 block">Indice de Fiabilité Globale</span>
                    <span className="text-sm font-bold text-gray-400">Non renseigné</span>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <span className="text-[10px] font-semibold text-gray-500 block">Contrôle réglementaire</span>
                    <span className="text-sm font-bold text-gray-400">Non renseigné</span>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <span className="text-[10px] font-semibold text-gray-500 block">Dernière intervention de maintenance</span>
                    {lastCompletedWorkOrder ? (
                      <>
                        <span className="text-sm font-bold text-gray-800">
                          {formatIsoDate(lastCompletedWorkOrder.endDate || lastCompletedWorkOrder.updatedAt)}
                        </span>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Effectué par : {lastCompletedWorkOrder.assignee || 'Non renseigné'}
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-bold text-gray-400">Non renseigné</span>
                        <p className="text-[10px] text-gray-500 mt-0.5">Effectué par : Non renseigné</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

            <div data-pdf-block className="grid grid-cols-1 @xl:grid-cols-3 gap-4 mb-4">
              {/* Photo */}
              <div className="@xl:col-span-1 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center h-40">
                {selected.photoUrl ? (
                  <img src={selected.photoUrl} alt={selected.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-gray-300 flex flex-col items-center gap-1">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-[11px]">Aucune photo</span>
                  </div>
                )}
              </div>

              {/* Identité */}
              <div className="@xl:col-span-2 border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm">
                {[
                  ['Catégorie', selected.category],
                  ['Constructeur', selected.manufacturer],
                  ['Modèle', selected.model],
                  ['N° de série', selected.serialNumber],
                  ['Emplacement', selected.location],
                  ['Notes', selected.notes],
                ].map(([label, value]) => (
                  <div key={label} className="flex px-3 py-1.5">
                    <span className="w-32 shrink-0 text-gray-500">{label} :</span>
                    <span className="text-gray-900">{value ? value : <NotSet />}</span>
                  </div>
                ))}
                <div className="flex px-3 py-1.5 items-center">
                  <span className="w-32 shrink-0 text-gray-500 flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5" /> QR code :
                  </span>
                  <span className="text-gray-900">
                    {selected.qrCode || selected.code}
                    {!selected.qrCode && <span className="text-gray-400 text-xs ml-1">(= code équipement)</span>}
                  </span>
                </div>
              </div>
            </div>
    </>
  );
};
