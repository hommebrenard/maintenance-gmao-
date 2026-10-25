import { describe, it, expect, beforeEach, vi } from 'vitest';

const { calls, state } = vi.hoisted(() => ({
  calls: [] as { table: string; op: string; payload?: any }[],
  state: { rows: [] as any[], error: null as any, queue: [] as any[] },
}));

vi.mock('../supabaseClient', () => {
  const make = (table: string, op: string, payload?: any) => {
    calls.push({ table, op, payload });
    const chain: any = {
      eq: () => chain,
      order: () => chain,
      range: (from: number, to: number) => Promise.resolve({ data: state.rows.slice(from, to + 1), error: state.error }),
      select: () => chain,
      single: () => {
        const error = state.queue.length ? state.queue.shift() : state.error;
        return Promise.resolve({ data: error ? null : (state.rows[0] ?? null), error });
      },
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
  updateRequestRejectionReason,
  generateRequestCode,
} from './maintenanceRequests';

const ROW = {
  id: 'r1', code: 'DEM-20261005-1234', title: 'Fuite', description: null, priority: 'haute',
  status: 'en_attente', equipment_id: 'e1', location_id: null, requester_name: 'Karim A.',
  work_order_id: null, created_at: '2026-10-05T08:00:00Z',
};

describe('maintenanceRequests', () => {
  beforeEach(() => { calls.length = 0; state.rows = []; state.error = null; state.queue = []; });

  it('lecture paginée : plus de 1000 demandes toutes récupérées (heure Coswin affichée telle quelle)', async () => {
    state.rows = Array.from({ length: 2354 }, (_, i) => ({ ...ROW, id: 'r' + i, code: 'DI' + i, origin: 'coswin', created_at: '2026-01-05T16:39:00+00:00' }));
    const res = await fetchMaintenanceRequests();
    expect(res).toHaveLength(2354);
    expect(res[0].createdAt).toContain('16:39');
  });

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
  it('création : date de déclaration et date de fin proposée envoyées', async () => {
    state.rows = [{ ...ROW, proposed_due_date: '2026-11-01' }];
    const created = await createMaintenanceRequest({
      title: 'Fuite', description: '', priority: 'Moyenne', equipmentId: 'e1', requesterName: 'Karim A.',
      declaredAt: '2026-10-25T10:00:00.000Z', proposedDueDate: '2026-11-01',
    }, 'u1');
    expect(calls[0].payload).toMatchObject({ declared_at: '2026-10-25T10:00:00.000Z', proposed_due_date: '2026-11-01' });
    expect(created.proposedDueDate).toBe('2026-11-01');
    // aucun champ réservé à Coswin ou au manager n'est envoyé (le déclencheur de la base les refuserait)
    for (const k of ['status', 'origin', 'due_date', 'approved_by', 'work_order_id', 'priority_code']) {
      expect(Object.keys(calls[0].payload)).not.toContain(k);
    }
  });
  it('création : source de constatation, DAF, superviseur et courriel envoyés (ou null)', async () => {
    state.rows = [ROW];
    await createMaintenanceRequest({
      title: 'Fuite', description: '', priority: 'Moyenne', equipmentId: 'e1', requesterName: 'K',
      interventionType: 'CSR', dafNumber: ' DAF-2026-104 ', supervisorName: 'YBADI', requesterEmail: ' k@exemple.ma ',
    }, 'u1');
    expect(calls[0].payload).toMatchObject({ intervention_type: 'CSR', daf_number: 'DAF-2026-104', supervisor_name: 'YBADI', requester_email: 'k@exemple.ma' });
    calls.length = 0;
    await createMaintenanceRequest({ title: 'F', description: '', priority: 'Moyenne', equipmentId: 'e1', requesterName: 'K' }, 'u1');
    expect(calls[0].payload).toMatchObject({ intervention_type: null, daf_number: null, supervisor_name: null, requester_email: null });
  });
  it('création : code déjà pris (23505 sur code) → nouvel essai avec un autre code, puis succès', async () => {
    state.rows = [ROW];
    state.queue = [{ code: '23505', message: 'duplicate key value violates unique constraint "maintenance_requests_code_key"' }, null];
    await createMaintenanceRequest({ title: 'Fuite', description: '', priority: 'Moyenne', equipmentId: 'e1', requesterName: 'K' }, 'u1');
    expect(calls.filter(c => c.op === 'insert')).toHaveLength(2);
  });
  it('création : 3 codes en collision → erreur ; autre erreur → pas de nouvel essai', async () => {
    const dup = { code: '23505', message: 'duplicate key ... maintenance_requests_code_key' };
    state.queue = [dup, dup, dup];
    await expect(createMaintenanceRequest({ title: 'F', description: '', priority: 'Moyenne', equipmentId: 'e1', requesterName: 'K' }, 'u1')).rejects.toBeTruthy();
    expect(calls.filter(c => c.op === 'insert')).toHaveLength(3);
    calls.length = 0;
    state.queue = [{ code: '42501', message: 'Insertion refusée' }];
    await expect(createMaintenanceRequest({ title: 'F', description: '', priority: 'Moyenne', equipmentId: 'e1', requesterName: 'K' }, 'u1')).rejects.toBeTruthy();
    expect(calls.filter(c => c.op === 'insert')).toHaveLength(1);
  });
  it('décision : la date retenue est écrite dans due_date seulement si elle est fournie', async () => {
    state.rows = [{ id: 'r1' }];
    await decideMaintenanceRequest('r1', { status: 'Approuvée', approvedBy: 'm1', workOrderId: 'w1', dueDate: '2026-11-03' });
    expect(calls[0].payload).toMatchObject({ due_date: '2026-11-03' });
    calls.length = 0;
    await decideMaintenanceRequest('r1', { status: 'Approuvée', approvedBy: 'm1', workOrderId: 'w1' });
    expect(Object.keys(calls[0].payload)).not.toContain('due_date');
  });
  it('décision : statut enum + lien OT ; 0 ligne (RLS) → erreur', async () => {
    state.rows = [{ id: 'r1' }];
    await decideMaintenanceRequest('r1', { status: 'Approuvée', approvedBy: 'm1', workOrderId: 'w1' });
    expect(calls[0].payload).toMatchObject({ status: 'approuvee', approved_by: 'm1', work_order_id: 'w1' });
    state.rows = [];
    await expect(decideMaintenanceRequest('r1', { status: 'Rejetée', approvedBy: 'm1' })).rejects.toThrow(/refusée/);
  });
  it('rejet avec motif : rejection_reason écrit avec la décision ; motif seul ne touche ni statut ni décision', async () => {
    state.rows = [{ id: 'r1' }];
    await decideMaintenanceRequest('r1', { status: 'Rejetée', approvedBy: 'm1', rejectionReason: 'Doublon' });
    expect(calls[0].payload).toMatchObject({ status: 'rejetee', approved_by: 'm1', rejection_reason: 'Doublon' });
    calls.length = 0;
    await updateRequestRejectionReason('r1', '  Hors contrat  ');
    expect(calls[0].payload).toEqual({ rejection_reason: 'Hors contrat' });
    await updateRequestRejectionReason('r1', '   ');
    expect(calls[1].payload).toEqual({ rejection_reason: null });
    state.rows = [];
    await expect(updateRequestRejectionReason('r1', 'x')).rejects.toThrow(/refusée/);
  });
  it('lecture : motif de rejet exposé', async () => {
    state.rows = [{ ...ROW, status: 'rejetee', rejection_reason: 'Doublon' }];
    expect((await fetchMaintenanceRequests())[0].rejectionReason).toBe('Doublon');
  });
  it('code de demande au bon format', () => {
    expect(generateRequestCode(new Date('2026-10-05T10:00:00Z'))).toMatch(/^DEM-20261005-\d{4}$/);
  });
});
