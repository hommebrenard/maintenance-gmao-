import { describe, expect, it } from 'vitest';
import { classifyIfbtDescription } from './ifbtDescription';

/** Cas réels extraits du fichier DI_IFBT, avec le lot validé par l'utilisateur le 20/10/2026. */
const CASES: [string, string, string][] = [
  ["DI00002465", "Rouille sur le portail du garage", "Bâtiment"],
  ["DI00002207", "Dégradation de l’état de la peinture des équipements techniques situés en terrasse, liée à l’exposition aux conditions climatiques.", "Fluide"],
  ["DI00002291", "Blocage de la porte coulissante du garage", "Électricité"],
  ["DI00002287", "Dysfonctionnement de la porte principale (entrée du personnel)", "Électricité"],
  ["DI00002082", "Défaillance rideaux de fenêtres - Apt B1 et C3", "Bâtiment"],
  ["DI00001904", "Changement de deux poignets portes salle de Tri et deuxième porte SAS Tri", "Serrurerie"],
  ["DI00001681", "Support du détecteur de porte mal fixé, provoquant un mauvais positionnement;", "Électricité"],
  ["DI00001587", "Installation des drapeaux nationaux sur la surface extérieure de l’agence", "Divers"],
  ["DI00001227", "Porte d’entrée défectueuses - Villa 25", "Serrurerie"],
  ["DI00001077", "Machine en arrêt", "À examiner"],
  ["DI00000842", "Demande intervention pour la réparation de la grille du caveau service DH sous-sol.", "Serrurerie"],
  ["DI00000086", "Problème de fermeture de la porte du guichet N°3", "Serrurerie"],
  ["DI00000130", "Besoin d’une Check-list de maintenance préventive groupe électrogène partie mécanique ;", "Électricité"],
  ["DI00001153", "Fuite d'eau au niveau du local sanitaire de bureau de Direction (le problème persite toujours depuis notre dernière déclaration)", "Fluide"],
  ["DI00001099", "Prévoir changement de 04 split système 12000 BTU au niveau l'agence LAAYOUNE", "Fluide"],
  ["DI00002099", "Têtes de robinet d’arrêt défectueuses au niveau des Appartements CV", "Fluide"],
  ["DI00000996", "Fuite au niveau du plafond de cuisine et odeurs assainissement", "Fluide"],
  ["DI00000898", "Besoin de remplacement 3 mécanismespour les chasses d'eau pour la salle de réunion.", "Fluide"],
  ["DI00001525", "Prévoir changement d'un chauffe eau 100L au niveau Centre de vacance TARGA", "Fluide"],
  ["DI00002193", "Changement d'une lampes E27 1étage", "Électricité"],
  ["DI00002190", "Changement d'une lampes tube LED 1.20 caveau 4", "Électricité"],
  ["DI00002421", "Prévoir changement de 16 SPOT LED", "Électricité"],
  ["DI00001342", "Besoin d'ajustement des câbles électriques au niveau de LTI", "Électricité"],
  ["DI00001270", "Problème électrique au niveau du rideau - Aprt 65", "Électricité"],
  ["DI00002013", "Prévoir le remplacement des gants isolants", "Électricité"],
  ["DI00001107", "Préparation de la haute saison du STARK CASABLANCA CLUB", "Divers"],
  ["DI00001026", "Préparation de la haute saison au niveau Ifrane Centre de vacances", "Divers"],
  ["DI00000892", "Assistance technique dans le cadre des préparatifs pour la période d’estivage", "Divers"],
  ["DI00001004", "Préparation de la haute saison au niveau Agadir Centre de vacances", "Divers"],
  ["DI00001031", "Besoin de la villa 108 au CV D'IFRANE", "Divers"],
  ["DI00001050", "Préparation de la haute saison du centre de vacances de Oualidia", "Divers"],
];
const label = (code: string, text: string) => {
  const r = classifyIfbtDescription(code, text);
  return r.lot === 'ELECTRICITE' ? 'Électricité' : r.lot === 'FLUIDE' ? 'Fluide' : r.sub!;
};

describe('classifyIfbtDescription', () => {
  it.each(CASES)('%s → %s', (code, text, expected) => {
    expect(label(code, text)).toBe(expected);
  });
  it('« Machine en arrêt » reste à examiner (doute : machine à café ou fiduciaire), jamais classée d\'office', () => {
    const r = classifyIfbtDescription('DI00001077', 'Machine en arrêt');
    expect(r).toMatchObject({ lot: 'HORS_CONTRAT', sub: 'À examiner', check: true });
  });
  it('deux domaines dans la description : lot du premier cité, marqué « à vérifier »', () => {
    const r = classifyIfbtDescription(undefined, 'Remplacement du chauffe-eau et de la lampe de la douche');
    expect(r.lot).toBe('FLUIDE');
    expect(r.check).toBe(true);
  });
  it('les décisions par numéro de DI priment sur les règles', () => {
    expect(classifyIfbtDescription('DI00002291', 'Blocage de la porte coulissante du garage')).toMatchObject({ lot: 'ELECTRICITE', source: 'override', check: false });
  });
  it('chauffe-eau électrique = fluide ; porte motorisée = électricité ; fuite au plafond = fluide', () => {
    expect(classifyIfbtDescription(undefined, 'Panne du chauffe-eau électrique').lot).toBe('FLUIDE');
    expect(classifyIfbtDescription(undefined, 'Porte motorisée bloquée').lot).toBe('ELECTRICITE');
    expect(classifyIfbtDescription(undefined, 'Fuite d\'eau au niveau du plafond').lot).toBe('FLUIDE');
  });
});
