import type { Equipment, MaintenanceRequest, WorkOrder } from '../types';
import { displayState, indexWorkOrders, type RequestDisplayState } from './requestDisplay';

export interface LinkedRequestRow { req: MaintenanceRequest; state: RequestDisplayState }

/** Demandes d'intervention d'un équipement : lien par id réel (demandes de l'application) ou par code (demandes Coswin rapprochées à l'affichage). */
export function requestsForEquipment(requests: MaintenanceRequest[], eq: Pick<Equipment, 'id' | 'code'>): MaintenanceRequest[] {
  const code = (eq.code ?? '').trim().toUpperCase();
  return requests
    .filter(r => (r.equipmentId && r.equipmentId === eq.id) || (!!code && (r.equipmentCode ?? '').trim().toUpperCase() === code))
    .sort((a, b) => (b.createdAtIso ?? '').localeCompare(a.createdAtIso ?? ''));
}

/** Lignes du carnet : chaque demande avec son état affiché (suit l'OT lié, comme dans Demandes). */
export function linkedRequestRows(requests: MaintenanceRequest[], eq: Pick<Equipment, 'id' | 'code'>, workOrders: WorkOrder[]): LinkedRequestRow[] {
  const mine = requestsForEquipment(requests, eq);
  const byRequest = indexWorkOrders(workOrders, mine);
  return mine.map(req => ({ req, state: displayState(req, req.workOrderId ? byRequest.get(req.workOrderId) : undefined) }));
}

const CLOSED_STATES: ReadonlySet<RequestDisplayState> = new Set(['Clôturée', 'DI annulée', 'Rejetée', 'OT annulé']);

/** Passeport PDF : même règle que le registre des OT — année en cours + demandes non closes des années précédentes. */
export function passportRequestRows(rows: LinkedRequestRow[], year: number): LinkedRequestRow[] {
  return rows.filter(({ req, state }) => {
    const y = parseInt((req.createdAtIso ?? '').slice(0, 4), 10);
    return y === year || !CLOSED_STATES.has(state);
  });
}
