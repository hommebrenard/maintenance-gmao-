import type { WorkOrderPriority } from '../types';

/**
 * Délais PROVISOIRES (jours calendaires) entre la déclaration et la date de fin prévue proposée.
 * Règle non encore validée par le métier : c'est le SEUL endroit à modifier pour la changer.
 */
export const DUE_DELAY_DAYS: Record<WorkOrderPriority, number> = {
  Urgente: 1,
  Élevée: 3,
  Moyenne: 7,
  Faible: 14,
};

/** Fuseau métier : la date « du jour » est celle du Maroc, pas celle de l'appareil. */
export const BUSINESS_TIME_ZONE = 'Africa/Casablanca';

/** Date du jour au format AAAA-MM-JJ dans le fuseau métier. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

/** Vrai pour une date AAAA-MM-JJ existante (le 2026-02-30 est refusé). */
export function isValidIsoDate(s: string | undefined | null): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Ajoute des jours calendaires à une date AAAA-MM-JJ (sans dépendre du fuseau de l'appareil). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Date de fin prévue PROPOSÉE pour une priorité donnée, à partir du jour (fuseau Maroc). */
export function proposedDueDate(priority: WorkOrderPriority, now: Date = new Date()): string {
  return addDaysIso(todayIso(now), DUE_DELAY_DAYS[priority] ?? DUE_DELAY_DAYS.Moyenne);
}

/** AAAA-MM-JJ → JJ/MM/AAAA pour l'affichage. */
export function formatIsoFr(iso: string | undefined | null): string {
  if (!isValidIsoDate(iso)) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
