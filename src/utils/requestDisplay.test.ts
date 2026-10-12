import { describe, it, expect } from 'vitest';
import type { MaintenanceRequest, WorkOrder } from '../types';
import { displayState, indexWorkOrders, requestAlert, decisionOrigin } from './requestDisplay';

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
  it('états OT Coswin : E/T/U/V/Z clôturée, N/X annulé, autres en cours ; DI 17 clôturée sans OT', () => {
    for (const c of ['E', 'T', 'U', 'V', 'Z']) expect(displayState({ status: 'Approuvée', otState: c })).toBe('Clôturée');
    for (const c of ['N', 'X']) expect(displayState({ status: 'Approuvée', otState: c })).toBe('OT annulé');
    for (const c of ['A', 'G', 'B', 'C', 'P']) expect(displayState({ status: 'Approuvée', otState: c })).toBe('Prise en charge');
    expect(displayState({ status: 'Approuvée', coswinState: '17. Clôturée sans OT' })).toBe('Clôturée');
    expect(displayState({ status: 'Approuvée', coswinState: '3. OT créé' })).toBe('Prise en charge');
  });
  it('DI annulée dans Coswin (5) ≠ rejet décidé dans l\'application', () => {
    expect(displayState({ status: 'Rejetée', coswinState: '5. Annulée' })).toBe('DI annulée');
    expect(displayState({ status: 'Rejetée', coswinState: '5. Annulée', otState: 'A' })).toBe('DI annulée'); // DI00002491
    expect(displayState({ status: 'Rejetée' })).toBe('Rejetée'); // décision locale
    expect(displayState({ status: 'Rejetée', coswinState: '15. Autre' })).toBe('Rejetée');
  });
  it('« 8. Signed off » : suit l\'OT (terminé → clôturée)', () => {
    expect(displayState({ status: 'Approuvée', coswinState: '8. Signed off', otState: 'T' })).toBe('Clôturée');
  });
  it('alerte : DI annulée avec OT actif seulement', () => {
    expect(requestAlert({ status: 'Rejetée', coswinState: '5. Annulée', otNumber: '100435', otState: 'A' })).toMatch(/état A/);
    expect(requestAlert({ status: 'Rejetée', coswinState: '5. Annulée' })).toBeNull();
    expect(requestAlert({ status: 'Rejetée', coswinState: '5. Annulée', otNumber: '1', otState: 'T' })).toBeNull();
    expect(requestAlert({ status: 'Rejetée', coswinState: '5. Annulée', otNumber: '1', otState: 'X' })).toBeNull();
    expect(requestAlert({ status: 'Rejetée', otNumber: '1', otState: 'A' })).toBeNull(); // rejet local : pas concerné
    expect(requestAlert({ status: 'Approuvée', coswinState: '3. OT créé', otNumber: '1', otState: 'A' })).toBeNull();
  });
  it('origine de la décision : Coswin ≠ application', () => {
    expect(decisionOrigin({ status: 'Rejetée', coswinState: '5. Annulée' })).toBe('coswin');
    expect(decisionOrigin({ status: 'Rejetée' })).toBe('app');
    expect(decisionOrigin({ status: 'Approuvée', coswinState: '5. Annulée' })).toBeNull();
    expect(decisionOrigin({ status: 'En attente' })).toBeNull();
  });
  it('index : uniquement les OT liés à une demande', () => {
    const m = indexWorkOrders([wo('a', 'Ouvert'), wo('b', 'Terminé'), wo('c', 'Ouvert')], [req('Approuvée', 'b'), req('En attente')]);
    expect([...m.keys()]).toEqual(['b']);
  });
});
