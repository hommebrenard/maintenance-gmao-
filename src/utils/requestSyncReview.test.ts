import { describe, it, expect } from 'vitest';
import { reviewSyncRows, excludeHeld, type ReviewFileRow, type ReviewRequest, type LockLite } from './requestSyncReview';
import type { EquipmentLite } from './requestEquipmentCheck';

// Données entièrement fictives.
const eq = (code: string, name: string, locationId: string): EquipmentLite => ({ id: code, code, name, locationId });
const equipment = [
  eq('TST-A-OND-01', 'ONDULEUR N1', 'SITE-A'), eq('TST-A-OND-02', 'ONDULEUR N2', 'SITE-A'), eq('TST-A-EXT-01', 'EXTRACTEUR N1', 'SITE-A'),
  eq('TST-A-DUP-01', 'POMPE N1', 'SITE-A'), eq('TST_A-DUP-01', 'POMPE N1 BIS', 'SITE-A'),
  eq('TST-B-OND-01', 'ONDULEUR N1', 'SITE-B'),
];
const ctx = { locationIdByCode: new Map([['TST-SITE-A', 'SITE-A'], ['TST-SITE-B', 'SITE-B']]), locationIdByKey: new Map([['TST_SITE_A', 'SITE-A'], ['TST_SITE_B', 'SITE-B']]) };
const req = (code: string, equipmentId?: string, extra: Partial<ReviewRequest> = {}): ReviewRequest => ({ code, title: 'ONDULEUR N1', origin: 'coswin', equipmentId, equipmentCode: equipmentId, ...extra });
const row = (code: string, planned: string | null, source: string | null = planned, title = 'ONDULEUR N1', zone: string | null = 'TST-SITE-A'): ReviewFileRow =>
  ({ code, title, site_code: zone, planned_equipment_code: planned, equipment_code: source });
const run = (rows: ReviewFileRow[], reqs: ReviewRequest[], locks = new Map<string, LockLite>(), decisions = {}) => reviewSyncRows(rows, reqs, equipment, locks, ctx, decisions);

describe('reviewSyncRows', () => {
  it('même équipement : conforme', () => {
    const r = run([row('D1', 'TST_A_OND_01')], [req('D1', 'TST-A-OND-01')]);
    expect(r.items[0].state).toBe('conforme'); expect(r.notSynced).toBe(0);
  });
  it('autre équipement du même site, cohérent : réaffectation listée avec ancien et nouveau, reste dans le lot', () => {
    const r = run([row('D1', 'TST-A-OND-02', 'TST-A-OND-02', 'ONDULEUR N2')], [req('D1', 'TST-A-OND-01')]);
    expect(r.items[0]).toMatchObject({ state: 'reaffectation_meme_site', held: false, oldEquipment: { code: 'TST-A-OND-01' }, newEquipment: { code: 'TST-A-OND-02' } });
  });
  it('équipement d\'un autre site : conflit retiré du lot', () => {
    const r = run([row('D1', 'TST-B-OND-01')], [req('D1', 'TST-A-OND-01')]);
    expect(r.items[0]).toMatchObject({ state: 'nouveau_conflit', reason: 'hors_site', held: true });
    expect(r.notSynced).toBe(1);
    expect(excludeHeld([{ code: 'D1' }, { code: 'D2' }], r)).toEqual([{ code: 'D2' }]);
  });
  it('zone non résolue avec changement d\'équipement : conflit, jamais conforme', () => {
    const r = run([row('D1', 'TST-A-OND-02', 'TST-A-OND-02', 'ONDULEUR N2', 'ZONE-INCONNUE')], [req('D1', 'TST-A-OND-01')]);
    expect(r.items[0]).toMatchObject({ state: 'nouveau_conflit', reason: 'site_inconnu', held: true });
  });
  it('décision « accepter » : repart dans le lot ; « garder » sans verrou : reste retiré', () => {
    const rows = [row('D1', 'TST-B-OND-01'), row('D2', 'TST-B-OND-01')];
    const reqs = [req('D1', 'TST-A-OND-01'), req('D2', 'TST-A-OND-01')];
    const r = run(rows, reqs, new Map(), { D1: 'accepter', D2: 'garder' });
    expect(r.items.map(i => i.held)).toEqual([false, true]);
  });
  it('code introuvable : anomalie, reste dans le lot, jamais conforme', () => {
    const r = run([row('D1', 'TST-A-ZZZ')], [req('D1', 'TST-A-OND-01')]);
    expect(r.items[0]).toMatchObject({ state: 'anomalie_equipement', codeProblem: 'introuvable', held: false });
    expect(r.notSynced).toBe(0); expect(r.anomalies).toBe(1);
  });
  it('code ambigu : anomalie dans le lot ; le repli SQL sur le code source garde le lien mais ne masque pas l\'ambiguïté', () => {
    const a = run([row('D1', 'TST-A-DUP-01')], [req('D1', 'TST-A-OND-01')]);
    expect(a.items[0]).toMatchObject({ state: 'anomalie_equipement', codeProblem: 'ambigu', held: false });
    const b = run([row('D1', 'TST-A-DUP-01', 'TST-A-OND-01')], [req('D1', 'TST-A-OND-01')]);
    expect(b.items[0]).toMatchObject({ state: 'anomalie_equipement', codeProblem: 'ambigu', held: false });
    expect(b.notSynced).toBe(0); expect(b.anomalies).toBe(1);
  });
  it('code planifié introuvable avec repli sur un autre équipement du même site : réaffectation, anomalie signalée en plus', () => {
    const r = run([row('D1', 'TST-A-ZZZ', 'TST-A-OND-02', 'ONDULEUR N2')], [req('D1', 'TST-A-OND-01')]);
    expect(r.items[0]).toMatchObject({ state: 'reaffectation_meme_site', codeProblem: 'introuvable', held: false });
  });
  it('planifié vide et source résolue : aucune anomalie', () => {
    const r = run([row('D1', null, 'TST-A-OND-01')], [req('D1', 'TST-A-OND-01')]);
    expect(r.items[0]).toMatchObject({ state: 'conforme' }); expect(r.anomalies).toBe(0);
  });
  it('N° de DI en double (fichier ou base) : erreur explicite, aucune classification devinée', () => {
    expect(() => run([row('D1', 'TST-A-OND-01'), row('D1', 'TST-A-OND-02')], [req('D1', 'TST-A-OND-01')])).toThrow(/double dans le fichier/);
    expect(() => run([row('D1', 'TST-A-OND-01')], [req('D1', 'TST-A-OND-01'), req('D1', 'TST-A-OND-02')])).toThrow(/même N° de DI/);
  });
  it('codes vides dans le fichier : conforme (rien ne change)', () => {
    expect(run([row('D1', null, null)], [req('D1', 'TST-A-OND-01')]).items[0].state).toBe('conforme');
  });
  it('verrous : aligné, stable (code source inchangé), changement Coswin', () => {
    const locks = new Map<string, LockLite>([['D1', { equipmentId: 'TST-A-OND-01', equipmentCode: 'TST-A-OND-01' }], ['D2', { equipmentId: 'TST-A-OND-01', equipmentCode: 'TST-A-OND-01' }], ['D3', { equipmentId: 'TST-A-OND-01', equipmentCode: 'TST-A-OND-01' }]]);
    const r = run(
      [row('D1', 'TST-A-OND-01'), row('D2', 'TST-A-OND-02'), row('D3', 'TST-A-EXT-01')],
      [req('D1', 'TST-A-OND-01'), req('D2', 'TST-A-OND-01', { equipmentCode: 'TST-A-OND-02' }), req('D3', 'TST-A-OND-01', { equipmentCode: 'TST-A-OND-02' })],
      locks,
    );
    expect(r.items.map(i => i.state)).toEqual(['verrou_aligne', 'verrou_stable', 'verrou_change_coswin']);
    expect(r.notSynced).toBe(0);
  });
  it('hors périmètre : origine application ou DI sans équipement lié ; DI absente de la base ignorée', () => {
    const r = run([row('D1', 'TST-A-OND-02'), row('D2', 'TST-A-OND-02'), row('D3', 'TST-A-OND-02')], [req('D1', 'TST-A-OND-01', { origin: 'app' }), req('D2', undefined)]);
    expect(r.items.map(i => i.state)).toEqual(['hors_perimetre', 'hors_perimetre']);
  });
  it('hors périmètre : un code introuvable n\'est pas compté comme anomalie', () => {
    const r = run([row('D1', 'TST-A-ZZZ'), row('D2', 'TST-A-ZZZ')], [req('D1', 'TST-A-OND-01', { origin: 'app' }), req('D2', undefined)]);
    expect(r.items.map(i => i.state)).toEqual(['hors_perimetre', 'hors_perimetre']);
    expect(r.anomalies).toBe(0);
  });
  it('priorité : un conflit de site reste bloquant même avec un code en anomalie', () => {
    const r = run([row('D1', 'TST-A-ZZZ', 'TST-B-OND-01')], [req('D1', 'TST-A-OND-01')]);
    expect(r.items[0]).toMatchObject({ state: 'nouveau_conflit', reason: 'hors_site', codeProblem: 'introuvable', held: true });
    expect(r.notSynced).toBe(1); expect(r.anomalies).toBe(1);
  });
  it('priorité : une DI verrouillée garde son état de verrou et compte aussi comme anomalie', () => {
    const locks = new Map<string, LockLite>([['D1', { equipmentId: 'TST-A-OND-01', equipmentCode: 'TST-A-OND-01' }]]);
    const r = run([row('D1', 'TST-A-ZZZ', 'TST-A-OND-01')], [req('D1', 'TST-A-OND-01')], locks);
    expect(r.items[0]).toMatchObject({ state: 'verrou_aligne', codeProblem: 'introuvable', held: false });
    expect(r.anomalies).toBe(1); expect(r.notSynced).toBe(0);
  });
  it('compteurs', () => {
    const r = run([row('D1', 'TST-B-OND-01'), row('D2', 'TST-A-ZZZ')], [req('D1', 'TST-A-OND-01'), req('D2', 'TST-A-OND-01')]);
    expect(r.counts.nouveau_conflit).toBe(1); expect(r.counts.anomalie_equipement).toBe(1);
    expect(r.notSynced).toBe(1); expect(r.anomalies).toBe(1); // retirées du lot ≠ anomalies
  });
});
