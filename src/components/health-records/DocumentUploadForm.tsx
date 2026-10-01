import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { EquipmentDocumentCategory } from '../../types';
import { DOCUMENT_CATEGORY_LABEL } from '../../utils/healthRecordDisplay';
import { nameWithoutExtension, validateDocumentFile } from '../../utils/fileUpload';
import { isHttpUrl } from '../../utils/scheduleControls';

export interface DocumentUploadValues {
  name: string;
  category?: EquipmentDocumentCategory;
  file: File | null;
  url: string | null;
}

interface Props {
  title: string;
  /** Catégorie imposée (ex. « Rapport » pour un compte rendu de contrôle) : le choix n'est alors pas proposé. */
  categoryFixed?: EquipmentDocumentCategory;
  saving: boolean;
  error: string | null;
  onSubmit: (values: DocumentUploadValues) => void;
  onCancel: () => void;
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
const labelCls = 'block text-xs font-semibold text-gray-700 mb-1';

/** Fenêtre d'ajout d'un document : fichier (PDF / photo) et/ou lien GED — managers uniquement. */
export const DocumentUploadForm: React.FC<Props> = ({ title, categoryFixed, saving, error, onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<EquipmentDocumentCategory | ''>(categoryFixed ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !url.trim()) return setLocalError('Choisissez un fichier ou indiquez un lien.');
    if (file) {
      const invalid = validateDocumentFile(file);
      if (invalid) return setLocalError(invalid);
    }
    if (url.trim() && !isHttpUrl(url)) return setLocalError('Lien : adresse http:// ou https:// attendue.');
    const finalName = name.trim() || (file ? nameWithoutExtension(file.name) : '');
    if (!finalName) return setLocalError('Indiquez un intitulé.');
    setLocalError(null);
    onSubmit({ name: finalName, category: categoryFixed ?? (category || undefined), file, url: url.trim() || null });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onCancel} aria-label="Fermer" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Fichier (PDF ou photo, 10 Mo maximum)</label>
            <input
              type="file" accept=".pdf,application/pdf,image/*"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-gray-700 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-semibold"
            />
            <p className="text-[11px] text-gray-500 mt-1">Les photos sont réduites automatiquement avant l'envoi.</p>
          </div>

          <div>
            <label className={labelCls}>Lien vers la GED (facultatif)</label>
            <input type="text" inputMode="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Intitulé</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Par défaut : nom du fichier" className={inputCls} />
          </div>

          {!categoryFixed && (
            <div>
              <label className={labelCls}>Catégorie</label>
              <select value={category} onChange={e => setCategory(e.target.value as EquipmentDocumentCategory | '')} className={inputCls}>
                <option value="">Non classé</option>
                {(Object.keys(DOCUMENT_CATEGORY_LABEL) as EquipmentDocumentCategory[]).map(c => (
                  <option key={c} value={c}>{DOCUMENT_CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </div>
          )}

          {(localError || error) && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{localError ?? error}</div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg disabled:opacity-50">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {saving ? 'Envoi…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
