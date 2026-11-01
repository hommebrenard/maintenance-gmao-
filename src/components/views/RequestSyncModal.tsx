import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { X, RefreshCw, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Lock, Unlock, Download } from 'lucide-react';
import { analyzeRequestRows, toSyncPayload, type ImportContext, type ImportReport } from '../../utils/importRequests';
import { reviewSyncRows, excludeHeld, type ReviewResult, type ReviewItem, type ReviewFileRow, type ReviewRequest, type LockLite } from '../../utils/requestSyncReview';
import { EXCEL_ACCEPT, isExcelFileName, NOT_EXCEL_MESSAGE } from '../../utils/excelFileGuard';
import { buildGapRows, gapRowsToCsv } from '../../utils/requestSyncGapExport';
import { decisionsFromTrace, evaluateAcceptProof, type ProofStatus } from '../../utils/requestSyncDecisions';
import {
  fetchEquipmentOverrides, fetchEquipmentDecisions, keepEquipment, acceptEquipment, releaseOverride, fetchSyncProof,
  type SyncResult, type EquipmentDecisionResult,
} from '../../lib/queries/maintenanceRequests';
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

const newReviewId = () => `rev-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;

const STATE_LABEL: Record<ReviewItem['state'], string> = {
  conforme: 'Conforme', hors_perimetre: 'Hors périmètre', reaffectation_meme_site: 'Équipement changé (même site)',
  nouveau_conflit: 'Conflit : retirée du lot', anomalie_equipement: 'Anomalie de code équipement',
  verrou_stable: 'Verrouillée (Coswin inchangé)', verrou_aligne: 'Verrouillée, Coswin d\'accord : verrou libérable', verrou_change_coswin: 'Verrouillée, Coswin a changé',
};
const REASON_LABEL: Record<string, string> = {
  site_absent: 'zone absente', site_inconnu: 'site non reconnu', site_ambigu: 'site ambigu', hors_site: 'équipement d\'un autre site', incoherent: 'description incohérente',
};
const RESULT_MESSAGES: Record<string, string> = {
  di_introuvable: 'DI introuvable en base.',
  equipement_introuvable: 'Équipement introuvable.',
  verrou_different: 'Un verrou existe déjà sur un autre équipement : rechargez le fichier.',
  changement_concurrent: 'La DI ou son verrou a changé depuis l\'aperçu : rechargez le fichier. Rien n\'a été modifié.',
  verrou_existant: 'Un verrou existe déjà : libérez-le d\'abord.',
  code_ambigu: 'Le code du nouvel équipement désigne plusieurs équipements : décision refusée.',
  verrou_absent: 'Il n\'y a plus de verrou sur cette DI : rechargez le fichier.',
};
type SyncRow = Record<string, string | null>;
const withoutHeld = (rows: SyncRow[], rv: ReviewResult): SyncRow[] => excludeHeld(rows as { code: string | null }[], rv) as SyncRow[];
const OK_RESULTS = ['verrou_cree', 'deja_verrouillee', 'decision_enregistree', 'verrou_libere'];

/** Verrous et décisions lus en base, puis revue DI par DI (les décisions « accepter » encore valables font repartir la DI dans le lot). */
async function buildReview(rows: ReviewFileRow[], context: ImportContext, requests: MaintenanceRequest[]): Promise<ReviewResult> {
  const [locks, trace] = await Promise.all([fetchEquipmentOverrides(), fetchEquipmentDecisions()]);
  const lockMap = new Map<string, LockLite>(locks.map(l => [l.diCode, { equipmentId: l.equipmentId, equipmentCode: l.equipmentCode }]));
  const equipment = context.equipmentList ?? [];
  const ctx = { locationIdByCode: context.locationIdByCode, locationIdByKey: context.locationIdByKey, ambiguousSiteKeys: context.ambiguousSiteKeys };
  const reqs: ReviewRequest[] = requests.map(r => ({ code: r.code, title: r.title, origin: r.origin, equipmentId: r.equipmentId, equipmentCode: r.equipmentCode }));
  const first = reviewSyncRows(rows, reqs, equipment, lockMap, ctx);
  const dec = decisionsFromTrace(first.items, trace);
  return Object.keys(dec).length > 0 ? reviewSyncRows(rows, reqs, equipment, lockMap, ctx, dec) : first;
}

const newBatchId = () => `sync-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;

/** Synchronisation des DI Coswin DÉJÀ présentes : aperçu chiffré obligatoire, sauvegarde JSON, application atomique, contrôle final. */
export const RequestSyncModal: React.FC<Props> = ({ context, requests, onClose, onSync }) => {
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [payload, setPayload] = useState<Record<string, string | null>[]>([]);
  const [newInFile, setNewInFile] = useState(0);
  const [preview, setPreview] = useState<SyncResult | null>(null);
  const [done, setDone] = useState<{ batch: string; applied: SyncResult; remaining: number; held: number } | null>(null);
  const [fileRows, setFileRows] = useState<ReviewFileRow[]>([]);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [reviewId, setReviewId] = useState('');
  const [filter, setFilter] = useState<'traiter' | 'reaffectations' | 'verrous' | 'tout'>('traiter');
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [proofs, setProofs] = useState<Record<string, { item: ReviewItem; status: ProofStatus }>>({});
  const [manualOk, setManualOk] = useState<Set<string>>(new Set());
  const sendPayload = useMemo(() => (review ? withoutHeld(payload, review) : payload), [payload, review]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setError(''); setReport(null); setPreview(null); setDone(null); setPayload([]); setReview(null); setFileRows([]); setActionMsg(null); setProofs({}); setFileName(file.name);
    if (!isExcelFileName(file.name)) { setError(NOT_EXCEL_MESSAGE); return; }
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
      const rows: ReviewFileRow[] = a.existingRows.map(r => ({ code: r.code, title: r.title, site_code: r.site_code, equipment_code: r.equipment_code, planned_equipment_code: r.planned_equipment_code }));
      setFileRows(rows); setReviewId(newReviewId());
      const rv = await buildReview(rows, context, requests);
      setReview(rv);
      const send = withoutHeld(p, rv);
      if (send.length > 0) setPreview(await onSync(send, newBatchId(), false));
    } catch (e) {
      console.error(e);
      if (e instanceof Error && /revue impossible/.test(e.message)) { setError(`${e.message} Aucune donnée n'a été modifiée.`); return; }
      setError("Fichier illisible ou aperçu impossible (droits ou connexion). Aucune donnée n'a été modifiée.");
    } finally { setBusy(false); }
  };

  /** Relit verrous et décisions, refait la revue, puis l'aperçu chiffré du lot (sans les DI retirées). */
  const refresh = async () => {
    const rv = await buildReview(fileRows, context, requests);
    setReview(rv);
    const send = withoutHeld(payload, rv);
    setPreview(send.length > 0 ? await onSync(send, newBatchId(), false) : null);
  };

  const runDecision = async (code: string, confirmText: string, call: () => Promise<EquipmentDecisionResult>, okText: string) => {
    if (busy || !window.confirm(confirmText)) return;
    setBusy(true); setActionMsg(null);
    try {
      const res = await call();
      if (!OK_RESULTS.includes(res.resultat)) { setActionMsg({ ok: false, text: `${code} : ${RESULT_MESSAGES[res.resultat] ?? res.resultat}` }); return; }
      try { await refresh(); setActionMsg({ ok: true, text: `${code} : ${okText}` }); }
      catch (e) { console.error(e); setActionMsg({ ok: false, text: `${code} : décision enregistrée, mais l'aperçu n'a pas pu être actualisé. Rechargez le fichier avant d'appliquer.` }); }
    } catch (e) {
      console.error(e);
      setActionMsg({ ok: false, text: `${code} : action refusée ou impossible (droits, connexion). Rien n'a été modifié.` });
    } finally { setBusy(false); }
  };

  /** Export CSV des écarts (DI verrouillées dont Coswin diffère) pour l'administrateur Coswin : lecture seule, aucune écriture. */
  const exportGaps = () => {
    if (!review) return;
    const rows = buildGapRows(review.items, fileRows);
    const blob = new Blob([gapRowsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ecarts-di-coswin-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const apply = async () => {
    if (!preview || sendPayload.length === 0) return;
    setBusy(true); setError('');
    try {
      // Sauvegarde : état actuel des DI concernées, téléchargé AVANT toute écriture.
      const codes = new Set(sendPayload.map(p => p.code));
      const blob = new Blob([JSON.stringify(requests.filter(r => r.code && codes.has(r.code)), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `di-avant-synchro-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);

      const batch = newBatchId();
      const applied = await onSync(sendPayload, batch, true);
      const control = await onSync(sendPayload, `${batch}-controle`, false);
      setDone({ batch, applied, remaining: control.champs_modifies, held: review?.notSynced ?? 0 });
      // Preuve des décisions « accepter » : jamais « appliquée » sans ligne d'historique du lot et équipement actuel relu.
      const accepted = (review?.items ?? []).filter(i => i.decision === 'accepter' && !i.held);
      const pr: Record<string, { item: ReviewItem; status: ProofStatus }> = {};
      if (accepted.length > 0) {
        let map: Awaited<ReturnType<typeof fetchSyncProof>> | null = null;
        try { map = await fetchSyncProof(accepted.map(i => i.code), batch); } catch (e) { console.error(e); }
        for (const i of accepted) pr[i.code] = { item: i, status: evaluateAcceptProof(i, map?.get(i.code)) };
      }
      setProofs(pr); setManualOk(new Set());
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
            <span className="text-sm text-gray-700">{fileName || 'Choisir le fichier Coswin récent (.xlsx ou .xls)'}</span>
            <input type="file" accept={EXCEL_ACCEPT} className="hidden" disabled={busy}
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

          {review && !done && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Non synchronisées (retirées du lot)" value={review.notSynced} tone={review.notSynced ? 'warn' : 'neutral'} />
                <Stat label="Anomalies de code équipement" value={review.anomalies} tone={review.anomalies ? 'warn' : 'neutral'} />
                <Stat label="Équipement changé (même site)" value={review.counts.reaffectation_meme_site} />
                <Stat label="DI conformes" value={review.counts.conforme} tone="ok" />
              </div>
              {review.notSynced > 0 && (
                <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 flex gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span><b>{review.notSynced} DI retirée(s) du lot</b> tant qu'aucune décision n'est prise : leurs mises à jour d'état et d'OT sont <b>aussi différées</b>. Les anomalies de code restent dans le lot (leur équipement n'est pas modifié).</span>
                </div>
              )}
              {(() => {
                const gaps = review.counts.verrou_stable + review.counts.verrou_change_coswin;
                return (
                  <div className="flex items-center gap-3 text-sm">
                    <button onClick={exportGaps} disabled={gaps === 0 || busy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                      <Download className="w-4 h-4" />Exporter les écarts pour Coswin (CSV)
                    </button>
                    <span className="text-gray-500">{gaps} DI verrouillée(s) dont Coswin diffère de l'équipement réel</span>
                  </div>
                );
              })()}
              <div className="flex items-center gap-2 text-sm">
                <label htmlFor="sync-filter" className="text-gray-600">Afficher :</label>
                <select id="sync-filter" value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                  <option value="traiter">À traiter (conflits, anomalies, verrous libérables)</option>
                  <option value="reaffectations">Équipements changés (même site)</option>
                  <option value="verrous">Verrous</option>
                  <option value="tout">Tout (hors conformes)</option>
                </select>
              </div>
              {actionMsg && (
                <div className={`text-sm rounded-lg p-3 border ${actionMsg.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>{actionMsg.text}</div>
              )}
              {(() => {
                const visible = review.items.filter(i => filter === 'tout' ? (i.state !== 'conforme' && i.state !== 'hors_perimetre')
                  : filter === 'reaffectations' ? i.state === 'reaffectation_meme_site'
                  : filter === 'verrous' ? i.state.startsWith('verrou')
                  : (i.state === 'nouveau_conflit' || i.state === 'anomalie_equipement' || i.state === 'verrou_aligne' || !!i.codeProblem));
                if (visible.length === 0) return <p className="text-sm text-gray-500">Aucune DI dans cette catégorie.</p>;
                return (
                  <div className="max-h-80 overflow-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="text-left text-gray-500 sticky top-0 bg-white"><tr><th className="p-2">DI</th><th className="p-2">Revue</th><th className="p-2">Équipement actuel → visé par Coswin</th><th className="p-2">Action</th></tr></thead>
                      <tbody>
                        {visible.slice(0, 200).map(i => (
                          <tr key={i.code} className="border-t border-gray-100 align-top">
                            <td className="p-2"><div className="font-mono">{i.code}</div><div className="text-gray-500 max-w-[14rem] truncate" title={i.title}>{i.title}</div></td>
                            <td className="p-2">
                              <div className="font-semibold text-gray-800">{i.state === 'nouveau_conflit' && !i.held ? 'Décision enregistrée, lot non appliqué' : STATE_LABEL[i.state]}</div>
                              {i.reason && <div className="text-amber-700">{REASON_LABEL[i.reason] ?? i.reason}</div>}
                              {i.codeProblem && <div className="text-amber-700">code équipement {i.codeProblem === 'ambigu' ? 'ambigu' : 'introuvable'}</div>}
                              {i.powerNote && <div className="text-amber-700">{i.powerNote}</div>}
                            </td>
                            <td className="p-2 font-mono">{i.oldEquipment?.code ?? '—'} → {i.newEquipment?.code ?? '—'}</td>
                            <td className="p-2">
                              {i.state === 'nouveau_conflit' && i.held && i.oldEquipment && i.newEquipment && (
                                <div className="flex flex-col gap-1">
                                  <button disabled={busy} className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                                    onClick={() => runDecision(i.code, `Garder l'équipement actuel (${i.oldEquipment!.code}) pour ${i.code} ? Un verrou sera créé : les prochaines synchronisations ne changeront plus son équipement.`,
                                      () => keepEquipment(i.code, i.oldEquipment!.id, reviewId), 'verrou créé, la DI repart dans le lot.')}>Garder l'équipement actuel</button>
                                  <button disabled={busy} className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                                    onClick={() => runDecision(i.code, `Accepter le nouvel équipement (${i.newEquipment!.code}) pour ${i.code} ? La synchronisation changera son équipement.`,
                                      () => acceptEquipment(i.code, i.oldEquipment!.id, i.newEquipment!.id, reviewId), 'décision enregistrée, la DI repart dans le lot.')}>Accepter le nouvel équipement</button>
                                </div>
                              )}
                              {i.state === 'verrou_aligne' && i.oldEquipment && (
                                <button disabled={busy} className="flex items-center gap-1 px-2 py-1 rounded border border-sky-300 text-sky-800 hover:bg-sky-50 disabled:opacity-40"
                                  onClick={() => runDecision(i.code, `Libérer le verrou de ${i.code} (${i.oldEquipment!.code}) ? Coswin donne maintenant le même équipement.`,
                                    () => releaseOverride(i.code, i.oldEquipment!.id, reviewId), 'verrou libéré.')}><Unlock className="w-3 h-3" />Libérer le verrou</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {visible.length > 200 && <p className="p-2 text-xs text-gray-500">200 premières lignes affichées sur {visible.length}.</p>}
                  </div>
                );
              })()}
            </div>
          )}

          {review && !done && payload.length > 0 && sendPayload.length === 0 && (
            <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">Toutes les DI présentes sont retirées du lot : rien à appliquer tant qu'aucune décision n'est prise.</div>
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
              {done.held > 0 && <p className="mt-1 text-xs text-amber-800">{done.held} DI sont restées hors du lot (conflits sans décision) : leurs mises à jour d'état et d'OT sont différées.</p>}
              {Object.keys(proofs).length > 0 && (
                <div className="mt-2 text-xs space-y-1">
                  <div className="font-semibold">Décisions « accepter » : vérification</div>
                  {Object.values(proofs).map(({ item, status }) => (
                    <div key={item.code} className="flex items-center gap-2">
                      <span className="font-mono">{item.code}</span>
                      {status === 'prouvee' || manualOk.has(item.code)
                        ? <span>{status === 'prouvee' ? `DI modifiée par une synchronisation postérieure : lot ${done.batch}` : 'Vérifiée manuellement'}</span>
                        : <>
                            <span className="text-amber-800">résultat indéterminé, vérification requise</span>
                            <button className="px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-50"
                              onClick={() => setManualOk(s => new Set(s).add(item.code))}>J'ai vérifié à l'écran</button>
                          </>}
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs">Rechargez la page pour afficher les changements dans la liste des demandes.</p>
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
