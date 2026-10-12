import type { MaintenanceRequest, WorkOrder } from '../types';

/** État affiché d'une DI : les 3 états stockés + l'avancement de l'OT lié (jamais dupliqué en base). */
export type RequestDisplayState = 'En attente' | 'Rejetée' | 'DI annulée' | 'Prise en charge' | 'En cours' | 'Clôturée' | 'OT annulé';

/** États d'OT Coswin : E, T, U = Terminé ; V, Z = Archivable (donc terminés) ; N, X = Annulé. */
const OT_DONE = new Set(['E', 'T', 'U', 'V', 'Z']);
const OT_CANCELLED = new Set(['N', 'X']);

/** État Coswin « 5. Annulée » : la DI a été annulée dans Coswin (≠ rejet décidé dans l'application, ≠ OT annulé). */
export function isCoswinCancelled(coswinState?: string): boolean {
  return /^\s*5\s*[.\-)]/.test(coswinState ?? '');
}

/** Alerte de cohérence : DI annulée dans Coswin alors que son OT existe et n'est ni terminé ni annulé. Aucune donnée n'est modifiée. */
export function requestAlert(req: { status: string; coswinState?: string; otNumber?: string; otState?: string }): string | null {
  if (req.status !== 'Rejetée' || !isCoswinCancelled(req.coswinState)) return null;
  const ot = (req.otState ?? '').trim().toUpperCase();
  if (!ot && !req.otNumber) return null;
  if (OT_DONE.has(ot) || OT_CANCELLED.has(ot)) return null;
  return `DI annulée dans Coswin alors que l'OT existe et n'est pas terminé${ot ? ` (état ${ot})` : ''}. À vérifier dans Coswin.`;
}

/** Origine de l'état « rejetée / annulée » : annulation venue de Coswin (« 5. Annulée ») ou rejet décidé dans l'application. */
export function decisionOrigin(req: { status: string; coswinState?: string }): 'coswin' | 'app' | null {
  if (req.status !== 'Rejetée') return null;
  return isCoswinCancelled(req.coswinState) ? 'coswin' : 'app';
}

export function displayState(req: Pick<MaintenanceRequest, 'status'> & { otState?: string; coswinState?: string }, wo?: Pick<WorkOrder, 'status'> | null): RequestDisplayState {
  if (req.status === 'En attente') return 'En attente';
  if (req.status === 'Rejetée') return isCoswinCancelled(req.coswinState) ? 'DI annulée' : 'Rejetée'; // Coswin « 5. Annulée » ≠ rejet local
  if (!wo) { // demande importée : OT Coswin hors application
    const ot = (req.otState ?? '').trim().toUpperCase();
    if (OT_DONE.has(ot)) return 'Clôturée';
    if (OT_CANCELLED.has(ot)) return 'OT annulé';
    if (/^\s*17\s*[.\-)]/.test(req.coswinState ?? '')) return 'Clôturée'; // « 17. Clôturée sans OT »
    return 'Prise en charge';
  }
  if (wo.status === 'Terminé') return 'Clôturée';
  if (wo.status === 'En cours') return 'En cours';
  return 'Prise en charge';
}

export const DISPLAY_STATE_CLASS: Record<RequestDisplayState, string> = {
  'En attente': 'bg-amber-50 text-amber-700',
  'Rejetée': 'bg-red-50 text-red-700',
  'DI annulée': 'bg-slate-100 text-slate-600',
  'Prise en charge': 'bg-blue-50 text-blue-700',
  'En cours': 'bg-indigo-50 text-indigo-700',
  'Clôturée': 'bg-green-50 text-green-700',
  'OT annulé': 'bg-gray-100 text-gray-600',
};

/** Index id → OT, pour retrouver l'OT lié à chaque demande sans parcourir 6749 OT par ligne. */
export function indexWorkOrders(workOrders: WorkOrder[], requests: MaintenanceRequest[]): Map<string, WorkOrder> {
  const wanted = new Set(requests.map(r => r.workOrderId).filter((v): v is string => !!v));
  const map = new Map<string, WorkOrder>();
  if (wanted.size === 0) return map;
  for (const wo of workOrders) if (wanted.has(wo.id)) map.set(wo.id, wo);
  return map;
}
