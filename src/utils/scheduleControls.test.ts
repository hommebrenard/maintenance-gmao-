import { describe, it, expect } from 'vitest';
import { controlResultBadgeClass, controlResultLabel, isHttpUrl, latestLegalControl, sortControls } from './scheduleControls';
import type { MaintenanceSchedule, ScheduleControl } from '../types';

const ctl = (o: Partial<ScheduleControl>): ScheduleControl => ({
  id: 'c', equipmentId: 'e', title: 'T', performedOn: '2026-01-01', createdAt: '2026-01-01T00:00:00Z', ...o,
});
const sch = (o: Partial<MaintenanceSchedule>) => ({ id: 's', title: 'S', legalRequirement: false, ...o }) as MaintenanceSchedule;

describe('verdict du contrôleur', () => {
  it('libellés, « Non renseigné » si inconnu', () => {
    expect(controlResultLabel('conforme')).toBe('Conforme');
    expect(controlResultLabel('reserves')).toBe('Avec réserves');
    expect(controlResultLabel('non_conforme')).toBe('Non conforme');
    expect(controlResultLabel(undefined)).toBe('Non renseigné');
  });
  it('couleurs : vert / ambre / rouge / gris', () => {
    expect(controlResultBadgeClass('conforme')).toContain('green');
    expect(controlResultBadgeClass('reserves')).toContain('amber');
    expect(controlResultBadgeClass('non_conforme')).toContain('red');
    expect(controlResultBadgeClass(undefined)).toContain('gray');
  });
});

describe('sortControls / latestLegalControl', () => {
  it('le plus récent d\'abord, puis par date de saisie', () => {
    const r = sortControls([
      ctl({ id: 'a', performedOn: '2026-03-01' }),
      ctl({ id: 'b', performedOn: '2027-03-01' }),
      ctl({ id: 'c', performedOn: '2027-03-01', createdAt: '2027-03-02T00:00:00Z' }),
    ]);
    expect(r.map(c => c.id)).toEqual(['c', 'b', 'a']);
  });
  it('dernier contrôle des seules échéances réglementaires', () => {
    const schedules = [sch({ id: 'legal', legalRequirement: true }), sch({ id: 'other', legalRequirement: false })];
    const controls = [
      ctl({ id: 'x', scheduleId: 'other', performedOn: '2027-01-01' }),
      ctl({ id: 'y', scheduleId: 'legal', performedOn: '2026-06-01', result: 'reserves' }),
      ctl({ id: 'z', scheduleId: undefined, performedOn: '2028-01-01' }),
    ];
    expect(latestLegalControl(schedules, controls)?.id).toBe('y');
    expect(latestLegalControl(schedules, [])).toBeUndefined();
  });
});

describe('isHttpUrl', () => {
  it('accepte http(s) uniquement', () => {
    expect(isHttpUrl('https://ged.exemple.ma/doc/123')).toBe(true);
    expect(isHttpUrl(' http://intranet/doc ')).toBe(true);
    for (const t of ['javascript:alert(1)', 'ftp://x', 'data:text/html,x', 'ged.exemple.ma', '', 'file:///c:/x']) expect(isHttpUrl(t)).toBe(false);
  });
});
