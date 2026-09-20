import type { Equipment, OperationalStatus, WorkOrder, WorkOrderStatus } from '../types';

// Ajouté le 20/09/2026 — fiche équipement (EquipmentView.tsx) : fonctions pures,
// sans React, pour pouvoir les tester avec vitest.

/**
 * Vrai si le champ est considéré comme non renseigné : vide, espaces seuls, ou
 * le tiret cadratin '—' que le formulaire « Ajouter un équipement » écrit à la
 * place d'une valeur vide.
 */
export function isBlankField(value?: string | null): boolean {
  if (value === undefined || value === null) return true;
  const v = value.trim();
  return v === '' || v === '—';
}

/**
 * OT réellement rattachés à un équipement, du plus récent au plus ancien
 * (échéance décroissante, puis code d'OT pour un ordre stable).
 *
 * Règle : si l'OT porte un `equipmentId`, c'est lui qui fait foi (comparaison
 * avec l'id de l'équipement). Le code équipement n'est utilisé que pour les OT
 * sans `equipmentId` (ex. OT tout juste importés, pas encore relus en base).
 */
export function getLinkedWorkOrders(
  equipment: Pick<Equipment, 'id' | 'code'>,
  workOrders: WorkOrder[]
): WorkOrder[] {
  return workOrders
    .filter(wo => {
      if (wo.equipmentId) return wo.equipmentId === equipment.id;
      return !!wo.equipmentCode && wo.equipmentCode === equipment.code;
    })
    .sort((a, b) => {
      const byDue = (b.dueDate || '').localeCompare(a.dueDate || '');
      return byDue !== 0 ? byDue : a.code.localeCompare(b.code);
    });
}

/** Classes du badge d'état opérationnel (mêmes couleurs que la liste des équipements). */
export function getOperationalStatusBadgeClass(status: OperationalStatus): string {
  switch (status) {
    case 'En service':
      return 'bg-green-100 text-green-700';
    case 'Arrêt planifié':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-red-100 text-red-700';
  }
}

/** Classes du badge de statut d'OT (mêmes couleurs que la vue Ordres de travail). */
export function getWorkOrderStatusBadgeClass(status: WorkOrderStatus): string {
  switch (status) {
    case 'Terminé':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'En cours':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'En attente':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

/** 'AAAA-MM-JJ' -> 'JJ/MM/AAAA' (sans passer par Date, donc sans décalage de fuseau). */
export function formatIsoDate(iso?: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
