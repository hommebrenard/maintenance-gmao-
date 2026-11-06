import { describe, it, expect } from 'vitest';
import { parsePlanningCSV, type PlanningFileStats } from './csvParser';

// Données fictives (TEST_SITE_A).
const H = "Zone;Équipement;Planificateur;Intervention;Date de début;Date échéancier;N° d'OT;N° de plan;Description de l'intervention;Date de fin";
const row = (otNum: string, eq: string) => `TEST_SITE_A;${eq};P;PS-X-1M-01;01/04/2026 08:00;31/03/2026;${otNum};1;PREV ${eq};02/04/2026 18:00`;
const stats = (arr: unknown) => (arr as { fileStats?: PlanningFileStats }).fileStats!;

describe('bilan du fichier de planning (fileStats)', () => {
  const csv = [H, row('900001', 'T1'), row('', 'T2'), row('NC', 'T3'), row('N/C', 'T4'), row('900002', 'T5')].join('\n');
  const names = Array(5).fill('pmp test site mars 2026.xlsx');
  const parsed = parsePlanningCSV(csv, [], names);

  it('distingue OT numérotés, NC écrits et N° d\'OT vides ; tous sont comptés', () => {
    expect(parsed).toHaveLength(5);
    const s = stats(parsed);
    expect([s.numbered, s.ncLiteral, s.ncBlank]).toEqual([2, 2, 1]);
  });

  it('indique la colonne de date réellement lue : la première colonne « date » de gauche à droite', () => {
    const s = stats(parsed);
    expect(s.dueDateHeader).toBe('Date de début');
    expect(s.echeancierHeader).toBe('Date échéancier');
    expect(parsed[0].dueDate).toBe('2026-04-01');
  });

  it('donne un exemple de code NC qui reproduit la casse du nom du fichier', () => {
    expect(stats(parsed).ncSampleCode).toBe('NC-test site-MAR2026-001');
    const upper = parsePlanningCSV(csv, [], Array(5).fill('PMP TEST SITE MARS 2026.xlsx'));
    expect(stats(upper).ncSampleCode).toBe('NC-TEST SITE-MAR2026-001');
  });

  it('sans colonne « échéancier », l\'en-tête correspondant est vide', () => {
    const csv2 = [H.replace('Date échéancier', 'Autre'), row('900001', 'T1')].join('\n');
    expect(stats(parsePlanningCSV(csv2)).echeancierHeader).toBe('');
  });
});
