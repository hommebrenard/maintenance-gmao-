import { describe, it, expect } from 'vitest';
import { buildAnnualMatrix, availableYears, isoWeekOf, weekColumns } from './annualMatrix';
import type { WorkOrder } from '../types';

const wo = (o: Partial<WorkOrder>): WorkOrder => ({
  id: o.code || 'x', code: 'OT-1', title: 't', description: '', status: 'Ouvert', priority: 'Moyenne',
  type: 'Préventive', dueDate: '2026-03-10', createdAt: '', updatedAt: '', equipmentId: 'e1', equipmentName: 'ASCENSEUR N1', ...o,
} as WorkOrder);

const TODAY = '2026-06-15';

describe('buildAnnualMatrix', () => {
  it('compte par équipement et par mois, ignore les annulés et les autres années', () => {
    const m = buildAnnualMatrix([
      wo({ code: 'A', dueDate: '2026-03-10', status: 'Terminé' }),
      wo({ code: 'B', dueDate: '2026-03-20', status: 'Terminé' }),
      wo({ code: 'C', dueDate: '2026-03-25', status: 'Annulé' }),
      wo({ code: 'D', dueDate: '2025-03-25', status: 'Terminé' }),
      wo({ code: 'E', dueDate: '2026-04-01', status: 'Ouvert', equipmentId: 'e2', equipmentName: 'AR 1' }),
    ], 2026, TODAY);
    expect(m.rows.map(r => r.label)).toEqual(['AR 1', 'ASCENSEUR N1']);
    const asc = m.rows[1];
    expect(asc.cells[2]).toMatchObject({ total: 2, done: 2, state: 'done' });
    expect(asc.percent).toBe(100);
    expect(m.grand).toMatchObject({ total: 3, done: 2 });
  });

  it('états : en retard > partiel > à venir', () => {
    const m = buildAnnualMatrix([
      wo({ code: 'A', dueDate: '2026-05-10', status: 'Ouvert' }),                       // mai : retard
      wo({ code: 'B', dueDate: '2026-06-01', status: 'Terminé' }),
      wo({ code: 'C', dueDate: '2026-06-30', status: 'Ouvert' }),                       // juin : partiel (échéance future)
      wo({ code: 'D', dueDate: '2026-09-01', status: 'En cours' }),                     // sept : à venir
    ], 2026, TODAY);
    const c = m.rows[0].cells;
    expect(c[4].state).toBe('overdue');
    expect(c[5].state).toBe('partial');
    expect(c[8].state).toBe('pending');
    expect(c[0].state).toBe('none');
    expect(m.rows[0].overdue).toBe(1);
  });

  it('regroupe les OT sans équipement et liste les années disponibles', () => {
    const orders = [
      wo({ code: 'A', equipmentId: undefined, equipmentName: undefined, equipmentCode: undefined, dueDate: '2026-01-05' }),
      wo({ code: 'B', dueDate: '2025-12-31' }),
      wo({ code: 'C', dueDate: '' }),
    ];
    expect(buildAnnualMatrix(orders, 2026, TODAY).rows[0].label).toBe('Sans équipement');
    expect(availableYears(orders)).toEqual([2026, 2025]);
  });
});

describe('semaines ISO', () => {
  it('numérote correctement les semaines (cas limites de début/fin d\'année)', () => {
    expect(isoWeekOf('2026-01-01')).toEqual({ year: 2026, week: 1 });
    expect(isoWeekOf('2026-06-15')).toEqual({ year: 2026, week: 25 });
    expect(isoWeekOf('2026-12-31')).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf('2027-01-01')).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf('2024-12-30')).toEqual({ year: 2025, week: 1 });
  });

  it('52 ou 53 colonnes, chaque semaine rattachée à un mois', () => {
    expect(weekColumns(2026)).toHaveLength(53);
    expect(weekColumns(2025)).toHaveLength(52);
    const cols = weekColumns(2026);
    expect(cols[0].monthIndex).toBe(0);
    expect(cols[52].monthIndex).toBe(11);
  });

  it('mode semaine : place l\'OT dans sa semaine et repère la semaine courante', () => {
    const m = buildAnnualMatrix([
      wo({ code: 'A', dueDate: '2026-06-16', status: 'Ouvert' }),   // semaine 25, en retard? non (aujourd'hui = 06-15)
      wo({ code: 'B', dueDate: '2026-06-10', status: 'Ouvert' }),   // semaine 24, en retard
      wo({ code: 'C', dueDate: '2026-06-11', status: 'Terminé' }),  // semaine 24, clôturé
    ], 2026, '2026-06-15', 'week');
    expect(m.columns).toHaveLength(53);
    expect(m.currentIndex).toBe(24);                 // semaine 25
    const c = m.rows[0].cells;
    expect(c[24]).toMatchObject({ total: 1, state: 'pending' });
    expect(c[23]).toMatchObject({ total: 2, done: 1, state: 'overdue' });
  });

  it('mode mois : repère le mois courant, null si l\'année affichée est différente', () => {
    expect(buildAnnualMatrix([], 2026, '2026-06-15').currentIndex).toBe(5);
    expect(buildAnnualMatrix([], 2025, '2026-06-15').currentIndex).toBeNull();
  });
});
