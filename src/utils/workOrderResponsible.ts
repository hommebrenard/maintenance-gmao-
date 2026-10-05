import type { WorkOrder } from '../types';

/**
 * Personne à afficher/filtrer comme « responsable » d'un OT, avec la même
 * règle que la fiche et la liste des OT : intervenants saisis (noms distincts,
 * joints par « / »), sinon compte assigné, sinon planificateur importé.
 * Chaîne vide si rien n'est renseigné. `assignee` seul est vide pour presque
 * tous les OT importés : le filtre « Assigné à » des Rapports restait vide.
 */
export function responsibleOf(wo: Pick<WorkOrder, 'intervenantsLogs' | 'assignee' | 'planner'>): string {
  const names = (wo.intervenantsLogs || [])
    .map(l => l.name?.trim())
    .filter((n): n is string => !!n);
  const unique = Array.from(new Set(names));
  if (unique.length > 0) return unique.join(' / ');
  return (wo.assignee || wo.planner || '').trim();
}
