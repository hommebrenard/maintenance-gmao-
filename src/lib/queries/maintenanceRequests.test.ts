import { describe, it, expect, beforeEach, vi } from 'vitest';

const { calls, state } = vi.hoisted(() => ({
  calls: [] as { table: string; op: string; payload?: any }[],
  state: { rows: [] as any[], error: null as any },
}));

vi.mock('../supabaseClient', () => {
  const make = (table: string, op: string, payload?: any) => {
    calls.push({ table, op, payload });
    const chain: any = {
      eq: () => chain,
      order: () => chain,
      select: () => chain,
      single: () => Promise.resolve({ data: state.rows[0] ?? null, error: state.error }),
      then: (res: any, rej: any) => Promise.resolve({ data: state.rows, error: state.error }).then(res, rej),
    };
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => ({
        select: () => make(table, 'select'),
        insert: (p: any) => make(table, 'insert', p),
        update: (p: any) => make(table, 'update', p),
      }),
    },
  };
});

import {
  fetchMaintenanceRequests,
  createMaintenanceRequest,
  decideMaintenanceRequest,
  generateRequestCode,
} from './maintenanceRequests';

const ROW = {
  id: 'r1', code: 'DEM-20261005-1234', title: 'Fuite', description: null, priority: 'haute',
  status: 'en_attente', equipment_id: 'e1', location_id: null, requester_name: 'Karim A.',
  work_order_id: null, created_at: '2026-10-05T08:00:00Z',
};

describe('maintenanceRequests', () => {
  beforeEach(() => { calls.length = 0; state.rows = []; state.error = null; });

  it('lecture : enums base → libellés app, nom du rondier', async () => {
    state.rows = [ROW];
    const [r] = await fetchMaintenanceRequests();
    expect(r).toMatchObject({ id: 'r1', status: 'En attente', priority: 'Élevée', equipmentId: 'e1', requestedBy: 'Karim A.', description: '' });
  });
  it('création : snake_case, enum priorité, requested_by = utilisateur', async () => {
    state.rows = [ROW];
    await createMaintenanceRequest({ title: 'Fuite', description: '', priority: 'Urgente', equipmentId: 'e1', requesterName: 'Karim A.' }, 'u1');
    expect(calls[0].payload).toMatchObject({
      title: 'Fuite', description: null, priority: 'urgente', equipment_id: 'e1',
      location_id: null, requested_by: 'u1', requester_name: 'Karim A.',
    });
    expect(calls[0].payload.code).toMatch(/^DEM-\d{8}-\d{4}$/);
  });
  it('décision : statut enum + lien OT ; 0 ligne (RLS) → erreur', async () => {
    state.rows = [{ id: 'r1' }];
    await decideMaintenanceRequest('r1', { status: 'Approuvée', approvedBy: 'm1', workOrderId: 'w1' });
    expect(calls[0].payload).toMatchObject({ status: 'approuvee', approved_by: 'm1', work_order_id: 'w1' });
    state.rows = [];
    await expect(decideMaintenanceRequest('r1', { status: 'Rejetée', approvedBy: 'm1' })).rejects.toThrow(/refusée/);
  });
  it('code de demande au bon format', () => {
    expect(generateRequestCode(new Date('2026-10-05T10:00:00Z'))).toMatch(/^DEM-20261005-\d{4}$/);
  });
});
