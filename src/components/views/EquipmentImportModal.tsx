import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import type { LocationItem } from '../../types';
import { analyzeEquipmentRows, type EquipmentImportReport, type ExistingEquipment } from '../../utils/coswinEquipmentImport';

interface Props {
  existing: ExistingEquipment[];
  locations: LocationItem[];
  onClose: () => void;
}

const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: 'ok' | 'warn' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => (
  <div className={`rounded-lg border px-3 py-2 ${tone === 'ok' ? 'border-green-200 bg-green-50' : tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
    <div className="text-[11px] uppercase font-semibold text-gray-500">{label}</div>
    <div className="text-lg font-bold text-gray-900">{value}</div>
  </div>
);

/** Import des équipements Coswin — ÉTAPE A : aperçu seul, rien n'est écrit en base. */
export const EquipmentImportModal: React.FC<Props> = ({ existing, locations, onClose }) => {
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<EquipmentImportReport | null>(null);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError(''); setReport(null); setFileName(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true });
      if (raw.length === 0) { setError('Le fichier ne contient aucune ligne.'); return; }
      setReport(analyzeEquipmentRows(raw, existing, locations));
    } catch (e) {
      console.error(e);
      setError("Fichier illisible. Utilise l'export Excel ou CSV « Sélecteur des équipements » de Coswin.");
    }
  };

  const r = report;
  const blocked = !!r && r.missingHeaders.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-2 font-bold text-gray-900"><FileSpreadsheet className="w-5 h-5 text-blue-600" /> Importer les équipements Coswin — aperçu</div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4 text-sm">
          <div className="rounded-lg bg-blue-50 border border-blue-200 text-blue-900 px-3 py-2 text-xs">
            Aperçu seulement : <b>rien n'est écrit en base</b>. Rapprochement par code équipement (le code n'est jamais modifié) ; la colonne « Famille » et l'état Coswin sont ignorés ; aucun équipement n'est supprimé.
          </div>

          <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <Upload className="w-4 h-4 text-gray-500" />
            <span className="text-gray-700">{fileName || "Choisir l'export Coswin des équipements (.xlsx ou .csv)"}</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
          </label>

          {error && <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          {r && blocked && (
            <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Colonne(s) obligatoire(s) introuvable(s) : {r.missingHeaders.join(', ')}. Vérifie qu'il s'agit bien de l'export « Sélecteur des équipements ».
            </div>
          )}

          {r && !blocked && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="Lignes du fichier" value={r.totalRows} />
                <Stat label="Déjà dans l'app" value={r.alreadyInApp} />
                <Stat label="Nouveaux (à créer)" value={r.toCreate.length} tone="ok" />
                <Stat label="Site inconnu" value={r.unknownSiteRows} tone={r.unknownSiteRows ? 'warn' : 'neutral'} />
              </div>
              {(r.emptyCodeRows > 0 || r.duplicateCodesInFile.length > 0) && (
                <div className="flex items-start gap-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    {r.emptyCodeRows > 0 && <div>{r.emptyCodeRows} ligne(s) sans code équipement : ignorée(s).</div>}
                    {r.duplicateCodesInFile.length > 0 && <div>{r.duplicateCodesInFile.length} code(s) en double dans le fichier (1re ligne retenue) : {r.duplicateCodesInFile.slice(0, 5).join(', ')}{r.duplicateCodesInFile.length > 5 ? '…' : ''}</div>}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Site (code Zone)</th>
                      <th className="text-left px-3 py-2">Dans l'app</th>
                      <th className="text-right px-3 py-2">Fichier</th>
                      <th className="text-right px-3 py-2">Déjà là</th>
                      <th className="text-right px-3 py-2">Nouveaux</th>
                      <th className="text-right px-3 py-2">Absents du fichier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.sites.map(s => (
                      <tr key={s.siteKey} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-mono">{s.siteKey}</td>
                        <td className="px-3 py-2">{s.known ? s.locationName : <span className="text-amber-700 font-semibold">Site absent de la liste (à créer d'abord)</span>}</td>
                        <td className="px-3 py-2 text-right">{s.fileCount}</td>
                        <td className="px-3 py-2 text-right">{s.alreadyInApp}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-700">{s.known ? s.toCreate : '—'}</td>
                        <td className="px-3 py-2 text-right" title={s.absentFromFile.join(', ')}>{s.absentFromFile.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {r.toCreate.length > 0 && (
                <details className="border border-gray-200 rounded-lg">
                  <summary className="px-3 py-2 cursor-pointer font-semibold text-gray-700">Liste des {r.toCreate.length} équipement(s) nouveau(x)</summary>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {r.toCreate.map(n => (
                          <tr key={n.code} className="border-t border-gray-100">
                            <td className="px-3 py-1.5 font-mono">{n.code}</td>
                            <td className="px-3 py-1.5 text-gray-700">{n.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}

              <div className="text-xs text-gray-500">
                L'écriture en base sera ajoutée à l'étape B, après validation de cet aperçu.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
