import type { MaintenanceRequest, WorkOrder } from '../types';

/** État affiché d'une DI : les 3 états stockés + l'avancement de l'OT lié (jamais dupliqué en base). */
export type RequestDisplayState = 'En attente' | 'Rejetée' | 'Prise en charge' | 'En cours' | 'Clôturée';

export function displayState(req: Pick<MaintenanceRequest, 'status'>, wo?: Pick<WorkOrder, 'status'> | null): RequestDisplayState {
  if (req.status === 'En attente') return 'En attente';
  if (req.status === 'Rejetée') return 'Rejetée';
  if (!wo) return 'Prise en charge';
  if (wo.status === 'Terminé') return 'Clôturée';
  if (wo.status === 'En cours') return 'En cours';
  return 'Prise en charge';
}

export const DISPLAY_STATE_CLASS: Record<RequestDisplayState, string> = {
  'En attente': 'bg-amber-50 text-amber-700',
  'Rejetée': 'bg-red-50 text-red-700',
  'Prise en charge': 'bg-blue-50 text-blue-700',
  'En cours': 'bg-indigo-50 text-indigo-700',
  'Clôturée': 'bg-green-50 text-green-700',
};

/** Index id → OT, pour retrouver l'OT lié à chaque demande sans parcourir 6749 OT par ligne. */
export function indexWorkOrders(workOrders: WorkOrder[], requests: MaintenanceRequest[]): Map<string, WorkOrder> {
  const wanted = new Set(requests.map(r => r.workOrderId).filter((v): v is string => !!v));
  const map = new Map<string, WorkOrder>();
  if (wanted.size === 0) return map;
  for (const wo of workOrders) if (wanted.has(wo.id)) map.set(wo.id, wo);
  return map;
}
