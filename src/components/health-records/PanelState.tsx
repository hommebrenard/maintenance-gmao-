import React from 'react';
import type { ExtraState } from './useEquipmentExtras';

/** Enveloppe commune des panneaux en lecture : chargement, erreur, liste vide, sinon le contenu. */
export function PanelState<T>({ state, emptyText, children }: { state: ExtraState<T>; emptyText: string; children: React.ReactNode }) {
  if (state.loading) return <div className="border border-gray-200 rounded-lg bg-white p-4 text-xs text-gray-400">Chargement...</div>;
  if (state.error) {
    return <div className="border border-red-200 rounded-lg bg-red-50 p-4 text-xs text-red-700">Impossible de charger ces données : {state.error}</div>;
  }
  if (state.items.length === 0) return <div className="border border-gray-200 rounded-lg bg-white p-4 text-xs text-gray-400">{emptyText}</div>;
  return <>{children}</>;
}

export const Dash: React.FC = () => <span className="text-gray-300" title="Non renseigné">—</span>;
