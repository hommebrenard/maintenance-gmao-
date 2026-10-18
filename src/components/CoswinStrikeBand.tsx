import React from 'react';
import type { WorkOrder } from '../types';

export const COSWIN_STRIKE_LABEL = 'CLÔTURE COSWIN — NON RÉGULARISÉE';

/** Vrai tant qu'un OT clôturé via Coswin n'a pas été régularisé (checklist + visa). */
export const isCoswinUnregularized = (o: Pick<WorkOrder, 'closureSource' | 'closureRegularizedAt'>): boolean =>
  o.closureSource === 'coswin' && !o.closureRegularizedAt;

/** Bandeau pleine largeur, posé sur le bord haut d'une carte ou d'une fiche (comme une carte grise barrée). */
export const CoswinStrikeBand: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    role="note"
    className={`bg-indigo-600 text-white text-[10px] font-extrabold tracking-wider text-center py-1 px-2 select-none ${className}`}
  >
    {COSWIN_STRIKE_LABEL}
  </div>
);

/** Version compacte pour les lignes de tableaux et de listes. */
export const CoswinStrikePill: React.FC<{ order: Pick<WorkOrder, 'closureSource' | 'closureRegularizedAt'> }> = ({ order }) =>
  isCoswinUnregularized(order) ? (
    <span className="inline-block bg-indigo-600 text-white text-[9px] font-extrabold tracking-wide rounded px-1.5 py-0.5 whitespace-nowrap">
      {COSWIN_STRIKE_LABEL}
    </span>
  ) : null;
