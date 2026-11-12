import { describe, it, expect } from 'vitest';
import { dedupeGammePlans, describeGammeSave, type GammeSaveResult } from './gammeImport';
import type { GammePlan } from '../types';

const plan = (eq: string, pl: string, labels: string[] = ['a']): GammePlan => ({
  id: `${eq}-${pl}`, equipmentCode: eq, planCode: pl, interventionTitle: 't',
  tasks: labels.map((l, i) => ({ id: `${i}`, actionCode: `ACT${i}`, label: l }))
} as GammePlan);

const base: GammeSaveResult = { total: 0, written: [], ignoredExisting: 0, duplicatesInFile: 0, conflictingDuplicates: 0, notWritten: 0 };

describe('dedupeGammePlans', () => {
  it('ne touche pas un fichier sans doublon', () => {
    const r = dedupeGammePlans([plan('E1', 'P1'), plan('E2', 'P1'), plan('E1', 'P2')]);
    expect(r.plans).toHaveLength(3);
    expect(r.duplicates).toBe(0);
  });
  it('retire un doublon identique, garde l\'ordre', () => {
    const r = dedupeGammePlans([plan('E1', 'P1'), plan('E2', 'P1'), plan('E1', 'P1')]);
    expect(r.plans.map(p => p.equipmentCode)).toEqual(['E1', 'E2']);
    expect(r.duplicates).toBe(1);
    expect(r.conflicting).toBe(0);
  });
  it('doublon à tâches différentes : dernière occurrence retenue et signalé', () => {
    const r = dedupeGammePlans([plan('E1', 'P1', ['a']), plan('E1', 'P1', ['a', 'b'])]);
    expect(r.plans).toHaveLength(1);
    expect(r.plans[0].tasks).toHaveLength(2);
    expect(r.conflicting).toBe(1);
  });
  it('clés sensibles à la casse (comme la base)', () => {
    expect(dedupeGammePlans([plan('e1', 'P1'), plan('E1', 'P1')]).plans).toHaveLength(2);
  });
});

describe('describeGammeSave', () => {
  it('succès : annonce le nombre ÉCRIT, pas le nombre lu', () => {
    const w = [plan('E1', 'P1')];
    const r = describeGammeSave({ ...base, total: 3, written: w, ignoredExisting: 2 }, true);
    expect(r.ok).toBe(true);
    expect(r.text).toContain('1 gamme(s) enregistrée(s) en base sur 3');
    expect(r.text).toContain('2 couple(s) déjà en base');
  });
  it('rien d\'écrit car tout existe déjà', () => {
    const r = describeGammeSave({ ...base, total: 4, ignoredExisting: 4 }, true);
    expect(r.ok).toBe(true);
    expect(r.text).toContain('Aucune gamme écrite');
  });
  it('erreur : non ok, nombre écrit / non écrit et message de la base', () => {
    const r = describeGammeSave({ ...base, total: 500, written: [plan('E1', 'P1')], notWritten: 300, error: 'boom' }, true);
    expect(r.ok).toBe(false);
    expect(r.text).toContain('1 gamme(s) enregistrée(s) sur 500');
    expect(r.text).toContain('300 non écrite(s)');
    expect(r.text).toContain('boom');
  });
  it('mentionne les doublons du fichier', () => {
    const r = describeGammeSave({ ...base, total: 1, written: [plan('E1', 'P1')], duplicatesInFile: 2, conflictingDuplicates: 1 }, false);
    expect(r.text).toContain('2 doublon(s)');
    expect(r.text).toContain('1 avec des tâches différentes');
  });
});
