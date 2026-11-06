import { describe, it, expect } from 'vitest';
import { compareDueDates, formatIsoDateFr, dueDateOkSummary } from './importDueDateCheck';

// Données fictives : site TEST-SITE-A, codes OT-T1…
const file = (code: string, dueDate: string) => ({ code, dueDate });

describe('compareDueDates', () => {
  it('compte nouveaux, identiques et différents, par mois de l\'échéance du fichier', () => {
    const rows = [
      file('OT-T1', '2026-03-02'), file('OT-T2', '2026-03-31'), file('OT-T3', '2026-03-31'),
      file('OT-T4', '2026-03-31'), file('OT-T5', '2026-04-06'),
    ];
    const existing = new Map([
      ['OT-T1', { id: 'a', dueDate: '2026-03-02', status: 'ouvert' }],
      ['OT-T2', { id: 'b', dueDate: '2026-04-01', status: 'ouvert' }],
      ['OT-T3', { id: 'c', dueDate: '2026-04-08', status: 'en_cours' }],
    ]);
    const r = compareDueDates(rows, existing);
    expect(r.totalInFile).toBe(5);
    expect(r.totalNew).toBe(2);
    expect(r.totalSame).toBe(1);
    expect(r.totalDifferent).toBe(2);
    expect(r.months).toEqual([
      { month: '2026-03', inFile: 4, isNew: 1, same: 1, different: 2 },
      { month: '2026-04', inFile: 1, isNew: 1, same: 0, different: 0 },
    ]);
    expect(r.differences.map(d => [d.code, d.fileDate, d.baseDate])).toEqual([
      ['OT-T2', '2026-03-31', '2026-04-01'],
      ['OT-T3', '2026-03-31', '2026-04-08'],
    ]);
    expect(r.pairs).toEqual([
      { fileDate: '2026-03-31', baseDate: '2026-04-01', count: 1 },
      { fileDate: '2026-03-31', baseDate: '2026-04-08', count: 1 },
    ]);
  });

  it('marque verrouillé un OT clôturé ou annulé (affiché, non alignable)', () => {
    const existing = new Map([
      ['OT-T1', { id: 'a', dueDate: '2026-04-01', status: 'termine' }],
      ['OT-T2', { id: 'b', dueDate: '2026-04-01', status: 'annule' }],
      ['OT-T3', { id: 'c', dueDate: '2026-04-01', status: 'ouvert' }],
      ['OT-T4', { id: 'd', dueDate: '2026-04-01' }],
    ]);
    const r = compareDueDates(['OT-T1', 'OT-T2', 'OT-T3', 'OT-T4'].map(c => file(c, '2026-03-31')), existing);
    expect(r.differences.map(d => d.locked)).toEqual([true, true, false, false]);
  });

  it('ne signale rien quand tout est identique, et la phrase de bilan le dit', () => {
    const existing = new Map([['OT-T1', { id: 'a', dueDate: '2026-03-02' }]]);
    const r = compareDueDates([file('OT-T1', '2026-03-02')], existing);
    expect(r.totalDifferent).toBe(0);
    expect(dueDateOkSummary(r)).toBe('Contrôle des échéances : 1 OT déjà en base, toutes les échéances sont identiques au fichier.');
  });

  it('bilan sans OT existant', () => {
    const r = compareDueDates([file('OT-T1', '2026-03-02')], new Map());
    expect(dueDateOkSummary(r)).toBe('Contrôle des échéances : aucun OT du fichier n\'était déjà en base.');
  });

  it('un OT en double dans le fichier est compté une fois ; une échéance vide en base n\'est pas un écart', () => {
    const existing = new Map([['OT-T1', { id: 'a', dueDate: '' }]]);
    const r = compareDueDates([file('OT-T1', '2026-03-02'), file('OT-T1', '2026-03-09'), file('', '2026-03-02')], existing);
    expect(r.totalInFile).toBe(1);
    expect(r.totalSame).toBe(1);
    expect(r.totalDifferent).toBe(0);
  });

  it('compare des dates texte : la valeur horaire d\'une échéance en base est ignorée', () => {
    const existing = new Map([['OT-T1', { id: 'a', dueDate: '2026-03-31T00:00:00+00:00' }]]);
    expect(compareDueDates([file('OT-T1', '2026-03-31')], existing).totalDifferent).toBe(0);
  });
});

describe('formatIsoDateFr', () => {
  it('met la date au format jour/mois/année sans effet de fuseau', () => {
    expect(formatIsoDateFr('2026-03-31')).toBe('31/03/2026');
    expect(formatIsoDateFr('')).toBe('');
  });
});
