import { describe, it, expect } from 'vitest';
import { formatDateFr, toDetailRow, sortDetailRows, matchesDetailSearch } from './reportTable';

const wo = (o: any) => ({ id: o.code, status: 'Ouvert', priority: 'Moyenne', ...o }) as any;

describe('reportTable', () => {
  it('formate la date en JJ/MM/AAAA', () => {
    expect(formatDateFr('2026-06-29')).toBe('29/06/2026');
    expect(formatDateFr('')).toBe('—');
    expect(formatDateFr(undefined)).toBe('—');
  });
  it('déduit famille, lot et fréquence', () => {
    const r = toDetailRow(wo({ code: 'OT-1', equipmentCode: 'BAM-KNT_AG-ASC-01', title: 'PREVENTIF SYSTEMATIQUE HEBDOMADAIRE ASCENSEUR' }));
    expect(r.family).toBe('ASC');
    expect(r.lot).toBe('CIRC');
    expect(r.freq).toBe('H');
  });
  it('tri par échéance, sens inversé, vides en fin dans les deux sens', () => {
    const rows = [
      toDetailRow(wo({ code: 'B', dueDate: '2026-05-10' })),
      toDetailRow(wo({ code: 'X', dueDate: '' })),
      toDetailRow(wo({ code: 'A', dueDate: '2026-04-02' })),
    ];
    expect(sortDetailRows(rows, 'dueDate', 'asc').map(r => r.wo.code)).toEqual(['A', 'B', 'X']);
    expect(sortDetailRows(rows, 'dueDate', 'desc').map(r => r.wo.code)).toEqual(['B', 'A', 'X']);
  });
  it('tri numérique naturel des codes et par fréquence H<M<T<S<A', () => {
    const rows = [toDetailRow(wo({ code: 'OT-105' })), toDetailRow(wo({ code: 'OT-94' }))];
    expect(sortDetailRows(rows, 'code', 'asc').map(r => r.wo.code)).toEqual(['OT-94', 'OT-105']);
    const f = [
      toDetailRow(wo({ code: '1', title: 'PREVENTIF SYSTEMATIQUE ANNUEL X' })),
      toDetailRow(wo({ code: '2', title: 'PREVENTIF SYSTEMATIQUE HEBDOMADAIRE X' })),
    ];
    expect(sortDetailRows(f, 'freq', 'asc').map(r => r.wo.code)).toEqual(['2', '1']);
  });
  it('recherche sur code, titre, équipement, site, intervenant', () => {
    const r = toDetailRow(wo({ code: 'OT-1', title: 'MENSUEL EXTRACTEUR', location: 'AG Type A KENITRA', planner: 'AMARA OMAR' }));
    expect(matchesDetailSearch(r, 'kenitra')).toBe(true);
    expect(matchesDetailSearch(r, 'amara')).toBe(true);
    expect(matchesDetailSearch(r, 'zzz')).toBe(false);
    expect(matchesDetailSearch(r, '  ')).toBe(true);
  });
});
