import React from 'react';

export type HealthRecordTab = 'synthese' | 'interventions' | 'planification' | 'pieces' | 'documents' | 'passeport';

const TABS: { id: HealthRecordTab; label: string }[] = [
  { id: 'synthese', label: 'Synthèse' },
  { id: 'interventions', label: 'Interventions' },
  { id: 'planification', label: 'Planification' },
  { id: 'pieces', label: 'Pièces' },
  { id: 'documents', label: 'Documents' },
  { id: 'passeport', label: 'Passeport PDF' },
];

interface Props {
  active: HealthRecordTab;
  onChange: (tab: HealthRecordTab) => void;
  /** Compteurs affichés à côté du libellé ; undefined = inconnu (chargement) : pas de pastille. */
  counts?: Partial<Record<HealthRecordTab, number | undefined>>;
}

/** Barre d'onglets de la fiche ; défilement horizontal sur téléphone. */
export const HealthRecordTabs: React.FC<Props> = ({ active, onChange, counts = {} }) => (
  <div
    role="tablist"
    aria-label="Sections du carnet de santé"
    data-pdf-exclude="true"
    className="print:hidden flex gap-1 overflow-x-auto border-b border-gray-200 mb-4"
  >
    {TABS.map(tab => {
      const isActive = tab.id === active;
      const count = counts[tab.id];
      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(tab.id)}
          className={`shrink-0 whitespace-nowrap px-3 py-2 text-xs border-b-2 -mb-px transition-colors ${
            isActive
              ? 'border-emerald-600 text-emerald-700 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
          }`}
        >
          {tab.label}
          {count !== undefined && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);
