import { describe, it, expect } from 'vitest';
import type { MaintenanceRequest, WorkOrder } from '../types';
import { displayState, indexWorkOrders } from './requestDisplay';

const req = (status: MaintenanceRequest['status'], workOrderId?: string) =>
  ({ id: 'r' + status + workOrderId, status, workOrderId } as MaintenanceRequest);
const wo = (id: string, status: WorkOrder['status']) => ({ id, status } as WorkOrder);

describe('requestDisplay', () => {
  it('états stockés', () => {
    expect(displayState({ status: 'En attente' })).toBe('En attente');
    expect(displayState({ status: 'Rejetée' }, wo('1', 'Terminé'))).toBe('Rejetée');
  });
  it('approuvée : suit l\'OT lié', () => {
    expect(displayState({ status: 'Approuvée' })).toBe('Prise en charge');
    expect(displayState({ status: 'Approuvée' }, wo('1', 'Ouvert'))).toBe('Prise en charge');
    expect(displayState({ status: 'Approuvée' }, wo('1', 'En cours'))).toBe('En cours');
    expect(displayState({ status: 'Approuvée' }, wo('1', 'Terminé'))).toBe('Clôturée');
  });
  it('demande importée sans OT dans l\'application : suit l\'état OT Coswin', () => {
    expect(displayState({ status: 'Approuvée', otState: 'T' })).toBe('Clôturée');
    expect(displayState({ status: 'Approuvée', otState: 'A' })).toBe('Prise en charge');
  });
  it('index : uniquement les OT liés à une demande', () => {
    const m = indexWorkOrders([wo('a', 'Ouvert'), wo('b', 'Terminé'), wo('c', 'Ouvert')], [req('Approuvée', 'b'), req('En attente')]);
    expect([...m.keys()]).toEqual(['b']);
  });
});
