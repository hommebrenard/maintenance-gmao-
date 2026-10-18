import { describe, it, expect } from 'vitest';
import { parseSearchGroups } from './searchTerms';

describe('parseSearchGroups', () => {
  it('vide → aucun terme', () => {
    expect(parseSearchGroups('')).toEqual([]);
    expect(parseSearchGroups('   ')).toEqual([]);
  });
  it('un seul terme reste inchangé (mots multiples compris)', () => {
    expect(parseSearchGroups('OT-85901')).toEqual(['ot-85901']);
    expect(parseSearchGroups('Onduleur N2')).toEqual(['onduleur n2']);
  });
  it('plusieurs codes séparés par espace, virgule, point-virgule ou retour à la ligne', () => {
    expect(parseSearchGroups('OT-85901 OT-85866')).toEqual(['ot-85901', 'ot-85866']);
    expect(parseSearchGroups('85901,85866')).toEqual(['85901', '85866']);
    expect(parseSearchGroups('OT-85901;\nOT-85866\nOT-85890')).toEqual(['ot-85901', 'ot-85866', 'ot-85890']);
  });
  it('codes collés par le navigateur sans séparateur', () => {
    expect(parseSearchGroups('OT-85901OT-85866')).toEqual(['ot-85901', 'ot-85866']);
  });
  it('termes texte séparés par virgule', () => {
    expect(parseSearchGroups('onduleur, caisson air neuf')).toEqual(['onduleur', 'caisson air neuf']);
  });
});
