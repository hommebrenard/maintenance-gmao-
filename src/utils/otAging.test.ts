import { describe, it, expect } from 'vitest';
import type { LocationItem, WorkOrder } from '../types';
import { computeCoswinCoverage, computeCompletionSplit, computeOverdueAging, filterWorkOrdersBySite, overdueToCsv } from './otAging';

const today = new Date('2026-10-18T10:00:00Z');
const wo = (id: string, status: WorkOrder['status'], dueDate: string, extra: Partial<WorkOrder> = {}) =>
  ({ id, code: `OT-${id}`, title: `Titre ${id}`, status, dueDate, location: 'Site A', ...extra } as WorkOrder);

describe('computeOverdueAging', () => {
  it('répartit les retards par tranche et exclut Terminé, Annulé, non échus', () => {
    const r = computeOverdueAging([
      wo('1', 'Ouvert', '2026-10-17'),   // 1 j
      wo('2', 'Ouvert', '2026-09-18'),   // 30 j
      wo('3', 'En cours', '2026-09-17'), // 31 j
      wo('4', 'Ouvert', '2026-07-20'),   // 90 j
      wo('5', 'Ouvert', '2026-07-19'),   // 91 j
      wo('6', 'En attente', '2026-04-21'), // 180 j
      wo('7', 'Ouvert', '2026-04-20'),   // 181 j
      wo('8', 'Terminé', '2026-01-01'),
      wo('9', 'Annulé', '2026-01-01'),
      wo('10', 'Ouvert', '2026-10-18'),  // échéance aujourd'hui : pas en retard
      wo('11', 'Ouvert', '2026-12-01'),  // futur
    ], today);
    expect(r.buckets.map(b => b.items.length)).toEqual([2, 2, 2, 1]);
    expect(r.total).toBe(7);
  });
  it('trie du plus ancien au plus récent et signale les OT sans échéance', () => {
    const r = computeOverdueAging([wo('1', 'Ouvert', '2026-10-10'), wo('2', 'Ouvert', '2026-10-01'), wo('3', 'Ouvert', '')], today);
    expect(r.buckets[0].items.map(i => i.wo.id)).toEqual(['2', '1']);
    expect(r.withoutDueDate).toBe(1);
  });
});

describe('état Coswin chargé (site + mois d\'échéance)', () => {
  it('confirme le retard seulement là où des clôtures Coswin ont été importées', () => {
    const list = [
      wo('1', 'Terminé', '2026-02-09', { closureSource: 'coswin' }),     // Kénitra, février : état Coswin chargé
      wo('2', 'Ouvert', '2026-02-20'),                                    // même site, même mois → confirmé
      wo('3', 'Ouvert', '2026-03-05'),                                    // même site, autre mois → non chargé
      wo('4', 'Ouvert', '2026-02-20', { location: 'Site B' }),            // autre site → non chargé
    ];
    expect([...computeCoswinCoverage(list)]).toEqual(['Site A|2026-02']);
    const r = computeOverdueAging(list, today);
    expect(r.total).toBe(3);
    expect(r.loadedTotal).toBe(1);
    expect(r.notLoadedTotal).toBe(2);
    const flags = Object.fromEntries(r.buckets.flatMap(b => b.items).map(i => [i.wo.id, i.coswin]));
    expect(flags).toEqual({ '2': 'loaded', '3': 'notLoaded', '4': 'notLoaded' });
  });
  it('un OT « NC » (non créé dans Coswin) n\'est jamais « confirmé » par un état Coswin', () => {
    const list = [
      wo('1', 'Terminé', '2026-02-09', { closureSource: 'coswin' }),
      wo('2', 'Ouvert', '2026-02-20', { code: 'NC-AG KENITRA-FEV2026-001' }),   // même site et même mois, mais absent de Coswin
      wo('3', 'Ouvert', '2026-02-21'),
    ];
    const r = computeOverdueAging(list, today);
    expect(r.loadedTotal).toBe(1);
    expect(r.notCreatedTotal).toBe(1);
    expect(r.notLoadedTotal).toBe(0);
    const flags = Object.fromEntries(r.buckets.flatMap(b => b.items).map(i => [i.wo.id, i.coswin]));
    expect(flags).toEqual({ '2': 'notCreated', '3': 'loaded' });
  });
});

describe('computeCompletionSplit', () => {
  it('sépare les OT clôturés dans Coswin non régularisés', () => {
    const s = computeCompletionSplit([
      wo('1', 'Terminé', '2026-02-01', { closureSource: 'coswin' }),
      wo('2', 'Terminé', '2026-02-01', { closureSource: 'coswin', closureRegularizedAt: '2026-10-18T08:00:00Z' }),
      wo('3', 'Terminé', '2026-02-01'),
      wo('4', 'Ouvert', '2026-02-01'),
      wo('5', 'Annulé', '2026-02-01'),
    ]);
    expect(s.denominator).toBe(4);
    expect(s.done).toBe(3);
    expect(s.coswinUnregularized).toBe(1);
    expect(s.rateAll).toBe(0.75);
    expect(s.rateExcludingCoswin).toBe(0.5);
  });
  it('aucun OT → taux null', () => {
    expect(computeCompletionSplit([]).rateAll).toBeNull();
  });
});

describe('filterWorkOrdersBySite / overdueToCsv', () => {
  const locations = [{ id: 'a', name: 'Site A', code: 'BAM_A_AG', type: 'Site', equipmentCount: 0 }] as LocationItem[];
  it('sans site → tous les OT ; avec site → ceux du site', () => {
    const list = [wo('1', 'Ouvert', '2026-01-01'), wo('2', 'Ouvert', '2026-01-01', { location: 'Site B' })];
    expect(filterWorkOrdersBySite(list, locations, '')).toHaveLength(2);
    expect(filterWorkOrdersBySite(list, locations, 'a').map(w => w.id)).toEqual(['1']);
  });
  it('CSV : BOM, séparateur « ; » et guillemets échappés', () => {
    const csv = overdueToCsv([{ wo: wo('1', 'Ouvert', '2026-10-01', { title: 'Test "x"' }), daysLate: 17, coswin: 'loaded' }]);
    expect(csv.startsWith('\uFEFF"Code";"Titre"')).toBe(true);
    expect(csv).toContain('"Test ""x"""');
    expect(csv).toContain(';"17";');
  });
});
