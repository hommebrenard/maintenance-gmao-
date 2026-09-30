import React, { useMemo, useState } from 'react';
import { Wrench, X, Search } from 'lucide-react';
import { Technicien, Profile, LocationItem } from '../../types';

// Ajouté le 27/09/2026 — chantier B. D'abord logé comme 4e onglet de
// « Utilisateurs et équipes », puis sorti dans sa propre entrée de menu à la
// demande de l'utilisateur (qui garde « Utilisateurs et équipes » tel quel,
// conception de l'app pas close, sans décider de le supprimer pour l'instant).
interface TechniciensViewProps {
  techniciens: Technicien[];
  onAddTechnicien: (t: { nom: string; zone: 'Nord' | 'Sud' }) => void;
  onUpdateTechnicien: (id: string, patch: Partial<{ nom: string; zone: 'Nord' | 'Sud'; actif: boolean }>) => void;
  profiles?: Profile[];
  currentUserId?: string;
  // Ajouté le 27/09/2026 — affectation des sites à une zone Nord/Sud, gérée
  // ici (et non dans l'écran Emplacements) à la demande de l'utilisateur,
  // pour préparer le filtrage des techniciens par zone dans le formulaire OT.
  locations?: LocationItem[];
  onUpdateLocationZone?: (id: string, zone: 'Nord' | 'Sud') => void;
}

export const TechniciensView: React.FC<TechniciensViewProps> = ({
  techniciens,
  onAddTechnicien,
  onUpdateTechnicien,
  profiles = [],
  currentUserId,
  locations = [],
  onUpdateLocationZone,
}) => {
  // Seul un manager (rôle 'responsable') peut créer/modifier un technicien —
  // réservé comme test en attendant un rôle admin dédié (décision du 27/09).
  const isManager = useMemo(
    () => profiles.find(p => p.id === currentUserId)?.role === 'responsable',
    [profiles, currentUserId]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [zone, setZone] = useState<'Nord' | 'Sud'>('Nord');

  const openAdd = () => {
    setEditingId(null);
    setNom('');
    setZone('Nord');
    setIsModalOpen(true);
  };

  const openEdit = (t: Technicien) => {
    setEditingId(t.id);
    setNom(t.nom);
    setZone(t.zone);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;
    if (editingId) {
      onUpdateTechnicien(editingId, { nom: nom.trim(), zone });
    } else {
      onAddTechnicien({ nom: nom.trim(), zone });
    }
    setIsModalOpen(false);
  };

  const handleToggleActif = (t: Technicien) => {
    onUpdateTechnicien(t.id, { actif: !t.actif });
  };

  // Ajouté le 28/09/2026 — recherche + filtres rapides sur les sites, pour
  // que la section « Sites par zone » reste lisible au-delà des 4 sites
  // actuels (jusqu'à ~27 sites prévus à terme).
  const [siteSearch, setSiteSearch] = useState('');
  const [siteZoneFilter, setSiteZoneFilter] = useState<'all' | 'Nord' | 'Sud' | 'none'>('all');

  const siteCounts = useMemo(() => ({
    all: locations.length,
    Nord: locations.filter(l => l.zone === 'Nord').length,
    Sud: locations.filter(l => l.zone === 'Sud').length,
    none: locations.filter(l => !l.zone).length,
  }), [locations]);

  // Repli de la liste (même principe que « Charge de travail » des OT) : 3 sites
  // visibles, « Voir tout (N) ▼ » déplie dans une zone à défilement.
  const SITES_COLLAPSED_COUNT = 3;
  const [sitesExpanded, setSitesExpanded] = useState(false);

  const filteredLocations = useMemo(() => {
    const query = siteSearch.trim().toLowerCase();
    return locations.filter(loc => {
      const matchesSearch = !query || loc.name.toLowerCase().includes(query);
      const matchesZone =
        siteZoneFilter === 'all' ? true :
        siteZoneFilter === 'none' ? !loc.zone :
        loc.zone === siteZoneFilter;
      return matchesSearch && matchesZone;
    });
  }, [locations, siteSearch, siteZoneFilter]);

  const canCollapseSites = filteredLocations.length > SITES_COLLAPSED_COUNT;
  const visibleLocations =
    canCollapseSites && !sitesExpanded ? filteredLocations.slice(0, SITES_COLLAPSED_COUNT) : filteredLocations;

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Techniciens</h1>
            <p className="text-sm text-gray-500 mt-1">
              Répertoire des techniciens de terrain et affectation des zones.
            </p>
          </div>

          {isManager && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm shadow-xs transition-colors self-start md:self-auto"
            >
              <Wrench className="w-4 h-4" />
              <span>Ajouter un technicien</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 bg-gray-50/30">
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden max-w-6xl mx-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold uppercase">
              <tr>
                <th className="px-5 py-3.5">Nom</th>
                <th className="px-5 py-3.5">Zone</th>
                <th className="px-5 py-3.5">Statut</th>
                {isManager && <th className="px-5 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {techniciens.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 4 : 3} className="px-5 py-8 text-center text-gray-400">
                    Aucun technicien pour l'instant.
                  </td>
                </tr>
              ) : (
                techniciens.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-bold text-gray-900">{t.nom}</td>
                    <td className="px-5 py-3.5 text-gray-700 font-medium">{t.zone}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        t.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {t.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    {isManager && (
                      <td className="px-5 py-3.5 text-right text-xs font-semibold space-x-3">
                        <button onClick={() => openEdit(t)} className="text-blue-600 hover:underline">
                          Modifier
                        </button>
                        <button onClick={() => handleToggleActif(t)} className="text-gray-600 hover:underline">
                          {t.actif ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="max-w-6xl mx-auto mt-8">
          <h2 className="text-sm font-bold text-gray-700 uppercase mb-1">Sites par zone</h2>
          <p className="text-xs text-gray-500 mb-3">
            Sert à proposer automatiquement les bons techniciens selon le site d'un OT.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher un site..."
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {([
                { id: 'all', label: 'Tous' },
                { id: 'Nord', label: 'Nord' },
                { id: 'Sud', label: 'Sud' },
                { id: 'none', label: 'Non défini' },
              ] as const).map(f => (
                <button
                  key={f.id}
                  onClick={() => setSiteZoneFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    siteZoneFilter === f.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {f.label} ({siteCounts[f.id]})
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className={canCollapseSites && sitesExpanded ? 'max-h-72 overflow-y-auto' : ''}>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold uppercase">
                <tr>
                  <th className="px-5 py-3.5">Site</th>
                  <th className="px-5 py-3.5">Zone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLocations.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-5 py-8 text-center text-gray-400">
                      {locations.length === 0 ? "Aucun site pour l'instant." : 'Aucun site ne correspond à ce filtre.'}
                    </td>
                  </tr>
                ) : (
                  visibleLocations.map(loc => (
                    <tr key={loc.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5 font-medium text-gray-900">{loc.name}</td>
                      <td className="px-5 py-3.5">
                        {isManager ? (
                          <select
                            value={loc.zone ?? ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === 'Nord' || value === 'Sud') {
                                onUpdateLocationZone?.(loc.id, value);
                              }
                            }}
                            className="px-2 py-1 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="" disabled>Non défini</option>
                            <option value="Nord">Nord</option>
                            <option value="Sud">Sud</option>
                          </select>
                        ) : (
                          <span className="text-gray-700">{loc.zone ?? 'Non défini'}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
            {canCollapseSites && (
              <button
                type="button"
                onClick={() => setSitesExpanded(v => !v)}
                className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700 py-2.5 border-t border-gray-200"
              >
                {sitesExpanded ? 'Réduire ▲' : `Voir tout (${filteredLocations.length}) ▼`}
              </button>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {editingId ? 'Modifier le technicien' : 'Ajouter un technicien'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nom *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: MOHA"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Zone</label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value as 'Nord' | 'Sud')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Nord">Nord</option>
                  <option value="Sud">Sud</option>
                </select>
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
                  {editingId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
