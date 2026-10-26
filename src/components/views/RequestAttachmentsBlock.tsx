import React, { useEffect, useState } from 'react';
import { FileText, Image as ImageIcon, Link2, Paperclip, ShieldAlert } from 'lucide-react';
import { fetchRequestAttachments, type RequestAttachment } from '../../lib/queries/requestAttachments';
import { fetchLinkedDocumentsFor, linkRequestAttachmentToDocuments } from '../../lib/queries/equipmentDocuments';
import { deleteEquipmentDocumentWithFile } from '../../lib/documents';
import { openRequestAttachment } from '../../lib/requestAttachments';
import { canLinkAttachment, canUnlinkDocument, formatFileSize } from '../../utils/requestAttachments';
import { DOCUMENT_CATEGORY_LABEL } from '../../utils/healthRecordDisplay';
import type { EquipmentDocument, EquipmentDocumentCategory } from '../../types';

interface Props {
  requestId: string;
  /** Pour lier au carnet : équipement réel de la demande, son libellé, son auteur et son origine. */
  equipmentId?: string;
  equipmentLabel?: string;
  requestedBy?: string;
  origin?: string;
  currentUserId?: string;
  isManager?: boolean;
}

const messageOf = (err: unknown): string => {
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m ? m : 'erreur inconnue';
};

/**
 * Pièces jointes d'une demande : visibles par le demandeur et les managers (RLS). N'affiche rien s'il n'y en a pas.
 * Lier une pièce aux Documents du carnet la rend lisible par TOUS les comptes connectés : étape de confirmation obligatoire.
 */
export const RequestAttachmentsBlock: React.FC<Props> = ({ requestId, equipmentId, equipmentLabel, requestedBy, origin, currentUserId, isManager = false }) => {
  const [items, setItems] = useState<RequestAttachment[]>([]);
  const [linked, setLinked] = useState<Record<string, EquipmentDocument>>({});
  const [error, setError] = useState('');
  const [toLink, setToLink] = useState<RequestAttachment | null>(null);
  const [linkName, setLinkName] = useState('');
  const [linkCategory, setLinkCategory] = useState<EquipmentDocumentCategory | ''>('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');

  const canLink = canLinkAttachment({ isManager, currentUserId, requestedBy, origin, equipmentId });

  useEffect(() => {
    let cancelled = false;
    setItems([]);
    setLinked({});
    setError('');
    fetchRequestAttachments(requestId)
      .then(async list => {
        if (cancelled) return;
        setItems(list);
        if (list.length === 0) return;
        try {
          const docs = await fetchLinkedDocumentsFor(list.map(a => a.id));
          if (cancelled) return;
          const byAttachment: Record<string, EquipmentDocument> = {};
          for (const d of docs) if (d.sourceAttachmentId) byAttachment[d.sourceAttachmentId] = d;
          setLinked(byAttachment);
        } catch { /* état « lié » indisponible : les boutons de lien restent masqués par la base si déjà lié */ }
      })
      .catch(() => { if (!cancelled) setError('Pièces jointes indisponibles (connexion ou droits).'); });
    return () => { cancelled = true; };
  }, [requestId]);

  const open = (item: RequestAttachment) => {
    openRequestAttachment(item.storagePath)
      .catch(() => setError("Ouverture impossible : le fichier est introuvable ou l'accès a expiré. Rechargez la page."));
  };

  const startLink = (item: RequestAttachment) => {
    setToLink(item);
    setLinkName(item.displayName.replace(/\.[^.]+$/, ''));
    setLinkCategory('');
    setConfirmed(false);
    setDialogError('');
  };

  const doLink = async () => {
    if (!toLink || !equipmentId || !currentUserId || !confirmed || !linkName.trim()) return;
    setBusy(true);
    setDialogError('');
    try {
      const doc = await linkRequestAttachmentToDocuments({
        equipmentId, attachmentId: toLink.id, storagePath: toLink.storagePath, name: linkName.trim(),
        category: linkCategory || undefined, mimeType: toLink.mimeType, sizeBytes: toLink.sizeBytes,
      }, currentUserId);
      setLinked(prev => ({ ...prev, [toLink.id]: doc }));
      setToLink(null);
    } catch (err) {
      setDialogError(`Lien impossible : ${messageOf(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (item: RequestAttachment) => {
    const doc = linked[item.id];
    if (!doc) return;
    setBusy(true);
    setError('');
    try {
      await deleteEquipmentDocumentWithFile(doc); // pièce liée : seule la ligne est supprimée, le fichier reste dans la demande
      setLinked(prev => { const next = { ...prev }; delete next[item.id]; return next; });
    } catch (err) {
      setError(`Retrait impossible : ${messageOf(err)}`);
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0 && !error) return null;
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase mb-2">
        <Paperclip className="w-3.5 h-3.5" />Pièces jointes ({items.length})
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <ul className="divide-y divide-gray-100">
        {items.map(it => {
          const doc = linked[it.id];
          return (
            <li key={it.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2 min-w-0 text-sm text-gray-800">
                {it.mimeType === 'application/pdf' ? <FileText className="w-4 h-4 text-red-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                <span className="truncate">{it.displayName}</span>
                <span className="text-xs text-gray-400 shrink-0">{formatFileSize(it.sizeBytes)}</span>
                {doc && <span className="shrink-0 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">Dans le carnet</span>}
              </span>
              <span className="flex items-center gap-3 shrink-0">
                {doc
                  ? canUnlinkDocument({ isManager, currentUserId, createdBy: doc.createdBy }) && (
                      <button type="button" disabled={busy} onClick={() => unlink(it)} className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50">Retirer du carnet</button>
                    )
                  : canLink && (
                      <button type="button" onClick={() => startLink(it)} className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900">
                        <Link2 className="w-3 h-3" />Lier au carnet
                      </button>
                    )}
                <button type="button" onClick={() => open(it)} className="text-xs font-medium text-blue-700 hover:text-blue-900">Ouvrir</button>
              </span>
            </li>
          );
        })}
      </ul>

      {toLink && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-gray-900"><ShieldAlert className="w-5 h-5 text-amber-600" />Publier ce fichier dans le carnet de santé ?</h3>
            <p className="text-sm text-gray-700">
              « {toLink.displayName} » sera visible par <strong>tous les comptes connectés</strong>, dans l'onglet Documents de {equipmentLabel ? `« ${equipmentLabel} »` : "l'équipement"}.
              Le fichier reste attaché à la demande ; vous pourrez le retirer du carnet ensuite.
            </p>
            {toLink.mimeType !== 'application/pdf' && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">Photo : vérifiez qu'elle ne montre ni personne ni information sensible avant de la publier.</p>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nom affiché dans le carnet</label>
              <input value={linkName} onChange={e => setLinkName(e.target.value)} maxLength={150} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Catégorie</label>
              <select value={linkCategory} onChange={e => setLinkCategory(e.target.value as EquipmentDocumentCategory | '')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
                <option value="">Non classé</option>
                {(Object.keys(DOCUMENT_CATEGORY_LABEL) as EquipmentDocumentCategory[]).map(c => <option key={c} value={c}>{DOCUMENT_CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5" />
              <span>Je confirme que ce fichier peut être vu par tous les utilisateurs de l'application.</span>
            </label>
            {dialogError && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{dialogError}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setToLink(null)} disabled={busy} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg disabled:opacity-50">Annuler</button>
              <button type="button" onClick={doLink} disabled={busy || !confirmed || !linkName.trim()} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
                {busy ? 'Publication…' : 'Publier dans le carnet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
