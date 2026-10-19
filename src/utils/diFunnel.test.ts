import { describe, expect, it } from 'vitest';
import type { MaintenanceRequest } from '../types';
import { computeFunnel } from './diFunnel';

const di = (id: string, x: Partial<MaintenanceRequest> = {}): MaintenanceRequest => ({
  id, title: 't', description: '', status: 'En attente', priority: 'Moyenne', requestedBy: 'x', createdAt: '', code: id, ...x,
});

describe('computeFunnel', () => {
  it("forme une partition des DI reçues et compte les sorties à part", () => {
    const f = computeFunnel([
      di('1'),                                                                     // en attente, sans OT
      di('2', { status: 'Approuvée' as never }),                                   // prise en charge sans OT
      di('3', { status: 'Approuvée' as never, otNumber: '86000', otState: 'E' }),  // OT terminé
      di('4', { status: 'Approuvée' as never, otNumber: '86001', otState: 'C' }),  // OT existant, ni terminé ni annulé
      di('5', { status: 'Approuvée' as never, otNumber: '86002', otState: 'N' }),  // OT annulé
      di('6', { status: 'Approuvée' as never, coswinState: '17. Clôturée sans OT' }), // clôturée sans OT
      di('7', { status: 'Rejetée' }),                                              // rejetée (app)
      di('8', { status: 'Rejetée', coswinState: '5. Annulée' }),                   // annulée (Coswin)
    ], []);
    expect(f).toMatchObject({ total: 8, rejetees: 1, annulees: 1, recues: 6, enAttente: 1, priseSansOt: 1, clotureSansOt: 1, avecOt: 3, otCloture: 1, otAnnule: 1, otOuvert: 1, otEnCours: 0 });
    expect(f.enAttente + f.priseSansOt + f.clotureSansOt + f.avecOt).toBe(f.recues);
    expect(f.otCloture + f.otEnCours + f.otAnnule + f.otOuvert).toBe(f.avecOt);
  });
});
