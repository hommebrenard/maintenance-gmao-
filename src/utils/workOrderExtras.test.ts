import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkOrder, WorkOrderTask } from '../types';

// Faux client Supabase : capture les charges utiles envoyées, sans réseau.
const { calls, ROW } = vi.hoisted(() => ({
  calls: [] as { op: 'insert' | 'update'; payload: any }[],
  ROW: {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'OT-1',
    title: 'Contrôle',
    description: null,
    type: 'preventive',
    priority: 'moyenne',
    status: 'ouvert',
    equipment_id: null,
    location_id: null,
    planner: null,
    due_date: '2026-06-15',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    equipment: null,
    locations: null,
    profiles: null,
    tasks: null,
    intervenants_logs: null,
    visa: null,
    start_date: null,
    start_time: null,
    end_date: null,
    end_time: null,
  } as Record<string, unknown>,
}));

vi.mock('../lib/supabaseClient', () => {
  const chainFor = (bulk: boolean) => {
    const result = { data: bulk ? [ROW] : ROW, error: null };
    const chain: any = {
      eq: () => chain,
      select: () => chain,
      single: () => Promise.resolve(result),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  };
  return {
    supabase: {
      from: () => ({
        insert: (payload: any) => {
          calls.push({ op: 'insert', payload });
          return chainFor(Array.isArray(payload));
        },
        update: (payload: any) => {
          calls.push({ op: 'update', payload });
          return chainFor(false);
        },
      }),
    },
  };
});

import {
  extrasToRow,
  rowToExtras,
  mergeWorkOrderWithLocalExtras,
  computeLocalBackfillPatch,
  hasTaskWork,
  hasIntervenantWork,
} from './workOrderExtras';
import { updateWorkOrder, createWorkOrder, createWorkOrdersBulk } from '../lib/queries/work_orders';

function makeWO(partial: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'wo-1',
    code: 'OT-1',
    title: 'Contrôle',
    description: '',
    status: 'Ouvert',
    priority: 'Moyenne',
    type: 'Préventive',
    dueDate: '2026-06-15',
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}
const task = (over: Partial<WorkOrderTask> = {}): WorkOrderTask => ({
  id: 'task-1-0-123',
  code: '1',
  label: 'Vérifier',
  completed: false,
  ...over,
});

beforeEach(() => {
  calls.length = 0;
});

describe('extrasToRow', () => {
  it('convertit les 7 champs vers les colonnes Supabase', () => {
    const tasks = [task({ completed: true })];
    const logs = [{ id: '1', name: 'AMARA', timeSpent: '01:30' }];
    expect(
      extrasToRow({
        tasks,
        intervenantsLogs: logs,
        visa: 'OA',
        startDate: '2026-06-11',
        startTime: '08:00',
        endDate: '2026-06-11',
        endTime: '09:30',
      })
    ).toEqual({
      tasks,
      intervenants_logs: logs,
      visa: 'OA',
      start_date: '2026-06-11',
      start_time: '08:00',
      end_date: '2026-06-11',
      end_time: '09:30',
    });
  });

  it("n'écrit que les champs présents (un champ absent n'est jamais effacé)", () => {
    expect(extrasToRow({ status: 'Terminé' })).toEqual({});
    expect(extrasToRow({ visa: 'OA' })).toEqual({ visa: 'OA' });
  });

  it("transforme les dates vides/invalides en null (une colonne date refuse '')", () => {
    expect(extrasToRow({ startDate: '', endDate: 'demain' })).toEqual({ start_date: null, end_date: null });
    expect(extrasToRow({ startDate: '2026-06-11T00:00:00Z' })).toEqual({ start_date: '2026-06-11' });
  });

  it("visa et heures effacés s'écrivent '' (effacé volontairement), pas NULL (jamais enregistré)", () => {
    expect(extrasToRow({ startTime: '', endTime: '  ', visa: ' ' })).toEqual({
      start_time: '',
      end_time: '',
      visa: '',
    });
    expect(extrasToRow({ visa: '  OA  ' })).toEqual({ visa: 'OA' });
  });
});

describe('rowToExtras', () => {
  it('NULL en base => champ absent ; valeurs présentes reprises', () => {
    expect(rowToExtras({ tasks: null, visa: null, start_date: null })).toEqual({});
    expect(
      rowToExtras({ tasks: [], visa: '', start_date: '2026-06-11', start_time: '08:00', intervenants_logs: [] })
    ).toEqual({ tasks: [], visa: '', startDate: '2026-06-11', startTime: '08:00', intervenantsLogs: [] });
  });
});

describe('mergeWorkOrderWithLocalExtras', () => {
  it("la valeur de la base l'emporte sur la valeur locale", () => {
    const db = makeWO({ visa: 'BASE', tasks: [task({ label: 'base' })] });
    const local = { visa: 'LOCAL', tasks: [task({ label: 'local' })], planNumber: 'P1', interventionCode: 'PS-1' };
    const merged = mergeWorkOrderWithLocalExtras(db, local);
    expect(merged.visa).toBe('BASE');
    expect(merged.tasks?.[0].label).toBe('base');
    expect(merged.planNumber).toBe('P1'); // champ encore local : repris
    expect(merged.interventionCode).toBe('PS-1');
  });

  it("garde la valeur locale quand la base n'a rien", () => {
    const merged = mergeWorkOrderWithLocalExtras(makeWO(), { visa: 'LOCAL', startTime: '08:00' });
    expect(merged.visa).toBe('LOCAL');
    expect(merged.startTime).toBe('08:00');
  });

  it("une valeur de base vide ('') compte comme enregistrée et l'emporte", () => {
    expect(mergeWorkOrderWithLocalExtras(makeWO({ visa: '' }), { visa: 'LOCAL' }).visa).toBe('');
  });

  it('sans extras locaux : OT inchangé', () => {
    const db = makeWO({ visa: 'X' });
    expect(mergeWorkOrderWithLocalExtras(db)).toEqual(db);
  });
});

describe('hasTaskWork / hasIntervenantWork', () => {
  it('ignore la checklist copiée de la Gamme sans travail', () => {
    expect(hasTaskWork([task(), task({ id: 'task-1-1-9' })])).toBe(false);
    expect(hasTaskWork(undefined)).toBe(false);
  });
  it('détecte coché, commentaire, anomalie, action ajoutée à la main', () => {
    expect(hasTaskWork([task({ completed: true })])).toBe(true);
    expect(hasTaskWork([task({ comment: 'fuite' })])).toBe(true);
    expect(hasTaskWork([task({ isAnomaly: true })])).toBe(true);
    expect(hasTaskWork([task({ id: 'task-custom-42' })])).toBe(true);
  });
  it("ignore l'intervenant par défaut vide, détecte nom ou temps saisi", () => {
    expect(hasIntervenantWork([{ id: '1', name: '', timeSpent: '00:00' }])).toBe(false);
    expect(hasIntervenantWork([{ id: '1', name: 'AMARA', timeSpent: '00:00' }])).toBe(true);
    expect(hasIntervenantWork([{ id: '1', name: '', timeSpent: '02:15' }])).toBe(true);
  });
});

describe('computeLocalBackfillPatch', () => {
  it('pousse le travail local quand la base est vide', () => {
    const patch = computeLocalBackfillPatch(makeWO(), {
      tasks: [task({ completed: true })],
      visa: 'OA',
      startTime: '08:00',
      endTime: '09:00',
      startDate: '2026-06-11',
      endDate: '2026-06-11',
      intervenantsLogs: [{ id: '1', name: 'AMARA', timeSpent: '01:00' }],
    });
    expect(Object.keys(patch).sort()).toEqual(
      ['endDate', 'endTime', 'intervenantsLogs', 'startDate', 'startTime', 'tasks', 'visa'].sort()
    );
  });

  it("n'écrase jamais une valeur déjà en base", () => {
    const db = makeWO({ visa: 'BASE', tasks: [task()], startTime: '07:00' });
    const patch = computeLocalBackfillPatch(db, {
      visa: 'LOCAL',
      tasks: [task({ completed: true })],
      startTime: '08:00',
    });
    expect(patch).toEqual({});
  });

  it("n'envoie ni valeurs par défaut ni checklist non travaillée", () => {
    const patch = computeLocalBackfillPatch(makeWO(), {
      tasks: [task(), task({ id: 'task-1-1-9' })],
      intervenantsLogs: [{ id: '1', name: '', timeSpent: '00:00' }],
      visa: '',
      startTime: '',
      endTime: '',
      startDate: '2026-06-15',
      endDate: '2026-06-15',
    });
    expect(patch).toEqual({});
  });

  it("ne ressuscite pas un visa/des heures effacés (base = '') depuis une ancienne copie locale", () => {
    const db = makeWO({ visa: '', startTime: '', endTime: '', intervenantsLogs: [{ id: '1', name: '', timeSpent: '00:00' }] });
    const stale = {
      visa: 'TEST',
      startTime: '08:00',
      endTime: '09:00',
      startDate: '2026-06-29',
      endDate: '2026-06-29',
      intervenantsLogs: [{ id: '1', name: '', timeSpent: '01:00' }],
    };
    expect(computeLocalBackfillPatch(db, stale)).toEqual({});
    // et à l'affichage, la base (même vide) l'emporte sur la copie locale
    const merged = mergeWorkOrderWithLocalExtras(db, stale);
    expect(merged.visa).toBe('');
    expect(merged.startTime).toBe('');
    expect(merged.endTime).toBe('');
  });

  it("n'envoie pas les dates seules (sans heures rattrapées dans le même envoi)", () => {
    const patch = computeLocalBackfillPatch(makeWO({ startTime: '', endTime: '' }), {
      startTime: '08:00',
      endTime: '09:00',
      startDate: '2026-06-29',
      endDate: '2026-06-29',
    });
    expect(patch).toEqual({});
  });

  it('sans extras locaux : rien à pousser', () => {
    expect(computeLocalBackfillPatch(makeWO(), undefined)).toEqual({});
  });
});

describe('écriture Supabase (client simulé)', () => {
  it('updateWorkOrder envoie checklist/visa/temps avec les champs cœur', async () => {
    const tasks = [task({ completed: true })];
    await updateWorkOrder(ROW.id as string, { status: 'En cours', tasks, visa: 'OA', startTime: '08:00', startDate: '' });
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe('update');
    expect(calls[0].payload).toEqual({
      status: 'en_cours',
      tasks,
      visa: 'OA',
      start_time: '08:00',
      start_date: null,
    });
  });

  it("updateWorkOrder : effacer visa et heures écrit '' (pas NULL) pour qu'un autre poste ne les remette pas", async () => {
    await updateWorkOrder(ROW.id as string, { visa: '', startTime: '', endTime: '' });
    expect(calls[0].payload).toEqual({ visa: '', start_time: '', end_time: '' });
  });

  it("updateWorkOrder d'un simple changement de statut n'efface aucune colonne d'extras", async () => {
    await updateWorkOrder(ROW.id as string, { status: 'Terminé' });
    expect(calls[0].payload).toEqual({ status: 'termine' });
  });

  it('createWorkOrder envoie les extras fournis', async () => {
    await createWorkOrder(
      makeWO({ visa: 'OA', intervenantsLogs: [{ id: '1', name: 'AMARA', timeSpent: '00:00' }], startDate: '2026-06-15' }),
      'user-1'
    );
    const p = calls[0].payload;
    expect(calls[0].op).toBe('insert');
    expect(p.visa).toBe('OA');
    expect(p.intervenants_logs).toEqual([{ id: '1', name: 'AMARA', timeSpent: '00:00' }]);
    expect(p.start_date).toBe('2026-06-15');
    expect(p.created_by).toBe('user-1');
  });

  it("createWorkOrdersBulk (import) n'écrit PAS la checklist copiée de la Gamme", async () => {
    await createWorkOrdersBulk([makeWO({ tasks: [task()], visa: 'X', startTime: '08:00' })], 'user-1');
    const [row] = calls[0].payload;
    expect(row).not.toHaveProperty('tasks');
    expect(row).not.toHaveProperty('visa');
    expect(row).not.toHaveProperty('start_time');
    expect(row.title).toBe('Contrôle');
  });

  it("l'OT renvoyé par la base expose les extras (NULL => absent)", async () => {
    const wo = await updateWorkOrder(ROW.id as string, { visa: 'OA' });
    expect(wo.visa).toBeUndefined();
    expect(wo.tasks).toBeUndefined();
    ROW.tasks = [task({ completed: true })];
    ROW.visa = 'OA';
    ROW.start_date = '2026-06-11';
    const wo2 = await updateWorkOrder(ROW.id as string, { visa: 'OA' });
    expect(wo2.visa).toBe('OA');
    expect(wo2.tasks?.[0].completed).toBe(true);
    expect(wo2.startDate).toBe('2026-06-11');
  });
});
