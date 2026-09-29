import type {
  EquipmentDocumentCategory,
  EquipmentPart,
  HealthRecordEntry,
  MaintenanceSchedule,
  MaintenanceScheduleStatus,
} from '../types';

// Fonctions d'affichage pures du carnet de santé enrichi (Phase 4b, 29/09/2026).
// Règle du projet : donnée absente => « Non renseigné », jamais de valeur inventée.

export const SCHEDULE_STATUS_LABEL: Record<MaintenanceScheduleStatus, string> = {
  ok: 'À jour',
  due_soon: 'Échéance proche',
  overdue: 'En retard',
};

export function scheduleStatusLabel(status?: MaintenanceScheduleStatus): string {
  return status ? SCHEDULE_STATUS_LABEL[status] : 'Non renseigné';
}

export function scheduleStatusBadgeClass(status?: MaintenanceScheduleStatus): string {
  switch (status) {
    case 'overdue':
      return 'bg-red-100 text-red-800';
    case 'due_soon':
      return 'bg-amber-100 text-amber-800';
    case 'ok':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

/** Périodicité lisible : le libellé saisi s'il existe, sinon dérivé de l'intervalle ; undefined si rien. */
export function scheduleFrequencyLabel(s: MaintenanceSchedule): string | undefined {
  if (s.frequencyLabel && s.frequencyLabel.trim()) return s.frequencyLabel.trim();
  if (s.frequencyType === 'hours' && s.intervalHours) return `Toutes les ${s.intervalHours} h`;
  if (s.frequencyType === 'calendar' && s.intervalMonths) {
    return s.intervalMonths === 1 ? 'Tous les mois' : `Tous les ${s.intervalMonths} mois`;
  }
  return undefined;
}

const STATUS_RANK: Record<MaintenanceScheduleStatus, number> = { overdue: 0, due_soon: 1, ok: 2 };
const NO_DATE = '9999-12-31';

export interface LegalControlSummary {
  /** Pire statut parmi les contrôles réglementaires ; undefined si aucune date d'échéance renseignée. */
  status?: MaintenanceScheduleStatus;
  title: string;
  date?: string;
  /** Nombre total de contrôles réglementaires de l'équipement. */
  count: number;
}

/** Synthèse « Contrôle réglementaire » : null s'il n'existe aucune échéance réglementaire. */
export function summarizeLegalControl(schedules: MaintenanceSchedule[]): LegalControlSummary | null {
  const legal = schedules.filter(s => s.legalRequirement);
  if (legal.length === 0) return null;
  const rank = (s: MaintenanceSchedule) => (s.status ? STATUS_RANK[s.status] : 3);
  const worst = [...legal].sort(
    (a, b) => rank(a) - rank(b) || (a.nextDueDate ?? NO_DATE).localeCompare(b.nextDueDate ?? NO_DATE)
  )[0];
  return { status: worst.status, title: worst.title, date: worst.nextDueDate, count: legal.length };
}

/** Échéance la plus proche (date la plus ancienne, y compris dépassée) ; null si aucune date renseignée. */
export function pickNextDue(schedules: MaintenanceSchedule[]): MaintenanceSchedule | null {
  const dated = schedules.filter(s => s.nextDueDate);
  if (dated.length === 0) return null;
  return [...dated].sort((a, b) => a.nextDueDate!.localeCompare(b.nextDueDate!))[0];
}

/**
 * Anomalies signalées dans le carnet. Volontairement « signalées » et non « ouvertes » :
 * aucune fonction de clôture n'existe encore (correction_de_id non exploité), donc on ne
 * peut pas affirmer qu'une anomalie est toujours ouverte.
 */
export function summarizeAnomalies(entries: HealthRecordEntry[]): { count: number; lastDate?: string } {
  const anomalies = entries.filter(e => e.eventType === 'Anomalie');
  const lastDate = anomalies.map(e => e.eventDate).sort().pop();
  return { count: anomalies.length, lastDate };
}

export const DOCUMENT_CATEGORY_LABEL: Record<EquipmentDocumentCategory, string> = {
  manual: 'Manuel',
  certificate: 'Certificat',
  diagram: 'Schéma',
  report: 'Rapport',
  procedure: 'Procédure',
};

export function documentCategoryLabel(category?: EquipmentDocumentCategory): string {
  return category ? DOCUMENT_CATEGORY_LABEL[category] ?? category : 'Non classé';
}

/** 1234 -> « 1 Ko », 2 500 000 -> « 2,4 Mo » ; undefined si taille inconnue. */
export function formatFileSize(bytes?: number): string | undefined {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return undefined;
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

/** Stock sous le seuil mini. Seuil 0 (valeur par défaut en base) = pas de seuil défini, donc jamais d'alerte. */
export function isLowStock(part: Pick<EquipmentPart, 'stock' | 'minStock'>): boolean {
  return part.minStock > 0 && part.stock <= part.minStock;
}

export function formatQuantity(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

export function formatPrice(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
