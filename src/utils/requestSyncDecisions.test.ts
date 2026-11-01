import { describe, it, expect } from 'vitest';
import { decisionsFromTrace, evaluateAcceptProof, type TraceLite } from './requestSyncDecisions';
import type { ReviewItem } from './requestSyncReview';

// Données entièrement fictives.
const conflict = (code: string): ReviewItem => ({ code, title: 'T', state: 'nouveau_conflit', held: true, oldEquipment: { id: 'A', code: 'TST-A-1' }, newEquipment: { id: 'B', code: 'TST-B-1' } });
const t = (diCode: string, decision: TraceLite['decision'], beforeId: string | null = 'A', afterId: string | null = 'B'): TraceLite => ({ diCode, decision, beforeId, afterId });

describe('decisionsFromTrace', () => {
  it('« accepter » valable seulement si c\'est la dernière décision et le même changement', () => {
    const items = [conflict('D1'), conflict('D2'), conflict('D3'), conflict('D4')];
    const trace = [t('D1', 'accepter'), t('D2', 'liberer', 'A', null), t('D2', 'accepter'), t('D3', 'accepter', 'A', 'Z'), t('D4', 'garder', 'A', 'A')];
    expect(decisionsFromTrace(items, trace)).toEqual({ D1: 'accepter' });
  });
  it('ignore les DI qui ne sont pas en conflit', () => {
    expect(decisionsFromTrace([{ ...conflict('D1'), state: 'conforme' }], [t('D1', 'accepter')])).toEqual({});
  });
});

describe('evaluateAcceptProof', () => {
  const it1 = conflict('D1');
  it('prouvée : ligne equipment_id du lot avec le code accepté et équipement actuel identique', () => {
    expect(evaluateAcceptProof(it1, { history: [{ champ: 'equipment_id', nouvelleValeur: 'TST_B_1' }], equipmentId: 'B' })).toBe('prouvee');
  });
  it('indéterminée : pas de preuve, mauvais code, ou équipement actuel différent', () => {
    expect(evaluateAcceptProof(it1, undefined)).toBe('indeterminee');
    expect(evaluateAcceptProof(it1, { history: [], equipmentId: 'B' })).toBe('indeterminee');
    expect(evaluateAcceptProof(it1, { history: [{ champ: 'equipment_id', nouvelleValeur: 'TST-A-9' }], equipmentId: 'B' })).toBe('indeterminee');
    expect(evaluateAcceptProof(it1, { history: [{ champ: 'equipment_id', nouvelleValeur: 'TST-B-1' }], equipmentId: 'A' })).toBe('indeterminee');
    expect(evaluateAcceptProof(it1, { history: [{ champ: 'ot_number', nouvelleValeur: 'TST-B-1' }], equipmentId: 'B' })).toBe('indeterminee');
  });
});
