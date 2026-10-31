import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, RefreshCw, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Lock } from 'lucide-react';
import { analyzeRequestRows, toSyncPayload, type ImportContext, type ImportReport } from '../../utils/importRequests';
import type { SyncResult } from '../../lib/queries/maintenanceRequests';
import type { MaintenanceRequest } from '../../types';

interface Props {
  context: ImportContext;
  requests: MaintenanceRequest[];
  onClose: () => void;
  /** Appelle la fonction SQL : apply = false → aperçu sans écriture ; apply = true → écriture + historique. */
  onSync: (payload: Record<string, string | null>[], batchId: string, apply: boolean) => Promise<SyncResult>;
}

const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: 'ok' | 'warn' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => (
  <div className={`rounded-lg border px-3 py-2 ${tone === 'ok' ? 'border-green-200 bg-green-50' : tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
    <div className="text-[11px] uppercase font-semibold text-gray-500">{label}</div>
    <div className="text-lg font-bold text-gray-900">{value}</div>
  </div>
);

const newBatchId = () => `sync-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;

/** Synchronisation des DI Coswin DÉJÀ présentes : aperçu chiffré obligatoire, sauvegarde JSON, application atomique, contrôle final. */
export const RequestSyncModal: React.FC<Props> = ({ context, requests, onClose, onSync }) => {
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [payload, setPayload] = useState<Record<string, string | null>[]>([]);
  const [newInFile, setNewInFile] = useState(0);
  const [preview, setPreview] = useState<SyncResult | null>(null);
  const [done, setDone] = useState<{ batch: string; applied: SyncResult; remaining: number } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setError(''); setReport(null); setPreview(null); setDone(null); setPayload([]); setFileName(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true });
      if (raw.length === 0) { setError('Le fichier ne contient aucune ligne.'); return; }
      const a = analyzeRequestRows(raw, context, { syncExisting: true });
      setReport(a.report); setNewInFile(a.rows.length);
      if (a.report.missingHeaders.length > 0) return;
      const p = toSyncPayload(a.existingRows);
      setPayload(p);
      if (p.length === 0) return;
      setBusy(true);
      setPreview(await onSync(p, newBatchId(), false));
    } catch (e) {
      console.error(e);
      setError("Fichier illisible ou aperçu impossible (droits ou connexion). Aucune donnée n'a été modifiée.");
    } finally { setBusy(false); }
  };

  const apply = async () => {
    if (!preview || payload.length === 0) return;
    setBusy(true); setError('');
    try {
      // Sauvegarde : état actuel des DI concernées, téléchargé AVANT toute écriture.
      const codes = new Set(payload.map(p => p.code));
      const blob = new Blob([JSON.stringify(requests.filter(r => r.code && codes.has(r.code)), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `di-avant-synchro-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);

      const batch = newBatchId();
      const applied = await onSync(payload, batch, true);
      const control = await onSync(payload, `${batch}-controle`, false);
      setDone({ batch, applied, remaining: control.champs_modifies });
    } catch (e) {
      console.error(e);
      setError("La synchronisation a échoué : la transaction est annulée, aucune demande n'a été modifiée. Tu peux relancer.");
    } finally { setBusy(false); }
  };

  const blocked = !!report && report.missingHeaders.length > 0;
  const unknownStates = report ? report.skippedUnknownState.reduce((n, s) => n + s.count, 0) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-gray-900">Synchroniser les demandes avec Coswin</h3>
          <button onClick={onClose} aria-label="Fermer" className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-600">
            Met à jour les demandes <b>déjà présentes</b> avec l'état Coswin (état, OT, dates, superviseur…). Le <b>statut</b> d'une demande décidée dans
            l'application n'est jamais modifié ; titre, demandeur, date de déclaration et priorité ne sont jamais touchés ; rien n'est créé ni supprimé.
            Un aperçu chiffré est affiché avant toute écriture.
          </p>

          <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400">
            <FileSpreadsheet className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-700">{fileName || 'Choisir le fichier Coswin récent (.xlsx, .xls ou .csv)'}</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </label>

          {error && <div className="flex gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3"><XCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}
          {busy && !done && <p className="text-sm text-gray-500">Traitement en cours…</p>}

          {report && blocked && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              En-têtes obligatoires introuvables : <b>{report.missingHeaders.join(', ')}</b>. Vérifie que c'est bien l'export des demandes d'intervention.
            </div>
          )}

          {report && !blocked && (
            <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Lignes du fichier" value={report.totalRows} />
              <Stat label="DI déjà présentes (comparées)" value={payload.length} tone="ok" />
              <Stat label="Nouvelles DI (non créées ici)" value={newInFile} tone={newInFile ? 'warn' : 'neutral'} />
              <Stat label="Non retenues (état / ligne invalide)" value={unknownStates + report.invalid.length} tone={unknownStates + report.invalid.length ? 'warn' : 'neutral'} />
            </div>
            {report.equipmentSourceDiffersPlanned > 0 && (
              <p className="text-xs text-amber-700">{report.equipmentSourceDiffersPlanned} DI avec équipement source ≠ planifié : l'équipement planifié est retenu (erreur probable de saisie du source dans Coswin).</p>
            )}
            </>
          )}
          {report && !blocked && newInFile > 0 && (
            <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Le fichier contient <b>{newInFile} nouvelle(s) DI</b> absente(s) de l'application. La synchronisation ne les crée pas : fermez cette fenêtre et utilisez <b>« Importer depuis Coswin »</b> pour les ajouter.</span>
            </div>
          )}

          {preview && !done && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="DI qui changeraient" value={preview.di_modifiees} tone={preview.di_modifiees ? 'ok' : 'neutral'} />
                <Stat label="Champs modifiés" value={preview.champs_modifies} />
                <Stat label="« En attente » résolues" value={preview.en_attente_resolues} tone={preview.en_attente_resolues ? 'ok' : 'neutral'} />
                <Stat label="Statuts protégés (décision locale)" value={preview.statuts_proteges_decision_locale} />
                <Stat label="Statuts modifiés" value={preview.statuts_modifies} />
                <Stat label="Retours vers « en attente »" value={preview.regressions_vers_en_attente} tone={preview.regressions_vers_en_attente ? 'warn' : 'neutral'} />
                <Stat label="Absentes de la base" value={preview.absentes_en_base} tone={preview.absentes_en_base ? 'warn' : 'neutral'} />
              </div>
              {(preview.verrous_dans_le_lot ?? 0) > 0 && (
                <div className="text-sm bg-sky-50 border border-sky-200 rounded-lg p-3 text-sky-900 flex gap-2">
                  <Lock className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    <b>{preview.verrous_dans_le_lot} DI verrouillée(s)</b> dans ce fichier : leur équipement dans l'application est conservé.
                    Coswin diffère encore du verrou pour <b>{preview.verrous_ou_coswin_diverge ?? 0}</b>
                    {(preview.verrous_alignes_coswin ?? 0) > 0 && (
                      <> ; Coswin est maintenant d'accord pour <b>{preview.verrous_alignes_coswin}</b> (verrou libérable : {(preview.verrous_alignes_codes ?? []).slice(0, 10).join(', ')}{(preview.verrous_alignes_codes ?? []).length > 10 ? '…' : ''})</>
                    )}.
                  </span>
                </div>
              )}
              {preview.regressions_vers_en_attente > 0 && (
                <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 flex gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />Des DI repasseraient « en attente » d'après Coswin : vérifie le détail ci-dessous avant d'appliquer.
                </div>
              )}
              {preview.champs_modifies === 0 ? (
                <div className="text-sm bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />{newInFile > 0
                    ? `Aucune différence sur les ${payload.length} DI déjà présentes. Les ${newInFile} nouvelles DI ne sont pas ajoutées ici (voir ci-dessus).`
                    : 'Aucune différence : les demandes sont déjà à jour avec ce fichier.'}
                </div>
              ) : (
                <details className="text-sm border border-gray-200 rounded-lg p-3">
                  <summary className="cursor-pointer font-semibold text-gray-700">
                    Détail des changements ({Math.min(preview.detail_300_premiers.length, 300)} premiers sur {preview.champs_modifies})
                  </summary>
                  <div className="mt-2 max-h-72 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left text-gray-500"><tr><th className="pr-2">DI</th><th className="pr-2">Champ</th><th className="pr-2">Avant</th><th>Après</th></tr></thead>
                      <tbody>
                        {preview.detail_300_premiers.map((d, i) => (
                          <tr key={i} className="border-t border-gray-100 align-top">
                            <td className="pr-2 font-mono">{d.code}</td><td className="pr-2">{d.champ}</td>
                            <td className="pr-2 text-gray-500">{d.ancienne ?? '—'}</td><td className="text-gray-900">{d.nouvelle ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </>
          )}

          {done && (
            <div className="text-sm bg-green-50 border border-green-200 rounded-lg p-3 text-green-800">
              <div className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="w-4 h-4" />Synchronisation terminée</div>
              <p className="mt-1">
                {done.applied.di_modifiees} demande(s) mise(s) à jour ({done.applied.champs_modifies} champs, dont {done.applied.en_attente_resolues} « en attente » résolue(s)).
                {done.remaining === 0 ? ' Contrôle : 0 différence restante avec le fichier.' : ` Contrôle : ${done.remaining} différence(s) restante(s), à vérifier.`}
              </p>
              <p className="mt-1 text-xs">Numéro de lot (pour un éventuel retour arrière) : <span className="font-mono">{done.batch}</span>. La sauvegarde JSON a été téléchargée.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{done ? 'Fermer' : 'Annuler'}</button>
          {!done && (
            <button onClick={apply} disabled={!preview || preview.champs_modifies === 0 || busy}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
              <RefreshCw className="w-4 h-4" /><span>{busy ? 'En cours…' : `Appliquer ${preview?.di_modifiees ?? 0} mise(s) à jour`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
