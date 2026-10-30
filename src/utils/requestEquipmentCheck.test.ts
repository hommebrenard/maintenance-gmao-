import { describe, it, expect } from 'vitest';
import {
  checkRequestRows, significantTokens, isDecided, pendingIssues, applyDecisions,
  type EquipmentLite, type CheckableRow, type CheckContext, type EquipmentDecision,
} from './requestEquipmentCheck';
import { analyzeRequestRows, buildImportContext } from './importRequests';
import { TEST_EQUIPMENT, COSWIN_DI_SAMPLE } from './requestEquipmentCheck.fixture';

// Données entièrement synthétiques : TEST-SITE-A (équipements du jeu de test), TEST-SITE-B (quelques équipements), deux sites aux codes ambigus.
const siteA = TEST_EQUIPMENT.map(([code, name]): EquipmentLite => ({ id: code, code, name, locationId: 'SITE-A' }));
const siteB: EquipmentLite[] = [
  { id: 'TEST-B-POMPE-01', code: 'TEST-B-POMPE-01', name: 'POMPE DE RELEVAGE N1 MARQUE: DEMO', locationId: 'SITE-B' },
  { id: 'TEST-B-OND-01', code: 'TEST-B-OND-01', name: 'ONDULEUR N1 PUISSANCE: 10KVA', locationId: 'SITE-B' },
];
const equipment = [...siteA, ...siteB];
const ctx: CheckContext = {
  equipmentList: equipment,
  locationIdByCode: new Map([['TEST-SITE-A', 'SITE-A'], ['TEST-SITE-B', 'SITE-B'], ['TEST_SITE-C', 'SITE-C1'], ['TEST-SITE_C', 'SITE-C2']]),
  locationIdByKey: new Map([['TEST_SITE_A', 'SITE-A'], ['TEST_SITE_B', 'SITE-B']]),
  ambiguousSiteKeys: new Set(['TEST_SITE_C']),
};
const mk = (code: string, title: string, equipmentId: string | null, site: string | null = 'TEST-SITE-A'): CheckableRow => ({
  code, title, equipment_id: equipmentId, site_code: site, equipment_code: equipmentId ?? 'COSWIN-X', planned_equipment_code: equipmentId ?? 'COSWIN-X',
});
const T = (x: string) => `BESOIN D'ENTRETIEN PREVENTIF ${x} POUR LE MOIS D'OCTOBRE 2026`;

const sample = COSWIN_DI_SAMPLE.map(r => ({ ...mk(r[0], r[1], r[3]), correct: r[4] }));
const corrected = sample.filter(r => r.equipment_code !== r.correct);
const unchanged = sample.filter(r => r.equipment_code === r.correct);

describe('contrôle v2 : site valide, équipement du même site', () => {
  const res = checkRequestRows(sample, ctx);
  const byDi = new Map(res.issues.map(i => [i.requestCode, i]));

  it('le jeu synthétique contient 16 DI mal rattachées et 5 justes', () => {
    expect(corrected.length).toBe(16);
    expect(unchanged.length).toBe(5);
  });
  it('signale les 16 DI mal rattachées (incohérence) avec l\u2019équipement correct en 1re proposition', () => {
    for (const r of corrected) {
      const i = byDi.get(r.code)!;
      expect(i, r.code).toBeDefined();
      expect(i.kind).toBe('incoherent');
      expect(i.suggestions[0].code, r.code).toBe(r.correct);
      expect(i.assigned!.code).toBe(r.equipment_code);
    }
    expect(res.issues.length).toBe(16);
    expect(res.accepted).toBe(5);
  });
  it('ne signale pas les 5 DI correctement rattachées (dont ampoules / luminaires)', () => {
    for (const r of unchanged) expect(byDi.has(r.code), r.code).toBe(false);
  });
  it('une DI qui reprend la description de son équipement n\u2019est jamais signalée', () => {
    const own = siteA.map(e => mk(`T-${e.code}`, `BESOIN D'ENTRETIEN PREVENTIF ${e.name}`, e.id));
    expect(checkRequestRows(own, ctx).issues).toEqual([]);
  });
  it('une DI courte est détectée ; une DI courte bien rattachée ne l\u2019est pas', () => {
    expect(checkRequestRows([mk('C1', T('ONDULEUR N2'), 'TST-AG-APLC-03')], ctx).issues[0].suggestions[0].code).toBe('TST-AG-OND-02');
    expect(checkRequestRows([mk('C2', T('ONDULEUR N2'), 'TST-AG-OND-02')], ctx).issues).toEqual([]);
  });
  it('puissance : note sur les DI signalées, simple avertissement si le rattachement est bon', () => {
    expect(byDi.get('DI00000003')!.powerNote).toContain('20 KVA');
    expect(byDi.get('DI00000005')!.powerNote).toBeUndefined();
    const ok = checkRequestRows([mk('P1', T('ONDULEUR N4 PUISSANCE 20KVA'), 'TST-AG-OND-04')], ctx);
    expect(ok.issues).toEqual([]);
    expect(ok.powerWarnings.map(w => w.requestCode)).toEqual(['P1']);
  });
  it('limite connue : vocabulaire différent (UPS / ONDULEUR), rien n\u2019est signalé', () => {
    const c: CheckContext = { ...ctx, equipmentList: [{ id: 'U1', code: 'U1', name: 'UPS N3 10KVA', locationId: 'SITE-A' }, { id: 'U2', code: 'U2', name: 'ENSEMBLE APPAREILLAGES ELECTRIQUES RDC', locationId: 'SITE-A' }, { id: 'U3', code: 'U3', name: 'TABLEAU ELECTRIQUE N1', locationId: 'SITE-A' }] };
    expect(checkRequestRows([mk('U', T('ONDULEUR N3'), 'U2')], c).issues).toEqual([]);
  });
});

describe('contrôle v2 : site inconnu, absent ou ambigu', () => {
  it('Zone inconnue, absente ou ambiguë : la DI est bloquée, sans aucune proposition', () => {
    const r = checkRequestRows([
      mk('S1', T('ONDULEUR N1'), 'TST-AG-OND-01', 'TEST-SITE-ZZ'), mk('S2', T('ONDULEUR N1'), 'TST-AG-OND-01', null), mk('S3', T('ONDULEUR N1'), 'TST-AG-OND-01', 'TEST_SITE_C'),
    ], ctx);
    expect(r.issues.map(i => i.kind)).toEqual(['site_inconnu', 'site_absent', 'site_ambigu']);
    expect(r.issues.every(i => i.siteId === null && i.suggestions.length === 0)).toBe(true);
  });
  it('le site n\u2019est jamais déduit de l\u2019équipement rattaché', () => {
    const r = checkRequestRows([mk('S4', T('ONDULEUR N1'), 'TST-AG-OND-01', 'TEST-SITE-ZZ')], ctx);
    expect(r.issues[0].kind).toBe('site_inconnu');
  });
  it('rapprochement tolérant des séparateurs : TEST_SITE_A = TEST-SITE-A', () => {
    expect(checkRequestRows([mk('S5', T('ONDULEUR N2'), 'TST-AG-OND-02', 'test_site_a')], ctx).issues).toEqual([]);
  });
  it('l\u2019analyse d\u2019import utilise la Zone (tolérante) et signale deux codes de site confondus', () => {
    const c = buildImportContext({
      requests: [], equipment: [], workOrders: [],
      locations: [{ id: 'SITE-A', code: 'TEST-SITE-A' }, { id: 'SITE-C1', code: 'TEST_SITE-C' }, { id: 'SITE-C2', code: 'TEST-SITE_C' }],
    });
    const raw = (zone: string) => ({ 'N° de DI': `DI-TEST-${zone}`, "Description de la demande d'intervention": 'ENTRETIEN TEST', 'État': '0. Créée', 'Zone': zone, 'Priorité': 'U3' });
    const a = analyzeRequestRows([raw('TEST_SITE_A'), raw('TEST_SITE_C'), raw('TEST-SITE-ZZ')], c);
    expect(a.rows.find(r => r.code === 'DI-TEST-TEST_SITE_A')!.location_id).toBe('SITE-A');
    expect(a.rows.find(r => r.code === 'DI-TEST-TEST_SITE_C')!.location_id).toBeNull();
    expect(a.report.siteMatched).toBe(1);
    expect(a.report.siteUnmatched).toBe(2);
  });
});

describe('contrôle v2 : équipement absent ou d\u2019un autre site', () => {
  it('équipement absent de l\u2019application : DI acceptée sans lien, comptée à part', () => {
    const r = checkRequestRows([mk('E1', T('ONDULEUR N1'), null)], ctx);
    expect(r.issues).toEqual([]);
    expect(r.unknownEquipmentRows).toBe(1);
    expect(r.unknownEquipmentCodes).toEqual(['COSWIN-X']);
  });
  it('équipement d\u2019un autre site : DI bloquée, propositions uniquement du site de la Zone', () => {
    const r = checkRequestRows([mk('H1', T('POMPE DE RELEVAGE N1'), 'TEST-B-POMPE-01')], ctx);
    const i = r.issues[0];
    expect(i.kind).toBe('hors_site');
    expect(i.siteId).toBe('SITE-A');
    expect(i.suggestions.length).toBeGreaterThan(0);
    expect(i.suggestions[0].code).toBe('TST-AG-PMP-01');
    expect(i.suggestions.every(s => equipment.find(e => e.id === s.id)!.locationId === 'SITE-A')).toBe(true);
  });
  it('ne propose jamais un équipement d\u2019un autre site, même s\u2019il correspond mieux à la description', () => {
    const r = checkRequestRows([mk('H2', T('ONDULEUR N1 PUISSANCE 10KVA'), 'TEST-B-OND-01', 'TEST-SITE-B')], ctx);
    expect(r.issues).toEqual([]); // rattaché au bon site : rien à signaler
    const r2 = checkRequestRows([mk('H3', T('ONDULEUR N1'), 'TEST-B-OND-01')], ctx);
    expect(r2.issues[0].suggestions.map(s => s.id)).not.toContain('TEST-B-OND-01');
  });
});

describe('contrôle v2 : décisions et import', () => {
  const rows = [mk('D1', T('ONDULEUR N2'), 'TST-AG-APLC-03'), mk('D2', T('POMPE DE RELEVAGE N1'), 'TEST-B-POMPE-01'), mk('D3', T('ONDULEUR N1'), 'TST-AG-OND-01', 'TEST-SITE-ZZ'), mk('D4', T('ONDULEUR N1'), 'TST-AG-OND-01')]
    .map(r => ({ ...r, location_id: 'SITE-A' }));
  const { issues } = checkRequestRows(rows, ctx);

  it('une DI sans décision ne peut pas être importée (pas d\u2019écriture partielle)', () => {
    expect(issues.map(i => i.requestCode)).toEqual(['D1', 'D2', 'D3']);
    expect(pendingIssues(issues, {}, equipment).length).toBe(3);
    expect(() => applyDecisions(rows, issues, {}, equipment)).toThrow(/Décision manquante/);
  });
  it('une décision explicite permet l\u2019import ; garder Coswin laisse la ligne intacte', () => {
    const d: Record<string, EquipmentDecision> = { D1: { kind: 'keep' }, D2: { kind: 'keep' }, D3: { kind: 'keep' } };
    const out = applyDecisions(rows, issues, d, equipment);
    expect(out.rows).toEqual(rows);
    expect(out.skipped + out.relinked).toBe(0);
  });
  it('« ne pas importer » retire la DI ; « utiliser » ne change que le lien equipment_id et conserve les valeurs Coswin', () => {
    const d: Record<string, EquipmentDecision> = { D1: { kind: 'use', equipmentId: 'TST-AG-OND-02' }, D2: { kind: 'skip' }, D3: { kind: 'skip' } };
    const out = applyDecisions(rows, issues, d, equipment);
    expect(out.skipped).toBe(2);
    expect(out.relinked).toBe(1);
    const d1 = out.rows.find(r => r.code === 'D1')!;
    const before = rows.find(r => r.code === 'D1')!;
    expect(d1.equipment_id).toBe('TST-AG-OND-02');
    expect(d1.equipment_code).toBe(before.equipment_code);
    expect(d1.planned_equipment_code).toBe(before.planned_equipment_code);
    expect(d1.site_code).toBe(before.site_code);
    expect(d1.location_id).toBe(before.location_id);
    expect(out.rows.map(r => r.code)).toEqual(['D1', 'D4']);
  });
  it('un équipement d\u2019un autre site, ou « utiliser » sur un problème de site, n\u2019est pas une décision valable', () => {
    const [i1, , i3] = issues;
    expect(isDecided(i1, { kind: 'use', equipmentId: 'TEST-B-OND-01' }, equipment)).toBe(false);
    expect(isDecided(i3, { kind: 'use', equipmentId: 'TST-AG-OND-01' }, equipment)).toBe(false);
    expect(isDecided(i1, { kind: 'use', equipmentId: 'TST-AG-OND-02' }, equipment)).toBe(true);
    expect(isDecided(i1, undefined, equipment)).toBe(false);
  });
});

describe('mots significatifs', () => {
  it('fautes de frappe, N05 = N5, mots-outils ignorés', () => {
    expect(significantTokens("BESOIN D'ENTRETIEN PREVENTIF CAISSON AIR NEUF N05 POUR LE MOIS D'octobre 2026")).toEqual(['caisson', 'air', 'neuf', 'n5']);
  });
});
