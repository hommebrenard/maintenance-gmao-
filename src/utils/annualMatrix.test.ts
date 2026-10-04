import { describe, it, expect } from 'vitest';
import { buildAnnualMatrix, availableYears, isoWeekOf, weekColumns, frequencyOf, familyKeyOf, cleanFamilyName, buildFamilyOptions } from './annualMatrix';
import type { WorkOrder } from '../types';

const wo = (o: Partial<WorkOrder>): WorkOrder => ({
  id: o.code || 'x', code: 'OT-1', title: 't', description: '', status: 'Ouvert', priority: 'Moyenne',
  type: 'Préventive', dueDate: '2026-03-10', createdAt: '', updatedAt: '', equipmentId: 'e1', equipmentName: 'ASCENSEUR N1', ...o,
} as WorkOrder);

const TODAY = '2026-06-15';

describe('buildAnnualMatrix', () => {
  it('compte par équipement et par mois, ignore les annulés et les autres années', () => {
    const m = buildAnnualMatrix([
      wo({ code: 'A', dueDate: '2026-03-10', status: 'Terminé' }),
      wo({ code: 'B', dueDate: '2026-03-20', status: 'Terminé' }),
      wo({ code: 'C', dueDate: '2026-03-25', status: 'Annulé' }),
      wo({ code: 'D', dueDate: '2025-03-25', status: 'Terminé' }),
      wo({ code: 'E', dueDate: '2026-04-01', status: 'Ouvert', equipmentId: 'e2', equipmentName: 'AR 1' }),
    ], 2026, TODAY);
    expect(m.rows.map(r => r.label)).toEqual(['AR 1', 'ASCENSEUR N1']);
    const asc = m.rows[1];
    expect(asc.cells[2]).toMatchObject({ total: 2, done: 2, state: 'done' });
    expect(asc.percent).toBe(100);
    expect(m.grand).toMatchObject({ total: 3, done: 2 });
  });

  it('états : en retard > partiel > à venir', () => {
    const m = buildAnnualMatrix([
      wo({ code: 'A', dueDate: '2026-05-10', status: 'Ouvert' }),                       // mai : retard
      wo({ code: 'B', dueDate: '2026-06-01', status: 'Terminé' }),
      wo({ code: 'C', dueDate: '2026-06-30', status: 'Ouvert' }),                       // juin : partiel (échéance future)
      wo({ code: 'D', dueDate: '2026-09-01', status: 'En cours' }),                     // sept : à venir
    ], 2026, TODAY);
    const c = m.rows[0].cells;
    expect(c[4].state).toBe('overdue');
    expect(c[5].state).toBe('partial');
    expect(c[8].state).toBe('pending');
    expect(c[0].state).toBe('none');
    expect(m.rows[0].overdue).toBe(1);
  });

  it('regroupe les OT sans équipement et liste les années disponibles', () => {
    const orders = [
      wo({ code: 'A', equipmentId: undefined, equipmentName: undefined, equipmentCode: undefined, dueDate: '2026-01-05' }),
      wo({ code: 'B', dueDate: '2025-12-31' }),
      wo({ code: 'C', dueDate: '' }),
    ];
    expect(buildAnnualMatrix(orders, 2026, TODAY).rows[0].label).toBe('Sans équipement');
    expect(availableYears(orders)).toEqual([2026, 2025]);
  });
});

describe('semaines ISO', () => {
  it('numérote correctement les semaines (cas limites de début/fin d\'année)', () => {
    expect(isoWeekOf('2026-01-01')).toEqual({ year: 2026, week: 1 });
    expect(isoWeekOf('2026-06-15')).toEqual({ year: 2026, week: 25 });
    expect(isoWeekOf('2026-12-31')).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf('2027-01-01')).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf('2024-12-30')).toEqual({ year: 2025, week: 1 });
  });

  it('52 ou 53 colonnes, chaque semaine rattachée à un mois', () => {
    expect(weekColumns(2026)).toHaveLength(53);
    expect(weekColumns(2025)).toHaveLength(52);
    const cols = weekColumns(2026);
    expect(cols[0].monthIndex).toBe(0);
    expect(cols[52].monthIndex).toBe(11);
  });

  it('mode semaine : place l\'OT dans sa semaine et repère la semaine courante', () => {
    const m = buildAnnualMatrix([
      wo({ code: 'A', dueDate: '2026-06-16', status: 'Ouvert' }),   // semaine 25, en retard? non (aujourd'hui = 06-15)
      wo({ code: 'B', dueDate: '2026-06-10', status: 'Ouvert' }),   // semaine 24, en retard
      wo({ code: 'C', dueDate: '2026-06-11', status: 'Terminé' }),  // semaine 24, clôturé
    ], 2026, '2026-06-15', 'week');
    expect(m.columns).toHaveLength(53);
    expect(m.currentIndex).toBe(24);                 // semaine 25
    const c = m.rows[0].cells;
    expect(c[24]).toMatchObject({ total: 1, state: 'pending' });
    expect(c[23]).toMatchObject({ total: 2, done: 1, state: 'overdue' });
  });

  it('mode mois : repère le mois courant, null si l\'année affichée est différente', () => {
    expect(buildAnnualMatrix([], 2026, '2026-06-15').currentIndex).toBe(5);
    expect(buildAnnualMatrix([], 2025, '2026-06-15').currentIndex).toBeNull();
  });
});

describe('frequencyOf', () => {
  it('lit la lettre dans le code de gamme, sinon dans le titre', () => {
    expect(frequencyOf({ interventionCode: 'PS-ASC-1H-01', title: '' })).toBe('H');
    expect(frequencyOf({ interventionCode: ' PS-TD-1T-01 ', title: '' })).toBe('T');
    expect(frequencyOf({ interventionCode: 'PS-CTA-1A-01', title: 'x' })).toBe('A');
    expect(frequencyOf({ interventionCode: '', title: 'PREVENTIF SYSTEMATIQUE MENSUEL ASCENSEUR' })).toBe('M');
    expect(frequencyOf({ interventionCode: undefined, title: 'Visite semestrielle' })).toBe('S');
    expect(frequencyOf({ interventionCode: 'REP-01', title: 'Fuite' })).toBeUndefined();
  });

  it('liste les fréquences de chaque case (ordre H, M, T, S, A, puis « • »)', () => {
    const m = buildAnnualMatrix([
      wo({ code: 'A', dueDate: '2026-03-10', interventionCode: 'PS-ASC-1M-01' }),
      wo({ code: 'B', dueDate: '2026-03-11', interventionCode: 'PS-ASC-1H-01' }),
      wo({ code: 'C', dueDate: '2026-03-12', title: 'Fuite', type: 'Corrective' }),
    ], 2026, TODAY);
    expect(m.rows[0].cells[2].freqs).toEqual(['H', 'M', '•']);
    expect(m.rows[0].cells[0].freqs).toEqual([]);
  });
});

describe('familles d\'équipements', () => {
  it('lit le segment type du code', () => {
    expect(familyKeyOf('BAM-KNT_AG-ASC-01')).toBe('ASC');
    expect(familyKeyOf('BAM-RAK_AG-EQCUIS-01')).toBe('EQCUIS');
    expect(familyKeyOf('')).toBe('AUTRES');
    expect(familyKeyOf('sans format')).toBe('AUTRES');
  });

  it('nettoie les noms (numéro, marque, caractéristiques)', () => {
    expect(cleanFamilyName('ASCENSEUR N1 MARQUE: SCHINDLER, POID: 400KG')).toBe('ASCENSEUR');
    expect(cleanFamilyName('ARMOIRE DE CLIMATISATION N1 SALLE')).toBe('ARMOIRE DE CLIMATISATION');
    expect(cleanFamilyName('TABLEAU DE DISTRIBUTION 02TEE9')).toBe('TABLEAU DE DISTRIBUTION');
    expect(cleanFamilyName('EXTRACTEUR 12C HALL')).toBe('EXTRACTEUR');
  });

  it('regroupe par famille avec effectifs ; noms variés → mots communs', () => {
    const rows = [
      { family: 'ASC', label: 'ASCENSEUR N1' }, { family: 'ASC', label: 'ASCENSEUR N2 PERSONNEL' },
      { family: 'ECLIN', label: 'ECLAIRAGE INTERIEUR MEZZANINE' }, { family: 'ECLIN', label: 'ECLAIRAGE INTERIEUR TERASSE' },
      { family: 'ECLIN', label: 'ECLAIRAGE INTERIEUR HALL' },
    ];
    expect(buildFamilyOptions(rows)).toEqual([
      { key: 'ASC', label: 'ASCENSEUR (ASC)', count: 2 },
      { key: 'ECLIN', label: 'ECLAIRAGE INTERIEUR (ECLIN)', count: 3 },
    ]);
  });
});
