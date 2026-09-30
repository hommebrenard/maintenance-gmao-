import type { ControlResult, MaintenanceSchedule, ScheduleControl } from '../types';

// Utilitaires purs des contrôles réalisés (30/09/2026). Verdict inconnu = « Non renseigné ».

const RESULT_LABEL: Record<ControlResult, string> = {
  conforme: 'Conforme',
  reserves: 'Avec réserves',
  non_conforme: 'Non conforme',
};

export const CONTROL_RESULTS: ControlResult[] = ['conforme', 'reserves', 'non_conforme'];

export function controlResultLabel(result?: ControlResult): string {
  return result ? RESULT_LABEL[result] ?? 'Non renseigné' : 'Non renseigné';
}

export function controlResultBadgeClass(result?: ControlResult): string {
  switch (result) {
    case 'conforme': return 'bg-green-100 text-green-800';
    case 'reserves': return 'bg-amber-100 text-amber-800';
    case 'non_conforme': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-600';
  }
}

/** Le plus récent d'abord (date du contrôle, puis date de saisie). */
export function sortControls(items: ScheduleControl[]): ScheduleControl[] {
  return [...items].sort(
    (a, b) => b.performedOn.localeCompare(a.performedOn) || b.createdAt.localeCompare(a.createdAt)
  );
}

/** Dernier contrôle réalisé parmi les échéances réglementaires (pour la carte de la Synthèse). */
export function latestLegalControl(schedules: MaintenanceSchedule[], controls: ScheduleControl[]): ScheduleControl | undefined {
  const legalIds = new Set(schedules.filter(s => s.legalRequirement).map(s => s.id));
  return sortControls(controls.filter(c => c.scheduleId && legalIds.has(c.scheduleId)))[0];
}

/** Seuls les liens http(s) sont acceptés et affichés comme liens (jamais javascript: ni autre schéma). */
export function isHttpUrl(text: string): boolean {
  try {
    const u = new URL(text.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
