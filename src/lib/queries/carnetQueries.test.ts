import { describe, it, expect, vi, beforeEach } from 'vitest';

// Faux client Supabase : capture les charges utiles et renvoie des lignes fixes, sans réseau.
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
        delete: () => make(table, 'delete'),
      }),
    },
  };
});

import { fetchEquipmentDocuments, createEquipmentDocument, deleteEquipmentDocument } from './equipmentDocuments';
import { fetchMaintenanceSchedules, createMaintenanceSchedule, updateMaintenanceSchedule, deleteMaintenanceSchedule } from './maintenanceSchedules';
import { fetchScheduleControls, createScheduleControl, updateScheduleControl } from './scheduleControls';
import { fetchEquipmentParts, createEquipmentPart, updateEquipmentPart, deleteEquipmentPart } from './equipmentParts';

const EQ = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  calls.length = 0;
  state.rows = [];
  state.error = null;
});

describe('equipmentDocuments', () => {
  it('convertit une ligne (colonnes nullables → undefined)', async () => {
    state.rows = [{ id: 'd1', equipment_id: EQ, name: 'Manuel', category: null, storage_path: `equipment/${EQ}/m.pdf`,
      mime_type: null, size_bytes: 1234, created_by: null, created_at: '2026-09-29T10:00:00Z', updated_at: null }];
    const [d] = await fetchEquipmentDocuments(EQ);
    expect(d).toMatchObject({ id: 'd1', equipmentId: EQ, name: 'Manuel', storagePath: `equipment/${EQ}/m.pdf`, sizeBytes: 1234 });
    expect(d.category).toBeUndefined();
    expect(d.mimeType).toBeUndefined();
  });
  it('création : snake_case, created_by, champs absents → null', async () => {
    state.rows = [{ id: 'd2', equipment_id: EQ, name: 'Cert', category: 'certificate', storage_path: 'p', mime_type: null, size_bytes: null, created_by: 'u1', created_at: 'x', updated_at: null }];
    await createEquipmentDocument({ equipmentId: EQ, name: 'Cert', storagePath: 'p', category: 'certificate' }, 'u1');
    expect(calls[0].payload).toEqual({ equipment_id: EQ, name: 'Cert', storage_path: 'p', category: 'certificate', mime_type: null, size_bytes: null, created_by: 'u1' });
  });
  it('suppression refusée par la RLS (0 ligne) → erreur explicite', async () => {
    state.rows = [];
    await expect(deleteEquipmentDocument('d1')).rejects.toThrow(/refusée/);
    state.rows = [{ id: 'd1' }];
    await expect(deleteEquipmentDocument('d1')).resolves.toBeUndefined();
  });
});

describe('maintenanceSchedules', () => {
  const ROW = { id: 's1', equipment_id: EQ, title: 'Contrôle', frequency_label: null, frequency_type: 'calendar', interval_hours: null,
    interval_months: 12, last_done_date: null, next_due_date: '2000-01-01', legal_requirement: true, assigned_to: null,
    status: 'ok', created_by: null, created_at: 'x', updated_at: null };

  it('recalcule le statut depuis la date (le statut stocké périmé est ignoré)', async () => {
    state.rows = [ROW];
    const [s] = await fetchMaintenanceSchedules(EQ);
    expect(s.status).toBe('overdue');
    expect(s.legalRequirement).toBe(true);
    expect(s.intervalMonths).toBe(12);
    expect(s.frequencyLabel).toBeUndefined();
  });
  it('sans date, garde le statut stocké ; sans les deux → undefined', async () => {
    state.rows = [{ ...ROW, next_due_date: null, status: 'due_soon' }];
    expect((await fetchMaintenanceSchedules(EQ))[0].status).toBe('due_soon');
    state.rows = [{ ...ROW, next_due_date: null, status: null }];
    expect((await fetchMaintenanceSchedules(EQ))[0].status).toBeUndefined();
  });
  it('création : écrit le statut calculé avec la date, dates vides → null', async () => {
    state.rows = [ROW];
    await createMaintenanceSchedule({ equipmentId: EQ, title: 'Contrôle', nextDueDate: '2000-01-01', lastDoneDate: '' }, 'u1');
    expect(calls[0].payload).toMatchObject({ equipment_id: EQ, title: 'Contrôle', next_due_date: '2000-01-01', status: 'overdue', last_done_date: null, created_by: 'u1' });
  });
  it("mise à jour : n'écrit que les champs fournis ; effacer la date efface le statut", async () => {
    state.rows = [ROW];
    await updateMaintenanceSchedule('s1', { title: 'Nouveau' });
    expect(calls[0].payload).not.toHaveProperty('status');
    expect(calls[0].payload).not.toHaveProperty('next_due_date');
    await updateMaintenanceSchedule('s1', { nextDueDate: '' });
    expect(calls[1].payload).toMatchObject({ next_due_date: null, status: null });
  });
  it('suppression refusée (0 ligne) → erreur', async () => {
    state.rows = [];
    await expect(deleteMaintenanceSchedule('s1')).rejects.toThrow(/refusée/);
  });
});

describe('equipmentParts', () => {
  const ROW = { id: 'p1', equipment_id: EQ, code: null, name: 'Courroie', reference: 'R-1', manufacturer: null, stock: '3', min_stock: 1,
    unit: null, unit_price: '12.5', location: null, created_by: null, created_at: 'x', updated_at: null };

  it('convertit les numeric en nombres et les nullables en undefined', async () => {
    state.rows = [ROW];
    const [p] = await fetchEquipmentParts(EQ);
    expect(p).toMatchObject({ id: 'p1', name: 'Courroie', reference: 'R-1', stock: 3, minStock: 1, unitPrice: 12.5 });
    expect(p.code).toBeUndefined();
    state.rows = [{ ...ROW, unit_price: null }];
    expect((await fetchEquipmentParts(EQ))[0].unitPrice).toBeUndefined();
  });
  it('création : snake_case, chaînes vides → null, stock par défaut laissé à la base', async () => {
    state.rows = [ROW];
    await createEquipmentPart({ equipmentId: EQ, name: 'Courroie', code: '', minStock: 2 }, 'u1');
    expect(calls[0].payload).toEqual({ name: 'Courroie', code: null, min_stock: 2, equipment_id: EQ, created_by: 'u1' });
  });
  it("mise à jour : n'envoie que le stock modifié", async () => {
    state.rows = [ROW];
    await updateEquipmentPart('p1', { stock: 0 });
    expect(Object.keys(calls[0].payload).sort()).toEqual(['stock', 'updated_at']);
  });
  it('suppression refusée (0 ligne) → erreur', async () => {
    state.rows = [];
    await expect(deleteEquipmentPart('p1')).rejects.toThrow(/refusée/);
  });
});

describe('scheduleControls', () => {
  const row = {
    id: 'k1', schedule_id: 's1', equipment_id: EQ, title: 'Contrôle ascenseur', performed_on: '2026-10-02',
    inspection_body: 'VERITAS', result: 'reserves', notes: null, created_by: 'u1', created_at: 'x', updated_at: null,
  };
  it('lit et convertit une ligne (verdict, inconnus => undefined)', async () => {
    state.rows = [row];
    const [c] = await fetchScheduleControls(EQ);
    expect(c).toMatchObject({ id: 'k1', scheduleId: 's1', performedOn: '2026-10-02', inspectionBody: 'VERITAS', result: 'reserves' });
    expect(c.notes).toBeUndefined();
  });
  it('création : charge utile complète avec intitulé recopié et auteur', async () => {
    state.rows = [row];
    await createScheduleControl({ equipmentId: EQ, scheduleId: 's1', title: 'Contrôle ascenseur', performedOn: '2026-10-02', inspectionBody: 'VERITAS', result: 'reserves', notes: '' }, 'u1');
    expect(calls[0]).toMatchObject({ table: 'schedule_controls', op: 'insert' });
    expect(calls[0].payload).toEqual({
      performed_on: '2026-10-02', inspection_body: 'VERITAS', result: 'reserves', notes: null,
      equipment_id: EQ, schedule_id: 's1', title: 'Contrôle ascenseur', created_by: 'u1',
    });
  });
  it('modification : seulement les champs fournis', async () => {
    state.rows = [row];
    await updateScheduleControl('k1', { result: 'conforme' });
    expect(calls[0].op).toBe('update');
    expect(Object.keys(calls[0].payload).sort()).toEqual(['result', 'updated_at']);
  });
  it('document : lien GED seul accepté, rien du tout refusé', async () => {
    state.rows = [{ id: 'd9', equipment_id: EQ, name: 'PV', category: 'report', storage_path: null, external_url: 'https://ged/x', control_id: 'k1', mime_type: null, size_bytes: null, created_by: 'u1', created_at: 'x', updated_at: null }];
    const d = await createEquipmentDocument({ equipmentId: EQ, name: 'PV', category: 'report', externalUrl: 'https://ged/x', controlId: 'k1' }, 'u1');
    expect(calls[0].payload).toEqual({ equipment_id: EQ, name: 'PV', external_url: 'https://ged/x', control_id: 'k1', category: 'report', mime_type: null, size_bytes: null, created_by: 'u1' });
    expect(d).toMatchObject({ externalUrl: 'https://ged/x', controlId: 'k1' });
    expect(d.storagePath).toBeUndefined();
    await expect(createEquipmentDocument({ equipmentId: EQ, name: 'Vide' }, 'u1')).rejects.toThrow('fichier ou un lien');
  });
});
