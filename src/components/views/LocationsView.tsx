import React, { useState } from 'react';
import { MapPin, Plus, Search, Building2, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { LocationItem, WorkOrder } from '../../types';

interface LocationsViewProps {
  locations: LocationItem[];
  // Utilisé uniquement pour calculer le badge "Chargé / Pas encore chargé"
  // (13/09/2026) : compte les OT déjà présents pour chaque site, en
  // comparant au nom du site ET à son code Zone (les OT non encore
  // rattachés via location_id n'ont que le code Zone brut du CSV).
  workOrders?: WorkOrder[];
  onAddLocation: (loc: Omit<LocationItem, 'id'>) => void;
  onDeleteLocation?: (id: string) => void;
  onClearAllLocations?: () => void;
}

export const LocationsView: React.FC<LocationsViewProps> = ({
  locations,
  workOrders = [],
  onAddLocation,
  onDeleteLocation,
  onClearAllLocations
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  // Ajouté le 15/09/2026, suite à l'incident du même jour (suppression
  // accidentelle des 4 emplacements en un clic, sans aucune sauvegarde
  // possible ensuite) : la modale exige désormais de taper un mot de
  // confirmation avant d'activer le bouton de suppression.
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
  const DELETE_ALL_CONFIRM_WORD = 'SUPPRIMER';
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [parentLocation, setParentLocation] = useState('');

  const filtered = locations.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.parentLocation || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

    const MONTH_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const formatMonthLabel = (ym: string) => {
    const [year, monthStr] = ym.split('-');
    const monthIdx = parseInt(monthStr, 10) - 1;
    return `${MONTH_NAMES[monthIdx] || monthStr} ${year}`;
  };

  // Détail par mois des OT déjà chargés pour ce site (13/09/2026) — même
  // logique que le filtre "Tous les mois" de la vue Ordres de travail
  // (regroupement sur `dueDate.slice(0,7)`), pour savoir précisément quels
  // mois sont couverts et lesquels manquent encore, pas juste un total.
  const monthBreakdown = (loc: LocationItem): { ym: string; label: string; count: number }[] => {
    const matching = workOrders.filter(w => w.location === loc.name || (loc.code && w.entity === loc.code));
    const counts = new Map<string, number>();
    matching.forEach(w => {
      const ym = w.dueDate && w.dueDate.length >= 7 ? w.dueDate.slice(0, 7) : null;
      const key = ym || 'Sans date';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, count]) => ({ ym, label: ym === 'Sans date' ? 'Sans date' : formatMonthLabel(ym), count }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddLocation({
      name,
      code: code.trim() || undefined,
      parentLocation: parentLocation || 'Site Principal',
      type: 'Site',
      equipmentCount: 0
    });

    setName('');
    setCode('');
    setParentLocation('');
    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Emplacements / Sites</h1>
            <p className="text-sm text-gray-500 mt-1">
              Liste maîtresse des sites ({locations.length}) — gérez les usines, bâtiments, sites et zones.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {locations.length > 0 && onClearAllLocations && (
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors shadow-2xs"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Supprimer tous les sites</span>
              </button>
            )}

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvel emplacement</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-5 max-w-sm">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher des emplacements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 bg-gray-50/30">
        {filtered.length === 0 ? (
          /* Empty state */
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center bg-white my-6 max-w-4xl mx-auto shadow-2xs">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4 text-blue-500">
              <MapPin className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Aucun emplacement / site enregistré</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Créez vos propres usines, bâtiments, zones et sites pour organiser vos OT et équipements.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Créer mon premier site</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {filtered.map(loc => {
              const months = monthBreakdown(loc);
              const total = months.reduce((sum, m) => sum + m.count, 0);
              const isLoaded = total > 0;
              return (
                <div key={loc.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs space-y-3 relative group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-base">{loc.name}</h3>
                        <p className="text-xs text-gray-500">
                          {loc.code ? <span className="font-mono">{loc.code}</span> : 'Aucun code Zone'}
                        </p>
                      </div>
                    </div>

                    {onDeleteLocation && (
                      <button
                        type="button"
                        onClick={() => onDeleteLocation(loc.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Supprimer ce site"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t text-xs">
                    {isLoaded ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Chargé ({total} OT)</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pl-5">
                          {months.map(m => (
                            <span
                              key={m.ym}
                              className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium"
                              title={`${m.count} OT`}
                            >
                              {m.label} ({m.count})
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-gray-400 font-medium">
                        <Circle className="w-3.5 h-3.5" />
                        <span>Pas encore chargé</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clear All Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-rose-100">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Supprimer tous les sites ?</h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              Voulez-vous supprimer tous les emplacements actuels ({locations.length} site(s)) ? Cette action supprime les sites de la base — <strong className="text-rose-700">tous les OT déjà importés perdront immédiatement leur rattachement au site</strong> (pas seulement ceux des sites supprimés), et cette information ne peut être reconstituée par aucune sauvegarde automatique.
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Pour confirmer, tape <span className="font-mono text-rose-700">{DELETE_ALL_CONFIRM_WORD}</span> ci-dessous :
              </label>
              <input
                type="text"
                value={deleteAllConfirmText}
                onChange={(e) => setDeleteAllConfirmText(e.target.value)}
                placeholder={DELETE_ALL_CONFIRM_WORD}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setIsResetConfirmOpen(false); setDeleteAllConfirmText(''); }}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deleteAllConfirmText.trim().toUpperCase() !== DELETE_ALL_CONFIRM_WORD}
                onClick={() => {
                  if (onClearAllLocations) {
                    onClearAllLocations();
                  }
                  setIsResetConfirmOpen(false);
                  setDeleteAllConfirmText('');
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg shadow-2xs transition-colors"
              >
                Oui, tout supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Nouvel emplacement</h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nom du site ou bâtiment *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: AG Type A KENITRA"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Code Zone</label>
                <input
                  type="text"
                  placeholder="Ex: BAM_KNT_AG"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Doit correspondre à la colonne "Zone" du fichier planning pour ce site, pour que les OT s'y rattachent automatiquement à l'import.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Emplacement parent</label>
                <input
                  type="text"
                  placeholder="Ex: Site Principal"
                  value={parentLocation}
                  onChange={(e) => setParentLocation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
