import { describe, it, expect } from 'vitest';
import { isValidOptionalEmail } from './requestForm';
import { INTERVENTION_TYPES, isInterventionTypeCode } from '../data/interventionTypes';
import { PRIORITY_CHOICES } from '../data/requestPriorities';

describe('formulaire de demande', () => {
  it('courriel facultatif : vide accepté, format vérifié', () => {
    expect(isValidOptionalEmail('')).toBe(true);
    expect(isValidOptionalEmail(undefined)).toBe(true);
    expect(isValidOptionalEmail('k.benali@exemple.ma')).toBe(true);
    expect(isValidOptionalEmail('k.benali@')).toBe(false);
    expect(isValidOptionalEmail('k benali@exemple.ma')).toBe(false);
  });
  it('12 types d\'intervention Coswin, codes uniques', () => {
    expect(INTERVENTION_TYPES).toHaveLength(12);
    expect(new Set(INTERVENTION_TYPES.map(t => t.code)).size).toBe(12);
    expect(isInterventionTypeCode('CSR')).toBe(true);
    expect(isInterventionTypeCode('XXX')).toBe(false);
  });
  it('4 priorités Coswin U0 à U3 associées aux 4 priorités de l\'application', () => {
    expect(PRIORITY_CHOICES.map(p => p.coswinCode)).toEqual(['U0', 'U1', 'U2', 'U3']);
    expect(PRIORITY_CHOICES.map(p => p.value)).toEqual(['Urgente', 'Élevée', 'Moyenne', 'Faible']);
  });
});
