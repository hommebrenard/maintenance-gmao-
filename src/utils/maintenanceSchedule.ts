import type { MaintenanceScheduleStatus } from '../types';

/**
 * Nombre de jours avant l'échéance à partir duquel une planification passe en
 * « échéance proche ». Valeur par défaut posée le 29/09/2026 (AI Studio ne
 * définit aucune règle : ses données de démo sont figées) — à confirmer.
 */
export const DUE_SOON_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Statut d'une échéance à partir de sa date (YYYY-MM-DD) :
 * - date dépassée → 'overdue' ; dans les DUE_SOON_DAYS jours → 'due_soon' ; sinon 'ok'.
 * - date absente ou illisible → undefined (« non renseigné », pas de valeur fictive).
 * Comparaison en jours calendaires (heure ignorée).
 */
export function computeScheduleStatus(
  nextDueDate: string | null | undefined,
  today: Date = new Date()
): MaintenanceScheduleStatus | undefined {
  if (!nextDueDate) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(nextDueDate);
  if (!m) return undefined;
  const due = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(due)) return undefined;
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((due - now) / DAY_MS);
  if (days < 0) return 'overdue';
  if (days <= DUE_SOON_DAYS) return 'due_soon';
  return 'ok';
}
