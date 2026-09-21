import { describe, it, expect } from 'vitest';
import { parsePlanningCSV, parseFrenchDate, parseCSVLine, findMatchingGammePlan, findMatchingGammePlanDetailed } from './csvParser';
import { GammePlan } from '../types';

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

describe('parsePlanningCSV — code d\'intervention, n° de plan, entité (colonnes écrites en base depuis le 21/09/2026)', () => {
  it('lit le vrai n° de plan (colonne « N° de plan »), pas le nom du planificateur', () => {
    const csv = [
      HEADER,
      buildRow({ zone: 'BAM_KNT_AG', planner: 'AMARA OMAR', intervention: 'PS-TD-1T-01', planNo: '4521', otNum: '101785' })
    ].join('\n');
    const [wo] = parsePlanningCSV(csv);
    expect(wo.planNumber).toBe('4521');
    expect(wo.planner).toBe('AMARA OMAR');
    expect(wo.interventionCode).toBe('PS-TD-1T-01');
    expect(wo.entity).toBe('BAM_KNT_AG');
  });

  it("sans colonne de n° de plan : planNumber vide (jamais le planificateur)", () => {
    const csv = [
      'Zone;Équipement;Planificateur;Intervention;Date échéancier;N° d\'OT',
      'BAM_KNT_AG;BAM-KNT_AG-TD-01;AMARA OMAR;PS-TD-1T-01;01/06/2026;101'
    ].join('\n');
    const [wo] = parsePlanningCSV(csv);
    expect(wo.planNumber).toBe('');
    expect(wo.planner).toBe('AMARA OMAR');
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

  it('mois de juin : le code NC utilise JUIN2026 (et non JUN2026), comme les codes déjà en base', () => {
    const csv = [
      HEADER,
      buildRow({ otNum: 'NC', eq: 'BAM-MKN_AG-OND-01' }),
      buildRow({ otNum: 'NC', eq: 'BAM-MKN_AG-OND-02' }),
    ].join('\n');
    const fileName = 'PMP AG Type A MEKNES Juin 2026.xlsx';
    const result = parsePlanningCSV(csv, [], [fileName, fileName]);
    expect(result[0].code).toBe('NC-AG Type A MEKNES-JUIN2026-001');
    expect(result[1].code).toBe('NC-AG Type A MEKNES-JUIN2026-002');
  });

  it("les autres mois gardent leur abréviation (mai = MAI, juillet = JUL)", () => {
    const csv = [HEADER, buildRow({ otNum: 'NC', eq: 'BAM-KNT_AG-PMP-09' })].join('\n');
    expect(parsePlanningCSV(csv, [], ['PMP AG Type A KENITRA Mai 2026.csv'])[0].code).toBe('NC-AG Type A KENITRA-MAI2026-001');
    expect(parsePlanningCSV(csv, [], ['PMP AG Type A KENITRA Juillet 2026.csv'])[0].code).toBe('NC-AG Type A KENITRA-JUL2026-001');
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

function buildGammePlan(fields: Partial<GammePlan>): GammePlan {
  return {
    id: fields.id || 'plan-1',
    equipmentCode: fields.equipmentCode || '',
    planCode: fields.planCode || '',
    interventionTitle: fields.interventionTitle || '',
    equipmentDescription: fields.equipmentDescription,
    tasks: fields.tasks || [{ id: 't1', actionCode: 'A1', label: 'Tâche test' }]
  };
}

describe('findMatchingGammePlanDetailed — statuts de confiance (Phase 1 aperçu import)', () => {
  it('renvoie le même plan que findMatchingGammePlan (aucune régression de comportement)', () => {
    const plans = [buildGammePlan({ equipmentCode: 'CTA-04', planCode: 'GAM-CTA-SEM' })];
    const legacy = findMatchingGammePlan('CTA-04', 'GAM-CTA-SEM', 'Intervention test', plans);
    const detailed = findMatchingGammePlanDetailed('CTA-04', 'GAM-CTA-SEM', 'Intervention test', plans);
    expect(detailed.plan).toBe(legacy);
  });

  it('statut "exact" pour une correspondance code plan + code équipement', () => {
    const plans = [buildGammePlan({ equipmentCode: 'CTA-04', planCode: 'GAM-CTA-SEM' })];
    const res = findMatchingGammePlanDetailed('CTA-04', 'GAM-CTA-SEM', 'Intervention test', plans);
    expect(res.status).toBe('exact');
    expect(res.plan?.planCode).toBe('GAM-CTA-SEM');
  });

  it('statut "approximatif" pour une correspondance devinée (famille/mot-clé), jamais "exact"', () => {
    const plans = [buildGammePlan({ equipmentCode: 'POMPE-01', planCode: 'GAM-DIVERS', interventionTitle: 'Vidange pompe circulation' })];
    const res = findMatchingGammePlanDetailed('AUTRE-CODE', '', 'Contrôle pompe annuel', plans);
    expect(res.status).toBe('approximatif');
    expect(res.method).toContain('approximatif');
  });

  it('statut "approximatif" spécifiquement pour une correspondance par mot-clé (aucune famille reconnue)', () => {
    const plans = [buildGammePlan({ equipmentCode: 'GAINE-01', planCode: 'GAM-VENT', interventionTitle: 'Nettoyage ventilation toiture' })];
    const res = findMatchingGammePlanDetailed('SANS-RAPPORT', '', 'Contrôle ventilation annuelle', plans);
    expect(res.status).toBe('approximatif');
    expect(res.method).toContain('mot-clé');
  });

  it('statut "non_trouve" quand aucune passe ne matche', () => {
    const plans = [buildGammePlan({ equipmentCode: 'XYZ', planCode: 'GAM-XYZ', interventionTitle: 'Autre chose' })];
    const res = findMatchingGammePlanDetailed('INCONNU', 'CODE-INCONNU', 'Rien à voir', plans);
    expect(res.status).toBe('non_trouve');
    expect(res.plan).toBeUndefined();
  });

  it('statut "conflit" quand un plan matcherait mais appartient à un autre site (bug mkn/bml du 15/09)', () => {
    const plans = [buildGammePlan({ equipmentCode: 'MTC-01', planCode: 'GAM-MTC-01', interventionTitle: 'Entretien monte-charge Meknès' })];
    const res = findMatchingGammePlanDetailed('MTC-01', 'GAM-MTC-01', 'Entretien monte-charge', plans, 'Béni Mellal');
    expect(res.status).toBe('conflit');
    expect(res.plan).toBeUndefined();
    expect(res.conflictPlan?.planCode).toBe('GAM-MTC-01');
  });

  it('parsePlanningCSV attache bien le statut de confiance sur chaque WorkOrder généré', () => {
    const plans: GammePlan[] = [buildGammePlan({ equipmentCode: 'BAM-KNT_AG-PMP-09', planCode: 'INT-1' })];
    const csv = [
      HEADER,
      buildRow({ eq: 'BAM-KNT_AG-PMP-09', otNum: '101785' }),
    ].join('\n');
    const result = parsePlanningCSV(csv, plans);
    expect(result[0].gammeMatchStatus).toBe('exact');
    expect(result[0].gammeMatchMethod).toBeTruthy();
  });
});
