import { equipmentCompareKey } from './coswinEquipmentImport';
import { checkRequestRows, type CheckContext, type EquipmentLite, type IssueKind } from './requestEquipmentCheck';

/**
 * Revue des DI existantes avant une synchronisation Coswin (étape 4d).
 *
 * Reproduit côté écran la résolution de `sync_maintenance_requests` (lue dans la fonction SQL) :
 * - clé de code = majuscules, espaces / « - » / « _ » confondus ; un code est résolu seulement s'il désigne UN SEUL équipement ;
 * - équipement visé = équipement planifié résolu, sinon équipement source résolu ;
 * - seules les DI d'origine Coswin déjà liées à un équipement changent d'équipement ; un code introuvable ou ambigu laisse le lien inchangé.
 * Aucune décision automatique : un vrai conflit (autre site, site non résolu, description incohérente) est retiré du lot jusqu'à décision.
 */

export type ReviewState =
  | 'conforme' | 'reaffectation_meme_site'
  | 'verrou_stable' | 'verrou_aligne' | 'verrou_change_coswin'
  | 'nouveau_conflit' | 'anomalie_equipement' | 'hors_perimetre';

export interface ReviewRequest { code?: string; title: string; origin?: 'app' | 'coswin'; equipmentId?: string; equipmentCode?: string }
export interface ReviewFileRow { code: string; title: string; site_code: string | null; equipment_code: string | null; planned_equipment_code: string | null }
export interface LockLite { equipmentId: string; equipmentCode: string }
export type SyncDecision = 'accepter' | 'garder';

export interface ReviewItem {
  code: string;
  title: string;
  state: ReviewState;
  /** Conflit : nature du contrôle en échec. */
  reason?: IssueKind;
  /**
   * Problème sur le code d'équipement du fichier : le premier code renseigné (planifié, sinon source) est introuvable ou ambigu.
   * Signalé même si la synchronisation se rabat sur l'autre code pour garder le lien : l'ambiguïté ne doit pas être masquée.
   */
  codeProblem?: 'introuvable' | 'ambigu';
  oldEquipment?: { id: string; code: string };
  newEquipment?: { id: string; code: string };
  powerNote?: string;
  /** Vrai si la DI est retirée du lot (conflit sans décision « accepter », ou « garder » sans verrou confirmé). */
  held: boolean;
  decision?: SyncDecision;
}
export interface ReviewResult {
  items: ReviewItem[];
  counts: Record<ReviewState, number>;
  /** DI RETIRÉES DU LOT (conflits sans décision) : leurs mises à jour d'état et d'OT sont aussi différées. Ne compte pas les anomalies. */
  notSynced: number;
  /** DI dont le code d'équipement est introuvable ou ambigu (peu importe leur état) : information, elles restent dans le lot. */
  anomalies: number;
}

type Resolved = { kind: 'ok'; eq: EquipmentLite } | { kind: 'vide' | 'introuvable' | 'ambigu' };

function buildResolver(equipment: EquipmentLite[]) {
  const byKey = new Map<string, EquipmentLite[]>();
  for (const e of equipment) {
    if (!e.code) continue;
    const k = equipmentCompareKey(e.code);
    byKey.set(k, [...(byKey.get(k) ?? []), e]);
  }
  return (code: string | null | undefined): Resolved => {
    if (!code || !code.trim()) return { kind: 'vide' };
    const list = byKey.get(equipmentCompareKey(code));
    if (!list) return { kind: 'introuvable' };
    return list.length > 1 ? { kind: 'ambigu' } : { kind: 'ok', eq: list[0] };
  };
}

const sameKey = (a?: string | null, b?: string | null) => equipmentCompareKey(a ?? '') === equipmentCompareKey(b ?? '');

export function reviewSyncRows(
  fileRows: ReviewFileRow[],
  requests: ReviewRequest[],
  equipment: EquipmentLite[],
  locks: Map<string, LockLite>,
  ctx: Omit<CheckContext, 'equipmentList'>,
  decisions: Record<string, SyncDecision> = {},
): ReviewResult {
  const resolve = buildResolver(equipment);
  const byId = new Map(equipment.map(e => [e.id, e]));
  const reqByCode = new Map<string, ReviewRequest>();
  for (const r of requests) {
    if (!r.code) continue;
    if (reqByCode.has(r.code)) throw new Error(`Deux demandes portent le même N° de DI (${r.code}) : revue impossible.`);
    reqByCode.set(r.code, r);
  }
  const seenFile = new Set<string>();
  for (const r of fileRows) {
    if (seenFile.has(r.code)) throw new Error(`N° de DI en double dans le fichier (${r.code}) : revue impossible.`);
    seenFile.add(r.code);
  }
  const checkCtx: CheckContext = { ...ctx, equipmentList: equipment };
  const items: ReviewItem[] = [];

  for (const row of fileRows) {
    const req = reqByCode.get(row.code);
    if (!req) continue; // DI absente de la base : hors de cette revue (import).
    const lock = locks.get(row.code);
    const p = resolve(row.planned_equipment_code), s = resolve(row.equipment_code);
    const target = p.kind === 'ok' ? p.eq : s.kind === 'ok' ? s.eq : null;
    const first = p.kind !== 'vide' ? p : s; // premier code renseigné : c'est celui qui doit se résoudre
    const codeProblem = first.kind === 'introuvable' || first.kind === 'ambigu' ? first.kind : undefined;
    const base = { code: row.code, title: row.title, held: false as boolean, codeProblem };
    const oldEq = req.equipmentId ? byId.get(req.equipmentId) : undefined;
    const oldEquipment = oldEq ? { id: oldEq.id, code: oldEq.code } : undefined;

    // Hors périmètre : la synchronisation ne touche pas à l'équipement, donc aucune anomalie de code à signaler.
    if (req.origin !== 'coswin') { items.push({ ...base, codeProblem: undefined, state: 'hors_perimetre' }); continue; }

    if (lock) {
      const state: ReviewState = target && target.id === lock.equipmentId ? 'verrou_aligne'
        : sameKey(row.equipment_code, req.equipmentCode) ? 'verrou_stable' : 'verrou_change_coswin';
      items.push({ ...base, state, oldEquipment: { id: lock.equipmentId, code: lock.equipmentCode }, newEquipment: target ? { id: target.id, code: target.code } : undefined });
      continue;
    }
    if (!req.equipmentId) { items.push({ ...base, codeProblem: undefined, state: 'hors_perimetre' }); continue; }

    if (!target || target.id === req.equipmentId) {
      items.push({ ...base, state: codeProblem ? 'anomalie_equipement' : 'conforme', oldEquipment });
      continue;
    }

    const check = checkRequestRows([{ code: row.code, title: row.title, equipment_id: target.id, site_code: row.site_code, equipment_code: row.equipment_code, planned_equipment_code: row.planned_equipment_code }], checkCtx);
    const newEquipment = { id: target.id, code: target.code };
    if (check.issues.length > 0) {
      const decision = decisions[row.code];
      items.push({ ...base, state: 'nouveau_conflit', reason: check.issues[0].kind, oldEquipment, newEquipment, held: decision !== 'accepter', decision });
    } else {
      items.push({ ...base, state: 'reaffectation_meme_site', oldEquipment, newEquipment, powerNote: check.powerWarnings[0]?.note });
    }
  }

  const counts = { conforme: 0, reaffectation_meme_site: 0, verrou_stable: 0, verrou_aligne: 0, verrou_change_coswin: 0, nouveau_conflit: 0, anomalie_equipement: 0, hors_perimetre: 0 } as Record<ReviewState, number>;
  for (const i of items) counts[i.state]++;
  return { items, counts, notSynced: items.filter(i => i.held).length, anomalies: items.filter(i => i.codeProblem).length };
}

/** Retire du lot envoyé les DI retenues. */
export function excludeHeld<T extends { code: string | null }>(payload: T[], result: ReviewResult): T[] {
  const held = new Set(result.items.filter(i => i.held).map(i => i.code));
  return payload.filter(p => !p.code || !held.has(p.code));
}
