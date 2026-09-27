import React, { useMemo, useState } from 'react';
import { Wrench, X } from 'lucide-react';
import { Technicien, Profile } from '../../types';

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
}

export const TechniciensView: React.FC<TechniciensViewProps> = ({
  techniciens,
  onAddTechnicien,
  onUpdateTechnicien,
  profiles = [],
  currentUserId,
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
