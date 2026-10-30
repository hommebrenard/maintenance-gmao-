import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { analyzeRequestRows, type ImportContext, type ImportReport, type RequestInsertRow } from '../../utils/importRequests';
import { checkRequestRows, applyDecisions, pendingIssues, type CheckResult, type EquipmentDecision, type RequestIssue, SITE_ISSUES } from '../../utils/requestEquipmentCheck';

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
  const [result, setResult] = useState<{ inserted: number; expected: number; relinked: number; skipped: number } | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  /** Décision explicite par N° de DI (absente = pas encore décidé : l'import reste bloqué). */
  const [decisions, setDecisions] = useState<Record<string, EquipmentDecision>>({});
  const [ackUnknown, setAckUnknown] = useState(false);

  const handleFile = async (file: File) => {
    setError(''); setAnalysis(null); setResult(null); setCheck(null); setDecisions({}); setAckUnknown(false); setFileName(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true });
      if (raw.length === 0) { setError('Le fichier ne contient aucune ligne.'); return; }
      const a = analyzeRequestRows(raw, context);
      setAnalysis(a);
      setCheck(checkRequestRows(a.rows, context));
    } catch (e) {
      console.error(e);
      setError("Fichier illisible. Utilise l'export Excel ou CSV des demandes d'intervention de Coswin.");
    }
  };

  const run = async () => {
    if (!analysis) return;
    setBusy(true); setError('');
    try {
      // Applique les décisions explicites : seul le lien `equipment_id` peut changer, jamais les codes d'origine de Coswin.
      const applied = applyDecisions(analysis.rows, check?.issues ?? [], decisions, equipmentList);
      const rows = applied.rows;
      const inserted = await onImport(rows);
      setResult({ inserted, expected: rows.length, relinked: applied.relinked, skipped: applied.skipped });
    } catch (e) {
      console.error(e);
      setError("L'import a échoué (droits ou connexion). Aucune demande existante n'a été modifiée ; tu peux relancer sans risque de doublon.");
    } finally { setBusy(false); }
  };

  const r = analysis?.report;
  const blocked = !!r && r.missingHeaders.length > 0;
  const equipmentList = context.equipmentList ?? [];
  const issues = check?.issues ?? [];
  const undecided = pendingIssues(issues, decisions, equipmentList).length + (check && check.unknownEquipmentRows > 0 && !ackUnknown ? 1 : 0);

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
              {r.equipmentSourceDiffersPlanned > 0 && (
                <p className="text-xs text-amber-700">{r.equipmentSourceDiffersPlanned} DI avec équipement source ≠ planifié : l'équipement planifié est retenu (erreur probable de saisie du source dans Coswin).</p>
              )}
              <p className="text-xs text-gray-500">
                « À rapprocher » : le code est conservé sur la demande et reste visible ; le rattachement se fera quand l'équipement ou le site existera dans l'application.
              </p>

              {check && (issues.length > 0 || check.unknownEquipmentRows > 0) && (
                <div className="text-sm bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-3">
                  <div className="font-semibold text-amber-900 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />Contrôle site et équipement avant l'import</div>
                  <p className="text-xs text-amber-900">
                    Acceptées sans contrôle : <b>{check.accepted}</b> · site non reconnu : <b>{issues.filter(i => SITE_ISSUES.includes(i.kind)).length}</b> ·
                    équipement d'un autre site : <b>{issues.filter(i => i.kind === 'hors_site').length}</b> · description incohérente : <b>{issues.filter(i => i.kind === 'incoherent').length}</b> ·
                    sans équipement rattaché : <b>{check.unknownEquipmentRows}</b>. Rien n'est modifié sans ton choix ; les codes Coswin restent tels quels, seul le lien du carnet de santé change.
                  </p>
                  {issues.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button type="button" onClick={() => setDecisions(Object.fromEntries(issues.map(i => [i.requestCode, { kind: 'keep' } as EquipmentDecision])))} className="px-2 py-1 bg-white border border-amber-300 rounded hover:bg-amber-100">Garder Coswin / importer quand même pour toutes</button>
                      <button type="button" onClick={() => setDecisions(d => ({ ...d, ...Object.fromEntries(issues.filter(i => i.suggestions[0]).map(i => [i.requestCode, { kind: 'use', equipmentId: i.suggestions[0].id } as EquipmentDecision])) }))} className="px-2 py-1 bg-white border border-amber-300 rounded hover:bg-amber-100">Appliquer la 1re proposition là où elle existe</button>
                    </div>
                  )}
                  <ul className="space-y-2">
                    {issues.map(i => <IssueRow key={i.requestCode} issue={i} decision={decisions[i.requestCode]} equipment={equipmentList} onChange={d => setDecisions(x => ({ ...x, [i.requestCode]: d }))} />)}
                  </ul>
                  {check.unknownEquipmentRows > 0 && (
                    <label className="flex items-start gap-2 text-xs text-amber-900 bg-white border border-amber-200 rounded-lg p-2">
                      <input type="checkbox" checked={ackUnknown} onChange={e => setAckUnknown(e.target.checked)} className="mt-0.5" />
                      <span>J'ai pris connaissance de <b>{check.unknownEquipmentRows}</b> DI dont l'équipement Coswin n'existe pas dans l'application : elles seront importées sans équipement rattaché ({check.unknownEquipmentCodes.slice(0, 6).join(', ')}{check.unknownEquipmentCodes.length > 6 ? '…' : ''}).</span>
                    </label>
                  )}
                  {undecided > 0 && <p className="text-xs font-semibold text-amber-900">{undecided} décision(s) ou confirmation(s) manquante(s) : l'import reste bloqué.</p>}
                </div>
              )}
              {check && check.powerWarnings.length > 0 && (
                <div className="text-xs bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-900">
                  <div className="font-semibold mb-1">Puissance différente entre la DI et l'équipement ({check.powerWarnings.length}) : à corriger dans Coswin, sans blocage</div>
                  <ul className="list-disc pl-4 space-y-0.5">{check.powerWarnings.slice(0, 10).map(w => <li key={w.requestCode}><b>{w.requestCode}</b> ({w.equipmentCode}) : {w.note}</li>)}</ul>
                </div>
              )}

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
                {result.relinked > 0 && ` ${result.relinked} DI rattachée(s) à l'équipement que tu as choisi (codes Coswin conservés).`}{result.skipped > 0 && ` ${result.skipped} DI non importée(s) sur ta décision.`}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{result ? 'Fermer' : 'Annuler'}</button>
          {!result && (
            <button onClick={run} disabled={!r || blocked || r.newCount === 0 || busy || undecided > 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
              <Upload className="w-4 h-4" /><span>{busy ? 'Import en cours…' : `Importer ${r?.newCount ?? 0} demande(s)`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const KIND_LABEL: Record<RequestIssue['kind'], string> = {
  site_absent: 'Zone absente dans Coswin', site_inconnu: 'Site non reconnu dans l\'application', site_ambigu: 'Zone ambiguë (plusieurs sites possibles)',
  hors_site: 'Équipement d\'un autre site', incoherent: 'Description incohérente avec l\'équipement',
};

function IssueRow({ issue, decision, equipment, onChange }: { issue: RequestIssue; decision: EquipmentDecision | undefined; equipment: { id: string; code: string; name: string; locationId?: string }[]; onChange: (d: EquipmentDecision) => void }) {
  const isSite = SITE_ISSUES.includes(issue.kind);
  const value = !decision ? '' : decision.kind === 'use' ? `eq:${decision.equipmentId}` : decision.kind;
  const siteEquipment = isSite || !issue.siteId ? [] : equipment.filter(e => e.locationId === issue.siteId).sort((a, b) => a.code.localeCompare(b.code));
  const set = (v: string) => onChange(v === 'keep' ? { kind: 'keep' } : v === 'skip' ? { kind: 'skip' } : { kind: 'use', equipmentId: v.slice(3) });
  return (
    <li className="bg-white border border-amber-200 rounded-lg p-2 text-xs">
      <div><b>{issue.requestCode}</b> — {issue.title}</div>
      <div className="text-amber-800 font-semibold mt-0.5">{KIND_LABEL[issue.kind]}{issue.zoneCode ? ` (Zone Coswin : ${issue.zoneCode})` : ''}</div>
      {issue.assigned && <div className="text-gray-600 mt-0.5">Équipement Coswin : <span className="font-mono">{issue.assigned.code}</span> ({issue.assigned.name})</div>}
      {issue.powerNote && <div className="text-amber-800 mt-0.5">{issue.powerNote}</div>}
      <select value={value} onChange={e => e.target.value && set(e.target.value)}
        className={`mt-1 w-full px-2 py-1 border rounded ${value ? 'border-gray-300' : 'border-amber-400 bg-amber-50'}`}>
        <option value="">Choisir…</option>
        <option value="keep">{isSite ? 'Importer quand même (site non rattaché)' : `Garder Coswin${issue.assigned ? ` : ${issue.assigned.code}` : ''}`}</option>
        {issue.suggestions.length > 0 && <optgroup label="Propositions du site">{issue.suggestions.map(s => <option key={s.id} value={`eq:${s.id}`}>Utiliser : {s.code} — {s.name}</option>)}</optgroup>}
        {siteEquipment.length > 0 && <optgroup label="Tous les équipements du site">{siteEquipment.map(e => <option key={e.id} value={`eq:${e.id}`}>{e.code} — {e.name}</option>)}</optgroup>}
        <option value="skip">Ne pas importer cette DI</option>
      </select>
    </li>
  );
}
