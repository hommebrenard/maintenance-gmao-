import React, { useState } from 'react';
import { Truck, Plus, Search, Phone, Mail, Pencil } from 'lucide-react';
import type { SupplierRecord, SupplierInput } from '../../lib/queries/suppliers';

interface SuppliersViewProps {
  suppliers: SupplierRecord[];
  /** Responsable / admin : seuls à créer, modifier et désactiver (la RLS reste le vrai verrou). */
  isManager: boolean;
  onCreate: (input: SupplierInput) => Promise<void>;
  onUpdate: (id: string, input: SupplierInput) => Promise<void>;
  onSetActive: (id: string, isActive: boolean) => Promise<void>;
}

const EMPTY: SupplierInput = { name: '', contactName: '', email: '', phone: '', notes: '' };

export const SuppliersView: React.FC<SuppliersViewProps> = ({ suppliers, isManager, onCreate, onUpdate, onSetActive }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [form, setForm] = useState<SupplierInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = searchQuery.toLowerCase();
  const filtered = suppliers.filter(s =>
    (showInactive || s.isActive) &&
    (s.name.toLowerCase().includes(q) || s.contactName.toLowerCase().includes(q))
  );
  const inactiveCount = suppliers.filter(s => !s.isActive).length;

  const openCreate = () => { setForm(EMPTY); setError(null); setEditing({ id: null }); };
  const openEdit = (s: SupplierRecord) => {
    setForm({ name: s.name, contactName: s.contactName, email: s.email, phone: s.phone, notes: s.notes });
    setError(null);
    setEditing({ id: s.id });
  };
  const set = (k: keyof SupplierInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); return true; }
    catch (err) {
      setError(`Enregistrement refusé : ${err instanceof Error ? err.message : 'vérifie ta connexion ou tes droits.'}`);
      return false;
    } finally { setBusy(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !form.name.trim()) return;
    const dup = suppliers.some(s => s.id !== editing.id && s.name.trim().toLowerCase() === form.name.trim().toLowerCase());
    if (dup) { setError('Un fournisseur avec ce nom existe déjà.'); return; }
    const ok = await run(() => (editing.id ? onUpdate(editing.id, form) : onCreate(form)));
    if (ok) setEditing(null);
  };

  const input = 'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500';
  const label = 'block text-xs font-semibold text-gray-700 uppercase mb-1';

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Fournisseurs</h1>
            <p className="text-sm text-gray-500 mt-1">Gestion des prestataires de services et équipementiers.</p>
          </div>
          {isManager && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm shadow-xs transition-colors self-start"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau fournisseur</span>
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher des fournisseurs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {inactiveCount > 0 && (
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
              Afficher les désactivés ({inactiveCount})
            </label>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 bg-gray-50/30">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-10">Aucun fournisseur.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {filtered.map(s => (
            <div key={s.id} className={`bg-white p-5 rounded-xl border border-gray-200 shadow-2xs space-y-3 ${s.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-gray-900 text-base truncate">{s.name}</h3>
                  <p className="text-xs text-gray-500 truncate">Contact : {s.contactName || 'Non renseigné'}</p>
                </div>
                {!s.isActive && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Désactivé</span>}
              </div>

              <div className="pt-2 border-t border-gray-100 space-y-1 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  {s.email ? <a href={`mailto:${s.email}`} className="text-blue-600 truncate">{s.email}</a> : <span className="text-gray-400">Non renseigné</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {s.phone ? <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="text-blue-600">{s.phone}</a> : <span className="text-gray-400">Non renseigné</span>}
                </div>
                {s.notes && <p className="text-gray-500 pt-1 whitespace-pre-line">{s.notes}</p>}
              </div>

              {isManager && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => openEdit(s)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                    <Pencil className="w-3 h-3" /> Modifier
                  </button>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      const verb = s.isActive ? 'Désactiver' : 'Réactiver';
                      if (!window.confirm(`${verb} le fournisseur « ${s.name} » ?`)) return;
                      await run(() => onSetActive(s.id, !s.isActive));
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
                  >
                    {s.isActive ? 'Désactiver' : 'Réactiver'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {error && !editing && <p className="text-xs text-red-700 text-center mt-4">{error}</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">{editing.id ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className={label}>Raison sociale *</label>
                <input type="text" required value={form.name} onChange={set('name')} className={input} />
              </div>
              <div>
                <label className={label}>Nom du contact</label>
                <input type="text" value={form.contactName} onChange={set('contactName')} className={input} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Email</label>
                  <input type="email" value={form.email} onChange={set('email')} className={input} />
                </div>
                <div>
                  <label className={label}>Téléphone</label>
                  <input type="text" value={form.phone} onChange={set('phone')} className={input} />
                </div>
              </div>
              <div>
                <label className={label}>Notes</label>
                <textarea rows={3} value={form.notes} onChange={set('notes')} className={input} />
              </div>
              {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg">Annuler</button>
                <button type="submit" disabled={busy} className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                  {busy ? 'Enregistrement…' : editing.id ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
