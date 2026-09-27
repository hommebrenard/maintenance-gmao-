import React, { useState } from 'react';
import { UserPlus, Search, User, Shield, Mail, DollarSign, X } from 'lucide-react';
import { UserItem } from '../../types';

interface UsersViewProps {
  users: UserItem[];
  onAddUser: (user: Omit<UserItem, 'id'>) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ users, onAddUser }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'invites'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Administrateur' | 'Technicien' | 'Demandeur' | 'Manager'>('Technicien');
  const [team, setTeam] = useState('Maintenance');

  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    const initials = fullName
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    onAddUser({
      fullName,
      email,
      role,
      teams: [team],
      lastVisit: 'Aujourd\'hui',
      avatarInitials: initials || 'US'
    });

    setFullName('');
    setEmail('');
    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col">
      {/* Header matching Screenshot 14 */}
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Utilisateurs et équipes</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gérez vos techniciens, administrateurs et équipes.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm shadow-xs transition-colors self-start md:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Inviter des personnes</span>
          </button>
        </div>

        {/* Sub tabs */}
        <div className="mt-6 flex items-center gap-6 border-b border-gray-200 -mb-5">
          {[
            { id: 'users', label: 'Utilisateurs' },
            { id: 'teams', label: 'Équipes' },
            { id: 'invites', label: 'Invitations en attente' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher des utilisateurs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 bg-gray-50/30">
        {activeTab === 'users' ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden max-w-6xl mx-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold uppercase">
                <tr>
                  <th className="px-5 py-3.5">Nom & Email</th>
                  <th className="px-5 py-3.5">Équipe(s)</th>
                  <th className="px-5 py-3.5">Rôle</th>
                  <th className="px-5 py-3.5">Dernière visite</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {user.avatarInitials || user.fullName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{user.fullName}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 font-medium">{(user.teams && user.teams.length > 0) ? user.teams.join(', ') : 'Maintenance'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        user.role === 'Administrateur' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'Technicien' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-800">{user.lastVisit || 'Récent'}</td>
                    <td className="px-5 py-3.5 text-right text-xs font-semibold text-blue-600 hover:underline cursor-pointer">
                      Gérer
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-12 text-sm">
            Section {activeTab === 'teams' ? 'Équipes' : 'Invitations'} disponible.
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Inviter un utilisateur</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Paul Martin"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Adresse email *</label>
                <input
                  type="email"
                  required
                  placeholder="p.martin@entreprise.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Rôle</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Technicien">Technicien</option>
                    <option value="Administrateur">Administrateur</option>
                    <option value="Manager">Manager</option>
                    <option value="Demandeur">Demandeur</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Équipe</label>
                  <input
                    type="text"
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
                  Envoyer invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
