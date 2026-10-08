import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { analyzeRequestRows, type ImportContext, type ImportReport, type RequestInsertRow } from '../../utils/importRequests';

interface Props {
  context: ImportContext;
  onClose: () => void;
  /** Écrit les lignes en base et renvoie le nombre de demandes réellement créées. */
  onImport: (rows: RequestInsertRow[]) => Promise<number>;
}

const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: 'ok' | 'warn' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => (
  <div className={`rounded-lg border px-3 py-2 ${tone === 'ok' ? 'border-green-200 bg-green-50' : tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
    <div className="text-[11px] uppercase font-semibold text-gray-500">{label}</div>
    <div className="text-lg font-bold text-gray-900">{value}</div>
  </div>
);

/** Import des demandes d'intervention Coswin : analyse sans écriture, puis confirmation. N'AJOUTE que les N° de DI nouveaux. */
export const RequestImportModal: React.FC<Props> = ({ context, onClose, onImport }) => {
  const [fileName, setFileName] = useState('');
  const [analysis, setAnalysis] = useState<{ report: ImportReport; rows: RequestInsertRow[] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; expected: number } | null>(null);

  const handleFile = async (file: File) => {
    setError(''); setAnalysis(null); setResult(null); setFileName(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true });
      if (raw.length === 0) { setError('Le fichier ne contient aucune ligne.'); return; }
      setAnalysis(analyzeRequestRows(raw, context));
    } catch (e) {
      console.error(e);
      setError("Fichier illisible. Utilise l'export Excel ou CSV des demandes d'intervention de Coswin.");
    }
  };

  const run = async () => {
    if (!analysis) return;
    setBusy(true); setError('');
    try {
      const inserted = await onImport(analysis.rows);
      setResult({ inserted, expected: analysis.rows.length });
    } catch (e) {
      console.error(e);
      setError("L'import a échoué (droits ou connexion). Aucune demande existante n'a été modifiée ; tu peux relancer sans risque de doublon.");
    } finally { setBusy(false); }
  };

  const r = analysis?.report;
  const blocked = !!r && r.missingHeaders.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-gray-900">Importer des demandes depuis Coswin</h3>
          <button onClick={onClose} aria-label="Fermer" className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-600">
            L'import <b>ajoute uniquement les N° de DI qui n'existent pas encore</b>. Une demande déjà présente n'est jamais modifiée ni écrasée.
            Une analyse est affichée avant toute écriture.
          </p>

          <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400">
            <FileSpreadsheet className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-700">{fileName || 'Choisir le fichier Coswin (.xlsx, .xls ou .csv)'}</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </label>

          {error && <div className="flex gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3"><XCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}

          {r && blocked && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              En-têtes obligatoires introuvables : <b>{r.missingHeaders.join(', ')}</b>. Vérifie que c'est bien l'export des demandes d'intervention.
            </div>
          )}

          {r && !blocked && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Lignes du fichier" value={r.totalRows} />
                <Stat label="Nouvelles à importer" value={r.newCount} tone="ok" />
                <Stat label="Déjà présentes (ignorées)" value={r.alreadyCount} />
                <Stat label="Non importées" value={r.invalid.length + r.skippedUnknownState.reduce((a, s) => a + s.count, 0)} tone={r.invalid.length + r.skippedUnknownState.length > 0 ? 'warn' : 'neutral'} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <Stat label="Équipement reconnu / à rapprocher" value={`${r.equipmentMatched} / ${r.equipmentUnmatched}`} tone={r.equipmentUnmatched ? 'warn' : 'ok'} />
                <Stat label="Site reconnu / à rapprocher" value={`${r.siteMatched} / ${r.siteUnmatched}`} tone={r.siteUnmatched ? 'warn' : 'ok'} />
                <Stat label="OT lié / hors application" value={`${r.otLinked} / ${r.otUnlinked}`} />
              </div>
              <p className="text-xs text-gray-500">
                « À rapprocher » : le code est conservé sur la demande et reste visible ; le rattachement se fera quand l'équipement ou le site existera dans l'application.
              </p>

              {r.skippedUnknownState.length > 0 && (
                <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="font-semibold text-amber-800 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />États Coswin non reconnus : ces demandes ne sont pas importées</div>
                  <ul className="mt-1 text-amber-900 list-disc pl-5">{r.skippedUnknownState.map(s => <li key={s.state}>« {s.state} » : {s.count} demande(s)</li>)}</ul>
                </div>
              )}
              {r.invalid.length > 0 && (
                <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="font-semibold text-amber-800">Lignes invalides</div>
                  <ul className="mt-1 text-amber-900 list-disc pl-5">{r.invalid.slice(0, 10).map((x, i) => <li key={i}>{x.code} : {x.reason}</li>)}</ul>
                </div>
              )}
              {(r.unmatchedSites.length > 0 || r.unmatchedEquipment.length > 0) && (
                <details className="text-sm border border-gray-200 rounded-lg p-3">
                  <summary className="cursor-pointer font-semibold text-gray-700">Codes à rapprocher ({r.unmatchedSites.length} site(s), {r.unmatchedEquipment.length} équipement(s))</summary>
                  <div className="mt-2 text-xs text-gray-600 font-mono break-words">
                    {r.unmatchedSites.length > 0 && <p>Sites : {r.unmatchedSites.join(', ')}</p>}
                    {r.unmatchedEquipment.length > 0 && <p className="mt-1">Équipements : {r.unmatchedEquipment.slice(0, 60).join(', ')}{r.unmatchedEquipment.length > 60 ? ' …' : ''}</p>}
                  </div>
                </details>
              )}
              {r.warnings.length > 0 && (
                <details className="text-sm border border-gray-200 rounded-lg p-3">
                  <summary className="cursor-pointer font-semibold text-gray-700">Avertissements ({r.warnings.length})</summary>
                  <ul className="mt-2 text-xs text-gray-600 list-disc pl-5">{r.warnings.slice(0, 30).map((w, i) => <li key={i}><b>{w.code}</b> : {w.message}</li>)}</ul>
                </details>
              )}
            </>
          )}

          {result && (
            <div className="text-sm bg-green-50 border border-green-200 rounded-lg p-3 text-green-800">
              <div className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="w-4 h-4" />Import terminé</div>
              <p className="mt-1">
                {result.inserted} demande(s) créée(s) sur {result.expected} attendue(s)
                {result.inserted === result.expected ? ' : le contrôle des totaux est bon.' : ' : écart à vérifier, relance l\'import (aucun doublon possible).'}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{result ? 'Fermer' : 'Annuler'}</button>
          {!result && (
            <button onClick={run} disabled={!r || blocked || r.newCount === 0 || busy}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
              <Upload className="w-4 h-4" /><span>{busy ? 'Import en cours…' : `Importer ${r?.newCount ?? 0} demande(s)`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
