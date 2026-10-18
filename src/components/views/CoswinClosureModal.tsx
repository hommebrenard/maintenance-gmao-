import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, CheckCircle2, FileSpreadsheet, AlertTriangle, XCircle, Undo2 } from 'lucide-react';
import { analyzeClosureRows, type ClosureReport } from '../../utils/coswinClosure';
import type { ClosureResult } from '../../lib/queries/coswinClosure';
import type { WorkOrder } from '../../types';

interface Props {
  workOrders: WorkOrder[];
  onClose: () => void;
  /** apply = false → aperçu sans écriture ; apply = true → clôture + historique du lot. */
  onCloseOrders: (items: ClosureReport['items'], lot: string, apply: boolean) => Promise<ClosureResult>;
  onRevert: (lot: string) => Promise<{ lot: string; rouverts: number }>;
}

const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: 'ok' | 'warn' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => (
  <div className={`rounded-lg border px-3 py-2 ${tone === 'ok' ? 'border-green-200 bg-green-50' : tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
    <div className="text-[11px] uppercase font-semibold text-gray-500">{label}</div>
    <div className="text-lg font-bold text-gray-900">{value}</div>
  </div>
);

const newLot = () => `cloture-coswin-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;
const fr = (iso: string) => iso.split('-').reverse().join('/');

/** Clôture des OT à l'état « T » dans Coswin : aperçu chiffré obligatoire, sauvegarde JSON, application atomique, contrôle, retour arrière. */
export const CoswinClosureModal: React.FC<Props> = ({ workOrders, onClose, onCloseOrders, onRevert }) => {
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<ClosureReport | null>(null);
  const [preview, setPreview] = useState<ClosureResult | null>(null);
  const [done, setDone] = useState<{ lot: string; applied: ClosureResult; remaining: number } | null>(null);
  const [reverted, setReverted] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setError(''); setReport(null); setPreview(null); setDone(null); setReverted(null); setFileName(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true });
      if (raw.length === 0) { setError('Le fichier ne contient aucune ligne.'); return; }
      const r = analyzeClosureRows(raw);
      setReport(r);
      if (r.missingHeaders.length > 0 || r.items.length === 0) return;
      setBusy(true);
      setPreview(await onCloseOrders(r.items, newLot(), false));
    } catch (e) {
      console.error(e);
      setError("Fichier illisible ou aperçu impossible (droits ou connexion). Aucune donnée n'a été modifiée.");
    } finally { setBusy(false); }
  };

  const apply = async () => {
    if (!report || !preview) return;
    setBusy(true); setError('');
    try {
      const codes = new Set(report.items.map(i => i.code));
      const blob = new Blob([JSON.stringify(workOrders.filter(w => codes.has(w.code)), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `ot-avant-cloture-coswin-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);

      const lot = newLot();
      const applied = await onCloseOrders(report.items, lot, true);
      const control = await onCloseOrders(report.items, `${lot}-controle`, false);
      setDone({ lot, applied, remaining: control.a_cloturer });
    } catch (e) {
      console.error(e);
      setError("La clôture a échoué : la transaction est annulée, aucun OT n'a été modifié. Tu peux relancer.");
    } finally { setBusy(false); }
  };

  const revert = async () => {
    if (!done || !window.confirm(`Rouvrir les ${done.applied.clotures} OT clôturés par ce lot ?`)) return;
    setBusy(true); setError('');
    try { setReverted((await onRevert(done.lot)).rouverts); }
    catch (e) { console.error(e); setError("Le retour arrière a échoué : aucun changement. Tu peux relancer."); }
    finally { setBusy(false); }
  };

  const blocked = !!report && report.missingHeaders.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-gray-900">Clôturer les OT terminés dans Coswin</h3>
          <button onClick={onClose} aria-label="Fermer" className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-600">
            Passe à <b>Terminé</b> les OT présents dans l'export Coswin à l'état <b>« T »</b>, avec la <b>date de fin déclarée dans Coswin</b> comme date de clôture (c'est une date déclarée, pas une preuve d'exécution).
            Ces OT portent le badge <b>« Clôturé dans Coswin — sans checklist ni visa »</b> ; leur checklist reste renseignable. Seuls les OT « Ouvert » sont clôturés : les OT à un autre état dans Coswin
            (ex. « A »), déjà terminés, annulés, « En cours » ou « En attente » dans l'app ne sont pas modifiés. Un aperçu chiffré est affiché avant toute écriture.
          </p>

          <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400">
            <FileSpreadsheet className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-700">{fileName || "Choisir l'export des OT de Coswin (.xlsx, .xls ou .csv)"}</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </label>

          {error && <div className="flex gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3"><XCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}
          {busy && !done && <p className="text-sm text-gray-500">Traitement en cours…</p>}

          {report && blocked && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              En-têtes obligatoires introuvables : <b>{report.missingHeaders.join(', ')}</b>. Vérifie que c'est bien l'export des ordres de travail de Coswin.
            </div>
          )}

          {report && !blocked && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Lignes du fichier" value={report.totalRows} />
                <Stat label="À l'état « T »" value={report.items.length} tone="ok" />
                <Stat label="Autres états (restent ouverts)" value={report.otherStates.reduce((n, s) => n + s.count, 0)} tone={report.otherStates.length ? 'warn' : 'neutral'} />
                <Stat label="Non retenues (date / N° invalide)" value={report.withoutEndDate.length + report.suspectDates.length + report.invalid} tone={report.withoutEndDate.length + report.suspectDates.length + report.invalid ? 'warn' : 'neutral'} />
              </div>
              {report.otherStates.map(s => (
                <p key={s.state} className="text-xs text-amber-700">État « {s.state} » : {s.count} OT laissé(s) ouvert(s) ({s.codes.slice(0, 8).join(', ')}{s.codes.length > 8 ? '…' : ''}).</p>
              ))}
              {report.suspectDates.length > 0 && <p className="text-xs text-amber-700">{report.suspectDates.length} OT « T » avec une date de fin avant le début ou dans le futur : non clôturés ({report.suspectDates.slice(0, 8).join(', ')}).</p>}
              {report.withoutEndDate.length > 0 && <p className="text-xs text-amber-700">{report.withoutEndDate.length} OT « T » sans date de fin lisible : non clôturés ({report.withoutEndDate.slice(0, 8).join(', ')}).</p>}
            </>
          )}

          {preview && !done && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="OT qui seraient clôturés" value={preview.a_cloturer} tone={preview.a_cloturer ? 'ok' : 'neutral'} />
                <Stat label="Déjà terminés" value={preview.deja_termines} />
                <Stat label="Annulés (ignorés)" value={preview.annules_ignores} />
                <Stat label="Introuvables dans l'app" value={preview.introuvables} tone={preview.introuvables ? 'warn' : 'neutral'} />
              </div>
              {preview.a_decider > 0 && (
                <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 flex gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{preview.a_decider} OT « T » dans Coswin sont « En cours » ou « En attente » dans l'application (ex. {preview.a_decider_100_premiers.slice(0, 6).map(d => d.code).join(', ')}). Ils ne sont <b>pas</b> clôturés : décision métier à prendre.</span>
                </div>
              )}
              {preview.introuvables > 0 && (
                <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 flex gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{preview.introuvables} OT du fichier n'existent pas dans l'application (ex. {preview.introuvables_100_premiers.slice(0, 6).join(', ')}). Ils ne sont pas créés ici : importez d'abord le planning.</span>
                </div>
              )}
              {preview.a_cloturer === 0 ? (
                <div className="text-sm bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />Rien à clôturer : les OT du fichier sont déjà à jour.
                </div>
              ) : (
                <details className="text-sm border border-gray-200 rounded-lg p-3">
                  <summary className="cursor-pointer font-semibold text-gray-700">Détail ({Math.min(preview.detail_300_premiers.length, 300)} premiers sur {preview.a_cloturer})</summary>
                  <div className="mt-2 max-h-72 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left text-gray-500"><tr><th className="pr-2">OT</th><th className="pr-2">Statut actuel</th><th>Date de clôture (Coswin)</th></tr></thead>
                      <tbody>
                        {preview.detail_300_premiers.map(d => (
                          <tr key={d.code} className="border-t border-gray-100"><td className="pr-2 font-mono">{d.code}</td><td className="pr-2 text-gray-500">{d.status}</td><td className="text-gray-900">{fr(d.closed_on)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </>
          )}

          {done && reverted === null && (
            <div className="text-sm bg-green-50 border border-green-200 rounded-lg p-3 text-green-800">
              <div className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="w-4 h-4" />Clôture terminée</div>
              <p className="mt-1">
                {done.applied.clotures} OT clôturé(s) avec la date de Coswin.
                {done.remaining === 0 ? ' Contrôle : 0 OT restant à clôturer pour ce fichier.' : ` Contrôle : ${done.remaining} OT restant(s) à clôturer, à vérifier.`}
              </p>
              <p className="mt-1 text-xs">Numéro de lot (retour arrière) : <span className="font-mono">{done.lot}</span>. La sauvegarde JSON a été téléchargée.</p>
              <button onClick={revert} disabled={busy} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:underline disabled:opacity-40">
                <Undo2 className="w-3.5 h-3.5" />Annuler ce lot (rouvrir ces OT)
              </button>
            </div>
          )}
          {reverted !== null && (
            <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">{reverted} OT rouvert(s) : le lot est annulé. Recharge la page pour voir les statuts d'origine.</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{done ? 'Fermer' : 'Annuler'}</button>
          {!done && (
            <button onClick={apply} disabled={!preview || preview.a_cloturer === 0 || busy}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
              <CheckCircle2 className="w-4 h-4" /><span>{busy ? 'En cours…' : `Clôturer ${preview?.a_cloturer ?? 0} OT`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
