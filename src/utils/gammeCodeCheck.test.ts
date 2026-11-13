import { describe, it, expect } from 'vitest';
import {
  analyzeGammeCodes, splitWritable, descriptionScore, normalizeDescription, normalizeCodeForSearch, excludedToCsv,
  type EquipmentRef
} from './gammeCodeCheck';
import type { GammePlan } from '../types';

// Jeux entièrement fictifs : aucun code, nom ni site réel. Aucune date ni heure : indépendant du fuseau horaire.
const plan = (eq: string, desc = '', tasks = 2, pl = 'PLAN-A'): GammePlan => ({
  id: `${eq}-${pl}`, equipmentCode: eq, planCode: pl, interventionTitle: 'Titre test', equipmentDescription: desc,
  tasks: Array.from({ length: tasks }, (_, i) => ({ id: `${i}`, actionCode: `ACT${i}`, label: `action ${i}` }))
} as GammePlan);

const REF: EquipmentRef[] = [
  { code: 'DEMO-AG-ECL-01', name: 'Eclairage intérieur bloc A' },
  { code: 'DEMO-AG-ECL-02', name: 'Eclairage intérieur bloc B' },
  { code: 'DEMO-AG-ECL-03', name: 'Eclairage extérieur' },
  { code: 'DEMO-AG-ASC-01', name: 'Ascenseur principal' },
  { code: 'DEMO-CV-ECL-01', name: 'Eclairage intérieur bloc A' },
  { code: 'DEMO-AG-FL-01', name: 'Pompe alimentation eau' },
  { code: 'DEMO-AG-TWIN-01', name: 'Armoire test' },
  { code: 'DEMO-AG-TWIN-02', name: 'Armoire test' }
];

describe('analyzeGammeCodes — statuts', () => {
  it('code existant : exact, sans candidat', () => {
    const r = analyzeGammeCodes([plan('DEMO-AG-FL-01')], REF);
    expect(r.rows[0].status).toBe('exact');
    expect(r.rows[0].candidates).toEqual([]);
    expect(r.counts.exact).toBe(1);
  });

  it('code coupé avec plusieurs candidats du même site : prefixe_multiple, 3 candidats', () => {
    const r = analyzeGammeCodes([plan('DEMO-AG-ECL-0', 'Eclairage intérieur bloc B')], REF);
    expect(r.rows[0].status).toBe('prefixe_multiple');
    expect(r.rows[0].candidateCount).toBe(3);
  });

  it('code coupé avec un seul candidat : prefixe_unique', () => {
    const r = analyzeGammeCodes([plan('DEMO-AG-ASC-0', 'Ascenseur principal')], REF);
    expect(r.rows[0].status).toBe('prefixe_unique');
    expect(r.rows[0].candidates.map(c => c.code)).toEqual(['DEMO-AG-ASC-01']);
  });

  it('code inconnu : sans_candidat', () => {
    const r = analyzeGammeCodes([plan('DEMO-AG-XXX-01', 'Equipement inconnu')], REF);
    expect(r.rows[0].status).toBe('sans_candidat');
    expect(r.counts.sans_candidat).toBe(1);
  });

  it('le candidat d\'un autre site n\'est jamais proposé', () => {
    const r = analyzeGammeCodes([plan('DEMO-CV-ECL-0', 'Eclairage intérieur bloc A')], REF);
    expect(r.rows[0].status).toBe('prefixe_unique');
    expect(r.rows[0].candidates.map(c => c.code)).toEqual(['DEMO-CV-ECL-01']);
  });

  it('écart de casse seul : casse_seule, jamais exact', () => {
    const r = analyzeGammeCodes([plan('demo-ag-fl-01')], REF);
    expect(r.rows[0].status).toBe('casse_seule');
    expect(r.rows[0].candidates[0].code).toBe('DEMO-AG-FL-01');
  });

  it('espaces et insécables parasites : casse_seule', () => {
    const r = analyzeGammeCodes([plan('DEMO-AG-FL-01\u00a0'), plan(' DEMO-AG-FL-01')], REF);
    expect(r.rows.map(x => x.status)).toEqual(['casse_seule', 'casse_seule']);
  });

  it('code trop court ou vide : aucun candidat arbitraire', () => {
    const r = analyzeGammeCodes([plan('DE'), plan('')], REF);
    expect(r.rows.map(x => x.status)).toEqual(['sans_candidat', 'sans_candidat']);
  });

  it('code coupé au milieu (caractère manquant) : non retrouvé par préfixe, signalé sans candidat', () => {
    const r = analyzeGammeCodes([plan('DEMO-AG-EL-01')], REF);
    expect(r.rows[0].status).toBe('sans_candidat');
  });

  it('ne modifie ni les gammes ni la liste d\'équipements', () => {
    const plans = [plan('DEMO-AG-ECL-0', 'x')];
    const copy = JSON.stringify(plans);
    const refCopy = JSON.stringify(REF);
    analyzeGammeCodes(plans, REF);
    expect(JSON.stringify(plans)).toBe(copy);
    expect(JSON.stringify(REF)).toBe(refCopy);
    expect(plans[0].equipmentCode).toBe('DEMO-AG-ECL-0');
  });

  it('compte les titres sans action', () => {
    const r = analyzeGammeCodes([plan('DEMO-AG-FL-01', '', 0), plan('DEMO-AG-ASC-01', '', 3)], REF);
    expect(r.counts.sansAction).toBe(1);
  });
});

describe('classement des candidats par description', () => {
  it('bloc B en tête pour « bloc B », bloc A pénalisé malgré des mots communs', () => {
    const r = analyzeGammeCodes([plan('DEMO-AG-ECL-0', 'ECLAIRAGE INTERIEUR BLOC B')], REF);
    const c = r.rows[0].candidates;
    expect(c[0].code).toBe('DEMO-AG-ECL-02');
    expect(c[0].score).toBe(1);
    const a = c.find(x => x.code === 'DEMO-AG-ECL-01')!;
    expect(a.score).toBeLessThan(0.6);
    expect(r.rows[0].ambiguousTop).toBe(false);
  });

  it('descriptions identiques : ambiguïté signalée', () => {
    const r = analyzeGammeCodes([plan('DEMO-AG-TWIN-0', 'Armoire test')], REF);
    expect(r.rows[0].ambiguousTop).toBe(true);
    expect(r.rows[0].candidates.map(c => c.score)).toEqual([1, 1]);
  });

  it('sans description : scores à 0 et ambiguïté signalée', () => {
    const r = analyzeGammeCodes([plan('DEMO-AG-ECL-0', '')], REF);
    expect(r.rows[0].candidates.every(c => c.score === 0)).toBe(true);
    expect(r.rows[0].ambiguousTop).toBe(true);
  });

  it('accents, casse, ponctuation : sans effet sur le score', () => {
    expect(descriptionScore('Éclairage - intérieur, BLOC b', 'ECLAIRAGE INTERIEUR bloc B')).toBe(1);
  });

  it('chiffres et lettres isolées conservés dans la normalisation', () => {
    expect(normalizeDescription('Vanne 24V / bloc B')).toBe('vanne 24v bloc b');
    expect(descriptionScore('vanne 24v', 'vanne 230v')).toBeLessThan(0.5);
  });

  it('tri stable : à score égal, ordre des codes', () => {
    const r = analyzeGammeCodes([plan('DEMO-AG-TWIN-0', 'Armoire test')], REF);
    expect(r.rows[0].candidates.map(c => c.code)).toEqual(['DEMO-AG-TWIN-01', 'DEMO-AG-TWIN-02']);
  });

  it('au plus 12 candidats listés, nombre total conservé', () => {
    const many: EquipmentRef[] = Array.from({ length: 30 }, (_, i) => ({ code: `DEMO-AG-MANY-${String(i).padStart(2, '0')}`, name: 'Pompe' }));
    const r = analyzeGammeCodes([plan('DEMO-AG-MANY-', 'Pompe')], many);
    expect(r.rows[0].candidates).toHaveLength(12);
    expect(r.rows[0].candidateCount).toBe(30);
  });
});

describe('splitWritable', () => {
  const plans = [
    plan('DEMO-AG-FL-01'), // exact
    plan('DEMO-AG-ECL-0', 'x'), // prefixe_multiple
    plan('DEMO-AG-ASC-0', 'x'), // prefixe_unique
    plan('DEMO-AG-XXX-01'), // sans_candidat
    plan('demo-ag-fl-01') // casse_seule
  ];

  it('par défaut : seul le code exact est écrit', () => {
    const rep = analyzeGammeCodes(plans, REF);
    const s = splitWritable(rep, { includeNoCandidate: false });
    expect(s.writable.map(p => p.equipmentCode)).toEqual(['DEMO-AG-FL-01']);
    expect(s.excluded).toHaveLength(4);
  });

  it('option explicite : « sans candidat » écrit aussi, jamais les codes incomplets ni la casse', () => {
    const rep = analyzeGammeCodes(plans, REF);
    const s = splitWritable(rep, { includeNoCandidate: true });
    expect(s.writable.map(p => p.equipmentCode)).toEqual(['DEMO-AG-FL-01', 'DEMO-AG-XXX-01']);
    expect(s.excluded.map(e => e.status)).toEqual(['prefixe_multiple', 'prefixe_unique', 'casse_seule']);
  });

  it('un fichier de codes exacts passe en entier, ordre conservé (non-régression)', () => {
    const rep = analyzeGammeCodes([plan('DEMO-AG-FL-01', '', 1, 'P1'), plan('DEMO-AG-ASC-01', '', 1, 'P2')], REF);
    const s = splitWritable(rep, { includeNoCandidate: false });
    expect(s.writable.map(p => p.planCode)).toEqual(['P1', 'P2']);
    expect(s.excluded).toEqual([]);
  });

  it('le cas des collisions : 3 codes coupés identiques restent exclus, jamais fusionnés', () => {
    const rep = analyzeGammeCodes([plan('DEMO-AG-ECL-0', 'a'), plan('DEMO-AG-ECL-0', 'b'), plan('DEMO-AG-ECL-0', 'c')], REF);
    const s = splitWritable(rep, { includeNoCandidate: true });
    expect(s.writable).toEqual([]);
    expect(s.excluded).toHaveLength(3);
  });
});

describe('utilitaires', () => {
  it('normalizeCodeForSearch retire espaces, insécables, caractères invisibles', () => {
    expect(normalizeCodeForSearch(' ab-01\u00a0\u200b ')).toBe('AB-01');
  });

  it('excludedToCsv : en-tête, guillemets doublés, candidats avec score', () => {
    const rep = analyzeGammeCodes([plan('DEMO-AG-ECL-0', 'Eclairage "bloc" B')], REF);
    const csv = excludedToCsv(splitWritable(rep, { includeNoCandidate: false }).excluded);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith('"code_fichier";"plan"')).toBe(true);
    expect(lines[1]).toContain('"Eclairage ""bloc"" B"');
    expect(lines[1]).toContain('DEMO-AG-ECL-');
  });

  it('volume réaliste : 5 000 équipements, 400 gammes, moins de 3 secondes', () => {
    const big: EquipmentRef[] = Array.from({ length: 5000 }, (_, i) => ({ code: `SITE${i % 40}-EQ-${String(i).padStart(5, '0')}`, name: `Equipement ${i % 100}` }));
    const plans = Array.from({ length: 400 }, (_, i) => plan(i % 2 ? big[i].code : `SITE${i % 40}-EQ-0`, `Equipement ${i % 100}`));
    const t0 = performance.now();
    const r = analyzeGammeCodes(plans, big);
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(r.counts.exact).toBe(200);
  });
});
