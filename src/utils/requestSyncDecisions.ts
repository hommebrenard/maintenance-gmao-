import { equipmentCompareKey } from './coswinEquipmentImport';
import type { ReviewItem, SyncDecision } from './requestSyncReview';

export interface TraceLite { diCode: string; decision: 'garder' | 'accepter' | 'liberer'; beforeId: string | null; afterId: string | null }
export interface SyncProof { history: { champ: string; nouvelleValeur: string | null }[]; equipmentId: string | null }
export type ProofStatus = 'prouvee' | 'indeterminee';

/**
 * Décisions « accepter » encore valables, relues dans la trace (plus récentes d'abord).
 * Valable seulement si c'est la dernière décision de la DI ET si elle porte sur le même changement
 * (équipement actuel et nouvel équipement identiques à ceux du conflit courant). « garder » ne passe jamais ici : il crée un verrou.
 */
export function decisionsFromTrace(firstPass: ReviewItem[], trace: TraceLite[]): Record<string, SyncDecision> {
  const latest = new Map<string, TraceLite>();
  for (const t of trace) if (!latest.has(t.diCode)) latest.set(t.diCode, t);
  const out: Record<string, SyncDecision> = {};
  for (const it of firstPass) {
    if (it.state !== 'nouveau_conflit') continue;
    const t = latest.get(it.code);
    if (t && t.decision === 'accepter' && t.beforeId === it.oldEquipment?.id && t.afterId === it.newEquipment?.id) out[it.code] = 'accepter';
  }
  return out;
}

/**
 * Preuve d'une décision « accepter » après un lot : ligne d'historique `equipment_id` du lot portant le code accepté
 * ET équipement actuel de la DI identique à l'équipement accepté. Sinon : résultat indéterminé, jamais « appliquée ».
 */
export function evaluateAcceptProof(item: ReviewItem, proof?: SyncProof): ProofStatus {
  if (!proof || !item.newEquipment) return 'indeterminee';
  const key = equipmentCompareKey(item.newEquipment.code);
  const line = proof.history.some(h => h.champ === 'equipment_id' && !!h.nouvelleValeur && equipmentCompareKey(h.nouvelleValeur) === key);
  return line && proof.equipmentId === item.newEquipment.id ? 'prouvee' : 'indeterminee';
}
