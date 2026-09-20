import { describe, it, expect } from 'vitest';
import type { WorkOrder } from '../types';
import {
  isBlankField,
  getLinkedWorkOrders,
  getOperationalStatusBadgeClass,
  getWorkOrderStatusBadgeClass,
  formatIsoDate,
} from './equipmentDisplay';

function makeWO(partial: Partial<WorkOrder> & { id: string; code: string }): WorkOrder {
  return {
    title: 'Contrôle',
    description: '',
    status: 'Ouvert',
    priority: 'Moyenne',
    type: 'Préventive',
    dueDate: '2026-06-15',
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
    ...partial,
  };
}

describe('isBlankField', () => {
  it('considère vide, espaces et tiret cadratin comme non renseignés', () => {
    expect(isBlankField(undefined)).toBe(true);
    expect(isBlankField(null)).toBe(true);
    expect(isBlankField('')).toBe(true);
    expect(isBlankField('   ')).toBe(true);
    expect(isBlankField('—')).toBe(true);
    expect(isBlankField(' — ')).toBe(true);
  });

  it('considère une vraie valeur comme renseignée', () => {
    expect(isBlankField('Schindler')).toBe(false);
    expect(isBlankField('105916')).toBe(false);
  });
});

describe('getLinkedWorkOrders', () => {
  const eq = { id: 'eq-1', code: 'BAM-MKN_AG-ASC-01' };

  it('rattache par equipmentId', () => {
    const list = [
      makeWO({ id: 'a', code: 'OT-1', equipmentId: 'eq-1' }),
      makeWO({ id: 'b', code: 'OT-2', equipmentId: 'eq-2' }),
    ];
    expect(getLinkedWorkOrders(eq, list).map(w => w.id)).toEqual(['a']);
  });

  it('rattache par code équipement quand l\'OT n\'a pas d\'equipmentId', () => {
    const list = [
      makeWO({ id: 'a', code: 'OT-1', equipmentCode: 'BAM-MKN_AG-ASC-01' }),
      makeWO({ id: 'b', code: 'OT-2', equipmentCode: 'AUTRE' }),
      makeWO({ id: 'c', code: 'OT-3' }),
    ];
    expect(getLinkedWorkOrders(eq, list).map(w => w.id)).toEqual(['a']);
  });

  it('equipmentId fait foi : un OT lié à un autre équipement ne remonte pas par le code', () => {
    const list = [
      makeWO({ id: 'a', code: 'OT-1', equipmentId: 'eq-2', equipmentCode: 'BAM-MKN_AG-ASC-01' }),
    ];
    expect(getLinkedWorkOrders(eq, list)).toEqual([]);
  });

  it('trie par échéance décroissante puis par code', () => {
    const list = [
      makeWO({ id: 'a', code: 'OT-2', equipmentId: 'eq-1', dueDate: '2026-04-10' }),
      makeWO({ id: 'b', code: 'OT-9', equipmentId: 'eq-1', dueDate: '2026-06-10' }),
      makeWO({ id: 'c', code: 'OT-1', equipmentId: 'eq-1', dueDate: '2026-06-10' }),
    ];
    expect(getLinkedWorkOrders(eq, list).map(w => w.id)).toEqual(['c', 'b', 'a']);
  });

  it('ne modifie pas le tableau d\'origine et renvoie [] sans OT', () => {
    const list = [
      makeWO({ id: 'a', code: 'OT-1', equipmentId: 'eq-1', dueDate: '2026-04-10' }),
      makeWO({ id: 'b', code: 'OT-2', equipmentId: 'eq-1', dueDate: '2026-06-10' }),
    ];
    getLinkedWorkOrders(eq, list);
    expect(list.map(w => w.id)).toEqual(['a', 'b']);
    expect(getLinkedWorkOrders(eq, [])).toEqual([]);
  });
});

describe('badges', () => {
  it('badge d\'état opérationnel : vert / orange / rouge', () => {
    expect(getOperationalStatusBadgeClass('En service')).toContain('green');
    expect(getOperationalStatusBadgeClass('Arrêt planifié')).toContain('amber');
    expect(getOperationalStatusBadgeClass('Arrêt non planifié')).toContain('red');
  });

  it('badge de statut d\'OT', () => {
    expect(getWorkOrderStatusBadgeClass('Terminé')).toContain('green');
    expect(getWorkOrderStatusBadgeClass('En cours')).toContain('blue');
    expect(getWorkOrderStatusBadgeClass('En attente')).toContain('purple');
    expect(getWorkOrderStatusBadgeClass('Ouvert')).toContain('gray');
    expect(getWorkOrderStatusBadgeClass('Annulé')).toContain('gray');
  });
});

describe('formatIsoDate', () => {
  it('formate AAAA-MM-JJ en JJ/MM/AAAA', () => {
    expect(formatIsoDate('2026-06-15')).toBe('15/06/2026');
    expect(formatIsoDate('2026-06-15T00:00:00Z')).toBe('15/06/2026');
  });

  it('tolère vide et format inattendu', () => {
    expect(formatIsoDate('')).toBe('');
    expect(formatIsoDate(undefined)).toBe('');
    expect(formatIsoDate('juin')).toBe('juin');
  });
});
