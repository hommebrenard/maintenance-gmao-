import { describe, it, expect } from 'vitest';
import { analyzeRequestRows, buildImportContext, parseCoswinDate, toIsoTimestamp, toIsoDate, coswinStateNumber, norm } from './importRequests';

const ctx = buildImportContext({
  requests: [{ code: 'DI00000001' }],
  equipment: [{ id: 'eq1', code: 'BAM-CAS_AG-PMP-01', locationId: 'loc-cas' }],
  locations: [{ id: 'loc-cas', code: 'BAM_CAS_AG' }],
  workOrders: [{ id: 'wo1', code: 'OT-80435' }],
});

// Ligne type du modèle fourni (en-têtes Coswin, dates en numéros de série Excel).
const row = (over: Record<string, unknown> = {}) => ({
  'N° de DI': 'DI00001819', "Description de la demande d'intervention": "Prévoir changement d'un thermostat défectueux",
  'État': '3. OT créé', 'Demandeur': 'MFADEL', "Type d'intervention": 'DAF', 'QSE -type': '', 'N° DAF': '173-N-CTA-01-26',
  'Date de déclaration': 46027.69375, 'Date de fin prévue': 46027, 'Éqpt / grp planifié': 'BAM-TNG_CV-SANT-26', 'Priorité': 'U3',
  "N° d'OT": 80437, 'État OT': 'T', "Description de l'état OT": 'OT TERMINE', 'Description de la fonction': 'FLD-PLB', 'Fonction': 'FLD-PLB',
  'Superviseur': '', 'Centre de charges': 'BAM', 'Date de début prévue': 46027, 'Date de fin': 46027, 'Date de création': 46027.69375,
  'Visa': '', 'Équipement source': 'BAM-TNG_CV-SANT-26', 'Intervention': 'CO00001435', 'Zone': 'BAM_TNG_CV', ...over,
});

describe('importRequests : dates', () => {
  it('numéro de série Excel → date et heure sans décalage', () => {
    const p = parseCoswinDate(46027.69375)!; // 05/01/2026 16:39
    expect(toIsoDate(p)).toBe('2026-01-05');
    expect(toIsoTimestamp(p)).toBe('2026-01-05T16:39:00+01:00');
  });
  it('textes jj/mm/aaaa et aaaa-mm-jj', () => {
    expect(toIsoDate(parseCoswinDate('05/01/2026 16:39')!)).toBe('2026-01-05');
    expect(toIsoTimestamp(parseCoswinDate('2026-01-05 16:39')!)).toBe('2026-01-05T16:39:00+01:00');
    expect(parseCoswinDate('n\'importe quoi')).toBeNull();
    expect(parseCoswinDate('')).toBeNull();
  });
  it('en-têtes et états', () => {
    expect(norm("N° d'OT")).toBe('n d ot');
    expect(coswinStateNumber('3. OT créé')).toBe('3');
    expect(coswinStateNumber('sans numéro')).toBeNull();
  });
});

describe('importRequests : analyse', () => {
  it('ligne valide : champs, statut, priorité, codes conservés, ids non rattachés', () => {
    const { report, rows } = analyzeRequestRows([row()], ctx);
    expect(report.newCount).toBe(1);
    const r = rows[0];
    expect(r).toMatchObject({ code: 'DI00001819', status: 'approuvee', priority: 'basse', priority_code: 'U3', origin: 'coswin',
      intervention_type: 'DAF', daf_number: '173-N-CTA-01-26', ot_number: '80437', ot_state: 'T', site_code: 'BAM_TNG_CV',
      equipment_code: 'BAM-TNG_CV-SANT-26', equipment_id: null, location_id: null, work_order_id: null, due_date: '2026-01-05',
      intervention_code: 'CO00001435', supervisor_name: null, qse_type: null });
    expect(r.declared_at).toBe('2026-01-05T16:39:00+01:00');
    expect(r.created_at).toBe('2026-01-05T16:39:00+01:00');
    expect(report.equipmentUnmatched).toBe(1);
    expect(report.siteUnmatched).toBe(1);
    expect(report.otUnlinked).toBe(1);
    expect(report.unmatchedSites).toEqual(['BAM_TNG_CV']);
  });
  it('rattache équipement, site et OT quand ils existent', () => {
    const { report, rows } = analyzeRequestRows([row({ 'Équipement source': 'BAM-CAS_AG-PMP-01', 'Zone': 'BAM_CAS_AG', "N° d'OT": 80435 })], ctx);
    expect(rows[0]).toMatchObject({ equipment_id: 'eq1', location_id: 'loc-cas', work_order_id: 'wo1' });
    expect(report).toMatchObject({ equipmentMatched: 1, siteMatched: 1, otLinked: 1 });
  });
  it('option B : une demande déjà présente n\'est jamais réimportée', () => {
    const { report, rows } = analyzeRequestRows([row({ 'N° de DI': 'DI00000001' })], ctx);
    expect(rows).toHaveLength(0);
    expect(report.alreadyCount).toBe(1);
  });
  it('état inconnu : non importé, compté et listé', () => {
    const { report, rows } = analyzeRequestRows([row({ 'État': '7. Autre état' }), row({ 'N° de DI': 'DI2', 'État': '7. Autre état' })], ctx);
    expect(rows).toHaveLength(0);
    expect(report.skippedUnknownState).toEqual([{ state: '7. Autre état', count: 2 }]);
  });
  it('doublon dans le fichier, ligne vide, description manquante, priorité inconnue', () => {
    const { report, rows } = analyzeRequestRows([
      row(), row(), { 'N° de DI': '', "Description de la demande d'intervention": '' }, row({ 'N° de DI': 'DI3', "Description de la demande d'intervention": '' }),
      row({ 'N° de DI': 'DI4', 'Priorité': 'Z9' }),
    ], ctx);
    expect(rows.map(r => r.code)).toEqual(['DI00001819', 'DI4']);
    expect(report.blankRows).toBe(1);
    expect(report.invalid).toEqual([{ code: 'DI3', reason: 'Description manquante' }]);
    expect(rows[1].priority).toBe('moyenne');
    expect(report.warnings.some(w => w.message.includes('double'))).toBe(true);
    expect(report.warnings.some(w => w.message.includes('Priorité'))).toBe(true);
  });
  it('année incohérente déclaration / création : avertissement (cas DI00001812)', () => {
    const { report, rows } = analyzeRequestRows([row({ 'Date de déclaration': 45659.5, 'Date de création': 46025.4 })], ctx);
    expect(report.warnings.some(w => w.message.includes('année probablement erronée'))).toBe(true);
    expect(rows[0].created_at).toBe(rows[0].coswin_created_at); // la création système est retenue
    expect(rows[0].declared_at).not.toBe(rows[0].created_at); // la déclaration brute reste conservée
  });
  it('en-têtes obligatoires manquants : rien n\'est analysé', () => {
    const { report, rows } = analyzeRequestRows([{ 'Colonne': 'x' }], ctx);
    expect(report.missingHeaders).toEqual(['N° de DI', "Description de la demande d'intervention", 'État']);
    expect(rows).toHaveLength(0);
  });
});
