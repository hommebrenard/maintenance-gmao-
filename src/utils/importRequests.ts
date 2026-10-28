import type { Equipment, LocationItem, MaintenanceRequest, WorkOrder } from '../types';
import { equipmentCompareKey } from './coswinEquipmentImport';

/**
 * Import des demandes d'intervention (DI) exportées de Coswin. Règle « option B » : l'import n'AJOUTE que les
 * N° de DI absents de la base, il n'écrase jamais une demande existante (l'application fait foi après l'import initial).
 * Fonctions pures et testées ; l'écriture en base est dans lib/queries/maintenanceRequests.ts.
 */

export type StatusRow = 'en_attente' | 'approuvee' | 'rejetee';
export type PriorityRow = 'basse' | 'moyenne' | 'haute' | 'urgente';

type Field =
  | 'code' | 'title' | 'state' | 'requester' | 'interventionType' | 'qseType' | 'daf' | 'declaredAt' | 'dueDate'
  | 'plannedEquipment' | 'priority' | 'otNumber' | 'otState' | 'otStateLabel' | 'functionLabel' | 'functionCode'
  | 'supervisor' | 'costCenter' | 'plannedStart' | 'otEndDate' | 'coswinCreatedAt' | 'visa' | 'equipment'
  | 'interventionCode' | 'site';

/** Les 25 en-têtes du fichier Coswin → champ interne. */
export const COSWIN_HEADERS: [string, Field][] = [
  ['N° de DI', 'code'], ["Description de la demande d'intervention", 'title'], ['État', 'state'],
  ['Demandeur', 'requester'], ["Type d'intervention", 'interventionType'], ['QSE -type', 'qseType'],
  ['N° DAF', 'daf'], ['Date de déclaration', 'declaredAt'], ['Date de fin prévue', 'dueDate'],
  ['Éqpt / grp planifié', 'plannedEquipment'], ['Priorité', 'priority'], ["N° d'OT", 'otNumber'],
  ['État OT', 'otState'], ["Description de l'état OT", 'otStateLabel'], ['Description de la fonction', 'functionLabel'],
  ['Fonction', 'functionCode'], ['Superviseur', 'supervisor'], ['Centre de charges', 'costCenter'],
  ['Date de début prévue', 'plannedStart'], ['Date de fin', 'otEndDate'], ['Date de création', 'coswinCreatedAt'],
  ['Visa', 'visa'], ['Équipement source', 'equipment'], ['Intervention', 'interventionCode'], ['Zone', 'site'],
];
const REQUIRED: Field[] = ['code', 'title', 'state'];

/** États Coswin connus (numéro avant le point) → statut de l'application. À compléter avec la liste complète. */
export const COSWIN_STATE_MAP: Record<string, StatusRow> = {
  '0': 'en_attente', '1': 'en_attente', '14': 'en_attente', // Créée, Révisée, Waiting : pas encore traitées
  '3': 'approuvee', '17': 'approuvee', // OT créé ; Clôturée sans OT (affichée « Clôturée » via coswin_state)
  '5': 'rejetee', // Annulée (affichée « DI annulée » grâce à coswin_state)
  '8': 'approuvee', // Signed off : sens non documenté ; seule DI connue = OT terminé (affichée selon l'OT, état Coswin conservé)
};

/** Priorités Coswin → priorités de l'application (U0 = urgent confirmé par l'écran Coswin ; U1 à U3 : hypothèse). */
export const COSWIN_PRIORITY_MAP: Record<string, PriorityRow> = { U0: 'urgente', U1: 'haute', U2: 'moyenne', U3: 'basse' };

/** Heure murale Coswin enregistrée telle quelle (sans conversion de fuseau) : stockée comme UTC, affichée avec timeZone UTC. */
const LOCAL_OFFSET = '+00:00';
/** Écart (jours) entre déclaration et création au-delà duquel on suspecte une année erronée. */
const MAX_DECL_GAP_DAYS = 180;

export const norm = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const HEADER_BY_NORM = new Map<string, Field>(COSWIN_HEADERS.map(([h, f]) => [norm(h), f]));

const str = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (v instanceof Date) return '';
  return String(v).trim();
};

export interface DateParts { y: number; m: number; d: number; hh: number; mm: number; hasTime: boolean }
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** Date Excel (numéro de série), texte « 05/01/2026 16:39 » ou « 2026-01-05 16:39 » → composantes (sans fuseau). */
export function parseCoswinDate(v: unknown): DateParts | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const ms = Math.round(v * 1440) * 60000;
    const dt = new Date(EXCEL_EPOCH + ms);
    const hh = dt.getUTCHours(), mm = dt.getUTCMinutes();
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), hh, mm, hasTime: hh !== 0 || mm !== 0 };
  }
  const s = typeof v === 'string' ? v.trim() : '';
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return mk(+m[3], +m[2], +m[1], m[4], m[5]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return mk(+m[1], +m[2], +m[3], m[4], m[5]);
  return null;
}
function mk(y: number, mo: number, d: number, hh?: string, mm?: string): DateParts | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const H = hh ? +hh : 0, M = mm ? +mm : 0;
  return { y, m: mo, d, hh: H, mm: M, hasTime: !!hh && (H !== 0 || M !== 0) };
}
const p2 = (n: number) => String(n).padStart(2, '0');
export const toIsoDate = (p: DateParts): string => `${p.y}-${p2(p.m)}-${p2(p.d)}`;
export const toIsoTimestamp = (p: DateParts): string => `${toIsoDate(p)}T${p2(p.hh)}:${p2(p.mm)}:00${LOCAL_OFFSET}`;
const dayNumber = (p: DateParts) => Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86400000);

/** Numéro avant le point d'un état Coswin (« 3. OT créé » → « 3 »). */
export function coswinStateNumber(state: string): string | null {
  const m = state.match(/^\s*(\d+)\s*[.\-)]/);
  return m ? m[1] : null;
}

/** Ligne prête à être écrite dans `maintenance_requests` (noms de colonnes). */
export interface RequestInsertRow {
  code: string; title: string; description: null; priority: PriorityRow; status: StatusRow;
  equipment_id: string | null; location_id: string | null; requester_name: string | null; work_order_id: string | null;
  created_at?: string; origin: 'coswin';
  coswin_state: string; intervention_type: string | null; qse_type: string | null; daf_number: string | null;
  declared_at: string | null; due_date: string | null; planned_equipment_code: string | null; priority_code: string | null;
  ot_number: string | null; ot_state: string | null; ot_state_label: string | null; function_label: string | null;
  function_code: string | null; supervisor_name: string | null; cost_center: string | null; planned_start: string | null;
  ot_end_date: string | null; coswin_created_at: string | null; visa: string | null; equipment_code: string | null;
  intervention_code: string | null; site_code: string | null;
}

export interface ImportContext {
  existingCodes: Set<string>;
  equipmentIdByCode: Map<string, string>;
  /** Rapprochement tolérant (« - » et « _ » confondus, casse ignorée) : clé normalisée → équipement. */
  equipmentByKey: Map<string, { id: string; code: string }>;
  equipmentLocationById: Map<string, string | undefined>;
  locationIdByCode: Map<string, string>;
  workOrderIdByCode: Map<string, string>;
  /** Équipements de l'application (avec leur description) : sert au contrôle de cohérence équipement / description de la DI. */
  equipmentList?: { id: string; code: string; name: string; locationId?: string }[];
}

export function buildImportContext(src: {
  requests: Pick<MaintenanceRequest, 'code'>[];
  equipment: (Pick<Equipment, 'id' | 'code' | 'locationId'> & { name?: string })[];
  locations: Pick<LocationItem, 'id' | 'code'>[];
  workOrders: Pick<WorkOrder, 'id' | 'code'>[];
}): ImportContext {
  return {
    existingCodes: new Set(src.requests.map(r => r.code).filter((c): c is string => !!c)),
    equipmentIdByCode: new Map(src.equipment.map(e => [e.code, e.id] as [string, string])),
    equipmentByKey: new Map(src.equipment.map(e => [equipmentCompareKey(e.code), { id: e.id, code: e.code }] as [string, { id: string; code: string }])),
    equipmentLocationById: new Map(src.equipment.map(e => [e.id, e.locationId] as [string, string | undefined])),
    locationIdByCode: new Map(src.locations.filter(l => l.code).map(l => [l.code as string, l.id] as [string, string])),
    workOrderIdByCode: new Map(src.workOrders.map(w => [w.code, w.id] as [string, string])),
    equipmentList: src.equipment.map(e => ({ id: e.id, code: e.code, name: e.name ?? '', locationId: e.locationId })),
  };
}

export interface ImportReport {
  missingHeaders: string[];
  totalRows: number;
  blankRows: number;
  newCount: number;
  alreadyCount: number;
  invalid: { code: string; reason: string }[];
  skippedUnknownState: { state: string; count: number }[];
  equipmentMatched: number; equipmentUnmatched: number;
  /** Information : DI dont l'équipement source diffère de l'équipement planifié (le planifié est retenu s'il existe dans l'app). */
  equipmentSourceDiffersPlanned: number;
  siteMatched: number; siteUnmatched: number;
  otLinked: number; otUnlinked: number;
  unmatchedEquipment: string[]; unmatchedSites: string[];
  warnings: { code: string; message: string }[];
}

const nul = (s: string): string | null => (s === '' ? null : s);

/**
 * Analyse un export Coswin. Par défaut (import) : seules les DI nouvelles sont retenues dans `rows`.
 * Avec `syncExisting` (synchronisation) : les DI déjà présentes sont retenues dans `existingRows`, `rows` reste celui des nouvelles.
 */
export function analyzeRequestRows(
  rawRows: Record<string, unknown>[], ctx: ImportContext, opts: { syncExisting?: boolean } = {},
): { report: ImportReport; rows: RequestInsertRow[]; existingRows: RequestInsertRow[] } {
  const report: ImportReport = {
    missingHeaders: [], totalRows: 0, blankRows: 0, newCount: 0, alreadyCount: 0, invalid: [], skippedUnknownState: [],
    equipmentMatched: 0, equipmentUnmatched: 0, equipmentSourceDiffersPlanned: 0, siteMatched: 0, siteUnmatched: 0, otLinked: 0, otUnlinked: 0,
    unmatchedEquipment: [], unmatchedSites: [], warnings: [],
  };
  const rows: RequestInsertRow[] = [];
  const existingRows: RequestInsertRow[] = [];

  const present = new Set<Field>();
  for (const k of Object.keys(rawRows[0] ?? {})) { const f = HEADER_BY_NORM.get(norm(k)); if (f) present.add(f); }
  report.missingHeaders = COSWIN_HEADERS.filter(([, f]) => REQUIRED.includes(f) && !present.has(f)).map(([h]) => h);
  if (report.missingHeaders.length > 0) return { report, rows, existingRows };

  const seen = new Set<string>();
  const unknownStates = new Map<string, number>();
  const unmatchedEq = new Set<string>(), unmatchedSite = new Set<string>();

  for (const raw of rawRows) {
    const rec: Partial<Record<Field, unknown>> = {};
    for (const [k, v] of Object.entries(raw)) { const f = HEADER_BY_NORM.get(norm(k)); if (f) rec[f] = v; }
    const g = (f: Field) => str(rec[f]);

    const code = g('code');
    if (!code && Object.values(raw).every(v => str(v) === '')) { report.blankRows += 1; continue; }
    report.totalRows += 1;
    if (!code) { report.invalid.push({ code: '(sans N° de DI)', reason: 'N° de DI manquant' }); continue; }
    if (seen.has(code)) { report.warnings.push({ code, message: 'N° de DI en double dans le fichier : seule la première ligne est retenue' }); continue; }
    seen.add(code);
    const isExisting = ctx.existingCodes.has(code);
    if (isExisting) { report.alreadyCount += 1; if (!opts.syncExisting) continue; }

    const title = g('title');
    if (!title) { report.invalid.push({ code, reason: 'Description manquante' }); continue; }

    const state = g('state');
    const stateNum = coswinStateNumber(state);
    const status = stateNum ? COSWIN_STATE_MAP[stateNum] : undefined;
    if (!status) {
      const label = state || '(vide)';
      unknownStates.set(label, (unknownStates.get(label) ?? 0) + 1);
      continue;
    }

    const prioCode = g('priority').toUpperCase();
    const priority = COSWIN_PRIORITY_MAP[prioCode];
    if (!priority && prioCode) report.warnings.push({ code, message: `Priorité « ${g('priority') || '(vide)'} » inconnue : « moyenne » appliquée` });

    const dateField = (f: Field, label: string, withTime: boolean): string | null => {
      const raw = rec[f];
      if (raw === undefined || raw === null || raw === '') return null;
      const p = parseCoswinDate(raw);
      if (!p) { report.warnings.push({ code, message: `${label} illisible (« ${str(raw)} »)` }); return null; }
      return withTime ? toIsoTimestamp(p) : toIsoDate(p);
    };
    const declP = parseCoswinDate(rec.declaredAt);
    const creaP = parseCoswinDate(rec.coswinCreatedAt);
    const declaredAt = dateField('declaredAt', 'Date de déclaration', true);
    const coswinCreatedAt = dateField('coswinCreatedAt', 'Date de création', true);
    const dueDate = dateField('dueDate', 'Date de fin prévue', false);
    const plannedStart = dateField('plannedStart', 'Date de début prévue', false);
    const otEndDate = dateField('otEndDate', 'Date de fin', false);
    const incoherent = !!(declP && creaP && Math.abs(dayNumber(declP) - dayNumber(creaP)) > MAX_DECL_GAP_DAYS);
    if (declP && creaP && incoherent) {
      report.warnings.push({ code, message: `Date de déclaration (${p2(declP.d)}/${p2(declP.m)}/${declP.y}) très éloignée de la date de création (${p2(creaP.d)}/${p2(creaP.m)}/${creaP.y}) : année probablement erronée dans Coswin (la date de création est retenue)` });
    }

    // Règle : équipement lié = planifié s'il correspond à un équipement de l'app, sinon source. Le texte
    // `equipment_code` reste celui de Coswin (équipement source) ; seul le lien `equipment_id` suit la règle.
    const sourceCode = g('equipment');
    const plannedCode = g('plannedEquipment');
    const equipmentCode = sourceCode || plannedCode;
    const plannedHit = plannedCode ? ctx.equipmentByKey.get(equipmentCompareKey(plannedCode)) : undefined;
    const sourceHit = sourceCode ? ctx.equipmentByKey.get(equipmentCompareKey(sourceCode)) : undefined;
    const equipmentId = (plannedHit ?? sourceHit)?.id ?? null;
    if (sourceCode && plannedCode && equipmentCompareKey(sourceCode) !== equipmentCompareKey(plannedCode)) report.equipmentSourceDiffersPlanned += 1;
    if (equipmentCode) {
      if (equipmentId) report.equipmentMatched += 1; else { report.equipmentUnmatched += 1; unmatchedEq.add(plannedCode || equipmentCode); }
    }
    const siteCode = g('site');
    const locationId = (siteCode ? ctx.locationIdByCode.get(siteCode) : undefined)
      ?? (equipmentId ? ctx.equipmentLocationById.get(equipmentId) : undefined) ?? null;
    if (siteCode) {
      if (ctx.locationIdByCode.has(siteCode)) report.siteMatched += 1; else { report.siteUnmatched += 1; unmatchedSite.add(siteCode); }
    }
    const otNumber = g('otNumber');
    const workOrderId = otNumber ? ctx.workOrderIdByCode.get(`OT-${otNumber}`) ?? null : null;
    if (otNumber) { if (workOrderId) report.otLinked += 1; else report.otUnlinked += 1; }

    (isExisting ? existingRows : rows).push({
      code, title, description: null, priority: priority ?? 'moyenne', status,
      equipment_id: equipmentId, location_id: locationId, requester_name: nul(g('requester')), work_order_id: workOrderId,
      ...((incoherent ? coswinCreatedAt : (declaredAt ?? coswinCreatedAt)) ? { created_at: (incoherent ? coswinCreatedAt : (declaredAt ?? coswinCreatedAt)) as string } : {}),
      origin: 'coswin', coswin_state: state, intervention_type: nul(g('interventionType')), qse_type: nul(g('qseType')),
      daf_number: nul(g('daf')), declared_at: declaredAt, due_date: dueDate, planned_equipment_code: nul(g('plannedEquipment')),
      priority_code: nul(prioCode), ot_number: nul(otNumber), ot_state: nul(g('otState')), ot_state_label: nul(g('otStateLabel')),
      function_label: nul(g('functionLabel')), function_code: nul(g('functionCode')), supervisor_name: nul(g('supervisor')),
      cost_center: nul(g('costCenter')), planned_start: plannedStart, ot_end_date: otEndDate, coswin_created_at: coswinCreatedAt,
      visa: nul(g('visa')), equipment_code: nul(equipmentCode), intervention_code: nul(g('interventionCode')), site_code: nul(siteCode),
    });
  }

  report.newCount = rows.length;
  report.skippedUnknownState = Array.from(unknownStates, ([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count);
  report.unmatchedEquipment = Array.from(unmatchedEq).sort();
  report.unmatchedSites = Array.from(unmatchedSite).sort();
  return { report, rows, existingRows };
}

/** Champs envoyés à la fonction SQL de synchronisation (noms de colonnes ; Coswin fait foi pour ces champs). */
export const SYNC_FIELDS = [
  'coswin_state', 'ot_number', 'ot_state', 'ot_state_label', 'supervisor_name', 'cost_center', 'function_label', 'function_code',
  'visa', 'intervention_code', 'intervention_type', 'qse_type', 'daf_number', 'priority_code', 'planned_equipment_code',
  'equipment_code', 'site_code', 'ot_end_date', 'planned_start', 'due_date',
] as const;

export function toSyncPayload(rows: RequestInsertRow[]): Record<string, string | null>[] {
  return rows.map(r => {
    const o: Record<string, string | null> = { code: r.code, status: r.status };
    const rec = r as unknown as Record<string, string | null | undefined>;
    for (const f of SYNC_FIELDS) o[f] = rec[f] ?? null;
    return o;
  });
}
