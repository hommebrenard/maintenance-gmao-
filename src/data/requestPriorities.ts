import type { WorkOrderPriority } from '../types';

/**
 * Priorités affichées dans le formulaire = libellés Coswin (capture du 25/10/2026) :
 * U0 URGENT · U1 À traiter dans la journée · U2 À traiter dans la semaine · U3 À traiter dans le mois.
 * La valeur enregistrée reste la priorité de l'application (inchangée en base).
 */
export const PRIORITY_CHOICES: { value: WorkOrderPriority; coswinCode: string; label: string }[] = [
  { value: 'Urgente', coswinCode: 'U0', label: 'Urgent' },
  { value: 'Élevée', coswinCode: 'U1', label: 'À traiter dans la journée' },
  { value: 'Moyenne', coswinCode: 'U2', label: 'À traiter dans la semaine' },
  { value: 'Faible', coswinCode: 'U3', label: 'À traiter dans le mois' },
];
