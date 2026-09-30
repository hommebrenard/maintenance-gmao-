import type { MaintenanceSchedule, MaintenanceScheduleStatus } from '../types';

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

const ISO_FULL = /^(\d{4})-(\d{2})-(\d{2})$/;

/** true si la chaîne est une vraie date calendaire YYYY-MM-DD (le 2026-02-30 est refusé). */
export function isValidIsoDate(iso: string | null | undefined): iso is string {
  if (!iso) return false;
  const m = ISO_FULL.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Ajoute `months` mois (entier > 0) à une date YYYY-MM-DD. Le jour est ramené à la fin du
 * mois d'arrivée si besoin (31/01 + 1 mois = 28/02, ou 29/02 en année bissextile).
 * Utilisé pour PROPOSER la prochaine échéance ; undefined si l'entrée est invalide.
 */
export function addMonthsToIsoDate(iso: string, months: number): string | undefined {
  if (!isValidIsoDate(iso) || !Number.isInteger(months) || months <= 0) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/** Même ordre que la lecture en base : échéance la plus proche d'abord, sans date en dernier. */
export function sortSchedules(items: MaintenanceSchedule[]): MaintenanceSchedule[] {
  return [...items].sort((a, b) => {
    if (!a.nextDueDate && !b.nextDueDate) return 0;
    if (!a.nextDueDate) return 1;
    if (!b.nextDueDate) return -1;
    return a.nextDueDate.localeCompare(b.nextDueDate);
  });
}

/** « 3:30 » ou « 03:30 » -> 210 minutes ; undefined si invalide ou nul (max 99:59). */
export function parseDurationHHMM(text: string): number | undefined {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(text.trim());
  if (!m) return undefined;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes > 0 ? minutes : undefined;
}

/** 210 -> « 03:30 » (valeur du champ de saisie). */
export function minutesToHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** 210 -> « 3 h 30 » (affichage). */
export function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}
