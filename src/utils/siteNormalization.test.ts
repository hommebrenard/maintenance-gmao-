import { describe, it, expect } from 'vitest';
import { findMasterLocationName, getAvailableSiteNames, matchesSiteFilter } from './siteNormalization';

// Les 4 emplacements réels de la table `locations` (noms + codes Zone).
const LOCS = [
  { name: 'AG Type A KENITRA', code: 'BAM_KNT_AG' },
  { name: 'AG Type A MEKNES', code: 'BAM_MKN_AG' },
  { name: 'Succursale régionale Type A FES', code: 'BAM_FEZ_AG' },
  { name: 'Succursale régionale Type B BENI MELLAL', code: 'BAM_BML_AG' },
];

describe('findMasterLocationName', () => {
  it('retrouve le nom officiel depuis un nom, un code ou une variante de code', () => {
    expect(findMasterLocationName('AG Type A KENITRA', LOCS)).toBe('AG Type A KENITRA');
    expect(findMasterLocationName('BAM_KNT_AG', LOCS)).toBe('AG Type A KENITRA');
    expect(findMasterLocationName('BAM-KNT-AG', LOCS)).toBe('AG Type A KENITRA');
    expect(findMasterLocationName('bam_bml_ag', LOCS)).toBe('Succursale régionale Type B BENI MELLAL');
    expect(findMasterLocationName('  ag type a meknes ', LOCS)).toBe('AG Type A MEKNES');
  });

  it('retrouve le nom officiel depuis un alias connu (KNT, Kénitra…)', () => {
    expect(findMasterLocationName('KNT', LOCS)).toBe('AG Type A KENITRA');
    expect(findMasterLocationName('Kénitra', LOCS)).toBe('AG Type A KENITRA');
    expect(findMasterLocationName('Béni Mellal', LOCS)).toBe('Succursale régionale Type B BENI MELLAL');
  });

  it("renvoie undefined quand rien ne correspond (jamais la valeur d'origine)", () => {
    expect(findMasterLocationName('BAM_AGA_AG', LOCS)).toBeUndefined();
    expect(findMasterLocationName('Atelier Principal', LOCS)).toBeUndefined();
    expect(findMasterLocationName('', LOCS)).toBeUndefined();
    expect(findMasterLocationName(undefined, LOCS)).toBeUndefined();
    expect(findMasterLocationName('BAM_KNT_AG', [])).toBeUndefined();
    expect(findMasterLocationName('BAM_KNT_AG', undefined)).toBeUndefined();
  });

  it("l'alias d'un site sans emplacement configuré ne renvoie rien", () => {
    const onlyMeknes = [LOCS[1]];
    expect(findMasterLocationName('Kénitra', onlyMeknes)).toBeUndefined();
  });
});

describe('getAvailableSiteNames', () => {
  it("cas réel : OT avec location (nom) ET entity (code) => uniquement des noms, aucun code", () => {
    const wos = [
      { location: 'AG Type A KENITRA', entity: 'BAM_KNT_AG' },
      { location: 'AG Type A MEKNES', entity: 'BAM_MKN_AG' },
      { location: 'Succursale régionale Type A FES', entity: 'BAM_FEZ_AG' },
      { location: 'Succursale régionale Type B BENI MELLAL', entity: 'BAM_BML_AG' },
      { location: 'AG Type A KENITRA' }, // OT relu depuis un autre poste : pas d'entity local
    ];
    const names = getAvailableSiteNames(wos, LOCS);
    expect(names).toEqual([
      'AG Type A KENITRA',
      'AG Type A MEKNES',
      'Succursale régionale Type A FES',
      'Succursale régionale Type B BENI MELLAL',
    ]);
    expect(names.some(n => /^BAM[_-]/i.test(n))).toBe(false);
  });

  it("un OT sans location mais avec un code connu apparaît sous le nom officiel", () => {
    expect(getAvailableSiteNames([{ location: '', entity: 'BAM_KNT_AG' }], LOCS)).toEqual(['AG Type A KENITRA']);
  });

  it("un code entity inconnu (aucun emplacement) n'est jamais listé", () => {
    expect(getAvailableSiteNames([{ location: '', entity: 'BAM_AGA_AG' }, { location: 'AG Type A MEKNES' }], LOCS)).toEqual([
      'AG Type A MEKNES',
    ]);
  });

  it("un location qui ne correspond à aucun emplacement configuré reste listé", () => {
    expect(getAvailableSiteNames([{ location: 'AG Type A AGADIR' }, { location: 'AG Type A MEKNES' }], LOCS)).toEqual([
      'AG Type A AGADIR',
      'AG Type A MEKNES',
    ]);
  });

  it("ignore 'all' et 'Tous les sites' ; sans OT exploitable, repli sur les emplacements configurés", () => {
    expect(getAvailableSiteNames([{ location: 'all' }, { location: 'Tous les sites' }, { location: '' }], LOCS)).toEqual(
      [...LOCS.map(l => l.name)].sort((a, b) => a.localeCompare(b, 'fr'))
    );
    expect(getAvailableSiteNames([], undefined)).toEqual([]);
  });

  it('pendant le chargement (aucun emplacement encore reçu) : noms des OT seulement, aucun code', () => {
    expect(getAvailableSiteNames([{ location: 'AG Type A KENITRA', entity: 'BAM_KNT_AG' }], [])).toEqual(['AG Type A KENITRA']);
  });
});

describe('matchesSiteFilter (après normalisation)', () => {
  const kenitra = 'AG Type A KENITRA';

  it("sélectionner un nom officiel retrouve les OT portant le nom, le code ou un alias", () => {
    expect(matchesSiteFilter({ location: kenitra } as any, kenitra, LOCS)).toBe(true);
    expect(matchesSiteFilter({ location: '', entity: 'BAM_KNT_AG' } as any, kenitra, LOCS)).toBe(true);
    expect(matchesSiteFilter({ location: 'Kénitra' } as any, kenitra, LOCS)).toBe(true);
    expect(matchesSiteFilter({ location: 'BAM-KNT-AG' } as any, kenitra, LOCS)).toBe(true);
  });

  it("ne mélange pas les sites", () => {
    expect(matchesSiteFilter({ location: 'AG Type A MEKNES', entity: 'BAM_MKN_AG' } as any, kenitra, LOCS)).toBe(false);
    expect(matchesSiteFilter({ location: '' } as any, kenitra, LOCS)).toBe(false);
  });

  it("'all' laisse tout passer", () => {
    expect(matchesSiteFilter({ location: 'AG Type A MEKNES' } as any, 'all', LOCS)).toBe(true);
    expect(matchesSiteFilter({ location: '' } as any, 'Tous les sites', LOCS)).toBe(true);
  });
});
