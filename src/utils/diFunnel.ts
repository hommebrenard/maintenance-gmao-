import type { MaintenanceRequest, WorkOrder } from '../types';
import { displayState, indexWorkOrders } from './requestDisplay';

/**
 * Entonnoir DI → OT → clôture — définitions (affichées dans l'écran) :
 * - DI reçues = toutes les DI hors « Rejetée » (décision dans l'application) et « DI annulée » (annulée dans Coswin).
 * - Avec OT = DI ayant un OT lié dans l'application, un numéro d'OT Coswin ou un état d'OT Coswin.
 * - OT clôturé = DI avec OT dont l'état affiché est « Clôturée » (OT terminé).
 * - « Clôturée sans OT » (Coswin « 17 ») est comptée à part : elle est fermée sans avoir donné d'OT.
 * Les 4 sorties sans OT ou avec OT forment une partition : reçues = en attente + prise en charge sans OT + clôturées sans OT + avec OT.
 */
export interface Funnel {
  total: number; rejetees: number; annulees: number; recues: number;
  enAttente: number; priseSansOt: number; clotureSansOt: number;
  avecOt: number; otCloture: number; otEnCours: number; otAnnule: number; otOuvert: number;
}

export function computeFunnel(requests: MaintenanceRequest[], workOrders: WorkOrder[]): Funnel {
  const linked = indexWorkOrders(workOrders, requests);
  const f: Funnel = { total: requests.length, rejetees: 0, annulees: 0, recues: 0, enAttente: 0, priseSansOt: 0, clotureSansOt: 0, avecOt: 0, otCloture: 0, otEnCours: 0, otAnnule: 0, otOuvert: 0 };
  for (const r of requests) {
    const state = displayState(r, r.workOrderId ? linked.get(r.workOrderId) : undefined);
    if (state === 'Rejetée') { f.rejetees += 1; continue; }
    if (state === 'DI annulée') { f.annulees += 1; continue; }
    f.recues += 1;
    const hasOt = !!(r.workOrderId || (r.otNumber ?? '').trim() || (r.otState ?? '').trim());
    if (!hasOt) {
      if (state === 'En attente') f.enAttente += 1;
      else if (state === 'Clôturée') f.clotureSansOt += 1;
      else f.priseSansOt += 1;
      continue;
    }
    f.avecOt += 1;
    if (state === 'Clôturée') f.otCloture += 1;
    else if (state === 'En cours') f.otEnCours += 1;
    else if (state === 'OT annulé') f.otAnnule += 1;
    else f.otOuvert += 1; // OT existant, pas encore démarré (inclut « En attente » avec un OT)
  }
  return f;
}
