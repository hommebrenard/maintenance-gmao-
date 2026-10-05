import type { GammePlan, WorkOrder } from '../types';

/**
 * Un OT correctif sans code d'intervention (créé depuis une demande ou à la
 * main) n'a pas de gamme préventive : le rattachement automatique « par
 * famille » lui collait une checklist de maintenance préventive sans rapport
 * avec la panne. Depuis le 05/10/2026 il n'y a plus de rattachement
 * automatique pour ces OT ; la checklist reste libre (ajout d'actions manuel).
 */
export function skipsAutoGamme(wo: Pick<WorkOrder, 'type' | 'interventionCode'>): boolean {
  return wo.type === 'Corrective' && !(wo.interventionCode || '').trim();
}

/** Liste de gammes à utiliser pour cet OT : vide si le rattachement auto est exclu. */
export function gammesForWorkOrder(wo: Pick<WorkOrder, 'type' | 'interventionCode'>, gammes: GammePlan[]): GammePlan[] {
  return skipsAutoGamme(wo) ? [] : gammes;
}
