import { describe, it, expect } from 'vitest';
import { parsePlanningCSV, parseFrenchDate, parseCSVLine } from './csvParser';

// En-têtes calqués sur le fichier réel "PMP AG Type A KENITRA Avril 2026"
const HEADER =
  'Zone;Équipement système;Équipement;Planificateur;Intervention;Date de début;Date échéancier;N° d\'OT;N° de plan;Description de l\'équipement;Description de l\'intervention;Date de fin;Type d\'intervention;Classe d\'intervention;Priorité';

function buildRow(fields: Partial<{
  zone: string; eqSys: string; eq: string; planner: string; intervention: string;
  dateDebut: string; dateEcheance: string; otNum: string; planNo: string;
  eqDesc: string; intDesc: string; dateFin: string; type: string; classe: string; priorite: string;
}>): string {
  const f = {
    zone: 'AG', eqSys: '', eq: '', planner: 'Jean Dupont', intervention: 'INT-1',
    dateDebut: '27/04/2026', dateEcheance: '30/04/2026', otNum: 'NC', planNo: 'P-1',
    eqDesc: '', intDesc: 'Intervention test', dateFin: '27/04/2026', type: 'Préventive',
    classe: 'A', priorite: 'Moyenne',
    ...fields
  };
  return [f.zone, f.eqSys, f.eq, f.planner, f.intervention, f.dateDebut, f.dateEcheance,
    f.otNum, f.planNo, f.eqDesc, f.intDesc, f.dateFin, f.type, f.classe, f.priorite].join(';');
}

describe('parseCSVLine', () => {
  it('découpe une ligne simple par point-virgule', () => {
    expect(parseCSVLine('a;b;c', ';')).toEqual(['a', 'b', 'c']);
  });
});

describe('parseFrenchDate', () => {
  it('convertit JJ/MM/AAAA en AAAA-MM-JJ', () => {
    expect(parseFrenchDate('27/04/2026')).toBe('2026-04-27');
  });
});

describe('parsePlanningCSV — détection des colonnes', () => {
  it('associe le code et la description équipement aux bonnes colonnes (pas confondus)', () => {
    const csv = [
      HEADER,
      buildRow({ eq: 'BAM-KNT_AG-PMP-09', eqDesc: 'POMPE CIRCULATION N7', otNum: '101785' })
    ].join('\n');

    const [wo] = parsePlanningCSV(csv);
    expect(wo.equipmentCode).toBe('BAM-KNT_AG-PMP-09');
    expect(wo.equipmentName).toBe('POMPE CIRCULATION N7');
  });

  it('utilise "Date de début" comme échéance (comportement réel actuel, à surveiller)', () => {
    const csv = [
      HEADER,
      buildRow({ dateDebut: '11/05/2026', dateEcheance: '30/05/2026', otNum: '101785' })
    ].join('\n');

    const [wo] = parsePlanningCSV(csv);
    expect(wo.dueDate).toBe('2026-05-11');
  });
});

describe('parsePlanningCSV — génération des codes', () => {
  it('utilise le vrai numéro d\'OT quand il existe', () => {
    const csv = [HEADER, buildRow({ otNum: '101785' })].join('\n');
    const [wo] = parsePlanningCSV(csv);
    expect(wo.code).toBe('OT-101785');
  });

  it('génère un code NC- séquentiel basé sur le nom du fichier quand il n\'y a pas de vrai n° d\'OT', () => {
    const csv = [
      HEADER,
      buildRow({ otNum: 'NC', eq: 'BAM-KNT_AG-PMP-09' }),
      buildRow({ otNum: 'NC', eq: 'BAM-KNT_AG-PMP-08' }),
      buildRow({ otNum: '101785', eq: 'BAM-KNT_AG-TD-11' }), // ne doit pas incrémenter la séquence NC-
      buildRow({ otNum: 'NC', eq: 'BAM-KNT_AG-PMP-07' }),
    ].join('\n');
    const fileName = 'PMP AG Type A KENITRA Avril 2026.csv';
    const lineFileNames = [fileName, fileName, fileName, fileName];

    const result = parsePlanningCSV(csv, [], lineFileNames);
    expect(result[0].code).toBe('NC-AG Type A KENITRA-AVR2026-001');
    expect(result[1].code).toBe('NC-AG Type A KENITRA-AVR2026-002');
    expect(result[2].code).toBe('OT-101785');
    expect(result[3].code).toBe('NC-AG Type A KENITRA-AVR2026-003'); // suite, pas de reset après la ligne OT-101785
  });

  it('ne confond pas "NC" avec un vrai numéro (0 et N/C traités comme absents aussi)', () => {
    const csv = [
      HEADER,
      buildRow({ otNum: '0' }),
      buildRow({ otNum: 'N/C' }),
    ].join('\n');
    const result = parsePlanningCSV(csv);
    expect(result[0].code.startsWith('NC-')).toBe(true);
    expect(result[1].code.startsWith('NC-')).toBe(true);
  });
});
