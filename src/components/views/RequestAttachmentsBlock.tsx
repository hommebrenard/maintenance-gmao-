import React, { useEffect, useState } from 'react';
import { FileText, Image as ImageIcon, Paperclip } from 'lucide-react';
import { fetchRequestAttachments, type RequestAttachment } from '../../lib/queries/requestAttachments';
import { openRequestAttachment } from '../../lib/requestAttachments';
import { formatFileSize } from '../../utils/requestAttachments';

/** Pièces jointes d'une demande (lecture) : visibles par le demandeur et les managers (RLS). N'affiche rien s'il n'y en a pas. */
export const RequestAttachmentsBlock: React.FC<{ requestId: string }> = ({ requestId }) => {
  const [items, setItems] = useState<RequestAttachment[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setItems([]);
    setError('');
    fetchRequestAttachments(requestId)
      .then(list => { if (!cancelled) setItems(list); })
      .catch(() => { if (!cancelled) setError('Pièces jointes indisponibles (connexion ou droits).'); });
    return () => { cancelled = true; };
  }, [requestId]);

  const open = (item: RequestAttachment) => {
    openRequestAttachment(item.storagePath)
      .catch(() => setError("Ouverture impossible : le fichier est introuvable ou l'accès a expiré. Rechargez la page."));
  };

  if (items.length === 0 && !error) return null;
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase mb-2">
        <Paperclip className="w-3.5 h-3.5" />Pièces jointes ({items.length})
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <ul className="divide-y divide-gray-100">
        {items.map(it => (
          <li key={it.id} className="flex items-center justify-between gap-3 py-2">
            <span className="flex items-center gap-2 min-w-0 text-sm text-gray-800">
              {it.mimeType === 'application/pdf' ? <FileText className="w-4 h-4 text-red-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
              <span className="truncate">{it.displayName}</span>
              <span className="text-xs text-gray-400 shrink-0">{formatFileSize(it.sizeBytes)}</span>
            </span>
            <button type="button" onClick={() => open(it)} className="shrink-0 text-xs font-medium text-blue-700 hover:text-blue-900">Ouvrir</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
