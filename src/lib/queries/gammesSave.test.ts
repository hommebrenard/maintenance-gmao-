import { describe, it, expect, vi, beforeEach } from 'vitest';

const { state } = vi.hoisted(() => ({
  state: {
    calls: [] as { size: number; opts: any }[],
    existing: new Set<string>(),
    failAtCall: -1,
  },
}));

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: () => ({
      upsert: (batch: any[], opts: any) => {
        const callIndex = state.calls.length;
        state.calls.push({ size: batch.length, opts });
        const chain: any = {
          select: () => chain,
          then: (res: any, rej: any) => {
            if (callIndex === state.failAtCall) {
              return Promise.resolve({ data: null, error: { message: 'timeout' } }).then(res, rej);
            }
            const rows = opts.ignoreDuplicates
              ? batch.filter(r => !state.existing.has(`${r.equipment_code}::${r.plan_code}`))
              : batch;
            return Promise.resolve({ data: rows, error: null }).then(res, rej);
          },
        };
        return chain;
      },
    }),
  },
}));

import { saveGammePlans } from './gammes';
import type { GammePlan } from '../../types';

const mk = (n: number): GammePlan[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `g${i}`, equipmentCode: `E${i}`, planCode: 'P1', interventionTitle: 't', tasks: [],
  } as GammePlan));

describe('saveGammePlans', () => {
  beforeEach(() => { state.calls.length = 0; state.existing = new Set(); state.failAtCall = -1; });

  it('écrit par lots de 200 et compte les lignes réellement écrites', async () => {
    const r = await saveGammePlans(mk(450), { insertOnly: false });
    expect(state.calls.map(c => c.size)).toEqual([200, 200, 50]);
    expect(r.written).toHaveLength(450);
    expect(r.error).toBeUndefined();
  });

  it('ajout seul : ignoreDuplicates activé, les couples existants sont comptés comme ignorés', async () => {
    state.existing = new Set(['E0::P1', 'E1::P1']);
    const r = await saveGammePlans(mk(5), { insertOnly: true });
    expect(state.calls[0].opts.ignoreDuplicates).toBe(true);
    expect(r.written).toHaveLength(3);
    expect(r.ignoredExisting).toBe(2);
  });

  it('mode remplacer : ignoreDuplicates désactivé', async () => {
    await saveGammePlans(mk(2), { insertOnly: false });
    expect(state.calls[0].opts.ignoreDuplicates).toBe(false);
  });

  it('erreur au 2e lot : bilan partiel, lots suivants non écrits, erreur remontée (pas d\'exception)', async () => {
    state.failAtCall = 1;
    const r = await saveGammePlans(mk(450), { insertOnly: true });
    expect(state.calls).toHaveLength(2);
    expect(r.written).toHaveLength(200);
    expect(r.notWritten).toBe(250);
    expect(r.error).toBe('timeout');
  });

  it('retire les doublons du fichier avant l\'écriture (un lot sans doublon)', async () => {
    const plans = [...mk(3), ...mk(3)];
    const r = await saveGammePlans(plans, { insertOnly: true });
    expect(state.calls[0].size).toBe(3);
    expect(r.duplicatesInFile).toBe(3);
    expect(r.total).toBe(3);
  });

  it('fichier vide : aucun appel à la base', async () => {
    const r = await saveGammePlans([], { insertOnly: true });
    expect(state.calls).toHaveLength(0);
    expect(r.total).toBe(0);
  });
});
