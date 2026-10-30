import { norm, type RequestInsertRow } from './importRequests';
import { equipmentCompareKey } from './coswinEquipmentImport';

/**
 * Contrôle préalable à l'import des DI Coswin (version 2).
 *
 * - Le site de référence d'une DI est celui de la Zone Coswin, jamais celui de l'équipement déjà rattaché (qui peut être erroné).
 * - Les équipements proposés ou acceptés sont uniquement ceux de ce site.
 * - Aucune affectation automatique : chaque DI douteuse attend une décision explicite (garder Coswin, utiliser un équipement du site, ne pas importer).
 * - Les codes d'origine de Coswin (équipement source, équipement planifié, zone) ne sont jamais modifiés : seul le lien `equipment_id` peut changer.
 */

export interface EquipmentLite { id: string; code: string; name: string; locationId?: string }
export interface EquipmentSuggestion { id: string; code: string; name: string; score: number }

export type IssueKind = 'site_absent' | 'site_inconnu' | 'site_ambigu' | 'hors_site' | 'incoherent';
export const SITE_ISSUES: IssueKind[] = ['site_absent', 'site_inconnu', 'site_ambigu'];

export interface RequestIssue {
  requestCode: string;
  title: string;
  kind: IssueKind;
  zoneCode: string;
  siteId: string | null; // site résolu à partir de la Zone (null si la Zone est absente, inconnue ou ambiguë)
  assigned: { id: string; code: string; name: string } | null;
  suggestions: EquipmentSuggestion[]; // 0 à 3, la meilleure d'abord
  powerNote?: string;
}
export interface PowerWarning { requestCode: string; title: string; equipmentCode: string; note: string }
export interface CheckResult {
  issues: RequestIssue[];
  accepted: number; // DI sans décision à prendre
  unknownEquipmentRows: number; // DI dont l'équipement Coswin n'existe pas dans l'application (importées sans lien)
  unknownEquipmentCodes: string[];
  powerWarnings: PowerWarning[]; // information, sans blocage
}
export type CheckableRow = Pick<RequestInsertRow, 'code' | 'title' | 'equipment_id' | 'site_code' | 'equipment_code' | 'planned_equipment_code'>;
export interface CheckContext {
  equipmentList?: EquipmentLite[];
  locationIdByCode: Map<string, string>;
  locationIdByKey?: Map<string, string>;
  ambiguousSiteKeys?: Set<string>;
}

export type EquipmentDecision = { kind: 'keep' } | { kind: 'skip' } | { kind: 'use'; equipmentId: string };

/** Écart de score minimal entre la meilleure proposition et l'équipement de Coswin pour signaler une DI. */
export const SUSPECT_MARGIN = 2;

const STOP = new Set([
  'besoin', 'entretien', 'entrtien', 'preventif', 'preventive', 'curatif', 'pour', 'mois', 'niveau', 'marque', 'puissance', 'remplacement',
  'depoussierage', 'intervention', 'les', 'des', 'aux', 'avec', 'sans', 'sur', 'type', 'bureau', 'janvier', 'fevrier', 'mars', 'avril',
  'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
]);

/** Mots significatifs d'un libellé : sans accents, sans mots-outils, « N05 » = « N5 », sans nombres seuls. */
export function significantTokens(text: string): string[] {
  const out = new Set<string>();
  // « 1.4KW » et « 1.4 KW » doivent donner le même mot.
  for (const raw of norm(text.replace(/(\d)\s+(kva|kw)\b/gi, '$1$2')).split(' ')) {
    if (!raw || STOP.has(raw) || /^\d+$/.test(raw)) continue;
    const t = raw.replace(/^n0+(\d)/, 'n$1');
    if (t.length <= 2 && !/\d/.test(t)) continue;
    if (STOP.has(t)) continue;
    out.add(t);
  }
  return [...out];
}

function lev1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

const power = (s: string): { value: number; unit: string } | null => {
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(kva|kw)\b/i);
  return m ? { value: parseFloat(m[1].replace(',', '.')), unit: m[2].toUpperCase() } : null;
};
const powerDiff = (title: string, eqName: string): string | null => {
  const dp = power(title), ep = power(eqName);
  return dp && ep && dp.unit === ep.unit && dp.value !== ep.value
    ? `La DI indique ${dp.value} ${dp.unit}, l'équipement est de ${ep.value} ${ep.unit} : vérifier le numéro ou la puissance dans la description.` : null;
};

type SiteResolution = { kind: 'ok'; id: string } | { kind: 'absent' | 'inconnu' | 'ambigu' };
function resolveSite(zone: string | null | undefined, ctx: CheckContext): SiteResolution {
  const z = (zone ?? '').trim();
  if (!z) return { kind: 'absent' };
  const exact = ctx.locationIdByCode.get(z);
  if (exact) return { kind: 'ok', id: exact };
  const key = equipmentCompareKey(z);
  if (ctx.ambiguousSiteKeys?.has(key)) return { kind: 'ambigu' };
  const id = ctx.locationIdByKey?.get(key);
  return id ? { kind: 'ok', id } : { kind: 'inconnu' };
}

export function checkRequestRows(rows: CheckableRow[], ctx: CheckContext): CheckResult {
  const equipment = ctx.equipmentList ?? [];
  const byId = new Map(equipment.map(e => [e.id, e]));
  const bySite = new Map<string, { eq: EquipmentLite; tokens: Set<string> }[]>();
  for (const e of equipment) {
    if (!e.locationId) continue;
    const list = bySite.get(e.locationId) ?? [];
    list.push({ eq: e, tokens: new Set(significantTokens(e.name)) });
    bySite.set(e.locationId, list);
  }
  const idf = new Map<string, Map<string, number>>();
  const weights = (site: string) => {
    let w = idf.get(site);
    if (!w) {
      const list = bySite.get(site) ?? [];
      const df = new Map<string, number>();
      for (const c of list) for (const t of c.tokens) df.set(t, (df.get(t) ?? 0) + 1);
      w = new Map([...df].map(([t, n]) => [t, Math.log(1 + list.length / n) * (/^n\d+$/.test(t) ? 1.5 : 1)]));
      idf.set(site, w);
    }
    return w;
  };
  const rank = (title: string, site: string) => {
    const w = weights(site);
    const titleTokens = significantTokens(title);
    return (bySite.get(site) ?? []).map(c => {
      let score = 0, hits = 0, strong = false;
      for (const t of titleTokens) {
        let wt = 0;
        if (c.tokens.has(t)) wt = w.get(t) ?? 0;
        else if (t.length >= 5) for (const u of c.tokens) if (u.length >= 5 && lev1(t, u)) { wt = w.get(u) ?? 0; break; }
        if (wt > 0) { score += wt; hits++; if (!/^n\d+$/.test(t)) strong = true; }
      }
      return { eq: c.eq, score, hits, strong };
    }).sort((a, b) => b.score - a.score || a.eq.code.localeCompare(b.eq.code));
  };
  const round = (n: number) => Math.round(n * 10) / 10;

  const issues: RequestIssue[] = [];
  const powerWarnings: PowerWarning[] = [];
  const unknownCodes = new Set<string>();
  let unknownEquipmentRows = 0;

  for (const row of rows) {
    const zoneCode = (row.site_code ?? '').trim();
    const assigned = row.equipment_id ? byId.get(row.equipment_id) : undefined;
    const assignedLite = assigned ? { id: assigned.id, code: assigned.code, name: assigned.name } : null;
    const site = resolveSite(row.site_code, ctx);
    if (site.kind !== 'ok') {
      issues.push({ requestCode: row.code, title: row.title, kind: `site_${site.kind}` as IssueKind, zoneCode, siteId: null, assigned: assignedLite, suggestions: [] });
      continue;
    }
    if (!row.equipment_code && !row.planned_equipment_code) continue; // DI sans équipement : rien à contrôler
    if (!assigned) { unknownEquipmentRows++; unknownCodes.add((row.planned_equipment_code || row.equipment_code) as string); continue; }

    const scored = rank(row.title, site.id);
    if (assigned.locationId && assigned.locationId !== site.id) {
      const best = scored[0];
      const suggestions = scored.filter(s => s.strong && s.score > 0 && best && s.score >= best.score * 0.6).slice(0, 3)
        .map(s => ({ id: s.eq.id, code: s.eq.code, name: s.eq.name, score: round(s.score) }));
      const note = suggestions[0] ? powerDiff(row.title, suggestions[0].name) : null;
      issues.push({ requestCode: row.code, title: row.title, kind: 'hors_site', zoneCode, siteId: site.id, assigned: assignedLite, suggestions, powerNote: note ?? undefined });
      continue;
    }
    const assignedScore = scored.find(s => s.eq.id === assigned.id)?.score ?? 0;
    const best = scored[0];
    if (best && best.eq.id !== assigned.id && best.hits >= 2 && best.strong && best.score - assignedScore >= SUSPECT_MARGIN) {
      const suggestions = scored.filter(s => s.eq.id !== assigned.id && s.score >= best.score * 0.6 && s.hits >= 2 && s.strong).slice(0, 3)
        .map(s => ({ id: s.eq.id, code: s.eq.code, name: s.eq.name, score: round(s.score) }));
      issues.push({ requestCode: row.code, title: row.title, kind: 'incoherent', zoneCode, siteId: site.id, assigned: assignedLite, suggestions, powerNote: powerDiff(row.title, suggestions[0].name) ?? undefined });
      continue;
    }
    const note = powerDiff(row.title, assigned.name);
    if (note) powerWarnings.push({ requestCode: row.code, title: row.title, equipmentCode: assigned.code, note });
  }
  return { issues, accepted: rows.length - issues.length, unknownEquipmentRows, unknownEquipmentCodes: [...unknownCodes].sort(), powerWarnings };
}

/** Une décision est valable si elle est explicite ; « utiliser » exige un équipement du site résolu de la DI (jamais d'un autre site). */
export function isDecided(issue: RequestIssue, decision: EquipmentDecision | undefined, equipment: EquipmentLite[]): boolean {
  if (!decision) return false;
  if (decision.kind === 'keep' || decision.kind === 'skip') return true;
  if (SITE_ISSUES.includes(issue.kind) || !issue.siteId) return false;
  const eq = equipment.find(e => e.id === decision.equipmentId);
  return !!eq && eq.locationId === issue.siteId;
}

export function pendingIssues(issues: RequestIssue[], decisions: Record<string, EquipmentDecision>, equipment: EquipmentLite[]): RequestIssue[] {
  return issues.filter(i => !isDecided(i, decisions[i.requestCode], equipment));
}

/** Applique les décisions. Lève une erreur s'il en manque une (aucune écriture partielle). Ne modifie jamais les codes Coswin. */
export function applyDecisions<T extends { code: string; equipment_id: string | null }>(
  rows: T[], issues: RequestIssue[], decisions: Record<string, EquipmentDecision>, equipment: EquipmentLite[],
): { rows: T[]; skipped: number; relinked: number } {
  const missing = pendingIssues(issues, decisions, equipment);
  if (missing.length > 0) throw new Error(`Décision manquante ou invalide pour ${missing.length} DI : ${missing.slice(0, 3).map(m => m.requestCode).join(', ')}`);
  const byCode = new Map(issues.map(i => [i.requestCode, i]));
  const out: T[] = [];
  let skipped = 0, relinked = 0;
  for (const r of rows) {
    const issue = byCode.get(r.code);
    const d = issue ? decisions[issue.requestCode] : undefined;
    if (!issue || !d || d.kind === 'keep') { out.push(r); continue; }
    if (d.kind === 'skip') { skipped++; continue; }
    out.push({ ...r, equipment_id: d.equipmentId });
    relinked++;
  }
  return { rows: out, skipped, relinked };
}
