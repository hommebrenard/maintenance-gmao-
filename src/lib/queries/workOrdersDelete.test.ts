import { describe, it, expect, vi, beforeEach } from 'vitest';

const { calls, state } = vi.hoisted(() => ({
  calls: [] as { table: string; op: string; id?: string }[],
  state: { rows: [] as any[], error: null as any },
}));

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: (table: string) => ({
      delete: () => {
        const entry: { table: string; op: string; id?: string } = { table, op: 'delete' };
        calls.push(entry);
        const chain: any = {
          eq: (_col: string, v: string) => { entry.id = v; return chain; },
          select: () => chain,
          then: (res: any, rej: any) => Promise.resolve({ data: state.rows, error: state.error }).then(res, rej),
        };
        return chain;
      },
    }),
  },
}));

import { deleteWorkOrder } from './work_orders';

describe('deleteWorkOrder', () => {
  beforeEach(() => { calls.length = 0; state.rows = []; state.error = null; });

  it('supprime la bonne ligne de work_orders', async () => {
    state.rows = [{ id: 'wo1' }];
    await expect(deleteWorkOrder('wo1')).resolves.toBeUndefined();
    expect(calls[0]).toEqual({ table: 'work_orders', op: 'delete', id: 'wo1' });
  });
  it('0 ligne supprimée (RLS) → erreur explicite', async () => {
    state.rows = [];
    await expect(deleteWorkOrder('wo1')).rejects.toThrow(/refusée/);
  });
  it('erreur Supabase → propagée', async () => {
    state.error = new Error('boom');
    await expect(deleteWorkOrder('wo1')).rejects.toThrow('boom');
  });
});
