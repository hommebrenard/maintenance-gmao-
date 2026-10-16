import { describe, it, expect } from 'vitest';
import { explainSaveError } from './saveErrors';

describe('explainSaveError', () => {
  it('session expirée', () => {
    expect(explainSaveError({ message: 'JWT expired' })).toContain('session a expiré');
    expect(explainSaveError({ status: 401 })).toContain('session a expiré');
  });
  it('droits', () => {
    expect(explainSaveError({ code: '42501', message: 'permission denied' })).toContain('pas le droit');
  });
  it('aucune ligne modifiée (RLS silencieuse avec .single())', () => {
    expect(explainSaveError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })).toContain('Aucune ligne');
  });
  it('réseau', () => {
    expect(explainSaveError(new TypeError('Failed to fetch'))).toContain('Connexion impossible');
  });
  it('inconnu ou valeur vide : message de repli, sans planter', () => {
    expect(explainSaveError(null)).toContain('Cause inconnue');
    expect(explainSaveError('boom')).toContain('Cause inconnue');
  });
});
