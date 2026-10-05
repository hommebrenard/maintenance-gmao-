import { describe, it, expect } from 'vitest';
import { responsibleOf } from './workOrderResponsible';

describe('responsibleOf', () => {
  it('intervenants saisis en priorité, noms distincts joints par « / »', () => {
    expect(responsibleOf({ intervenantsLogs: [{ id: '1', name: 'Yassine', timeSpent: '00:00' }, { id: '2', name: 'Yassine', timeSpent: '00:00' }, { id: '3', name: 'Moha', timeSpent: '00:00' }], assignee: 'compte', planner: 'P' })).toBe('Yassine / Moha');
  });
  it('sans intervenant : compte assigné, puis planificateur importé', () => {
    expect(responsibleOf({ assignee: 'compte', planner: 'P' })).toBe('compte');
    expect(responsibleOf({ planner: 'AMARA OMAR' })).toBe('AMARA OMAR');
  });
  it('intervenant vide ignoré ; rien de renseigné → chaîne vide', () => {
    expect(responsibleOf({ intervenantsLogs: [{ id: '1', name: '  ', timeSpent: '00:00' }], planner: 'P' })).toBe('P');
    expect(responsibleOf({})).toBe('');
  });
});
